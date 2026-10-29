import { token } from '../shared/design-tokens';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AnaliticaAvanzadaDashboard, CategoriaDistribuida, FiltroAnaliticaAvanzada } from '../modelos/dashboard';
import { FlujoCaja, Periodo } from '../modelos/erp';
import { AnalyticsFlujoCajaService } from '../services/analytics-flujo-caja.service';
import { DashboardService } from '../services/dashboard.service';
import { ThemeService } from '../services/theme.service';
import {
  construirCascadaDistribucionMensual,
  construirCurvaFlujoYPatrimonio,
  construirDonutMultiAnilloCategorias,
  construirHorizonteDesendeudamientoTarjetas,
} from '../shared/charts';
import { aCentavos } from '../shared/dinero.helper';
import { mensajeDeError } from '../shared/http-error.helper';
import { moneda } from '../shared/moneda.util';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../shared/periodo.helper';
import { ACCION_MES_ACTUAL, AccionUI, ListaAcciones } from '../shared/ui/acciones/acciones.component';
import { PresetRangoFechas, calcularRangoPreset } from '../shared/ui/filter-bar/filter-bar.types';

export interface PiezaDesembolso {
  clave: 'egresos' | 'tarjetas' | 'recurrentes';
  etiqueta: string;
  valor: number;
  color: string;
}

/** Colores de datos del sistema de diseño (`--chart-*`): se leen del tema vigente, no se escriben a mano. */
const colores = () => ({
  egresos: token('--chart-4', '#FF3B30'),
  tarjetas: token('--chart-1', '#007AFF'),
  recurrentes: token('--chart-3', '#5856D6'),
  ingresos: token('--chart-6', '#34C759'),
  terceros: token('--chart-2', '#32ADE6'),
  neto: token('--chart-5', '#FF9500'),
});

/** Las tres partes del desembolso bruto, solo las que tienen valor. */
export function piezasDeDesembolso(f: FlujoCaja): PiezaDesembolso[] {
  return (
    [
      { clave: 'egresos', etiqueta: 'Egresos directos', valor: Number(f.total_egresos_directos), color: colores().egresos },
      { clave: 'tarjetas', etiqueta: 'Cuotas de tarjetas', valor: Number(f.total_tarjetas), color: colores().tarjetas },
      { clave: 'recurrentes', etiqueta: 'Gastos recurrentes', valor: Number(f.total_esperado_recurrentes), color: colores().recurrentes },
    ] as PiezaDesembolso[]
  ).filter((p) => p.valor > 0);
}

/** ¿No hay nada que mostrar en el periodo? */
export function estaVacio(f: FlujoCaja): boolean {
  return [f.total_ingresos, f.total_egresos_directos, f.total_tarjetas, f.total_esperado_recurrentes, f.total_por_cobrar_terceros].every((v) => aCentavos(v) === 0);
}

@Component({
  selector: 'app-flujo-caja',
  templateUrl: './flujo-caja.component.html',
  styleUrl: './flujo-caja.component.css'
})
export class FlujoCajaComponent implements OnInit, OnDestroy {
  private readonly accSecundarias = new ListaAcciones();
  get secundarias(): AccionUI[] {
    return this.accSecundarias.obtener(String(this.esMesActual()), () => [
      ...(this.esMesActual() ? [] : [ACCION_MES_ACTUAL]),
    ]);
  }

  alAccionar(id: string): void {
    if (id === 'mes-actual') this.irAlMesActual();
  }

  periodo: Periodo = periodoActual();
  flujo: FlujoCaja | null = null;
  piezas: PiezaDesembolso[] = [];
  vacio = false;

  cargando = true;
  error: string | null = null;

  donaData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [{ data: [] }] };
  donaOpciones: ChartConfiguration<'doughnut'>['options'] = {};
  barrasData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [{ data: [] }] };
  barrasOpciones: ChartConfiguration<'bar'>['options'] = {};
  cascadaData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [{ data: [] }] };
  cascadaOpciones: ChartConfiguration<'bar'>['options'] = {};

  // ── Iteración 2 — Fase 6: Analítica Avanzada Multi-Filtro ──
  analiticaAvanzada: AnaliticaAvanzadaDashboard | null = null;
  cargandoAnalitica = false;
  presetActivo: PresetRangoFechas = '6M';
  soloGastoPropio = false;
  incluirTransferenciasInternas = false;
  categoriaActiva: CategoriaDistribuida | null = null;

  curvaData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  curvaOpciones: ChartConfiguration<'line'>['options'] = {};
  donutMultiData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  donutMultiOpciones: ChartConfiguration<'doughnut'>['options'] = {};
  horizonteTarjetasData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  horizonteTarjetasOpciones: ChartConfiguration<'bar'>['options'] = {};

  private modoOscuro = false;
  private colorTexto = token('--text-secondary', '#6E6E73');
  private colorRejilla = token('--divider', 'rgba(0,0,0,0.08)');
  private destroy$ = new Subject<void>();
  private dashboardService = inject(DashboardService, { optional: true });

  constructor(
    private flujoService: AnalyticsFlujoCajaService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.pipe(takeUntil(this.destroy$)).subscribe((oscuro) => {
      this.modoOscuro = oscuro;
      this.colorTexto = token('--text-secondary', oscuro ? '#A1A1A6' : '#6E6E73');
      this.colorRejilla = token('--divider', oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)');
      if (this.flujo) this.construirGraficos(this.flujo);
      if (this.analiticaAvanzada) this.construirGraficosAvanzados(this.analiticaAvanzada);
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
    this.flujoService
      .getFlujoCaja(this.periodo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (f) => {
          this.flujo = f;
          this.piezas = piezasDeDesembolso(f);
          this.vacio = estaVacio(f);
          this.construirGraficos(f);
        },
        error: (err) => {
          this.flujo = null;
          this.error = mensajeDeError(err, 'No se pudo calcular el flujo de caja.');
        }
      });
  }

  cargarAnaliticaAvanzada(preset: PresetRangoFechas = this.presetActivo): void {
    if (!this.dashboardService) return;
    this.presetActivo = preset;
    const rango = calcularRangoPreset(preset);
    const filtros: FiltroAnaliticaAvanzada = {
      fechaInicio: rango.desde ?? undefined,
      fechaFin: rango.hasta ?? undefined,
      granularidad: preset === '7D' || preset === 'ESTE_MES' ? 'DIA' : 'MES',
      soloGastoPropio: this.soloGastoPropio,
      incluirTransferenciasInternas: this.incluirTransferenciasInternas,
    };
    this.cargandoAnalitica = true;
    this.dashboardService
      .getAnaliticaAvanzada(filtros)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargandoAnalitica = false))
      )
      .subscribe({
        next: (datos) => {
          this.analiticaAvanzada = datos;
          this.categoriaActiva = datos.distribucionCategorias[0] ?? null;
          this.construirGraficosAvanzados(datos);
        },
      });
  }

  alternarSoloGastoPropio(): void {
    this.soloGastoPropio = !this.soloGastoPropio;
    this.cargarAnaliticaAvanzada(this.presetActivo);
  }

  alternarTransferenciasInternas(): void {
    this.incluirTransferenciasInternas = !this.incluirTransferenciasInternas;
    this.cargarAnaliticaAvanzada(this.presetActivo);
  }

  seleccionarCategoriaDrilldown(cat: CategoriaDistribuida): void {
    this.categoriaActiva = this.categoriaActiva?.categoria === cat.categoria ? null : cat;
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

  esMesActual(): boolean {
    return this.periodo === periodoActual();
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  private construirGraficos(f: FlujoCaja): void {
    const etiquetaTooltip = (ctx: { parsed: unknown; label?: string }) => {
      const v = typeof ctx.parsed === 'number' ? ctx.parsed : Number((ctx.parsed as { y?: number })?.y ?? 0);
      return ` ${moneda(v)}`;
    };

    this.donaData = {
      labels: this.piezas.map((p) => p.etiqueta),
      datasets: [{ data: this.piezas.map((p) => p.valor), backgroundColor: this.piezas.map((p) => p.color), borderWidth: 0, hoverOffset: 6 }],
    };
    this.donaOpciones = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: this.colorTexto, usePointStyle: true, padding: 16 } },
        tooltip: { callbacks: { label: etiquetaTooltip } },
      },
    };

    this.barrasData = {
      labels: ['Ingresos', 'Desembolso bruto', 'Te devuelven', 'Gasto neto tuyo'],
      datasets: [
        {
          data: [Number(f.total_ingresos), Number(f.desembolso_bruto_mes), Number(f.total_por_cobrar_terceros), Number(f.gasto_neto_real_tuyo)],
          backgroundColor: [colores().ingresos, colores().egresos, colores().terceros, colores().neto],
          borderRadius: 8,
          maxBarThickness: 56,
        },
      ],
    };
    this.barrasOpciones = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: etiquetaTooltip } } },
      scales: {
        x: { ticks: { color: this.colorTexto }, grid: { display: false } },
        y: { ticks: { color: this.colorTexto, callback: (v) => moneda(Number(v), 'compacto') }, grid: { color: this.colorRejilla } },
      },
    };

    const wf = construirCascadaDistribucionMensual(
      {
        ingresos: Number(f.total_ingresos),
        gastosFijosRecurrentes: Number(f.total_esperado_recurrentes),
        cuotasTarjetasPropias: Math.max(0, Number(f.total_tarjetas) - Number(f.total_por_cobrar_terceros)),
        gastosVariablesDirectos: Number(f.total_egresos_directos),
        prestamosNeto: 0,
        flujoLibreReal: Number(f.flujo_caja_libre_estimado),
      },
      this.modoOscuro,
    );
    this.cascadaData = wf.data;
    this.cascadaOpciones = wf.options;
  }

  private construirGraficosAvanzados(a: AnaliticaAvanzadaDashboard): void {
    const curva = construirCurvaFlujoYPatrimonio(a.serieTemporal, this.modoOscuro);
    this.curvaData = curva.data;
    this.curvaOpciones = curva.options;

    const donut = construirDonutMultiAnilloCategorias(a.distribucionCategorias, this.modoOscuro);
    this.donutMultiData = donut.data;
    this.donutMultiOpciones = donut.options;

    const horizonte = construirHorizonteDesendeudamientoTarjetas(a.proyeccionCuotasTarjetas, this.modoOscuro);
    this.horizonteTarjetasData = horizonte.data;
    this.horizonteTarjetasOpciones = horizonte.options;
  }
}
