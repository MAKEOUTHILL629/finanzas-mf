/**
 * `ApiServicesService.get()` construye `HttpParams` con `fromObject`, que convierte `undefined`/`null` en el texto
 * "undefined"/"null". Este helper descarta los filtros vacíos antes de enviarlos.
 */
export function limpiarParams(params?: object): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const limpio: Record<string, string | number | boolean> = {};
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    limpio[clave] = valor as string | number | boolean;
  }
  return limpio;
}

const ES_ID = (clave: string): boolean => clave === 'id' || /Id$/.test(clave);

/**
 * Deja un cuerpo (POST/PATCH) solo con lo que de verdad se envía: descarta `undefined`, `null`, texto vacío o en blanco y objetos que
 * quedan sin nada; conserva `false` y `0`. Los ids que llegaron como texto de un `<select>` ("12") se envían como número.
 * Así un formulario con campos sin llenar nunca manda `""`/`null` que el servidor tendría que interpretar.
 */
export function depurarCuerpo<T>(valor: T): T {
  const limpio = depurar(valor, '');
  return (limpio === undefined ? (Array.isArray(valor) ? [] : {}) : limpio) as T;
}

function depurar(valor: unknown, clave: string): unknown {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor === 'string') {
    const t = valor.trim();
    if (t === '') return undefined;
    return ES_ID(clave) && /^\d+$/.test(t) ? Number(t) : valor;
  }
  if (Array.isArray(valor)) {
    const items = valor.map((v) => depurar(v, clave)).filter((v) => v !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (typeof valor === 'object' && !(valor instanceof Date)) {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      const d = depurar(v, k);
      if (d !== undefined) salida[k] = d;
    }
    return Object.keys(salida).length > 0 ? salida : undefined;
  }
  return valor;
}
