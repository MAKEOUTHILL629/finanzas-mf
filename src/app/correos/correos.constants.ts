import { ProductoDetectado, SugerenciaProducto } from '../modelos/correos-inteligentes';
import { partesFechaCalendario } from '../shared/date-only.helper';
import { hoyIso } from '../shared/periodo.helper';
import { EstadoNotificacionCorreo, NotificacionCorreo, VinculoCorreo } from '../modelos/erp';

export interface VistaCorreo {
  monto: number | null;
  moneda: string;
  comercio: string | null;
  tipo: string | null;
  metodo: string | null;
  ultimos4: string | null;
  instrumento: 'TC' | 'CUENTA' | null;
  ruta: string | null;
  motivo: string | null;
  motivoRechazo: string | null;
  linkCorreo: string | null;
  /** Día que dice el correo (`yyyy-MM-dd`), si lo trae. */
  fecha: string | null;
  /** Tasa de cambio que ya trae el correo (COP por unidad), si es en otra moneda. */
  tasa: number | null;
}

/** Lee `datos_parseados` (que escribe el sync-batch o la ingesta) con valores por defecto seguros. */
export function interpretarCorreo(n: Pick<NotificacionCorreo, 'datos_parseados'>): VistaCorreo {
  const d = (n.datos_parseados ?? {}) as Record<string, unknown>;
  const monto = d['monto'] === null || d['monto'] === undefined || d['monto'] === '' ? null : Number(d['monto']);
  const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const instrumento = d['instrumento'] === 'TC' || d['instrumento'] === 'CUENTA' ? d['instrumento'] : null;
  return {
    monto: monto !== null && Number.isFinite(monto) ? monto : null,
    moneda: (texto(d['moneda']) ?? 'COP').toUpperCase(),
    comercio: texto(d['comercio']),
    tipo: texto(d['tipo']),
    metodo: texto(d['metodo']),
    ultimos4: texto(d['ultimos_4']),
    instrumento,
    ruta: texto(d['ruta']),
    motivo: texto(d['motivo']),
    motivoRechazo: texto(d['motivo_rechazo']),
    linkCorreo: texto(d['linkCorreo']),
    fecha: /^\d{4}-\d{2}-\d{2}/.test(texto(d['fecha']) ?? '') ? (texto(d['fecha']) as string).slice(0, 10) : null,
    tasa: Number.isFinite(Number(d['tasa_cambio'])) && Number(d['tasa_cambio']) > 0 ? Number(d['tasa_cambio']) : null,
  };
}

/**
 * Día (`yyyy-MM-dd`) del movimiento que describe el correo: el que trae el aviso o, si no, el de su fecha de llegada en Bogotá
 * (UTC-5, sin horario de verano).
 */
export function fechaDelCorreo(n: Pick<NotificacionCorreo, 'datos_parseados' | 'fecha_correo'>): string {
  const propia = interpretarCorreo(n).fecha;
  if (propia) return propia;
  const t = Date.parse(n.fecha_correo);
  return Number.isFinite(t) ? new Date(t - 5 * 3600_000).toISOString().slice(0, 10) : hoyIso();
}

/** Nombre legible de cada campo del cuerpo de conciliar / asignar, para los mensajes de error del servidor. */
export const ETIQUETAS_CAMPOS_CORREO: Record<string, string> = {
  tasaCambio: 'TRM',
  tarjetaId: 'Tarjeta',
  cuentaId: 'Cuenta',
  categoriaId: 'Categoría',
  monto: 'Monto',
  fecha: 'Fecha',
  concepto: 'Concepto',
  notas: 'Notas',
  numeroCuotas: 'Cuotas',
  responsables: 'Responsables',
  convertirEnPrestamo: 'Préstamo',
  ultimos4: 'Dígitos',
  destino: 'Destino',
  id: 'Producto',
  nuevo: 'Datos del producto',
};

/** Qué significa cada `motivo` que deja el backend cuando no pudo resolver el correo solo. */
const MOTIVOS: Record<string, string> = {
  tarjeta_no_identificada: 'No se pudo identificar la tarjeta (los últimos 4 dígitos no coinciden con ninguna). Elige la tarjeta para crear la compra.',
  cuenta_no_identificada: 'No se pudo identificar la cuenta (los últimos 4 dígitos no coinciden con ninguna). Elige la cuenta para registrar el movimiento.',
  cuenta_origen_no_identificada: 'No se pudo identificar la cuenta que pagó. Elige la cuenta.',
  trm_no_disponible: 'Es una compra en dólares y no hay una TRM disponible. Registra la compra a mano o configura una TRM.',
  tipo_o_metodo_no_reconocido: 'El tipo o el método del correo no se reconoció. Revísalo y regístralo a mano si aplica.',
  monto_invalido: 'No se pudo leer el monto del correo.',
  fecha_u_hora_invalida: 'No se pudo leer la fecha u hora del correo.',
  duplicado_de_pago_tarjeta_existente: 'Es el mismo pago de tarjeta que otro correo: se enlazó a la transacción existente.',
  pago_tarjeta_sin_tarjeta_identificada: 'Se descontó el pago de la cuenta, pero no se identificó qué tarjeta se pagó.',
  transaccion_confirmada_automaticamente: 'Se registró y confirmó automáticamente.',
  aviso_informativo_o_error_de_parseo: 'Aviso informativo o correo no interpretable: se ignoró.',
  compra_rechazada_o_no_exitosa: 'El banco avisó que la compra NO se hizo (por ejemplo, fondos insuficientes): se ignoró.',
  compra_tc_creada_a_1_cuota: 'Se importó como una compra a 1 cuota: asigna las cuotas y los responsables.',
  compra_creada_desde_plantilla: 'Se registró con las cuotas y los responsables que ya usas con este comercio. Revísala si algo cambió.',
  vinculada_a_compra_existente: 'Ya tenías esta compra registrada (misma tarjeta, fecha y monto): se enlazó, no se duplicó.',
  vinculada_a_transaccion_existente: 'Ya tenías este movimiento registrado (misma cuenta, monto y día): se enlazó, no se duplicó.',
  duplicado_de_correo: 'Es otro aviso del mismo hecho (misma tarjeta o cuenta, monto y minuto): se ignoró para no registrarlo dos veces.',
  duplicado_por_huella: 'Es el mismo hecho ya sincronizado (misma huella de fecha, monto, tarjeta y comercio): se ignoró para no duplicarlo.',
  vinculada_por_ventana_36h: 'Se enlazó con un registro tuyo de monto idéntico y comercio parecido dentro de las 36 horas siguientes/anteriores.',
  historico_sin_registro_previo: 'Es anterior a la fecha de corte y no hay un registro equivalente: no se registró solo. Concílialo a mano si lo quieres.',
  pago_tarjeta_registrado: 'Se registró el pago de la tarjeta.',
};

/** Motivos que dicen «no se pudo identificar la tarjeta o cuenta»: dejan de aplicar en cuanto se elige el producto. */
const MOTIVOS_DE_PRODUCTO = new Set(['tarjeta_no_identificada', 'cuenta_no_identificada', 'cuenta_origen_no_identificada']);

export function esMotivoDeProducto(motivo: string | null | undefined): boolean {
  return !!motivo && MOTIVOS_DE_PRODUCTO.has(motivo);
}

export function explicarMotivo(motivo: string | null | undefined): string | null {
  return motivo ? (MOTIVOS[motivo] ?? motivo) : null;
}

export const ESTADOS_CORREO: ReadonlyArray<{ valor: '' | EstadoNotificacionCorreo; etiqueta: string }> = [
  { valor: 'PENDIENTE', etiqueta: 'Por revisar' },
  { valor: 'CONCILIADO', etiqueta: 'Conciliados' },
  { valor: 'IGNORADO', etiqueta: 'Ignorados' },
  { valor: 'DESCARTADO_RECHAZADO', etiqueta: 'Descartados / Rechazados' },
  { valor: 'ERROR', etiqueta: 'Con error' },
  { valor: '', etiqueta: 'Todos' },
];

export function claseEstadoCorreo(estado: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  return estado === 'CONCILIADO'
    ? 'success'
    : estado === 'PENDIENTE'
      ? 'warning'
      : estado === 'ERROR' || estado === 'DESCARTADO_RECHAZADO'
        ? 'danger'
        : 'neutral';
}

export function etiquetaEstadoCorreo(estado: string | null | undefined): string {
  return {
    PENDIENTE: 'Por revisar',
    CONCILIADO: 'Conciliado',
    IGNORADO: 'Ignorado',
    ERROR: 'Con error',
    DESCARTADO_RECHAZADO: 'Rechazada por el banco',
  }[estado ?? ''] ?? (estado || '—');
}

/** ¿El correo describe un egreso que se puede convertir en préstamo por cobrar? */
export function admiteConvertirEnPrestamo(v: VistaCorreo): boolean {
  return v.ruta === 'EGRESO';
}


// ───────────────────────────── vínculos y reproceso ─────────────────────────────

export interface EtiquetaVinculo {
  texto: string;
  icono: string;
  clase: 'success' | 'info' | 'neutral' | 'warning';
}

/** Qué hizo el sistema con el correo: lo registró, lo enlazó a algo que ya existía o lo reconoció como repetido. */
export function etiquetaVinculo(vinculo: VinculoCorreo | null | undefined, motivo: string | null | undefined): EtiquetaVinculo | null {
  if (vinculo === 'EXISTENTE') return { texto: 'Enlazado a lo que ya tenías', icono: 'link', clase: 'info' };
  if (vinculo === 'DUPLICADO') return { texto: 'Aviso repetido', icono: 'content_copy', clase: 'neutral' };
  if (vinculo === 'CREADA') {
    return motivo === 'compra_creada_desde_plantilla'
      ? { texto: 'Registrado con tus valores habituales', icono: 'auto_awesome', clase: 'success' }
      : { texto: 'Registrado automáticamente', icono: 'bolt', clase: 'success' };
  }
  return null;
}

/** ¿Se puede deshacer? Lo que el sistema resolvió solo (tiene vínculo) y sigue conciliado. */
export function admiteDeshacer(n: Pick<NotificacionCorreo, 'estado_procesamiento' | 'vinculo'>): boolean {
  return n.estado_procesamiento === 'CONCILIADO' && !!n.vinculo;
}

/** Qué pasaría (o pasó) con los correos, en lenguaje de usuario, en el orden en que se muestran. */
export const ACCIONES_REPROCESO: ReadonlyArray<{ clave: string; titulo: string; icono: string; clase: 'success' | 'info' | 'neutral' | 'warning' | 'danger' }> = [
  { clave: 'compras_enlazadas', titulo: 'Compras que ya tenías: se enlazan', icono: 'link', clase: 'info' },
  { clave: 'compras_creadas_con_plantilla', titulo: 'Compras nuevas con tus valores habituales', icono: 'auto_awesome', clase: 'success' },
  { clave: 'compras_creadas', titulo: 'Compras nuevas a 1 cuota (por completar)', icono: 'add_shopping_cart', clase: 'warning' },
  { clave: 'transacciones_creadas', titulo: 'Movimientos nuevos en tus cuentas', icono: 'swap_horiz', clase: 'success' },
  { clave: 'transacciones_enlazadas', titulo: 'Movimientos que ya tenías: se enlazan', icono: 'link', clase: 'info' },
  { clave: 'duplicados', titulo: 'Avisos repetidos: se ignoran', icono: 'content_copy', clase: 'neutral' },
  { clave: 'ignorados', titulo: 'Avisos que no son gastos', icono: 'block', clase: 'neutral' },
  { clave: 'siguen_pendientes', titulo: 'Siguen pendientes de tu decisión', icono: 'hourglass_empty', clase: 'warning' },
  { clave: 'con_error', titulo: 'No se pudieron leer', icono: 'error_outline', clase: 'danger' },
];

export function accionesDelResumen(acciones: Record<string, number>): Array<(typeof ACCIONES_REPROCESO)[number] & { cantidad: number }> {
  return ACCIONES_REPROCESO.map((a) => ({ ...a, cantidad: acciones[a.clave] ?? 0 })).filter((a) => a.cantidad > 0);
}

const MOTIVOS_RESUELTOS = new Set([
  'vinculada_a_compra_existente',
  'vinculada_a_transaccion_existente',
  'compra_creada_desde_plantilla',
  'transaccion_confirmada_automaticamente',
  'pago_tarjeta_registrado',
  'pago_tarjeta_sin_tarjeta_identificada',
  'duplicado_de_pago_tarjeta_existente',
  'duplicado_de_correo',
  'aviso_informativo_o_error_de_parseo',
  'compra_rechazada_o_no_exitosa',
]);

/** Motivos de los que siguen pendientes (o todos), de más a menos frecuentes. */
export function motivosOrdenados(motivos: Record<string, number>, soloPendientes = true): Array<{ motivo: string; texto: string; cantidad: number }> {
  return Object.entries(motivos)
    .filter(([m]) => !soloPendientes || !MOTIVOS_RESUELTOS.has(m))
    .map(([motivo, cantidad]) => ({ motivo, texto: explicarMotivo(motivo) ?? motivo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

// ───────────────────────────── productos detectados ─────────────────────────────

export function etiquetaProducto(p: Pick<ProductoDetectado, 'instrumento' | 'esDebito'>): string {
  return p.instrumento === 'TC' ? 'Tarjeta de crédito' : p.esDebito ? 'Tarjeta débito' : 'Cuenta';
}

/** Texto de la sugerencia para un producto que aún no está asignado. */
export function textoSugerencia(s: SugerenciaProducto | null): string | null {
  if (!s) return null;
  switch (s.tipo) {
    case 'TARJETA_EXISTENTE':
      return s.automatica
        ? `Es tu ${s.tarjeta}: ${s.votos} de ${s.total} compras que ya tienes coinciden en fecha y monto.`
        : `Podría ser tu ${s.tarjeta}, pero solo ${s.votos} compra${s.votos === 1 ? '' : 's'} coincide${s.votos === 1 ? '' : 'n'} (hacen falta 3 o más): confírmalo tú.`;
    case 'CREAR_TARJETA':
      return 'No coincide con ninguna compra tuya: puede ser una tarjeta nueva.';
    case 'CREAR_CUENTA':
      return s.esPrincipal
        ? 'Parece tu cuenta principal: se crearía y recibiría los avisos que no traen número (como la nómina).'
        : 'Parece una cuenta del banco: se puede crear con estos dígitos.';
    case 'AGREGAR_A_CUENTA':
      return `Es una tarjeta débito: se agregaría a «${s.cuenta}».`;
  }
}

/** ¿La sugerencia se puede aceptar sin pensar? (evidencia suficiente, o cuentas/débitos detectados) */
export function esAceptable(s: SugerenciaProducto | null): boolean {
  if (!s) return false;
  return s.tipo === 'CREAR_CUENTA' || s.tipo === 'AGREGAR_A_CUENTA' || (s.tipo === 'TARJETA_EXISTENTE' && s.automatica);
}

export function sinAsignar(productos: ProductoDetectado[]): ProductoDetectado[] {
  return productos.filter((p) => !p.asignadoA);
}


// ───────────────────────────── reproceso ─────────────────────────────

/**
 * Fecha de corte que se propone para reprocesar: el día siguiente a la compra más reciente que ya tienes registrada (todo lo
 * posterior es lo que falta por registrar) o, si no hay compras, el primer día del mes actual. Formato `yyyy-MM-dd`.
 */
export function fechaCorteSugerida(compras: Array<{ fechaCompra?: Date | number | string | null }>, hoy: Date = new Date()): string {
  let ultima: number | null = null;
  for (const c of compras) {
    if (c.fechaCompra === undefined || c.fechaCompra === null) continue;
    const t = new Date(c.fechaCompra).getTime();
    if (Number.isFinite(t) && (ultima === null || t > ultima)) ultima = t;
  }
  if (ultima === null) return `${hoyIso(hoy).slice(0, 8)}01`;
  const { anio, mes, dia } = partesFechaCalendario(ultima);
  const siguiente = new Date(Date.UTC(anio, mes, dia + 1));
  return siguiente.toISOString().slice(0, 10);
}

/** El reproceso en segundo plano: porcentaje 0–100 para la barra de avance. */
export function porcentajeAvance(procesados: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((procesados / total) * 100)) : 0;
}
