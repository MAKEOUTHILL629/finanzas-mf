import { HttpEvent, HttpHandler, HttpInterceptor, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';


@Injectable()
export class CsrfInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = tokenElement ? tokenElement.getAttribute('content') : '';

    if (csrfToken) {
      request = request.clone({
        setHeaders: {
          'Csrf-Token': csrfToken
        }
      });
    }

    return next.handle(request);
  }
}
