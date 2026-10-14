import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CruceEntrePersonas, LiquidacionMensual, LiquidacionPersona, RegistrarPagoMes } from '../modelos/aportes';
import { CruceDeuda, Periodo, ResultadoAbonoPersona } from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Liquidación de fin de mes por persona (`/api/liquidacion-mensual`): «¿cuánto me debe cada uno?». */
@Injectable({ providedIn: 'root' })
export class LiquidacionMensualService {
  private readonly base = 'liquidacion-mensual';

  constructor(private api: ApiServicesService) {}

  /** Genera antes los recurrentes del mes. `todas` incluye también a las personas sin movimientos. */
  getLiquidacion(periodo: Periodo, opciones: { personaId?: number | null; todas?: boolean } = {}): Observable<LiquidacionMensual> {
    return this.api.get<LiquidacionMensual>(`${this.base}/${periodo}`, limpiarParams({ personaId: opciones.personaId, todas: opciones.todas || undefined }));
  }

  getLiquidacionPersona(periodo: Periodo, personaId: number): Observable<LiquidacionPersona & { periodo: Periodo }> {
    return this.api.get<LiquidacionPersona & { periodo: Periodo }>(`${this.base}/${periodo}/persona/${personaId}`);
  }

  /** Abona a una persona y carga a la otra en un solo registro. */
  cruceEntrePersonas(cruce: CruceEntrePersonas): Observable<CruceDeuda> {
    return this.api.post<CruceDeuda>(`${this.base}/cruce-entre-personas`, cruce);
  }

  registrarPago(pago: RegistrarPagoMes): Observable<ResultadoAbonoPersona> {
    return this.api.post<ResultadoAbonoPersona>(`${this.base}/registrar-pago`, pago);
  }
}
