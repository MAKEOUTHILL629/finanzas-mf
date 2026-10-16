import { ItemCategoria, ItemCuenta, ItemPersona, ItemTarjeta, OpcionSelect, TipoCatalogo } from '../../../modelos/catalogos';

export const TEXTO_CATALOGO: Record<TipoCatalogo, { vacio: string; cargando: string }> = {
  personas: { vacio: 'No hay personas registradas.', cargando: 'Cargando personas…' },
  tarjetas: { vacio: 'No hay tarjetas registradas.', cargando: 'Cargando tarjetas…' },
  cuentas: { vacio: 'No hay cuentas registradas.', cargando: 'Cargando cuentas…' },
  categorias: { vacio: 'No hay categorías registradas.', cargando: 'Cargando categorías…' },
};

/** Los `id` del backend son numéricos, pero un `<select>` los entrega como texto: se comparan sin importar el tipo. */
export function valoresIguales(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  if (a === null || a === undefined || a === '' || b === null || b === undefined || b === '') return false;
  return String(a) === String(b);
}

/** Etiqueta estándar de cada catálogo. */
export function etiquetaDeCatalogo(tipo: TipoCatalogo, item: unknown): string {
  switch (tipo) {
    case 'personas':
      return (item as ItemPersona).nombre;
    case 'tarjetas':
      return (item as ItemTarjeta).etiqueta;
    case 'cuentas': {
      const c = item as ItemCuenta;
      const u4 = c.ultimos4 ? c.ultimos4.split(/[,;\s]+/).filter(Boolean)[0] : null;
      return `${c.nombre}${u4 ? ` ··${u4}` : ''}${c.activa ? '' : ' (inactiva)'}`;
    }
    case 'categorias':
      return (item as ItemCategoria).nombre;
  }
}

/** Texto secundario de cada elemento (solo informativo). */
export function detalleDeCatalogo(tipo: TipoCatalogo, item: unknown): string | undefined {
  if (tipo === 'cuentas') return (item as ItemCuenta).moneda;
  return undefined;
}

export interface OpcionesCatalogo {
  filtro: ((item: any) => boolean) | null;
  etiquetar: ((item: any) => string) | null;
  soloActivas: boolean;
  /** La selección actual: si el filtro la descartaría (p. ej. cuenta inactiva) se conserva igualmente. */
  valorActual: number | string | null;
}

/**
 * Opciones de un selector a partir de un catálogo: filtra (cuentas activas, filtro del formulario), etiqueta y conserva la selección
 * actual aunque ya no cumpla el filtro (así editar un registro antiguo no deja el campo en blanco ni lo cambia en silencio).
 */
export function opcionesDeCatalogo(tipo: TipoCatalogo, datos: ReadonlyArray<any>, o: OpcionesCatalogo): OpcionSelect[] {
  const etiquetar = o.etiquetar ?? ((i: unknown) => etiquetaDeCatalogo(tipo, i));
  const pasa = (i: any): boolean => {
    if (tipo === 'cuentas' && o.soloActivas && (i as ItemCuenta).activa === false) return false;
    return o.filtro ? o.filtro(i) : true;
  };
  const vistos = new Set<string>();
  const salida: OpcionSelect[] = [];
  for (const i of datos) {
    const conservar = valoresIguales(i.id, o.valorActual);
    if (!pasa(i) && !conservar) continue;
    if (vistos.has(String(i.id))) continue; // nunca dos opciones con el mismo id
    vistos.add(String(i.id));
    salida.push({ valor: i.id, etiqueta: etiquetar(i), detalle: detalleDeCatalogo(tipo, i) });
  }
  return salida;
}
