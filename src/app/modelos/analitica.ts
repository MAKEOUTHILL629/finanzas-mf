/** Contratos de `/api/v2/analitica` (Fase 2: tags y «Pregúntale a tu App»). */
export interface ResultadoConsultaAnalitica {
  pregunta: string;
  interpretacion: { tags: string[]; comercios: string[]; periodo: string | null };
  desde: string | null;
  hasta: string | null;
  total: number;
  operaciones: number;
  promedio: number;
  desglose: Array<{ clave: string; total: number; operaciones: number }>;
  detalle: Array<{ tipo: 'COMPRA_TC' | 'TRANSACCION'; id: number; fecha: string | null; descripcion: string; comercioCanonico: string | null; tags: string[]; monto: number }>;
}

export interface ResultadoRetag {
  registrosAnalizados: number;
  registrosEtiquetados: number;
  nuevosTagsDetectados: Record<string, number>;
  ventanasViaje: number;
}

export interface Etiqueta {
  id: number;
  slug: string;
  nombre: string;
  color: string | null;
  icono: string | null;
  tipo_agrupacion: string;
}
