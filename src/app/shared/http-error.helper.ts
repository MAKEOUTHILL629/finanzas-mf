/**
 * Convierte un error HTTP del backend en un texto para el usuario.
 * El backend responde con `{ message }`, `{ mensaje }`, `{ message, errors: { campo: [..] } }` (validación)
 * o `{ status: 'error', message }`; el interceptor añade `isTimeout` / `isNetworkError`.
 */
export function mensajeDeError(error: unknown, porDefecto = 'No se pudo completar la operación. Inténtalo de nuevo.'): string {
  const e = error as {
    status?: number;
    isTimeout?: boolean;
    isNetworkError?: boolean;
    error?: { message?: unknown; mensaje?: unknown; errors?: Record<string, unknown> } | string | null;
  } | null;
  if (!e) return porDefecto;

  if (e.isTimeout) return 'El servidor tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo.';
  if (e.isNetworkError || e.status === 0) return 'No hay conexión con el servidor.';
  if (e.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';

  const cuerpo = e.error;
  if (typeof cuerpo === 'string' && cuerpo.trim()) return cuerpo.trim();
  if (cuerpo && typeof cuerpo === 'object') {
    const detalles = cuerpo.errors
      ? Object.entries(cuerpo.errors).flatMap(([campo, v]) => (Array.isArray(v) ? v : [v]).map((m) => `${campo}: ${String(m)}`))
      : [];
    if (detalles.length > 0) return detalles.slice(0, 3).join(' · ');
    const texto = cuerpo.message ?? cuerpo.mensaje;
    if (Array.isArray(texto) && texto.length > 0) return texto.slice(0, 3).join(' · ');
    if (typeof texto === 'string' && texto.trim()) return texto.trim();
  }
  if (e.status && e.status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.';
  return porDefecto;
}
