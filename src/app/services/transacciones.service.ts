import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarTransaccion,
  CrearTransaccion,
  CrearTransferenciaInterna,
  AnaliticaTransferencias,
  FiltroTransacciones,
  ResultadoAnalisisPatrones,
  ResultadoTransferenciaPropia,
  Transaccion,
  TransaccionesPagina,
} from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Libro diario (`/api/transacciones`). Una transacción CONFIRMADA mueve el saldo de las cuentas mediante el
 * Trigger 2 de la BD: el frontend nunca calcula ni envía saldos.
 */
@Injectable({ providedIn: 'root' })
export class TransaccionesService {
  private readonly url = 'transacciones';

  constructor(private api: ApiServicesService) {}

  getTransacciones(filtro: FiltroTransacciones = {}): Observable<TransaccionesPagina> {
    return this.api.get<TransaccionesPagina>(this.url, limpiarParams(filtro));
  }

  getTransaccion(id: number): Observable<Transaccion> {
    return this.api.get<Transaccion>(`${this.url}/${id}`);
  }

  /** `montoOriginal` > 0 con máximo 2 decimales; en moneda distinta de COP exige `tasaCambio`. */
  crearTransaccion(transaccion: CrearTransaccion): Observable<Transaccion> {
    return this.api.post<Transaccion>(this.url, transaccion);
  }

  /** Iteración 2 — Fase 4: crea un par espejo enlazado entre dos cuentas propias (`POST /api/transacciones/transferencia-propia`). */
  crearTransferenciaPropia(datos: CrearTransferenciaInterna): Observable<ResultadoTransferenciaPropia> {
    return this.api.post<ResultadoTransferenciaPropia>(`${this.url}/transferencia-propia`, datos);
  }

  actualizarTransaccion(id: number, cambios: ActualizarTransaccion): Observable<Transaccion> {
    return this.api.patch<Transaccion>(`${this.url}/${id}`, cambios);
  }

  /** Fase 5: extrae llaves/cuentas/nombres de las transferencias y aprende alias por persona. */
  analizarPatronesTransferencias(): Observable<ResultadoAnalisisPatrones> {
    return this.api.post<ResultadoAnalisisPatrones>(`${this.url}/analizar-patrones-transferencias`, {});
  }

  /** Fase 5: analítica agrupada por destinatario, llave, cuenta y entidad; `q` filtra por patrón. */
  analiticaTransferencias(q?: string): Observable<AnaliticaTransferencias> {
    return this.api.get<AnaliticaTransferencias>(`${this.url}/analitica-transferencias`, limpiarParams({ q }));
  }

  /** Fase 5: vincula manualmente una llave/cuenta/celular a una persona. */
  vincularIdentificadorPersona(datos: { personaId: number; tipoIdentificador: string; valorIdentificador: string; entidadBancaria?: string }): Observable<{ aliasId: number; personaId: number; transaccionesActualizadas: number }> {
    return this.api.post<{ aliasId: number; personaId: number; transaccionesActualizadas: number }>(`${this.url}/vincular-identificador-persona`, datos);
  }

  /** No borra: pasa la transacción a ANULADO y el Trigger 2 revierte el saldo. */
  anularTransaccion(id: number): Observable<Transaccion> {
    return this.api.delete<Transaccion>(`${this.url}/${id}`);
  }
}
