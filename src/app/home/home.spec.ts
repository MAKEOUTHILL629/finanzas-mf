import { TestBed } from '@angular/core/testing';
import { ResumenDashboard } from '../modelos/dashboard';
import { periodoActual } from '../shared/periodo.helper';
import { API, configurarTestBed, errorHttp, http, verificarHttp } from '../testing/erp-testing';
import { limpiarCachesDeSesion } from '../core/cache-sesion';
import { DashboardService } from '../services/dashboard.service';
import { HomeComponent } from './home.component';
import { construirCascadaDistribucionMensual, construirCurvaFlujoYPatrimonio, construirDonutMultiAnilloCategorias, construirHorizonteDesendeudamientoTarjetas } from '../shared/charts';
import { barrasFlujo, diaDeMovimiento, esEntrada, fraseEjecutiva, iconoMovimiento, porcentaje, primerNombre, saludoSegunHora, textoDias, tonoVencimiento } from './home.constants';

const resumen = (extra: Partial<ResumenDashboard> = {}): ResumenDashboard => ({
  periodo: periodoActual(),
  usuario: { nombre: 'Luis Felipe Hernández' },
  generadoEn: '2026-10-16T19:48:40.069Z',
  liquidez: {
    total: 6000000,
    moneda: 'COP',
    otrasMonedas: [{ moneda: 'USD', saldo: 250 }],
    cuentas: [
      { id: 1, nombre: 'Bancolombia', tipo: 'AHORROS', moneda: 'COP', saldo: 5800000, esPrincipal: true },
      { id: 2, nombre: 'Nequi', tipo: 'BILLETERA_DIGITAL', moneda: 'COP', saldo: 200000, esPrincipal: false },
    ],
    numeroCuentas: 2,
    patrimonioNeto: { valor: 4900000, liquidez: 6000000, porCobrar: 900000, deudaTarjetas: 2000000 },
  },
  flujoMes: { ingresos: 5000000, egresosDirectos: 200000, tarjetas: 200000, recurrentes: 0, porCobrarTerceros: 150000, desembolsoBruto: 400000, gastosPropios: 250000, flujoLibre: 4750000 },
  tarjetas: {
    items: [
      {
        id: 4, nombre: 'Visa · Oro', etiqueta: 'Visa ··1927', cupoTotal: 10000000, cupoUtilizado: 2500000, porcentajeCupo: 25, diaCorte: 15, diaLimitePago: 5,
        pagoDelMes: 200000, miParte: 50000, terceros: 150000, deudaPendiente: 2000000, deudaPendienteMiParte: 800000, vencidoSinRegistrar: 0,
        proximoVencimiento: { periodo: periodoActual(), fecha: '2026-11-05', diasRestantes: 3, monto: 200000, vencido: false },
      },
    ],
    totales: { pagoDelMes: 200000, miParte: 50000, terceros: 150000, deudaPendiente: 2000000, vencidoSinRegistrar: 0, cupoTotal: 10000000, cupoUtilizado: 2500000 },
  },
  porCobrar: {
    pagoDelMes: 150000,
    aPagarAhora: 200000,
    porVencer: 700000,
    deudaTotal: 900000,
    personasConDeuda: 1,
    historicoSinCargar: { cuotas: 0, monto: 0 },
    topDeudores: [{ personaId: 2, nombre: 'Andrés Gómez', iniciales: 'AG', color: '#34C759', pagoDelMes: 150000, aPagarAhora: 200000, porVencer: 700000, deudaTotal: 900000 }],
  },
  proximosVencimientos: [{ tarjetaId: 4, tarjeta: 'Visa ··1927', periodo: periodoActual(), fecha: '2026-11-05', diasRestantes: 3, monto: 200000, vencido: false }],
  movimientosRecientes: [
    { id: 9, fecha: new Date().toISOString(), concepto: 'Nómina', tipo: 'INGRESO', monto: 5000000, estado: 'CONFIRMADO', cuenta: 'Bancolombia' },
    { id: 8, fecha: new Date().toISOString(), concepto: 'Mercado', tipo: 'EGRESO', monto: 200000, estado: 'PENDIENTE_REVISION', cuenta: 'Bancolombia' },
  ],
  alertas: { movimientosPorRevisar: 1, correosPendientes: 3, pagosPorAprobar: 0 },
  ...extra,
});

describe('Inicio · helpers', () => {
  it('el saludo cambia con la hora', () => {
    const a = (h: number) => saludoSegunHora(new Date(2026, 9, 16, h, 0));
    expect(a(5)).toBe('Buenos días');
    expect(a(11)).toBe('Buenos días');
    expect(a(12)).toBe('Buenas tardes');
    expect(a(18)).toBe('Buenas tardes');
    expect(a(19)).toBe('Buenas noches');
    expect(a(3)).toBe('Buenas noches');
  });

  it('primerNombre toma la primera palabra y tolera vacíos', () => {
    expect(primerNombre('Luis Felipe Hernández')).toBe('Luis');
    expect(primerNombre('  ')).toBe('');
    expect(primerNombre(null)).toBe('');
  });

  it('la frase ejecutiva resume lo disponible, lo por cobrar y el vencimiento cercano', () => {
    expect(fraseEjecutiva(resumen())).toBe('Tienes $6,000,000.00 disponibles y $150,000.00 por cobrar este mes. Visa ··1927 vence en 3 días.');
    const sinCobros = resumen({ porCobrar: { ...resumen().porCobrar, pagoDelMes: 0 }, proximosVencimientos: [] });
    expect(fraseEjecutiva(sinCobros)).toBe('Tienes $6,000,000.00 disponibles.');
    const hoy = resumen({ proximosVencimientos: [{ tarjetaId: 4, tarjeta: 'Visa', periodo: '2026-10', fecha: '2026-10-16', diasRestantes: 0, monto: 1, vencido: false }] });
    expect(fraseEjecutiva(hoy)).toContain('Visa vence hoy.');
  });

  it('textoDias y tonoVencimiento', () => {
    expect(textoDias(0)).toBe('Hoy');
    expect(textoDias(1)).toBe('Mañana');
    expect(textoDias(5)).toBe('En 5 días');
    expect(textoDias(-1)).toBe('Ayer');
    expect(textoDias(-4)).toBe('Hace 4 días');
    expect(tonoVencimiento(2, false)).toBe('danger');
    expect(tonoVencimiento(6, false)).toBe('warning');
    expect(tonoVencimiento(20, false)).toBe('neutral');
    expect(tonoVencimiento(20, true)).toBe('danger');
  });

  it('porcentaje y barrasFlujo nunca pasan de 100 ni dividen por cero', () => {
    expect(porcentaje(25, 100)).toBe(25);
    expect(porcentaje(150, 100)).toBe(100);
    expect(porcentaje(5, 0)).toBe(0);
    expect(porcentaje(-5, 100)).toBe(0);
    expect(barrasFlujo(5000000, 250000)).toEqual({ ingresos: 100, gastos: 5 });
    expect(barrasFlujo(0, 0)).toEqual({ ingresos: 0, gastos: 0 });
  });

  it('iconos y signo de los movimientos', () => {
    expect(iconoMovimiento('PAGO_TARJETA')).toBe('credit_card');
    expect(iconoMovimiento('RARO')).toBe('receipt_long');
    expect(esEntrada({ tipo: 'INGRESO' })).toBeTrue();
    expect(esEntrada({ tipo: 'REEMBOLSO_TERCERO' })).toBeTrue();
    expect(esEntrada({ tipo: 'EGRESO' })).toBeFalse();
  });

  it('diaDeMovimiento usa la hora local: hoy, ayer o la fecha', () => {
    const ahora = new Date(2026, 9, 16, 10, 0);
    expect(diaDeMovimiento(new Date(2026, 9, 16, 1, 0).toISOString(), ahora)).toBe('Hoy');
    expect(diaDeMovimiento(new Date(2026, 9, 15, 23, 0).toISOString(), ahora)).toBe('Ayer');
    expect(diaDeMovimiento(new Date(2026, 9, 3, 12, 0).toISOString(), ahora)).toBe('3 oct');
    expect(diaDeMovimiento('no es una fecha', ahora)).toBe('—');
  });
});

describe('HomeComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(datos: ResumenDashboard | null, estado = 500) {
    configurarTestBed([HomeComponent]);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const req = http().expectOne((r) => r.url === `${API}/dashboard/summary` && r.params.get('periodo') === periodoActual());
    if (datos) req.flush(datos);
    else errorHttp(req, estado, { message: 'Sin conexión con la base de datos' });
    fixture.detectChanges();
    return fixture;
  }
  const texto = (f: { nativeElement: unknown }) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  it('muestra los cuatro widgets con las cifras reales del resumen', () => {
    const f = iniciar(resumen());
    const t = texto(f);
    expect(t).toContain('Luis');
    expect(t).toContain('Tienes $6,000,000.00 disponibles');
    expect(t).toContain('Balance y liquidez');
    expect(t).toContain('Tarjetas de crédito');
    expect(t).toContain('Te deben');
    expect(t).toContain('Vencimientos y actividad');
    expect(t).toContain('$5,800,000.00'); // cuenta principal
    expect(t).toContain('Patrimonio neto');
    expect(t).toContain('Visa ··1927');
    expect(t).toContain('Mi parte');
    expect(t).toContain('Andrés Gómez');
    expect(t).toContain('Cupo usado 25 %');
    expect(t).toContain('Nómina');
    expect(t).toContain('+$5,000,000.00'); // el ingreso suma
  });

  it('las acciones rápidas llevan a crear una compra, registrar un pago y un movimiento', () => {
    const f = iniciar(resumen());
    const enlaces = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.home-acciones a')).map((a) => a.textContent!.replace(/\s+/g, ' ').trim());
    expect(enlaces).toEqual(['addNueva compra', 'paymentsRegistrar pago', 'swap_horizMovimiento']);
  });

  it('el detalle de cada deudor enlaza a la pantalla de personas con esa persona', () => {
    const f = iniciar(resumen());
    const enlace = (f.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.deudor')!;
    expect(enlace.getAttribute('href')).toBe('/personas?persona=2');
  });

  it('avisa de lo que espera una acción', () => {
    const f = iniciar(resumen());
    const t = texto(f);
    expect(t).toContain('1 movimiento por revisar');
    expect(t).toContain('3 correos del banco sin conciliar');
    expect(t).not.toContain('por aprobar');
  });

  it('sin tarjetas, sin deudores y sin movimientos muestra estados vacíos útiles', () => {
    const base = resumen();
    const f = iniciar(
      resumen({
        tarjetas: { items: [], totales: { ...base.tarjetas.totales, pagoDelMes: 0, miParte: 0, terceros: 0, deudaPendiente: 0 } },
        porCobrar: { ...base.porCobrar, pagoDelMes: 0, aPagarAhora: 0, porVencer: 0, deudaTotal: 0, personasConDeuda: 0, topDeudores: [] },
        proximosVencimientos: [],
        movimientosRecientes: [],
        alertas: { movimientosPorRevisar: 0, correosPendientes: 0, pagosPorAprobar: 0 },
      })
    );
    const t = texto(f);
    expect(t).toContain('Aún no tienes tarjetas');
    expect(t).toContain('Nadie te debe nada');
    expect(t).toContain('Sin pagos pendientes');
    expect(t).toContain('Todavía no hay movimientos');
    expect(t).not.toContain('Pendientes por atender');
  });

  it('al volver con un resumen ya visto se pinta al instante (sin esqueletos) y se actualiza por detrás', () => {
    iniciar(resumen());
    const f2 = TestBed.createComponent(HomeComponent);
    f2.detectChanges();
    expect(f2.componentInstance.datos).not.toBeNull();
    expect(f2.componentInstance.cargando).toBeFalse();
    expect(f2.componentInstance.actualizando).toBeTrue();
    expect(texto(f2)).toContain('Balance y liquidez');
    http().expectOne((r) => r.url === `${API}/dashboard/summary`).flush(resumen({ liquidez: { ...resumen().liquidez, total: 1 } }));
    expect(f2.componentInstance.actualizando).toBeFalse();
    expect(f2.componentInstance.datos?.liquidez.total).toBe(1);
  });

  it('al cambiar de sesión el resumen guardado se olvida (nunca se ve el de otro usuario)', () => {
    iniciar(resumen());
    const servicio = TestBed.inject(DashboardService);
    expect(servicio.resumenReciente(periodoActual())).not.toBeNull();
    limpiarCachesDeSesion();
    expect(servicio.resumenReciente(periodoActual())).toBeNull();
  });

  it('un fallo al actualizar no borra lo que ya se ve', () => {
    iniciar(resumen());
    const f2 = TestBed.createComponent(HomeComponent);
    f2.detectChanges();
    errorHttp(http().expectOne((r) => r.url === `${API}/dashboard/summary`), 500, { message: 'Sin conexión' });
    expect(f2.componentInstance.datos).not.toBeNull();
    expect(f2.componentInstance.error).toBe('Sin conexión');
  });

  it('un error se explica y se puede reintentar', () => {
    const f = iniciar(null);
    expect(f.componentInstance.error).toBe('Sin conexión con la base de datos');
    expect(texto(f)).toContain('Reintentar');
    f.componentInstance.cargar();
    http().expectOne((r) => r.url === `${API}/dashboard/summary`).flush(resumen());
    expect(f.componentInstance.error).toBeNull();
    expect(f.componentInstance.datos).not.toBeNull();
  });

  it('Iteración 2 Fase 6: construye los 4 gráficos avanzados y carga analítica avanzada bajo demanda', () => {
    const f = iniciar(resumen());
    const c = f.componentInstance;
    c.cargarAnaliticaAvanzada('6M');
    const req = http().expectOne((r) => r.url === `${API}/dashboard/analitica-avanzada`);
    expect(req.request.params.get('granularidad')).toBe('MES');
    const mockAnalitica = {
      filtrosAplicados: {
        fechaInicio: '2026-05-01',
        fechaFin: '2026-10-31',
        granularidad: 'MES' as const,
        cuentaIds: [],
        tarjetaIds: [],
        categoriaIds: [],
        personaIds: [],
        soloGastoPropio: false,
        incluirTransferenciasInternas: false,
      },
      serieTemporal: [{ periodo: '2026-10', ingresos: 5000000, gastosPropios: 1200000, gastosTerceros: 300000, ahorroNeto: 3800000, transferenciasInternas: 200000, promedioMovilGastos: 1200000 }],
      distribucionCategorias: [{ categoriaId: 1, categoria: 'Alimentación', color: '#34C759', monto: 600000, porcentaje: 50, variacionPct: 12.5, comercios: [{ comercio: 'Éxito', monto: 400000, porcentaje: 66.7 }] }],
      proyeccionCuotasTarjetas: [{ periodo: '2026-10', partePropia: 50000, parteTerceros: 150000, total: 200000, porTarjeta: [] }],
      mapaCalorHabitos: [{ diaSemana: 5, nombreDia: 'Vie', semanaMes: 2, monto: 200000, cantidad: 3 }],
      balanceDeudasYPrestamos: { meDebenPrestamos: 400000, meDebenTercerosTarjetasYCruces: 500000, totalMeDeben: 900000, deboTarjetasPropias: 800000, deboPrestamosPasivos: 0, totalDebo: 800000, posicionNeta: 100000 },
      cascadaMensual: { ingresos: 5000000, gastosFijosRecurrentes: 400000, cuotasTarjetasPropias: 50000, gastosVariablesDirectos: 200000, prestamosNeto: 0, flujoLibreReal: 4350000 },
    };
    req.flush(mockAnalitica);
    expect(c.analiticaAvanzada?.balanceDeudasYPrestamos.posicionNeta).toBe(100000);

    expect(construirCurvaFlujoYPatrimonio(mockAnalitica.serieTemporal).data.datasets.length).toBe(4);
    expect(construirDonutMultiAnilloCategorias(mockAnalitica.distribucionCategorias).data.datasets.length).toBe(2);
    expect(construirHorizonteDesendeudamientoTarjetas(mockAnalitica.proyeccionCuotasTarjetas).data.datasets.length).toBe(2);
    expect(construirCascadaDistribucionMensual(mockAnalitica.cascadaMensual).data.labels?.length).toBe(5);
  });

  it('cambiar de mes vuelve a pedir ese periodo; un valor inválido se ignora', () => {
    const f = iniciar(resumen());
    const c = f.componentInstance;
    c.onPeriodoChange('2026-13');
    c.onPeriodoChange('');
    http().expectNone((r) => r.url.includes('dashboard/summary'));
    c.moverPeriodo(-1);
    const anterior = c.periodo;
    expect(c.esMesActual()).toBeFalse();
    http().expectOne((r) => r.params.get('periodo') === anterior).flush(resumen({ periodo: anterior }));
    c.irAlMesActual();
    http().expectOne((r) => r.params.get('periodo') === periodoActual()).flush(resumen());
    expect(c.esMesActual()).toBeTrue();
  });
});
