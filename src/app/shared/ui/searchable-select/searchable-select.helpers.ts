import { OpcionSelect } from '../../../modelos/catalogos';

/**
 * Lógica pura del selector buscable: cómo se busca, cómo se ordena lo encontrado y cómo se agrupa para pintarlo.
 */

/** Texto comparable: minúsculas, sin tildes y con todo lo que no sea letra o número convertido en espacio (así «*1927» y «··1927» buscan «1927»). */
export function normalizarBusqueda(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pajar(o: OpcionSelect): string {
  return normalizarBusqueda([o.etiqueta, o.detalle, o.busqueda, o.grupo].filter(Boolean).join(' '));
}

/** 0 = la etiqueta empieza por lo buscado; 1 = alguna de sus palabras; 2 = solo aparece en el detalle o en los datos extra. */
function puntaje(o: OpcionSelect, tokens: string[]): number {
  const etiqueta = normalizarBusqueda(o.etiqueta);
  const palabras = etiqueta.split(' ');
  if (etiqueta.startsWith(tokens[0])) return 0;
  return tokens.every((t) => palabras.some((p) => p.startsWith(t))) ? 1 : 2;
}

/**
 * Opciones que cumplen la búsqueda: TODAS las palabras escritas deben aparecer (en la etiqueta, el detalle, los datos extra o el
 * grupo), en cualquier orden. Sin búsqueda se devuelven tal cual. Los grupos conservan su orden; dentro de cada uno van primero
 * las que empiezan por lo escrito.
 */
export function filtrarOpciones(opciones: ReadonlyArray<OpcionSelect>, consulta: string): OpcionSelect[] {
  const tokens = normalizarBusqueda(consulta).split(' ').filter(Boolean);
  if (tokens.length === 0) return [...opciones];
  const candidatas = opciones
    .map((o, i) => ({ o, i, p: pajar(o) }))
    .filter((c) => tokens.every((t) => c.p.includes(t)))
    .map((c) => ({ ...c, puntaje: puntaje(c.o, tokens) }));
  const ordenGrupo = new Map<string, number>();
  for (const c of candidatas) if (!ordenGrupo.has(c.o.grupo ?? '')) ordenGrupo.set(c.o.grupo ?? '', ordenGrupo.size);
  return candidatas.sort((a, b) => ordenGrupo.get(a.o.grupo ?? '')! - ordenGrupo.get(b.o.grupo ?? '')! || a.puntaje - b.puntaje || a.i - b.i).map((c) => c.o);
}

/** Lo que se dibuja en la lista: encabezados de grupo y opciones (con su posición entre las opciones). */
export type FilaLista = { tipo: 'grupo'; nombre: string } | { tipo: 'opcion'; opcion: OpcionSelect; indice: number };

/** Intercala el encabezado de cada grupo (solo si hay más de uno: con un único grupo no aporta nada). */
export function filasDeLista(opciones: ReadonlyArray<OpcionSelect>): FilaLista[] {
  const grupos = new Set(opciones.map((o) => o.grupo ?? ''));
  const conEncabezados = grupos.size > 1;
  const filas: FilaLista[] = [];
  let anterior: string | null = null;
  opciones.forEach((opcion, indice) => {
    const grupo = opcion.grupo ?? '';
    if (conEncabezados && grupo !== anterior && grupo !== '') filas.push({ tipo: 'grupo', nombre: grupo });
    anterior = grupo;
    filas.push({ tipo: 'opcion', opcion, indice });
  });
  return filas;
}

/** Mueve la opción activa dentro de `[0, total)`; sin ninguna activa (`-1`) baja a la primera o sube a la última. */
export function moverActiva(actual: number, total: number, delta: number): number {
  if (total <= 0) return -1;
  if (actual < 0) return delta >= 0 ? 0 : total - 1;
  return Math.max(0, Math.min(total - 1, actual + delta));
}
