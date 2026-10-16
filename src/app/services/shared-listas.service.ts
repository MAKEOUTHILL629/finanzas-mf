import { Injectable } from '@angular/core';
import { ItemPersona, ItemTarjeta } from '../modelos/catalogos';
import { Persona } from '../modelos/persona';
import { Tarjeta } from '../modelos/tarjeta';
import { CatalogosService } from './catalogos.service';

const comoPersona = (p: ItemPersona): Persona => ({
  id: p.id,
  nombre: p.nombre,
  inicialesNombre: p.iniciales ?? undefined,
  colorRepresentativo: p.color ?? undefined,
  email: p.email,
  numeroCelular: p.celular,
});

const comoTarjeta = (t: ItemTarjeta): Tarjeta => ({
  id: t.id,
  franquicia: t.franquicia ?? t.nombre,
  descripcion: t.descripcion ?? undefined,
  tasaInteresCompra: t.tasaInteresCompra,
  diaCorte: t.diaCorte,
  diaLimitePago: t.diaLimitePago,
  cupoTotal: t.cupoTotal,
  permiteDolares: t.permiteDolares,
  ultimos4Activo: t.ultimos4Activo,
});

/**
 * Nombres de personas y tarjetas por id (para los pipes `formatoPersona` / `formatoTarjeta` y pantallas que solo necesitan «quién es el 2»).
 * Se alimenta SOLA de los catálogos compartidos: ya no depende de que otra pantalla haya cargado las listas antes (abrir una URL
 * directa mostraba los nombres en blanco). Las pantallas antiguas aún pueden asignar `listaPersonas` / `listaTarjetas`.
 */
@Injectable({
  providedIn: 'root'
})
export class SharedListasService {
  private _listaPersonas: Persona[] = [];
  private _listaTarjetas: Tarjeta[] = [];

  // Índices en memoria O(1)
  private personasMap = new Map<string | number, Persona>();
  private tarjetasMap = new Map<string | number, Tarjeta>();

  constructor(private catalogos: CatalogosService) {
    this.catalogos.estado$('personas').subscribe((e) => {
      if (e.datos.length > 0) this.listaPersonas = e.datos.map(comoPersona);
    });
    this.catalogos.estado$('tarjetas').subscribe((e) => {
      if (e.datos.length > 0) this.listaTarjetas = e.datos.map(comoTarjeta);
    });
  }

  /** Pide los catálogos si faltan (no repite la petición si ya están cargados o en curso). */
  asegurar(): void {
    this.catalogos.asegurar(['personas', 'tarjetas']);
  }

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
