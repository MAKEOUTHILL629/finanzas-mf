import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConciliarNotificacion,
  EstadoNotificacionCorreo,
  NotificacionCorreo,
  ResultadoConciliacion,
} from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Bandeja de conciliación de correos bancarios (`/api/notificaciones-correo`).
 *
 * Los correos los sube el Google Apps Script con `POST /notificaciones-correo/sync-batch` (autenticado con
 * `x-webhook-secret`, no desde Angular). Aquí solo se consulta la bandeja y se concilia.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesCorreoService {
  private readonly url = 'notificaciones-correo';

  constructor(private api: ApiServicesService) {}

  getNotificaciones(estado?: EstadoNotificacionCorreo, limit?: number): Observable<NotificacionCorreo[]> {
    return this.api.get<NotificacionCorreo[]>(this.url, limpiarParams({ estado_procesamiento: estado, limit }));
  }

  /** Correos que esperan revisión del usuario (estado PENDIENTE). */
  getPendientes(): Observable<NotificacionCorreo[]> {
    return this.getNotificaciones('PENDIENTE');
  }

  getNotificacion(id: number): Observable<NotificacionCorreo> {
    return this.api.get<NotificacionCorreo>(`${this.url}/${id}`);
  }

  /**
   * Confirma o descarta un correo. Al confirmar puede, según lo que generó el backend:
   *  - cambiar `numeroCuotas` y asignar `responsables` (compras de tarjeta),
   *  - indicar `categoriaId`, `concepto`, `monto` (transacciones) o `cuentaId`/`tarjetaId` (si no se identificó),
   *  - `convertirEnPrestamo` (egresos).
   * Todo ocurre en una sola transacción de BD. Devuelve 409 si el correo ya estaba conciliado/ignorado.
   */
  conciliarNotificacion(id: number, datos: ConciliarNotificacion = {}): Observable<ResultadoConciliacion> {
    return this.api.patch<ResultadoConciliacion>(`${this.url}/${id}/conciliar`, datos);
  }

  /** Atajo para ignorar un correo (anula la transacción pendiente / elimina la compra importada). */
  descartarNotificacion(id: number): Observable<ResultadoConciliacion> {
    return this.conciliarNotificacion(id, { accion: 'DESCARTAR' });
  }
}
