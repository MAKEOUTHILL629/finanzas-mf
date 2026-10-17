import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ComprasCredito, ComprasCreditoMultimoneda, CuotaDetalle } from '../modelos/compras-credito';
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

  getCuotas(id: number): Observable<CuotaDetalle[]> {
    return this.api.get<CuotaDetalle[]>(`compras-credito/${id}`);
  }

  /** Edición en línea (`PATCH /api/compras-credito/:id`): devuelve la compra ya actualizada. */
  actualizarParcial(id: number, cambios: CambiosCompraCredito): Observable<ComprasCreditoMultimoneda> {
    return this.api.patch<ComprasCreditoMultimoneda>(`compras-credito/${id}`, cambios);
  }
}
