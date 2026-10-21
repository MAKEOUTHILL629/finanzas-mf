import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { registrarLimpiezaDeSesion } from '../core/cache-sesion';
import { AnaliticaAvanzadaDashboard, FiltroAnaliticaAvanzada, ResumenDashboard } from '../modelos/dashboard';
import { Periodo } from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Resumen ejecutivo de la pantalla de inicio (una sola llamada a `GET /api/dashboard/summary`) y analítica avanzada multi-filtro. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  /** Último resumen recibido de cada periodo: se muestra al instante mientras llega el actualizado (stale-while-revalidate). */
  private recientes = new Map<string, ResumenDashboard>();

  constructor(private api: ApiServicesService) {
    registrarLimpiezaDeSesion(() => this.recientes.clear());
  }

  /** El resumen que ya se tenía de ese periodo (de esta sesión), para pintarlo sin esperar; `null` si no hay. */
  resumenReciente(periodo: Periodo): ResumenDashboard | null {
    return this.recientes.get(periodo) ?? null;
  }

  getResumen(periodo?: Periodo): Observable<ResumenDashboard> {
    return this.api.get<ResumenDashboard>('dashboard/summary', limpiarParams({ periodo })).pipe(tap((r) => this.recientes.set(r.periodo, r)));
  }

  /** Iteración 2 — Fase 6: Analítica avanzada multi-filtro (`GET /api/dashboard/analitica-avanzada`). */
  getAnaliticaAvanzada(filtros: FiltroAnaliticaAvanzada = {}): Observable<AnaliticaAvanzadaDashboard> {
    return this.api.get<AnaliticaAvanzadaDashboard>(
      'dashboard/analitica-avanzada',
      limpiarParams({
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin,
        granularidad: filtros.granularidad,
        cuentaIds: filtros.cuentaIds?.length ? filtros.cuentaIds.join(',') : undefined,
        tarjetaIds: filtros.tarjetaIds?.length ? filtros.tarjetaIds.join(',') : undefined,
        categoriaIds: filtros.categoriaIds?.length ? filtros.categoriaIds.join(',') : undefined,
        personaIds: filtros.personaIds?.length ? filtros.personaIds.join(',') : undefined,
        soloGastoPropio: filtros.soloGastoPropio,
        incluirTransferenciasInternas: filtros.incluirTransferenciasInternas,
      }),
    );
  }
}
