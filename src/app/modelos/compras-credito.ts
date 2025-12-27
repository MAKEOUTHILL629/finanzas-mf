export interface ComprasCredito {
  id?: number;
  fechaCreacion?: Date;
  concepto?: string;
  valorCompra?: number;
  fechaCompra?: Date;
  numeroCuotas?: number;
  fechaUltimaCuota?: Date;
  pagoMensual?: number;
  interes?: number;
  descripcion?: string;
  estado?: string;
  tarjeta?: number
  responsables?: string;
  porcentajePago?: number;
}


export  type SortableFields = 'id' | 'concepto' | 'valorCompra' | 'fechaCompra' | 'numeroCuotas' |
'fechaUltimaCuota' | 'pagoMensual' | 'interes' | 'descripcion' | 'estado' | 'tarjeta' | 'responsables';

export interface ColumnasCompraCredito{
  columna:SortableFields;
  titulo:string;
}


export interface CuotaDetalle {
  id?: number;
  numeroCuota?: number;
  fechaPago?: Date;
  saldoRestante?: number;
  interesPagado?: number;
  aporteCapital?: number;
  pagoTotal?: number;
  compra?: number;
}


export interface ResponsableCompraCredito{

  id?: number;
  fechaCreacion?: Date;
  persona?: number;
  porcentajePago: number;
  cantidadPago: number;
  cantidadCuotas: number;
  comprasCredito?: number;
}

export interface MesPagoTarjeta{
  valorPago: number;
  tarjeta: number;
  fechaPago: Date;
}


export const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
