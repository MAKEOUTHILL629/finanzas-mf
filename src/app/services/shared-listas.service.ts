import { Injectable } from '@angular/core';
import { Persona } from '../modelos/persona';
import { Tarjeta } from '../modelos/tarjeta';

@Injectable({
  providedIn: 'root'
})
export class SharedListasService {
  private _listaPersonas: Persona[] = [];
  private _listaTarjetas: Tarjeta[] = [];
  constructor() { }

  get listaPersonas(): Persona[] {
    return this._listaPersonas;
  }

  set listaPersonas(value: Persona[]) {
    this._listaPersonas = value;
  }

  get listaTarjetas(): Tarjeta[] {
    return this._listaTarjetas;
  }

  set listaTarjetas(value: Tarjeta[]) {
    this._listaTarjetas = value;
  }
}
