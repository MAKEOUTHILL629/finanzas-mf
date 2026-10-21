/**
 * Modelos del módulo ERP (Supabase) expuestos por el backend NestJS.
 *
 * Convenciones del backend:
 *  - Los endpoints ERP devuelven las filas tal cual están en la BD (snake_case): `saldo_actual`, `owner_user_id`…
 *  - Los BIGINT y NUMERIC/DECIMAL llegan como `number` en el JSON (el backend los calcula con Decimal.js y los
 *    serializa al final). Para mostrar dinero usar `formatearCOP()` / pipes de moneda; NUNCA acumular con `+` en
 *    bucles largos (usar el total que ya calcula el backend).
 *  - Las fechas llegan como cadenas ISO-8601. Los periodos como `YYYY-MM`.
 *  - Los cuerpos de las peticiones (POST/PUT/PATCH) usan camelCase.
 */

// ───────────────────────────── enums ─────────────────────────────

export type TipoCuentaFinanciera = 'AHORROS' | 'CORRIENTE' | 'BILLETERA_DIGITAL' | 'EFECTIVO';
export type TipoCategoria = 'INGRESO' | 'EGRESO' | 'AMBOS';
export type TipoTransaccion = 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA' | 'PAGO_TARJETA' | 'PAGO_PRESTAMO' | 'REEMBOLSO_TERCERO';
export type OrigenRegistro = 'MANUAL' | 'EMAIL_AUTO' | 'MIGRACION';
export type EstadoTransaccion = 'PENDIENTE_REVISION' | 'CONFIRMADO' | 'ANULADO';
export type EstadoNotificacionCorreo = 'PENDIENTE' | 'CONCILIADO' | 'IGNORADO' | 'ERROR' | 'DESCARTADO_RECHAZADO';
export type FrecuenciaRecurrente = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'ANUAL';
export type EstadoPeriodoRecurrente = 'PROYECTADO' | 'FACTURADO' | 'PAGADO' | 'OMITIDO';
export type TipoObligacionMes = 'CUOTA_CARRO' | 'CUOTA_CASA' | 'OTRO';
export type MetodoAporte = 'Fisico' | 'Bancolombia' | 'Nequi' | 'Carrera' | 'Uso Carro' | 'Prestamo' | 'Pago Mensual' | 'Otro';
export type TipoMovimientoDeuda =
  | 'CARGO_CUOTA_TC'
  | 'CARGO_GASTO_COMPARTIDO'
  | 'CARGO_PRESTAMO_DIRECTO'
  | 'CARGO_CRUCE_DEUDA'
  | 'ABONO_PAGO_RECIBIDO'
  | 'AJUSTE_DESCUENTO'
  | 'ABONO_APORTE_DIARIO'
  | 'ABONO_CRUCE_DEUDA'
  | 'CARGO_RECURRENTE_PERSONA'
  | 'ABONO_RECURRENTE_PERSONA'
  | 'ABONO_SALDO_FAVOR_CARRO'
  | 'CARGO_COBRO_PUNTUAL';

/** Periodo contable `YYYY-MM`. */
export type Periodo = string;

// ───────────────────────────── cuentas y categorías ─────────────────────────────

export interface CuentaFinanciera {
  id: number;
  owner_user_id: number;
  nombre: string;
  tipo_cuenta: TipoCuentaFinanciera;
  banco_entidad: string | null;
  /** Puede contener varios valores separados por coma/espacio (p. ej. cuenta + tarjeta débito: "3698,4278"). */
  ultimos_4_digitos: string | null;
  moneda: string;
  /** Lo mantiene el Trigger 2 de la BD; el frontend nunca lo envía. */
  saldo_actual: number;
  is_active: boolean | null;
  /** Recibe los avisos del banco que no traen número de cuenta (p. ej. la nómina). Solo una por usuario. */
  es_principal?: boolean;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  tags?: string[];
  comercio_canonico?: string | null;
}

export interface CrearCuentaFinanciera {
  nombre: string;
  tipoCuenta: TipoCuentaFinanciera;
  bancoEntidad?: string;
  ultimos4Digitos?: string;
  moneda?: string;
  /** Solo al crear: después el saldo lo mueven los movimientos. */
  saldoInicial?: number | string;
  /** Marcarla desmarca la anterior. */
  esPrincipal?: boolean;
}

export type ActualizarCuentaFinanciera = Partial<Omit<CrearCuentaFinanciera, 'moneda' | 'saldoInicial'>> & { isActive?: boolean };

export interface Categoria {
  id: number;
  owner_user_id: number | null;
  nombre: string;
  tipo: TipoCategoria;
  icono: string | null;
  color: string | null;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  tags?: string[];
  comercio_canonico?: string | null;
}

export interface CrearCategoria {
  nombre: string;
  tipo: TipoCategoria;
  icono?: string;
  color?: string;
}

export type ActualizarCategoria = Partial<CrearCategoria>;

// ───────────────────────────── transacciones ─────────────────────────────

export interface Transaccion {
  id: number;
  owner_user_id: number;
  tipo_transaccion: TipoTransaccion;
  cuenta_origen_id: number | null;
  cuenta_destino_id: number | null;
  tarjeta_pagada_id: number | null;
  categoria_id: number | null;
  fecha_transaccion: string;
  concepto: string;
  moneda_original: string;
  monto_original: number;
  tasa_cambio: number;
  monto_cop: number;
  origen_registro: OrigenRegistro | null;
  estado: EstadoTransaccion | null;
  notas: string | null;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  tags?: string[];
  comercio_canonico?: string | null;
}

export interface TransaccionesPagina {
  total: number;
  limit: number;
  offset: number;
  items: Transaccion[];
}

export interface FiltroTransacciones {
  /** `YYYY-MM` (mes calendario en hora de Bogotá). Excluyente con desde/hasta. */
  periodo?: Periodo;
  tipo?: TipoTransaccion;
  estado?: EstadoTransaccion;
  cuentaId?: number;
  categoriaId?: number;
  origen_registro?: OrigenRegistro;
  /** `YYYY-MM-DD` */
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export interface CrearTransaccion {
  tipoTransaccion: TipoTransaccion;
  cuentaOrigenId?: number;
  cuentaDestinoId?: number;
  tarjetaPagadaId?: number;
  categoriaId?: number;
  /** ISO-8601; por defecto, ahora. */
  fechaTransaccion?: string;
  concepto: string;
  monedaOriginal?: string;
  /** Mayor que 0, hasta 2 decimales. Se acepta string para no perder precisión. */
  montoOriginal: number | string;
  /** Obligatoria si la moneda no es COP. */
  tasaCambio?: number | string;
  origenRegistro?: OrigenRegistro;
  estado?: EstadoTransaccion;
  notas?: string;
  esTransferenciaInterna?: boolean;
  cuentaContraparteId?: number;
  tags?: string[];
  comercioCanonico?: string | null;
}

export interface CrearTransferenciaInterna {
  cuentaOrigenId: number;
  cuentaDestinoId: number;
  monto: number | string;
  monedaOriginal?: string;
  tasaCambio?: number | string;
  fechaTransaccion?: string;
  concepto?: string;
  notas?: string;
  comisionGMF?: number | string;
  categoriaComisionId?: number;
}

export interface ResultadoTransferenciaPropia {
  salida: Transaccion;
  entrada: Transaccion;
  comision: Transaccion | null;
}

export type ActualizarTransaccion = Partial<
  Omit<CrearTransaccion, 'monedaOriginal' | 'origenRegistro' | 'cuentaOrigenId' | 'cuentaDestinoId' | 'tarjetaPagadaId' | 'categoriaId'>
> & {
  cuentaOrigenId?: number | null;
  cuentaDestinoId?: number | null;
  tarjetaPagadaId?: number | null;
  categoriaId?: number | null;
};

// ───────────────────────────── notificaciones de correo (Bancolombia) ─────────────────────────────

/** `datos_parseados`: lo que dejó el Apps Script / el normalizador del backend. */
export interface DatosParseadosCorreo {
  tipo?: string;
  metodo?: string;
  comercio?: string;
  moneda?: string;
  /** Monto normalizado como texto decimal ("1250000.5"). */
  monto?: string | number;
  ultimos_4?: string;
  instrumento?: 'TC' | 'CUENTA' | string;
  ruta?: string;
  fecha?: string;
  hora?: string;
  /** Si el backend no pudo completar el proceso: `trm_no_disponible`, `cuenta_no_identificada`, … */
  motivo?: string;
  linkCorreo?: string;
  /** Cuando la compra se creó con los valores habituales del comercio: cuántas compras se compararon y qué tan seguro es. */
  plantilla?: { muestras: number; confianza: number; origen: 'historial' | 'concepto_similar' };
  persona_id?: number;
  [clave: string]: unknown;
}

/** Lo que el sync hizo con el correo: CREADA = registró algo; EXISTENTE = lo enlazó a algo que ya existía; DUPLICADO = otro aviso del mismo hecho. */
export type VinculoCorreo = 'CREADA' | 'EXISTENTE' | 'DUPLICADO';

export interface NotificacionCorreo {
  id: number;
  owner_user_id: number;
  external_message_id: string;
  remitente: string | null;
  asunto: string | null;
  fecha_correo: string;
  cuerpo_extraido: string | null;
  datos_parseados: DatosParseadosCorreo | null;
  estado_procesamiento: EstadoNotificacionCorreo | null;
  transaccion_generada_id: number | null;
  compra_credito_generada_id: number | null;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  // Columnas que rellena el sync inteligente (pueden faltar en respuestas antiguas)
  ultimos_4?: string | null;
  comercio_normalizado?: string | null;
  monto_original?: number | string | null;
  moneda?: string | null;
  tarjeta_id?: number | null;
  cuenta_id?: number | null;
  persona_id?: number | null;
  vinculo?: VinculoCorreo | null;
  notificacion_original_id?: number | null;
}

export interface ResponsableConciliacion {
  personaId: number;
  /** 0 < % ≤ 100. La suma con los responsables que ya tiene la compra no puede superar 100. */
  porcentajePago: number | string;
  cantidadCuotas?: number;
}

export interface ConvertirEnPrestamo {
  responsableId: number;
  /** `yyyy-MM-dd`; por defecto la fecha de la transacción. */
  fechaCobro?: string;
  comentarios?: string;
  metodo?: string;
}

export interface ConciliarNotificacion {
  /** Por defecto 'CONFIRMAR'. 'DESCARTAR' anula la transacción pendiente / elimina la compra importada. */
  accion?: 'CONFIRMAR' | 'DESCARTAR';
  categoriaId?: number;
  /** Cuenta a la que se aplica el movimiento cuando el correo no la identificó. */
  cuentaId?: number;
  concepto?: string;
  /** Corrección del monto (solo transacciones en COP). */
  monto?: number | string;
  /** Día real del movimiento (`yyyy-MM-dd`) cuando el correo lo trae mal; solo al crearlo desde el correo. */
  fecha?: string;
  /** TRM (COP por unidad) de un correo en otra moneda que no trae tasa. */
  tasaCambio?: number | string;
  notas?: string;
  /** Compras de tarjeta importadas: recalcula las cuotas (Regla 4). */
  numeroCuotas?: number;
  /** Tarjeta, cuando el correo no la identificó: de crédito crea la compra a 1 cuota; de débito registra el movimiento en su cuenta. */
  tarjetaId?: number;
  responsables?: ResponsableConciliacion[];
  convertirEnPrestamo?: ConvertirEnPrestamo;
}

export interface ResultadoConciliacion {
  notificacion: NotificacionCorreo;
  transaccion: Transaccion | null;
  compra: { id: number; concepto: string | null; numero_cuotas: number | null } | null;
  prestamoId: number | null;
  responsablesCreados: number;
}

// ───────────────────────────── gastos recurrentes ─────────────────────────────

export interface ResponsableRecurrente {
  id?: number;
  plantilla_recurrente_id?: number;
  persona_id: number;
  porcentaje_participacion: number | null;
  monto_fijo_participacion: number | null;
  persona?: { id: number; nombre: string | null };
}

export interface PlantillaRecurrente {
  id: number;
  owner_user_id: number;
  nombre: string;
  categoria_id: number | null;
  frecuencia: FrecuenciaRecurrente | null;
  dia_vencimiento_estimado: number | null;
  es_monto_variable: boolean | null;
  moneda: string;
  monto_base_estimado: number;
  cuenta_debito_default_id: number | null;
  tarjeta_credito_default_id: number | null;
  prestamo_asociado_id: number | null;
  is_active: boolean | null;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  responsables?: ResponsableRecurrente[];
}

export interface ResponsableRecurrenteRequest {
  personaId: number;
  porcentajeParticipacion?: number | string;
  montoFijoParticipacion?: number | string;
}

export interface CrearPlantillaRecurrente {
  nombre: string;
  categoriaId?: number;
  frecuencia?: FrecuenciaRecurrente;
  diaVencimientoEstimado?: number;
  esMontoVariable?: boolean;
  moneda?: string;
  montoBaseEstimado: number | string;
  cuentaDebitoDefaultId?: number;
  tarjetaCreditoDefaultId?: number;
  prestamoAsociadoId?: number;
  isActive?: boolean;
  responsables?: ResponsableRecurrenteRequest[];
}

export type ActualizarPlantillaRecurrente = Partial<
  Omit<CrearPlantillaRecurrente, 'moneda' | 'categoriaId' | 'cuentaDebitoDefaultId' | 'tarjetaCreditoDefaultId' | 'prestamoAsociadoId'>
> & {
  categoriaId?: number | null;
  cuentaDebitoDefaultId?: number | null;
  tarjetaCreditoDefaultId?: number | null;
  prestamoAsociadoId?: number | null;
};

export interface PeriodoRecurrente {
  id: number;
  plantilla_recurrente_id: number;
  owner_user_id: number;
  periodo: Periodo;
  fecha_estimada_pago: string;
  monto_pronosticado: number;
  monto_real_pagado: number | null;
  estado: EstadoPeriodoRecurrente | null;
  transaccion_pago_id: number | null;
  compra_credito_pago_id: number | null;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  plantilla?: { id: number; nombre: string; es_monto_variable: boolean | null };
}

export interface RegistrarPagoPeriodo {
  montoRealPagado: number | string;
  /** Por defecto 'PAGADO'. Ambos estados disparan el Trigger 7 (cargo a cada participante). */
  estado?: 'PAGADO' | 'FACTURADO';
  cuentaOrigenId?: number;
  /** Si es true y hay cuenta, crea además el EGRESO que descuenta el saldo. */
  crearTransaccion?: boolean;
  transaccionPagoId?: number;
  compraCreditoPagoId?: number;
}

export interface ResultadoProyeccion {
  periodo: Periodo;
  generados: number;
  total: number;
  periodos: PeriodoRecurrente[];
}

// ───────────────────────────── obligaciones del mes (cuota carro / casa) ─────────────────────────────

export interface ObligacionMes {
  id: number;
  owner_user_id: number;
  tipo_obligacion: TipoObligacionMes;
  responsable_principal_id: number;
  concepto: string;
  periodo: Periodo;
  meta_mensual: number;
  fecha_inicio: string;
  fecha_final: string | null;
  estado: 'ABIERTO' | 'COMPLETADO' | null;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  tags?: string[];
  comercio_canonico?: string | null;
}

export interface CrearObligacionMes {
  tipoObligacion: TipoObligacionMes;
  responsablePrincipalId: number;
  concepto: string;
  periodo: Periodo;
  metaMensual: number | string;
  /** `yyyy-MM-dd` */
  fechaInicio: string;
  fechaFinal?: string;
}

/** Vista `vw_ResumenObligacionesMes`. */
export interface ResumenObligacionMes {
  obligacion_mes_id: number;
  owner_user_id: number | null;
  tipo_obligacion: TipoObligacionMes | null;
  responsable_principal_id: number | null;
  responsable_principal_nombre: string | null;
  concepto: string | null;
  periodo: Periodo | null;
  meta_mensual: number | null;
  fecha_inicio: string | null;
  fecha_final: string | null;
  estado_calculado: string | null;
  dias_aportados: number | null;
  cantidad_registros: number | null;
  aporte_total_real: number | null;
  restante_real: number | null;
  aportado_directo_responsable: number | null;
  aportado_por_cruces: number | null;
}

/** Vista `vw_AportesDiaResumen`. */
export interface AporteDiaResumen {
  aporte_dia_id: number;
  obligacion_mes_id: number | null;
  mes_concepto: string | null;
  periodo: Periodo | null;
  fecha: string | null;
  notas: string | null;
  items_count: number | null;
  valor_total_dia: number | null;
}

export interface AporteItemRequest {
  personaId: number;
  valor: number | string;
  metodo: MetodoAporte;
  comentarios?: string;
}

export interface RegistrarAportesDia {
  /** `yyyy-MM-dd` */
  fecha: string;
  notas?: string;
  items: AporteItemRequest[];
}

/** Fila de `AportesDetalle` con la persona (y el préstamo por cruce que generó el Trigger 3, si lo hubo). */
export interface AporteDetalle {
  id: number;
  aporte_dia_id: number;
  persona_id: number;
  valor: number;
  metodo: MetodoAporte | string;
  comentarios: string | null;
  /** Lo completa la BD cuando aporta alguien que no es el responsable ni el titular: nace un préstamo POR_COBRAR. */
  prestamo_cruce_generado_id: number | null;
  created_at: string | null;
  es_transferencia_interna?: boolean;
  cuenta_contraparte_id?: number | null;
  transaccion_espejo_id?: number | null;
  persona?: { id: number; nombre: string | null; iniciales_nombre?: string | null; color_representativo?: string | null };
  prestamo_cruce?: { id: number; estado: string | null; valor_prestado: number; corte_id: number | null } | null;
}

/** `GET /api/obligaciones-mes/:id/aportes-dia` y respuesta de `POST` (resumen del día + desglose). */
export interface AporteDiaConDetalle extends AporteDiaResumen {
  detalles: AporteDetalle[];
}

// ───────────────────────────── extractos de tarjeta ─────────────────────────────

/** `GET /api/tarjetas/resumen-mensual?periodo=YYYY-MM` — una fila por tarjeta con cuotas facturadas en el periodo. */
export interface ResumenMensualTarjeta {
  tarjeta_id: number;
  franquicia: string | null;
  nombre_tarjeta: string | null;
  dia_corte: number | null;
  dia_limite_pago: number | null;
  periodo_facturacion: Periodo;
  total_cuotas_mes: number;
  /** Lo que cobra el banco en el extracto (COP). */
  total_extracto_cop: number;
  componente_en_usd: number;
  /** false ⇒ hay compras en USD con TRM provisional: el total puede variar al confirmarla. */
  todas_trm_confirmadas: boolean;
  total_responsabilidad_terceros: number;
  total_propio: number;
  /** Cuánto de este extracto le toca a cada tercero (ya incluido en `total_responsabilidad_terceros`). */
  terceros?: Array<{ personaId: number; nombre: string | null; monto: number }>;
}

/** `PUT /api/tarjetas/:id`: solo se envía lo que cambia. */
export interface ActualizarTarjeta {
  /** Solo una tarjeta sin compras a crédito puede pasar a DEBITO. */
  tipo?: 'CREDITO' | 'DEBITO';
  /** Cuenta a la que pertenece; obligatoria en débito, `null` la quita en crédito. */
  cuentaId?: number | null;
  /** Nombre corto para mostrar; vacío = quitarlo. */
  alias?: string;
  franquicia?: string;
  /** Escribir aquí los últimos 4 dígitos (p. ej. `Oro *1927`) permite identificar la tarjeta en los correos del banco. */
  descripcion?: string;
  /** 1-31 */
  diaCorte?: number;
  /** 1-31 */
  diaLimitePago?: number;
  cupoTotal?: number | string;
  permiteDolares?: boolean;
  /** % mensual, máximo 4 decimales */
  tasaInteresCompra?: number | string;
  tasaInteresAvance?: number | string;
  cuotaManejo?: number | string;
  urlInfo?: string;
  extractTasas?: boolean;
  /** Últimos 4 dígitos con los que el banco reporta la tarjeta; varios separados por coma si se reexpidió ("1927,9587"). Vacío = quitar. */
  ultimos4Digitos?: string;
}

export interface PagarExtracto {
  cuentaOrigenId: number;
  periodo: Periodo;
  /** > 0, máximo 2 decimales. */
  montoPagado: number | string;
}

export interface ResultadoPagoExtracto {
  transaccionId: number;
  tarjetaId: number;
  cuentaOrigenId: number;
  periodo: Periodo;
  montoPagado: number;
}

// ───────────────────────────── ledger de deudas y analítica ─────────────────────────────

/** `GET /api/ledger/estado-cuenta?periodo=` — una fila por persona. */
export interface EstadoCuentaPersona {
  persona_id: number;
  nombre: string | null;
  iniciales_nombre: string | null;
  color_representativo: string | null;
  cuotas_tc_mes: number | null;
  recurrentes_compartidos_mes: number | null;
  prestamos_mes: number | null;
  cruces_asumidos_mes: number | null;
  abonos_recibidos_mes: number | null;
  saldo_neto_mes: number | null;
  saldo_total_acumulado: number | null;
}

export interface MovimientoExtracto {
  id: number;
  fecha_movimiento: string;
  periodo_imputacion: Periodo;
  tipo_movimiento: TipoMovimientoDeuda;
  concepto: string;
  /** +1 cargo (la persona debe más) / −1 abono. */
  signo: 1 | -1;
  monto: number;
  impacto_saldo: number;
  estado: 'PROYECTADO' | 'CONFIRMADO' | 'ANULADO' | null;
}

export interface AbonarPersona {
  cuentaDestinoId: number;
  monto: number | string;
  periodoImputacion: Periodo;
  concepto: string;
  /** Si se indica, liquida los préstamos de ese corte con el abono. */
  liquidarPrestamosCorteId?: number;
}

export interface CruceDeuda {
  id: number;
  fecha_cruce: string;
  persona_que_abona_id: number;
  persona_que_asume_deuda_id: number;
  monto: number;
  prestamo_destino_id: number | null;
  periodo_recurrente_destino_id: number | null;
  concepto: string;
  comentarios: string | null;
  created_at?: string | null;
  persona_que_abona?: { id: number; nombre: string | null };
  persona_que_asume?: { id: number; nombre: string | null };
  /** Solo al crearlo: el par de asientos (−1 / +1) que genera el Trigger 5. */
  movimientos?: Array<Pick<MovimientoExtracto, 'id' | 'tipo_movimiento' | 'signo' | 'monto' | 'estado'> & { persona_id: number }>;
}

export interface ResultadoAbonoPersona {
  movimientoId: number;
  personaId: number;
  monto: number;
  periodoImputacion: Periodo;
}

export interface CrearCruceDeuda {
  /** `yyyy-MM-dd`; por defecto hoy. */
  fechaCruce?: string;
  personaQueAbonaId: number;
  personaQueAsumeDeudaId: number;
  monto: number | string;
  prestamoDestinoId?: number;
  periodoRecurrenteDestinoId?: number;
  concepto: string;
  comentarios?: string;
}

/** `GET /api/analytics/flujo-caja?periodo=` */
export interface FlujoCaja {
  total_ingresos: number;
  total_egresos_directos: number;
  total_tarjetas: number;
  total_esperado_recurrentes: number;
  total_por_cobrar_terceros: number;
  desembolso_bruto_mes: number;
  gasto_neto_real_tuyo: number;
  flujo_caja_libre_estimado: number;
  total_transferencias_internas?: number;
}
