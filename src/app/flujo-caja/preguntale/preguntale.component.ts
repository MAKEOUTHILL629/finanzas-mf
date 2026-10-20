import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ResultadoConsultaAnalitica } from '../../modelos/analitica';
import { AnaliticaService } from '../../services/analitica.service';
import { mensajeDeError } from '../../shared/http-error.helper';

export const SUGERENCIAS_CONSULTA: string[] = [
  '¿Cuánto he gastado en domicilios en Rappi y Didi?',
  '¿Cuánto en Bershka y Koaj?',
  '¿Cuánto en viajes este año?',
  '¿Cuánto en suscripciones?',
  '¿Cuánto en transporte el mes pasado?',
];

/** «Pregúntale a tu App» (Fase 2): consulta en lenguaje natural sobre tags y comercios. */
@Component({
  selector: 'app-preguntale',
  templateUrl: './preguntale.component.html',
  styleUrl: './preguntale.component.css',
})
export class PreguntaleComponent implements OnDestroy {
  readonly sugerencias = SUGERENCIAS_CONSULTA;
  pregunta = '';
  resultado: ResultadoConsultaAnalitica | null = null;
  cargando = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(private analitica: AnaliticaService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  preguntar(q?: string): void {
    const texto = (q ?? this.pregunta).trim();
    if (!texto) return;
    this.pregunta = texto;
    this.cargando = true;
    this.error = null;
    this.analitica
      .consultar(texto)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.cargando = false)))
      .subscribe({
        next: (r) => (this.resultado = r),
        error: (err) => (this.error = mensajeDeError(err, 'No se pudo responder la consulta.')),
      });
  }

  retag(): void {
    this.cargando = true;
    this.analitica
      .retagHistorico()
      .pipe(takeUntil(this.destroy$), finalize(() => (this.cargando = false)))
      .subscribe({
        next: (r) => {
          this.error = null;
          this.pregunta = this.pregunta || 'domicilios';
          alert(`Re-etiquetado: ${r.registrosEtiquetados} de ${r.registrosAnalizados} registros etiquetados.`);
        },
        error: (err) => (this.error = mensajeDeError(err, 'No se pudo re-etiquetar el historial.')),
      });
  }
}
