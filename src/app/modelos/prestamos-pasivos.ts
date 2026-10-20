/** Contratos Fase 6: abonos a préstamos POR_PAGAR y portal del acreedor. */
export interface ResultadoAbonoPasivo {
  abonoId: number;
  prestamoId: number;
  montoPagado: number;
  cuentaDestinoDetalle: string | null;
  fechaHoraPago: string;
  transaccionId: number | null;
  conComprobante: boolean;
  tokenConsultaPublica: string | null;
  acreedor: string | null;
  valorInicial: number;
  totalAbonado: number;
  saldoPendiente: number;
  pagadoTotalmente: boolean;
}

export interface AbonoPasivo {
  id: number;
  monto: number;
  fechaHoraPago: string;
  cuentaDestinoDetalle: string | null;
  cuentaOrigenId: number | null;
  comprobanteNombre: string | null;
  conComprobante: boolean;
  transaccionId: number | null;
  observaciones: string | null;
}

export interface PortalAcreedor {
  tipo: 'PORTAL_ACREEDOR';
  estadoPrestamo: 'PAGADO TOTALMENTE' | 'ABONO_PARCIAL_REALIZADO';
  concepto: string | null;
  acreedor: string | null;
  valorInicial: number;
  totalAbonado: number;
  saldoPendiente: number;
  fechaCompromisoPago: string | null;
  cuentaDestinoTercero: string | null;
  ultimoPago: { monto: number; fechaHoraPago: string; cuentaDestinoDetalle: string | null; conComprobante: boolean; comprobanteUrl: string | null } | null;
  historialAbonos: Array<{ id: number; monto: number; fechaHoraPago: string; cuentaDestinoDetalle: string | null; conComprobante: boolean; comprobanteUrl: string | null }>;
}
