import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { BloqueLiquidacion } from '../../modelos/aportes';
import { CompraDePersona, DesgloseTarjeta, DetalleEstadoCuentaPersona } from '../../modelos/estado-cuenta-personas';
import { EstadoCuentaPersonasService } from '../../services/estado-cuenta-personas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo } from '../../shared/periodo.helper';
import { EXPANDIR } from '../../shared/motion';
import { claseEstadoCuota, claveTarjeta, etiquetaEstadoCuota, nombreTarjeta, textoCuota, textoPorcentaje } from '../personas.constants';

interface OtroCargo {
  etiqueta: string;
  icono: string;
  bloque: BloqueLiquidacion;
}

/** Desglose de lo que debe una persona: de qué compras de qué tarjeta sale cada cuota y qué cuotas ya quedaron saldadas. */
@Component({
  selector: 'app-detalle-persona',
  templateUrl: './detalle-persona.component.html',
  styleUrl: './detalle-persona.component.css',
  animations: [EXPANDIR]
})
export class DetallePersonaComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) personaId!: number;
  @Input({ required: true }) periodo!: string;

  readonly textoCuota = textoCuota;
  readonly textoPorcentaje = textoPorcentaje;
  readonly etiquetaEstadoCuota = etiquetaEstadoCuota;
  readonly claseEstadoCuota = claseEstadoCuota;
  readonly nombreTarjeta = nombreTarjeta;
  readonly claveTarjeta = claveTarjeta;

  detalle: DetalleEstadoCuentaPersona | null = null;
  otros: OtroCargo[] = [];
  cargando = true;
  error: string | null = null;

  /** Tarjetas con sus compras desplegadas (la primera se abre sola). */
  private abiertas = new Set<string>();
  private destroy$ = new Subject<void>();
  private pedido$ = new Subject<void>();

  constructor(private servicio: EstadoCuentaPersonasService) {}

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['personaId'] || cambios['periodo']) this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.pedido$.complete();
  }

  cargar(): void {
    this.pedido$.next(); // una respuesta tardía del periodo anterior no pisa a la nueva
    this.cargando = true;
    this.error = null;
    this.servicio
      .getDetalle(this.personaId, this.periodo)
      .pipe(
        takeUntil(this.destroy$),
        takeUntil(this.pedido$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (d) => {
          this.detalle = d;
          this.otros = this.armarOtros(d);
          if (this.abiertas.size === 0 && d.desglosePorTarjeta.length > 0) this.abiertas.add(claveTarjeta(d.desglosePorTarjeta[0]));
        },
        error: (err) => {
          this.detalle = null;
          this.otros = [];
          this.error = mensajeDeError(err, 'No se pudo cargar el desglose.');
        }
      });
  }

  estaAbierta(t: DesgloseTarjeta): boolean {
    return this.abiertas.has(claveTarjeta(t));
  }

  alternar(t: DesgloseTarjeta): void {
    const k = claveTarjeta(t);
    if (!this.abiertas.delete(k)) this.abiertas.add(k);
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  /** Lo que se le cobra además de las tarjetas: solo los bloques que tienen algo. */
  private armarOtros(d: DetalleEstadoCuentaPersona): OtroCargo[] {
    const o = d.otrosCargos ?? {};
    const lista: OtroCargo[] = [
      { etiqueta: 'Préstamos', icono: 'account_balance_wallet', bloque: o.prestamos as BloqueLiquidacion },
      { etiqueta: 'Gastos recurrentes', icono: 'autorenew', bloque: o.recurrentes as BloqueLiquidacion },
      { etiqueta: 'Gastos repartidos', icono: 'request_quote', bloque: o.cobrosPuntuales as BloqueLiquidacion },
      { etiqueta: 'Cruces de deuda', icono: 'swap_horiz', bloque: o.cruces as BloqueLiquidacion },
      { etiqueta: 'Saldo a favor aplicado', icono: 'savings', bloque: o.saldoAFavorAplicado as BloqueLiquidacion },
      { etiqueta: 'Otros', icono: 'more_horiz', bloque: o.otros as BloqueLiquidacion },
    ];
    return lista.filter((x) => x.bloque && x.bloque.items?.length > 0);
  }

  trackTarjeta(_: number, t: DesgloseTarjeta): string {
    return claveTarjeta(t);
  }

  trackCompra(_: number, c: CompraDePersona): number {
    return c.compraId;
  }
}
