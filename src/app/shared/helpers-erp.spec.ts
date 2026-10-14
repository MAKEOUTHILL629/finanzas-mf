import { FormControl, FormGroup } from '@angular/forms';
import { FormatoMonedaPipe } from '../pipes/formato-moneda.pipe';
import { aCentavos, esImporteValido, porcentajeAvance, restarMonedas, sumarMonedas } from './dinero.helper';
import { formatDateOnly, partesFechaCalendario } from './date-only.helper';
import { mensajeDeError } from './http-error.helper';
import { desplazarPeriodo, esPeriodoValido, finDePeriodo, hoyIso, nombrePeriodo, periodoActual } from './periodo.helper';
import { moneda } from './moneda.util';
import { fechasCoherentes, importeConDosDecimales, importeNoNegativo, importeNoNegativoOpcional, importeOpcional } from './validadores';

describe('dinero.helper', () => {
  it('suma en centavos: 0.1 + 0.2 = 0.3 exacto', () => {
    expect(sumarMonedas([0.1, 0.2])).toBe(0.3);
    expect(sumarMonedas(['1250000.50', 0.25, null, undefined])).toBe(1250000.75);
    expect(restarMonedas(1000000, '0.10')).toBe(999999.9);
  });

  it('aCentavos ignora lo que no es número', () => {
    expect(aCentavos('abc')).toBe(0);
    expect(aCentavos(null)).toBe(0);
    expect(aCentavos(12.345)).toBe(1235);
  });

  it('esImporteValido: > 0 y como máximo 2 decimales (según se escribió)', () => {
    for (const ok of [1, '0.01', 1250000.5, '10', 99.99]) expect(esImporteValido(ok)).toBeTrue();
    for (const mal of [0, '0.00', -5, 1.005, '1.234', 'abc', '', null, undefined, '1e3']) expect(esImporteValido(mal)).toBeFalse();
  });

  it('porcentajeAvance limita a 0-100 y no divide por cero', () => {
    expect(porcentajeAvance(50, 200)).toBe(25);
    expect(porcentajeAvance(333, 1000)).toBe(33.3);
    expect(porcentajeAvance(500, 200)).toBe(100);
    expect(porcentajeAvance(-5, 200)).toBe(0);
    expect(porcentajeAvance(10, 0)).toBe(0);
    expect(porcentajeAvance(null, 100)).toBe(0);
  });
});

describe('periodo.helper', () => {
  it('desplazarPeriodo cruza años en ambos sentidos', () => {
    expect(desplazarPeriodo('2026-12', 1)).toBe('2027-01');
    expect(desplazarPeriodo('2026-01', -1)).toBe('2025-12');
    expect(desplazarPeriodo('2026-10', 14)).toBe('2027-12');
    expect(desplazarPeriodo('2026-10', -10)).toBe('2025-12');
    expect(() => desplazarPeriodo('2026-13', 1)).toThrow();
  });

  it('valida, nombra y calcula el fin del periodo', () => {
    expect(esPeriodoValido('2026-10')).toBeTrue();
    expect(esPeriodoValido('2026-1')).toBeFalse();
    expect(esPeriodoValido(null)).toBeFalse();
    expect(nombrePeriodo('2026-10')).toBe('Octubre 2026');
    expect(nombrePeriodo('x')).toBe('');
    expect(finDePeriodo('2024-02')).toBe('2024-02-29');
    expect(finDePeriodo('2026-02')).toBe('2026-02-28');
    expect(finDePeriodo('2026-12')).toBe('2026-12-31');
  });

  it('periodoActual y hoyIso usan el calendario local', () => {
    const d = new Date(2026, 9, 5, 23, 30);
    expect(periodoActual(d)).toBe('2026-10');
    expect(hoyIso(d)).toBe('2026-10-05');
  });
});

describe('FormatoMonedaPipe / moneda()', () => {
  const pipe = new FormatoMonedaPipe();

  it('siempre 2 decimales, miles con coma y símbolo pegado', () => {
    expect(pipe.transform(1234.5)).toBe('$1,234.50');
    expect(pipe.transform(0)).toBe('$0.00');
    expect(pipe.transform('1250000')).toBe('$1,250,000.00');
  });

  it('negativos entre paréntesis y sin "-0"', () => {
    expect(pipe.transform(-1234.56)).toBe('($1,234.56)');
    expect(pipe.transform(-0.004)).toBe('$0.00');
  });

  it('modo compacto solo para cards', () => {
    expect(pipe.transform(1_200_000, 'compacto')).toBe('$1.2M');
    expect(pipe.transform(450_000, 'compacto')).toBe('$450K');
    expect(pipe.transform(950, 'compacto')).toBe('$950.00');
  });

  it('sin valor → guion', () => {
    for (const v of [null, undefined, '', 'abc', NaN]) expect(pipe.transform(v as never)).toBe('—');
    expect(moneda(10)).toBe('$10.00');
  });
});

describe('mensajeDeError', () => {
  it('traduce los formatos de error del backend', () => {
    expect(mensajeDeError({ error: { message: 'Corte 9 no encontrado' }, status: 404 })).toBe('Corte 9 no encontrado');
    expect(mensajeDeError({ error: { mensaje: 'Falla legacy' }, status: 400 })).toBe('Falla legacy');
    expect(mensajeDeError({ error: { message: ['a', 'b'] }, status: 400 })).toBe('a · b');
    expect(mensajeDeError({ error: { message: 'Datos inválidos', errors: { monto: ['debe ser mayor a 0'] } }, status: 400 })).toBe('monto: debe ser mayor a 0');
    expect(mensajeDeError({ error: 'texto plano', status: 400 })).toBe('texto plano');
  });

  it('casos de red, sesión y servidor', () => {
    expect(mensajeDeError({ status: 0, isNetworkError: true })).toContain('No hay conexión');
    expect(mensajeDeError({ isTimeout: true })).toContain('tardó demasiado');
    expect(mensajeDeError({ status: 401 })).toContain('sesión expiró');
    expect(mensajeDeError({ status: 500, error: {} })).toContain('problema');
    expect(mensajeDeError(null, 'por defecto')).toBe('por defecto');
    expect(mensajeDeError({ status: 400, error: {} }, 'por defecto')).toBe('por defecto');
  });
});

describe('date-only.helper con fechas ISO del módulo ERP', () => {
  it('un ISO a medianoche UTC se lee como su día de calendario, en cualquier huso', () => {
    expect(formatDateOnly('2026-10-05T00:00:00.000Z')).toBe('2026-10-05');
    expect(partesFechaCalendario('2026-10-05T00:00:00.000Z')).toEqual({ dia: 5, mes: 9, anio: 2026 });
  });

  it('un timestamp con hora distinta de 00:00 UTC sigue en hora local', () => {
    const local = partesFechaCalendario('2026-10-05T15:30:00.000Z');
    const d = new Date('2026-10-05T15:30:00.000Z');
    expect(local).toEqual({ dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear() });
  });

  it('epoch-ms y yyyy-MM-dd conservan su día', () => {
    expect(formatDateOnly(Date.UTC(2026, 11, 31))).toBe('2026-12-31');
    expect(formatDateOnly('2026-03-01')).toBe('2026-03-01');
    expect(partesFechaCalendario('2026-03-01')).toEqual({ dia: 1, mes: 2, anio: 2026 });
  });
});

describe('validadores', () => {
  const ctl = (v: unknown) => new FormControl(v);

  it('importeConDosDecimales / importeOpcional', () => {
    expect(importeConDosDecimales(ctl(10.5))).toBeNull();
    expect(importeConDosDecimales(ctl(0))).toEqual({ importe: true });
    expect(importeConDosDecimales(ctl(1.234))).toEqual({ importe: true });
    expect(importeOpcional(ctl(null))).toBeNull();
    expect(importeOpcional(ctl(''))).toBeNull();
    expect(importeOpcional(ctl(-1))).toEqual({ importe: true });
  });

  it('importeNoNegativo acepta 0 pero no negativos ni más de 2 decimales', () => {
    expect(importeNoNegativo(ctl(0))).toBeNull();
    expect(importeNoNegativo(ctl('15.25'))).toBeNull();
    expect(importeNoNegativo(ctl(-1))).toEqual({ importe: true });
    expect(importeNoNegativo(ctl(1.001))).toEqual({ importe: true });
    expect(importeNoNegativo(ctl(null))).toEqual({ importe: true });
    expect(importeNoNegativoOpcional(ctl(null))).toBeNull();
    expect(importeNoNegativoOpcional(ctl(-3))).toEqual({ importe: true });
  });

  it('fechasCoherentes marca el grupo si el fin es anterior al inicio', () => {
    const grupo = (a: string, b: string) => new FormGroup({ inicio: new FormControl(a), fin: new FormControl(b) });
    const v = fechasCoherentes('inicio', 'fin');
    expect(v(grupo('2026-10-10', '2026-10-09'))).toEqual({ fechasInvertidas: true });
    expect(v(grupo('2026-10-10', '2026-10-10'))).toBeNull();
    expect(v(grupo('2026-10-10', ''))).toBeNull();
  });
});
