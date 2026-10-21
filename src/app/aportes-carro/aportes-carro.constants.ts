import { AporteDiario, CrearAporteDiario, DetalleAporteDiario, DetalleAporteDiarioEnvio, EstadoPeriodoAporte, MetodoAporteCarro, MetodoCanonico, PeriodoCarro } from '../modelos/aportes';
import { moneda } from '../shared/moneda.util';
import { desplazarPeriodo, nombrePeriodo } from '../shared/periodo.helper';

export interface OpcionMetodo {
  valor: MetodoAporteCarro;
  etiqueta: string;
  icono: string;
  ayuda: string;
}

/** Lo que se ofrece al registrar un aporte (los textos heredados de AppSheet solo se muestran, no se eligen). */
export const METODOS_APORTE_CARRO: OpcionMetodo[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo / físico', icono: 'payments', ayuda: 'Dinero entregado en físico.' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia', icono: 'swap_horiz', ayuda: 'Dinero transferido a una cuenta o billetera.' },
  { valor: 'CRUCE_CUENTAS', etiqueta: 'Cruce de cuentas', icono: 'compare_arrows', ayuda: 'Una persona asume el valor: se abona a la cuota y se le carga a ella.' },
  { valor: 'SALDO_A_FAVOR', etiqueta: 'Saldo a favor', icono: 'savings', ayuda: 'Aplica el excedente de un mes anterior.' },
];

const COMO_EFECTIVO = ['EFECTIVO', 'Fisico'];
const COMO_TRANSFERENCIA = ['TRANSFERENCIA', 'Bancolombia', 'Nequi'];
const COMO_CRUCE = ['CRUCE_CUENTAS', 'Prestamo'];

/** Misma clasificación que el backend: agrupa los métodos canónicos y los heredados de AppSheet. */
export function clasificarMetodo(metodo: string | null | undefined): MetodoCanonico {
  if (!metodo) return 'OTRO';
  if (COMO_EFECTIVO.includes(metodo)) return 'EFECTIVO';
  if (COMO_TRANSFERENCIA.includes(metodo)) return 'TRANSFERENCIA';
  if (COMO_CRUCE.includes(metodo)) return 'CRUCE_CUENTAS';
  return metodo === 'SALDO_A_FAVOR' ? 'SALDO_A_FAVOR' : 'OTRO';
}

/** Etiqueta legible de un método, incluidos los textos heredados de AppSheet. */
export function etiquetaMetodo(metodo: string | null | undefined): string {
  switch (metodo) {
    case 'EFECTIVO':
    case 'Fisico':
      return 'Efectivo';
    case 'TRANSFERENCIA':
      return 'Transferencia';
    case 'Bancolombia':
      return 'Transferencia · Bancolombia';
    case 'Nequi':
      return 'Transferencia · Nequi';
    case 'CRUCE_CUENTAS':
    case 'Prestamo':
      return 'Cruce de cuentas';
    case 'SALDO_A_FAVOR':
      return 'Saldo a favor';
    case null:
    case undefined:
    case '':
      return 'Aporte';
    default:
      return metodo;
  }
}

export function iconoMetodo(canonico: MetodoCanonico): string {
  return METODOS_APORTE_CARRO.find((m) => m.valor === canonico)?.icono ?? 'attach_money';
}

// ── estado del periodo ──

const ETIQUETA_ESTADO: Record<EstadoPeriodoAporte, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  COMPLETADO: 'Completado',
  CON_SALDO_A_FAVOR: 'Con saldo a favor',
};

export function etiquetaEstadoPeriodo(estado: EstadoPeriodoAporte | string): string {
  return ETIQUETA_ESTADO[estado as EstadoPeriodoAporte] ?? estado;
}

export function claseEstadoPeriodo(estado: EstadoPeriodoAporte | string): 'success' | 'warning' | 'info' | 'danger' {
  switch (estado) {
    case 'COMPLETADO':
      return 'success';
    case 'CON_SALDO_A_FAVOR':
      return 'info';
    case 'PARCIAL':
      return 'warning';
    default:
      return 'danger';
  }
}

/** Texto corto del badge de la cabecera de cada mes: «Completado», «Faltan $X» o «Saldo a favor: +$X». */
export function textoEstadoPeriodo(p: Pick<PeriodoCarro, 'estado' | 'saldoPendiente' | 'saldoAFavorDisponible' | 'valorCuotaObjetivo'>): string {
  switch (p.estado) {
    case 'COMPLETADO':
      return 'Completado';
    case 'CON_SALDO_A_FAVOR':
      return `Saldo a favor: +${moneda(p.saldoAFavorDisponible)}`;
    case 'PENDIENTE':
      return `Faltan ${moneda(p.saldoPendiente)}`;
    default:
      return `Faltan ${moneda(p.saldoPendiente)}`;
  }
}

// ── chips de un aporte diario ──

export interface ChipAporte {
  texto: string;
  tipo: 'efectivo' | 'transferencia' | 'cruce' | 'favor' | 'otro';
}

/** Cómo se compuso un aporte: `Efectivo`, `Cruce: Andrés`, `Saldo a favor`… sin repetir. */
export function chipsDeAporte(aporte: Pick<AporteDiario, 'detalles'>): ChipAporte[] {
  const vistos = new Set<string>();
  const chips: ChipAporte[] = [];
  for (const d of aporte.detalles) {
    const chip = chipDeDetalle(d);
    if (vistos.has(chip.texto)) continue;
    vistos.add(chip.texto);
    chips.push(chip);
  }
  return chips;
}

export function chipDeDetalle(d: Pick<DetalleAporteDiario, 'metodo' | 'metodoCanonico' | 'esCruce' | 'personaNombre'>): ChipAporte {
  if (d.esCruce) return { texto: `Cruce: ${primerNombre(d.personaNombre)}`, tipo: 'cruce' };
  switch (d.metodoCanonico) {
    case 'EFECTIVO':
      return { texto: etiquetaMetodo(d.metodo), tipo: 'efectivo' };
    case 'TRANSFERENCIA':
      return { texto: etiquetaMetodo(d.metodo), tipo: 'transferencia' };
    case 'SALDO_A_FAVOR':
      return { texto: 'Saldo a favor', tipo: 'favor' };
    default:
      return { texto: etiquetaMetodo(d.metodo), tipo: 'otro' };
  }
}

export function primerNombre(nombre: string | null | undefined): string {
  return (nombre ?? '').trim().split(/\s+/)[0] || 'la persona';
}

// ── reglas del formulario ──

/** ¿Este método pide elegir la cuenta donde entra el dinero? */
export function pideCuenta(metodo: string | null | undefined): boolean {
  const clase = clasificarMetodo(metodo);
  return clase === 'EFECTIVO' || clase === 'TRANSFERENCIA';
}

/**
 * Persona sugerida al cambiar de método: efectivo, transferencia y saldo a favor son del responsable (papá);
 * en un cruce de cuentas hay que elegir quién asume el valor (se limpia si estaba el responsable).
 */
export function personaTrasCambiarMetodo(metodo: string, personaActual: number | null, responsableId: number | null, miPersonaId: number | null = null): number | null {
  const clase = clasificarMetodo(metodo);
  if (clase === 'CRUCE_CUENTAS') return personaActual === responsableId ? null : personaActual;
  if (clase === 'SALDO_A_FAVOR') return responsableId;
  if (clase === 'OTRO') return personaActual;
  // efectivo / transferencia: el responsable o tú; cualquier otro (un tercero) vuelve al responsable
  return personaActual !== null && (personaActual === responsableId || personaActual === miPersonaId) ? personaActual : responsableId;
}

/**
 * Método tras elegir a una persona. El servidor solo acepta efectivo y transferencia a nombre del responsable de la cuota (o tuyo) y el
 * saldo a favor a nombre del responsable: lo que entrega un tercero entra como «Cruce de cuentas» (se abona a la cuota y se le carga a
 * su cuenta por cobrar). Así el selector puede ofrecer a TODAS las personas: al elegir a un tercero el método pasa solo a cruce.
 */
export function metodoTrasCambiarPersona(metodo: string | null, personaId: number | null, responsableId: number | null, miPersonaId: number | null = null): { metodo: string | null; cambio: boolean } {
  if (personaId === null) return { metodo, cambio: false };
  const clase = clasificarMetodo(metodo);
  const esResponsable = personaId === responsableId;
  const esYo = miPersonaId !== null && personaId === miPersonaId;
  const permitido = clase === 'EFECTIVO' || clase === 'TRANSFERENCIA' ? esResponsable || esYo : clase === 'SALDO_A_FAVOR' ? esResponsable : true;
  return permitido ? { metodo, cambio: false } : { metodo: 'CRUCE_CUENTAS', cambio: true };
}

/** Aviso bajo una línea que pasó sola a «Cruce de cuentas» al elegir a un tercero. */
export function avisoCambioACruce(nombre: string | null | undefined, metodoAnterior: string | null): string {
  return `${nombre || 'La persona'} no es el responsable de la cuota: el aporte pasó de «${etiquetaMetodo(metodoAnterior)}» a «Cruce de cuentas» (se abona a la cuota y se le carga a su cuenta por cobrar).`;
}

/** Aviso bajo una línea de cruce: qué va a pasar con el valor. */
export function avisoCruce(nombre: string | null | undefined, esResponsable = false): string {
  if (esResponsable) return 'El valor se abona a la cuota del carro sin cargar a nadie (descuento de una deuda tuya con el responsable).';
  return `Este valor se abonará a la cuota del carro y se cargará automáticamente a la cuenta por cobrar de ${nombre || 'la persona'} a fin de mes.`;
}

export type MedioPagoAporte = 'EFECTIVO' | 'TRANSFERENCIA';

export interface LineaFormulario {
  id?: number | null;
  valor: number | string | null;
  /** Canónico o, al editar, el texto heredado tal como estaba guardado. */
  metodo: string | null;
  personaId: number | null;
  cuentaFinancieraId: number | null;
  medioPago?: MedioPagoAporte | null;
  transaccionId?: number | null;
  comentarios: string | null;
  origenObligacionMesId?: number | null;
}

/** Cuerpo de `POST/PUT /aportes-diarios` desde los valores crudos del formulario. */
export function construirAporteDiario(v: { fecha: string; periodo: string; notas: string | null; lineas: LineaFormulario[] }): CrearAporteDiario {
  return {
    fecha: v.fecha,
    periodo: v.periodo,
    ...(v.notas?.trim() ? { notas: v.notas.trim() } : {}),
    detalles: v.lineas.map((l): DetalleAporteDiarioEnvio => ({
      ...(l.id ? { id: Number(l.id) } : {}),
      valor: String(l.valor),
      metodo: l.metodo as string,
      personaId: Number(l.personaId),
      ...(pideCuenta(l.metodo) && l.cuentaFinancieraId ? { cuentaFinancieraId: Number(l.cuentaFinancieraId) } : {}),
      ...(pideCuenta(l.metodo) && l.medioPago ? { medioPago: l.medioPago } : {}),
      ...(clasificarMetodo(l.metodo) === 'TRANSFERENCIA' && l.transaccionId ? { transaccionId: Number(l.transaccionId), cuentaDestinoId: l.cuentaFinancieraId ? Number(l.cuentaFinancieraId) : undefined } : {}),
      ...(clasificarMetodo(l.metodo) === 'SALDO_A_FAVOR' && l.origenObligacionMesId ? { origenObligacionMesId: Number(l.origenObligacionMesId) } : {}),
      ...(l.comentarios?.trim() ? { comentarios: l.comentarios.trim() } : {}),
    })),
  };
}

// ── periodos para el selector ──

export interface OpcionPeriodo {
  periodo: string;
  etiqueta: string;
  existe: boolean;
}

/**
 * Periodos del selector del formulario: los que ya existen más el mes anterior, el actual y el siguiente (si faltan),
 * del más reciente al más antiguo.
 */
export function opcionesDePeriodo(existentes: Array<{ periodo: string }>, hoy: string): OpcionPeriodo[] {
  const conocidos = new Set(existentes.map((p) => p.periodo));
  const todos = new Set([...conocidos, desplazarPeriodo(hoy, -1), hoy, desplazarPeriodo(hoy, 1)]);
  return [...todos]
    .sort((a, b) => b.localeCompare(a))
    .map((periodo) => ({ periodo, etiqueta: nombrePeriodo(periodo), existe: conocidos.has(periodo) }));
}

/** Periodos con saldo a favor disponible (para elegir el origen de un aporte SALDO_A_FAVOR). */
export function periodosConExcedente(periodos: PeriodoCarro[]): PeriodoCarro[] {
  return periodos.filter((p) => p.saldoAFavorDisponible > 0);
}

/** ¿Agrupa el aporte en un mes distinto al de su fecha? (p. ej. un pago de octubre para la cuota de septiembre) */
export function esDeOtroMes(aporte: Pick<AporteDiario, 'fecha'>, periodo: string): boolean {
  return aporte.fecha.slice(0, 7) !== periodo;
}

// ── filtros de la lista ──

export interface FiltrosAportes {
  periodo: string | null;
  personaId: number | null;
  metodo: MetodoCanonico | null;
}

export const SIN_FILTROS: FiltrosAportes = { periodo: null, personaId: null, metodo: null };

export function hayFiltros(f: FiltrosAportes): boolean {
  return f.periodo !== null || f.personaId !== null || f.metodo !== null;
}

/**
 * Filtra los periodos: por mes y, si hay filtro de persona o método, deja solo los aportes que tienen una línea que
 * cumple (y oculta los meses que se quedan sin aportes). No modifica los totales del mes: son los del periodo completo.
 */
export function filtrarPeriodos(periodos: PeriodoCarro[], f: FiltrosAportes): PeriodoCarro[] {
  const filtraAportes = f.personaId !== null || f.metodo !== null;
  return periodos
    .filter((p) => f.periodo === null || p.periodo === f.periodo)
    .map((p) => {
      if (!filtraAportes) return p;
      const aportes = p.aportes.filter((a) =>
        a.detalles.some((d) => (f.personaId === null || d.personaId === f.personaId) && (f.metodo === null || d.metodoCanonico === f.metodo))
      );
      return { ...p, aportes };
    })
    .filter((p) => !filtraAportes || p.aportes.length > 0);
}

/** Personas que aparecen en algún aporte (para el filtro). */
export function personasEnAportes(periodos: PeriodoCarro[]): Array<{ id: number; nombre: string }> {
  const mapa = new Map<number, string>();
  for (const p of periodos) for (const a of p.aportes) for (const d of a.detalles) mapa.set(d.personaId, d.personaNombre ?? `Persona ${d.personaId}`);
  return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Impacto de registrar `total` más en un mes: lo que faltaría o el saldo a favor que quedaría. */
export function proyeccionDelMes(
  periodo: Pick<PeriodoCarro, 'valorCuotaObjetivo' | 'montoAbonado'> | null,
  total: number,
  yaAportadoPorEsteAporte = 0
): { abonadoDespues: number; faltante: number; excedente: number } | null {
  if (!periodo) return null;
  const abonadoDespues = Math.round((periodo.montoAbonado - yaAportadoPorEsteAporte + total) * 100) / 100;
  const diferencia = Math.round((abonadoDespues - periodo.valorCuotaObjetivo) * 100) / 100;
  return { abonadoDespues, faltante: diferencia < 0 ? -diferencia : 0, excedente: diferencia > 0 ? diferencia : 0 };
}
