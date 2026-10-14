import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarPrestamo,
  CrearPrestamo,
  FiltroPrestamos,
  PrestamoDetalle,
  ResolverAprobacion,
} from '../modelos/cobros';
import { AprobacionPrestamo } from '../modelos/prestamos';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Préstamos (`/api/prestamos`): lista, alta, edición de estado/saldo y aprobaciones. */
@Injectable({ providedIn: 'root' })
export class PrestamosService {
  private readonly url = 'prestamos';

  constructor(private api: ApiServicesService) {}

  getPrestamos(filtro: FiltroPrestamos = {}): Observable<PrestamoDetalle[]> {
    return this.api.get<PrestamoDetalle[]>(this.url, limpiarParams(filtro));
  }

  getPrestamo(id: number): Observable<PrestamoDetalle> {
    return this.api.get<PrestamoDetalle>(`${this.url}/${id}`);
  }

  /** El backend responde 200 con el id creado (contrato legacy). */
  crearPrestamo(prestamo: CrearPrestamo): Observable<unknown> {
    return this.api.post<unknown>(this.url, prestamo);
  }

  /** Solo se envían los campos que cambian. Devuelve el préstamo ya actualizado. */
  actualizarPrestamo(id: number, cambios: ActualizarPrestamo): Observable<PrestamoDetalle> {
    return this.api.patch<PrestamoDetalle>(`${this.url}/${id}`, cambios);
  }

  getAprobaciones(id: number): Observable<AprobacionPrestamo[]> {
    return this.api.get<AprobacionPrestamo[]>(`${this.url}/${id}/aprobaciones`);
  }

  /** Puede resolverla el dueño del libro, un admin o la persona enlazada a la aprobación. */
  resolverAprobacion(prestamoId: number, aprobacionId: number, resolucion: ResolverAprobacion): Observable<AprobacionPrestamo> {
    return this.api.patch<AprobacionPrestamo>(`${this.url}/${prestamoId}/aprobaciones/${aprobacionId}`, resolucion);
  }
}
