export interface Persona {
  id?: number;
  fechaCreacion?: Date;
  nombre: string;
  inicialesNombre? : string;
  colorRepresentativo?: string;
  // Esquema Supabase
  email?: string | null;
  numeroCelular?: string | null;
  /** Usuario de la app enlazado a esta persona (quien puede aprobar/rechazar sus préstamos). */
  linkedUserId?: number | null;
}
