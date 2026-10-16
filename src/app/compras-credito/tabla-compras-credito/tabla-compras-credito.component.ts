import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ItemPersona, ItemTarjeta } from '../../modelos/catalogos';
import { ComprasCredito } from '../../modelos/compras-credito';
import { ApiServicesService } from '../../services/api-services.service';
import { CatalogosService } from '../../services/catalogos.service';
import { ModalService } from '../../services/modal.service';
import { SharedListasService } from '../../services/shared-listas.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';
import { ColumnaTabla, OrdenTabla } from '../../shared/ui/apple-table/apple-table.types';
import { DefinicionFiltro, EstadoFiltros, SegmentoFiltro, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';
import { ContextoCompras, SEGMENTOS_COMPRAS, conteoPorSegmento, filtrarCompras, idsResponsables, segmentoDe } from './compras-filtros';

interface ResponsableVista {
  iniciales: string;
  color: string;
  nombre: string;
}

const ETIQUETA_SEGMENTO: Record<(typeof SEGMENTOS_COMPRAS)[number], string> = {
  todas: 'Todas',
  pendientes: 'Pendientes',
  pagadas: 'Pagadas',
  refinanciadas: 'Refinanciadas',
};

/** Tono de la insignia de estado de una compra. */
export function tonoEstadoCompra(estado: string | undefined): 'success' | 'warning' | 'info' | 'neutral' {
  switch (segmentoDe({ estado })) {
    case 'pagadas':
      return 'success';
    case 'pendientes':
      return 'warning';
    case 'refinanciadas':
      return 'info';
    default:
      return 'neutral';
  }
}

@Component({
  selector: 'app-tabla-compras-credito',
  templateUrl: './tabla-compras-credito.component.html',
  styleUrl: './tabla-compras-credito.component.css',
})
export class TablaComprasCreditoComponent implements OnInit, OnDestroy {
  readonly tonoEstado = tonoEstadoCompra;

  comprasCredito: ComprasCredito[] = [];
  filtradas: ComprasCredito[] = [];
  isLoading = false;
  isRefreshing = false;
  error: string | null = null;

  /** Filtros: buscador, estados rápidos y chips. */
  estadoFiltros: EstadoFiltros = estadoVacio('todas');
  segmentos: SegmentoFiltro[] = SEGMENTOS_COMPRAS.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: 0 }));
  filtros: DefinicionFiltro[] = [];

  readonly ordenInicial: OrdenTabla = { columna: 'fechaCompra', direccion: 'desc' };
  readonly columnas: ColumnaTabla<ComprasCredito>[] = [
    { id: 'concepto', titulo: 'Concepto', valor: (c) => c.concepto, prioridad: 1, truncar: true, anchoMin: 220 },
    { id: 'valorCompra', titulo: 'Valor compra', valor: (c) => c.valorCompra, formato: 'moneda', prioridad: 1, anchoMin: 130 },
    { id: 'fechaCompra', titulo: 'Fecha compra', valor: (c) => (c.fechaCompra ? new Date(c.fechaCompra) : null), formato: 'fechaCorta', prioridad: 2, anchoMin: 120 },
    { id: 'numeroCuotas', titulo: 'Cuotas', valor: (c) => c.numeroCuotas, formato: 'numero', prioridad: 2, anchoMin: 80 },
    { id: 'pagoMensual', titulo: 'Pago mensual', valor: (c) => c.pagoMensual, formato: 'moneda', prioridad: 2, anchoMin: 130 },
    { id: 'responsables', titulo: 'Responsables', valor: (c) => c.porcentajePago ?? 0, prioridad: 2, anchoMin: 150 },
    { id: 'estado', titulo: 'Estado', valor: (c) => c.estado, prioridad: 1, anchoMin: 110 },
    { id: 'tarjeta', titulo: 'Tarjeta', valor: (c) => this.nombreTarjeta(c.tarjeta), prioridad: 2, truncar: true, anchoMin: 150 },
    { id: 'fechaUltimaCuota', titulo: 'Última cuota', valor: (c) => (c.fechaUltimaCuota ? new Date(c.fechaUltimaCuota) : null), formato: 'fechaCorta', prioridad: 3, anchoMin: 120 },
    { id: 'interes', titulo: 'Interés', valor: (c) => c.interes, formato: 'porcentaje', prioridad: 3, anchoMin: 90 },
  ];

  readonly principal: AccionUI = { id: 'nueva', etiqueta: 'Nueva compra', icono: 'add', tooltip: 'Registrar una compra a crédito' };
  secundarias: AccionUI[] = [];

  tarjetas: ItemTarjeta[] = [];
  personas: ItemPersona[] = [];
  /** Si los catálogos no cargaron se avisa (antes un fallo se veía como «No hay tarjetas disponibles»). */
  errorCatalogos: string | null = null;

  private destroy$ = new Subject<void>();
  private cache = new Map<number, ResponsableVista[]>();

  constructor(
    private apiService: ApiServicesService,
    private router: Router,
    private modalService: ModalService,
    private sharedListasService: SharedListasService,
    private catalogos: CatalogosService,
    private ruta: ActivatedRoute
  ) {
    this.refrescarAcciones();
  }

  ngOnInit(): void {
    this.atenderAccionRapida();
    this.loadTarjetas();
    this.loadPersonas();
    this.loadProducts();

    // Suscribirse a notificaciones de compras creadas
    this.modalService.compraCreated$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshCompras());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ───────── contexto para los filtros ─────────

  private readonly contexto: ContextoCompras = {
    nombreTarjeta: (id) => this.nombreTarjeta(id),
    nombrePersona: (id) => this.sharedListasService.getNombrePersonaById(id),
  };

  nombreTarjeta(id: number | null | undefined): string {
    if (id === null || id === undefined) return '';
    return this.tarjetas.find((t) => t.id === id)?.etiqueta ?? (this.sharedListasService.getNombreTarjetaById(id) || '');
  }

  // ───────── carga ─────────

  /** Tarjetas del filtro: catálogo compartido (esqueleto/vacío/error en un solo lugar; no se repite si otra pantalla ya lo cargó). */
  loadTarjetas(): void {
    this.catalogos.estado$('tarjetas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.tarjetas = e.datos;
      this.errorCatalogos = e.error ?? this.errorCatalogos;
      if (e.cargado && !e.error) this.errorCatalogos = null;
      this.armarFiltros();
    });
    this.catalogos.asegurar(['tarjetas']);
  }

  loadPersonas(): void {
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.personas = e.datos;
      if (e.error) this.errorCatalogos = e.error;
      this.cache.clear();
      this.armarFiltros();
    });
    this.catalogos.asegurar(['personas']);
  }

  reintentarCatalogos(): void {
    this.errorCatalogos = null;
    this.catalogos.recargar(['tarjetas', 'personas']);
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;
    this.apiService.get<ComprasCredito[]>('compras-credito').pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.comprasCredito = data;
        this.isLoading = false;
        this.aplicar();
      },
      error: (err) => {
        this.error = mensajeDeError(err, 'Error al cargar las compras. Por favor, intente de nuevo.');
        this.isLoading = false;
      },
    });
  }

  refreshCompras(): void {
    this.isRefreshing = true;
    this.refrescarAcciones();
    this.apiService.get<ComprasCredito[]>('compras-credito').pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.comprasCredito = data;
        this.isRefreshing = false;
        this.refrescarAcciones();
        this.aplicar();
      },
      error: () => {
        this.isRefreshing = false;
        this.refrescarAcciones();
      },
    });
  }

  // ───────── filtros ─────────

  private armarFiltros(): void {
    this.filtros = [
      {
        id: 'personas',
        tipo: 'seleccion',
        etiqueta: 'Persona',
        icono: 'person',
        multiple: true,
        buscable: true,
        opciones: this.personas.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
      },
      {
        id: 'tarjetas',
        tipo: 'seleccion',
        etiqueta: 'Tarjeta',
        icono: 'credit_card',
        multiple: true,
        buscable: true,
        opciones: this.tarjetas.map((t) => ({ valor: t.id, etiqueta: t.etiqueta, detalle: t.nombre !== t.etiqueta ? t.nombre : undefined })),
      },
      { id: 'fechaCompra', tipo: 'fechas', etiqueta: 'Fecha de compra', icono: 'event' },
      { id: 'fechaUltimaCuota', tipo: 'fechas', etiqueta: 'Última cuota', icono: 'event_available' },
      { id: 'cuotas', tipo: 'numero', etiqueta: 'Cuotas', icono: 'pin', placeholder: 'Ej: 12' },
      { id: 'sinResponsables', tipo: 'interruptor', etiqueta: 'Sin responsables completos', icono: 'person_off' },
    ];
  }

  alFiltrar(estado: EstadoFiltros): void {
    this.estadoFiltros = estado;
    this.aplicar();
  }

  private aplicar(): void {
    this.filtradas = filtrarCompras(this.comprasCredito, this.estadoFiltros, this.contexto);
    const c = conteoPorSegmento(this.comprasCredito, this.estadoFiltros, this.contexto);
    this.segmentos = SEGMENTOS_COMPRAS.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: c[s] }));
  }

  // ───────── resumen ─────────

  get totalValor(): number {
    return sumarMonedas(this.filtradas.map((c) => c.valorCompra));
  }

  get totalMensual(): number {
    return sumarMonedas(this.filtradas.filter((c) => segmentoDe(c) === 'pendientes').map((c) => c.pagoMensual));
  }

  get pendientes(): number {
    return this.filtradas.filter((c) => segmentoDe(c) === 'pendientes').length;
  }

  // ───────── acciones ─────────

  private refrescarAcciones(): void {
    this.secundarias = [
      { id: 'pagar', etiqueta: 'Procesar pagos', icono: 'paid', tooltip: 'Marcar como pagadas las cuotas que ya vencieron' },
      { id: 'csv', etiqueta: 'Carga masiva', icono: 'upload_file', tooltip: 'Cargar varias compras desde un archivo CSV' },
      {
        id: 'refrescar',
        etiqueta: this.isRefreshing ? 'Actualizando…' : 'Actualizar',
        icono: this.isRefreshing ? 'sync' : 'refresh',
        tooltip: 'Volver a pedir la lista de compras',
        cargando: this.isRefreshing,
      },
    ];
  }

  alAccionar(id: string): void {
    if (id === 'nueva') this.openCreditForm();
    else if (id === 'pagar') this.pagarProductosTarjetaCredito();
    else if (id === 'csv') this.openCSVUploadForm();
    else if (id === 'refrescar') this.refreshCompras();
  }

  irDetalleCompra(compra: ComprasCredito): void {
    this.router.navigate(['/compra-credito-detalle', compra.id], {
      state: { compra: compra },
    });
  }

  /** El inicio enlaza con `?accion=nueva`: se abre el formulario y se limpia la URL para que recargar no lo reabra. */
  private atenderAccionRapida(): void {
    if (this.ruta.snapshot.queryParamMap.get('accion') !== 'nueva') return;
    void this.router.navigate([], { queryParams: { accion: null }, queryParamsHandling: 'merge', replaceUrl: true });
    setTimeout(() => this.openCreditForm());
  }

  openCreditForm(): void {
    this.modalService.open('compra-credito-form');
  }

  openCSVUploadForm(): void {
    this.modalService.open('csv-upload-form');
  }

  pagarProductosTarjetaCredito(): void {
    this.apiService
      .post<string>('compras-credito/pagar-productos', {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadProducts(),
        error: (err) => {
          void err;
        },
      });
  }

  // ───────── celdas ─────────

  responsablesDe(compra: ComprasCredito): ResponsableVista[] {
    const id = compra.id ?? -1;
    const guardado = this.cache.get(id);
    if (guardado) return guardado;
    const lista = idsResponsables(compra).map((personaId) => {
      const persona = this.sharedListasService.findPersonaFast(personaId);
      return { iniciales: persona?.inicialesNombre || '', color: persona?.colorRepresentativo || '', nombre: persona?.nombre || '' };
    });
    if (compra.id !== undefined && this.personas.length > 0) this.cache.set(id, lista);
    return lista;
  }

  clasePorcentaje(p: number | undefined): string {
    const v = p ?? 0;
    return v >= 100 ? 'completo' : v > 0 ? 'parcial' : 'vacio';
  }
}
