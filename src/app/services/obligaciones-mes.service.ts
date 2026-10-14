import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AporteDiaResumen,
  CrearObligacionMes,
  ObligacionMes,
  Periodo,
  RegistrarAportesDia,
  ResumenObligacionMes,
  TipoObligacionMes,
} from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Obligaciones del mes con aportes diarios (cuota del carro / de la casa): `/api/obligaciones-mes`. */
@Injectable({ providedIn: 'root' })
export class ObligacionesMesService {
  private readonly url = 'obligaciones-mes';

  constructor(private api: ApiServicesService) {}

  getObligaciones(periodo?: Periodo, tipo?: TipoObligacionMes): Observable<ObligacionMes[]> {
    return this.api.get<ObligacionMes[]>(this.url, limpiarParams({ periodo, tipo }));
  }

  crearObligacion(obligacion: CrearObligacionMes): Observable<ObligacionMes> {
    return this.api.post<ObligacionMes>(this.url, obligacion);
  }

  /** Meta, aportado real, restante y desglose directo/por cruces (vista `vw_ResumenObligacionesMes`). */
  getResumen(id: number): Observable<ResumenObligacionMes> {
    return this.api.get<ResumenObligacionMes>(`${this.url}/${id}/resumen`);
  }

  /** Total aportado por día (vista `vw_AportesDiaResumen`). */
  getDias(id: number): Observable<AporteDiaResumen[]> {
    return this.api.get<AporteDiaResumen[]>(`${this.url}/${id}/dias`);
  }

  /** Detalle de aportes (por persona y método) de la obligación. */
  getAportesDia(id: number): Observable<unknown[]> {
    return this.api.get<unknown[]>(`${this.url}/${id}/aportes-dia`);
  }

  /** Registra los aportes de un día; los de método 'Prestamo' generan el préstamo/cruce vía triggers. */
  registrarAportesDia(id: number, aportes: RegistrarAportesDia): Observable<unknown> {
    return this.api.post<unknown>(`${this.url}/${id}/aportes-dia`, aportes);
  }
}
