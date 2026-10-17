import { AccionObjecion, MetodoPagoPublico, ObjecionPublica, ReportePublico, TipoMetodoPago } from '../modelos/cobros-personas';
import { aCentavos } from '../shared/dinero.helper';
import { moneda } from '../shared/moneda.util';

/** Lógica pura de la fase 6 del enlace de cobro: medios de pago, abono parcial y resolución de observaciones. */

// ───────────────────────────── medios de pago ─────────────────────────────

export interface OpcionMetodoPago {
  valor: TipoMetodoPago;
  etiqueta: string;
  icono: string;
  /** Lo que se escribe en «Número». */
  numeroEtiqueta: string;
  numeroEjemplo: string;
}

export const TIPOS_METODO_PAGO: ReadonlyArray<OpcionMetodoPago> = [
  { valor: 'CUENTA_AHORROS', etiqueta: 'Cuenta de ahorros', icono: 'account_balance', numeroEtiqueta: 'Número de cuenta', numeroEjemplo: '123-456789-01' },
  { valor: 'CUENTA_CORRIENTE', etiqueta: 'Cuenta corriente', icono: 'account_balance', numeroEtiqueta: 'Número de cuenta', numeroEjemplo: '123-456789-01' },
  { valor: 'NEQUI', etiqueta: 'Nequi', icono: 'smartphone', numeroEtiqueta: 'Celular', numeroEjemplo: '300 123 4567' },
  { valor: 'DAVIPLATA', etiqueta: 'Daviplata', icono: 'smartphone', numeroEtiqueta: 'Celular', numeroEjemplo: '310 123 4567' },
  { valor: 'LLAVE', etiqueta: 'Llave Bre-B / Transfiya', icono: 'key', numeroEtiqueta: 'Llave (celular, correo o alias)', numeroEjemplo: '@felipe123' },
  { valor: 'OTRO', etiqueta: 'Otro', icono: 'payments', numeroEtiqueta: 'Número o dato para pagar', numeroEjemplo: '' },
];

export const ENTIDADES_SUGERIDAS: ReadonlyArray<string> = ['Bancolombia', 'Nequi', 'Daviplata', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco Caja Social', 'Nu', 'Lulo Bank', 'Transfiya', 'Bre-B'];

const opcionMetodo = (tipo: string | null | undefined): OpcionMetodoPago | undefined => TIPOS_METODO_PAGO.find((x) => x.valor === tipo);
export const etiquetaMetodoPago = (tipo: string | null | undefined): string => opcionMetodo(tipo)?.etiqueta ?? 'Medio de pago';
export const iconoMetodoPago = (tipo: string | null | undefined): string => opcionMetodo(tipo)?.icono ?? 'payments';

/** Mensaje de error si el número no sirve para ese tipo de medio (`null` = bien). Espejo de `errorDeNumeroMetodo` del servidor. */
export function errorDeNumeroMetodo(tipo: TipoMetodoPago | string | null | undefined, numero: string | null | undefined): string | null {
  const n = (numero ?? '').trim();
  if (n.length < 3) return 'Escribe el número, celular o llave';
  const digitos = n.replace(/[\s-]/g, '');
  switch (tipo) {
    case 'CUENTA_AHORROS':
    case 'CUENTA_CORRIENTE':
      return /^\d{6,25}$/.test(digitos) ? null : 'El número de cuenta debe tener entre 6 y 25 dígitos';
    case 'NEQUI':
    case 'DAVIPLATA':
      return /^(\+?57)?3\d{9}$/.test(digitos) ? null : 'El celular debe tener 10 dígitos y empezar por 3 (ej. 300 123 4567)';
    case 'LLAVE':
      return /^[\w.+@:-]{3,60}$/u.test(n.replace(/\s/g, '')) ? null : 'La llave solo puede tener letras, números y . + @ : -';
    default:
      return null;
  }
}

/** Cómo se lee el número en pantalla: celulares `300 123 4567`, cuentas sin separadores en grupos de 4; lo demás tal cual. */
export function numeroLegible(tipo: string | null | undefined, numero: string | null | undefined): string {
  const n = (numero ?? '').trim();
  const digitos = n.replace(/[\s-]/g, '');
  if ((tipo === 'NEQUI' || tipo === 'DAVIPLATA') && /^3\d{9}$/.test(digitos)) return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
  if ((tipo === 'CUENTA_AHORROS' || tipo === 'CUENTA_CORRIENTE') && /^\d{6,25}$/.test(n)) return n.replace(/(\d{4})(?=\d)/g, '$1 ');
  return n;
}

/** Lo que se copia al pulsar «Copiar número»: sin espacios, guiones ni +57 en cuentas y celulares (se pega directo en la app del banco). */
export function textoACopiar(m: Pick<MetodoPagoPublico, 'tipo' | 'numero'>): string {
  const n = m.numero.trim();
  if (m.tipo === 'LLAVE' || m.tipo === 'OTRO') return n;
  const digitos = n.replace(/[\s-]/g, '');
  return /^\+?\d+$/.test(digitos) ? digitos.replace(/^\+?57(?=3\d{9}$)/, '').replace(/^\+/, '') : n;
}

/** Color de cada tarjeta del estilo billetera (sin marcas: solo una paleta). */
export function claseMetodoPago(tipo: string | null | undefined): string {
  switch (tipo) {
    case 'NEQUI':
      return 'wallet--morado';
    case 'DAVIPLATA':
      return 'wallet--rojo';
    case 'LLAVE':
      return 'wallet--verde';
    case 'CUENTA_CORRIENTE':
      return 'wallet--grafito';
    case 'OTRO':
      return 'wallet--naranja';
    default:
      return 'wallet--azul';
  }
}

// ───────────────────────────── abono parcial ─────────────────────────────

export interface AnalisisMonto {
  tipo: 'vacio' | 'invalido' | 'total' | 'parcial' | 'exceso';
  /** Lo que quedaría por pagar tras este abono (solo en `parcial`). */
  restante: number;
  /** Lo que sobra respecto a lo que debe (solo en `exceso`). */
  exceso: number;
}

/** Compara lo que la persona dice que pagó con lo que debe: ¿todo, una parte o de más? */
export function analisisMonto(monto: number | string | null | undefined, saldo: number): AnalisisMonto {
  if (monto === null || monto === undefined || monto === '') return { tipo: 'vacio', restante: 0, exceso: 0 };
  const cts = aCentavos(monto);
  if (!(cts > 0)) return { tipo: 'invalido', restante: 0, exceso: 0 };
  const deuda = aCentavos(saldo);
  if (deuda <= 0) return { tipo: 'exceso', restante: 0, exceso: cts / 100 };
  if (cts === deuda) return { tipo: 'total', restante: 0, exceso: 0 };
  return cts < deuda ? { tipo: 'parcial', restante: (deuda - cts) / 100, exceso: 0 } : { tipo: 'exceso', restante: 0, exceso: (cts - deuda) / 100 };
}

/**
 * El aviso de pago rechazado que la persona todavía debe corregir: el más reciente, siempre que no haya después otro aviso
 * pendiente o aprobado (esos ya lo reemplazaron).
 */
export function reporteRechazadoReciente(reportes: ReadonlyArray<ReportePublico>): ReportePublico | null {
  const ordenados = [...reportes].sort((a, b) => b.id - a.id);
  const ultimo = ordenados.find((r) => r.estado === 'RECHAZADO');
  if (!ultimo) return null;
  return ordenados.some((r) => r.id > ultimo.id && r.estado !== 'RECHAZADO') ? null : ultimo;
}

// ───────────────────────────── observaciones y ajustes ─────────────────────────────

export interface OpcionAccion {
  valor: AccionObjecion;
  etiqueta: string;
  icono: string;
  ayuda: string;
  /** Solo aplica a una observación sobre un cobro (no sobre el total ni sobre un abono). */
  soloCobros: boolean;
}

export const ACCIONES_OBJECION: ReadonlyArray<OpcionAccion> = [
  { valor: 'MANTENER', etiqueta: 'Mantener el cobro', icono: 'gavel', ayuda: 'No cambia lo que debe; le explicas por qué.', soloCobros: false },
  { valor: 'AJUSTAR', etiqueta: 'Ajustar el monto', icono: 'edit', ayuda: 'Cobras menos por este rubro; la diferencia queda como descuento.', soloCobros: true },
  { valor: 'EXCLUIR', etiqueta: 'Excluir este cobro', icono: 'block', ayuda: 'No se le cobra este rubro (se descuenta completo).', soloCobros: true },
  { valor: 'DESCUENTO', etiqueta: 'Hacer un descuento', icono: 'sell', ayuda: 'Bajas lo que debe en general, sin tocar ningún rubro.', soloCobros: false },
];

/** Las acciones que tienen sentido para una observación (sobre el total o sobre un abono solo se mantiene o se descuenta). */
export function accionesPara(itemMonto: number | null): ReadonlyArray<OpcionAccion> {
  const esCobro = itemMonto !== null && itemMonto > 0;
  return ACCIONES_OBJECION.filter((a) => esCobro || !a.soloCobros);
}

export interface ResultadoDescuentoLocal {
  /** Cuánto se le descuenta (`null` si no se toca su saldo o si todavía falta un dato). */
  descuento: number | null;
  error: string | null;
}

/**
 * Vista previa de la resolución: cuánto se descontaría. Espejo de `descuentoDeResolucion` del servidor (que es el que manda).
 * `itemMonto` es lo que la persona veía en el rubro (`null` si objetó el total); `saldo`, lo que debe hoy.
 */
export function descuentoDeAccion(accion: AccionObjecion, itemMonto: number | null, monto: number | string | null | undefined, saldo: number): ResultadoDescuentoLocal {
  const sinMonto = monto === null || monto === undefined || monto === '';
  const item = itemMonto === null ? null : aCentavos(itemMonto);
  switch (accion) {
    case 'MANTENER':
      return { descuento: null, error: null };
    case 'AJUSTAR': {
      if (item === null || item <= 0) return { descuento: null, error: 'Solo se puede ajustar el monto de un cobro (no de un abono ni del total).' };
      if (sinMonto) return { descuento: null, error: null };
      const nuevo = aCentavos(monto);
      if (nuevo < 0) return { descuento: null, error: 'El monto no puede ser negativo.' };
      if (nuevo >= item) return { descuento: null, error: `El monto nuevo debe ser menor a lo cobrado (${moneda(item / 100)}).` };
      return { descuento: (item - nuevo) / 100, error: null };
    }
    case 'EXCLUIR':
      if (item === null || item <= 0) return { descuento: null, error: 'Solo se puede excluir un cobro (no un abono ni el total).' };
      return { descuento: item / 100, error: null };
    case 'DESCUENTO': {
      if (sinMonto) return { descuento: null, error: null };
      const d = aCentavos(monto);
      if (d <= 0) return { descuento: null, error: 'El descuento debe ser mayor a 0.' };
      if (d > aCentavos(saldo)) return { descuento: null, error: `El descuento no puede pasar de lo que debe hoy (${moneda(saldo)}).` };
      return { descuento: d / 100, error: null };
    }
  }
}

/** Lo que la persona debería ver como saldo después del descuento. */
export function saldoTrasDescuento(saldo: number, descuento: number | null): number {
  return (aCentavos(saldo) - aCentavos(descuento ?? 0)) / 100;
}

export function etiquetaResolucion(r: string | null | undefined): string {
  return { MANTENIDA: 'Cobro mantenido', AJUSTADA: 'Monto ajustado', EXCLUIDA: 'Cobro excluido', DESCUENTO: 'Descuento aplicado' }[r ?? ''] ?? 'Resuelta';
}

export function tonoObjecion(o: Pick<ObjecionPublica, 'estado' | 'resolucion'>): 'warning' | 'success' | 'neutral' {
  if (o.estado === 'ABIERTA') return 'warning';
  return o.resolucion === 'MANTENIDA' ? 'neutral' : 'success';
}
