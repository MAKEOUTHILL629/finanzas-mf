import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Persona } from '../modelos/persona';
import { ApiServicesService } from './api-services.service';

/** Personas del usuario (`GET /api/personas`). El backend solo expone lectura. */
@Injectable({ providedIn: 'root' })
export class PersonasService {
  constructor(private api: ApiServicesService) {}

  getPersonas(): Observable<Persona[]> {
    return this.api.get<Persona[]>('personas');
  }
}
