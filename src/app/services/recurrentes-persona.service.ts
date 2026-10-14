import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarRecurrentePersona,
  CrearRecurrentePersona,
  FiltroRecurrentesPersona,
  RecurrentePersona,
  ResultadoGenerarMes,
} from '../modelos/aportes';
import { Periodo } from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Cargos y abonos mensuales recurrentes por persona, vitalicios o por X meses (`/api/recurrentes-persona`). */
@Injectable({ providedIn: 'root' })
export class RecurrentesPersonaService {
  private readonly base = 'recurrentes-persona';

  constructor(private api: ApiServicesService) {}

  getRecurrentes(filtro: FiltroRecurrentesPersona = {}): Observable<RecurrentePersona[]> {
    return this.api.get<RecurrentePersona[]>(this.base, limpiarParams({ ...filtro }));
  }

  crear(recurrente: CrearRecurrentePersona): Observable<RecurrentePersona> {
    return this.api.post<RecurrentePersona>(this.base, recurrente);
  }

  actualizar(id: number, cambios: ActualizarRecurrentePersona): Observable<RecurrentePersona> {
    return this.api.patch<RecurrentePersona>(`${this.base}/${id}`, cambios);
  }

  eliminar(id: number): Observable<{ eliminado: boolean; movimientosAnulados: number }> {
    return this.api.delete<{ eliminado: boolean; movimientosAnulados: number }>(`${this.base}/${id}`);
  }

  /** Genera (idempotente) los cargos del mes en el estado de cuenta de cada persona. */
  generarMes(periodo: Periodo): Observable<ResultadoGenerarMes> {
    return this.api.post<ResultadoGenerarMes>(`${this.base}/generar-mes/${periodo}`, {});
  }
}
