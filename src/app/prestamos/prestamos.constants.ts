import { DireccionPrestamo, EstadoAprobacion, EstadoCorte, MetodoPrestamo, PrestamoDetalle } from '../modelos/cobros';

export const METODOS_PRESTAMO: readonly MetodoPrestamo[] = ['Nequi', 'Fisico', 'Pago Fernando', 'Prestamo Fernando', 'Domicilio', 'Otros'];

export const DIRECCIONES_PRESTAMO: ReadonlyArray<{ valor: DireccionPrestamo; etiqueta: string }> = [
  { valor: 'POR_COBRAR', etiqueta: 'Por cobrar (me deben)' },
  { valor: 'POR_PAGAR', etiqueta: 'Por pagar (yo debo)' },
];

export const ESTADOS_CORTE: ReadonlyArray<{ valor: EstadoCorte; etiqueta: string }> = [
  { valor: 'ACTIVO', etiqueta: 'Activo' },
  { valor: 'FUTURO', etiqueta: 'Futuro' },
  { valor: 'PASADO', etiqueta: 'Pasado' },
];

export type ClaseBadge = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Clase de color del badge de estado de un préstamo (los literales son los del legacy: `Pendiente`, `Pagado`…). */
export function claseEstadoPrestamo(estado: string | null | undefined): ClaseBadge {
  switch ((estado ?? '').toLowerCase()) {
    case 'pagado':
      return 'success';
    case 'pendiente':
      return 'warning';
    case 'anulado':
    case 'vencido':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function claseEstadoAprobacion(estado: EstadoAprobacion | string | null | undefined): ClaseBadge {
  return estado === 'Aprobado' ? 'success' : estado === 'Rechazado' ? 'danger' : 'warning';
}

export function claseEstadoCorte(estado: EstadoCorte | string | null | undefined): ClaseBadge {
  return estado === 'ACTIVO' ? 'success' : estado === 'FUTURO' ? 'info' : 'neutral';
}

export function etiquetaEstadoCorte(estado: string | null | undefined): string {
  return ESTADOS_CORTE.find((e) => e.valor === estado)?.etiqueta ?? (estado || '—');
}

export function estaPendiente(p: Pick<PrestamoDetalle, 'estado'>): boolean {
  return (p.estado ?? '').toLowerCase() === 'pendiente';
}

/** Lo que falta por cobrar: el saldo si lo hay; si no, el valor completo mientras siga pendiente. */
export function saldoDe(p: Pick<PrestamoDetalle, 'estado' | 'saldoPendiente' | 'valorPrestado'>): number {
  if (p.saldoPendiente !== null && p.saldoPendiente !== undefined) return Number(p.saldoPendiente);
  return estaPendiente(p) ? Number(p.valorPrestado) : 0;
}

export interface ResumenAprobaciones {
  total: number;
  pendientes: number;
  rechazadas: number;
}

export function resumirAprobaciones(p: Pick<PrestamoDetalle, 'aprobaciones'>): ResumenAprobaciones {
  const lista = p.aprobaciones ?? [];
  return {
    total: lista.length,
    pendientes: lista.filter((a) => a.estado === 'Pendiente').length,
    rechazadas: lista.filter((a) => a.estado === 'Rechazado').length,
  };
}
