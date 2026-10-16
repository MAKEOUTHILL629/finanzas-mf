import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ActualizarTarjeta, PagarExtracto, Periodo, ResultadoPagoExtracto, ResumenMensualTarjeta } from '../modelos/erp';
import { LineaTiempo } from '../modelos/linea-tiempo';
import {
  ActualizarPlastico,
  AgregarPlastico,
  CrearTarjeta,
  FiltroHistorialTarjeta,
  HistorialTarjeta,
  PlasticoTarjeta,
  ReemplazarPlastico,
  ResultadoReemplazo,
  Tarjeta,
} from '../modelos/tarjeta';
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
   * Crea una tarjeta (crédito o débito, sin límite por cuenta ni franquicia) o, con `plasticoAnteriorId`, el plástico que renueva a otro
   * (el anterior queda archivado con todo su historial).
   */
  crearTarjeta(cuerpo: CrearTarjeta): Observable<Tarjeta> {
    return this.api.post<Tarjeta>(this.url, cuerpo);
  }

  /** Periodo de uso de cada tarjeta (por plástico) y cada cuenta, con sus movimientos. */
  getLineaTiempo(): Observable<LineaTiempo> {
    return this.api.get<LineaTiempo>('productos-financieros/linea-tiempo');
  }

  /**
   * Edita la configuración de la tarjeta (día de corte, límite de pago, cupo, tasas…). Cambiar `diaCorte` no recalcula el
   * `periodo_facturacion` de las cuotas ya guardadas: aplica a las cuotas que se creen o recalculen desde ahora.
   */
  actualizarTarjeta(id: number, cambios: ActualizarTarjeta): Observable<Tarjeta> {
    return this.api.put<Tarjeta>(`${this.url}/${id}`, cambios);
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

  // ── plásticos (reposiciones/renovaciones) ──

  getPlasticos(tarjetaId: number): Observable<PlasticoTarjeta[]> {
    return this.api.get<PlasticoTarjeta[]>(`${this.url}/${tarjetaId}/plasticos`);
  }

  /**
   * «Registrar reemplazo / nuevo plástico»: archiva el plástico activo con su fecha de cierre y registra el nuevo.
   * Las compras y las cuotas pendientes siguen colgando de la misma tarjeta (nada del historial se toca).
   */
  reemplazarPlastico(tarjetaId: number, reemplazo: ReemplazarPlastico): Observable<ResultadoReemplazo> {
    return this.api.post<ResultadoReemplazo>(`${this.url}/${tarjetaId}/plasticos/reemplazar`, reemplazo);
  }

  /** Agrega un plástico anterior (histórico) sin cambiar el activo ni tocar compras. */
  agregarPlastico(tarjetaId: number, plastico: AgregarPlastico): Observable<PlasticoTarjeta[]> {
    return this.api.post<PlasticoTarjeta[]>(`${this.url}/${tarjetaId}/plasticos`, plastico);
  }

  actualizarPlastico(tarjetaId: number, plasticoId: number, cambios: ActualizarPlastico): Observable<PlasticoTarjeta[]> {
    return this.api.patch<PlasticoTarjeta[]>(`${this.url}/${tarjetaId}/plasticos/${plasticoId}`, cambios);
  }

  eliminarPlastico(tarjetaId: number, plasticoId: number): Observable<PlasticoTarjeta[]> {
    return this.api.delete<PlasticoTarjeta[]>(`${this.url}/${tarjetaId}/plasticos/${plasticoId}`);
  }

  /** Compras de la línea de crédito (de todos sus plásticos), con el plástico de cada una; filtrable por plástico y fechas. */
  getHistorial(tarjetaId: number, filtro: FiltroHistorialTarjeta = {}): Observable<HistorialTarjeta> {
    return this.api.get<HistorialTarjeta>(`${this.url}/${tarjetaId}/historial`, limpiarParams({ ...filtro }));
  }
}
