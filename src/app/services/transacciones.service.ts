import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarTransaccion,
  CrearTransaccion,
  FiltroTransacciones,
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

  actualizarTransaccion(id: number, cambios: ActualizarTransaccion): Observable<Transaccion> {
    return this.api.patch<Transaccion>(`${this.url}/${id}`, cambios);
  }

  /** No borra: pasa la transacción a ANULADO y el Trigger 2 revierte el saldo. */
  anularTransaccion(id: number): Observable<Transaccion> {
    return this.api.delete<Transaccion>(`${this.url}/${id}`);
  }
}
