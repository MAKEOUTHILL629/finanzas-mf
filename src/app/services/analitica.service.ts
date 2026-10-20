import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Etiqueta, ResultadoConsultaAnalitica, ResultadoRetag } from '../modelos/analitica';
import { ApiServicesService } from './api-services.service';
import { limpiarParams } from './http-params.util';

@Injectable({ providedIn: 'root' })
export class AnaliticaService {
  private readonly url = 'v2/analitica';
  constructor(private api: ApiServicesService) {}

  consultar(q: string, desde?: string, hasta?: string): Observable<ResultadoConsultaAnalitica> {
    return this.api.get<ResultadoConsultaAnalitica>(`${this.url}/consulta`, limpiarParams({ q, desde, hasta }));
  }

  retagHistorico(soloSinTags = false): Observable<ResultadoRetag> {
    return this.api.post<ResultadoRetag>(`${this.url}/retag-historico`, { soloSinTags });
  }

  listarTags(): Observable<Etiqueta[]> {
    return this.api.get<Etiqueta[]>(`${this.url}/tags`);
  }

  actualizarTags(tipo: 'COMPRA' | 'TRANSACCION', id: number, tags: string[], crearRegla = false): Observable<{ tipo: string; id: number; tags: string[]; reglaCreada: boolean }> {
    return this.api.post(`${this.url}/tags`, { tipo, id, tags, crearRegla });
  }
}
