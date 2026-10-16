import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ResultadoReemplazo, Tarjeta } from '../../modelos/tarjeta';
import { ModalService } from '../../services/modal.service';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { etiquetaMotivo, nombreTarjeta, plasticosArchivados, terminacion, vigenciaLegible } from '../tarjetas.constants';

export const MODAL_TARJETA = 'tarjeta-form';
export const MODAL_PLASTICO = 'tarjeta-plastico';

/** Qué le falta configurar a una tarjeta para que los extractos y los correos funcionen bien. */
export function pendientesDeConfigurar(t: Tarjeta): string[] {
  const faltan: string[] = [];
  if (t.diaCorte === null || t.diaCorte === undefined) faltan.push('día de corte');
  if (t.diaLimitePago === null || t.diaLimitePago === undefined) faltan.push('día límite de pago');
  // Los dígitos viven en su propia columna; las tarjetas antiguas los llevan en la descripción ("Oro *1927").
  if (!/\d{4}/.test(t.ultimos4Digitos ?? '') && !/\d{4}/.test(t.descripcion ?? '')) faltan.push('últimos 4 dígitos');
  return faltan;
}

@Component({
  selector: 'app-lista-tarjetas',
  templateUrl: './lista-tarjetas.component.html',
  styleUrl: './lista-tarjetas.component.css'
})
export class ListaTarjetasComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_TARJETA;
  readonly modalPlastico = MODAL_PLASTICO;
  readonly pendientes = pendientesDeConfigurar;
  readonly terminacion = terminacion;
  readonly archivados = plasticosArchivados;
  readonly vigencia = vigenciaLegible;
  readonly motivo = etiquetaMotivo;

  tarjetas: Tarjeta[] = [];
  /** Tarjeta que se edita; el formulario existe solo mientras el modal está abierto. */
  editando: Tarjeta | null = null;
  /** Tarjeta a la que se le registra un reemplazo de plástico. */
  reemplazando: Tarjeta | null = null;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private tarjetasService: TarjetasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.editando = null;
      if (id !== this.modalPlastico) this.reemplazando = null;
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
      .getTarjetas()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (t) => (this.tarjetas = t),
        error: (err) => {
          this.tarjetas = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar las tarjetas.');
        }
      });
  }

  editar(t: Tarjeta): void {
    this.editando = t;
    this.modalService.open(this.modalId);
  }

  registrarReemplazo(t: Tarjeta): void {
    this.reemplazando = t;
    this.modalService.open(this.modalPlastico);
  }

  cerrar(): void {
    this.modalService.close();
  }

  onGuardada(t: Tarjeta): void {
    this.tarjetas = this.tarjetas.map((x) => (x.id === t.id ? t : x));
    this.modalService.close();
    this.toast.exito('Tarjeta actualizada.');
  }

  /** El reemplazo trae la lista de plásticos ya actualizada: se refleja en la tarjeta sin recargar todo. */
  onPlasticoGuardado(r: ResultadoReemplazo): void {
    const id = this.reemplazando?.id;
    this.tarjetas = this.tarjetas.map((t) =>
      t.id === id
        ? { ...t, plasticos: r.plasticos, plasticoActivo: r.plasticoActivo, ultimos4Activo: r.plasticoActivo.ultimos4, ultimos4Digitos: r.plasticos.map((p) => p.ultimos4).join(',') }
        : t
    );
    this.modalService.close();
    this.toast.exito(`Plástico ${terminacion(r.plasticoActivo.ultimos4)} registrado. Tu historial de compras no cambió.`);
  }

  nombre(t: Tarjeta): string {
    return nombreTarjeta(t);
  }

  trackById(_: number, t: Tarjeta): number | undefined {
    return t.id;
  }
}
