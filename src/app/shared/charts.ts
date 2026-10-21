import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  ChartConfiguration,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { provideCharts } from 'ng2-charts';
import {
  CascadaMensualDashboard,
  CategoriaDistribuida,
  ProyeccionCuotaTarjetaMes,
  PuntoSerieTemporal,
} from '../modelos/dashboard';
import { token } from './design-tokens';
import { moneda } from './moneda.util';
import { MOVIMIENTO_REDUCIDO } from './motion';

/**
 * Solo lo que las gráficas de la aplicación usan (dona, barras y línea), en vez de `withDefaultRegisterables()` que trae todo
 * Chart.js. Se provee en las RUTAS que dibujan gráficas, así la librería viaja en el paquete de esas pantallas y no en el inicial.
 */
export const PROVEEDOR_GRAFICAS = provideCharts({
  registerables: [ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip],
});

// ── Iteración 2 — Fase 6: Constructores de la Suite de Gráficos Avanzados ──

function paletaTema(oscuro = false) {
  return {
    texto: token('--text-secondary', oscuro ? '#A1A1A6' : '#86868B'),
    rejilla: token('--divider', oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
    ingresos: token('--chart-6', '#34C759'),
    gastosPropios: token('--chart-4', '#FF3B30'),
    gastosTerceros: token('--chart-2', '#32ADE6'),
    ahorroNeto: token('--chart-1', '#007AFF'),
    recurrentes: token('--chart-3', '#5856D6'),
    naranja: token('--chart-5', '#FF9500'),
  };
}

function animacionBase() {
  return MOVIMIENTO_REDUCIDO()
    ? (false as const)
    : {
        duration: 650,
        easing: 'easeOutQuart' as const,
      };
}

/**
 * Gráfico 1 — Curva de Flujo de Caja & Patrimonio con Gradientes Animados (Area Spline Chart)
 * Curvas suavizadas Bezier con relleno translúcido y línea punteada de promedio móvil de gastos.
 */
export function construirCurvaFlujoYPatrimonio(
  serie: PuntoSerieTemporal[],
  oscuro = false,
): { data: ChartConfiguration<'line'>['data']; options: ChartConfiguration<'line'>['options'] } {
  const c = paletaTema(oscuro);
  return {
    data: {
      labels: serie.map((s) => s.periodo),
      datasets: [
        {
          label: 'Ingresos',
          data: serie.map((s) => Number(s.ingresos)),
          borderColor: c.ingresos,
          backgroundColor: 'rgba(52, 199, 89, 0.16)',
          fill: true,
          tension: 0.38,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
        {
          label: 'Gastos propios',
          data: serie.map((s) => Number(s.gastosPropios)),
          borderColor: c.gastosPropios,
          backgroundColor: 'rgba(255, 59, 48, 0.14)',
          fill: true,
          tension: 0.38,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
        {
          label: 'Ahorro neto',
          data: serie.map((s) => Number(s.ahorroNeto)),
          borderColor: c.ahorroNeto,
          backgroundColor: 'rgba(0, 122, 255, 0.10)',
          fill: false,
          tension: 0.38,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
        {
          label: 'Promedio móvil gastos',
          data: serie.map((s) => Number(s.promedioMovilGastos)),
          borderColor: c.naranja,
          borderDash: [6, 4],
          fill: false,
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animacionBase(),
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: c.texto, usePointStyle: true, padding: 14 } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${moneda(Number(ctx.parsed.y ?? 0))}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: c.texto }, grid: { display: false } },
        y: { ticks: { color: c.texto, callback: (v) => moneda(Number(v), 'compacto') }, grid: { color: c.rejilla } },
      },
    },
  };
}

/**
 * Gráfico 2 — Donut Multi-Anillo Interactivo (Categorías y Comercios)
 * Anillo exterior para Categorías y anillo interior para Top Comercios.
 */
export function construirDonutMultiAnilloCategorias(
  categorias: CategoriaDistribuida[],
  oscuro = false,
): { data: ChartConfiguration<'doughnut'>['data']; options: ChartConfiguration<'doughnut'>['options'] } {
  const c = paletaTema(oscuro);
  const comerciosPlanos = categorias.flatMap((cat) =>
    cat.comercios.slice(0, 3).map((co) => ({
      etiqueta: `${co.comercio} (${cat.categoria})`,
      monto: Number(co.monto),
      color: cat.color,
    })),
  );

  return {
    data: {
      labels: categorias.map((cat) => cat.categoria),
      datasets: [
        {
          label: 'Categorías',
          data: categorias.map((cat) => Number(cat.monto)),
          backgroundColor: categorias.map((cat) => cat.color),
          borderWidth: 2,
          hoverOffset: 8,
        },
        ...(comerciosPlanos.length > 0
          ? [
              {
                label: 'Top Comercios',
                data: comerciosPlanos.map((co) => co.monto),
                backgroundColor: comerciosPlanos.map((co) => co.color),
                borderWidth: 1,
                hoverOffset: 4,
              },
            ]
          : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '56%',
      animation: animacionBase(),
      plugins: {
        legend: { position: 'bottom', labels: { color: c.texto, usePointStyle: true, padding: 14 } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label ?? ctx.dataset.label}: ${moneda(Number(ctx.parsed ?? 0))}`,
          },
        },
      },
    },
  };
}

/**
 * Gráfico 3 — Horizonte de Desendeudamiento de Tarjetas (Stacked Bar 12 Meses: Parte Propia vs. Parte Terceros)
 */
export function construirHorizonteDesendeudamientoTarjetas(
  proyeccion: ProyeccionCuotaTarjetaMes[],
  oscuro = false,
): { data: ChartConfiguration<'bar'>['data']; options: ChartConfiguration<'bar'>['options'] } {
  const c = paletaTema(oscuro);
  return {
    data: {
      labels: proyeccion.map((p) => p.periodo),
      datasets: [
        {
          label: 'Mi parte',
          data: proyeccion.map((p) => Number(p.partePropia)),
          backgroundColor: c.ahorroNeto,
          borderRadius: 6,
          stack: 'cuotas',
        },
        {
          label: 'De terceros (reembolsable)',
          data: proyeccion.map((p) => Number(p.parteTerceros)),
          backgroundColor: c.gastosTerceros,
          borderRadius: 6,
          stack: 'cuotas',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animacionBase(),
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: c.texto, usePointStyle: true, padding: 14 } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${moneda(Number(ctx.parsed.y ?? 0))}`,
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { color: c.texto }, grid: { display: false } },
        y: { stacked: true, ticks: { color: c.texto, callback: (v) => moneda(Number(v), 'compacto') }, grid: { color: c.rejilla } },
      },
    },
  };
}

/**
 * Gráfico 4 — Flujo de Distribución Mensual (Waterfall / Cascada Financiera)
 * Muestra visualmente: Ingresos -> - Obligaciones Recurrentes -> - Cuotas TC Propias -> - Gastos Variables -> = Flujo Libre Real.
 */
export function construirCascadaDistribucionMensual(
  cascada: CascadaMensualDashboard,
  oscuro = false,
): { data: ChartConfiguration<'bar'>['data']; options: ChartConfiguration<'bar'>['options'] } {
  const c = paletaTema(oscuro);
  const ing = Number(cascada.ingresos);
  const fijos = Number(cascada.gastosFijosRecurrentes);
  const tc = Number(cascada.cuotasTarjetasPropias);
  const vars = Number(cascada.gastosVariablesDirectos);
  const libre = Number(cascada.flujoLibreReal);

  const paso1 = ing - fijos;
  const paso2 = paso1 - tc;

  return {
    data: {
      labels: ['Ingresos', '− Recurrentes', '− Cuotas TC propias', '− Gastos directos', '= Flujo libre real'],
      datasets: [
        {
          label: 'Cascada mensual',
          data: [
            [0, ing],
            [paso1, ing],
            [paso2, paso1],
            [libre, paso2],
            [0, libre],
          ] as unknown as number[],
          backgroundColor: [
            c.ingresos,
            c.recurrentes,
            c.ahorroNeto,
            c.gastosPropios,
            libre >= 0 ? c.ingresos : c.gastosPropios,
          ],
          borderRadius: 6,
          maxBarThickness: 52,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animacionBase(),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.raw as [number, number] | number;
              const magnitud = Array.isArray(raw) ? Math.abs(raw[1] - raw[0]) : Number(raw);
              return ` ${moneda(magnitud)}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: c.texto }, grid: { display: false } },
        y: { ticks: { color: c.texto, callback: (v) => moneda(Number(v), 'compacto') }, grid: { color: c.rejilla } },
      },
    },
  };
}
