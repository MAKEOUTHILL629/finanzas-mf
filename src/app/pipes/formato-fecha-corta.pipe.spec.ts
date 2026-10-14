import { FormatoFechaCortaPipe } from './formato-fecha-corta.pipe';

describe('FormatoFechaCortaPipe', () => {
  const pipe = new FormatoFechaCortaPipe();

  it('epoch-ms 00:00 UTC y ISO de medianoche UTC → el mismo día del calendario', () => {
    expect(pipe.transform(Date.UTC(2026, 9, 15))).toBe('15 oct 2026');
    expect(pipe.transform('2026-10-15T00:00:00.000Z')).toBe('15 oct 2026');
    expect(pipe.transform(Date.UTC(2027, 0, 1))).toBe('1 ene 2027');
  });

  it('yyyy-MM-dd y Date locales conservan su día', () => {
    expect(pipe.transform('2026-12-31')).toBe('31 dic 2026');
    expect(pipe.transform(new Date(2026, 3, 5))).toBe('5 abr 2026');
  });

  it('vacío o inválido → raya larga', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('')).toBe('—');
    expect(pipe.transform('no es fecha')).toBe('—');
  });
});
