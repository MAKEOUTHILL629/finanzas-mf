import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarPlantillaRecurrente,
  CrearPlantillaRecurrente,
  EstadoPeriodoRecurrente,
  Periodo,
  PeriodoRecurrente,
  PlantillaRecurrente,
  RegistrarPagoPeriodo,
  ResultadoProyeccion,
} from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Gastos recurrentes: plantillas (`/api/recurrentes/plantillas`) y su proyección mensual
 * (`/api/recurrentes/periodos`, `/api/recurrentes/proyectar-mes`).
 * Al pagar/facturar un periodo, el Trigger 7 de la BD carga la parte de cada participante en el sub-ledger.
 */
@Injectable({ providedIn: 'root' })
export class RecurrentesService {
  private readonly plantillasUrl = 'recurrentes/plantillas';
  private readonly periodosUrl = 'recurrentes/periodos';

  constructor(private api: ApiServicesService) {}

  // ── plantillas ──

  getPlantillas(soloActivas?: boolean): Observable<PlantillaRecurrente[]> {
    return this.api.get<PlantillaRecurrente[]>(this.plantillasUrl, limpiarParams({ soloActivas }));
  }

  getPlantilla(id: number): Observable<PlantillaRecurrente> {
    return this.api.get<PlantillaRecurrente>(`${this.plantillasUrl}/${id}`);
  }

  crearPlantilla(plantilla: CrearPlantillaRecurrente): Observable<PlantillaRecurrente> {
    return this.api.post<PlantillaRecurrente>(this.plantillasUrl, plantilla);
  }

  actualizarPlantilla(id: number, cambios: ActualizarPlantillaRecurrente): Observable<PlantillaRecurrente> {
    return this.api.patch<PlantillaRecurrente>(`${this.plantillasUrl}/${id}`, cambios);
  }

  /** Si la plantilla ya tiene periodos, el backend la desactiva en lugar de borrarla. */
  eliminarPlantilla(id: number): Observable<{ eliminada: boolean; desactivada: boolean }> {
    return this.api.delete<{ eliminada: boolean; desactivada: boolean }>(`${this.plantillasUrl}/${id}`);
  }

  // ── periodos ──

  getPeriodos(periodo?: Periodo, estado?: EstadoPeriodoRecurrente): Observable<PeriodoRecurrente[]> {
    return this.api.get<PeriodoRecurrente[]>(this.periodosUrl, limpiarParams({ periodo, estado }));
  }

  /** Genera los periodos del mes (promedio de los últimos 3 pagos reales si es variable). Idempotente. */
  proyectarMes(periodo: Periodo): Observable<ResultadoProyeccion> {
    return this.api.post<ResultadoProyeccion>('recurrentes/proyectar-mes', { periodo });
  }

  /** Registra el pago real del periodo; opcionalmente crea el EGRESO en una cuenta. */
  pagarPeriodo(id: number, pago: RegistrarPagoPeriodo): Observable<PeriodoRecurrente> {
    return this.api.patch<PeriodoRecurrente>(`${this.periodosUrl}/${id}/pagar`, pago);
  }
}
