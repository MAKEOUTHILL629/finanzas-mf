import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { FlujoCaja, Periodo } from '../modelos/erp';
import { AnalyticsFlujoCajaService } from '../services/analytics-flujo-caja.service';
import { ThemeService } from '../services/theme.service';
import { aCentavos } from '../shared/dinero.helper';
import { mensajeDeError } from '../shared/http-error.helper';
import { moneda } from '../shared/moneda.util';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../shared/periodo.helper';

export interface PiezaDesembolso {
  clave: 'egresos' | 'tarjetas' | 'recurrentes';
  etiqueta: string;
  valor: number;
  color: string;
}

/** Colores de datos del sistema de diseño (`--chart-*` son universales, no cambian con el tema). */
const COLORES = { egresos: '#FF5630', tarjetas: '#0071E3', recurrentes: '#5243AA', ingresos: '#36B37E', terceros: '#00A3BF', neto: '#FFAB00' };

/** Las tres partes del desembolso bruto, solo las que tienen valor. */
export function piezasDeDesembolso(f: FlujoCaja): PiezaDesembolso[] {
  return (
    [
      { clave: 'egresos', etiqueta: 'Egresos directos', valor: Number(f.total_egresos_directos), color: COLORES.egresos },
      { clave: 'tarjetas', etiqueta: 'Cuotas de tarjetas', valor: Number(f.total_tarjetas), color: COLORES.tarjetas },
      { clave: 'recurrentes', etiqueta: 'Gastos recurrentes', valor: Number(f.total_esperado_recurrentes), color: COLORES.recurrentes },
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

  private colorTexto = '#9CA3AF';
  private colorRejilla = 'rgba(255,255,255,0.08)';
  private destroy$ = new Subject<void>();

  constructor(
    private flujoService: AnalyticsFlujoCajaService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.pipe(takeUntil(this.destroy$)).subscribe((oscuro) => {
      this.colorTexto = oscuro ? '#9CA3AF' : '#6B7280';
      this.colorRejilla = oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      if (this.flujo) this.construirGraficos(this.flujo);
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
          backgroundColor: [COLORES.ingresos, COLORES.egresos, COLORES.terceros, COLORES.neto],
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
  }
}
