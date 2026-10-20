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
  /** Plástico con el que se pagó (solo se envía al registrar una compra retroactiva; el servidor lo deduce si no llega). */
  plasticoId?: number | null;
}

/**
 * Respuesta del backend NestJS: además del contrato legacy trae el modelo multimoneda (Supabase).
 * `valorCompra` siempre está en COP; las compras en USD traen su valor y TRM originales.
 * (Se mantiene aparte de `ComprasCredito` para no ampliar `keyof ComprasCredito` en las comparaciones de los formularios.)
 */
export interface ComprasCreditoMultimoneda extends ComprasCredito {
  monedaOriginal?: string;
  valorMonedaOriginal?: number | null;
  tasaCambioAplicada?: number | null;
  trmConfirmada?: boolean | null;
  /** Plástico guardado en la compra (las anteriores a esta función no lo tienen: el historial de la tarjeta lo deduce por fecha). */
  plasticoUltimos4?: string | null;
  /** La compra maestra que la unificó en un refinanciamiento (`null` = no fue unificada). */
  refinanciamientoId?: number | null;
  /** La compra ES la obligación nueva de un refinanciamiento. */
  esRefinanciamiento?: boolean;
  /** Capital pendiente que se llevó la obligación nueva (solo en las unificadas). */
  saldoRefinanciado?: number | null;
  /** `CAPITAL_FIJO` (compras normales) | `FRANCES` (cuota fija: los refinanciamientos creados por el asistente). */
  sistemaAmortizacion?: string;
  cuotaFijaPactada?: number | null;
  /** Tags transversales (Fase 2): slugs con '#'. */
  tags?: string[];
  comercioCanonico?: string | null;
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
  estado?: string | null;
  /** Mes de facturación (`YYYY-MM`) calculado por la BD según el día de corte de la tarjeta. */
  periodoFacturacion?: string | null;
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

export interface BalanceTarjeta {
  tarjeta: number;
  franquicia: string;
  total_saldo_restante: number;
}

export const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
