import { ItemCuenta, ItemTarjeta, OpcionSelect } from '../../../modelos/catalogos';
import { etiquetaDeCatalogo } from '../select/select.helpers';

/**
 * Un «producto» es una tarjeta (de crédito o de débito) o una cuenta. Los selectores que mezclan ambos usan una clave de texto
 * (`t:12`, `c:3`) porque un mismo número puede ser el id de una tarjeta y el de una cuenta.
 */
export type TipoProducto = 'TARJETA' | 'CUENTA';
export interface ProductoElegido {
  tipo: TipoProducto;
  id: number;
}

export const GRUPO_CREDITO = 'Tarjetas de crédito';
export const GRUPO_DEBITO = 'Tarjetas de débito';
export const GRUPO_CUENTAS = 'Cuentas';

export const claveProducto = (tipo: TipoProducto, id: number): string => `${tipo === 'TARJETA' ? 't' : 'c'}:${id}`;

/** `t:12` → `{ TARJETA, 12 }`; cualquier otra cosa → `null`. */
export function parsearProducto(clave: unknown): ProductoElegido | null {
  const m = /^([tc]):(\d+)$/.exec(String(clave ?? ''));
  if (!m) return null;
  const id = Number(m[2]);
  return id > 0 ? { tipo: m[1] === 't' ? 'TARJETA' : 'CUENTA', id } : null;
}

/** Los grupos de exactamente 4 dígitos de un texto como «3698, 4278» o «1927,9587». */
export function gruposDe4(texto: string | null | undefined): string[] {
  return (texto ?? '').split(/[^0-9]+/).filter((t) => t.length === 4);
}

export interface OpcionesProductos {
  /** Clave seleccionada: se conserva en la lista aunque el filtro la descartara (p. ej. una cuenta inactiva). */
  valorActual?: string | null;
  incluirCredito?: boolean;
  incluirDebito?: boolean;
  incluirCuentas?: boolean;
}

/**
 * Opciones del selector único de producto, en tres grupos: tarjetas de crédito, tarjetas de débito y cuentas. Cada tarjeta muestra
 * todos sus plásticos (el vigente y los anteriores) para que se reconozca por cualquier terminación, y la de débito a qué cuenta
 * pertenece.
 */
export function opcionesDeProductos(tarjetas: ReadonlyArray<ItemTarjeta>, cuentas: ReadonlyArray<ItemCuenta>, o: OpcionesProductos = {}): OpcionSelect[] {
  const incluirCredito = o.incluirCredito !== false;
  const incluirDebito = o.incluirDebito !== false;
  const incluirCuentas = o.incluirCuentas !== false;
  const credito: OpcionSelect[] = [];
  const debito: OpcionSelect[] = [];
  const delasCuentas: OpcionSelect[] = [];

  for (const t of tarjetas) {
    const esDebito = t.tipo === 'DEBITO';
    const clave = claveProducto('TARJETA', t.id);
    if (!(esDebito ? incluirDebito : incluirCredito) && clave !== o.valorActual) continue;
    const anteriores = t.plasticos.filter((p) => p.ultimos4 !== t.ultimos4Activo).map((p) => `··${p.ultimos4}`);
    const cuenta = esDebito && t.cuentaId ? cuentas.find((c) => c.id === t.cuentaId) : undefined;
    const detalle = [cuenta ? `cuenta ${cuenta.nombre}` : null, anteriores.length ? `antes ${anteriores.join(', ')}` : null].filter(Boolean).join(' · ');
    (esDebito ? debito : credito).push({ valor: clave, etiqueta: t.etiqueta || t.nombre, detalle: detalle || undefined, grupo: esDebito ? GRUPO_DEBITO : GRUPO_CREDITO });
  }
  for (const c of cuentas) {
    const clave = claveProducto('CUENTA', c.id);
    if (!incluirCuentas && clave !== o.valorActual) continue;
    if (c.activa === false && clave !== o.valorActual) continue;
    delasCuentas.push({ valor: clave, etiqueta: etiquetaDeCatalogo('cuentas', c), detalle: c.moneda && c.moneda !== 'COP' ? c.moneda : undefined, grupo: GRUPO_CUENTAS });
  }
  return [...credito, ...debito, ...delasCuentas]; // el orden de cada grupo es el del catálogo (vigentes primero)
}

type Clase = 'CREDITO' | 'DEBITO' | 'CUENTA';
interface Candidato {
  clave: string;
  clase: Clase;
  vigente: boolean;
}

/**
 * Producto al que pertenecen unos últimos 4 dígitos, mirando TODOS los plásticos de cada tarjeta (también los anteriores y los de
 * las de débito) y los de las cuentas. Un aviso de tarjeta de crédito solo puede ser de una de crédito; uno de cuenta, de la tarjeta
 * de débito (cuyo movimiento va a su cuenta) o de la cuenta. Si hay más de uno posible no adivina: devuelve `null`.
 */
export function productoPorUltimos4(
  ultimos4: string | null | undefined,
  tarjetas: ReadonlyArray<ItemTarjeta>,
  cuentas: ReadonlyArray<ItemCuenta>,
  instrumento?: 'TC' | 'CUENTA' | null,
): string | null {
  const n = (ultimos4 ?? '').trim();
  if (!/^\d{4}$/.test(n)) return null;

  const candidatos: Candidato[] = [];
  for (const t of tarjetas) {
    const coincidentes = t.plasticos.filter((p) => p.ultimos4 === n);
    const esElVigente = t.ultimos4Activo === n;
    if (coincidentes.length === 0 && !esElVigente) continue;
    candidatos.push({ clave: claveProducto('TARJETA', t.id), clase: t.tipo === 'DEBITO' ? 'DEBITO' : 'CREDITO', vigente: esElVigente || coincidentes.some((p) => p.esActivo) });
  }
  for (const c of cuentas) {
    if (gruposDe4(c.ultimos4).includes(n)) candidatos.push({ clave: claveProducto('CUENTA', c.id), clase: 'CUENTA', vigente: c.activa !== false });
  }

  const clases: Clase[] = instrumento === 'TC' ? ['CREDITO'] : instrumento === 'CUENTA' ? ['DEBITO', 'CUENTA'] : ['CREDITO', 'DEBITO', 'CUENTA'];
  for (const clase of clases) {
    const grupo = candidatos.filter((c) => c.clase === clase);
    if (grupo.length === 0) continue;
    if (grupo.length === 1) return grupo[0].clave;
    const vigentes = grupo.filter((c) => c.vigente);
    return vigentes.length === 1 ? vigentes[0].clave : null;
  }
  return null;
}

/** ¿La clave es de una tarjeta de crédito del catálogo? (una compra a cuotas, no un movimiento de cuenta). */
export function esTarjetaDeCredito(clave: string | null, tarjetas: ReadonlyArray<ItemTarjeta>): boolean {
  const p = parsearProducto(clave);
  if (!p || p.tipo !== 'TARJETA') return false;
  const t = tarjetas.find((x) => x.id === p.id);
  return !!t && t.tipo !== 'DEBITO';
}
