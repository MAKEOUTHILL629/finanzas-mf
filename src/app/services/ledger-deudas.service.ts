import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AbonarPersona,
  CrearCruceDeuda,
  CruceDeuda,
  EstadoCuentaPersona,
  MovimientoExtracto,
  Periodo,
  ResultadoAbonoPersona,
} from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Sub-ledger de deudas por persona. Los asientos (`MovimientosDeudaPersona`) los generan los triggers de la BD y
 * el stored procedure de abonos; el frontend solo consulta y dispara abonos/cruces.
 */
@Injectable({ providedIn: 'root' })
export class LedgerDeudasService {
  constructor(private api: ApiServicesService) {}

  /** Estado de cuenta consolidado de todas las personas en un periodo (`YYYY-MM`). */
  getEstadoCuenta(periodo: Periodo): Observable<EstadoCuentaPersona[]> {
    return this.api.get<EstadoCuentaPersona[]>('ledger/estado-cuenta', limpiarParams({ periodo }));
  }

  /** Movimientos de una persona en el periodo. */
  getExtracto(personaId: number, periodo: Periodo): Observable<MovimientoExtracto[]> {
    return this.api.get<MovimientoExtracto[]>(`ledger/personas/${personaId}/extracto`, limpiarParams({ periodo }));
  }

  /**
   * Registra el pago que recibes de una persona (`sp_registrar_abono_persona`): ingresa a `cuentaDestinoId`,
   * abona su deuda y, opcionalmente, liquida los préstamos de un corte.
   */
  abonarPersona(personaId: number, abono: AbonarPersona): Observable<ResultadoAbonoPersona> {
    return this.api.post<ResultadoAbonoPersona>(`personas/${personaId}/abonar`, abono);
  }

  getCrucesDeuda(): Observable<CruceDeuda[]> {
    return this.api.get<CruceDeuda[]>('cruces-deuda');
  }

  /** Una persona paga la deuda de otra: un solo registro, el Trigger 5 crea el par de asientos −1 / +1. */
  crearCruceDeuda(cruce: CrearCruceDeuda): Observable<CruceDeuda> {
    return this.api.post<CruceDeuda>('cruces-deuda', cruce);
  }
}
