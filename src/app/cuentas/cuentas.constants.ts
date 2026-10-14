import { TipoCategoria, TipoCuentaFinanciera } from '../modelos/erp';

export const TIPOS_CUENTA: ReadonlyArray<{ valor: TipoCuentaFinanciera; etiqueta: string; icono: string }> = [
  { valor: 'AHORROS', etiqueta: 'Cuenta de ahorros', icono: 'savings' },
  { valor: 'CORRIENTE', etiqueta: 'Cuenta corriente', icono: 'account_balance' },
  { valor: 'BILLETERA_DIGITAL', etiqueta: 'Billetera digital', icono: 'smartphone' },
  { valor: 'EFECTIVO', etiqueta: 'Efectivo', icono: 'payments' },
];

export const TIPOS_CATEGORIA: ReadonlyArray<{ valor: TipoCategoria; etiqueta: string; icono: string }> = [
  { valor: 'EGRESO', etiqueta: 'Egresos', icono: 'trending_down' },
  { valor: 'INGRESO', etiqueta: 'Ingresos', icono: 'trending_up' },
  { valor: 'AMBOS', etiqueta: 'Ambos', icono: 'swap_vert' },
];

/** Un grupo de 4 dígitos o varios separados por coma/espacio (cuenta + tarjeta débito): igual que el backend. */
export const PATRON_ULTIMOS_4 = /^\d{4}(?:\s*[,;\s]\s*\d{4})*$/;

export function etiquetaTipoCuenta(tipo: string | null | undefined): string {
  return TIPOS_CUENTA.find((t) => t.valor === tipo)?.etiqueta ?? (tipo || 'Cuenta');
}

export function iconoTipoCuenta(tipo: string | null | undefined): string {
  return TIPOS_CUENTA.find((t) => t.valor === tipo)?.icono ?? 'account_balance_wallet';
}

/** `3698,4278` → `••3698 ••4278` (solo para mostrar). */
export function enmascarar4(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor
    .split(/[,;\s]+/)
    .filter((v) => v.length > 0)
    .map((v) => `••${v}`)
    .join(' ');
}

/** Categorías que se ofrecen crear cuando el usuario aún no tiene ninguna (nada se crea sin su confirmación). */
export const CATEGORIAS_SUGERIDAS: ReadonlyArray<{ nombre: string; tipo: TipoCategoria; color: string }> = [
  { nombre: 'Alimentación', tipo: 'EGRESO', color: '#FF9500' },
  { nombre: 'Transporte', tipo: 'EGRESO', color: '#0071E3' },
  { nombre: 'Vivienda y servicios', tipo: 'EGRESO', color: '#5856D6' },
  { nombre: 'Salud', tipo: 'EGRESO', color: '#FF3B30' },
  { nombre: 'Educación', tipo: 'EGRESO', color: '#00A3BF' },
  { nombre: 'Entretenimiento', tipo: 'EGRESO', color: '#AF52DE' },
  { nombre: 'Compras personales', tipo: 'EGRESO', color: '#FF2D55' },
  { nombre: 'Salario', tipo: 'INGRESO', color: '#34C759' },
  { nombre: 'Otros ingresos', tipo: 'INGRESO', color: '#30B0C7' },
];
