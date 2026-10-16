import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { iniciales } from '../../deudas/deudas.constants';
import { RecurrentePersona } from '../../modelos/aportes';
import { ItemPersona } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';
import { ModalService } from '../../services/modal.service';
import { RecurrentesPersonaService } from '../../services/recurrentes-persona.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
import { nombrePeriodo } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import {
  ETIQUETA_ESTADO_VISUAL,
  SEGMENTOS_RECURRENTES,
  conteoRecurrentes,
  estadoVisual,
  etiquetaNaturaleza,
  etiquetaNaturalezaCorta,
  filtrarRecurrentesConBarra,
  textoProgreso,
  totalMensual,
} from '../recurrentes-persona.constants';
import { AccionUI, ListaAcciones } from '../../shared/ui/acciones/acciones.component';
import { ColumnaTabla } from '../../shared/ui/apple-table/apple-table.types';
import { DefinicionFiltro, EstadoFiltros, SegmentoFiltro, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';

export const MODAL_RECURRENTE_PERSONA = 'recurrente-persona-form';

@Component({
  selector: 'app-lista-recurrentes-persona',
  templateUrl: './lista-recurrentes-persona.component.html',
  styleUrl: './lista-recurrentes-persona.component.css'
})
export class ListaRecurrentesPersonaComponent implements OnInit, OnDestroy {
  readonly secundarias: AccionUI[] = [{ id: 'liquidacion', etiqueta: 'Liquidación', icono: 'fact_check', enlace: '/liquidacion', variante: 'ghost', tooltip: 'Ver la liquidación de fin de mes' }];
  private readonly accPrincipal = new ListaAcciones();
  /** Se bloquea mientras carga o si falló la carga. */
  get principal(): AccionUI {
    return this.accPrincipal.obtener(String(this.cargando || !!this.error), () => [
      { id: 'nuevo', etiqueta: 'Nuevo recurrente', icono: 'add', tooltip: 'Crear un cargo o descuento mensual para una persona', deshabilitada: this.cargando || !!this.error },
    ])[0];
  }

  alAccionar(id: string): void {
    if (id === 'nuevo') this.abrirFormulario();
  }

  readonly modalId = MODAL_RECURRENTE_PERSONA;
  readonly etiquetaNaturaleza = etiquetaNaturaleza;
  readonly etiquetaCorta = etiquetaNaturalezaCorta;
  readonly textoProgreso = textoProgreso;
  readonly estadoVisual = estadoVisual;
  readonly etiquetaEstado = ETIQUETA_ESTADO_VISUAL;
  readonly nombrePeriodo = nombrePeriodo;
  readonly iniciales = iniciales;

  recurrentes: RecurrentePersona[] = [];
  personas: ItemPersona[] = [];
  /** Lo que queda tras la barra de filtros (alimenta la tabla). */
  visibles: RecurrentePersona[] = [];

  /** Barra de filtros: buscador, estados rápidos y chips (todo en memoria). */
  estadoFiltros: EstadoFiltros = estadoVacio('todos');
  segmentos: SegmentoFiltro[] = this.armarSegmentos({ todos: 0, activo: 0, pausado: 0, finalizado: 0 });
  definicionFiltros: DefinicionFiltro[] = [];

  readonly columnas: ColumnaTabla<RecurrentePersona>[] = [
    { id: 'persona', titulo: 'Persona', valor: (r) => r.personaNombre, prioridad: 1, anchoMin: 160 },
    { id: 'concepto', titulo: 'Concepto', valor: (r) => r.concepto, prioridad: 1, anchoMin: 220 },
    { id: 'tipo', titulo: 'Tipo', valor: (r) => etiquetaNaturalezaCorta(r.naturaleza), prioridad: 2, anchoMin: 100 },
    { id: 'valor', titulo: 'Valor mensual', valor: (r) => r.valorMensual, formato: 'moneda', prioridad: 1, anchoMin: 130 },
    { id: 'duracion', titulo: 'Duración', valor: (r) => (r.vitalicio ? 101 : (r.progreso?.porcentaje ?? 0)), prioridad: 2, anchoMin: 150 },
    { id: 'estado', titulo: 'Estado', valor: (r) => ETIQUETA_ESTADO_VISUAL[estadoVisual(r)], prioridad: 1, anchoMin: 110 },
  ];

  cargando = true;
  error: string | null = null;

  /** `null` con el formulario abierto = alta; con valor = edición. */
  formularioAbierto = false;
  enEdicion: RecurrentePersona | null = null;
  eliminando: RecurrentePersona | null = null;
  trabajando = false;

  private destroy$ = new Subject<void>();

  constructor(
    private recurrentesService: RecurrentesPersonaService,
    private catalogos: CatalogosService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) {
        this.formularioAbierto = false;
        this.enEdicion = null;
      }
    });
    // Nombres y filtro de personas: catálogo compartido (si falla, los recurrentes se ven igual).
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
    this.recurrentesService
      .getRecurrentes()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (recurrentes) => {
          this.recurrentes = recurrentes;
          this.aplicar();
        },
        error: (err) => {
          this.recurrentes = [];
          this.aplicar();
          this.error = mensajeDeError(err, 'No se pudieron cargar los recurrentes.');
        }
      });
  }

  get totales(): { cobros: number; favores: number } {
    return totalMensual(this.recurrentes);
  }

  // ── filtros en pantalla ──

  private armarSegmentos(c: Record<(typeof SEGMENTOS_RECURRENTES)[number], number>): SegmentoFiltro[] {
    const etiquetas: Record<(typeof SEGMENTOS_RECURRENTES)[number], string> = { todos: 'Todos', activo: 'Activos', pausado: 'En pausa', finalizado: 'Finalizados' };
    return SEGMENTOS_RECURRENTES.map((s) => ({ valor: s, etiqueta: etiquetas[s], cantidad: c[s] }));
  }

  private armarFiltros(): void {
    this.definicionFiltros = [
      { id: 'persona', tipo: 'seleccion', etiqueta: 'Persona', icono: 'person', buscable: true, opciones: this.personas.map((p) => ({ valor: p.id, etiqueta: p.nombre })) },
      { id: 'duracion', tipo: 'seleccion', etiqueta: 'Duración', icono: 'hourglass_empty', opciones: [{ valor: 'INDEFINIDO', etiqueta: 'De por vida' }, { valor: 'PLAZO_FIJO', etiqueta: 'Por X meses' }] },
    ];
  }

  alFiltrar(estado: EstadoFiltros): void {
    this.estadoFiltros = estado;
    this.aplicar();
  }

  private aplicar(): void {
    this.visibles = filtrarRecurrentesConBarra(this.recurrentes, this.estadoFiltros);
    this.segmentos = this.armarSegmentos(conteoRecurrentes(this.recurrentes, this.estadoFiltros));
  }

  // ── alta / edición ──

  abrirFormulario(r: RecurrentePersona | null = null): void {
    this.enEdicion = r;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onGuardado(r: RecurrentePersona): void {
    const edito = !!this.enEdicion;
    this.modalService.close();
    this.toast.exito(`${edito ? 'Recurrente actualizado' : 'Recurrente creado'}: ${r.concepto} · ${moneda(r.valorMensual)} al mes.`);
    this.cargar();
  }

  // ── pausar / activar ──

  alternarActivo(r: RecurrentePersona): void {
    this.trabajando = true;
    this.recurrentesService
      .actualizar(r.id, { activo: !r.activo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (nuevo) => {
          this.toast.exito(nuevo.activo ? `«${nuevo.concepto}» reactivado.` : `«${nuevo.concepto}» en pausa: no se cobrarán los meses futuros.`);
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo cambiar el estado.'))
      });
  }

  // ── eliminar ──

  pedirEliminar(r: RecurrentePersona): void {
    this.eliminando = r;
  }

  cancelarEliminar(): void {
    this.eliminando = null;
  }

  confirmarEliminar(): void {
    const r = this.eliminando;
    if (!r) return;
    this.trabajando = true;
    this.recurrentesService
      .eliminar(r.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (res) => {
          this.eliminando = null;
          this.toast.exito(`«${r.concepto}» eliminado${res.movimientosAnulados ? ` · ${res.movimientosAnulados} cargo(s) anulado(s) del estado de cuenta` : ''}.`);
          this.cargar();
        },
        error: (err) => {
          this.eliminando = null;
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar.'));
        }
      });
  }
}
