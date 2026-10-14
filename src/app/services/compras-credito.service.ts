import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ComprasCredito } from '../modelos/compras-credito';
import { ApiServicesService } from './api-services.service';

@Injectable({
  providedIn: 'root'
})
export class ComprasCreditoService {
  constructor(private api: ApiServicesService) { }

  getComprasCredito(): Observable<ComprasCredito[]> {
    return this.api.get<ComprasCredito[]>('compras-credito');
  }
}
