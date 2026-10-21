/** Contrato Fase 7: `GET /obligaciones-aportes/carro/resumen-whatsapp`. */
export interface ResumenWhatsAppCarro {
  periodo: string;
  nombrePeriodoMes: string;
  responsable: { id: number; nombre: string | null; telefono?: string | null } | null;
  ultimoAporte: { fecha: string; aportante: string; monto: number; concepto: string | null } | null;
  resumenPeriodo: {
    nombrePeriodoMes: string;
    metaMes: number;
    totalRecaudadoMes: number;
    desglosePorPersona: Array<{ nombre: string; monto: number }>;
    excedenteAcumulado: number;
    saldoFaltanteMes: number;
  } | null;
}
