import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ComprasCredito } from '../modelos/compras-credito';

@Injectable({
  providedIn: 'root'
})
export class ComprasCreditoService {
  private apiUrl = 'http://localhost:9000/compras-credito';

  constructor(private http: HttpClient) { }

  getComprasCredito(): Observable<ComprasCredito[]> {
    return this.http.get<ComprasCredito[]>(this.apiUrl);
  }
}
