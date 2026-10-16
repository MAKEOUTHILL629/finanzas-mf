import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConciliarNotificacion,
  EstadoNotificacionCorreo,
  NotificacionCorreo,
  ResultadoConciliacion,
} from '../modelos/erp';
import {
  AprendizajeTarjeta,
  AsignarProducto,
  EstadoTrabajoReproceso,
  ProductoDetectado,
  ReprocesarCorreos,
  ResultadoAceptarSugerencias,
  ResultadoAsignacion,
  ResumenReproceso,
  TrabajoReproceso,
} from '../modelos/correos-inteligentes';
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

  // ───────────────────────────── productos detectados (últimos 4 dígitos) ─────────────────────────────

  /** Productos que aparecen en los correos, a qué cuenta/tarjeta pertenecen y qué se sugiere. */
  getProductos(): Observable<ProductoDetectado[]> {
    return this.api.get<ProductoDetectado[]>(`${this.url}/productos`);
  }

  /** Asocia solas a su tarjeta las terminaciones con evidencia suficiente (compras con igual fecha y monto). */
  inferirProductos(): Observable<AprendizajeTarjeta[]> {
    return this.api.post<AprendizajeTarjeta[]>(`${this.url}/productos/inferir`, {});
  }

  asignarProducto(datos: AsignarProducto): Observable<ResultadoAsignacion> {
    return this.api.post<ResultadoAsignacion>(`${this.url}/productos/asignar`, datos);
  }

  /** Acepta las sugerencias (todas o solo las de estas terminaciones). */
  aceptarSugerencias(ultimos4?: string[]): Observable<ResultadoAceptarSugerencias> {
    return this.api.post<ResultadoAceptarSugerencias>(`${this.url}/productos/aceptar-sugerencias`, ultimos4 ? { ultimos4 } : {});
  }

  // ───────────────────────────── reproceso ─────────────────────────────

  /** Simula (`simular: true`, por defecto en el backend) y devuelve el resumen sin escribir nada. */
  simularReproceso(opciones: Omit<ReprocesarCorreos, 'simular'> = {}): Observable<ResumenReproceso> {
    return this.api.post<ResumenReproceso>(`${this.url}/reprocesar`, { ...opciones, simular: true });
  }

  /** Ejecuta en segundo plano: devuelve el `jobId` para consultar el avance. */
  iniciarReproceso(opciones: Omit<ReprocesarCorreos, 'simular'> = {}): Observable<TrabajoReproceso> {
    return this.api.post<TrabajoReproceso>(`${this.url}/reprocesar`, { ...opciones, simular: false });
  }

  getEstadoReproceso(jobId: string): Observable<EstadoTrabajoReproceso> {
    return this.api.get<EstadoTrabajoReproceso>(`${this.url}/reprocesar/${jobId}`);
  }
}
