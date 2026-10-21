import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AplicarExcedente,
  CrearAporteDiario,
  EliminadoAporteDiario,
  GuardarPeriodo,
  ResultadoAplicarExcedente,
  ResultadoAporteDiario,
  ResultadoGuardarPeriodo,
  ResumenCarro,
} from '../modelos/aportes';
import { Periodo } from '../modelos/erp';
import { ResumenWhatsAppCarro } from '../modelos/resumen-whatsapp-carro';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Aportes diarios de la cuota del carro (`/api/obligaciones-aportes/*`). El cruce de cuentas, el ingreso a la cuenta y
 * el saldo a favor se resuelven en el backend (triggers 2, 3 y 4); aquí solo se envían las líneas del aporte.
 */
@Injectable({ providedIn: 'root' })
export class AportesCarroService {
  private readonly base = 'obligaciones-aportes';

  constructor(private api: ApiServicesService) {}

  /** KPIs, saldo a favor global y periodos (más reciente primero) con sus aportes y desglose. */
  getResumen(periodo?: Periodo | null): Observable<ResumenCarro> {
    return this.api.get<ResumenCarro>(`${this.base}/carro/resumen`, limpiarParams({ periodo }));
  }

  /** Último aporte + consolidado del mes para enviar a Papá por WhatsApp (Fase 7). */
  getResumenWhatsApp(periodo?: Periodo | null): Observable<ResumenWhatsAppCarro> {
    return this.api.get<ResumenWhatsAppCarro>(`${this.base}/carro/resumen-whatsapp`, limpiarParams({ periodo }));
  }

  /** Crea el periodo del mes o actualiza su cuota objetivo. */
  guardarPeriodo(periodo: GuardarPeriodo): Observable<ResultadoGuardarPeriodo> {
    return this.api.post<ResultadoGuardarPeriodo>(`${this.base}/periodos`, periodo);
  }

  crearAporteDiario(aporte: CrearAporteDiario): Observable<ResultadoAporteDiario> {
    return this.api.post<ResultadoAporteDiario>(`${this.base}/aportes-diarios`, aporte);
  }

  actualizarAporteDiario(id: number, aporte: CrearAporteDiario): Observable<ResultadoAporteDiario> {
    return this.api.put<ResultadoAporteDiario>(`${this.base}/aportes-diarios/${id}`, aporte);
  }

  eliminarAporteDiario(id: number): Observable<EliminadoAporteDiario> {
    return this.api.delete<EliminadoAporteDiario>(`${this.base}/aportes-diarios/${id}`);
  }

  /** Traslada el saldo a favor al mes siguiente o lo cruza contra el estado de cuenta del responsable. */
  aplicarExcedente(periodoId: number, cuerpo: AplicarExcedente): Observable<ResultadoAplicarExcedente> {
    return this.api.post<ResultadoAplicarExcedente>(`${this.base}/periodos/${periodoId}/aplicar-excedente`, cuerpo);
  }
}
