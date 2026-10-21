import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DetalleCuotasColaborativas } from '../modelos/aportes-cuota';
import { ComprasCredito, ComprasCreditoMultimoneda, CuotaDetalle, DetalleCompletoCompraCredito } from '../modelos/compras-credito';
import { ApiServicesService } from './api-services.service';

/** Lo que se puede cambiar en línea de una compra (solo se envía lo que cambió). */
export interface CambiosCompraCredito {
  concepto?: string;
  descripcion?: string;
  estado?: string;
  plasticoId?: number;
  /** Número: el backend lo recibe como importe. */
  valorCompra?: number;
  /** `yyyy-MM-dd`. */
  fechaCompra?: string;
  numeroCuotas?: number;
  /** Interés mensual en %. */
  interes?: number;
  tarjeta?: number;
  tags?: string[];
  comercioCanonico?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ComprasCreditoService {
  constructor(private api: ApiServicesService) { }

  getComprasCredito(): Observable<ComprasCredito[]> {
    return this.api.get<ComprasCredito[]>('compras-credito');
  }

  getDetalle(id: number): Observable<ComprasCreditoMultimoneda> {
    return this.api.get<ComprasCreditoMultimoneda>(`compras-credito/detalle/${id}`);
  }

  getDetalleCompleto(id: number): Observable<DetalleCompletoCompraCredito> {
    return this.api.get<DetalleCompletoCompraCredito>(`v2/compras-credito/${id}/detalle-completo`);
  }

  getCuotas(id: number): Observable<CuotaDetalle[]> {
    return this.api.get<CuotaDetalle[]>(`compras-credito/${id}`);
  }

  /** Edición en línea (`PATCH /api/compras-credito/:id`): devuelve la compra ya actualizada. */
  actualizarParcial(id: number, cambios: CambiosCompraCredito): Observable<ComprasCreditoMultimoneda> {
    return this.api.patch<ComprasCreditoMultimoneda>(`compras-credito/${id}`, cambios);
  }

  /** Edición completa 360° (`PUT /api/compras-credito/:id`). */
  actualizarCompraCompleta(id: number, dto: ComprasCredito): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`compras-credito/${id}`, dto);
  }

  // ── cuotas colaborativas (Fase 5) ──

  getCuotasColaborativas(compraId: number): Observable<DetalleCuotasColaborativas> {
    return this.api.get<DetalleCuotasColaborativas>(`compras-credito/${compraId}/cuotas-colaborativas`);
  }

  registrarAporteCuota(cuotaId: number, dto: { aportantePersonaId: number; monto: number; modalidad?: string; fecha?: string; observaciones?: string }): Observable<{ aporteId: number; detalle: DetalleCuotasColaborativas }> {
    return this.api.post(`compras-credito/cuotas/${cuotaId}/aportes`, dto);
  }
}
