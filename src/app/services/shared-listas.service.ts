import { Injectable } from '@angular/core';
import { Persona } from '../modelos/persona';
import { Tarjeta } from '../modelos/tarjeta';

@Injectable({
  providedIn: 'root'
})
export class SharedListasService {
  private _listaPersonas: Persona[] = [];
  private _listaTarjetas: Tarjeta[] = [];

  // Índices en memoria O(1)
  private personasMap = new Map<string | number, Persona>();
  private tarjetasMap = new Map<string | number, Tarjeta>();

  constructor() { }

  get listaPersonas(): Persona[] {
    return this._listaPersonas;
  }

  set listaPersonas(value: Persona[]) {
    this._listaPersonas = Array.isArray(value) ? value : [];
    this.rebuildPersonasMap();
  }

  get listaTarjetas(): Tarjeta[] {
    return this._listaTarjetas;
  }

  set listaTarjetas(value: Tarjeta[]) {
    this._listaTarjetas = Array.isArray(value) ? value : [];
    this.rebuildTarjetasMap();
  }

  /**
   * Búsqueda en O(1) de una persona por su identificador.
   */
  findPersonaFast(id: string | number | null | undefined): Persona | undefined {
    if (id === null || id === undefined || id === '') return undefined;
    return this.personasMap.get(id) ?? this.personasMap.get(String(id)) ?? this.personasMap.get(Number(id));
  }

  /**
   * Obtiene el nombre de una persona en O(1) conservando el contrato de salida.
   */
  getNombrePersonaById(id: string | number | null | undefined): string {
    const persona = this.findPersonaFast(id);
    return persona?.nombre || '';
  }

  /**
   * Búsqueda en O(1) de una tarjeta por su identificador.
   */
  findTarjetaFast(id: string | number | null | undefined): Tarjeta | undefined {
    if (id === null || id === undefined || id === '') return undefined;
    return this.tarjetasMap.get(id) ?? this.tarjetasMap.get(String(id)) ?? this.tarjetasMap.get(Number(id));
  }

  /**
   * Obtiene la franquicia de una tarjeta en O(1) conservando el contrato de salida.
   */
  getNombreTarjetaById(id: string | number | null | undefined): string {
    const tarjeta = this.findTarjetaFast(id);
    return tarjeta?.franquicia || '';
  }

  private rebuildPersonasMap(): void {
    this.personasMap.clear();
    for (const persona of this._listaPersonas) {
      if (persona.id !== undefined && persona.id !== null) {
        this.personasMap.set(persona.id, persona);
        this.personasMap.set(String(persona.id), persona);
      }
    }
  }

  private rebuildTarjetasMap(): void {
    this.tarjetasMap.clear();
    for (const tarjeta of this._listaTarjetas) {
      if (tarjeta.id !== undefined && tarjeta.id !== null) {
        this.tarjetasMap.set(tarjeta.id, tarjeta);
        this.tarjetasMap.set(String(tarjeta.id), tarjeta);
      }
    }
  }
}
