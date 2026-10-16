import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TipoCatalogo } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';

/**
 * Qué catálogos cambian cuando una petición que MODIFICA datos termina bien. Va de la ruta de la API (sin el prefijo) a los
 * catálogos afectados. Así ningún formulario tiene que acordarse de refrescar los selectores: crear una cuenta, pagar un extracto
 * (baja un saldo) o asignar los dígitos de una tarjeta deja los selectores al día solos.
 */
export const REGLAS_INVALIDACION: ReadonlyArray<{ patron: RegExp; catalogos: TipoCatalogo[] }> = [
  { patron: /^personas(\/|$)/, catalogos: ['personas'] },
  { patron: /^categorias(\/|$)/, catalogos: ['categorias'] },
  { patron: /^cuentas-financieras(\/|$)/, catalogos: ['cuentas'] },
  { patron: /^tarjetas(\/|$)/, catalogos: ['tarjetas', 'cuentas'] }, // pagar-extracto mueve el saldo de una cuenta
  { patron: /^compras-credito\/responsables/, catalogos: [] }, // los responsables no cambian ningún catálogo
  // Todo lo que crea movimientos o abonos puede cambiar el saldo de una cuenta (las categorías no cambian).
  { patron: /^(transacciones|ledger|cobros|obligaciones-aportes|aportes-carro|liquidacion-mensual|recurrentes|gastos-recurrentes|prestamos|cruces-deuda)(\/|$)/, catalogos: ['cuentas'] },
  { patron: /^personas\/\d+\/abonar$/, catalogos: ['cuentas', 'personas'] },
  { patron: /^notificaciones-correo(\/|$)/, catalogos: ['cuentas', 'tarjetas'] }, // asignar productos, conciliar y reprocesar crean cuentas, tarjetas y movimientos
];

const METODOS_QUE_MODIFICAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Catálogos a refrescar tras una petición exitosa a `ruta` (sin prefijo ni query). */
export function catalogosAfectados(metodo: string, ruta: string): TipoCatalogo[] {
  if (!METODOS_QUE_MODIFICAN.has(metodo.toUpperCase())) return [];
  const limpia = ruta.split('?')[0].replace(/^\/+/, '').replace(/^api\/(v\d\/)?/, '');
  const afectados = new Set<TipoCatalogo>();
  for (const r of REGLAS_INVALIDACION) if (r.patron.test(limpia)) r.catalogos.forEach((c) => afectados.add(c));
  return [...afectados];
}

export const catalogosInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const catalogos = inject(CatalogosService);
  return next(req).pipe(
    tap((evento) => {
      if (!(evento instanceof HttpResponse) || evento.status < 200 || evento.status >= 300) return;
      let ruta: string;
      try {
        ruta = new URL(req.url, 'http://local').pathname;
      } catch {
        return;
      }
      const afectados = catalogosAfectados(req.method, ruta);
      if (afectados.length > 0) catalogos.invalidar(...afectados);
    })
  );
};
