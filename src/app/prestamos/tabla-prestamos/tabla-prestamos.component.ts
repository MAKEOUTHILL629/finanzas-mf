import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro, PrestamoDetalle } from '../../modelos/cobros';
import { ItemPersona } from '../../modelos/catalogos';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { ModalService } from '../../services/modal.service';
import { CatalogosService } from '../../services/catalogos.service';
import { PrestamosService } from '../../services/prestamos.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { claseEstadoPrestamo, estaPendiente, resumirAprobaciones, saldoDe } from '../prestamos.constants';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';
import { ColumnaTabla } from '../../shared/ui/apple-table/apple-table.types';
import { DefinicionFiltro, EstadoFiltros, RangoFechas, SegmentoFiltro, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';

export const MODAL_PRESTAMO = 'prestamo-form';

export interface FiltrosPrestamos {
  texto: string;
  estado: string;
  responsable: string;
  corte: string;
  /** `yyyy-MM-dd` */
  desde: string;
  hasta: string;
}

export const FILTROS_VACIOS: FiltrosPrestamos = { texto: '', estado: '', responsable: '', corte: '', desde: '', hasta: '' };

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra en memoria (son decenas de filas). `corte = 'sin'` selecciona los préstamos sin corte. */
export function filtrarPrestamos(prestamos: PrestamoDetalle[], f: FiltrosPrestamos): PrestamoDetalle[] {
  const texto = sinTildes(f.texto.trim());
  // fechaCobro viaja como epoch-ms a las 00:00 UTC, igual que `Date.parse('yyyy-MM-dd')`
  const desde = f.desde ? Date.parse(f.desde) : null;
  const hasta = f.hasta ? Date.parse(f.hasta) : null;
  return prestamos.filter((p) => {
    if (f.estado && (p.estado ?? '').toLowerCase() !== f.estado.toLowerCase()) return false;
    if (f.responsable && p.responsable !== Number(f.responsable)) return false;
    if (f.corte === 'sin' ? p.corteId !== null : f.corte && p.corteId !== Number(f.corte)) return false;
    if (desde !== null && (p.fechaCobro === null || p.fechaCobro < desde)) return false;
    if (hasta !== null && (p.fechaCobro === null || p.fechaCobro > hasta)) return false;
    if (texto && !sinTildes(`${p.concepto ?? ''} ${p.comentarios ?? ''}`).includes(texto)) return false;
    return true;
  });
}

/** Pendientes primero; luego los más recientes por fecha de cobro. */
export function ordenarPrestamos(prestamos: PrestamoDetalle[]): PrestamoDetalle[] {
  return [...prestamos].sort(
    (a, b) =>
      Number(!estaPendiente(a)) - Number(!estaPendiente(b)) ||
      (b.fechaCobro ?? 0) - (a.fechaCobro ?? 0) ||
      b.id - a.id
  );
}

/** Estados rápidos de la barra de filtros: `valor` es el estado tal como lo guarda la base («todos» = sin filtro). */
export const SEGMENTOS_PRESTAMOS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'Pendiente', etiqueta: 'Pendientes' },
  { valor: 'Pagado', etiqueta: 'Pagados' },
  { valor: 'Anulado', etiqueta: 'Anulados' },
] as const;

/** Traduce lo que eligió la barra de filtros a los filtros de `filtrarPrestamos`. */
export function filtrosDeBarra(e: EstadoFiltros): FiltrosPrestamos {
  const rango = e.valores['cobro'] as RangoFechas | null | undefined;
  const escalar = (v: unknown) => (v === undefined || v === null || Array.isArray(v) ? '' : String(v));
  return {
    texto: e.busqueda ?? '',
    estado: !e.segmento || e.segmento === 'todos' ? '' : e.segmento,
    responsable: escalar(e.valores['responsable']),
    corte: escalar(e.valores['corte']),
    desde: rango?.desde ?? '',
    hasta: rango?.hasta ?? '',
  };
}

@Component({
  selector: 'app-tabla-prestamos',
  templateUrl: './tabla-prestamos.component.html',
  styleUrl: './tabla-prestamos.component.css'
})
export class TablaPrestamosComponent implements OnInit, OnDestroy {
  readonly principal: AccionUI = { id: 'nuevo', etiqueta: 'Nuevo préstamo', icono: 'add', tooltip: 'Registrar un préstamo a una persona' };
  readonly secundarias: AccionUI[] = [{ id: 'cortes', etiqueta: 'Cortes de cobro', icono: 'event_repeat', enlace: '/cortes-cobro', tooltip: 'Ver los cortes en los que se cobran las cuotas' }];

  alAccionar(id: string): void {
    if (id === 'nuevo') this.abrirFormulario();
  }

  readonly modalId = MODAL_PRESTAMO;
  readonly claseEstado = claseEstadoPrestamo;
  readonly resumirAprobaciones = resumirAprobaciones;

  prestamos: PrestamoDetalle[] = [];
  visibles: PrestamoDetalle[] = [];
  personas: ItemPersona[] = [];
  cortes: CorteCobro[] = [];

  /** Barra de filtros: buscador, estados rápidos y chips (todo en memoria: son decenas de filas). */
  estadoFiltros: EstadoFiltros = estadoVacio('todos');
  segmentos: SegmentoFiltro[] = SEGMENTOS_PRESTAMOS.map((s) => ({ valor: s.valor, etiqueta: s.etiqueta, cantidad: 0 }));
  definicionFiltros: DefinicionFiltro[] = [];

  readonly columnas: ColumnaTabla<PrestamoDetalle>[] = [
    { id: 'concepto', titulo: 'Concepto', valor: (p) => p.concepto, prioridad: 1, anchoMin: 190 },
    { id: 'responsable', titulo: 'Responsable', valor: (p) => this.nombrePersona(p.responsable), prioridad: 2, anchoMin: 120 },
    { id: 'valor', titulo: 'Valor', valor: (p) => p.valorPrestado, formato: 'moneda', prioridad: 2, anchoMin: 110 },
    { id: 'saldo', titulo: 'Saldo', valor: (p) => saldoDe(p), formato: 'moneda', prioridad: 1, anchoMin: 110 },
    { id: 'cobro', titulo: 'Cobro', valor: (p) => (p.fechaCobro === null ? null : new Date(p.fechaCobro)), formato: 'fechaCorta', prioridad: 2, anchoMin: 100 },
    { id: 'corte', titulo: 'Corte', valor: (p) => this.nombreCorte(p.corteId), prioridad: 3, truncar: true, anchoMin: 140 },
    { id: 'estado', titulo: 'Estado', valor: (p) => p.estado, prioridad: 1, anchoMin: 100 },
    { id: 'aprobaciones', titulo: 'Aprobaciones', valor: (p) => resumirAprobaciones(p).pendientes, prioridad: 2, anchoMin: 130 },
  ];

  totales = { saldoPorCobrar: 0, pendientes: 0, aprobacionesPendientes: 0, pagados: 0 };

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private prestamosService: PrestamosService,
    private catalogos: CatalogosService,
    private cortesService: CortesCobroService,
    private modalService: ModalService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Nombres y filtro de personas: catálogo compartido (un fallo ahí no impide ver los préstamos).
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.personas = e.datos;
      this.armarFiltros();
    });
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
    forkJoin({
      prestamos: this.prestamosService.getPrestamos(),
      // los nombres de corte son un adorno: si fallan, la tabla sigue funcionando
      cortes: this.cortesService.getCortes().pipe(catchError(() => of([] as CorteCobro[]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ prestamos, cortes }) => {
          this.prestamos = ordenarPrestamos(prestamos ?? []);
          this.cortes = cortes;
          this.armarFiltros();
          this.calcularTotales();
          this.aplicarFiltros();
        },
        error: (err) => {
          this.prestamos = [];
          this.visibles = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar los préstamos.');
        }
      });
  }

  private armarFiltros(): void {
    this.definicionFiltros = [
      { id: 'responsable', tipo: 'seleccion', etiqueta: 'Responsable', icono: 'person', buscable: true, opciones: this.personas.map((p) => ({ valor: p.id, etiqueta: p.nombre })) },
      { id: 'corte', tipo: 'seleccion', etiqueta: 'Corte', icono: 'event_repeat', opciones: [{ valor: 'sin', etiqueta: 'Sin corte' }, ...this.cortes.map((c) => ({ valor: c.id, etiqueta: c.concepto }))] },
      { id: 'cobro', tipo: 'fechas', etiqueta: 'Fecha de cobro', icono: 'event' },
    ];
  }

  alFiltrar(estado: EstadoFiltros): void {
    this.estadoFiltros = estado;
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    const f = filtrosDeBarra(this.estadoFiltros);
    this.visibles = filtrarPrestamos(this.prestamos, f);
    // cada contador respeta el resto de filtros, no el estado que se está viendo
    this.segmentos = SEGMENTOS_PRESTAMOS.map((s) => ({
      valor: s.valor,
      etiqueta: s.etiqueta,
      cantidad: filtrarPrestamos(this.prestamos, { ...f, estado: s.valor === 'todos' ? '' : s.valor }).length,
    }));
  }

  private calcularTotales(): void {
    const pendientes = this.prestamos.filter((p) => estaPendiente(p) && p.direccionPrestamo !== 'POR_PAGAR');
    this.totales = {
      saldoPorCobrar: sumarMonedas(pendientes.map((p) => saldoDe(p))),
      pendientes: pendientes.length,
      aprobacionesPendientes: this.prestamos.reduce((n, p) => n + resumirAprobaciones(p).pendientes, 0),
      pagados: this.prestamos.filter((p) => (p.estado ?? '').toLowerCase() === 'pagado').length,
    };
  }

  abrirFormulario(): void {
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onCreado(): void {
    this.modalService.close();
    this.toast.exito('Préstamo registrado.');
    this.cargar();
  }

  abrirDetalle(p: PrestamoDetalle): void {
    void this.router.navigate(['/prestamos', p.id]);
  }

  nombrePersona(id: number | null | undefined): string {
    return this.personas.find((p) => p.id === id)?.nombre ?? '—';
  }

  nombreCorte(id: number | null | undefined): string {
    return id === null || id === undefined ? '—' : (this.cortes.find((c) => c.id === id)?.concepto ?? `Corte #${id}`);
  }

  saldo(p: PrestamoDetalle): number {
    return saldoDe(p);
  }
}
