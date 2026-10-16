import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { iniciales } from '../deudas/deudas.constants';
import { LiquidacionMensual, LiquidacionPersona, PeriodoCarro, ResultadoAplicarExcedente } from '../modelos/aportes';
import { EnlaceCobro } from '../modelos/cobros-personas';
import { EstadoCuentaPersona, ResultadoAbonoPersona } from '../modelos/erp';
import { ItemPersona } from '../modelos/catalogos';
import { AportesCarroService } from '../services/aportes-carro.service';
import { CobrosPersonasService } from '../services/cobros-personas.service';
import { lineaDetalle } from '../cobros/cobros.constants';
import { LiquidacionMensualService } from '../services/liquidacion-mensual.service';
import { ModalService } from '../services/modal.service';
import { CatalogosService } from '../services/catalogos.service';
import { mensajeDeError } from '../shared/http-error.helper';
import { moneda } from '../shared/moneda.util';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../shared/periodo.helper';
import { ToastService } from '../shared/toast/toast.service';
import { etiquetaEstadoPeriodo, claseEstadoPeriodo } from '../aportes-carro/aportes-carro.constants';
import {
  BLOQUES,
  adaptarParaAbono,
  bloquesConItems,
  claseEstadoLiquidacion,
  clasePorSigno,
  etiquetaEstadoLiquidacion,
  etiquetaOrigen,
  mensajeLiquidacion,
} from './liquidacion.constants';
import { ACCION_MES_ACTUAL, AccionUI, ListaAcciones } from '../shared/ui/acciones/acciones.component';

export const MODAL_ABONO_LIQUIDACION = 'liquidacion-abono';
export const MODAL_CRUCE_LIQUIDACION = 'liquidacion-cruce';
export const MODAL_EXCEDENTE_LIQUIDACION = 'liquidacion-excedente';
export const MODAL_COMPARTIR_LIQUIDACION = 'liquidacion-compartir';

@Component({
  selector: 'app-liquidacion-mensual',
  templateUrl: './liquidacion-mensual.component.html',
  styleUrl: './liquidacion-mensual.component.css'
})
export class LiquidacionMensualComponent implements OnInit, OnDestroy {
  private readonly accSecundarias = new ListaAcciones();
  get secundarias(): AccionUI[] {
    return this.accSecundarias.obtener(String(this.esMesActual()), () => [
      { id: 'aportes', etiqueta: 'Aportes del carro', icono: 'directions_car', enlace: '/aportes-carro', variante: 'ghost', tooltip: 'Ver los aportes diarios a la cuota del carro' },
      { id: 'recurrentes', etiqueta: 'Recurrentes por persona', icono: 'autorenew', enlace: '/recurrentes-persona', tooltip: 'Cargos o descuentos que se repiten cada mes' },
      ...(this.esMesActual() ? [] : [ACCION_MES_ACTUAL]),
    ]);
  }

  alAccionar(id: string): void {
    if (id === 'mes-actual') this.irAlMesActual();
  }

  readonly modalAbono = MODAL_ABONO_LIQUIDACION;
  readonly modalCruce = MODAL_CRUCE_LIQUIDACION;
  readonly modalExcedente = MODAL_EXCEDENTE_LIQUIDACION;
  readonly modalCompartir = MODAL_COMPARTIR_LIQUIDACION;
  readonly detalle = lineaDetalle;

  readonly bloques = BLOQUES;
  readonly bloquesConItems = bloquesConItems;
  readonly mensaje = mensajeLiquidacion;
  readonly claseEstado = claseEstadoLiquidacion;
  readonly etiquetaEstado = etiquetaEstadoLiquidacion;
  readonly etiquetaOrigen = etiquetaOrigen;
  readonly clasePorSigno = clasePorSigno;
  readonly etiquetaEstadoPeriodo = etiquetaEstadoPeriodo;
  readonly claseEstadoPeriodo = claseEstadoPeriodo;
  readonly iniciales = iniciales;
  readonly nombrePeriodo = nombrePeriodo;

  periodo = periodoActual();
  personaFiltro: number | null = null;
  todas = false;
  liquidacion: LiquidacionMensual | null = null;
  personas: ItemPersona[] = [];
  cargando = true;
  error: string | null = null;

  /** Personas con el desglose abierto. */
  abiertas = new Set<number>();

  abonando: LiquidacionPersona | null = null;
  cruzando: LiquidacionPersona | null = null;
  excedentePeriodos: PeriodoCarro[] = [];
  excedenteResponsable = 'el responsable';
  excedenteAbierto = false;

  /** Enlaces ya compartidos del periodo (para mostrar su estado en cada persona). */
  enlaces: EnlaceCobro[] = [];
  compartiendo: LiquidacionPersona | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private liquidacionService: LiquidacionMensualService,
    private catalogos: CatalogosService,
    private aportesService: AportesCarroService,
    private cobrosService: CobrosPersonasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalAbono) this.abonando = null;
      if (id !== this.modalCruce) this.cruzando = null;
      if (id !== this.modalExcedente) this.excedenteAbierto = false;
      if (id !== this.modalCompartir) this.compartiendo = null;
    });
    // Filtro de personas y celulares para «Compartir cobro»: catálogo compartido (si falla, la liquidación se ve igual).
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
    this.liquidacionService
      .getLiquidacion(this.periodo, { personaId: this.personaFiltro, todas: this.todas })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (l) => {
          this.liquidacion = l;
          this.cargarEnlaces();
          // con una sola persona o pocas, se muestra el desglose abierto
          if (this.abiertas.size === 0 && l.personas.length === 1) this.abiertas.add(l.personas[0].persona.id);
        },
        error: (err) => {
          this.liquidacion = null;
          this.error = mensajeDeError(err, 'No se pudo cargar la liquidación del mes.');
        }
      });
  }

  /** Los enlaces compartidos del periodo; si falla, la liquidación se ve igual (solo sin ese estado). */
  private cargarEnlaces(): void {
    this.cobrosService
      .getEnlaces(this.periodo)
      .pipe(takeUntil(this.destroy$), catchError(() => of([] as EnlaceCobro[])))
      .subscribe((e) => (this.enlaces = e));
  }

  enlaceDe(l: LiquidacionPersona): EnlaceCobro | null {
    return this.enlaces.find((e) => e.personaId === l.persona.id) ?? null;
  }

  celularDe(l: LiquidacionPersona): string | null {
    return this.personas.find((p) => p.id === l.persona.id)?.celular ?? null;
  }

  abrirCompartir(l: LiquidacionPersona): void {
    this.compartiendo = l;
    this.modalService.open(this.modalCompartir);
  }

  onEnlaceCambiado(): void {
    this.cargarEnlaces();
  }

  // ── periodo y filtros ──

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

  esMesActual(): boolean {
    return this.periodo === periodoActual();
  }

  onPersonaChange(id: number | string | null): void {
    this.personaFiltro = id === null || id === '' ? null : Number(id);
    this.cargar();
  }

  onTodasChange(valor: boolean): void {
    this.todas = valor;
    this.cargar();
  }

  // ── desglose ──

  estaAbierta(l: LiquidacionPersona): boolean {
    return this.abiertas.has(l.persona.id);
  }

  alternar(l: LiquidacionPersona): void {
    if (this.abiertas.has(l.persona.id)) this.abiertas.delete(l.persona.id);
    else this.abiertas.add(l.persona.id);
  }

  get personasLiquidacion(): LiquidacionPersona[] {
    return this.liquidacion?.personas ?? [];
  }

  cerrarModal(): void {
    this.modalService.close();
  }

  // ── acciones por persona ──

  abrirAbono(l: LiquidacionPersona): void {
    this.abonando = l;
    this.modalService.open(this.modalAbono);
  }

  get personaParaAbono(): EstadoCuentaPersona | null {
    return this.abonando ? adaptarParaAbono(this.abonando) : null;
  }

  onAbonado(r: ResultadoAbonoPersona): void {
    this.modalService.close();
    this.toast.exito(`Pago registrado: ${moneda(r.monto)} (movimiento #${r.movimientoId}).`);
    this.cargar();
  }

  abrirCruce(l: LiquidacionPersona): void {
    this.cruzando = l;
    this.modalService.open(this.modalCruce);
  }

  onCruceCreado(): void {
    this.modalService.close();
    this.toast.exito('Cruce de cuentas registrado: abonó a una persona y cargó a la otra.');
    this.cargar();
  }

  /** Aplicar el saldo a favor de la cuota: se cargan los periodos del carro con excedente y se abre el formulario. */
  abrirExcedente(l: LiquidacionPersona): void {
    this.excedenteResponsable = l.persona.nombre ?? 'el responsable';
    this.aportesService
      .getResumen()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resumen) => {
          this.excedentePeriodos = resumen.periodos.filter((p) => p.saldoAFavorDisponible > 0 && p.responsable.id === l.persona.id);
          if (this.excedentePeriodos.length === 0) {
            this.toast.info(`${this.excedenteResponsable} no tiene saldo a favor disponible.`);
            return;
          }
          this.excedenteAbierto = true;
          this.modalService.open(this.modalExcedente);
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo consultar el saldo a favor.'))
      });
  }

  onExcedenteAplicado(r: ResultadoAplicarExcedente): void {
    this.modalService.close();
    this.toast.exito(`Saldo a favor aplicado: ${moneda(r.valorAplicado)}.`);
    this.cargar();
  }

  tieneSaldoAFavor(l: LiquidacionPersona): boolean {
    return (l.estadoAporteCarro?.saldoAFavorDisponible ?? 0) > 0 || l.obligaciones.some((o) => o.saldoAFavorDisponible > 0);
  }

  trackPersona(_: number, l: LiquidacionPersona): number {
    return l.persona.id;
  }

  trackItem(_: number, i: { id: number }): number {
    return i.id;
  }
}
