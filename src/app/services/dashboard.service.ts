import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ResumenDashboard } from '../modelos/dashboard';
import { Periodo } from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Resumen ejecutivo de la pantalla de inicio (una sola llamada a `GET /api/dashboard/summary`). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiServicesService) {}

  getResumen(periodo?: Periodo): Observable<ResumenDashboard> {
    return this.api.get<ResumenDashboard>('dashboard/summary', limpiarParams({ periodo }));
  }
}
