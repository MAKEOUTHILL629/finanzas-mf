import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CobroPublico, ObjetarCobro, ReportarPago, ResultadoObjecion, ResultadoReporte } from '../modelos/cobros-personas';

/** Página pública del enlace de cobro (`/api/publico/cobros/:token`): no requiere sesión. */
@Injectable({ providedIn: 'root' })
export class CobroPublicoService {
  constructor(private http: HttpClient) {}

  private url(token: string): string {
    return `${environment.apiUrl}/publico/cobros/${encodeURIComponent(token)}`;
  }

  getCobro(token: string): Observable<CobroPublico> {
    return this.http.get<CobroPublico>(this.url(token));
  }

  reportarPago(token: string, pago: ReportarPago): Observable<ResultadoReporte> {
    return this.http.post<ResultadoReporte>(`${this.url(token)}/pagos`, pago);
  }

  /** La persona observa un cobro (o el total) con un comentario obligatorio. */
  objetar(token: string, datos: ObjetarCobro): Observable<ResultadoObjecion> {
    return this.http.post<ResultadoObjecion>(`${this.url(token)}/objeciones`, datos);
  }

  /** Dirección de la imagen del QR de un medio de pago (se usa en un `<img>`). */
  urlQr(token: string, metodoId: number): string {
    return `${this.url(token)}/metodos/${metodoId}/qr`;
  }
}
