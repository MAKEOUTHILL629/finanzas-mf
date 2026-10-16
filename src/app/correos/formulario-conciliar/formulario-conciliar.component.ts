import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ConciliarNotificacion, NotificacionCorreo, ResultadoConciliacion } from '../../modelos/erp';
import { ItemCuenta } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';
import { NotificacionesCorreoService } from '../../services/notificaciones-correo.service';
import { esImporteValido } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { importeOpcional } from '../../shared/validadores';
import { METODOS_PRESTAMO } from '../../prestamos/prestamos.constants';
import { VistaCorreo, admiteConvertirEnPrestamo, explicarMotivo, interpretarCorreo } from '../correos.constants';

/** Qué hay que decidir según lo que el backend ya generó al recibir el correo. */
export type ModoConciliacion = 'compra' | 'transaccion' | 'nuevo';

export function modoDe(n: Pick<NotificacionCorreo, 'compra_credito_generada_id' | 'transaccion_generada_id'>): ModoConciliacion {
  return n.compra_credito_generada_id ? 'compra' : n.transaccion_generada_id ? 'transaccion' : 'nuevo';
}

export interface ValoresConciliacion {
  concepto: string;
  categoriaId: number | null;
  cuentaId: number | null;
  tarjetaId: number | null;
  monto: number | string | null;
  notas: string;
  numeroCuotas: number | null;
  responsables: Array<{ personaId: number | null; porcentajePago: number | string | null }>;
  convertir: boolean;
  prestamoResponsableId: number | null;
  prestamoFechaCobro: string;
  prestamoMetodo: string | null;
  prestamoComentarios: string;
}

/** Cuerpo de `PATCH :id/conciliar` (CONFIRMAR) con solo lo que aplica al modo y lo que el usuario tocó. */
export function construirConfirmacion(
  n: Pick<NotificacionCorreo, 'compra_credito_generada_id' | 'transaccion_generada_id' | 'datos_parseados'>,
  v: ValoresConciliacion
): ConciliarNotificacion {
  const modo = modoDe(n);
  const vista = interpretarCorreo(n);
  const cuerpo: ConciliarNotificacion = { accion: 'CONFIRMAR' };
  const concepto = v.concepto.trim();
  if (concepto) cuerpo.concepto = concepto;

  if (modo === 'compra') {
    if (v.numeroCuotas && v.numeroCuotas > 1) cuerpo.numeroCuotas = Number(v.numeroCuotas);
    const responsables = v.responsables.filter((r) => r.personaId !== null && esImporteValido(r.porcentajePago));
    if (responsables.length > 0) {
      cuerpo.responsables = responsables.map((r) => ({ personaId: Number(r.personaId), porcentajePago: String(r.porcentajePago) }));
    }
    return cuerpo;
  }

  if (v.categoriaId !== null) cuerpo.categoriaId = Number(v.categoriaId);
  const notas = v.notas.trim();
  if (notas) cuerpo.notas = notas;
  if (v.monto !== null && v.monto !== '' && esImporteValido(v.monto) && Number(v.monto) !== vista.monto) cuerpo.monto = String(v.monto);

  if (modo === 'nuevo') {
    if (vista.instrumento === 'TC') {
      if (v.tarjetaId !== null) cuerpo.tarjetaId = Number(v.tarjetaId);
    } else if (v.cuentaId !== null) {
      cuerpo.cuentaId = Number(v.cuentaId);
    }
    return cuerpo;
  }

  if (v.convertir && v.prestamoResponsableId !== null && admiteConvertirEnPrestamo(vista)) {
    cuerpo.convertirEnPrestamo = {
      responsableId: Number(v.prestamoResponsableId),
      ...(v.prestamoFechaCobro ? { fechaCobro: v.prestamoFechaCobro } : {}),
      ...(v.prestamoMetodo ? { metodo: v.prestamoMetodo } : {}),
      ...(v.prestamoComentarios.trim() ? { comentarios: v.prestamoComentarios.trim() } : {}),
    };
  }
  return cuerpo;
}

@Component({
  selector: 'app-formulario-conciliar',
  templateUrl: './formulario-conciliar.component.html',
  styleUrl: './formulario-conciliar.component.css'
})
export class FormularioConciliarComponent implements OnInit, OnDestroy {
  @Input({ required: true }) notificacion!: NotificacionCorreo;
  @Output() conciliada = new EventEmitter<ResultadoConciliacion>();
  @Output() cancelar = new EventEmitter<void>();

  readonly metodos = METODOS_PRESTAMO;
  vista!: VistaCorreo;
  modo!: ModoConciliacion;
  motivo: string | null = null;

  /** «Bancolombia Ahorros ··3698 (COP)». */
  readonly etiquetaCuenta = (c: ItemCuenta): string => `${c.nombre}${c.ultimos4 ? ` ··${c.ultimos4.split(/[,;\s]+/)[0]}` : ''} (${c.moneda})`;

  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    concepto: [''],
    categoriaId: [null as number | null],
    cuentaId: [null as number | null],
    tarjetaId: [null as number | null],
    monto: [null as number | string | null, importeOpcional],
    notas: [''],
    numeroCuotas: [1 as number | null, [Validators.min(1), Validators.max(120), Validators.pattern(/^\d+$/)]],
    responsables: this.fb.array<FormGroup<{ personaId: FormControl<number | null>; porcentajePago: FormControl<number | string | null> }>>([]),
    convertir: [false],
    prestamoResponsableId: [null as number | null],
    prestamoFechaCobro: [''],
    prestamoMetodo: [null as string | null],
    prestamoComentarios: [''],
  });

  constructor(private notificacionesService: NotificacionesCorreoService, private catalogos: CatalogosService) {}

  get responsables() {
    return this.form.controls.responsables;
  }

  ngOnInit(): void {
    this.vista = interpretarCorreo(this.notificacion);
    this.modo = modoDe(this.notificacion);
    this.motivo = explicarMotivo(this.vista.motivo);

    this.form.patchValue({
      concepto: this.vista.comercio ?? this.notificacion.asunto ?? '',
      monto: this.vista.monto,
      prestamoFechaCobro: hoyIso(),
    });

    // Cuentas, categorías, tarjetas y personas: catálogos compartidos (cada selector muestra su esqueleto, vacío o error con «Reintentar»).
    this.catalogos.asegurar(['cuentas', 'categorias', 'tarjetas', 'personas']);
    // Si la cuenta/tarjeta solo puede ser una, se preselecciona (una sola vez, cuando llega el catálogo).
    if (this.modo === 'nuevo') {
      const tipo = this.vista.instrumento === 'TC' ? 'tarjetas' : 'cuentas';
      const control = tipo === 'tarjetas' ? this.form.controls.tarjetaId : this.form.controls.cuentaId;
      this.catalogos.estado$(tipo).pipe(takeUntil(this.destroy$)).subscribe((e) => {
        const posibles = tipo === 'cuentas' ? (e.datos as ItemCuenta[]).filter((c) => c.activa) : e.datos;
        if (control.value === null && !control.dirty && posibles.length === 1) control.setValue(posibles[0].id);
      });
    }

    // El monto, la cuenta/tarjeta (modo nuevo) y los datos del préstamo solo se exigen cuando aplican.
    this.form.controls.convertir.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      const r = this.form.controls.prestamoResponsableId;
      r.setValidators(c ? Validators.required : null);
      r.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── responsables (compras de tarjeta) ──

  agregarResponsable(): void {
    this.responsables.push(
      this.fb.group({
        personaId: new FormControl<number | null>(null, Validators.required),
        porcentajePago: new FormControl<number | string | null>(null, [Validators.required, (c: { value: unknown }) => (esImporteValido(c.value) && Number(c.value) <= 100 ? null : { porcentaje: true })]),
      })
    );
  }

  quitarResponsable(i: number): void {
    this.responsables.removeAt(i);
  }

  get sumaPorcentajes(): number {
    return this.responsables.controls.reduce((acc, g) => acc + (esImporteValido(g.controls.porcentajePago.value) ? Number(g.controls.porcentajePago.value) : 0), 0);
  }

  // ── presentación ──

  get esTarjeta(): boolean {
    return this.vista.instrumento === 'TC';
  }

  get puedeConvertirEnPrestamo(): boolean {
    return this.modo === 'transaccion' && admiteConvertirEnPrestamo(this.vista);
  }

  /** Falta la cuenta/tarjeta que el correo no pudo identificar. */
  get faltaProducto(): boolean {
    if (this.modo !== 'nuevo') return false;
    return this.esTarjeta ? this.form.controls.tarjetaId.value === null : this.form.controls.cuentaId.value === null;
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid || this.faltaProducto || this.sumaPorcentajes > 100) {
      this.form.markAllAsTouched();
      return;
    }
    const cuerpo = construirConfirmacion(this.notificacion, this.form.getRawValue() as ValoresConciliacion);
    this.enviando = true;
    this.notificacionesService
      .conciliarNotificacion(this.notificacion.id, cuerpo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.conciliada.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo conciliar el correo.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
