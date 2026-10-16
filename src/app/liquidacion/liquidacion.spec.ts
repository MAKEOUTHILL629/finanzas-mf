/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { ItemLiquidacion, LiquidacionMensual, LiquidacionPersona } from '../modelos/aportes';
import { LiquidacionMensualService } from '../services/liquidacion-mensual.service';
import { API, configurarTestBed, errorHttp, esperar, http, persona, responder, responderCatalogos, verificarHttp } from '../testing/erp-testing';
import { periodoActual } from '../shared/periodo.helper';
import { LiquidacionMensualComponent } from './liquidacion-mensual.component';
import {
  adaptarParaAbono,
  bloquesConItems,
  claseEstadoLiquidacion,
  etiquetaEstadoLiquidacion,
  etiquetaOrigen,
  mensajeLiquidacion,
  montoSugeridoPago,
  personasConActividad,
} from './liquidacion.constants';

const item = (extra: Partial<ItemLiquidacion> = {}): ItemLiquidacion => ({
  id: 1, fecha: '2026-10-05T00:00:00.000Z', concepto: 'Cuota 1/12 - Nevera', comentario: null, tipoMovimiento: 'CARGO_CUOTA_TC', origen: 'COMPRA_CREDITO', signo: 1, monto: 50000, impacto: 50000,
  estado: 'CONFIRMADO', prestamoId: null, cruceDeudaId: null, cargoRecurrentePersonaId: null, obligacionMesId: null, cuotaDetalleId: 9, ...extra,
});
const bloque = (items: ItemLiquidacion[]) => ({ items, subtotal: items.reduce((a, i) => a + i.impacto, 0) });
const vacio = bloque([]);
const liquidacionAndres = (extra: Partial<LiquidacionPersona> = {}): LiquidacionPersona => ({
  persona: { id: 2, nombre: 'Andrés Gómez', iniciales: 'AG', color: '#34C759' },
  cuotasTarjetas: bloque([item()]),
  cuotasPrestamos: bloque([item({ id: 2, concepto: 'Domicilio', tipoMovimiento: 'CARGO_PRESTAMO_DIRECTO', origen: 'PRESTAMO', monto: 80000, impacto: 80000 })]),
  cargosRecurrentes: bloque([item({ id: 3, concepto: 'Plan de celular (Cuota 3 de 6)', origen: 'RECURRENTE_PERSONA', monto: 65000, impacto: 65000 })]),
  cobrosPuntuales: vacio,
  crucesCuentas: bloque([item({ id: 4, concepto: 'Cruce Aporte Carro (CRUCE_CUENTAS)', origen: 'CRUCE_APORTE_CARRO', monto: 100000, impacto: 100000, comentario: 'arreglo' })]),
  saldoAFavorAplicado: vacio,
  abonosRealizados: bloque([item({ id: 5, concepto: 'Pago Nequi', origen: 'PAGO_RECIBIDO', signo: -1, monto: 30000, impacto: -30000 })]),
  otros: vacio,
  estadoAporteCarro: null,
  obligaciones: [],
  faltanteObligacion: 0,
  resumenNeto: { totalCargos: 295000, totalAbonosYFavor: 30000, saldoNetoFinal: 265000, estado: 'DEBE' },
  saldoAnterior: 0,
  saldoTotalAcumulado: 265000,
  tieneActividad: true,
  ...extra,
});
const liquidacionPapa = (): LiquidacionPersona =>
  liquidacionAndres({
    persona: { id: 4, nombre: 'Luis Fernando', iniciales: 'LF', color: '#FF9500' },
    cuotasTarjetas: vacio, cuotasPrestamos: vacio, cargosRecurrentes: vacio, cobrosPuntuales: vacio, crucesCuentas: vacio, abonosRealizados: vacio,
    saldoAFavorAplicado: bloque([item({ id: 6, concepto: 'Saldo a favor Abril 2026 aplicado', origen: 'SALDO_A_FAVOR_CARRO', signo: -1, monto: 45000, impacto: -45000 })]),
    estadoAporteCarro: {
      obligacionMesId: 66, tipoObligacion: 'CUOTA_CARRO', periodo: '2026-10', concepto: 'Octubre 2026', valorCuotaObjetivo: 1000000, montoAbonado: 500000, saldoPendiente: 500000,
      saldoAFavorGenerado: 0, saldoAFavorAplicado: 0, saldoAFavorDisponible: 0, estado: 'PARCIAL', progresoPorcentaje: 50,
    },
    faltanteObligacion: 500000,
    resumenNeto: { totalCargos: 500000, totalAbonosYFavor: 45000, saldoNetoFinal: 455000, estado: 'DEBE' },
    saldoTotalAcumulado: 455000,
  });
const datos = (extra: Partial<LiquidacionMensual> = {}): LiquidacionMensual => ({
  periodo: periodoActual(), recurrentesGenerados: 0, personas: [liquidacionPapa(), liquidacionAndres()], totales: { totalCargos: 795000, totalAbonosYFavor: 75000, saldoNetoFinal: 720000 }, ...extra,
});

describe('Liquidación — lógica', () => {
  it('mensaje según quién debe a quién', () => {
    expect(mensajeLiquidacion('Andrés', 265000, 'DEBE')).toBe('Andrés te debe $265,000.00 este mes');
    expect(mensajeLiquidacion('Papá', -45000, 'A_FAVOR')).toBe('Tienes un saldo a favor de Papá por $45,000.00 este mes');
    expect(mensajeLiquidacion('Papá', 0, 'PAZ_Y_SALVO')).toBe('Paz y salvo en el mes');
    expect(mensajeLiquidacion(null, 10, 'DEBE')).toBe('La persona te debe $10.00 este mes');
  });

  it('clases y etiquetas de estado y origen', () => {
    expect(claseEstadoLiquidacion('DEBE')).toBe('danger');
    expect(claseEstadoLiquidacion('A_FAVOR')).toBe('success');
    expect(claseEstadoLiquidacion('PAZ_Y_SALVO')).toBe('info');
    expect(etiquetaEstadoLiquidacion('DEBE')).toBe('Te debe');
    expect(etiquetaOrigen('CRUCE_APORTE_CARRO')).toBe('Aporte del carro');
    expect(etiquetaOrigen('CRUCE_ENTRE_PERSONAS')).toBe('Cruce entre personas');
    expect(etiquetaOrigen('NO_EXISTE')).toBe('Movimiento');
  });

  it('solo se muestran los bloques con movimientos, en el orden de la especificación', () => {
    expect(bloquesConItems(liquidacionAndres()).map((b) => b.clave)).toEqual(['cuotasTarjetas', 'cuotasPrestamos', 'cargosRecurrentes', 'crucesCuentas', 'abonosRealizados']);
    expect(bloquesConItems(liquidacionPapa()).map((b) => b.clave)).toEqual(['saldoAFavorAplicado']);
  });

  it('monto sugerido para un pago: lo que realmente se debe; nada si está a favor', () => {
    expect(montoSugeridoPago(liquidacionAndres())).toBe(265000);
    expect(montoSugeridoPago({ saldoTotalAcumulado: 0, resumenNeto: { totalCargos: 0, totalAbonosYFavor: 5, saldoNetoFinal: -5, estado: 'A_FAVOR' } })).toBeNull();
    expect(montoSugeridoPago({ saldoTotalAcumulado: 100, resumenNeto: { totalCargos: 0, totalAbonosYFavor: 0, saldoNetoFinal: 250.456, estado: 'DEBE' } })).toBe(250.46);
  });

  it('adapta la liquidación a la fila que espera el formulario de abono', () => {
    const f = adaptarParaAbono(liquidacionAndres());
    expect(f).toEqual(jasmine.objectContaining({ persona_id: 2, nombre: 'Andrés Gómez', cuotas_tc_mes: 50000, prestamos_mes: 80000, abonos_recibidos_mes: -30000, saldo_neto_mes: 265000, saldo_total_acumulado: 265000 }));
  });

  it('personas con actividad', () => {
    expect(personasConActividad([liquidacionAndres(), liquidacionAndres({ tieneActividad: false })]).length).toBe(1);
  });
});

describe('LiquidacionMensualService (contrato con el backend)', () => {
  beforeEach(() => configurarTestBed([]));
  afterEach(() => verificarHttp());

  it('consulta el mes con persona y todas solo si se piden; cruce y pago hacen POST', () => {
    const s = TestBed.inject(LiquidacionMensualService);
    s.getLiquidacion('2026-10').subscribe();
    expect(esperar('GET', 'liquidacion-mensual/2026-10').request.params.keys()).toEqual([]);
    s.getLiquidacion('2026-10', { personaId: 2, todas: true }).subscribe();
    const req = esperar('GET', 'liquidacion-mensual/2026-10');
    expect(req.request.params.get('personaId')).toBe('2');
    expect(req.request.params.get('todas')).toBe('true');
    s.getLiquidacionPersona('2026-10', 2).subscribe();
    esperar('GET', 'liquidacion-mensual/2026-10/persona/2');
    s.cruceEntrePersonas({ personaOrigenId: 4, personaDestinoId: 2, monto: '100000', concepto: 'x' }).subscribe();
    expect(esperar('POST', 'liquidacion-mensual/cruce-entre-personas').request.body.personaDestinoId).toBe(2);
    s.registrarPago({ personaId: 2, monto: '5000' }).subscribe();
    expect(esperar('POST', 'liquidacion-mensual/registrar-pago').request.body).toEqual({ personaId: 2, monto: '5000' });
  });
});

describe('LiquidacionMensualComponent', () => {
  afterEach(() => verificarHttp());
  const texto = (f: any) => (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  /** Tras cargar la liquidación, la pantalla consulta los enlaces ya compartidos del periodo. */
  const enlaces = (lista: object[] = []) => http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush(lista);
  const liquidacionDe = (periodo: string, respuesta: LiquidacionMensual, listaEnlaces: object[] = []) => {
    responder(`liquidacion-mensual/${periodo}`, respuesta);
    enlaces(listaEnlaces);
  };

  function montar(respuesta: LiquidacionMensual | null = datos(), listaEnlaces: object[] = []) {
    configurarTestBed([LiquidacionMensualComponent]);
    const f = TestBed.createComponent(LiquidacionMensualComponent);
    f.detectChanges();
    responderCatalogos({ personas: [persona(2, 'Andrés Gómez', { celular: '3104445566' }), persona(4, 'Luis Fernando')] });
    if (respuesta) liquidacionDe(periodoActual(), respuesta, listaEnlaces);
    f.detectChanges();
    return f;
  }

  it('totales y una tarjeta por persona con su mensaje y estado', () => {
    const f = montar();
    const t = texto(f);
    for (const esperado of [
      'Liquidación de fin de mes', 'Total a cobrar', '$795,000.00', 'Abonos y a favor', '$75,000.00', 'Saldo neto del mes', '$720,000.00', 'Lo que te deben en total',
      'Luis Fernando te debe $455,000.00 este mes', 'Andrés Gómez te debe $265,000.00 este mes', 'Te debe',
    ]) expect(t).toContain(esperado);
    expect(f.nativeElement.querySelectorAll('.persona').length).toBe(2);
    // con dos personas arrancan cerradas
    expect(f.nativeElement.querySelectorAll('.persona-cuerpo').length).toBe(0);
  });

  it('desplegar a Andrés muestra su desglose por categoría con origen, comentario y saldo neto', () => {
    const f = montar();
    (f.nativeElement.querySelectorAll('.persona-cabecera')[1] as HTMLButtonElement).click();
    f.detectChanges();
    const t = texto(f);
    for (const esperado of [
      'Compras / cuotas de tarjeta de crédito', 'Cuota 1/12 - Nevera', 'Tarjeta',
      'Cuotas de préstamos', 'Domicilio',
      'Pagos y cargos recurrentes del mes', 'Plan de celular (Cuota 3 de 6)',
      'Cruces de cuentas del mes', 'Aporte del carro', 'arreglo',
      'Abonos realizados en el mes', 'Pago Nequi', '($30,000.00)',
      'Registrar abono / pago de fin de mes', 'Cruzar cuenta con otra persona',
    ]) expect(t).toContain(esperado);
    // categorías sin movimientos no se pintan
    expect(t).not.toContain('Otros movimientos');
    expect(t).not.toContain('Aplicar saldo a favor');
  });

  it('muestra el bloque de gastos repartidos y por qué se cobra cada cuota (porcentaje y número de cuota)', () => {
    const conDetalle = liquidacionAndres({
      cuotasTarjetas: bloque([
        item({ detalle: { tipo: 'CUOTA_TARJETA', compra: 'Nevera', fechaCompra: null, valorCompra: 600000, numeroCuota: 2, cuotasDeLaCompra: 6, cuotasQueTePertenecen: 6, porcentaje: 50, valorCuotaTotal: 100000, tarjeta: 'Visa' } }),
      ]),
      cobrosPuntuales: bloque([
        item({ id: 9, concepto: 'Recibo de la luz', origen: 'COBRO_PUNTUAL', tipoMovimiento: 'CARGO_COBRO_PUNTUAL', monto: 61500, impacto: 61500, detalle: { tipo: 'COBRO_PUNTUAL', categoria: 'SERVICIO', montoTotal: 184500, modoDivision: 'IGUAL', notas: null } }),
      ]),
    });
    const f = montar(datos({ personas: [conDetalle] }));
    const t = texto(f);
    for (const esperado of ['Servicios, mercado y eventos del mes', 'Recibo de la luz', 'Gasto repartido', 'Tu parte de $184,500.00 (a partes iguales)', 'Cuota 2 de 6 · 50 % de $100,000.00 · compra de $600,000.00 · Visa']) {
      expect(t).toContain(esperado);
    }
  });

  it('compartir cobro abre el modal con la persona; si ya hay enlace muestra su estado y los pagos por revisar', () => {
    const f = montar(datos({ personas: [liquidacionAndres()] }), [
      { id: 3, personaId: 2, persona: 'Andrés Gómez', periodo: periodoActual(), token: 'T'.repeat(43), ruta: '/p/x', vigente: true, reportesPendientes: 2, vistas: 1 },
    ]);
    const c = f.componentInstance;
    expect(c.enlaceDe(liquidacionAndres())?.reportesPendientes).toBe(2);
    expect(texto(f)).toContain('Enlace compartido');
    expect(texto(f)).toContain('avisó 2 pagos');
    expect(c.celularDe(liquidacionAndres())).toBe('3104445566');
    c.abrirCompartir(liquidacionAndres());
    expect(c.compartiendo?.persona.id).toBe(2);
    c.cerrarModal();
    expect(c.compartiendo).toBeNull();
  });

  it('si los enlaces no cargan, la liquidación se ve igual', () => {
    configurarTestBed([LiquidacionMensualComponent]);
    const f = TestBed.createComponent(LiquidacionMensualComponent);
    f.detectChanges();
    responderCatalogos();
    responder(`liquidacion-mensual/${periodoActual()}`, datos());
    errorHttp(http().expectOne((r) => r.url === `${API}/cobros/enlaces`), 500, {});
    f.detectChanges();
    expect(texto(f)).toContain('Luis Fernando te debe');
    expect(f.componentInstance.enlaces).toEqual([]);
  });

  it('el responsable de la cuota ve el avance, el faltante incluido en lo que debe y el saldo a favor aplicado', () => {
    const f = montar();
    (f.nativeElement.querySelectorAll('.persona-cabecera')[0] as HTMLButtonElement).click();
    f.detectChanges();
    const t = texto(f);
    for (const esperado of ['Octubre 2026', 'Parcial', 'aportado $500,000.00', 'faltan $500,000.00', 'Faltante de la cuota del carro', 'Saldo a favor de la cuota aplicado', '($45,000.00)']) {
      expect(t).toContain(esperado);
    }
    expect(f.nativeElement.querySelector('.carro [role=progressbar]').getAttribute('aria-valuenow')).toBe('50');
  });

  it('cambiar de mes o de persona vuelve a consultar con los parámetros correctos', () => {
    const f = montar();
    f.componentInstance.moverPeriodo(-1);
    const anterior = f.componentInstance.periodo;
    expect(anterior).not.toBe(periodoActual());
    liquidacionDe(anterior, datos({ periodo: anterior, personas: [liquidacionAndres()] }));
    f.componentInstance.onPersonaChange('2');
    const req = esperar('GET', `liquidacion-mensual/${anterior}`);
    expect(req.request.params.get('personaId')).toBe('2');
    req.flush(datos({ periodo: anterior, personas: [liquidacionAndres()] }));
    enlaces();
    f.detectChanges();
    // con una sola persona el desglose arranca abierto
    expect(f.nativeElement.querySelectorAll('.persona-cuerpo').length).toBe(1);
    f.componentInstance.onTodasChange(true);
    expect(esperar('GET', `liquidacion-mensual/${anterior}`).request.params.get('todas')).toBe('true');
  });

  it('sin deudas avisa; un error ofrece reintentar', () => {
    const vacio = montar(datos({ personas: [], totales: { totalCargos: 0, totalAbonosYFavor: 0, saldoNetoFinal: 0 } }));
    expect(texto(vacio)).toContain('Nadie debe nada en');
    TestBed.resetTestingModule();

    configurarTestBed([LiquidacionMensualComponent]);
    const f = TestBed.createComponent(LiquidacionMensualComponent);
    f.detectChanges();
    responderCatalogos();
    errorHttp(esperar('GET', `liquidacion-mensual/${periodoActual()}`), 400, { message: 'periodo inválido' });
    f.detectChanges();
    expect(texto(f)).toContain('Reintentar');
  });

  it('registrar abono abre el formulario con la persona adaptada; cruzar abre el de cruces', () => {
    const f = montar();
    f.componentInstance.abrirAbono(liquidacionAndres());
    expect(f.componentInstance.abonando?.persona.id).toBe(2);
    expect(f.componentInstance.personaParaAbono?.saldo_total_acumulado).toBe(265000);
    f.componentInstance.cerrarModal();
    expect(f.componentInstance.abonando).toBeNull();
    f.componentInstance.abrirCruce(liquidacionAndres());
    expect(f.componentInstance.cruzando).not.toBeNull();
  });

  it('aplicar saldo a favor consulta los meses con excedente del responsable; sin excedente solo avisa', () => {
    const f = montar();
    f.componentInstance.abrirExcedente(liquidacionPapa());
    responder('obligaciones-aportes/carro/resumen', { tipoObligacion: 'CUOTA_CARRO', responsable: null, cuotaBase: null, periodoActual: '2026-10', periodoSeleccionadoId: null, saldoAFavorDisponibleGlobal: 0, periodos: [] });
    expect(f.componentInstance.excedenteAbierto).toBe(false);

    f.componentInstance.abrirExcedente(liquidacionPapa());
    const conExcedente = { id: 60, periodo: '2026-04', concepto: 'Abril 2026', responsable: { id: 4, nombre: 'Luis Fernando', iniciales: 'LF', color: null }, saldoAFavorDisponible: 245000 };
    responder('obligaciones-aportes/carro/resumen', { tipoObligacion: 'CUOTA_CARRO', responsable: null, cuotaBase: null, periodoActual: '2026-10', periodoSeleccionadoId: null, saldoAFavorDisponibleGlobal: 245000, periodos: [conExcedente, { ...conExcedente, id: 61, responsable: { id: 9, nombre: 'Otro', iniciales: null, color: null } }] });
    expect(f.componentInstance.excedenteAbierto).toBe(true);
    expect(f.componentInstance.excedentePeriodos.map((p) => p.id)).toEqual([60]); // solo los del responsable de esa tarjeta
  });
});
