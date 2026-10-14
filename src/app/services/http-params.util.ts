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
