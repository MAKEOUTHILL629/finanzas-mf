import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AporteDiaConDetalle,
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

  /** Lista desde la vista `vw_ResumenObligacionesMes`: ya trae aportado real, restante y nombre del responsable. */
  getObligaciones(periodo?: Periodo, tipo?: TipoObligacionMes): Observable<ResumenObligacionMes[]> {
    return this.api.get<ResumenObligacionMes[]>(this.url, limpiarParams({ periodo, tipo }));
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

  /** Días con aportes y su desglose por persona y método (de más reciente a más antiguo). */
  getAportesDia(id: number): Observable<AporteDiaConDetalle[]> {
    return this.api.get<AporteDiaConDetalle[]>(`${this.url}/${id}/aportes-dia`);
  }

  /**
   * Registra los aportes de un día (si el día ya existe, agrega los ítems). Si aporta alguien distinto del responsable
   * principal y del titular, el Trigger 3 de la BD crea un préstamo POR_COBRAR con sus aprobaciones.
   */
  registrarAportesDia(id: number, aportes: RegistrarAportesDia): Observable<AporteDiaConDetalle> {
    return this.api.post<AporteDiaConDetalle>(`${this.url}/${id}/aportes-dia`, aportes);
  }
}
