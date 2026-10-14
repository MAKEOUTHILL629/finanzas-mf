import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ActualizarCorteCobro, CorteCobro, CrearCorteCobro, EstadoCorte } from '../modelos/cobros';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Cortes de cobro (`/api/cortes-cobro`): ventanas de fechas a las que se asocian los préstamos. */
@Injectable({ providedIn: 'root' })
export class CortesCobroService {
  private readonly url = 'cortes-cobro';

  constructor(private api: ApiServicesService) {}

  getCortes(estado?: EstadoCorte): Observable<CorteCobro[]> {
    return this.api.get<CorteCobro[]>(this.url, limpiarParams({ estado }));
  }

  /** Corte vigente según la fecha de hoy; 404 si no hay ninguno. */
  getCorteActivo(): Observable<CorteCobro> {
    return this.api.get<CorteCobro>(`${this.url}/activo`);
  }

  crearCorte(corte: CrearCorteCobro): Observable<CorteCobro> {
    return this.api.post<CorteCobro>(this.url, corte);
  }

  actualizarCorte(id: number, cambios: ActualizarCorteCobro): Observable<CorteCobro> {
    return this.api.put<CorteCobro>(`${this.url}/${id}`, cambios);
  }

  /** 204. Responde 409 si el corte tiene préstamos asociados. */
  eliminarCorte(id: number): Observable<void> {
    return this.api.delete<void>(`${this.url}/${id}`);
  }
}
