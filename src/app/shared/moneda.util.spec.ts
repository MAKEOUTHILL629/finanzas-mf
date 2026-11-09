import { formatearEntradaMoneda, formatearMonedaConCursor, leerMoneda, normalizarMonedaPegada, textoDeMoneda } from './moneda.util';

describe('moneda.util · dinero en los campos', () => {
  describe('formatearEntradaMoneda', () => {
    it('agrupa los miles con punto y deja una coma decimal con dos cifras como máximo', () => {
      expect(formatearEntradaMoneda('1234567')).toBe('1.234.567');
      expect(formatearEntradaMoneda('1234567,5')).toBe('1.234.567,5');
      expect(formatearEntradaMoneda('1234,567')).toBe('1.234,56');
      expect(formatearEntradaMoneda('12,3,4')).toBe('12,34');
      expect(formatearEntradaMoneda(',5')).toBe('0,5');
      expect(formatearEntradaMoneda('1500,')).toBe('1.500,');
    });

    it('ignora lo que no es cifra: un punto tecleado (son los miles), símbolos y letras', () => {
      expect(formatearEntradaMoneda('$ 2.400.000 COP')).toBe('2.400.000');
      expect(formatearEntradaMoneda('1.500')).toBe('1.500'); // «mil quinientos», nunca «1,5»
      expect(formatearEntradaMoneda('abc')).toBe('');
      expect(formatearEntradaMoneda('')).toBe('');
    });

    it('quita ceros a la izquierda y limita las cifras enteras', () => {
      expect(formatearEntradaMoneda('007')).toBe('7');
      expect(formatearEntradaMoneda('0')).toBe('0');
      expect(formatearEntradaMoneda('1234567890123456')).toBe('123.456.789.012.345');
    });

    it('es idempotente', () => {
      for (const t of ['1.234.567,5', '0,5', '12', '']) expect(formatearEntradaMoneda(t)).toBe(t);
    });

    it('en pesos enteros (0 decimales) no admite parte decimal', () => {
      expect(formatearEntradaMoneda('1500,75', 0)).toBe('1.500');
    });

    it('con más decimales (una TRM)', () => {
      expect(formatearEntradaMoneda('4100,12345', 4)).toBe('4.100,1234');
    });
  });

  describe('leerMoneda', () => {
    it('devuelve el número o null', () => {
      expect(leerMoneda('1.234.567,5')).toBe(1234567.5);
      expect(leerMoneda('$ 1.500')).toBe(1500);
      expect(leerMoneda('0')).toBe(0);
      expect(leerMoneda('')).toBeNull();
      expect(leerMoneda(',')).toBeNull();
      expect(leerMoneda(null)).toBeNull();
      expect(leerMoneda(42)).toBe(42);
      expect(leerMoneda(NaN)).toBeNull();
    });
  });

  describe('textoDeMoneda', () => {
    it('muestra un número, o el texto con punto decimal que manda el servidor, con el formato del campo', () => {
      expect(textoDeMoneda(1500000)).toBe('1.500.000');
      expect(textoDeMoneda(1500.5)).toBe('1.500,5');
      expect(textoDeMoneda('1500000.50')).toBe('1.500.000,5');
      expect(textoDeMoneda(1500.567)).toBe('1.500,56');
      expect(textoDeMoneda(1500.9, 0)).toBe('1.500');
      expect(textoDeMoneda(0)).toBe('0');
    });

    it('lo vacío o que no es número queda vacío', () => {
      expect(textoDeMoneda(null)).toBe('');
      expect(textoDeMoneda(undefined)).toBe('');
      expect(textoDeMoneda('')).toBe('');
      expect(textoDeMoneda('abc')).toBe('');
    });
  });

  describe('normalizarMonedaPegada', () => {
    it('entiende el estilo colombiano y el estadounidense', () => {
      expect(normalizarMonedaPegada('$ 1.500.000,50')).toBe('1500000,50');
      expect(normalizarMonedaPegada('1,500,000.50')).toBe('1500000,50');
      expect(normalizarMonedaPegada('  4.100,5  ')).toBe('4100,5');
    });

    it('con un solo separador, tres cifras detrás son miles; si no, es el decimal', () => {
      expect(normalizarMonedaPegada('1.500')).toBe('1500');
      expect(normalizarMonedaPegada('1,500')).toBe('1500');
      expect(normalizarMonedaPegada('1.500.000')).toBe('1500000');
      expect(normalizarMonedaPegada('12,5')).toBe('12,5');
      expect(normalizarMonedaPegada('1500.50')).toBe('1500,50');
      expect(normalizarMonedaPegada('.5')).toBe(',5');
      expect(normalizarMonedaPegada('0.500')).toBe('0,500');
    });

    it('sin cifras no queda nada', () => {
      expect(normalizarMonedaPegada('abc')).toBe('');
      expect(normalizarMonedaPegada('')).toBe('');
    });
  });

  describe('formatearMonedaConCursor', () => {
    it('al escribir al final, el cursor queda al final', () => {
      expect(formatearMonedaConCursor('1234', 4)).toEqual({ texto: '1.234', cursor: 5 });
      expect(formatearMonedaConCursor('1.2345', 6)).toEqual({ texto: '12.345', cursor: 6 });
    });

    it('al escribir en medio, el cursor se queda detrás de la cifra tecleada aunque cambien los puntos', () => {
      expect(formatearMonedaConCursor('19.234', 2)).toEqual({ texto: '19.234', cursor: 2 });
      expect(formatearMonedaConCursor('1.2.345', 3)).toEqual({ texto: '12.345', cursor: 2 }); // se coló un punto: se ignora
      expect(formatearMonedaConCursor('1.2345', 5)).toEqual({ texto: '12.345', cursor: 5 });
    });

    it('con prefijo: se antepone si hay cifra y el cursor nunca queda dentro de él', () => {
      expect(formatearMonedaConCursor('5', 1, 2, '$ ')).toEqual({ texto: '$ 5', cursor: 3 });
      expect(formatearMonedaConCursor('$ 5', 0, 2, '$ ')).toEqual({ texto: '$ 5', cursor: 2 });
      expect(formatearMonedaConCursor('$ 1234', 6, 2, '$ ')).toEqual({ texto: '$ 1.234', cursor: 7 });
      expect(formatearMonedaConCursor('$ ', 2, 2, '$ ')).toEqual({ texto: '', cursor: 0 });
    });

    it('la coma decimal cuenta como cifra', () => {
      expect(formatearMonedaConCursor('1500,', 5)).toEqual({ texto: '1.500,', cursor: 6 });
    });

    it('si se pasa del máximo de cifras, el cursor queda al final', () => {
      const r = formatearMonedaConCursor('1234567890123456', 16);
      expect(r.cursor).toBe(r.texto.length);
    });
  });
});
