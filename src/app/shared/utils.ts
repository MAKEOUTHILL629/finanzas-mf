/**
 * Utilidades puras compartidas para la aplicación finanzas-mf.
 */

/**
 * Capitaliza la primera letra de un string y convierte el resto a minúsculas.
 */
export function capitalize(str: string): string {
  if (!str || str.length === 0) return str || '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Normaliza una cadena para búsquedas:
 * - Convierte a string seguro.
 * - Elimina espacios en los extremos y pasa a minúsculas.
 * - Remueve tildes y diacríticos (ej. "Crédito" -> "credito").
 */
export function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Evalúa si todos los términos (tokens) de una búsqueda coinciden con alguno de los campos provistos.
 * Permite búsquedas compuestas por varias palabras (ej. "banco 25000").
 */
export function matchesSearchFields(query: string | null | undefined, fields: unknown[]): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(token => token.length > 0);
  if (queryTokens.length === 0) {
    return true;
  }

  const normalizedFields = fields
    .map(field => normalizeSearchText(field))
    .filter(field => field.length > 0);

  // Cada token del query debe estar presente en al menos un campo del registro
  return queryTokens.every(token =>
    normalizedFields.some(field => field.includes(token))
  );
}

/**
 * Evalúa de forma uniforme si un valor coincide con un filtro exacto (selects de estado, tarjeta, persona).
 * Considera como comodín "sin filtro" los tokens provistos (ej. '', 'TODOS', '0', '-1').
 */
export function matchesExactFilter(
  itemValue: unknown,
  filterValue: unknown,
  allTokens: string[] = ['TODOS', 'TODAS', 'ALL', '', '-1', '0']
): boolean {
  if (filterValue === null || filterValue === undefined) {
    return true;
  }

  const strFilter = String(filterValue).trim();
  if (allTokens.some(token => token.toUpperCase() === strFilter.toUpperCase())) {
    return true;
  }

  if (itemValue === null || itemValue === undefined) {
    return false;
  }

  return String(itemValue).trim().toLowerCase() === strFilter.toLowerCase();
}

/**
 * Wrapper de conveniencia para evaluar si un objeto coincide con un texto de búsqueda extrayendo sus campos.
 */
export function matchesSearchQuery<T>(
  item: T,
  query: string | null | undefined,
  fieldsExtractor: (item: T) => unknown[]
): boolean {
  return matchesSearchFields(query, fieldsExtractor(item));
}
