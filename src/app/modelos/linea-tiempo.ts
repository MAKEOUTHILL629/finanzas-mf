/** Línea de tiempo de productos financieros (`GET /api/productos-financieros/linea-tiempo`). */

export type TipoProducto = 'CREDITO' | 'DEBITO' | 'CUENTA';
export type EstadoProducto = 'ACTIVA' | 'INACTIVA' | 'REEMPLAZADA';

export interface ProductoLineaTiempo {
  /** `plastico:12` · `tarjeta:3` · `cuenta:7` */
  clave: string;
  tipo: TipoProducto;
  /** «Crédito *1927», «Débito *7992», «Cuenta *3698», «Crédito (sin número)». */
  etiqueta: string;
  /** Franquicia / banco / alias. */
  detalle: string;
  ultimos4: string | null;
  estado: EstadoProducto;
  /** Producto «sin número»: agrupa los avisos del banco que no traen dígitos. */
  generica: boolean;
  /** `yyyy-MM-dd`; `null` = sin fecha conocida. */
  desde: string | null;
  /** `null` = sigue en uso. */
  hasta: string | null;
  /** Cantidad de movimientos y de dónde sale la cifra (la fuente con más registros). */
  movimientos: number;
  monto: number;
  fuente: 'REGISTROS' | 'AVISOS' | 'NINGUNA';
  compras: number;
  transacciones: number;
  avisos: number;
  primerUso: string | null;
  ultimoUso: string | null;
  tarjetaId: number | null;
  plasticoId: number | null;
  cuentaId: number | null;
}

export interface LineaTiempo {
  desde: string;
  hasta: string;
  productos: ProductoLineaTiempo[];
  totales: { productos: number; activos: number; movimientos: number; monto: number };
}
