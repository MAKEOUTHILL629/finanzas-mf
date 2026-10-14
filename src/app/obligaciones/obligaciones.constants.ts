import { MetodoAporte, TipoObligacionMes } from '../modelos/erp';

export interface OpcionTipoObligacion {
  valor: TipoObligacionMes;
  etiqueta: string;
  icono: string;
}

export const TIPOS_OBLIGACION: readonly OpcionTipoObligacion[] = [
  { valor: 'CUOTA_CARRO', etiqueta: 'Cuota del carro', icono: 'directions_car' },
  { valor: 'CUOTA_CASA', etiqueta: 'Cuota de la casa', icono: 'home' },
  { valor: 'OTRO', etiqueta: 'Otra obligación', icono: 'receipt_long' },
];

export const METODOS_APORTE: readonly MetodoAporte[] = [
  'Fisico',
  'Bancolombia',
  'Nequi',
  'Carrera',
  'Uso Carro',
  'Prestamo',
  'Pago Mensual',
  'Otro',
];

export function etiquetaTipoObligacion(tipo: string | null | undefined): string {
  return TIPOS_OBLIGACION.find((t) => t.valor === tipo)?.etiqueta ?? (tipo || 'Obligación');
}

export function iconoTipoObligacion(tipo: string | null | undefined): string {
  return TIPOS_OBLIGACION.find((t) => t.valor === tipo)?.icono ?? 'receipt_long';
}
