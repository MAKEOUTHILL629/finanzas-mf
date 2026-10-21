import { generarLinkWhatsAppAporteCarro, generarLinkWhatsAppPagoPrestamo, generarMensajeWhatsAppAporteCarro } from './whatsapp.helper';

describe('whatsapp.helper (Fases 6 y 7)', () => {
  it('mensaje de pago de préstamo bien codificado en wa.me', () => {
    const url = generarLinkWhatsAppPagoPrestamo({
      nombrePersona: 'Mi Cuñada',
      telefono: '300 123 4567',
      montoPagado: 200000,
      cuentaDestinoDetalle: 'Nequi 3001234567 - Cuñada',
      fechaPago: '20/10/2026',
      montoInicial: 1000000,
      totalAbonado: 200000,
      saldoPendiente: 800000,
      fechaCompromisoPago: '15/11/2026',
      urlPublicaComprobante: 'https://app.example/p/prestamo/token123',
    });
    expect(url.startsWith('https://wa.me/3001234567?text=')).toBeTrue();
    const texto = decodeURIComponent(url.split('?text=')[1]);
    expect(texto).toContain('Valor pagado hoy');
    expect(texto).toContain('Nequi 3001234567 - Cuñada');
    expect(texto).toContain('https://app.example/p/prestamo/token123');
  });

  it('resumen del carro: último aporte y consolidado del mes', () => {
    const texto = generarMensajeWhatsAppAporteCarro({
      ultimoAporte: { fecha: '2026-10-20', aportante: 'Papá', monto: 50000, concepto: 'Carrera' },
      resumenPeriodo: {
        nombrePeriodoMes: 'Octubre 2026',
        metaMes: 600000,
        totalRecaudadoMes: 450000,
        desglosePorPersona: [{ nombre: 'Papá', monto: 300000 }, { nombre: 'Felipe', monto: 150000 }],
        excedenteAcumulado: 0,
        saldoFaltanteMes: 150000,
      },
    });
    expect(texto).toContain('Resumen Aportes del Carro — Octubre 2026');
    expect(texto).toContain('Nuevo aporte registrado');
    expect(texto).toContain('Pendiente por cubrir este mes');
    const url = generarLinkWhatsAppAporteCarro({ resumenPeriodo: { nombrePeriodoMes: 'Octubre 2026', metaMes: 1, totalRecaudadoMes: 1, desglosePorPersona: [], excedenteAcumulado: 0, saldoFaltanteMes: 0 } });
    expect(url.startsWith('https://wa.me/?text=')).toBeTrue();
  });
});
