import { FAVORITOS_POR_DEFECTO, GrupoMenu, ItemMenu, MAX_FAVORITOS } from './menu.config';

/** Minúsculas y sin tildes: «Liquidación» y «liquidacion» son lo mismo para el buscador. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export interface ItemEnGrupo {
  grupo: GrupoMenu;
  item: ItemMenu;
}

/** Todos los ítems con su grupo, en el orden del menú. */
export function aplanar(grupos: GrupoMenu[]): ItemEnGrupo[] {
  return grupos.flatMap((grupo) => grupo.items.map((item) => ({ grupo, item })));
}

export function buscarItem(grupos: GrupoMenu[], id: string | null | undefined): ItemEnGrupo | null {
  return aplanar(grupos).find((x) => x.item.id === id) ?? null;
}

function sinParametros(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

function coincide(url: string, ruta: string): boolean {
  return url === ruta || url.startsWith(`${ruta}/`);
}

/**
 * Ítem al que pertenece la URL actual: la ruta más específica que la contiene como prefijo de segmentos
 * (`/prestamos/7` → Préstamos, pero `/pagos-mes-personas` NO es «Pagos del mes»). Incluye las rutas relacionadas.
 */
export function itemActivo(grupos: GrupoMenu[], url: string): ItemEnGrupo | null {
  const actual = sinParametros(url);
  let mejor: { x: ItemEnGrupo; largo: number } | null = null;
  for (const x of aplanar(grupos)) {
    for (const ruta of [x.item.ruta, ...(x.item.relacionadas ?? [])]) {
      if (coincide(actual, ruta) && (!mejor || ruta.length > mejor.largo)) mejor = { x, largo: ruta.length };
    }
  }
  return mejor?.x ?? null;
}

/** Etiqueta de la barra inferior del móvil. */
export function etiquetaCorta(item: ItemMenu): string {
  return item.corta ?? item.etiqueta;
}

/**
 * Puntaje de un ítem para una palabra: la etiqueta pesa más que las palabras clave y el grupo, y empezar por la
 * palabra (en la etiqueta o en una de sus palabras) pesa más que contenerla. 0 = no coincide.
 */
function puntajePalabra(item: ItemMenu, grupo: GrupoMenu, palabra: string): number {
  const etiqueta = normalizar(item.etiqueta);
  if (etiqueta.startsWith(palabra)) return 6;
  if (etiqueta.split(/\s+/).some((w) => w.startsWith(palabra))) return 5;
  if (etiqueta.includes(palabra)) return 4;
  const claves = normalizar(item.palabras);
  if (claves.split(/\s+/).some((w) => w.startsWith(palabra))) return 2;
  return `${claves} ${normalizar(grupo.titulo)}`.includes(palabra) ? 1 : 0;
}

/**
 * Búsqueda de secciones: deben coincidir TODAS las palabras escritas (en cualquier orden, sin importar tildes ni
 * mayúsculas) y el resultado va de más a menos relevante; a igual relevancia, el orden del menú.
 */
export function buscar(grupos: GrupoMenu[], consulta: string): ItemEnGrupo[] {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  return aplanar(grupos)
    .map((x, orden) => {
      const parciales = palabras.map((p) => puntajePalabra(x.item, x.grupo, p));
      const exacto = normalizar(x.item.etiqueta) === palabras.join(' ') ? 3 : 0;
      return { x, orden, puntaje: parciales.every((p) => p > 0) ? parciales.reduce((a, p) => a + p, exacto) : 0 };
    })
    .filter((r) => r.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje || a.orden - b.orden)
    .map((r) => r.x);
}

// ── favoritos ──

/**
 * Favoritos guardados → lista válida: solo ids que existen, sin repetir y como máximo `MAX_FAVORITOS`.
 * Si no hay nada utilizable se usan los de por defecto (que también se filtran por si cambió el menú).
 */
export function resolverFavoritos(guardados: unknown, grupos: GrupoMenu[]): string[] {
  const existentes = new Set(aplanar(grupos).map((x) => x.item.id));
  const limpiar = (lista: unknown[]): string[] => [...new Set(lista.filter((id): id is string => typeof id === 'string' && existentes.has(id)))].slice(0, MAX_FAVORITOS);
  if (Array.isArray(guardados)) return limpiar(guardados);
  return limpiar(FAVORITOS_POR_DEFECTO);
}

export interface ResultadoFavorito {
  favoritos: string[];
  /** true si se quiso añadir uno y ya hay `MAX_FAVORITOS`. */
  lleno: boolean;
}

/** Fija o desfija un ítem. Con la lista llena no añade (la persona debe quitar otro primero). */
export function alternarFavorito(favoritos: string[], id: string): ResultadoFavorito {
  if (favoritos.includes(id)) return { favoritos: favoritos.filter((f) => f !== id), lleno: false };
  if (favoritos.length >= MAX_FAVORITOS) return { favoritos, lleno: true };
  return { favoritos: [...favoritos, id], lleno: false };
}

/** Los favoritos como ítems (en el orden en que se fijaron). */
export function itemsFavoritos(grupos: GrupoMenu[], favoritos: string[]): ItemEnGrupo[] {
  return favoritos.map((id) => buscarItem(grupos, id)).filter((x): x is ItemEnGrupo => x !== null);
}
