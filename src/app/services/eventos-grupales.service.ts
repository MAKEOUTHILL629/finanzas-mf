import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EventoGrupal, LiquidacionEvento } from '../modelos/liquidacion-bilateral';
import { ApiServicesService } from './api-services.service';

@Injectable({ providedIn: 'root' })
export class EventosGrupalesService {
  private readonly base = 'eventos-grupales';
  constructor(private api: ApiServicesService) {}

  listar(): Observable<EventoGrupal[]> {
    return this.api.get<EventoGrupal[]>(this.base);
  }

  crear(dto: { nombre: string; fechaInicio?: string; fechaFin?: string; participantes: Array<{ personaId: number; aliasBloque?: string; peso?: number }> }): Observable<EventoGrupal> {
    return this.api.post<EventoGrupal>(this.base, dto);
  }

  agregarGasto(eventoId: number, dto: { descripcion: string; montoTotal: number; pagadoPorParticipanteId: number; tipoDivision?: string }): Observable<unknown> {
    return this.api.post(`${this.base}/${eventoId}/gastos`, dto);
  }

  liquidacion(eventoId: number): Observable<LiquidacionEvento> {
    return this.api.get<LiquidacionEvento>(`${this.base}/${eventoId}/liquidacion`);
  }

  cerrar(eventoId: number): Observable<LiquidacionEvento> {
    return this.api.post<LiquidacionEvento>(`${this.base}/${eventoId}/cerrar`, {});
  }
}
