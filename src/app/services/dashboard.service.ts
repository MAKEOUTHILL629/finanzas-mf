import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { registrarLimpiezaDeSesion } from '../core/cache-sesion';
import { ResumenDashboard } from '../modelos/dashboard';
import { Periodo } from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Resumen ejecutivo de la pantalla de inicio (una sola llamada a `GET /api/dashboard/summary`). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  /** Último resumen recibido de cada periodo: se muestra al instante mientras llega el actualizado (stale-while-revalidate). */
  private recientes = new Map<string, ResumenDashboard>();

  constructor(private api: ApiServicesService) {
    registrarLimpiezaDeSesion(() => this.recientes.clear());
  }

  /** El resumen que ya se tenía de ese periodo (de esta sesión), para pintarlo sin esperar; `null` si no hay. */
  resumenReciente(periodo: Periodo): ResumenDashboard | null {
    return this.recientes.get(periodo) ?? null;
  }

  getResumen(periodo?: Periodo): Observable<ResumenDashboard> {
    return this.api.get<ResumenDashboard>('dashboard/summary', limpiarParams({ periodo })).pipe(tap((r) => this.recientes.set(r.periodo, r)));
  }
}
