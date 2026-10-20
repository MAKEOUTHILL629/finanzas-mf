/** Contratos Fase 4: cámara bilateral y eventos grupales. */
export interface ItemBilateral {
  id: number;
  fecha: string | null;
  concepto: string;
  origen: string;
  montoOriginalTotal: number | null;
  reglaDivision: '50_50' | '100_CONTRAPARTE' | 'PORCENTAJE_CUSTOM' | 'PRORRATA' | 'ABONO' | 'SALDO_ANTERIOR';
  porcentajeAplicado: number | null;
  montoImputado: number;
}

export interface LiquidacionBilateral {
  periodo: string;
  persona: { id: number; nombre: string | null };
  columnaUsuario: ItemBilateral[];
  columnaContraparte: ItemBilateral[];
  subtotalContraparte: number;
  subtotalUsuario: number;
  saldoAnterior: number;
  netoAEnviar: number;
  direccionNeto: 'CONTRAPARTE_ENVIA_A_USUARIO' | 'USUARIO_ENVIA_A_CONTRAPARTE' | 'PAZ_Y_SALVO';
}

export interface EventoGrupal {
  id: number;
  nombre: string;
  estado: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  participantes?: Array<{ id: number; persona_id: number; alias_bloque: string | null; peso_participacion: number; persona?: { nombre: string | null } }>;
}

export interface LiquidacionEvento {
  evento: { id: number; nombre: string; estado: string };
  totalEvento: number;
  balances: Array<{ participanteId: number; personaId: number; alias: string | null; totalAportado: number; leToca: number; balance: number }>;
  transferencias: Array<{ desdePersonaId: number; haciaPersonaId: number; monto: number }>;
  gastos: Array<{ id: number; descripcion: string; montoTotal: number; pagadoPorParticipanteId: number; tipoDivision: string }>;
}
