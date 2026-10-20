/** Contratos Fase 5: cuotas colaborativas de una compra en tarjeta de tercero. */
export interface CuotaColaborativa {
  cuotaDetalleId: number;
  numeroCuota: number | null;
  numeroCuotasTotal: number;
  fechaPago: string | null;
  estadoCuota: string | null;
  valorCuota: number;
  totalAportesTerceros: number;
  miAporteBolsilloNeto: number;
  montoPorEntregarATitular: number;
  entregadoATitular: number;
  estadoPagoTitular: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
  aportes: Array<{ id: number; aportantePersonaId: number; aportanteNombre: string | null; monto: number; fecha: string | null; modalidad: string; observaciones: string | null }>;
}

export interface DetalleCuotasColaborativas {
  compra: { id: number; concepto: string | null; valorCompra: number; esTarjetaTercero: boolean; titularPersonaId: number | null; tarjeta: string | null };
  cuotas: CuotaColaborativa[];
}
