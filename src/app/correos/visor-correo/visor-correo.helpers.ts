/**
 * Lectura del cuerpo de un correo del banco para el visor: limpia lo que estorba (enlaces de imágenes) y marca lo que sirve para
 * conciliar —montos, fechas, los últimos 4 dígitos y el comercio—. Todo son funciones puras.
 */

export type TipoToken = 'monto' | 'fecha' | 'ultimos4' | 'comercio';

export interface TokenCuerpo {
  tipo: TipoToken;
  /** Monto → número; fecha → `yyyy-MM-dd`; últimos 4 → `1927`; comercio → el texto tal cual aparece. */
  valor: string | number;
  /** Texto para el tooltip y el lector de pantalla: «Usar como monto». */
  accion: string;
}

export interface SegmentoCuerpo {
  texto: string;
  token: TokenCuerpo | null;
}

/** El campo `cuerpo_extraido` que guarda el sync se recorta a este largo. */
export const LIMITE_CUERPO = 1500;

const IMAGENES_O_ENLACES = /\s*\[https?:\/\/[^\]\s]*\]/gi;
const ENLACES_SUELTOS = /https?:\/\/\S+/gi;
const ALT_DE_ICONOS = /\bicon\d+\b/gi;
/** A partir de aquí el correo es pie de página y publicidad. */
const PIE_DEL_CORREO = /(Si tienes dudas|Estamos cerca|Siempre contigo|Controla tu dinero|Conoce cu[aá]nto)/i;

export interface CuerpoLimpio {
  /** El aviso en sí: lo que el banco cuenta del movimiento. */
  principal: string;
  /** Pie de página y publicidad (se muestra plegado). */
  resto: string;
  recortado: boolean;
}

/** Quita enlaces e imágenes, normaliza espacios y separa el aviso de su pie de página. */
export function limpiarCuerpo(cuerpo: string | null | undefined): CuerpoLimpio {
  const original = cuerpo ?? '';
  const texto = original.replace(IMAGENES_O_ENLACES, '').replace(ENLACES_SUELTOS, '').replace(ALT_DE_ICONOS, '').replace(/\s+/g, ' ').trim();
  const corte = texto.search(PIE_DEL_CORREO);
  const hayPie = corte > 20; // si el aviso es el pie mismo, se muestra completo
  return {
    principal: hayPie ? texto.slice(0, corte).trim() : texto,
    resto: hayPie ? texto.slice(corte).trim() : '',
    recortado: original.length >= LIMITE_CUERPO,
  };
}

/** Las primeras frases del aviso (hasta ~250 caracteres): sirven de «descripción» del movimiento. */
export function descripcionDelCuerpo(cuerpo: string | null | undefined): string {
  const { principal } = limpiarCuerpo(cuerpo);
  if (!principal) return '';
  // una frase termina en . ! ? seguido de espacio y mayúscula (los puntos de «35.625,00» no la cortan)
  const frases = principal.replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/g, '$1|||').split('|||');
  let salida = '';
  for (const f of frases) {
    if ((salida + ' ' + f).trim().length > 250 && salida) break;
    salida = (salida + ' ' + f).trim();
  }
  return salida.slice(0, 255);
}

// ───────────────────────────── parseo ─────────────────────────────

/**
 * «COP35.625,00» → 35625 · «USD0,99» → 0.99 · «$50.000» → 50000 · «$49.99» → 49.99. Formato colombiano (punto de miles, coma decimal),
 * pero un único separador con 1–2 decimales se toma como decimal. `null` si no hay un número positivo.
 */
export function parsearMonto(texto: string): number | null {
  const s = texto.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  const punto = s.lastIndexOf('.');
  const coma = s.lastIndexOf(',');
  let normal: string;
  if (punto >= 0 && coma >= 0) {
    const decimal = punto > coma ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    normal = s.split(miles).join('').replace(decimal, '.');
  } else if (punto >= 0 || coma >= 0) {
    const separador = coma >= 0 ? ',' : '.';
    const partes = s.split(separador);
    const ultimo = partes[partes.length - 1];
    const entera = partes[0];
    if (partes.length > 2) normal = partes.join('');
    else if (ultimo.length === 3 && entera.length >= 1 && entera.length <= 3 && entera !== '0') normal = partes.join('');
    else normal = `${entera}.${ultimo}`;
  } else {
    normal = s;
  }
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function fechaValida(anio: number, mes: number, dia: number): string | null {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** «15/10/2026» (día primero), «15-10-2026», «2026-10-15» o «15 de octubre de 2026» → `yyyy-MM-dd`; `null` si no es una fecha real. */
export function parsearFecha(texto: string): string | null {
  const t = texto.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return fechaValida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (m) return fechaValida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i.exec(t);
  if (m && MESES[m[2].toLowerCase()]) return fechaValida(Number(m[3]), MESES[m[2].toLowerCase()], Number(m[1]));
  return null;
}

// ───────────────────────────── marcado ─────────────────────────────

const RE_MONTO = /(?:\$|\b(?:COP|USD|EUR))\s?\d+(?:[.,]\d+)*/gi;
const RE_FECHA = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b|\b\d{1,2} de [a-záéíóú]+ de \d{4}\b/gi;
const RE_ULTIMOS4 = /\*\s?(\d{4})\b|\b(?:terminad[ao]s?|finalizad[ao]s?)\s+en\s+(\d{4})\b/gi;

interface Hallazgo {
  inicio: number;
  fin: number;
  token: TokenCuerpo;
}

function hallazgos(texto: string, comercio: string | null | undefined): Hallazgo[] {
  const salida: Hallazgo[] = [];
  for (const m of texto.matchAll(RE_MONTO)) {
    const valor = parsearMonto(m[0]);
    if (valor !== null) salida.push({ inicio: m.index!, fin: m.index! + m[0].length, token: { tipo: 'monto', valor, accion: 'Usar como monto' } });
  }
  for (const m of texto.matchAll(RE_FECHA)) {
    const valor = parsearFecha(m[0]);
    if (valor !== null) salida.push({ inicio: m.index!, fin: m.index! + m[0].length, token: { tipo: 'fecha', valor, accion: 'Usar como fecha' } });
  }
  for (const m of texto.matchAll(RE_ULTIMOS4)) {
    const digitos = m[1] ?? m[2];
    salida.push({ inicio: m.index!, fin: m.index! + m[0].length, token: { tipo: 'ultimos4', valor: digitos, accion: 'Elegir la tarjeta o cuenta' } });
  }
  const buscado = (comercio ?? '').trim();
  if (buscado.length >= 3) {
    const bajo = texto.toLowerCase();
    const aguja = buscado.toLowerCase();
    for (let i = bajo.indexOf(aguja); i >= 0; i = bajo.indexOf(aguja, i + aguja.length)) {
      salida.push({ inicio: i, fin: i + aguja.length, token: { tipo: 'comercio', valor: texto.slice(i, i + aguja.length), accion: 'Usar como comercio' } });
    }
  }
  return salida;
}

/**
 * Parte el texto en trozos, marcando los que sirven para conciliar. Si dos marcas se pisan gana la que empieza antes (y, a igual
 * inicio, la más larga), así que un comercio como «DL*DIDI FOOD» nunca se parte.
 */
export function segmentarCuerpo(texto: string, comercio?: string | null): SegmentoCuerpo[] {
  if (!texto) return [];
  const ordenados = hallazgos(texto, comercio).sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);
  const segmentos: SegmentoCuerpo[] = [];
  let cursor = 0;
  for (const h of ordenados) {
    if (h.inicio < cursor) continue;
    if (h.inicio > cursor) segmentos.push({ texto: texto.slice(cursor, h.inicio), token: null });
    segmentos.push({ texto: texto.slice(h.inicio, h.fin), token: h.token });
    cursor = h.fin;
  }
  if (cursor < texto.length) segmentos.push({ texto: texto.slice(cursor), token: null });
  return segmentos;
}
