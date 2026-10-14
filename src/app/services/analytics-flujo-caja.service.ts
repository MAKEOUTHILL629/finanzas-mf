import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FlujoCaja, Periodo } from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Dashboard de flujo de caja mensual: `GET /api/analytics/flujo-caja?periodo=YYYY-MM`. */
@Injectable({ providedIn: 'root' })
export class AnalyticsFlujoCajaService {
  constructor(private api: ApiServicesService) {}

  /**
   * Ingresos, egresos directos, tarjetas, recurrentes esperados y lo que terceros te deben en el mes.
   * `flujo_caja_libre_estimado` y `gasto_neto_real_tuyo` ya vienen calculados (con Decimal) por el backend.
   */
  getFlujoCaja(periodo: Periodo): Observable<FlujoCaja> {
    return this.api.get<FlujoCaja>('analytics/flujo-caja', limpiarParams({ periodo }));
  }
}
