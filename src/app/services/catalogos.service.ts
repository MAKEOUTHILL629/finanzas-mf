import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Catalogos, EstadoCatalogo, ItemDe, TIPOS_CATALOGO, TipoCatalogo } from '../modelos/catalogos';
import { mensajeDeError } from '../shared/http-error.helper';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

/** Mientras un catálogo tenga menos de esto se considera fresco: no se vuelve a pedir. Pasado el tiempo se sirve el viejo y se actualiza detrás. */
export const TTL_CATALOGO_MS = 60_000;
/** Tras un fallo no se reintenta solo antes de esto (evita ráfagas de peticiones si algo llama a `asegurar` en cada ciclo de detección de cambios). */
export const ESPERA_REINTENTO_MS = 5_000;

const vacio = <T>(): EstadoCatalogo<T> => ({ datos: [], cargando: false, error: null, cargado: false, actualizadoEn: null });

/**
 * Catálogos de los selectores (personas, tarjetas, cuentas, categorías) compartidos por TODOS los formularios.
 *
 *  · Una sola petición (`GET /api/lookup?tipos=…`) trae lo que falte; si otro formulario ya la pidió no se repite (deduplicación).
 *  · Caché en memoria con *stale-while-revalidate*: se muestra de inmediato lo que haya y, si pasó el TTL, se actualiza por detrás.
 *  · Cada catálogo tiene su estado (`cargando`, `error`, `cargado`) para pintar esqueletos, vacío y errores con reintento.
 *  · Si el servidor falla NO se pierden los datos anteriores: el selector sigue usable y solo avisa del error.
 *
 * Tras crear o editar una persona, cuenta, tarjeta o categoría llama a `invalidar(tipo)` para que los selectores se refresquen solos.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly estados: { [T in TipoCatalogo]: BehaviorSubject<EstadoCatalogo<ItemDe[T]>> } = {
    personas: new BehaviorSubject(vacio<ItemDe['personas']>()),
    tarjetas: new BehaviorSubject(vacio<ItemDe['tarjetas']>()),
    cuentas: new BehaviorSubject(vacio<ItemDe['cuentas']>()),
    categorias: new BehaviorSubject(vacio<ItemDe['categorias']>()),
  };
  /** Tipos con una petición en curso (para no repetirla). */
  private readonly enVuelo = new Set<TipoCatalogo>();
  private readonly ultimoIntento = new Map<TipoCatalogo, number>();
  /** Sube en cada `limpiar()`: una respuesta de la sesión anterior que llega tarde se descarta. */
  private generacion = 0;

  constructor(private api: ApiServicesService) {}

  /** Estado del catálogo (se emite al suscribirse y en cada cambio). */
  estado$<T extends TipoCatalogo>(tipo: T): Observable<EstadoCatalogo<ItemDe[T]>> {
    return this.estados[tipo].asObservable() as Observable<EstadoCatalogo<ItemDe[T]>>;
  }

  /** Lo que haya ahora mismo en memoria (puede estar vacío si aún no cargó). */
  datos<T extends TipoCatalogo>(tipo: T): ItemDe[T][] {
    return this.estados[tipo].value.datos as ItemDe[T][];
  }

  estado<T extends TipoCatalogo>(tipo: T): EstadoCatalogo<ItemDe[T]> {
    return this.estados[tipo].value as EstadoCatalogo<ItemDe[T]>;
  }

  /**
   * Garantiza que los catálogos estén cargados y razonablemente frescos. No hace nada si ya lo están o si ya hay una petición en curso.
   * `forzar` ignora la caché (reintentos y recargas después de crear algo).
   */
  asegurar(tipos: TipoCatalogo[] = [...TIPOS_CATALOGO], opciones: { forzar?: boolean } = {}): void {
    const ahora = this.ahora();
    const aCargar = [...new Set(tipos)].filter((t) => {
      if (this.enVuelo.has(t)) return false;
      const e = this.estados[t].value;
      if (opciones.forzar) return true;
      if (e.error !== null) return ahora - (this.ultimoIntento.get(t) ?? 0) >= ESPERA_REINTENTO_MS;
      if (!e.cargado) return true;
      return e.actualizadoEn === null || ahora - e.actualizadoEn > TTL_CATALOGO_MS;
    });
    if (aCargar.length === 0) return;
    this.cargar(aCargar);
  }

  /** Vuelve a pedir los catálogos (todos o los indicados) sin esperar al TTL. */
  recargar(tipos: TipoCatalogo[] = [...TIPOS_CATALOGO]): void {
    this.asegurar(tipos, { forzar: true });
  }

  /**
   * Llamar después de crear/editar/borrar algo de esos catálogos: los que ya estaban cargados se vuelven a pedir (los selectores abiertos
   * se actualizan solos). Los que nunca se cargaron no se piden: se cargarán completos la primera vez que alguien los use.
   */
  invalidar(...tipos: TipoCatalogo[]): void {
    const candidatos = tipos.length > 0 ? tipos : [...TIPOS_CATALOGO];
    const aRecargar = candidatos.filter((t) => this.estados[t].value.cargado);
    if (aRecargar.length > 0) this.recargar(aRecargar);
  }

  /** Reinicia todo (cierre de sesión): ningún dato de un usuario debe verse en la sesión de otro. */
  limpiar(): void {
    this.generacion++;
    this.enVuelo.clear();
    this.ultimoIntento.clear();
    for (const t of TIPOS_CATALOGO) (this.estados[t] as BehaviorSubject<EstadoCatalogo<unknown>>).next(vacio());
  }

  protected ahora(): number {
    return Date.now();
  }

  private cargar(tipos: TipoCatalogo[]): void {
    const ahora = this.ahora();
    const generacion = this.generacion;
    for (const t of tipos) {
      this.enVuelo.add(t);
      this.ultimoIntento.set(t, ahora);
      this.actualizar(t, { cargando: true });
    }
    this.api
      .get<Partial<Catalogos>>('lookup', limpiarParams({ tipos: tipos.join(',') }))
      .pipe(
        finalize(() => {
          if (generacion !== this.generacion) return;
          for (const t of tipos) {
            this.enVuelo.delete(t);
            if (this.estados[t].value.cargando) this.actualizar(t, { cargando: false });
          }
        })
      )
      .subscribe({
        next: (r) => {
          if (generacion !== this.generacion) return; // respuesta de una sesión que ya se cerró
          const ahora = this.ahora();
          for (const t of tipos) {
            // Un cuerpo sin ese catálogo (o no-arreglo) se trata como error: nunca se pisan datos buenos con basura.
            const lista = r?.[t];
            if (Array.isArray(lista)) this.actualizar(t, { datos: lista, cargando: false, error: null, cargado: true, actualizadoEn: ahora });
            else this.actualizar(t, { cargando: false, error: 'El servidor respondió con un formato inesperado.' });
          }
        },
        error: (err) => {
          if (generacion !== this.generacion) return;
          const mensaje = mensajeDeError(err, 'No se pudieron cargar los datos del formulario.');
          for (const t of tipos) this.actualizar(t, { cargando: false, error: mensaje });
        },
      });
  }

  private actualizar<T extends TipoCatalogo>(tipo: T, cambios: Partial<EstadoCatalogo<ItemDe[T]>>): void {
    const sujeto = this.estados[tipo] as BehaviorSubject<EstadoCatalogo<ItemDe[T]>>;
    sujeto.next({ ...sujeto.value, ...cambios });
  }
}
