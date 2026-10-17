import { ItemCategoria, ItemCuenta, ItemPersona, ItemTarjeta, OpcionSelect, TipoCatalogo } from '../../../modelos/catalogos';

export const TEXTO_CATALOGO: Record<TipoCatalogo, { vacio: string; cargando: string }> = {
  personas: { vacio: 'No hay personas registradas.', cargando: 'Cargando personas…' },
  tarjetas: { vacio: 'No hay tarjetas registradas.', cargando: 'Cargando tarjetas…' },
  cuentas: { vacio: 'No hay cuentas registradas.', cargando: 'Cargando cuentas…' },
  categorias: { vacio: 'No hay categorías registradas.', cargando: 'Cargando categorías…' },
};

export const GRUPO_ACTIVAS = 'Activas';
export const GRUPO_HISTORICAS = 'Históricas / Reemplazadas';
export const GRUPO_FRECUENTES = 'Frecuentes';
export const GRUPO_TODAS = 'Todas las personas';

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

/** Texto secundario de cada elemento (se muestra junto a la etiqueta en la lista). */
export function detalleDeCatalogo(tipo: TipoCatalogo, item: unknown): string | undefined {
  if (tipo === 'cuentas') {
    const c = item as ItemCuenta;
    return c.moneda && c.moneda !== 'COP' ? c.moneda : undefined;
  }
  if (tipo === 'tarjetas') {
    const t = item as ItemTarjeta;
    const anteriores = t.plasticos.filter((p) => p.ultimos4 !== t.ultimos4Activo).map((p) => `··${p.ultimos4}`);
    return anteriores.length > 0 ? `antes ${anteriores.join(', ')}` : undefined;
  }
  return undefined;
}

/** Lo que también se busca en cada elemento (no se muestra): terminaciones de todos los plásticos, alias, banco, tipo de producto… */
export function busquedaDeCatalogo(tipo: TipoCatalogo, item: unknown): string | undefined {
  switch (tipo) {
    case 'tarjetas': {
      const t = item as ItemTarjeta;
      return [t.plasticos.map((p) => p.ultimos4).join(' '), t.ultimos4Activo, t.alias, t.franquicia, t.descripcion, t.tipo === 'DEBITO' ? 'débito debito' : 'crédito credito'].filter(Boolean).join(' ');
    }
    case 'cuentas': {
      const c = item as ItemCuenta;
      return [c.ultimos4, c.bancoEntidad, c.tipoCuenta, 'cuenta'].filter(Boolean).join(' ');
    }
    case 'personas': {
      const p = item as ItemPersona;
      return [p.iniciales, p.email, p.celular].filter(Boolean).join(' ') || undefined;
    }
    case 'categorias':
      return (item as ItemCategoria).tipo || undefined;
  }
}

/** Una tarjeta es «histórica» si todos sus plásticos ya no están vigentes o es el producto «sin número». */
export function esTarjetaHistorica(t: ItemTarjeta): boolean {
  return !!t.esGenerica || (t.plasticos.length > 0 && !t.plasticos.some((p) => p.esActivo));
}

/** Encabezado del grupo en el que se lista el elemento (`undefined` = sin grupo). Las listas con un solo grupo no muestran encabezados. */
export function grupoDeCatalogo(tipo: TipoCatalogo, item: unknown): string | undefined {
  if (tipo === 'tarjetas') return esTarjetaHistorica(item as ItemTarjeta) ? GRUPO_HISTORICAS : GRUPO_ACTIVAS;
  if (tipo === 'cuentas') {
    const c = item as ItemCuenta;
    return c.activa === false || c.esGenerica ? GRUPO_HISTORICAS : GRUPO_ACTIVAS;
  }
  if (tipo === 'categorias') {
    const t = (item as ItemCategoria).tipo;
    return t === 'INGRESO' ? 'Ingresos' : t === 'EGRESO' ? 'Egresos' : undefined;
  }
  return undefined;
}

export interface OpcionesCatalogo {
  filtro: ((item: any) => boolean) | null;
  etiquetar: ((item: any) => string) | null;
  soloActivas: boolean;
  /** Tarjetas: ofrecer también las de débito (por defecto no: las compras, los extractos y los pagos son de crédito). */
  incluirDebito?: boolean;
  /** Personas: ids que van primero (los más usados), en ese orden; el resto de personas sigue debajo. */
  frecuentes?: ReadonlyArray<number> | null;
  /** La selección actual: si el filtro la descartaría (p. ej. cuenta inactiva) se conserva igualmente. */
  valorActual: number | string | null;
}

/**
 * Opciones de un selector a partir de un catálogo: filtra (cuentas activas, filtro del formulario), etiqueta, agrupa («Activas» /
 * «Históricas»; «Frecuentes» / «Todas» en personas) y conserva la selección actual aunque ya no cumpla el filtro (así editar un
 * registro antiguo no deja el campo en blanco ni lo cambia en silencio).
 */
export function opcionesDeCatalogo(tipo: TipoCatalogo, datos: ReadonlyArray<any>, o: OpcionesCatalogo): OpcionSelect[] {
  const etiquetar = o.etiquetar ?? ((i: unknown) => etiquetaDeCatalogo(tipo, i));
  const pasa = (i: any): boolean => {
    if (tipo === 'cuentas' && o.soloActivas && (i as ItemCuenta).activa === false) return false;
    if (tipo === 'tarjetas' && !o.incluirDebito && (i as ItemTarjeta).tipo === 'DEBITO') return false;
    return o.filtro ? o.filtro(i) : true;
  };
  const vistos = new Set<string>();
  const salida: OpcionSelect[] = [];
  for (const i of datos) {
    const conservar = valoresIguales(i.id, o.valorActual);
    if (!pasa(i) && !conservar) continue;
    if (vistos.has(String(i.id))) continue; // nunca dos opciones con el mismo id
    vistos.add(String(i.id));
    salida.push({ valor: i.id, etiqueta: etiquetar(i), detalle: detalleDeCatalogo(tipo, i), busqueda: busquedaDeCatalogo(tipo, i), grupo: grupoDeCatalogo(tipo, i) });
  }
  const ordenadas = tipo === 'personas' && o.frecuentes && o.frecuentes.length > 0 ? ordenarConFrecuentes(salida, o.frecuentes) : salida;
  return ordenadas.map((x) => quitarVacios(x));
}

/** Las personas más usadas primero (en el orden dado) bajo «Frecuentes» y todas las demás debajo: nadie queda fuera de la lista. */
export function ordenarConFrecuentes(opciones: OpcionSelect[], frecuentes: ReadonlyArray<number>): OpcionSelect[] {
  const posicion = new Map(frecuentes.map((id, i) => [String(id), i]));
  const frecuentesPresentes = opciones.filter((x) => posicion.has(String(x.valor))).sort((a, b) => posicion.get(String(a.valor))! - posicion.get(String(b.valor))!);
  const resto = opciones.filter((x) => !posicion.has(String(x.valor)));
  if (frecuentesPresentes.length === 0) return opciones;
  return [...frecuentesPresentes.map((x) => ({ ...x, grupo: GRUPO_FRECUENTES })), ...resto.map((x) => ({ ...x, grupo: resto.length > 0 ? GRUPO_TODAS : undefined }))];
}

const quitarVacios = (o: OpcionSelect): OpcionSelect => {
  const r: OpcionSelect = { valor: o.valor, etiqueta: o.etiqueta };
  if (o.detalle) r.detalle = o.detalle;
  if (o.busqueda) r.busqueda = o.busqueda;
  if (o.grupo) r.grupo = o.grupo;
  if (o.deshabilitada) r.deshabilitada = o.deshabilitada;
  return r;
};
