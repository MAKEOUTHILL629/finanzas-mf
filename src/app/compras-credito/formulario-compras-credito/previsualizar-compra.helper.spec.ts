import { EntradaPrevisualizacion, previsualizarCompra } from './previsualizar-compra.helper';

/**
 * Los valores esperados salen de ejecutar el `calcularAmortizacion` REAL del backend (`cobraInteresPrimeraCuota = false`, como en toda
 * compra nueva) con las mismas entradas: si el servidor cambia su regla, estos casos deben cambiar con él.
 */
describe('previsualizarCompra (vista previa de la compra a crédito)', () => {
  const base = (extra: Partial<EntradaPrevisualizacion> = {}): EntradaPrevisualizacion => ({
    valor: 1_200_000, numeroCuotas: 12, interesMensual: 1.9, fechaCompra: '2026-10-29', diaCorte: 15, ...extra,
  });

  it('1,2 M a 12 cuotas al 1,9 %: la 1.ª no lleva interés y la 2.ª paga dos meses', () => {
    const p = previsualizarCompra(base())!;
    expect(p.pagos.slice(0, 4)).toEqual([100_000, 143_700, 119_000, 117_100]);
    expect(p.pagos[11]).toBe(101_900);
    expect(p.interesesTotales).toBe(148_200);
    expect(p.total).toBe(1_348_200);
    expect(p.promedioPorCuota).toBe(112_350);
    expect(p.fechaPrimerPago).toBe('2026-11-30'); // compra el 29 > corte 15 → mes siguiente
    expect(p.fechaUltimoPago).toBe('2027-10-31');
  });

  it('2,5 M a 36 cuotas al 1,8895 % sin día de corte: usa el 15 y coincide con el servidor (a ±medio peso en el total)', () => {
    const p = previsualizarCompra(base({ valor: 2_500_000, numeroCuotas: 36, interesMensual: 1.8895, fechaCompra: '2026-10-10', diaCorte: null }))!;
    expect(p.pagos.slice(0, 4)).toEqual([69_444.44, 162_607.29, 114_057.64, 112_745.49]);
    expect(p.pagos[35]).toBe(70_756.6);
    // el servidor suma con Decimal: aquí los medios centavos de 36 cuotas pueden desviar el total unos centavos (por eso la pantalla muestra pesos enteros)
    expect(p.interesesTotales).toBeCloseTo(873_893.76, 0);
    expect(p.fechaPrimerPago).toBe('2026-10-31'); // compra el 10 ≤ 15 → mismo mes
    expect(p.fechaUltimoPago).toBe('2029-09-30');
  });

  it('con una sola cuota no hay interés (el de la 1.ª cuota nunca se cobra)', () => {
    const p = previsualizarCompra(base({ valor: 500_000, numeroCuotas: 1, interesMensual: 2, fechaCompra: '2026-10-05', diaCorte: null }))!;
    expect(p.pagos).toEqual([500_000]);
    expect(p.interesesTotales).toBe(0);
    expect(p.total).toBe(500_000);
    expect(p.fechaPrimerPago).toBe(p.fechaUltimoPago);
  });

  it('sin interés el total es el valor de la compra (no 99.999,99 por redondear cada cuota)', () => {
    const p = previsualizarCompra(base({ valor: 100_000, numeroCuotas: 3, interesMensual: 0, fechaCompra: '2026-10-20', diaCorte: 25 }))!;
    expect(p.pagos).toEqual([33_333.33, 33_333.33, 33_333.33]);
    expect(p.interesesTotales).toBe(0);
    expect(p.total).toBe(100_000);
  });

  it('cruza el fin de año y febrero: compra el 20-dic con corte 25 → 31-dic, 31-ene y 28-feb', () => {
    const p = previsualizarCompra(base({ valor: 900_000, numeroCuotas: 3, interesMensual: 2.5, fechaCompra: '2026-12-20', diaCorte: 25 }))!;
    expect(p.pagos).toEqual([300_000, 337_500, 307_500]);
    expect(p.interesesTotales).toBe(45_000);
    expect(p.fechaPrimerPago).toBe('2026-12-31');
    expect(p.fechaUltimoPago).toBe('2027-02-28');
  });

  it('una compra tras el corte en diciembre empieza a pagar en enero del año siguiente', () => {
    expect(previsualizarCompra(base({ fechaCompra: '2026-12-29', diaCorte: 15 }))!.fechaPrimerPago).toBe('2027-01-31');
  });

  it('valores no enteros y cuota que no divide exacto (87.500 a 7 cuotas al 1,77 %)', () => {
    const p = previsualizarCompra(base({ valor: 87_500, numeroCuotas: 7, interesMensual: 1.77, fechaCompra: '2027-01-31', diaCorte: 20 }))!;
    expect(p.pagos.slice(0, 4)).toEqual([12_500, 15_376.25, 13_606.25, 13_385]);
    expect(p.pagos[6]).toBe(12_721.25);
    expect(p.interesesTotales).toBe(6_195);
    expect(p.fechaPrimerPago).toBe('2027-02-28');
    expect(p.fechaUltimoPago).toBe('2027-08-31');
  });

  it('sin datos válidos no hay vista previa', () => {
    expect(previsualizarCompra(base({ valor: 0 }))).toBeNull();
    expect(previsualizarCompra(base({ valor: NaN }))).toBeNull();
    expect(previsualizarCompra(base({ numeroCuotas: 0 }))).toBeNull();
    expect(previsualizarCompra(base({ numeroCuotas: 2.5 }))).toBeNull();
    expect(previsualizarCompra(base({ interesMensual: -1 }))).toBeNull();
    expect(previsualizarCompra(base({ interesMensual: NaN }))).toBeNull();
    expect(previsualizarCompra(base({ fechaCompra: '' }))).toBeNull();
    expect(previsualizarCompra(base({ fechaCompra: '2026-02-30' }))).toBeNull();
  });
});
