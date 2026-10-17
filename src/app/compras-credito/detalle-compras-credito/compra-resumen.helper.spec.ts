import { ComprasCreditoMultimoneda, CuotaDetalle } from '../../modelos/compras-credito';
import { datosFaltantesDeCompra, estadoVisualDeCompra, progresoDeCuotas, textoDatosFaltantes } from './compra-resumen.helper';

const completa = (extra: Partial<ComprasCreditoMultimoneda> = {}): ComprasCreditoMultimoneda => ({
  id: 1,
  concepto: 'Nevera',
  valorCompra: 2_400_000,
  numeroCuotas: 12,
  interes: 1.9,
  descripcion: 'Éxito Ibagué',
  estado: 'Pendiente',
  tarjeta: 2,
  porcentajePago: 100,
  plasticoUltimos4: '1927',
  monedaOriginal: 'COP',
  trmConfirmada: true,
  refinanciamientoId: null,
  ...extra,
});

const cuota = (n: number, estado: string | null, capital = 100): CuotaDetalle => ({ numeroCuota: n, estado, aporteCapital: capital, pagoTotal: capital + 10 });

describe('estadoVisualDeCompra', () => {
  it('Pagada, En curso y Cancelada según el estado guardado', () => {
    expect(estadoVisualDeCompra(completa({ estado: 'Pagado' })).etiqueta).toBe('Pagada');
    expect(estadoVisualDeCompra(completa({ estado: 'Pendiente' })).etiqueta).toBe('En curso');
    expect(estadoVisualDeCompra(completa({ estado: 'Cancelado' })).etiqueta).toBe('Cancelada');
    expect(estadoVisualDeCompra(completa({ estado: null as unknown as string })).clave).toBe('en-curso');
  });

  it('una compra con todas las cuotas pagadas es Pagada aunque el estado diga Pendiente', () => {
    const cuotas = [cuota(1, 'Pagado'), cuota(2, 'Pagado')];
    expect(estadoVisualDeCompra(completa({ estado: 'Pendiente' }), cuotas).clave).toBe('pagada');
    expect(estadoVisualDeCompra(completa({ estado: 'Pendiente' }), [cuota(1, 'Pagado'), cuota(2, 'Pendiente')]).clave).toBe('en-curso');
  });

  it('Refinanciada: unificada en una maestra, estado REFINANCIADA o el legado «Ajuste Interes»', () => {
    expect(estadoVisualDeCompra(completa({ refinanciamientoId: 9, estado: 'REFINANCIADA' })).clave).toBe('refinanciada');
    expect(estadoVisualDeCompra(completa({ estado: 'REFINANCIADA' })).tono).toBe('info');
    expect(estadoVisualDeCompra(completa({ estado: 'Ajuste Interes' })).clave).toBe('refinanciada');
    // vinculada pero con estado legado distinto: manda el vínculo
    expect(estadoVisualDeCompra(completa({ refinanciamientoId: 9, estado: 'Pendiente' })).clave).toBe('refinanciada');
  });
});

describe('datosFaltantesDeCompra', () => {
  it('una compra completa no tiene faltantes', () => {
    expect(datosFaltantesDeCompra(completa())).toEqual([]);
  });

  it('detecta tarjeta, plástico, descripción, responsables, interés y TRM sin confirmar', () => {
    const f = (extra: Partial<ComprasCreditoMultimoneda>) => datosFaltantesDeCompra(completa(extra)).map((d) => d.campo);
    expect(f({ plasticoUltimos4: null })).toEqual(['plastico']);
    expect(f({ descripcion: '   ' })).toEqual(['descripcion']);
    expect(f({ porcentajePago: 0 })).toEqual(['responsables']);
    expect(f({ interes: undefined })).toEqual(['interes']);
    expect(f({ monedaOriginal: 'USD', trmConfirmada: false })).toEqual(['trm']);
    expect(f({ monedaOriginal: 'USD', trmConfirmada: true })).toEqual([]);
    expect(f({ tarjeta: undefined })).toEqual(['tarjeta']); // sin tarjeta no se pide plástico
    expect(f({ plasticoUltimos4: null, descripcion: '', porcentajePago: 0 })).toEqual(['plastico', 'descripcion', 'responsables']);
  });

  it('un interés de 0 es un dato válido, no un faltante', () => {
    expect(datosFaltantesDeCompra(completa({ interes: 0 }))).toEqual([]);
  });

  it('una compra unificada en un refinanciamiento no pide completar nada', () => {
    expect(datosFaltantesDeCompra(completa({ refinanciamientoId: 9, descripcion: '', plasticoUltimos4: null }))).toEqual([]);
  });

  it('el texto del aviso concuerda en singular y plural', () => {
    expect(textoDatosFaltantes(1)).toBe('Falta 1 dato por completar');
    expect(textoDatosFaltantes(3)).toBe('Faltan 3 datos por completar');
  });
});

describe('progresoDeCuotas', () => {
  it('cuenta pagadas, ubica la cuota actual y suma el capital que falta', () => {
    const cuotas = [cuota(1, 'Pagado', 100), cuota(2, 'Pagado', 100), cuota(3, 'Pendiente', 100), cuota(4, 'Pendiente', 50.5)];
    const p = progresoDeCuotas(cuotas);
    expect(p).toEqual(jasmine.objectContaining({ total: 4, pagadas: 2, actual: 3, porcentaje: 50, saldoCapital: 150.5, completa: false }));
    expect(p.proxima?.numeroCuota).toBe(3);
  });

  it('con todas pagadas queda completa en «cuota N de N» y sin próxima', () => {
    const p = progresoDeCuotas([cuota(1, 'Pagado'), cuota(2, 'Pagado')]);
    expect(p).toEqual(jasmine.objectContaining({ actual: 2, porcentaje: 100, saldoCapital: 0, completa: true, proxima: null }));
  });

  it('las cuotas REFINANCIADA / Ajuste Interes no cuentan como saldo pendiente', () => {
    const p = progresoDeCuotas([cuota(1, 'Pagado'), cuota(2, 'REFINANCIADA', 300), cuota(3, 'Ajuste Interes', 300)]);
    expect(p.saldoCapital).toBe(0);
    expect(p.pagadas).toBe(1);
  });

  it('sin cuotas cargadas usa el total declarado', () => {
    expect(progresoDeCuotas([], 12)).toEqual(jasmine.objectContaining({ total: 12, pagadas: 0, actual: 1, porcentaje: 0 }));
    expect(progresoDeCuotas([], null).total).toBe(0);
  });
});
