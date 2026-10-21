import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { OpcionSelect } from '../../modelos/catalogos';
import { CorteCobro, CrearPrestamo, MetodoPrestamo } from '../../modelos/cobros';
import { Transaccion } from '../../modelos/erp';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { PrestamosService } from '../../services/prestamos.service';
import { TransaccionesService } from '../../services/transacciones.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { importeConDosDecimales, importeOpcional } from '../../shared/validadores';
import { DIRECCIONES_PRESTAMO, METODOS_PRESTAMO } from '../prestamos.constants';

export type ModoOrigenFondos = 'NINGUNO' | 'DESCONTAR_CUENTA' | 'VINCULAR_EXISTENTE';

/** Corte que contiene `hoy` (si hay varios, el ACTIVO); si ninguno, `null`. */
export function corteParaHoy(cortes: CorteCobro[], hoy: string): CorteCobro | null {
  const vigentes = cortes.filter((c) => c.fecha_inicio.slice(0, 10) <= hoy && hoy <= c.fecha_final.slice(0, 10));
  return vigentes.find((c) => c.estado === 'ACTIVO') ?? vigentes[0] ?? null;
}

/**
 * Iteración 2 — Fase 5: ordena las transferencias/egresos recientes de los últimos 15 días
 * por coincidencia de monto y cercanía de fecha respecto al préstamo.
 */
export function ordenarTransferenciasCandidatas(
  transacciones: Transaccion[],
  montoObjetivo: number | null,
  fechaPrestamoIso: string,
): Transaccion[] {
  const refMs = Date.parse(`${fechaPrestamoIso.slice(0, 10)}T12:00:00Z`) || Date.now();
  const ventana15d = 15 * 24 * 3600 * 1000;
  const elegibles = transacciones.filter((t) => {
    if (t.estado === 'ANULADO') return false;
    if (t.tipo_transaccion !== 'EGRESO' && t.tipo_transaccion !== 'TRANSFERENCIA') return false;
    const txMs = Date.parse(t.fecha_transaccion);
    return Number.isFinite(txMs) ? Math.abs(refMs - txMs) <= ventana15d : true;
  });
  return [...elegibles].sort((a, b) => {
    const diffMontoA = montoObjetivo && montoObjetivo > 0 ? Math.abs(Number(a.monto_cop) - montoObjetivo) : 0;
    const diffMontoB = montoObjetivo && montoObjetivo > 0 ? Math.abs(Number(b.monto_cop) - montoObjetivo) : 0;
    if (diffMontoA !== diffMontoB) return diffMontoA - diffMontoB;
    const diffFechaA = Math.abs((Date.parse(a.fecha_transaccion) || 0) - refMs);
    const diffFechaB = Math.abs((Date.parse(b.fecha_transaccion) || 0) - refMs);
    return diffFechaA - diffFechaB;
  });
}

@Component({
  selector: 'app-formulario-prestamos',
  templateUrl: './formulario-prestamos.component.html',
  styleUrl: './formulario-prestamos.component.css'
})
export class FormularioPrestamosComponent implements OnInit, OnDestroy {
  @Output() creado = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  readonly metodos = METODOS_PRESTAMO;
  readonly direcciones = DIRECCIONES_PRESTAMO;

  cortes: CorteCobro[] = [];
  cargando = true;
  enviando = false;
  errorServidor: string | null = null;

  /** Iteración 2 — Fase 5: Transferencias recientes para vincular con el préstamo. */
  transaccionesRecientes: Transaccion[] = [];
  opcionesTransferencias: OpcionSelect[] = [];
  cargandoTransferencias = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  private transaccionesService = inject(TransaccionesService, { optional: true });

  form = this.fb.group({
    valorPrestado: [null as number | null, [Validators.required, importeConDosDecimales]],
    concepto: ['', [Validators.required, Validators.maxLength(255)]],
    responsable: [null as number | null, Validators.required],
    direccionPrestamo: ['POR_COBRAR' as 'POR_COBRAR' | 'POR_PAGAR', Validators.required],
    metodo: [null as MetodoPrestamo | null],
    fechaPrestamo: [hoyIso(), Validators.required],
    fechaCobro: ['', Validators.required],
    corteId: [null as number | null],
    estado: ['Pendiente', Validators.required],
    esRecurrenteMensual: [false],
    cuotaMensualAcordada: [null as number | null, importeOpcional],
    comentarios: [''],
    modoOrigenFondos: ['NINGUNO' as ModoOrigenFondos],
    cuentaOrigenDesembolsoId: [null as number | null],
    transaccionDesembolsoId: [null as number | null],
  });

  constructor(
    private prestamosService: PrestamosService,
    private cortesService: CortesCobroService
  ) {}

  ngOnInit(): void {
    // Las personas salen del catálogo compartido (el selector muestra su propio esqueleto/vacío/error); aquí solo se cargan los cortes.
    this.cortesService
      .getCortes()
      .pipe(
        catchError(() => of([] as CorteCobro[])),
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe((cortes) => {
        this.cortes = cortes;
        this.form.controls.corteId.setValue(corteParaHoy(cortes, hoyIso())?.id ?? null);
      });

    // La cuota mensual solo se exige cuando el préstamo es recurrente.
    this.form.controls.esRecurrenteMensual.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((recurrente) => {
      const c = this.form.controls.cuotaMensualAcordada;
      c.setValidators(recurrente ? [Validators.required, importeConDosDecimales] : [importeOpcional]);
      if (!recurrente) c.setValue(null);
      c.updateValueAndValidity();
    });

    this.form.controls.modoOrigenFondos.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((modo) => {
      if (modo === 'DESCONTAR_CUENTA') {
        this.form.controls.transaccionDesembolsoId.setValue(null);
      } else if (modo === 'VINCULAR_EXISTENTE') {
        this.form.controls.cuentaOrigenDesembolsoId.setValue(null);
        this.cargarTransferenciasRecientes();
      } else {
        this.form.controls.cuentaOrigenDesembolsoId.setValue(null);
        this.form.controls.transaccionDesembolsoId.setValue(null);
      }
    });

    this.form.controls.valorPrestado.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.transaccionesRecientes.length > 0) this.recalcularOpcionesTransferencias();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  seleccionarModoOrigen(modo: ModoOrigenFondos): void {
    this.form.controls.modoOrigenFondos.setValue(modo);
  }

  cargarTransferenciasRecientes(): void {
    if (!this.transaccionesService || this.cargandoTransferencias) return;
    this.cargandoTransferencias = true;
    this.transaccionesService
      .getTransacciones({ limit: 50 })
      .pipe(
        catchError(() => of({ items: [] as Transaccion[], total: 0, limit: 50, offset: 0 })),
        takeUntil(this.destroy$),
        finalize(() => (this.cargandoTransferencias = false))
      )
      .subscribe((res) => {
        this.transaccionesRecientes = res.items ?? [];
        this.recalcularOpcionesTransferencias();
      });
  }

  private recalcularOpcionesTransferencias(): void {
    const monto = Number(this.form.controls.valorPrestado.value);
    const fecha = this.form.controls.fechaPrestamo.value || hoyIso();
    const ordenadas = ordenarTransferenciasCandidatas(
      this.transaccionesRecientes,
      Number.isFinite(monto) && monto > 0 ? monto : null,
      fecha,
    );
    this.opcionesTransferencias = ordenadas.map((t) => ({
      valor: t.id,
      etiqueta: `${t.concepto} · $${Number(t.monto_cop).toLocaleString('es-CO')}`,
      detalle: `${t.fecha_transaccion.slice(0, 10)} · #${t.id}`,
      grupo:
        Number.isFinite(monto) && monto > 0 && Math.abs(Number(t.monto_cop) - monto) <= 100
          ? 'Coincidencia exacta de monto'
          : 'Últimos 15 días',
    }));
  }

  /** Cuerpo exacto que se envía al backend (público para poder probarlo). */
  construirCuerpo(): CrearPrestamo {
    const v = this.form.getRawValue();
    return {
      valorPrestado: String(v.valorPrestado),
      concepto: (v.concepto ?? '').trim(),
      fechaCobro: v.fechaCobro as string,
      responsable: Number(v.responsable),
      estado: v.estado as string,
      comentarios: (v.comentarios ?? '').trim(),
      direccionPrestamo: v.direccionPrestamo ?? 'POR_COBRAR',
      fechaPrestamo: v.fechaPrestamo as string,
      ...(v.metodo ? { metodo: v.metodo } : {}),
      ...(v.corteId !== null && v.corteId !== undefined ? { corteId: Number(v.corteId) } : {}),
      ...(v.esRecurrenteMensual ? { esRecurrenteMensual: true, cuotaMensualAcordada: String(v.cuotaMensualAcordada) } : {}),
      ...(v.modoOrigenFondos === 'DESCONTAR_CUENTA' && v.cuentaOrigenDesembolsoId
        ? { cuentaOrigenDesembolsoId: Number(v.cuentaOrigenDesembolsoId), crearTransaccionTransferencia: true }
        : {}),
      ...(v.modoOrigenFondos === 'VINCULAR_EXISTENTE' && v.transaccionDesembolsoId
        ? { transaccionDesembolsoId: Number(v.transaccionDesembolsoId) }
        : {}),
    };
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.prestamosService
      .crearPrestamo(this.construirCuerpo())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: () => {
          this.reiniciar();
          this.creado.emit();
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo registrar el préstamo.'))
      });
  }

  private reiniciar(): void {
    this.form.reset({
      valorPrestado: null,
      concepto: '',
      responsable: null,
      direccionPrestamo: 'POR_COBRAR',
      metodo: null,
      fechaPrestamo: hoyIso(),
      fechaCobro: '',
      corteId: corteParaHoy(this.cortes, hoyIso())?.id ?? null,
      estado: 'Pendiente',
      esRecurrenteMensual: false,
      cuotaMensualAcordada: null,
      comentarios: '',
      modoOrigenFondos: 'NINGUNO',
      cuentaOrigenDesembolsoId: null,
      transaccionDesembolsoId: null,
    });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
