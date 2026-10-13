export interface Tarjeta{
  id?: number;
  fechaCreacion?: Date;
  franquicia?: string;
  descripcion?: string;
  tasaInteresCompra?: number | null;
  tasaInteresAvance?: number | null;
  cuotaManejo?: number | null;
  urlInfo?: string | null;
  ultimaActualizacionTasas?: string | null;
  extractTasas?: boolean;
}
