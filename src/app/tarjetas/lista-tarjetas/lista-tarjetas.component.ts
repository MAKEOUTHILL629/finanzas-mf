import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ItemCuenta } from '../../modelos/catalogos';
import { PlasticoTarjeta, ResultadoReemplazo, Tarjeta, TipoTarjeta } from '../../modelos/tarjeta';
import { CatalogosService } from '../../services/catalogos.service';
import { ModalService } from '../../services/modal.service';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';
import { DefinicionFiltro, EstadoFiltros, SegmentoFiltro, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';
import { SEGMENTOS_TARJETAS, SegmentoTarjetas, conteoTarjetas, estaActiva, filtrarTarjetas } from '../tarjetas-filtros';
import { ETIQUETA_TIPO_TARJETA, esDebito, etiquetaEstadoPlastico, etiquetaMotivo, nombreTarjeta, terminacion, tipoDe, tonoEstadoPlastico, vigenciaLegible } from '../tarjetas.constants';

export const MODAL_TARJETA = 'tarjeta-form';
export const MODAL_PLASTICO = 'tarjeta-plastico';
export const MODAL_NUEVA_TARJETA = 'tarjeta-nueva';

const ETIQUETA_SEGMENTO: Record<SegmentoTarjetas, string> = { todas: 'Todas', credito: 'Crédito', debito: 'Débito' };

/** Qué le falta configurar a una tarjeta para que los extractos y los correos funcionen bien (una de débito no tiene corte ni cupo). */
export function pendientesDeConfigurar(t: Tarjeta): string[] {
  if (esDebito(t)) return [];
  const faltan: string[] = [];
  if (t.esGenerica) return faltan;
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
  readonly principal: AccionUI = { id: 'nueva', etiqueta: 'Nueva tarjeta', icono: 'add', tooltip: 'Registrar una tarjeta de crédito o de débito, o la renovación de un plástico' };
  readonly secundarias: AccionUI[] = [
    { id: 'linea-tiempo', etiqueta: 'Línea de tiempo', icono: 'timeline', enlace: '/linea-tiempo', variante: 'ghost', tooltip: 'Ver cuándo usaste cada tarjeta y cuenta' },
    { id: 'extractos', etiqueta: 'Ver extractos', icono: 'receipt_long', enlace: '/extractos', tooltip: 'Ver lo que cobra el banco en cada periodo' },
  ];

  readonly modalId = MODAL_TARJETA;
  readonly modalPlastico = MODAL_PLASTICO;
  readonly modalNueva = MODAL_NUEVA_TARJETA;
  readonly pendientes = pendientesDeConfigurar;
  readonly terminacion = terminacion;
  readonly vigencia = vigenciaLegible;
  readonly motivo = etiquetaMotivo;
  readonly etiquetaEstado = etiquetaEstadoPlastico;
  readonly tonoEstado = tonoEstadoPlastico;
  readonly etiquetaTipo = ETIQUETA_TIPO_TARJETA;
  readonly tipoDe = tipoDe;
  readonly esDebito = esDebito;
  readonly estaActiva = estaActiva;

  tarjetas: Tarjeta[] = [];
  /** Lo que queda tras la barra de filtros. */
  visibles: Tarjeta[] = [];
  cuentas: ItemCuenta[] = [];
  /** Tarjeta que se edita; el formulario existe solo mientras el modal está abierto. */
  editando: Tarjeta | null = null;
  /** Tarjeta a la que se le registra un reemplazo de plástico. */
  reemplazando: Tarjeta | null = null;
  /** El formulario de tarjeta nueva existe solo mientras el modal está abierto. */
  creando = false;
  tipoNueva: TipoTarjeta = 'CREDITO';

  estadoFiltros: EstadoFiltros = estadoVacio('todas');
  segmentos: SegmentoFiltro[] = SEGMENTOS_TARJETAS.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: 0 }));
  definicionFiltros: DefinicionFiltro[] = [];

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();
  private readonly contexto = { nombreCuenta: (id: number | null | undefined) => this.nombreCuenta(id) };

  constructor(
    private tarjetasService: TarjetasService,
    private catalogos: CatalogosService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.editando = null;
      if (id !== this.modalPlastico) this.reemplazando = null;
      if (id !== this.modalNueva) this.creando = false;
    });
    // Nombres de las cuentas (para mostrar a cuál pertenece cada tarjeta): catálogo compartido; si falla, las tarjetas se ven igual.
    this.catalogos.estado$('cuentas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.cuentas = e.datos;
      this.armarFiltros();
      this.aplicar();
    });
    this.catalogos.asegurar(['cuentas']);
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
        next: (t) => {
          this.tarjetas = t;
          this.aplicar();
        },
        error: (err) => {
          this.tarjetas = [];
          this.aplicar();
          this.error = mensajeDeError(err, 'No se pudieron cargar las tarjetas.');
        }
      });
  }

  // ── filtros ──

  private armarFiltros(): void {
    const usadas = new Set(this.tarjetas.map((t) => t.cuentaId).filter((id): id is number => id !== null && id !== undefined));
    this.definicionFiltros = [
      { id: 'estado', tipo: 'seleccion', etiqueta: 'Estado', icono: 'toggle_on', opciones: [{ valor: 'ACTIVA', etiqueta: 'Activas' }, { valor: 'HISTORICA', etiqueta: 'Históricas' }] },
      {
        id: 'cuentas',
        tipo: 'seleccion',
        etiqueta: 'Cuenta',
        icono: 'account_balance',
        multiple: true,
        opciones: this.cuentas.filter((c) => usadas.has(c.id)).map((c) => ({ valor: c.id, etiqueta: c.nombre, grupo: c.activa ? undefined : 'Históricas' })),
      },
    ];
  }

  alFiltrar(estado: EstadoFiltros): void {
    this.estadoFiltros = estado;
    this.aplicar();
  }

  private aplicar(): void {
    this.visibles = filtrarTarjetas(this.tarjetas, this.estadoFiltros, this.contexto);
    const c = conteoTarjetas(this.tarjetas, this.estadoFiltros, this.contexto);
    this.segmentos = SEGMENTOS_TARJETAS.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: c[s] }));
    this.armarFiltros();
  }

  // ── acciones ──

  alAccionar(id: string): void {
    if (id === 'nueva') this.nueva();
  }

  nueva(): void {
    this.tipoNueva = (this.estadoFiltros.segmento === 'debito' ? 'DEBITO' : 'CREDITO') as TipoTarjeta;
    this.creando = true;
    this.modalService.open(this.modalNueva);
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

  /** La tarjeta nueva (o la línea con el plástico renovado) viene completa del servidor: se agrega o reemplaza en la lista. */
  onCreada(t: Tarjeta): void {
    const existia = this.tarjetas.some((x) => x.id === t.id);
    this.tarjetas = existia ? this.tarjetas.map((x) => (x.id === t.id ? t : x)) : [...this.tarjetas, t];
    this.aplicar();
    this.modalService.close();
    this.toast.exito(existia ? 'Plástico renovado: el anterior quedó en el historial.' : `${etiquetaCreada(t)} creada.`);
  }

  onGuardada(t: Tarjeta): void {
    this.tarjetas = this.tarjetas.map((x) => (x.id === t.id ? t : x));
    this.aplicar();
    this.modalService.close();
    this.toast.exito('Tarjeta actualizada.');
  }

  /** El resultado trae la lista de plásticos ya actualizada: se refleja en la tarjeta sin recargar todo. */
  onPlasticoGuardado(r: ResultadoReemplazo): void {
    const id = this.reemplazando?.id;
    this.tarjetas = this.tarjetas.map((t) =>
      t.id === id
        ? { ...t, plasticos: r.plasticos, plasticoActivo: r.plasticoActivo, ultimos4Activo: r.plasticoActivo?.ultimos4 ?? t.ultimos4Activo, ultimos4Digitos: r.plasticos.map((p) => p.ultimos4).join(',') }
        : t
    );
    this.aplicar();
    this.modalService.close();
    this.toast.exito(
      r.historico
        ? 'Plástico anterior agregado al historial de la tarjeta.'
        : `Plástico ${terminacion(r.plasticoActivo.ultimos4)} registrado. Tu historial de compras no cambió.`
    );
  }

  // ── presentación ──

  nombre(t: Tarjeta): string {
    return nombreTarjeta(t);
  }

  nombreCuenta(id: number | null | undefined): string {
    return id === null || id === undefined ? '' : (this.cuentas.find((c) => c.id === id)?.nombre ?? `Cuenta #${id}`);
  }

  /** Plásticos de una tarjeta: el vigente primero y luego los demás del más reciente al más antiguo. */
  plasticosDe(t: Tarjeta): PlasticoTarjeta[] {
    return t.plasticos ?? [];
  }

  trackById(_: number, t: Tarjeta): number | undefined {
    return t.id;
  }
}

function etiquetaCreada(t: Tarjeta): string {
  return tipoDe(t) === 'DEBITO' ? 'Tarjeta de débito' : 'Tarjeta de crédito';
}
