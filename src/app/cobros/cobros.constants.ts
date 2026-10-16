import { DetalleItemLiquidacion } from '../modelos/aportes';
import { CategoriaCobro, EstadoReporte, MedioPago, ModoDivision } from '../modelos/cobros-personas';
import { aCentavos } from '../shared/dinero.helper';
import { moneda } from '../shared/moneda.util';
import { nombrePeriodo } from '../shared/periodo.helper';

// ───────────────────────────── catálogos ─────────────────────────────

export interface OpcionCobro<T extends string> {
  valor: T;
  etiqueta: string;
  icono: string;
}

export const CATEGORIAS_COBRO: ReadonlyArray<OpcionCobro<CategoriaCobro>> = [
  { valor: 'SERVICIO', etiqueta: 'Servicio (luz, agua, internet)', icono: 'bolt' },
  { valor: 'MERCADO', etiqueta: 'Mercado', icono: 'shopping_cart' },
  { valor: 'EVENTO', etiqueta: 'Evento o fiesta', icono: 'celebration' },
  { valor: 'OTRO', etiqueta: 'Otro', icono: 'receipt' },
];

export const MODOS_DIVISION: ReadonlyArray<{ valor: ModoDivision; etiqueta: string; ayuda: string }> = [
  { valor: 'IGUAL', etiqueta: 'A partes iguales', ayuda: 'El total se divide en partes iguales entre quienes marques.' },
  { valor: 'PORCENTAJE', etiqueta: 'Por porcentaje', ayuda: 'Le asignas un % a cada uno; lo que no repartas lo pones tú.' },
  { valor: 'MONTO', etiqueta: 'Monto fijo', ayuda: 'Le asignas un valor a cada uno; lo que sobre del total lo pones tú.' },
];

export const MEDIOS_PAGO: ReadonlyArray<{ valor: MedioPago; etiqueta: string }> = [
  { valor: 'BREB', etiqueta: 'Bre-B / llave' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia bancaria' },
  { valor: 'NEQUI', etiqueta: 'Nequi' },
  { valor: 'DAVIPLATA', etiqueta: 'Daviplata' },
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];

export function etiquetaCategoria(c: string | null | undefined): string {
  return CATEGORIAS_COBRO.find((x) => x.valor === c)?.etiqueta ?? 'Otro';
}

export function iconoCategoria(c: string | null | undefined): string {
  return CATEGORIAS_COBRO.find((x) => x.valor === c)?.icono ?? 'receipt';
}

export function etiquetaMedio(m: string | null | undefined): string {
  return MEDIOS_PAGO.find((x) => x.valor === m)?.etiqueta ?? (m || '—');
}

export function etiquetaEstadoReporte(e: EstadoReporte | string | null | undefined): string {
  return { PENDIENTE: 'Por revisar', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' }[e ?? ''] ?? (e || '—');
}

export function claseEstadoReporte(e: EstadoReporte | string | null | undefined): 'warning' | 'success' | 'danger' | 'neutral' {
  return e === 'PENDIENTE' ? 'warning' : e === 'APROBADO' ? 'success' : e === 'RECHAZADO' ? 'danger' : 'neutral';
}

// ───────────────────────────── reparto (vista previa) ─────────────────────────────

export interface ParticipantePrevia {
  personaId: number;
  /** Texto tal cual lo escribió el usuario (porcentaje en modo PORCENTAJE, monto en MONTO). */
  valor?: string | number | null;
}

export interface ParteCalculada {
  personaId: number;
  monto: number;
  porcentaje: number | null;
  esPropio: boolean;
}

export interface ResultadoReparto {
  partes: ParteCalculada[];
  /** Lo que el propietario pone de su bolsillo (total − lo que se cobra). */
  parteDelPropietario: number;
  montoACobrar: number;
  /** Por qué el reparto no es válido todavía (null si lo es). */
  error: string | null;
}

/**
 * Vista previa del reparto en pantalla. Replica `calcularPartes` del backend (que es la que manda al guardar): se trabaja en
 * centavos enteros, así la suma de las partes es EXACTAMENTE el total y los centavos sobrantes van a los primeros.
 */
export function calcularReparto(total: number | string | null | undefined, modo: ModoDivision, participantes: ParticipantePrevia[], miPersonaId: number | null): ResultadoReparto {
  const vacio = (error: string): ResultadoReparto => ({ partes: [], parteDelPropietario: 0, montoACobrar: 0, error });
  const totalCts = aCentavos(total);
  if (totalCts <= 0) return vacio('Escribe cuánto costó en total.');
  if (participantes.length === 0) return vacio('Marca al menos a una persona.');

  const esMia = (id: number) => miPersonaId !== null && id === miPersonaId;
  let centavos: number[];
  let porcentajes: Array<number | null>;

  if (modo === 'IGUAL') {
    const n = participantes.length;
    const base = Math.floor(totalCts / n);
    const sobrante = totalCts - base * n;
    centavos = participantes.map((_, i) => base + (i < sobrante ? 1 : 0));
    porcentajes = participantes.map(() => null);
  } else if (modo === 'PORCENTAJE') {
    const pcts = participantes.map((p) => Number(p.valor));
    if (pcts.some((v) => !Number.isFinite(v) || v <= 0 || v > 100)) return vacio('Escribe un porcentaje entre 0 y 100 para cada persona.');
    const suma = pcts.reduce((a, v) => a + v, 0);
    if (suma > 100.0001) return vacio(`Los porcentajes suman ${redondear(suma, 4)} %: no pueden superar 100 %.`);
    centavos = pcts.map((v) => Math.round((totalCts * v) / 100));
    if (Math.abs(suma - 100) < 0.0001) centavos[centavos.length - 1] += totalCts - centavos.reduce((a, c) => a + c, 0);
    porcentajes = pcts;
  } else {
    const montos = participantes.map((p) => aCentavos(p.valor));
    if (montos.some((m) => m <= 0)) return vacio('Escribe el monto de cada persona.');
    const suma = montos.reduce((a, m) => a + m, 0);
    if (suma > totalCts) return vacio(`Los montos suman ${moneda(suma / 100)} y superan el total.`);
    centavos = montos;
    porcentajes = montos.map((m) => redondear((m * 100) / totalCts, 2));
  }

  const partes = participantes.map((p, i) => ({ personaId: p.personaId, monto: centavos[i] / 100, porcentaje: porcentajes[i], esPropio: esMia(p.personaId) }));
  const aCobrarCts = partes.filter((p) => !p.esPropio).reduce((a, p) => a + aCentavos(p.monto), 0);
  return { partes, montoACobrar: aCobrarCts / 100, parteDelPropietario: (totalCts - aCobrarCts) / 100, error: null };
}

function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

// ───────────────────────────── enlace para compartir ─────────────────────────────

/** URL pública del enlace: `<origen>/p/<token>`. */
export function urlPublica(token: string, origen: string): string {
  return `${origen.replace(/\/+$/, '')}/p/${token}`;
}

/** Celular colombiano → formato internacional para WhatsApp (`3104445566` → `573104445566`). `null` si no es usable. */
export function telefonoWhatsApp(celular: string | null | undefined): string | null {
  const digitos = (celular ?? '').replace(/\D/g, '');
  if (digitos.length === 10 && digitos.startsWith('3')) return `57${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('57')) return digitos;
  return null;
}

export function textoParaCompartir(nombre: string | null | undefined, periodo: string, url: string, saldo?: number | null): string {
  const quien = (nombre ?? '').trim().split(/\s+/)[0] || 'hola';
  const monto = saldo !== undefined && saldo !== null && saldo > 0 ? ` Quedó por ${moneda(saldo)}.` : '';
  return `Hola ${quien}, este es el detalle de ${nombrePeriodo(periodo)}.${monto} Ahí puedes ver de dónde sale cada valor y avisarme cuando pagues (puedes adjuntar el comprobante): ${url}`;
}

export function enlaceWhatsApp(telefono: string | null, texto: string): string {
  return `https://wa.me/${telefono ?? ''}?text=${encodeURIComponent(texto)}`;
}

/** «Vence en 12 días» / «Vence hoy» (en menos de 24 horas) / «Venció». */
export function vencimientoLegible(expira: string | Date, ahora: Date = new Date()): string {
  const ms = new Date(expira).getTime() - ahora.getTime();
  if (ms < 0) return 'Venció';
  const dias = Math.floor(ms / 86_400_000);
  if (dias === 0) return 'Vence hoy';
  return `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
}


// ───────────────────────────── detalle de un cobro ─────────────────────────────

/** «Cuota 2 de 6 · 50 % de $600.000 · Visa» para una cuota de tarjeta; «Tu parte de $184.500 (a partes iguales)» para un gasto repartido. */
export function lineaDetalle(d: DetalleItemLiquidacion | null | undefined): string | null {
  if (!d) return null;
  if (d.tipo === 'CUOTA_TARJETA') {
    const partes: string[] = [];
    if (d.numeroCuota !== null) {
      const total = d.cuotasQueTePertenecen ?? d.cuotasDeLaCompra;
      partes.push(total && total > 1 ? `Cuota ${d.numeroCuota} de ${total}` : 'Pago único');
    }
    if (d.porcentaje !== null && d.porcentaje !== undefined && Number(d.porcentaje) < 100) {
      partes.push(`${Number(d.porcentaje)} % de ${d.valorCuotaTotal !== null ? moneda(d.valorCuotaTotal) : 'la cuota'}`);
    }
    if (d.valorCompra !== null && (d.cuotasDeLaCompra ?? 1) > 1) partes.push(`compra de ${moneda(d.valorCompra)}`);
    if (d.tarjeta) partes.push(d.tarjeta);
    return partes.length ? partes.join(' · ') : null;
  }
  const modo = d.modoDivision === 'IGUAL' ? 'a partes iguales' : d.modoDivision === 'PORCENTAJE' ? 'por porcentaje' : 'por monto';
  return `Tu parte de ${moneda(d.montoTotal)} (${modo})`;
}
