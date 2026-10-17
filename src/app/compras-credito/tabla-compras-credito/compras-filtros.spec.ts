import { ComprasCredito } from '../../modelos/compras-credito';
import { estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';
import { conteoPorSegmento, filtrarCompras, idsResponsables, segmentoDe, textoBuscable } from './compras-filtros';

const ctx = {
  nombreTarjeta: (id: number | null | undefined) => (id === 1 ? 'Visa ··1927' : id === 2 ? 'Amex ··9587' : ''),
  nombrePersona: (id: number) => ({ 1: 'Felipe', 2: 'Andrés', 3: 'Papá' })[id as 1 | 2 | 3] ?? '',
};

const compra = (extra: Partial<ComprasCredito>): ComprasCredito => ({
  id: 1,
  concepto: 'Nevera Samsung',
  descripcion: 'Éxito Ibagué',
  valorCompra: 2800000,
  pagoMensual: 233333,
  numeroCuotas: 12,
  fechaCompra: new Date('2026-08-02T00:00:00Z'),
  fechaUltimaCuota: new Date('2027-07-28T00:00:00Z'),
  estado: 'Pendiente',
  tarjeta: 1,
  responsables: '1,2',
  porcentajePago: 100,
  ...extra,
});

const DATOS: ComprasCredito[] = [
  compra({ id: 1 }),
  compra({ id: 2, concepto: 'Celular Xiaomi', descripcion: undefined, valorCompra: 900000, numeroCuotas: 6, estado: 'Pagado', tarjeta: 2, responsables: '3', porcentajePago: 60, fechaCompra: new Date('2026-03-10T00:00:00Z'), fechaUltimaCuota: new Date('2026-08-10T00:00:00Z') }),
  compra({ id: 3, concepto: 'Unificación de deuda', estado: 'Refinanciada', numeroCuotas: 24, tarjeta: 1, responsables: '', porcentajePago: 0, fechaCompra: new Date('2026-09-15T00:00:00Z') }),
  compra({ id: 4, concepto: 'Ajuste de interés', estado: 'Ajuste Interes', tarjeta: 2, responsables: '1', porcentajePago: 100 }),
];

const ids = (l: ComprasCredito[]) => l.map((c) => c.id);

describe('filtros de Compras Crédito', () => {
  it('segmentoDe normaliza el estado (con o sin tildes y mayúsculas)', () => {
    expect(segmentoDe({ estado: 'Pendiente' })).toBe('pendientes');
    expect(segmentoDe({ estado: 'PAGADO' })).toBe('pagadas');
    expect(segmentoDe({ estado: 'Refinanciada' })).toBe('refinanciadas');
    expect(segmentoDe({ estado: 'Pagada por refinanciamiento' })).toBe('refinanciadas');
    expect(segmentoDe({ estado: 'REFINANCIADA' })).toBe('refinanciadas'); // el que deja el asistente de unificación
    expect(segmentoDe({ estado: 'Ajuste Interes' })).toBe('refinanciadas'); // el de los refinanciamientos registrados a mano
    expect(segmentoDe({ estado: 'Cancelado' })).toBeNull();
    expect(segmentoDe({})).toBeNull();
  });

  it('sin filtros devuelve todo; el segmento filtra por estado', () => {
    expect(ids(filtrarCompras(DATOS, estadoVacio('todas'), ctx))).toEqual([1, 2, 3, 4]);
    expect(ids(filtrarCompras(DATOS, estadoVacio('pendientes'), ctx))).toEqual([1]);
    expect(ids(filtrarCompras(DATOS, estadoVacio('pagadas'), ctx))).toEqual([2]);
    expect(ids(filtrarCompras(DATOS, estadoVacio('refinanciadas'), ctx))).toEqual([3, 4]);
  });

  it('el buscador es global: concepto, descripción, tarjeta, personas y monto; sin tildes y por palabras', () => {
    const buscar = (t: string) => ids(filtrarCompras(DATOS, { ...estadoVacio('todas'), busqueda: t }, ctx));
    expect(buscar('nevera')).toEqual([1]);
    expect(buscar('exito')).toEqual([1, 3, 4]); // «Éxito» sin tilde
    expect(buscar('amex')).toEqual([2, 4]);
    expect(buscar('papa')).toEqual([2]); // persona responsable
    expect(buscar('2800000')).toEqual([1, 3, 4]); // monto
    expect(buscar('nevera 12 cuotas')).toEqual([1]);
    expect(buscar('xyz')).toEqual([]);
  });

  it('filtra por persona, tarjeta, cuotas y «sin responsables completos»', () => {
    const con = (valores: Record<string, unknown>) => ids(filtrarCompras(DATOS, { ...estadoVacio('todas'), valores: valores as never }, ctx));
    expect(con({ personas: [3] })).toEqual([2]);
    expect(con({ personas: [1, 3] })).toEqual([1, 2, 4]);
    expect(con({ tarjetas: [2] })).toEqual([2, 4]);
    expect(con({ cuotas: 6 })).toEqual([2]);
    expect(con({ sinResponsables: true })).toEqual([2, 3]);
    expect(con({ personas: [1], tarjetas: [2] })).toEqual([4]);
  });

  it('los rangos de fecha incluyen el día «hasta» completo', () => {
    const con = (rango: object) => ids(filtrarCompras(DATOS, { ...estadoVacio('todas'), valores: { fechaCompra: rango } as never }, ctx));
    expect(con({ desde: '2026-08-01', hasta: '2026-08-02' })).toEqual([1, 4]);
    expect(con({ desde: '2026-09-01', hasta: null })).toEqual([3]);
    expect(con({ desde: null, hasta: '2026-03-10' })).toEqual([2]);
  });

  it('los contadores por segmento respetan el resto de filtros', () => {
    expect(conteoPorSegmento(DATOS, estadoVacio('todas'), ctx)).toEqual({ todas: 4, pendientes: 1, pagadas: 1, refinanciadas: 2 });
    const solo = conteoPorSegmento(DATOS, { ...estadoVacio('pagadas'), valores: { tarjetas: [1] } }, ctx);
    expect(solo).toEqual({ todas: 2, pendientes: 1, pagadas: 0, refinanciadas: 1 }); // el segmento elegido no recorta los contadores
  });

  it('idsResponsables tolera vacíos y basura; textoBuscable junta todo', () => {
    expect(idsResponsables({ responsables: '1, 2,,x' })).toEqual([1, 2]);
    expect(idsResponsables({})).toEqual([]);
    expect(textoBuscable(DATOS[0], ctx)).toContain('visa');
    expect(textoBuscable(DATOS[0], ctx)).toContain('felipe');
  });
});
