import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CandidataRefinanciamiento,
  DetalleRefinanciamiento,
  EjecutarBarridoPedido,
  EjecutarRefinanciamientoPedido,
  PedidoBarridoFecha,
  PedidoRefinanciamiento,
  ResultadoEjecucion,
  ResultadoEjecucionBarrido,
  SimulacionBarridoFecha,
  SimulacionRefinanciamiento,
} from '../modelos/refinanciamiento';
import { ApiServicesService } from './api-services.service';

/** Unificación de deuda de una tarjeta de crédito (`/api/refinanciamientos`). */
@Injectable({ providedIn: 'root' })
export class RefinanciamientosService {
  private readonly url = 'refinanciamientos';

  constructor(private api: ApiServicesService) {}

  /** Compras pendientes de la tarjeta con su saldo de capital, cuota próxima y responsables. */
  candidatas(tarjetaId: number): Observable<CandidataRefinanciamiento[]> {
    return this.api.get<CandidataRefinanciamiento[]>(`${this.url}/candidatas`, { tarjetaId });
  }

  /** Simula sin escribir nada. */
  simular(pedido: PedidoRefinanciamiento): Observable<SimulacionRefinanciamiento> {
    return this.api.post<SimulacionRefinanciamiento>(`${this.url}/simular`, pedido);
  }

  /** Simula el barrido por fecha de corte sin escribir nada. */
  simularBarrido(pedido: PedidoBarridoFecha): Observable<SimulacionBarridoFecha> {
    return this.api.post<SimulacionBarridoFecha>(`${this.url}/simular-barrido-fecha`, pedido);
  }

  /** Ejecuta el barrido por fecha de corte en una sola transacción. */
  ejecutarBarrido(pedido: EjecutarBarridoPedido): Observable<ResultadoEjecucionBarrido> {
    return this.api.post<ResultadoEjecucionBarrido>(`${this.url}/ejecutar-barrido-fecha`, pedido);
  }

  /** Ejecuta la unificación en una sola transacción. */
  ejecutar(pedido: EjecutarRefinanciamientoPedido): Observable<ResultadoEjecucion> {
    return this.api.post<ResultadoEjecucion>(this.url, pedido);
  }

  /** `id` puede ser la compra nueva o cualquiera de las unificadas (404 si la compra no forma parte de un refinanciamiento). */
  detalle(compraId: number): Observable<DetalleRefinanciamiento> {
    return this.api.get<DetalleRefinanciamiento>(`${this.url}/${compraId}`);
  }

  /** Deshace la unificación (solo las creadas con el asistente y sin cuotas pagadas). */
  deshacer(maestraId: number): Observable<{ restauradas: number }> {
    return this.api.delete<{ restauradas: number }>(`${this.url}/${maestraId}`);
  }
}
