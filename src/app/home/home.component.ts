import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { MovimientoDashboard, ResumenDashboard, TarjetaDashboard, VencimientoDashboard } from '../modelos/dashboard';
import { DashboardService } from '../services/dashboard.service';
import { mensajeDeError } from '../shared/http-error.helper';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../shared/periodo.helper';
import { iniciales } from '../personas/personas.constants';
import { barrasFlujo, diaDeMovimiento, esEntrada, fechaLarga, fraseEjecutiva, iconoMovimiento, porcentaje, primerNombre, saludoSegunHora, textoDias, tonoVencimiento } from './home.constants';

/** Pantalla de inicio: resumen ejecutivo de todo (liquidez, tarjetas, lo que te deben, vencimientos y actividad) en una sola llamada. */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly iniciales = iniciales;
  readonly iconoMovimiento = iconoMovimiento;
  readonly esEntrada = esEntrada;
  readonly textoDias = textoDias;
  readonly tonoVencimiento = tonoVencimiento;
  readonly porcentaje = porcentaje;

  periodo = periodoActual();
  datos: ResumenDashboard | null = null;
  /** Primera carga (sin nada que mostrar todavía): se pintan los esqueletos. */
  cargando = true;
  /** Hay datos a la vista y se están refrescando por detrás. */
  actualizando = false;
  error: string | null = null;

  /** Se fija al montar: el saludo y «Hoy/Ayer» no deben cambiar en cada ciclo de detección. */
  readonly ahora = new Date();
  readonly saludo = saludoSegunHora(this.ahora);
  readonly fecha = fechaLarga(this.ahora);

  private destroy$ = new Subject<void>();
  private pedido$ = new Subject<void>();

  constructor(private dashboard: DashboardService) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    // Si ya se vio este periodo en la sesión se pinta al instante y se actualiza por detrás; si no, esqueletos.
    const reciente = this.dashboard.resumenReciente(this.periodo);
    if (reciente) this.datos = reciente;
    this.cargando = !this.datos;
    this.actualizando = !!this.datos;
    this.error = null;
    this.pedido$.next(); // una respuesta tardía de otro periodo no pisa a la nueva
    this.dashboard
      .getResumen(this.periodo)
      .pipe(
        takeUntil(this.destroy$),
        takeUntil(this.pedido$),
        finalize(() => {
          this.cargando = false;
          this.actualizando = false;
        })
      )
      .subscribe({
        next: (d) => (this.datos = d),
        error: (err) => {
          // con datos a la vista un fallo de actualización no los borra: se avisa y se puede reintentar
          if (!reciente) this.datos = null;
          this.error = mensajeDeError(err, 'No se pudo cargar el resumen.');
        }
      });
  }

  // ── periodo ──

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

  // ── lo que muestra la plantilla ──

  get nombre(): string {
    return primerNombre(this.datos?.usuario.nombre);
  }

  get frase(): string {
    return this.datos ? fraseEjecutiva(this.datos) : '';
  }

  get cuentasVisibles() {
    return (this.datos?.liquidez.cuentas ?? []).slice(0, 4);
  }

  get cuentasOcultas(): number {
    return Math.max(0, (this.datos?.liquidez.cuentas.length ?? 0) - 4);
  }

  /** Ingresos y gastos propios del mes como dos barras comparables. */
  get barras(): { ingresos: number; gastos: number } {
    return barrasFlujo(this.datos?.flujoMes.ingresos ?? 0, this.datos?.flujoMes.gastosPropios ?? 0);
  }

  /** Cuánto del total del mes de tarjetas es tuyo (para la barra «mi parte vs. terceros»). */
  get porcentajeMiParte(): number {
    const t = this.datos?.tarjetas.totales;
    return t ? porcentaje(t.miParte, t.pagoDelMes) : 0;
  }

  porcentajeMiParteDe(t: TarjetaDashboard): number {
    return porcentaje(t.miParte, t.pagoDelMes);
  }

  get hayAlertas(): boolean {
    const a = this.datos?.alertas;
    return !!a && (a.movimientosPorRevisar > 0 || a.correosPendientes > 0 || a.pagosPorAprobar > 0);
  }

  dia(m: MovimientoDashboard): string {
    return diaDeMovimiento(m.fecha, this.ahora);
  }

  textoVencimiento(v: VencimientoDashboard): string {
    return v.vencido ? `Venció ${textoDias(v.diasRestantes).toLowerCase()}` : textoDias(v.diasRestantes);
  }

  trackId(_: number, x: { id: number }): number {
    return x.id;
  }

  trackPersona(_: number, x: { personaId: number }): number {
    return x.personaId;
  }

  trackVencimiento(_: number, x: { tarjetaId: number; periodo: string }): string {
    return `${x.tarjetaId}-${x.periodo}`;
  }
}
