import {
  aCentavos2,
  cuotaFrancesa,
  tasaEfectivaAnual,
  tasaImplicitaDeCuota,
  tasaMensualDeEntrada,
  tasaMensualDesdeEfectivaAnual,
} from './amortizacion-francesa.helper';

describe('amortizacion-francesa.helper (espejo del backend)', () => {
  describe('cuotaFrancesa', () => {
    it('coincide con la fórmula P·i·(1+i)ⁿ/((1+i)ⁿ−1)', () => {
      for (const [p, tasa, n] of [[6_000_000, 1.5, 12], [12_345_678, 2.15, 36], [800_000, 0.8, 6]] as const) {
        const i = tasa / 100;
        const esperada = (p * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
        expect(cuotaFrancesa(p, tasa, n)).toBeCloseTo(esperada, 1);
      }
    });

    it('con tasa 0 reparte el saldo en partes iguales', () => {
      expect(cuotaFrancesa(1_200_000, 0, 12)).toBe(100_000);
    });

    it('devuelve null con datos que no sirven (en vez de NaN)', () => {
      expect(cuotaFrancesa(0, 2, 12)).toBeNull();
      expect(cuotaFrancesa(1_000_000, -1, 12)).toBeNull();
      expect(cuotaFrancesa(1_000_000, 25, 12)).toBeNull();
      expect(cuotaFrancesa(1_000_000, 2, 0)).toBeNull();
      expect(cuotaFrancesa(1_000_000, 2, 1.5)).toBeNull();
      expect(cuotaFrancesa(NaN, 2, 12)).toBeNull();
    });
  });

  describe('conversión de tasas', () => {
    it('E.A. ↔ M.V. son inversas', () => {
      expect(tasaMensualDesdeEfectivaAnual(20)).toBeCloseTo(1.530947, 5);
      expect(tasaEfectivaAnual(2)).toBeCloseTo(26.82418, 4);
      expect(tasaEfectivaAnual(tasaMensualDesdeEfectivaAnual(23.5))).toBeCloseTo(23.5, 8);
    });

    it('tasaMensualDeEntrada convierte la anual y rechaza lo inválido o mayor a 20 % mensual', () => {
      expect(tasaMensualDeEntrada('mensual', 1.9)).toBe(1.9);
      expect(tasaMensualDeEntrada('anual', 20)).toBeCloseTo(1.530947, 5);
      expect(tasaMensualDeEntrada('mensual', 0)).toBe(0);
      expect(tasaMensualDeEntrada('mensual', null)).toBeNull();
      expect(tasaMensualDeEntrada('mensual', -1)).toBeNull();
      expect(tasaMensualDeEntrada('mensual', 21)).toBeNull();
      expect(tasaMensualDeEntrada('anual', 900)).toBeNull();
    });
  });

  describe('tasaImplicitaDeCuota', () => {
    it('recupera la tasa con la que se calculó la cuota', () => {
      for (const [p, tasa, n] of [[6_000_000, 1.5, 12], [20_000_000, 2.3, 48], [3_000_000, 0.9, 24]] as const) {
        const cuota = cuotaFrancesa(p, tasa, n) as number;
        expect(tasaImplicitaDeCuota(p, n, cuota)).toBeCloseTo(tasa, 2);
      }
    });

    it('una cuota que no baja de P/n implica tasa 0 y una mayor, tasa mayor', () => {
      expect(tasaImplicitaDeCuota(1_200_000, 12, 100_000)).toBe(0);
      const anunciada = cuotaFrancesa(6_000_000, 1.5, 12) as number;
      expect(tasaImplicitaDeCuota(6_000_000, 12, anunciada + 15_000)).toBeGreaterThan(1.5);
    });

    it('null si la cuota no alcanza a devolver el capital o exige más de 20 % mensual', () => {
      expect(tasaImplicitaDeCuota(1_200_000, 12, 99_000)).toBeNull();
      expect(tasaImplicitaDeCuota(1_200_000, 12, 1_150_000)).toBeNull();
      expect(tasaImplicitaDeCuota(0, 12, 1_000)).toBeNull();
    });
  });

  it('aCentavos2 redondea a centavos sin el error binario de 1.005', () => {
    expect(aCentavos2(1.005)).toBe(1.01);
    expect(aCentavos2(2.675)).toBe(2.68);
    expect(aCentavos2(100)).toBe(100);
  });
});
