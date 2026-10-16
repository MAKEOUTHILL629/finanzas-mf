import {
  ActualizarRecurrentePersona,
  CrearRecurrentePersona,
  FiltroRecurrentesPersona,
  ModalidadDuracion,
  NaturalezaRecurrentePersona,
  RecurrentePersona,
} from '../modelos/aportes';
import { desplazarPeriodo } from '../shared/periodo.helper';
import { EstadoFiltros } from '../shared/ui/filter-bar/filter-bar.types';
import { normalizeSearchText } from '../shared/utils';

export function etiquetaNaturaleza(n: NaturalezaRecurrentePersona | string): string {
  return n === 'ABONO_A_FAVOR' ? 'Saldo a favor / descuento mensual' : 'Me debe pagar cada mes';
}

export function etiquetaNaturalezaCorta(n: NaturalezaRecurrentePersona | string): string {
  return n === 'ABONO_A_FAVOR' ? 'A favor' : 'A cobrar';
}

/** Mes en que termina un recurrente por plazo fijo: `2026-10` + 6 meses → `2027-03` (la cuota 1 es el mes de inicio). */
export function mesFinPrevisto(mesInicio: string | null | undefined, numeroMeses: number | string | null | undefined): string | null {
  const n = Number(numeroMeses);
  if (!mesInicio || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesInicio) || !Number.isInteger(n) || n < 1) return null;
  return desplazarPeriodo(mesInicio, n - 1);
}

/** `Vitalicio` o `3 / 6 meses`: lo que se muestra en la tabla. */
export function textoProgreso(r: Pick<RecurrentePersona, 'vitalicio' | 'progreso' | 'numeroMeses' | 'cuotasGeneradas'>): string {
  if (r.vitalicio) return 'Vitalicio';
  return `${r.progreso?.actual ?? r.cuotasGeneradas} / ${r.progreso?.total ?? r.numeroMeses ?? '?'} meses`;
}

export type EstadoVisual = 'activo' | 'pausado' | 'finalizado';

export function estadoVisual(r: Pick<RecurrentePersona, 'activo' | 'estado'>): EstadoVisual {
  if (r.estado === 'FINALIZADO') return 'finalizado';
  return r.activo ? 'activo' : 'pausado';
}

export const ETIQUETA_ESTADO_VISUAL: Record<EstadoVisual, string> = { activo: 'Activo', pausado: 'Pausado', finalizado: 'Finalizado' };

export interface ValoresRecurrente {
  personaId: number | null;
  concepto: string | null;
  valorMensual: number | string | null;
  naturaleza: NaturalezaRecurrentePersona | null;
  modalidadDuracion: ModalidadDuracion | null;
  numeroMeses: number | string | null;
  mesInicio: string | null;
  diaCobro: number | string | null;
  notas: string | null;
}

/** Cuerpo de `POST /recurrentes-persona`: el plazo solo viaja con PLAZO_FIJO (con INDEFINIDO el backend lo rechaza). */
export function construirRecurrente(v: ValoresRecurrente): CrearRecurrentePersona {
  const plazo = v.modalidadDuracion === 'PLAZO_FIJO';
  return {
    personaId: Number(v.personaId),
    concepto: (v.concepto ?? '').trim(),
    valorMensual: String(v.valorMensual),
    naturaleza: (v.naturaleza ?? 'CARGO_A_COBRAR') as NaturalezaRecurrentePersona,
    modalidadDuracion: (v.modalidadDuracion ?? 'INDEFINIDO') as ModalidadDuracion,
    ...(plazo ? { numeroMeses: Number(v.numeroMeses) } : {}),
    mesInicio: v.mesInicio as string,
    ...(v.diaCobro !== null && v.diaCobro !== undefined && v.diaCobro !== '' ? { diaCobro: Number(v.diaCobro) } : {}),
    ...(v.notas?.trim() ? { notas: v.notas.trim() } : {}),
  };
}

/**
 * Solo lo que cambió respecto al recurrente original (PATCH). Si ya generó cuotas, el mes de inicio y la naturaleza
 * no se envían (el backend los rechaza porque ya están en el estado de cuenta).
 */
export function cambiosDeRecurrente(original: RecurrentePersona, v: ValoresRecurrente): ActualizarRecurrentePersona {
  const nuevo = construirRecurrente({ ...v, personaId: original.personaId });
  const cambios: ActualizarRecurrentePersona = {};
  if (nuevo.concepto !== original.concepto) cambios.concepto = nuevo.concepto;
  if (Number(nuevo.valorMensual) !== Number(original.valorMensual)) cambios.valorMensual = nuevo.valorMensual;
  if (nuevo.modalidadDuracion !== original.modalidadDuracion) cambios.modalidadDuracion = nuevo.modalidadDuracion;
  if (nuevo.modalidadDuracion === 'PLAZO_FIJO' && nuevo.numeroMeses !== original.numeroMeses) cambios.numeroMeses = nuevo.numeroMeses;
  if (original.cuotasGeneradas === 0) {
    if (nuevo.mesInicio !== original.mesInicio) cambios.mesInicio = nuevo.mesInicio;
    if (nuevo.naturaleza !== original.naturaleza) cambios.naturaleza = nuevo.naturaleza;
  }
  if (nuevo.diaCobro !== undefined && nuevo.diaCobro !== original.diaCobro) cambios.diaCobro = nuevo.diaCobro;
  if ((nuevo.notas ?? '') !== (original.notas ?? '')) cambios.notas = nuevo.notas ?? '';
  return cambios;
}

export function filtrarRecurrentes(lista: RecurrentePersona[], f: FiltroRecurrentesPersona): RecurrentePersona[] {
  return lista.filter(
    (r) =>
      (f.personaId === null || f.personaId === undefined || r.personaId === f.personaId) &&
      (f.activo === null || f.activo === undefined || r.activo === f.activo) &&
      (f.modalidadDuracion === null || f.modalidadDuracion === undefined || r.modalidadDuracion === f.modalidadDuracion)
  );
}

export const SEGMENTOS_RECURRENTES = ['todos', 'activo', 'pausado', 'finalizado'] as const;

/**
 * Aplica la barra de filtros: estado rápido (según `estadoVisual`), persona, duración y búsqueda por persona, concepto, notas o valor
 * (sin tildes ni mayúsculas, todas las palabras).
 */
export function filtrarRecurrentesConBarra(lista: RecurrentePersona[], e: EstadoFiltros): RecurrentePersona[] {
  const persona = e.valores['persona'];
  const duracion = e.valores['duracion'];
  const base = filtrarRecurrentes(lista, {
    personaId: persona === undefined || persona === null || persona === '' || Array.isArray(persona) ? null : Number(persona),
    activo: null,
    modalidadDuracion: duracion === 'INDEFINIDO' || duracion === 'PLAZO_FIJO' ? duracion : null,
  });
  const palabras = normalizeSearchText(e.busqueda ?? '').split(/\s+/).filter(Boolean);
  return base.filter((r) => {
    if (e.segmento && e.segmento !== 'todos' && estadoVisual(r) !== e.segmento) return false;
    if (palabras.length === 0) return true;
    const texto = normalizeSearchText([r.personaNombre, r.concepto, r.notas, r.valorMensual, etiquetaNaturalezaCorta(r.naturaleza), r.vitalicio ? 'vitalicio' : ''].join(' '));
    return palabras.every((w) => texto.includes(w));
  });
}

/** Cuántos recurrentes caen en cada estado rápido con el resto de filtros aplicados. */
export function conteoRecurrentes(lista: RecurrentePersona[], e: EstadoFiltros): Record<(typeof SEGMENTOS_RECURRENTES)[number], number> {
  const sin = filtrarRecurrentesConBarra(lista, { ...e, segmento: 'todos' });
  return {
    todos: sin.length,
    activo: sin.filter((r) => estadoVisual(r) === 'activo').length,
    pausado: sin.filter((r) => estadoVisual(r) === 'pausado').length,
    finalizado: sin.filter((r) => estadoVisual(r) === 'finalizado').length,
  };
}

/** Lo que cobran (+) o descuentan (−) cada mes los recurrentes activos: para el resumen de la pantalla. */
export function totalMensual(lista: RecurrentePersona[]): { cobros: number; favores: number } {
  let cobros = 0;
  let favores = 0;
  for (const r of lista) {
    if (!r.activo || r.estado === 'FINALIZADO') continue;
    const centavos = Math.round(Number(r.valorMensual) * 100);
    if (r.naturaleza === 'ABONO_A_FAVOR') favores += centavos;
    else cobros += centavos;
  }
  return { cobros: cobros / 100, favores: favores / 100 };
}
