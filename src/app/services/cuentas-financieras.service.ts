import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarCategoria,
  ActualizarCuentaFinanciera,
  Categoria,
  CrearCategoria,
  CrearCuentaFinanciera,
  CuentaFinanciera,
  TipoCategoria,
} from '../modelos/erp';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/**
 * Cuentas bancarias/billeteras (`/api/cuentas-financieras`) y categorías (`/api/categorias`).
 * El saldo (`saldo_actual`) lo mantiene el Trigger 2 de la BD: solo se envía como `saldoInicial` al crear.
 */
@Injectable({ providedIn: 'root' })
export class CuentasFinancierasService {
  private readonly cuentasUrl = 'cuentas-financieras';
  private readonly categoriasUrl = 'categorias';

  constructor(private api: ApiServicesService) {}

  // ── cuentas ──

  getCuentas(soloActivas?: boolean): Observable<CuentaFinanciera[]> {
    return this.api.get<CuentaFinanciera[]>(this.cuentasUrl, limpiarParams({ soloActivas }));
  }

  getCuenta(id: number): Observable<CuentaFinanciera> {
    return this.api.get<CuentaFinanciera>(`${this.cuentasUrl}/${id}`);
  }

  crearCuenta(cuenta: CrearCuentaFinanciera): Observable<CuentaFinanciera> {
    return this.api.post<CuentaFinanciera>(this.cuentasUrl, cuenta);
  }

  actualizarCuenta(id: number, cambios: ActualizarCuentaFinanciera): Observable<CuentaFinanciera> {
    return this.api.patch<CuentaFinanciera>(`${this.cuentasUrl}/${id}`, cambios);
  }

  /** El backend responde 204; falla con 409 si la cuenta ya tiene movimientos (en ese caso desactívala). */
  eliminarCuenta(id: number): Observable<void> {
    return this.api.delete<void>(`${this.cuentasUrl}/${id}`);
  }

  // ── categorías ──

  getCategorias(tipo?: TipoCategoria): Observable<Categoria[]> {
    return this.api.get<Categoria[]>(this.categoriasUrl, limpiarParams({ tipo }));
  }

  crearCategoria(categoria: CrearCategoria): Observable<Categoria> {
    return this.api.post<Categoria>(this.categoriasUrl, categoria);
  }

  actualizarCategoria(id: number, cambios: ActualizarCategoria): Observable<Categoria> {
    return this.api.patch<Categoria>(`${this.categoriasUrl}/${id}`, cambios);
  }

  eliminarCategoria(id: number): Observable<void> {
    return this.api.delete<void>(`${this.categoriasUrl}/${id}`);
  }
}
