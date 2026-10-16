import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AplicarIngreso,
  AprobarReporte,
  CobroPuntual,
  EnlaceCobro,
  EstadoCobro,
  EstadoReporte,
  GenerarEnlace,
  GuardarCobroPuntual,
  IngresoSugerido,
  ReportePago,
  ResultadoAprobacion,
} from '../modelos/cobros-personas';
import { Periodo } from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Cobros a personas (lado del propietario): gastos repartidos (`/api/cobros-puntuales`), enlaces para compartir la
 * liquidación y revisión de los pagos que cada persona reporta (`/api/cobros/*`).
 */
@Injectable({ providedIn: 'root' })
export class CobrosPersonasService {
  constructor(
    private api: ApiServicesService,
    private http: HttpClient
  ) {}

  // ── gastos repartidos ──

  getCobros(filtro: { periodo?: Periodo | null; estado?: EstadoCobro | 'TODOS' } = {}): Observable<CobroPuntual[]> {
    return this.api.get<CobroPuntual[]>('cobros-puntuales', limpiarParams({ periodo: filtro.periodo, estado: filtro.estado }));
  }

  crearCobro(cobro: GuardarCobroPuntual): Observable<CobroPuntual> {
    return this.api.post<CobroPuntual>('cobros-puntuales', cobro);
  }

  actualizarCobro(id: number, cobro: GuardarCobroPuntual): Observable<CobroPuntual> {
    return this.api.put<CobroPuntual>(`cobros-puntuales/${id}`, cobro);
  }

  anularCobro(id: number): Observable<CobroPuntual> {
    return this.api.delete<CobroPuntual>(`cobros-puntuales/${id}`);
  }

  // ── enlaces ──

  /** Genera el enlace de una persona para un mes o, si ya existía, actualiza su foto de la liquidación (conserva el enlace). */
  generarEnlace(datos: GenerarEnlace): Observable<EnlaceCobro> {
    return this.api.post<EnlaceCobro>('cobros/enlaces', datos);
  }

  getEnlaces(periodo?: Periodo | null): Observable<EnlaceCobro[]> {
    return this.api.get<EnlaceCobro[]>('cobros/enlaces', limpiarParams({ periodo }));
  }

  refrescarEnlace(id: number): Observable<EnlaceCobro> {
    return this.api.post<EnlaceCobro>(`cobros/enlaces/${id}/refrescar`, {});
  }

  revocarEnlace(id: number): Observable<EnlaceCobro> {
    return this.api.post<EnlaceCobro>(`cobros/enlaces/${id}/revocar`, {});
  }

  // ── pagos reportados ──

  getReportes(filtro: { estado?: EstadoReporte; periodo?: Periodo | null } = {}): Observable<ReportePago[]> {
    return this.api.get<ReportePago[]>('cobros/reportes', limpiarParams({ estado: filtro.estado, periodo: filtro.periodo }));
  }

  /** El comprobante solo lo ve el propietario: se pide con su sesión y se muestra desde un Blob. */
  getComprobante(id: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/cobros/reportes/${id}/comprobante`, { responseType: 'blob' });
  }

  aprobarReporte(id: number, datos: AprobarReporte = {}): Observable<ResultadoAprobacion> {
    return this.api.post<ResultadoAprobacion>(`cobros/reportes/${id}/aprobar`, datos);
  }

  rechazarReporte(id: number, motivo: string): Observable<ReportePago> {
    return this.api.post<ReportePago>(`cobros/reportes/${id}/rechazar`, { motivo });
  }

  // ── ingresos que ya llegaron ──

  getIngresosSugeridos(periodo?: Periodo | null): Observable<IngresoSugerido[]> {
    return this.api.get<IngresoSugerido[]>('cobros/ingresos-sugeridos', limpiarParams({ periodo }));
  }

  aplicarIngreso(datos: AplicarIngreso): Observable<{ movimientoId: number; transaccionId: number | null; monto: number; personaId: number; periodo: Periodo }> {
    return this.api.post('cobros/pagos/aplicar-ingreso', datos);
  }
}
