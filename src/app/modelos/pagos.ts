export interface PagoMensualPersona{
  persona: number,
  fecha: Date,
  valorPago: number
}

export interface PagoMensualPersonaDetalle{
  persona: number,
  compraCredito: number,
  concepto: string,
  porcentaje: number,
  cantidadCuotaTotal: number,
  numeroCuota: number,
  fechaPago: Date,
  valorPagoCuota: number,
  valorPagoResponsable: number,
  tarjeta: number,
  estado: string,
  interesPagado: number,
  aporteCapital: number,
  saldoRestante: number
}

export interface PagoMensualTarjetaDetalle{
  id: number,
  numeroCuota: number,
  numeroCuotasTotal: number,
  fechaPago: Date,
  saldoRestante: number,
  interesPagado: number,
  aporteCapital: number,
  pagoTotal: number,
  compra: number,
  estado: string,
  tarjeta: number,
  concepto: string,
}
