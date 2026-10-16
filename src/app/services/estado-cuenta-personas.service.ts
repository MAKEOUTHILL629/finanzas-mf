import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Periodo } from '../modelos/erp';
import { DetalleEstadoCuentaPersona, EstadoCuentaPersonas } from '../modelos/estado-cuenta-personas';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Deuda unificada por persona: lo que debe pagar este mes y su deuda total, sumando las cuotas de las compras con tarjeta
 * que le tocan (según su porcentaje y cuántas cuotas le corresponden), préstamos, recurrentes, cobros puntuales y cruces.
 */
@Injectable({ providedIn: 'root' })
export class EstadoCuentaPersonasService {
  constructor(private api: ApiServicesService) {}

  /** Resumen de todas las personas con actividad en el periodo (o todas, con `todas`). */
  getResumen(periodo: Periodo, todas = false): Observable<EstadoCuentaPersonas> {
    return this.api.get<EstadoCuentaPersonas>('personas/estado-cuenta', limpiarParams({ periodo, todas: todas ? 'true' : undefined }));
  }

  /** Detalle de una persona: compras de cada tarjeta con su cuota del mes, lo que queda por pagar y qué cuotas se saldaron. */
  getDetalle(personaId: number, periodo: Periodo): Observable<DetalleEstadoCuentaPersona> {
    return this.api.get<DetalleEstadoCuentaPersona>(`personas/${personaId}/estado-cuenta`, limpiarParams({ periodo }));
  }
}
