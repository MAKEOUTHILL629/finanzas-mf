import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { Periodo, ResultadoPagoExtracto, ResumenMensualTarjeta } from '../../modelos/erp';
import { ModalService } from '../../services/modal.service';
import { TarjetasService } from '../../services/tarjetas.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { moneda } from '../../shared/moneda.util';
import { ACCION_MES_ACTUAL, AccionUI, ListaAcciones } from '../../shared/ui/acciones/acciones.component';

export const MODAL_PAGO_EXTRACTO = 'pagar-extracto-form';

@Component({
  selector: 'app-extractos-tarjetas',
  templateUrl: './extractos-tarjetas.component.html',
  styleUrl: './extractos-tarjetas.component.css'
})
export class ExtractosTarjetasComponent implements OnInit, OnDestroy {
  private readonly accSecundarias = new ListaAcciones();
  get secundarias(): AccionUI[] {
    return this.accSecundarias.obtener(String(this.esMesActual()), () => [
      ...(this.esMesActual() ? [] : [ACCION_MES_ACTUAL]),
    ]);
  }

  alAccionar(id: string): void {
    if (id === 'mes-actual') this.irAlMesActual();
  }

  readonly modalId = MODAL_PAGO_EXTRACTO;

  periodo: Periodo = periodoActual();
  resumenes: ResumenMensualTarjeta[] = [];
  /** Tarjeta cuyo extracto se está pagando (el formulario se crea al seleccionar y se destruye al cerrar el modal). */
  seleccionada: ResumenMensualTarjeta | null = null;
  totales = { extracto: 0, propio: 0, terceros: 0 };

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private tarjetasService: TarjetasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // Cualquier cierre del modal (X, clic fuera, éxito) descarta el formulario para que la próxima apertura recargue todo.
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.seleccionada = null;
    });
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.tarjetasService
      .getResumenMensual(this.periodo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (filas) => {
          this.resumenes = filas;
          this.totales = {
            extracto: sumarMonedas(filas.map((f) => f.total_extracto_cop)),
            propio: sumarMonedas(filas.map((f) => f.total_propio)),
            terceros: sumarMonedas(filas.map((f) => f.total_responsabilidad_terceros)),
          };
        },
        error: (err) => {
          this.resumenes = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar los extractos.');
        }
      });
  }

  onPeriodoChange(valor: string): void {
    if (!esPeriodoValido(valor)) return;
    this.periodo = valor;
    this.cargar();
  }

  moverPeriodo(delta: number): void {
    this.periodo = desplazarPeriodo(this.periodo, delta);
    this.cargar();
  }

  irAlMesActual(): void {
    this.periodo = periodoActual();
    this.cargar();
  }

  abrirPago(r: ResumenMensualTarjeta): void {
    this.seleccionada = r;
    this.modalService.open(this.modalId);
  }

  cerrarPago(): void {
    this.modalService.close();
  }

  onPagado(res: ResultadoPagoExtracto): void {
    this.modalService.close();
    this.toast.exito(`Extracto pagado: ${moneda(res.montoPagado)}. Se registró la transacción #${res.transaccionId}.`);
    this.cargar();
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  /** "Mastercard · Black" a partir de franquicia + descripción (como el SP al nombrar el pago). */
  nombreTarjeta(r: ResumenMensualTarjeta): string {
    return [r.franquicia, r.nombre_tarjeta].filter((x) => !!x).join(' · ') || `Tarjeta #${r.tarjeta_id}`;
  }

  /** Parámetros de `/pagos-mes/:id` (la pantalla de cuotas existente espera `mes` 1-12 y `year`). */
  get paramsCuotas(): { mes: number; year: number } {
    return { mes: Number(this.periodo.slice(5, 7)), year: Number(this.periodo.slice(0, 4)) };
  }

  esMesActual(): boolean {
    return this.periodo === periodoActual();
  }

  /** Qué parte del extracto es tuya (0–100), para la barra «lo mío vs. lo de terceros». */
  porcentajePropio(r: ResumenMensualTarjeta): number {
    const total = Number(r.total_extracto_cop);
    if (!(total > 0)) return 0;
    return Math.max(0, Math.min(100, Math.round((Number(r.total_propio) / total) * 1000) / 10));
  }

  tieneUsd(r: ResumenMensualTarjeta): boolean {
    return Number(r.componente_en_usd) > 0;
  }

  trackById(_: number, r: ResumenMensualTarjeta): number {
    return r.tarjeta_id;
  }
}
