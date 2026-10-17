import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AccionObjecion, EnlaceCobro, EstadoObjecion, ObjecionCobro } from '../../modelos/cobros-personas';
import { CobrosPersonasService } from '../../services/cobros-personas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
import { nombrePeriodo } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { OpcionAccion, accionesPara, descuentoDeAccion, etiquetaResolucion, saldoTrasDescuento, tonoObjecion } from '../cobros-fase6.helpers';

export type FiltroObjeciones = 'ABIERTA' | 'RESUELTA' | '';

/** Lo que se está escribiendo para resolver una observación. */
export interface BorradorResolucion {
  objecion: ObjecionCobro;
  accion: AccionObjecion;
  monto: string;
  respuesta: string;
}

/**
 * Observaciones que las personas dejaron en su enlace. Cada una se resuelve de cuatro maneras —mantener el cobro, ajustar su monto,
 * excluirlo o hacer un descuento— y mientras se escribe se ve cuánto pasaría a deber la persona. Al confirmar, el enlace de la persona
 * se recalcula en el acto (lo hace el servidor) y el ajuste queda como un asiento que se puede deshacer.
 */
@Component({
  selector: 'app-observaciones-cobro',
  templateUrl: './observaciones-cobro.component.html',
  styleUrl: './observaciones-cobro.component.css',
})
export class ObservacionesCobroComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) periodo = '';
  /** Los enlaces del mes: de ahí sale cuánto debe hoy cada persona (para la vista previa). */
  @Input() enlaces: EnlaceCobro[] = [];
  /** Cambia cuando el padre quiere que se vuelva a leer la lista. */
  @Input() refresco = 0;
  /** Se resolvió o deshizo algo: el padre vuelve a leer los enlaces (cambia su saldo y su contador). */
  @Output() cambio = new EventEmitter<EnlaceCobro | void>();

  readonly nombrePeriodo = nombrePeriodo;
  readonly etiquetaResolucion = etiquetaResolucion;
  readonly tono = tonoObjecion;
  readonly moneda = moneda;

  objeciones: ObjecionCobro[] = [];
  filtro: FiltroObjeciones = 'ABIERTA';
  cargando = true;
  error: string | null = null;
  trabajando = false;
  borrador: BorradorResolucion | null = null;
  intentado = false;
  errorResolucion: string | null = null;
  deshaciendo: number | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private servicio: CobrosPersonasService,
    private toast: ToastService
  ) {}

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['periodo'] || cambios['refresco']) this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.servicio
      .getObjeciones({ periodo: this.periodo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (lista) => (this.objeciones = lista),
        error: (err) => (this.error = mensajeDeError(err, 'No se pudieron cargar las observaciones.')),
      });
  }

  get visibles(): ObjecionCobro[] {
    return this.filtro ? this.objeciones.filter((o) => o.estado === this.filtro) : this.objeciones;
  }

  contar(estado: EstadoObjecion): number {
    return this.objeciones.filter((o) => o.estado === estado).length;
  }

  // ── resolver ──

  /** Lo que debe hoy la persona de esta observación (según su enlace del mes). */
  saldoDe(o: ObjecionCobro): number {
    return this.enlaces.find((e) => e.id === o.enlaceId)?.resumen?.saldoTotalAcumulado ?? 0;
  }

  acciones(o: ObjecionCobro): ReadonlyArray<OpcionAccion> {
    return accionesPara(o.monto);
  }

  abrirResolucion(o: ObjecionCobro): void {
    this.errorResolucion = null;
    this.intentado = false;
    // lo más probable: si propuso un monto, ajustar; si no, mantener
    const accion: AccionObjecion = o.alcance === 'ITEM' && o.monto !== null && o.monto > 0 ? 'AJUSTAR' : 'MANTENER';
    this.borrador = { objecion: o, accion, monto: o.montoPropuesto !== null && accion === 'AJUSTAR' ? String(o.montoPropuesto) : '', respuesta: '' };
  }

  cancelarResolucion(): void {
    this.borrador = null;
    this.errorResolucion = null;
  }

  elegirAccion(accion: AccionObjecion): void {
    if (!this.borrador) return;
    this.borrador = { ...this.borrador, accion, monto: '' };
    this.errorResolucion = null;
  }

  /** Cuánto se descontaría y cómo quedaría su saldo con lo escrito hasta ahora. */
  get previa(): { descuento: number | null; error: string | null; saldoActual: number; saldoNuevo: number | null } | null {
    const b = this.borrador;
    if (!b) return null;
    const saldoActual = this.saldoDe(b.objecion);
    const r = descuentoDeAccion(b.accion, b.objecion.monto, b.monto, saldoActual);
    return { ...r, saldoActual, saldoNuevo: r.descuento === null ? null : saldoTrasDescuento(saldoActual, r.descuento) };
  }

  get puedeConfirmar(): boolean {
    const b = this.borrador;
    const p = this.previa;
    if (!b || !p || this.trabajando || p.error) return false;
    if (b.accion === 'MANTENER') return b.respuesta.trim().length >= 3;
    if (b.accion === 'AJUSTAR' || b.accion === 'DESCUENTO') return p.descuento !== null;
    return true;
  }

  get pideMonto(): boolean {
    return this.borrador?.accion === 'AJUSTAR' || this.borrador?.accion === 'DESCUENTO';
  }

  confirmar(): void {
    this.intentado = true;
    const b = this.borrador;
    if (!b || !this.puedeConfirmar) return;
    this.trabajando = true;
    this.errorResolucion = null;
    const respuesta = b.respuesta.trim();
    this.servicio
      .resolverObjecion(b.objecion.id, {
        accion: b.accion,
        ...(this.pideMonto ? { monto: b.monto } : {}),
        ...(respuesta ? { respuesta } : {}),
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (r) => {
          this.borrador = null;
          this.objeciones = this.objeciones.map((o) => (o.id === r.objecion.id ? r.objecion : o));
          this.toast.exito(r.descuento ? `Listo: ${b.objecion.persona ?? 'la persona'} ahora debe ${moneda(r.enlace.resumen?.saldoTotalAcumulado ?? 0)}.` : 'Observación respondida: la persona verá tu respuesta.');
          this.cambio.emit(r.enlace);
        },
        error: (err) => (this.errorResolucion = mensajeDeError(err, 'No se pudo resolver la observación.')),
      });
  }

  /** Anula el descuento: la persona vuelve a deber ese monto y su observación queda abierta otra vez. */
  deshacer(o: ObjecionCobro): void {
    if (o.movimientoId === null || this.deshaciendo !== null) return;
    this.deshaciendo = o.id;
    this.servicio
      .deshacerAjuste(o.movimientoId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.deshaciendo = null))
      )
      .subscribe({
        next: () => {
          this.toast.exito('Ajuste deshecho: la persona vuelve a deber ese monto.');
          this.cargar();
          this.cambio.emit();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo deshacer el ajuste.')),
      });
  }

  trackById(_: number, o: { id: number }): number {
    return o.id;
  }
}
