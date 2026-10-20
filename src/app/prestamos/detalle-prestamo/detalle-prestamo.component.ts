import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro, PrestamoDetalle } from '../../modelos/cobros';
import { AprobacionPrestamo } from '../../modelos/prestamos';
import { ItemPersona } from '../../modelos/catalogos';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { ModalService } from '../../services/modal.service';
import { CatalogosService } from '../../services/catalogos.service';
import { PrestamosService } from '../../services/prestamos.service';
import { AbonoPasivo, ResultadoAbonoPasivo } from '../../modelos/prestamos-pasivos';
import { copiarAlPortapapeles } from '../../shared/portapapeles.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { generarLinkWhatsAppPagoPrestamo } from '../../shared/whatsapp.helper';
import { claseEstadoAprobacion, claseEstadoPrestamo, estaPendiente, resumirAprobaciones, saldoDe } from '../prestamos.constants';

export const MODAL_EDITAR_PRESTAMO = 'prestamo-editar';

type AccionPendiente = 'pagar' | 'anular' | null;

@Component({
  selector: 'app-detalle-prestamo',
  templateUrl: './detalle-prestamo.component.html',
  styleUrl: './detalle-prestamo.component.css'
})
export class DetallePrestamoComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_EDITAR_PRESTAMO;
  readonly claseEstado = claseEstadoPrestamo;
  readonly claseAprobacion = claseEstadoAprobacion;
  readonly resumirAprobaciones = resumirAprobaciones;

  prestamoId = 0;
  prestamo: PrestamoDetalle | null = null;
  personas: ItemPersona[] = [];
  cortes: CorteCobro[] = [];

  cargando = true;
  error: string | null = null;

  /** Acción que espera confirmación (marcar pagado / anular). */
  accionPendiente: AccionPendiente = null;
  ejecutando = false;

  /** Comentario que se va escribiendo por aprobación pendiente (id → texto). */
  comentarios: Record<number, string> = {};
  resolviendo: number | null = null;

  // Abonos POR_PAGAR (Fase 6)
  abonosPasivos: AbonoPasivo[] = [];
  ultimoAbono: ResultadoAbonoPasivo | null = null;
  abonoMonto: number | null = null;
  abonoCuentaDestino = '';
  abonoCuentaOrigenId: number | null = null;
  abonoComprobante: { nombre: string; tipo: string; datos: string } | null = null;
  registrandoAbono = false;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private prestamosService: PrestamosService,
    private catalogos: CatalogosService,
    private cortesService: CortesCobroService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // Nombres de las personas: catálogo compartido (si falla, el préstamo se muestra igual con «—»).
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => (this.personas = e.datos));
    this.catalogos.asegurar(['personas']);
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.prestamoId = Number(params.get('id'));
      if (!Number.isInteger(this.prestamoId) || this.prestamoId <= 0) {
        this.cargando = false;
        this.error = 'El préstamo indicado no es válido.';
        return;
      }
      this.cargar();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    forkJoin({
      prestamo: this.prestamosService.getPrestamo(this.prestamoId),
      cortes: this.cortesService.getCortes().pipe(catchError(() => of([] as CorteCobro[]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ prestamo, cortes }) => {
          this.prestamo = prestamo;
          this.cortes = cortes;
          this.abonoCuentaDestino = prestamo.cuentaDestinoTercero ?? '';
          if (prestamo.direccionPrestamo === 'POR_PAGAR') this.cargarAbonos();
        },
        error: (err) => {
          this.prestamo = null;
          this.error = err?.status === 404 ? 'No encontramos ese préstamo.' : mensajeDeError(err, 'No se pudo cargar el préstamo.');
        }
      });
  }

  volver(): void {
    void this.router.navigate(['/prestamos']);
  }

  // ── edición ──

  abrirEdicion(): void {
    this.modalService.open(this.modalId);
  }

  cerrarEdicion(): void {
    this.modalService.close();
  }

  onActualizado(p: PrestamoDetalle): void {
    this.prestamo = p;
    this.modalService.close();
    this.toast.exito('Préstamo actualizado.');
  }

  // ── pagar / anular con confirmación ──

  pedirConfirmacion(accion: Exclude<AccionPendiente, null>): void {
    this.accionPendiente = accion;
  }

  cancelarAccion(): void {
    this.accionPendiente = null;
  }

  confirmarAccion(): void {
    if (!this.prestamo || !this.accionPendiente) return;
    const estado = this.accionPendiente === 'pagar' ? 'Pagado' : 'Anulado';
    this.ejecutando = true;
    this.prestamosService
      .actualizarPrestamo(this.prestamo.id, { estado })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.ejecutando = false))
      )
      .subscribe({
        next: (p) => {
          this.prestamo = p;
          this.accionPendiente = null;
          this.toast.exito(estado === 'Pagado' ? 'Préstamo marcado como pagado.' : 'Préstamo anulado.');
        },
        error: (err) => {
          this.accionPendiente = null;
          this.toast.error(mensajeDeError(err, 'No se pudo actualizar el préstamo.'));
        }
      });
  }

  // ── aprobaciones ──

  resolver(a: AprobacionPrestamo, estado: 'Aprobado' | 'Rechazado'): void {
    if (!this.prestamo) return;
    const comentario = (this.comentarios[a.id] ?? '').trim();
    this.resolviendo = a.id;
    this.prestamosService
      .resolverAprobacion(this.prestamo.id, a.id, { estado, ...(comentario ? { comentarios: comentario } : {}) })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.resolviendo = null))
      )
      .subscribe({
        next: (actualizada) => {
          if (this.prestamo) {
            this.prestamo = { ...this.prestamo, aprobaciones: this.prestamo.aprobaciones.map((x) => (x.id === a.id ? actualizada : x)) };
          }
          delete this.comentarios[a.id];
          this.toast.exito(estado === 'Aprobado' ? 'Aprobación registrada.' : 'Aprobación rechazada.');
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo resolver la aprobación.'))
      });
  }

  // ── abonos POR_PAGAR (Fase 6) ──

  get esPorPagar(): boolean {
    return this.prestamo?.direccionPrestamo === 'POR_PAGAR';
  }

  cargarAbonos(): void {
    this.prestamosService.getAbonos(this.prestamoId).pipe(takeUntil(this.destroy$), catchError(() => of([] as AbonoPasivo[]))).subscribe((a) => (this.abonosPasivos = a));
  }

  alElegirComprobante(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = String(lector.result ?? '');
      this.abonoComprobante = { nombre: archivo.name, tipo: archivo.type, datos: resultado.includes(',') ? resultado.split(',')[1] : resultado };
    };
    lector.readAsDataURL(archivo);
  }

  registrarAbono(): void {
    if (!this.prestamo || !this.abonoMonto) return;
    this.registrandoAbono = true;
    this.prestamosService
      .registrarAbonoConComprobante(this.prestamo.id, {
        monto: this.abonoMonto,
        cuentaDestinoDetalle: this.abonoCuentaDestino || undefined,
        cuentaOrigenId: this.abonoCuentaOrigenId ?? undefined,
        comprobante: this.abonoComprobante ?? undefined,
      })
      .pipe(takeUntil(this.destroy$), finalize(() => (this.registrandoAbono = false)))
      .subscribe({
        next: (r) => {
          this.ultimoAbono = r;
          this.toast.exito('Abono registrado. Ya puedes enviar el comprobante por WhatsApp.');
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo registrar el abono.')),
      });
  }

  urlPublicaPrestamo(token?: string | null): string {
    return token ? `${window.location.origin}/p/prestamo/${token}` : '';
  }

  linkWhatsAppAbono(r?: ResultadoAbonoPasivo): string {
    const datos = r ?? this.ultimoAbono;
    if (!datos || !this.prestamo) return '';
    const acreedor = this.personas.find((p) => p.id === this.prestamo?.responsable);
    return generarLinkWhatsAppPagoPrestamo({
      nombrePersona: datos.acreedor ?? acreedor?.nombre ?? 'gracias',
      telefono: acreedor?.celular,
      montoPagado: datos.montoPagado,
      cuentaDestinoDetalle: datos.cuentaDestinoDetalle,
      fechaPago: new Date(datos.fechaHoraPago).toLocaleDateString('es-CO'),
      montoInicial: datos.valorInicial,
      totalAbonado: datos.totalAbonado,
      saldoPendiente: datos.saldoPendiente,
      fechaCompromisoPago: this.prestamo.fechaCompromisoPago ? new Date(this.prestamo.fechaCompromisoPago).toLocaleDateString('es-CO') : null,
      urlPublicaComprobante: this.urlPublicaPrestamo(datos.tokenConsultaPublica ?? this.prestamo.tokenConsultaPublica),
    });
  }

  abrirWhatsAppAbono(r?: ResultadoAbonoPasivo): void {
    const url = this.linkWhatsAppAbono(r);
    if (url) window.open(url, '_blank');
  }

  copiarEnlacePublico(): void {
    const url = this.urlPublicaPrestamo(this.prestamo?.tokenConsultaPublica);
    if (url) void copiarAlPortapapeles(url).then(() => this.toast.exito('Enlace público copiado.'));
  }

  // ── presentación ──

  get esPendiente(): boolean {
    return !!this.prestamo && estaPendiente(this.prestamo);
  }

  get saldo(): number {
    return this.prestamo ? saldoDe(this.prestamo) : 0;
  }

  nombrePersona(id: number | null | undefined): string {
    return this.personas.find((p) => p.id === id)?.nombre ?? '—';
  }

  nombreCorte(id: number | null | undefined): string {
    return id === null || id === undefined ? 'Sin corte' : (this.cortes.find((c) => c.id === id)?.concepto ?? `Corte #${id}`);
  }

  trackByAprobacion(_: number, a: AprobacionPrestamo): number {
    return a.id;
  }
}
