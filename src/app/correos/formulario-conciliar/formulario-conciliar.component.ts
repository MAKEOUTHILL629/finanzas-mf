import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ConciliarNotificacion, NotificacionCorreo, ResultadoConciliacion } from '../../modelos/erp';
import { ItemTarjeta } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';
import { NotificacionesCorreoService } from '../../services/notificaciones-correo.service';
import { esImporteValido } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
import { hoyIso } from '../../shared/periodo.helper';
import { SelectProductoComponent } from '../../shared/ui/select-producto/select-producto.component';
import { esTarjetaDeCredito, parsearProducto } from '../../shared/ui/select-producto/productos.helpers';
import { importeOpcional } from '../../shared/validadores';
import { METODOS_PRESTAMO } from '../../prestamos/prestamos.constants';
import { ETIQUETAS_CAMPOS_CORREO, VistaCorreo, admiteConvertirEnPrestamo, esMotivoDeProducto, explicarMotivo, fechaDelCorreo, interpretarCorreo } from '../correos.constants';
import { descripcionDelCuerpo } from '../visor-correo/visor-correo.helpers';

/** Qué hay que decidir según lo que el backend ya generó al recibir el correo. */
export type ModoConciliacion = 'compra' | 'transaccion' | 'nuevo';

export function modoDe(n: Pick<NotificacionCorreo, 'compra_credito_generada_id' | 'transaccion_generada_id'>): ModoConciliacion {
  return n.compra_credito_generada_id ? 'compra' : n.transaccion_generada_id ? 'transaccion' : 'nuevo';
}

export interface ValoresConciliacion {
  concepto: string;
  categoriaId: number | null;
  /** Tarjeta o cuenta elegida en el selector único: `t:12` (tarjeta) o `c:3` (cuenta). */
  producto: string | null;
  /** Día del movimiento (`yyyy-MM-dd`); solo se envía si el usuario lo cambió. */
  fecha: string;
  /** TRM cuando el correo está en otra moneda y no trae tasa. */
  tasaCambio: number | string | null;
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

/** ¿Es una TRM válida? Positiva, hasta 4 decimales (como la acepta el servidor). */
export function esTasaValida(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === '') return false;
  const t = String(valor).trim();
  return /^\d+(\.\d{1,4})?$/.test(t) && Number(t) > 0;
}

/** Cuerpo de `PATCH :id/conciliar` (CONFIRMAR) con solo lo que aplica al modo y lo que el usuario tocó. */
export function construirConfirmacion(
  n: Pick<NotificacionCorreo, 'compra_credito_generada_id' | 'transaccion_generada_id' | 'datos_parseados' | 'fecha_correo'>,
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
    // Una tarjeta (de crédito o de débito) viaja como `tarjetaId`; el servidor decide: compra a 1 cuota o movimiento de su cuenta.
    const producto = parsearProducto(v.producto);
    if (producto?.tipo === 'TARJETA') cuerpo.tarjetaId = producto.id;
    else if (producto?.tipo === 'CUENTA') cuerpo.cuentaId = producto.id;
    if (v.fecha && v.fecha !== fechaDelCorreo(n)) cuerpo.fecha = v.fecha;
    if (vista.moneda !== 'COP' && esTasaValida(v.tasaCambio)) cuerpo.tasaCambio = String(v.tasaCambio).trim();
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

/** Lo que se puede copiar del correo al formulario (un resaltado del visor o un atajo). */
export interface UsoDelCorreo {
  tipo: 'monto' | 'fecha' | 'ultimos4' | 'comercio' | 'descripcion';
  valor: string | number;
}

export interface AtajoDelCorreo extends UsoDelCorreo {
  etiqueta: string;
  /** Cómo se ve el valor en el atajo («$35.625», «15/10/2026»). */
  texto: string;
  icono: string;
}

/** Validador de la TRM: vacía vale; si hay algo debe ser un número positivo con hasta 4 decimales. Error: `tasa`. */
function tasaOpcional(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return v === null || v === undefined || v === '' || esTasaValida(v) ? null : { tasa: true };
}

@Component({
  selector: 'app-formulario-conciliar',
  templateUrl: './formulario-conciliar.component.html',
  styleUrl: './formulario-conciliar.component.css'
})
export class FormularioConciliarComponent implements OnInit, OnDestroy {
  @Input({ required: true }) notificacion!: NotificacionCorreo;
  /** Dibuja el título y el asunto (el visor dividido los pone en su propia cabecera). */
  @Input() conCabecera = true;
  @Output() conciliada = new EventEmitter<ResultadoConciliacion>();
  @Output() cancelar = new EventEmitter<void>();

  @ViewChild(SelectProductoComponent) selectorProducto?: SelectProductoComponent;
  @ViewChild('alertaError') alertaError?: ElementRef<HTMLElement>;

  readonly metodos = METODOS_PRESTAMO;
  vista!: VistaCorreo;
  modo!: ModoConciliacion;
  motivo: string | null = null;
  /** Lo que se puede copiar del correo con un clic. */
  atajos: AtajoDelCorreo[] = [];
  /** Qué pasó con el último atajo o resaltado usado (se anuncia a los lectores de pantalla). */
  avisoUso: string | null = null;
  /** De dónde salió la tarjeta o cuenta elegida sola. */
  avisoProducto: string | null = null;

  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  private tarjetas: ItemTarjeta[] = [];
  private descripcion = '';

  form = this.fb.group({
    concepto: [''],
    categoriaId: [null as number | null],
    producto: [null as string | null],
    fecha: [''],
    tasaCambio: [null as number | string | null, tasaOpcional],
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
    this.descripcion = descripcionDelCuerpo(this.notificacion.cuerpo_extraido);

    this.form.patchValue({
      concepto: this.vista.comercio ?? this.notificacion.asunto ?? '',
      monto: this.vista.monto,
      fecha: fechaDelCorreo(this.notificacion),
      prestamoFechaCobro: hoyIso(),
    });
    this.atajos = this.armarAtajos();

    // Cuentas, categorías, tarjetas y personas: catálogos compartidos (cada selector muestra su esqueleto, vacío o error con «Reintentar»).
    this.catalogos.asegurar(['cuentas', 'categorias', 'tarjetas', 'personas']);
    this.catalogos.estado$('tarjetas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.tarjetas = e.datos;
      this.actualizarTrm();
    });

    // La TRM solo se exige cuando hace falta (cuenta o débito con un correo en otra moneda y sin tasa).
    this.form.controls.producto.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.actualizarTrm());
    this.actualizarTrm();

    // El monto, la cuenta/tarjeta (modo nuevo) y los datos del préstamo solo se exigen cuando aplican.
    this.form.controls.convertir.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      const r = this.form.controls.prestamoResponsableId;
      r.setValidators(c ? Validators.required : null);
      r.updateValueAndValidity();
    });
  }

  /** El selector eligió solo el producto de los dígitos del correo: se avisa de dónde salió la elección. */
  alAutoseleccionar(e: { clave: string; ultimos4: string }): void {
    this.avisoProducto = `Elegida por los dígitos ··${e.ultimos4} del correo.`;
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

  /** El motivo del correo, salvo el de «no se pudo identificar la tarjeta/cuenta» una vez que ya se eligió. */
  get motivoVisible(): string | null {
    return this.motivo && esMotivoDeProducto(this.vista.motivo) && this.form.controls.producto.value !== null ? null : this.motivo;
  }

  /** Falta la tarjeta o cuenta que el correo no pudo identificar. */
  get faltaProducto(): boolean {
    return this.modo === 'nuevo' && this.form.controls.producto.value === null;
  }

  /** Qué se va a crear con el producto elegido. */
  get destinoElegido(): 'compra' | 'movimiento' | null {
    const p = parsearProducto(this.form.controls.producto.value);
    if (!p) return null;
    return esTarjetaDeCredito(this.form.controls.producto.value, this.tarjetas) ? 'compra' : 'movimiento';
  }

  /** El correo está en otra moneda y no trae la tasa: hay que indicar la TRM al crear el movimiento. */
  get pideTrm(): boolean {
    return this.modo === 'nuevo' && this.vista.moneda !== 'COP' && this.vista.tasa === null;
  }

  /** Cuenta o débito: sin TRM no se puede registrar. Con tarjeta de crédito el servidor usa la de la última compra en dólares. */
  get trmObligatoria(): boolean {
    return this.pideTrm && this.destinoElegido !== 'compra';
  }

  /** El monto del correo puede corregirse solo si está en pesos y no es una compra importada. */
  get puedeEditarMonto(): boolean {
    return this.modo !== 'compra' && this.vista.moneda === 'COP';
  }

  private actualizarTrm(): void {
    const c = this.form.controls.tasaCambio;
    c.setValidators(this.trmObligatoria ? [Validators.required, tasaOpcional] : [tasaOpcional]);
    c.updateValueAndValidity({ emitEvent: false });
  }

  // ── autollenado desde el correo ──

  private armarAtajos(): AtajoDelCorreo[] {
    const v = this.vista;
    const lista: AtajoDelCorreo[] = [];
    if (v.comercio) lista.push({ tipo: 'comercio', valor: v.comercio, etiqueta: 'Comercio', texto: v.comercio, icono: 'storefront' });
    if (v.monto !== null && this.puedeEditarMonto) lista.push({ tipo: 'monto', valor: v.monto, etiqueta: 'Monto', texto: moneda(v.monto), icono: 'payments' });
    if (this.modo === 'nuevo') {
      const f = fechaDelCorreo(this.notificacion);
      lista.push({ tipo: 'fecha', valor: f, etiqueta: 'Fecha', texto: `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`, icono: 'event' });
      if (v.ultimos4) lista.push({ tipo: 'ultimos4', valor: v.ultimos4, etiqueta: this.esTarjeta ? 'Tarjeta' : 'Cuenta', texto: `··${v.ultimos4}`, icono: this.esTarjeta ? 'credit_card' : 'account_balance' });
    }
    if (this.modo !== 'compra' && this.descripcion) lista.push({ tipo: 'descripcion', valor: this.descripcion, etiqueta: 'Descripción', texto: this.descripcion.length > 40 ? `${this.descripcion.slice(0, 40)}…` : this.descripcion, icono: 'notes' });
    return lista;
  }

  /** Copia un dato del correo (un resaltado del visor o un atajo) al campo que le corresponde. Devuelve lo que pasó. */
  aplicar(uso: UsoDelCorreo): string {
    const f = this.form.controls;
    let aviso: string;
    switch (uso.tipo) {
      case 'comercio':
        f.concepto.setValue(String(uso.valor));
        f.concepto.markAsDirty();
        aviso = `Concepto: ${uso.valor}`;
        break;
      case 'monto':
        if (!this.puedeEditarMonto) {
          aviso = this.modo === 'compra' ? 'El monto de una compra importada no se cambia aquí.' : `El correo está en ${this.vista.moneda}: ese monto no se corrige aquí.`;
          break;
        }
        f.monto.setValue(Number(uso.valor));
        f.monto.markAsDirty();
        aviso = `Monto: ${moneda(Number(uso.valor))}`;
        break;
      case 'fecha':
        if (this.modo !== 'nuevo') {
          aviso = 'La fecha de un movimiento ya registrado no se cambia aquí.';
          break;
        }
        f.fecha.setValue(String(uso.valor));
        f.fecha.markAsDirty();
        aviso = `Fecha: ${String(uso.valor).slice(8, 10)}/${String(uso.valor).slice(5, 7)}/${String(uso.valor).slice(0, 4)}`;
        break;
      case 'ultimos4':
        if (this.modo !== 'nuevo') {
          aviso = 'Este correo ya tiene su tarjeta o cuenta asignada.';
          break;
        }
        if (this.selectorProducto?.elegirPorUltimos4(String(uso.valor))) {
          this.avisoProducto = `Elegida por los dígitos ··${uso.valor} del correo.`;
          aviso = `Tarjeta o cuenta de ··${uso.valor}`;
        } else {
          aviso = `No hay una sola tarjeta o cuenta con ··${uso.valor}: elígela en la lista.`;
        }
        break;
      case 'descripcion':
        if (this.modo === 'compra') {
          aviso = 'Una compra importada no tiene notas.';
          break;
        }
        f.notas.setValue(String(uso.valor));
        f.notas.markAsDirty();
        aviso = 'Notas: descripción del correo';
        break;
    }
    this.avisoUso = aviso;
    return aviso;
  }

  /** Llena de una vez todo lo que el correo sabe. */
  rellenarTodo(): void {
    for (const a of this.atajos) this.aplicar(a);
    this.avisoUso = 'Se llenó el formulario con lo que dice el correo. Revísalo y confirma.';
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
        error: (err) => {
          this.errorServidor = mensajeDeError(err, 'No se pudo conciliar el correo.', ETIQUETAS_CAMPOS_CORREO);
          // El aviso queda en el formulario (el modal tapa los avisos flotantes): se acerca a la vista para que no pase inadvertido.
          setTimeout(() => this.alertaError?.nativeElement.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
        }
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
