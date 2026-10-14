import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PagarExtracto, Periodo, ResultadoPagoExtracto, ResumenMensualTarjeta } from '../modelos/erp';
import { Tarjeta } from '../modelos/tarjeta';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Tarjetas de crédito: listado legacy más los extractos mensuales del ERP (`/api/tarjetas/...`). */
@Injectable({ providedIn: 'root' })
export class TarjetasService {
  private readonly url = 'tarjetas';

  constructor(private api: ApiServicesService) {}

  getTarjetas(): Observable<Tarjeta[]> {
    return this.api.get<Tarjeta[]>(this.url);
  }

  /**
   * Extracto del periodo (`YYYY-MM`) por tarjeta: total que cobra el banco, parte propia y de terceros, y el
   * componente en USD. Solo aparecen las tarjetas que tienen cuotas facturadas en ese periodo.
   */
  getResumenMensual(periodo: Periodo): Observable<ResumenMensualTarjeta[]> {
    return this.api.get<ResumenMensualTarjeta[]>(`${this.url}/resumen-mensual`, limpiarParams({ periodo }));
  }

  /**
   * Paga el extracto (`sp_pagar_extracto_tarjeta`): crea la transacción PAGO_TARJETA —el Trigger 2 descuenta el saldo
   * de la cuenta— y marca como PAGADA **todas** las cuotas de la tarjeta en ese periodo.
   */
  pagarExtracto(tarjetaId: number, pago: PagarExtracto): Observable<ResultadoPagoExtracto> {
    return this.api.post<ResultadoPagoExtracto>(`${this.url}/${tarjetaId}/pagar-extracto`, pago);
  }
}
