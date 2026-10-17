import { ReportePublico } from '../modelos/cobros-personas';
import {
  accionesPara,
  analisisMonto,
  claseMetodoPago,
  descuentoDeAccion,
  errorDeNumeroMetodo,
  etiquetaMetodoPago,
  etiquetaResolucion,
  numeroLegible,
  reporteRechazadoReciente,
  saldoTrasDescuento,
  textoACopiar,
  tonoObjecion,
} from './cobros-fase6.helpers';

describe('medios de pago', () => {
  it('errorDeNumeroMetodo valida cada tipo igual que el servidor', () => {
    expect(errorDeNumeroMetodo('CUENTA_AHORROS', '123-456789-01')).toBeNull();
    expect(errorDeNumeroMetodo('CUENTA_AHORROS', '12345')).toContain('6 y 25 dígitos');
    expect(errorDeNumeroMetodo('NEQUI', '300 123 4567')).toBeNull();
    expect(errorDeNumeroMetodo('DAVIPLATA', '+57 310 123 4567')).toBeNull();
    expect(errorDeNumeroMetodo('NEQUI', '1234567890')).toContain('celular');
    expect(errorDeNumeroMetodo('LLAVE', '@felipe123')).toBeNull();
    expect(errorDeNumeroMetodo('LLAVE', 'hola; DROP')).toContain('llave');
    expect(errorDeNumeroMetodo('OTRO', 'Efectivo en mano')).toBeNull();
    expect(errorDeNumeroMetodo('OTRO', 'ab')).toContain('Escribe');
    expect(errorDeNumeroMetodo('NEQUI', null)).toContain('Escribe');
  });

  it('numeroLegible: celulares 3-3-4 y cuentas en grupos de 4 (si venían sin separadores); lo demás, tal cual', () => {
    expect(numeroLegible('NEQUI', '3001234567')).toBe('300 123 4567');
    expect(numeroLegible('NEQUI', '300-123-4567')).toBe('300 123 4567');
    expect(numeroLegible('CUENTA_AHORROS', '12345678901')).toBe('1234 5678 901');
    expect(numeroLegible('CUENTA_AHORROS', '123-456789-01')).toBe('123-456789-01'); // el formato que escribió la persona se respeta
    expect(numeroLegible('LLAVE', '@felipe123')).toBe('@felipe123');
    expect(numeroLegible('NEQUI', null)).toBe('');
  });

  it('textoACopiar deja solo lo que se pega en la app del banco', () => {
    expect(textoACopiar({ tipo: 'NEQUI', numero: '300 123 4567' })).toBe('3001234567');
    expect(textoACopiar({ tipo: 'DAVIPLATA', numero: '+57 310 123 4567' })).toBe('3101234567');
    expect(textoACopiar({ tipo: 'CUENTA_AHORROS', numero: '123-456789-01' })).toBe('12345678901');
    expect(textoACopiar({ tipo: 'LLAVE', numero: ' @felipe123 ' })).toBe('@felipe123');
    expect(textoACopiar({ tipo: 'OTRO', numero: 'Entrega en mano' })).toBe('Entrega en mano');
  });

  it('etiquetas y clases tienen valor por defecto', () => {
    expect(etiquetaMetodoPago('NEQUI')).toBe('Nequi');
    expect(etiquetaMetodoPago('XYZ')).toBe('Medio de pago');
    expect(claseMetodoPago('NEQUI')).toBe('wallet--morado');
    expect(claseMetodoPago('CUENTA_AHORROS')).toBe('wallet--azul');
    expect(claseMetodoPago(undefined)).toBe('wallet--azul');
  });
});

describe('analisisMonto — abono parcial', () => {
  it('compara lo pagado con lo que se debe', () => {
    expect(analisisMonto('', 100000)).toEqual({ tipo: 'vacio', restante: 0, exceso: 0 });
    expect(analisisMonto(null, 100000).tipo).toBe('vacio');
    expect(analisisMonto(0, 100000).tipo).toBe('invalido');
    expect(analisisMonto('abc', 100000).tipo).toBe('invalido');
    expect(analisisMonto(100000, 100000)).toEqual({ tipo: 'total', restante: 0, exceso: 0 });
    expect(analisisMonto('20000', 100000)).toEqual({ tipo: 'parcial', restante: 80000, exceso: 0 });
    expect(analisisMonto(150000.5, 100000)).toEqual({ tipo: 'exceso', restante: 0, exceso: 50000.5 });
  });

  it('sin deuda, cualquier pago es «de más»', () => {
    expect(analisisMonto(5000, 0)).toEqual({ tipo: 'exceso', restante: 0, exceso: 5000 });
  });

  it('no arrastra el error binario (0.1 + 0.2)', () => {
    expect(analisisMonto(0.1, 0.3).restante).toBe(0.2);
  });
});

describe('reporteRechazadoReciente', () => {
  const r = (id: number, estado: ReportePublico['estado']): ReportePublico => ({ id, monto: 1000, fechaPago: '2026-10-01', estado, motivoRechazo: estado === 'RECHAZADO' ? 'No coincide' : null, montoAprobado: null, creadoEn: null, conComprobante: true });

  it('devuelve el último rechazado mientras nada posterior lo reemplace', () => {
    expect(reporteRechazadoReciente([])).toBeNull();
    expect(reporteRechazadoReciente([r(1, 'APROBADO')])).toBeNull();
    expect(reporteRechazadoReciente([r(3, 'RECHAZADO'), r(2, 'APROBADO')])?.id).toBe(3);
    expect(reporteRechazadoReciente([r(2, 'RECHAZADO'), r(3, 'RECHAZADO')])?.id).toBe(3);
  });

  it('si después envió otro (pendiente o aprobado), el rechazo ya no se muestra', () => {
    expect(reporteRechazadoReciente([r(1, 'RECHAZADO'), r(2, 'PENDIENTE')])).toBeNull();
    expect(reporteRechazadoReciente([r(1, 'RECHAZADO'), r(2, 'APROBADO')])).toBeNull();
  });
});

describe('descuentoDeAccion (vista previa de la resolución)', () => {
  it('MANTENER no toca el saldo', () => {
    expect(descuentoDeAccion('MANTENER', 61500, null, 200000)).toEqual({ descuento: null, error: null });
  });

  it('AJUSTAR: lo cobrado menos el monto nuevo; falta el monto → sin error todavía', () => {
    expect(descuentoDeAccion('AJUSTAR', 61500, 40000, 200000)).toEqual({ descuento: 21500, error: null });
    expect(descuentoDeAccion('AJUSTAR', 61500, 0, 200000)).toEqual({ descuento: 61500, error: null });
    expect(descuentoDeAccion('AJUSTAR', 61500, '', 200000)).toEqual({ descuento: null, error: null });
    expect(descuentoDeAccion('AJUSTAR', 61500, 61500, 200000).error).toContain('menor a lo cobrado');
    expect(descuentoDeAccion('AJUSTAR', 61500, -5, 200000).error).toContain('negativo');
    expect(descuentoDeAccion('AJUSTAR', null, 100, 200000).error).toContain('cobro');
    expect(descuentoDeAccion('AJUSTAR', -50000, 100, 200000).error).toContain('cobro'); // un abono
  });

  it('EXCLUIR descuenta todo el rubro y solo si es un cobro', () => {
    expect(descuentoDeAccion('EXCLUIR', 61500, null, 200000)).toEqual({ descuento: 61500, error: null });
    expect(descuentoDeAccion('EXCLUIR', null, null, 200000).error).toContain('cobro');
    expect(descuentoDeAccion('EXCLUIR', -1, null, 200000).error).toContain('cobro');
  });

  it('DESCUENTO: mayor a 0 y sin pasar de lo que debe', () => {
    expect(descuentoDeAccion('DESCUENTO', null, 50000, 200000)).toEqual({ descuento: 50000, error: null });
    expect(descuentoDeAccion('DESCUENTO', null, 200000, 200000).descuento).toBe(200000);
    expect(descuentoDeAccion('DESCUENTO', null, 200000.01, 200000).error).toContain('no puede pasar');
    expect(descuentoDeAccion('DESCUENTO', null, 0, 200000).error).toContain('mayor a 0');
    expect(descuentoDeAccion('DESCUENTO', null, '', 200000)).toEqual({ descuento: null, error: null });
  });

  it('saldoTrasDescuento y accionesPara', () => {
    expect(saldoTrasDescuento(61500, 21500)).toBe(40000);
    expect(saldoTrasDescuento(61500, null)).toBe(61500);
    expect(saldoTrasDescuento(0.3, 0.1)).toBe(0.2);
    expect(accionesPara(61500).map((a) => a.valor)).toEqual(['MANTENER', 'AJUSTAR', 'EXCLUIR', 'DESCUENTO']);
    expect(accionesPara(null).map((a) => a.valor)).toEqual(['MANTENER', 'DESCUENTO']);
    expect(accionesPara(-20000).map((a) => a.valor)).toEqual(['MANTENER', 'DESCUENTO']);
  });

  it('etiquetas y tonos de las observaciones', () => {
    expect(etiquetaResolucion('AJUSTADA')).toBe('Monto ajustado');
    expect(etiquetaResolucion(null)).toBe('Resuelta');
    expect(tonoObjecion({ estado: 'ABIERTA', resolucion: null })).toBe('warning');
    expect(tonoObjecion({ estado: 'RESUELTA', resolucion: 'MANTENIDA' })).toBe('neutral');
    expect(tonoObjecion({ estado: 'RESUELTA', resolucion: 'EXCLUIDA' })).toBe('success');
  });
});
