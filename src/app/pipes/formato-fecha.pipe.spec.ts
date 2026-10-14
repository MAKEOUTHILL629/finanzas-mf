import { formatDateOnly, partesFechaCalendario } from '../shared/date-only.helper';
import { FormatoFechaPipe } from './formato-fecha.pipe';

describe('FormatoFechaPipe', () => {
  const pipe = new FormatoFechaPipe();

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('epoch-ms 00:00 UTC del backend → el mismo día del calendario, sin importar la zona horaria del navegador', () => {
    expect(pipe.transform(Date.UTC(2026, 9, 5))).toBe('5 de Octubre del 2026');
    expect(pipe.transform(Date.UTC(2027, 3, 30))).toBe('30 de Abril del 2027');
    expect(pipe.transform(Date.UTC(2026, 0, 1))).toBe('1 de Enero del 2026');
  });

  it('strings yyyy-MM-dd y objetos Date locales conservan su día', () => {
    expect(pipe.transform('2026-10-05')).toBe('5 de Octubre del 2026');
    expect(pipe.transform(new Date(2026, 9, 5))).toBe('5 de Octubre del 2026');
  });

  it('valores vacíos o inválidos → cadena vacía', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('no es fecha')).toBe('');
  });
});

describe('date-only.helper', () => {
  it('formatDateOnly: epoch-ms del backend → yyyy-MM-dd del mismo día (no reenvía la fecha corrida un día)', () => {
    expect(formatDateOnly(Date.UTC(2026, 9, 5))).toBe('2026-10-05');
    expect(formatDateOnly(Date.UTC(2026, 11, 31))).toBe('2026-12-31');
  });

  it('formatDateOnly: strings y Date locales no se desplazan', () => {
    expect(formatDateOnly('2026-10-05')).toBe('2026-10-05');
    expect(formatDateOnly(new Date(2026, 9, 5))).toBe('2026-10-05');
  });

  it('partesFechaCalendario', () => {
    expect(partesFechaCalendario(Date.UTC(2026, 9, 5))).toEqual({ dia: 5, mes: 9, anio: 2026 });
    expect(partesFechaCalendario(new Date(2026, 9, 5))).toEqual({ dia: 5, mes: 9, anio: 2026 });
  });
});
