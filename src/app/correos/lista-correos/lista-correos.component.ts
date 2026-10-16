import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ResumenReproceso } from '../../modelos/correos-inteligentes';
import { EstadoNotificacionCorreo, NotificacionCorreo, ResultadoConciliacion } from '../../modelos/erp';
import { ItemPersona } from '../../modelos/catalogos';
import { ModalService } from '../../services/modal.service';
import { NotificacionesCorreoService } from '../../services/notificaciones-correo.service';
import { CatalogosService } from '../../services/catalogos.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { ESTADOS_CORREO, VistaCorreo, admiteDeshacer, claseEstadoCorreo, etiquetaEstadoCorreo, etiquetaVinculo, explicarMotivo, interpretarCorreo } from '../correos.constants';
import { AccionUI, ListaAcciones } from '../../shared/ui/acciones/acciones.component';

export const MODAL_CONCILIAR = 'correo-conciliar';
export const MODAL_REPROCESAR = 'correos-reprocesar';
export const LIMITE_CORREOS = 300;

/** Cuántos correos hay por estado (para los contadores de las pestañas). */
export function contarPorEstado(correos: NotificacionCorreo[]): Record<string, number> {
  const c: Record<string, number> = { '': correos.length };
  for (const n of correos) c[n.estado_procesamiento ?? ''] = (c[n.estado_procesamiento ?? ''] ?? 0) + 1;
  return c;
}

@Component({
  selector: 'app-lista-correos',
  templateUrl: './lista-correos.component.html',
  styleUrl: './lista-correos.component.css'
})
export class ListaCorreosComponent implements OnInit, OnDestroy {
  private readonly accSecundarias = new ListaAcciones();
  get secundarias(): AccionUI[] {
    return this.accSecundarias.obtener(String(this.cargando), () => [
      { id: 'actualizar', etiqueta: this.cargando ? 'Actualizando…' : 'Actualizar', icono: this.cargando ? 'sync' : 'refresh', variante: 'ghost', tooltip: 'Volver a pedir los correos', cargando: this.cargando },
    ]);
  }

  alAccionar(id: string): void {
    if (id === 'actualizar') this.cargar();
  }

  readonly modalId = MODAL_CONCILIAR;
  readonly modalReproceso = MODAL_REPROCESAR;
  readonly pestanas = ESTADOS_CORREO;
  readonly claseEstado = claseEstadoCorreo;
  readonly etiquetaEstado = etiquetaEstadoCorreo;
  readonly explicar = explicarMotivo;
  readonly vinculo = etiquetaVinculo;
  readonly deshacer = admiteDeshacer;

  correos: NotificacionCorreo[] = [];
  conteos: Record<string, number> = {};
  pestana: '' | EstadoNotificacionCorreo = 'PENDIENTE';

  /** Correo que se concilia; el formulario existe solo mientras el modal está abierto. */
  conciliando: NotificacionCorreo | null = null;
  reprocesando = false;
  personas: ItemPersona[] = [];
  confirmandoDescarte: NotificacionCorreo | null = null;
  trabajando = false;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private notificacionesService: NotificacionesCorreoService,
    private modalService: ModalService,
    private catalogos: CatalogosService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.conciliando = null;
      if (id !== this.modalReproceso) this.reprocesando = false;
    });
    // Nombre de la persona reconocida en cada correo: catálogo compartido (si falla, solo no se muestra el nombre).
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => (this.personas = e.datos));
    this.catalogos.asegurar(['personas']);
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.notificacionesService
      .getNotificaciones(undefined, LIMITE_CORREOS)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (c) => {
          this.correos = c;
          this.conteos = contarPorEstado(c);
        },
        error: (err) => {
          this.correos = [];
          this.conteos = {};
          this.error = mensajeDeError(err, 'No se pudo cargar la bandeja de correos.');
        }
      });
  }

  get visibles(): NotificacionCorreo[] {
    return this.pestana ? this.correos.filter((c) => c.estado_procesamiento === this.pestana) : this.correos;
  }

  cantidad(estado: '' | EstadoNotificacionCorreo): number {
    return this.conteos[estado] ?? 0;
  }

  vista(n: NotificacionCorreo): VistaCorreo {
    return interpretarCorreo(n);
  }

  // ── conciliar ──

  abrirConciliar(n: NotificacionCorreo): void {
    this.conciliando = n;
    this.modalService.open(this.modalId);
  }

  cerrarConciliar(): void {
    this.modalService.close();
  }

  onConciliada(r: ResultadoConciliacion): void {
    this.modalService.close();
    const extra: string[] = [];
    if (r.prestamoId) extra.push(`préstamo #${r.prestamoId} creado`);
    if (r.responsablesCreados > 0) extra.push(`${r.responsablesCreados} responsable${r.responsablesCreados === 1 ? '' : 's'} asignado${r.responsablesCreados === 1 ? '' : 's'}`);
    this.toast.exito(`Correo conciliado${extra.length ? ': ' + extra.join(', ') : ''}.`);
    this.cargar();
  }

  // ── reprocesar pendientes ──

  abrirReproceso(): void {
    this.reprocesando = true;
    this.modalService.open(this.modalReproceso);
  }

  cerrarReproceso(): void {
    this.modalService.close();
  }

  onReprocesado(r: ResumenReproceso): void {
    const creadas = (r.acciones['compras_creadas'] ?? 0) + (r.acciones['compras_creadas_con_plantilla'] ?? 0);
    const enlazadas = (r.acciones['compras_enlazadas'] ?? 0) + (r.acciones['transacciones_enlazadas'] ?? 0);
    const movimientos = r.acciones['transacciones_creadas'] ?? 0;
    this.toast.exito(`Reproceso listo: ${creadas} compra${creadas === 1 ? '' : 's'} nueva${creadas === 1 ? '' : 's'}, ${movimientos} movimiento${movimientos === 1 ? '' : 's'}, ${enlazadas} enlazado${enlazadas === 1 ? '' : 's'}.`);
    this.cargar();
  }

  nombrePersona(id: number | null | undefined): string | null {
    if (id === null || id === undefined) return null;
    return this.personas.find((p) => p.id === id)?.nombre ?? null;
  }

  // ── descartar ──

  pedirDescarte(n: NotificacionCorreo): void {
    this.confirmandoDescarte = n;
  }

  cancelarDescarte(): void {
    this.confirmandoDescarte = null;
  }

  confirmarDescarte(): void {
    const n = this.confirmandoDescarte;
    if (!n) return;
    this.trabajando = true;
    this.notificacionesService
      .descartarNotificacion(n.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoDescarte = null;
          this.toast.exito('Correo descartado.');
          this.cargar();
        },
        error: (err) => {
          this.confirmandoDescarte = null;
          this.toast.error(mensajeDeError(err, 'No se pudo descartar el correo.'));
        }
      });
  }

  /** Lo que se perdería al descartar: la compra importada o la transacción pendiente que se generó. */
  efectoDeDescartar(n: NotificacionCorreo): string {
    if (n.vinculo === 'EXISTENTE') return 'Lo que ya tenías registrado se conserva: el correo solo se separa de ello y queda ignorado.';
    if (n.vinculo === 'DUPLICADO') return 'Es un aviso repetido: solo se marca como ignorado.';
    if (n.compra_credito_generada_id) return 'La compra que se importó de este correo se eliminará junto con sus cuotas.';
    if (n.transaccion_generada_id) return 'La transacción generada quedará anulada.';
    return 'No se generó ningún movimiento: solo se marca el correo como ignorado.';
  }

  trackById(_: number, n: NotificacionCorreo): number {
    return n.id;
  }
}
