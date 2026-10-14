/**
 * Motor unificado de persistencia de estado de filtros, ordenamiento y cálculos de tablas.
 */

export class FilterStateStorage {
  private static readonly PREFIX = 'finanzas_filter_state_';

  /**
   * Guarda el estado de filtros de una vista en sessionStorage de forma segura.
   */
  static saveState<T extends Record<string, unknown>>(viewKey: string, state: T): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }
    try {
      const storageKey = `${this.PREFIX}${viewKey}`;
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignorar errores si storage está deshabilitado o lleno
    }
  }

  /**
   * Recupera el estado de filtros guardado o devuelve el estado por defecto.
   */
  static loadState<T extends Record<string, unknown>>(viewKey: string, defaultState: T): T {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return defaultState;
    }
    try {
      const storageKey = `${this.PREFIX}${viewKey}`;
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return defaultState;
      }
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch {
      return defaultState;
    }
  }

  /**
   * Limpia el estado de filtros de una vista.
   */
  static clearState(viewKey: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }
    try {
      const storageKey = `${this.PREFIX}${viewKey}`;
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }
}

/**
 * Realiza sumatorias seguras sobre colecciones numéricas evitando errores de punto flotante y NaN.
 */
export function sumByField<T>(
  items: T[],
  selector: (item: T) => number | string | null | undefined
): number {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  const rawTotal = items.reduce((acc, curr) => {
    const rawVal = selector(curr);
    let numVal = 0;
    if (typeof rawVal === 'number') {
      numVal = isNaN(rawVal) ? 0 : rawVal;
    } else if (typeof rawVal === 'string') {
      const cleaned = rawVal.replace(/[^0-9.-]/g, '');
      numVal = parseFloat(cleaned) || 0;
    }
    return acc + numVal;
  }, 0);

  // Redondeo seguro a 2 decimales para evitar problemas de precisión en JS
  return Math.round((rawTotal + Number.EPSILON) * 100) / 100;
}

/**
 * Ordenador inmutable para colecciones por clave o extractor personalizado.
 */
export function sortCollection<T>(
  items: T[],
  columnOrExtractor: keyof T | ((item: T) => unknown),
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items].sort((a, b) => {
    const valA = typeof columnOrExtractor === 'function' ? columnOrExtractor(a) : a[columnOrExtractor];
    const valB = typeof columnOrExtractor === 'function' ? columnOrExtractor(b) : b[columnOrExtractor];

    if (valA === valB) return 0;
    if (valA === undefined || valA === null) return direction === 'asc' ? 1 : -1;
    if (valB === undefined || valB === null) return direction === 'asc' ? -1 : 1;

    // Comparación de fechas
    if (valA instanceof Date && valB instanceof Date) {
      const diff = valA.getTime() - valB.getTime();
      return direction === 'asc' ? diff : -diff;
    }

    // Comparación numérica
    if (typeof valA === 'number' && typeof valB === 'number') {
      return direction === 'asc' ? valA - valB : valB - valA;
    }

    // Comparación de strings con soporte de localización
    const strA = String(valA);
    const strB = String(valB);
    const comp = strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' });
    return direction === 'asc' ? comp : -comp;
  });
}
