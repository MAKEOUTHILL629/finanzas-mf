/** Valores con los que arrancan los formularios (`GET /api/sugerencias/formularios`); `null` = no hay de dónde deducirlo. */
export interface DefaultsFormularios {
  tarjetaCreditoId: number | null;
  tarjetaDebitoId: number | null;
  cuentaId: number | null;
  cuotas: number;
  personaPropiaId: number | null;
  /** Quién puso aportes al carro, de más a menos frecuente (ordena el selector, no limita a nadie). */
  personaAporteIds: number[];
  ultimaPersonaCompraId: number | null;
  ultimaPersonaAporteId: number | null;
}

/** Cuando no se pudo consultar: los formularios arrancan como siempre (nunca se bloquean por esto). */
export const DEFAULTS_VACIOS: DefaultsFormularios = {
  tarjetaCreditoId: null,
  tarjetaDebitoId: null,
  cuentaId: null,
  cuotas: 1,
  personaPropiaId: null,
  personaAporteIds: [],
  ultimaPersonaCompraId: null,
  ultimaPersonaAporteId: null,
};

/** Un comercio que ya usaste, con lo habitual de cada campo (`GET /api/sugerencias/comercios`). */
export interface ComercioHabitual {
  concepto: string;
  veces: number;
  /** `yyyy-MM-dd`. */
  ultimaFecha: string | null;
  cuotas: number | null;
  /** Lo que costó la última compra a crédito ahí. */
  ultimoValor: number | null;
  tarjetaId: number | null;
  categoriaId: number | null;
  cuentaId: number | null;
  personaId: number | null;
}
