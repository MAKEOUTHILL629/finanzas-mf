// case class Prestamo(id: Int, fechaCreacion: Date, valorPrestado: Float, concepto: String, fechaCobro:Date, responsable: Int, estado: String, comentarios: String)

export class Prestamo {
  id?: number;
  fechaCreacion?: Date;
  valorPrestado?: number;
  concepto?: string;
  fechaCobro?: Date;
  responsable?: number;
  estado?: string;
  comentarios?: string;
}
