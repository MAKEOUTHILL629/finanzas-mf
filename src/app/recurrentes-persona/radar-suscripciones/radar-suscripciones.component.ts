import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CandidatoRecurrente, ResultadoRadar } from '../../modelos/radar-suscripciones';
import { RecurrentesService } from '../../services/recurrentes.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';

/** Ahorro anual simulado al marcar «quiero cancelar»: suma mensualizada × 12 (puro, testeable). */
export function ahorroAnualSimulado(candidatos: CandidatoRecurrente[], seleccionadas: Set<string>): number {
  const mensual = sumarMonedas(candidatos.filter((c) => seleccionadas.has(c.clave)).map((c) => c.montoMensualizado));
  return mensual * 12;
}

@Component({
  selector: 'app-radar-suscripciones',
  templateUrl: './radar-suscripciones.component.html',
  styleUrl: './radar-suscripciones.component.css',
})
export class RadarSuscripcionesComponent implements OnInit, OnDestroy {
  radar: ResultadoRadar | null = null;
  cargando = false;
  error: string | null = null;
  paraCancelar = new Set<string>();
  private destroy$ = new Subject<void>();

  constructor(private recurrentes: RecurrentesService) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.recurrentes.getRadar(6).pipe(takeUntil(this.destroy$), finalize(() => (this.cargando = false))).subscribe({
      next: (r) => (this.radar = r),
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo detectar tus suscripciones.')),
    });
  }

  alternarCancelar(c: CandidatoRecurrente, marcado: boolean): void {
    if (marcado) this.paraCancelar.add(c.clave);
    else this.paraCancelar.delete(c.clave);
  }

  get ahorroSimulado(): number {
    return this.radar ? ahorroAnualSimulado(this.radar.candidatos, this.paraCancelar) : 0;
  }

  /** Oficializar: crea la plantilla recurrente con los datos detectados. */
  oficializar(c: CandidatoRecurrente): void {
    this.recurrentes
      .crearPlantilla({ nombre: c.comercio, frecuencia: c.frecuencia, montoBaseEstimado: c.ultimoMonto, esMontoVariable: c.tipoMonto !== 'MONTO_FIJO_COP' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: () => this.cargar(), error: (err) => (this.error = mensajeDeError(err, 'No se pudo oficializar.')) });
  }

  marcarCancelar(c: CandidatoRecurrente): void {
    this.recurrentes.marcarParaCancelar(c.comercio, c.ultimoMonto, c.frecuencia).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.cargar(),
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo marcar para cancelar.')),
    });
  }
}
