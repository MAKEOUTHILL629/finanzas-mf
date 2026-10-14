import { EstadoNotificacionCorreo, NotificacionCorreo } from '../modelos/erp';

export interface VistaCorreo {
  monto: number | null;
  moneda: string;
  comercio: string | null;
  tipo: string | null;
  metodo: string | null;
  ultimos4: string | null;
  instrumento: 'TC' | 'CUENTA' | null;
  ruta: string | null;
  motivo: string | null;
  linkCorreo: string | null;
}

/** Lee `datos_parseados` (que escribe el sync-batch o la ingesta) con valores por defecto seguros. */
export function interpretarCorreo(n: Pick<NotificacionCorreo, 'datos_parseados'>): VistaCorreo {
  const d = (n.datos_parseados ?? {}) as Record<string, unknown>;
  const monto = d['monto'] === null || d['monto'] === undefined || d['monto'] === '' ? null : Number(d['monto']);
  const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const instrumento = d['instrumento'] === 'TC' || d['instrumento'] === 'CUENTA' ? d['instrumento'] : null;
  return {
    monto: monto !== null && Number.isFinite(monto) ? monto : null,
    moneda: (texto(d['moneda']) ?? 'COP').toUpperCase(),
    comercio: texto(d['comercio']),
    tipo: texto(d['tipo']),
    metodo: texto(d['metodo']),
    ultimos4: texto(d['ultimos_4']),
    instrumento,
    ruta: texto(d['ruta']),
    motivo: texto(d['motivo']),
    linkCorreo: texto(d['linkCorreo']),
  };
}

/** Qué significa cada `motivo` que deja el backend cuando no pudo resolver el correo solo. */
const MOTIVOS: Record<string, string> = {
  tarjeta_no_identificada: 'No se pudo identificar la tarjeta (los últimos 4 dígitos no coinciden con ninguna). Elige la tarjeta para crear la compra.',
  cuenta_no_identificada: 'No se pudo identificar la cuenta (los últimos 4 dígitos no coinciden con ninguna). Elige la cuenta para registrar el movimiento.',
  cuenta_origen_no_identificada: 'No se pudo identificar la cuenta que pagó. Elige la cuenta.',
  trm_no_disponible: 'Es una compra en dólares y no hay una TRM disponible. Registra la compra a mano o configura una TRM.',
  tipo_o_metodo_no_reconocido: 'El tipo o el método del correo no se reconoció. Revísalo y regístralo a mano si aplica.',
  monto_invalido: 'No se pudo leer el monto del correo.',
  fecha_u_hora_invalida: 'No se pudo leer la fecha u hora del correo.',
  duplicado_de_pago_tarjeta_existente: 'Es el mismo pago de tarjeta que otro correo: se enlazó a la transacción existente.',
  pago_tarjeta_sin_tarjeta_identificada: 'Se descontó el pago de la cuenta, pero no se identificó qué tarjeta se pagó.',
  transaccion_confirmada_automaticamente: 'Se registró y confirmó automáticamente.',
  aviso_informativo_o_error_de_parseo: 'Aviso informativo o correo no interpretable: se ignoró.',
};

export function explicarMotivo(motivo: string | null | undefined): string | null {
  return motivo ? (MOTIVOS[motivo] ?? motivo) : null;
}

export const ESTADOS_CORREO: ReadonlyArray<{ valor: '' | EstadoNotificacionCorreo; etiqueta: string }> = [
  { valor: 'PENDIENTE', etiqueta: 'Por revisar' },
  { valor: 'CONCILIADO', etiqueta: 'Conciliados' },
  { valor: 'IGNORADO', etiqueta: 'Ignorados' },
  { valor: 'ERROR', etiqueta: 'Con error' },
  { valor: '', etiqueta: 'Todos' },
];

export function claseEstadoCorreo(estado: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  return estado === 'CONCILIADO' ? 'success' : estado === 'PENDIENTE' ? 'warning' : estado === 'ERROR' ? 'danger' : 'neutral';
}

export function etiquetaEstadoCorreo(estado: string | null | undefined): string {
  return { PENDIENTE: 'Por revisar', CONCILIADO: 'Conciliado', IGNORADO: 'Ignorado', ERROR: 'Con error' }[estado ?? ''] ?? (estado || '—');
}

/** ¿El correo describe un egreso que se puede convertir en préstamo por cobrar? */
export function admiteConvertirEnPrestamo(v: VistaCorreo): boolean {
  return v.ruta === 'EGRESO';
}
