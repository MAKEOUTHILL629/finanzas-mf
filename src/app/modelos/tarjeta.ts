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
  // Campos del esquema Supabase (el backend NestJS los devuelve además del contrato legacy)
  diaCorte?: number | null;
  diaLimitePago?: number | null;
  cupoTotal?: number | null;
  permiteDolares?: boolean | null;
}
