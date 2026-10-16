import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, share } from 'rxjs/operators';

/** Lecturas en curso, por URL completa (con parámetros). Se borran al terminar: no es un caché, solo evita el trabajo doble. */
const EN_CURSO = new Map<string, Observable<HttpEvent<unknown>>>();

/**
 * Si dos partes de la pantalla piden lo mismo a la vez (la lista de personas para un selector y para una tabla, el mismo
 * extracto desde dos widgets…), solo sale UNA petición y las dos reciben la respuesta. Aplica únicamente a `GET` sin cuerpo que
 * estén en vuelo al mismo tiempo; en cuanto llega la respuesta se olvida, así nunca se muestra un dato viejo.
 */
export const deduplicarGetInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  if (req.method !== 'GET' || req.reportProgress || req.responseType !== 'json') return next(req);
  const clave = `${req.urlWithParams}|${req.headers.get('Authorization') ?? ''}`;
  const existente = EN_CURSO.get(clave);
  if (existente) return existente;
  const compartida = next(req).pipe(
    finalize(() => EN_CURSO.delete(clave)),
    share()
  );
  EN_CURSO.set(clave, compartida);
  return compartida;
};

/** Solo para pruebas: olvida lo que haya en curso. */
export function olvidarLecturasEnCurso(): void {
  EN_CURSO.clear();
}
