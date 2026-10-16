import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { CobroPuntual, CobroPublico, EnlaceCobro, ReportePago } from '../modelos/cobros-personas';
import { ItemPersona } from '../modelos/catalogos';
import { ModalService } from '../services/modal.service';
import { LADO_MAX_IMAGEN, MAX_BYTES_COMPROBANTE, bytesDeBase64, escalarDimensiones, tamanoLegible, tipoPermitido } from '../shared/archivo.helper';
import { ToastService } from '../shared/toast/toast.service';
import { API, configurarTestBed, cuentaItem, errorHttp, esperar, http, persona, responder, responderCatalogos, verificarHttp } from '../testing/erp-testing';
import { AprobarReporteComponent, construirAprobacion, modoSugerido } from './aprobar-reporte/aprobar-reporte.component';
import { CobroPublicoComponent, mensajePublico, resumenSaldo } from './cobro-publico/cobro-publico.component';
import { CobrosComponent, ordenarReportes } from './cobros.component';
import {
  calcularReparto,
  claseEstadoReporte,
  enlaceWhatsApp,
  etiquetaCategoria,
  etiquetaEstadoReporte,
  etiquetaMedio,
  lineaDetalle,
  telefonoWhatsApp,
  textoParaCompartir,
  urlPublica,
  vencimientoLegible,
} from './cobros.constants';
import { CompartirCobroComponent, construirEnlace } from './compartir-cobro/compartir-cobro.component';
import { FormularioCobroComponent, construirCobro, miPersona } from './formulario-cobro/formulario-cobro.component';

const PERSONAS: ItemPersona[] = [
  persona(1, 'Felipe', { esPropia: true, tieneUsuario: true }),
  persona(2, 'Andrés', { celular: '3104445566' }),
  persona(3, 'Papá'),
];

function cobro(extra: Partial<CobroPuntual> = {}): CobroPuntual {
  return {
    id: 10, concepto: 'Recibo de la luz', categoria: 'SERVICIO', fechaGasto: '2026-10-14T00:00:00.000Z', periodo: '2026-10', montoTotal: 184500, modoDivision: 'IGUAL',
    estado: 'ACTIVO', notas: null, transaccionId: null, compraCreditoId: null, notificacionId: null, montoACobrar: 123000, parteDelPropietario: 61500,
    participantes: [
      { personaId: 1, nombre: 'Felipe', iniciales: 'FE', color: null, monto: 61500, porcentaje: null, esPropio: true },
      { personaId: 2, nombre: 'Andrés', iniciales: 'AN', color: null, monto: 61500, porcentaje: null, esPropio: false },
      { personaId: 3, nombre: 'Papá', iniciales: 'PA', color: null, monto: 61500, porcentaje: null, esPropio: false },
    ],
    ...extra,
  };
}

function reporte(extra: Partial<ReportePago> = {}): ReportePago {
  return {
    id: 5, enlaceId: 3, personaId: 2, persona: 'Andrés', periodo: '2026-10', montoReportado: 61500, fechaPago: '2026-10-20T00:00:00.000Z', medio: 'BREB', referencia: 'ABC1',
    comentario: 'Listo', tieneComprobante: true, comprobanteNombre: 'c.jpg', comprobanteTipo: 'image/jpeg', comprobanteTamano: 48000, estado: 'PENDIENTE', montoAprobado: null,
    motivoRechazo: null, revisadoEn: null, creadoEn: '2026-10-20T15:00:00.000Z', transaccionId: null, movimientoId: null, correoCoincidente: null, ...extra,
  };
}

function enlace(extra: Partial<EnlaceCobro> = {}): EnlaceCobro {
  return {
    id: 3, personaId: 2, persona: 'Andrés', periodo: '2026-10', token: 'T'.repeat(43), ruta: `/p/${'T'.repeat(43)}`, mensaje: 'Hola', instruccionesPago: 'Bre-B @felipe',
    expiraEn: '2099-01-01T00:00:00.000Z', revocado: false, vigente: true, vistas: 2, ultimaVistaEn: null, snapshotEn: '2026-10-20T12:00:00.000Z',
    resumen: { totalCargos: 61500, totalAbonosYFavor: 0, saldoNetoFinal: 61500, estado: 'DEBE', saldoAnterior: 0, saldoTotalAcumulado: 61500 }, reportesPendientes: 1, ...extra,
  };
}

describe('cobros.constants — reparto en pantalla', () => {
  it('IGUAL: la suma es exacta y los centavos sobrantes van a los primeros; la parte del propietario no se cobra', () => {
    const r = calcularReparto(100, 'IGUAL', [{ personaId: 1 }, { personaId: 2 }, { personaId: 3 }], 2);
    expect(r.error).toBeNull();
    expect(r.partes.map((p) => p.monto)).toEqual([33.34, 33.33, 33.33]);
    expect(r.partes.map((p) => p.esPropio)).toEqual([false, true, false]);
    expect(r.montoACobrar).toBe(66.67);
    expect(r.parteDelPropietario).toBe(33.33);
    expect(r.partes.reduce((a, p) => a + Math.round(p.monto * 100), 0)).toBe(10000);
  });

  it('PORCENTAJE: lo no repartido es del propietario; repartir el 100 % absorbe el redondeo en el último', () => {
    const parcial = calcularReparto('200000', 'PORCENTAJE', [{ personaId: 2, valor: 30 }, { personaId: 3, valor: '20' }], 1);
    expect(parcial.partes.map((p) => p.monto)).toEqual([60000, 40000]);
    expect(parcial.parteDelPropietario).toBe(100000);
    const completo = calcularReparto(100, 'PORCENTAJE', [{ personaId: 2, valor: 33.3333 }, { personaId: 3, valor: 33.3333 }, { personaId: 4, valor: 33.3334 }], 1);
    expect(completo.partes.reduce((a, p) => a + Math.round(p.monto * 100), 0)).toBe(10000);
  });

  it('MONTO: montos fijos y porcentaje implícito', () => {
    const r = calcularReparto(500000, 'MONTO', [{ personaId: 2, valor: 150000 }, { personaId: 3, valor: '100000.50' }], 1);
    expect(r.partes.map((p) => p.monto)).toEqual([150000, 100000.5]);
    expect(r.partes[0].porcentaje).toBe(30);
    expect(r.parteDelPropietario).toBe(249999.5);
  });

  it('explica por qué un reparto no es válido todavía', () => {
    expect(calcularReparto(null, 'IGUAL', [{ personaId: 1 }], null).error).toContain('cuánto costó');
    expect(calcularReparto(100, 'IGUAL', [], null).error).toContain('al menos a una persona');
    expect(calcularReparto(100, 'PORCENTAJE', [{ personaId: 1, valor: 70 }, { personaId: 2, valor: 40 }], null).error).toContain('suman 110');
    expect(calcularReparto(100, 'PORCENTAJE', [{ personaId: 1, valor: '' }], null).error).toContain('porcentaje');
    expect(calcularReparto(100, 'MONTO', [{ personaId: 1, valor: 70 }, { personaId: 2, valor: 40 }], null).error).toContain('superan el total');
    expect(calcularReparto(100, 'MONTO', [{ personaId: 1, valor: 0 }], null).error).toContain('monto');
  });
});

describe('cobros.constants — enlace y textos', () => {
  it('URL pública y WhatsApp', () => {
    expect(urlPublica('abc', 'https://app.com/')).toBe('https://app.com/p/abc');
    expect(telefonoWhatsApp('3104445566')).toBe('573104445566');
    expect(telefonoWhatsApp('+57 310 444 5566')).toBe('573104445566');
    expect(telefonoWhatsApp('310')).toBeNull();
    expect(telefonoWhatsApp(null)).toBeNull();
    expect(enlaceWhatsApp('573104445566', 'Hola & chao')).toBe('https://wa.me/573104445566?text=Hola%20%26%20chao');
    expect(enlaceWhatsApp(null, 'x')).toBe('https://wa.me/?text=x');
  });

  it('texto para compartir usa el primer nombre, el mes y el saldo', () => {
    const t = textoParaCompartir('Andrés Gómez', '2026-10', 'https://x/p/t', 61500);
    expect(t).toContain('Hola Andrés');
    expect(t).toContain('Octubre 2026');
    expect(t).toContain('$');
    expect(t).toContain('https://x/p/t');
    expect(textoParaCompartir(null, '2026-10', 'https://x/p/t', 0)).not.toContain('Quedó por');
  });

  it('vencimiento legible', () => {
    const ahora = new Date('2026-10-15T12:00:00Z');
    expect(vencimientoLegible('2026-10-27T12:00:00Z', ahora)).toBe('Vence en 12 días');
    expect(vencimientoLegible('2026-10-16T13:00:00Z', ahora)).toBe('Vence en 1 día');
    expect(vencimientoLegible('2026-10-15T20:00:00Z', ahora)).toBe('Vence hoy');
    expect(vencimientoLegible('2026-10-10T00:00:00Z', ahora)).toBe('Venció');
  });

  it('etiquetas y clases de estado', () => {
    expect(etiquetaEstadoReporte('PENDIENTE')).toBe('Por revisar');
    expect(claseEstadoReporte('APROBADO')).toBe('success');
    expect(claseEstadoReporte('RECHAZADO')).toBe('danger');
    expect(claseEstadoReporte('PENDIENTE')).toBe('warning');
    expect(etiquetaMedio('BREB')).toContain('Bre-B');
    expect(etiquetaMedio('RARO')).toBe('RARO');
    expect(etiquetaCategoria('MERCADO')).toBe('Mercado');
    expect(etiquetaCategoria(null)).toBe('Otro');
  });

  it('detalle de una cuota de tarjeta y de un gasto repartido', () => {
    expect(
      lineaDetalle({ tipo: 'CUOTA_TARJETA', compra: 'Nevera', fechaCompra: null, valorCompra: 600000, numeroCuota: 2, cuotasDeLaCompra: 6, cuotasQueTePertenecen: 6, porcentaje: 50, valorCuotaTotal: 100000, tarjeta: 'Visa' }),
    ).toBe('Cuota 2 de 6 · 50 % de $100,000.00 · compra de $600,000.00 · Visa');
    expect(lineaDetalle({ tipo: 'CUOTA_TARJETA', compra: 'Pizza', fechaCompra: null, valorCompra: 30000, numeroCuota: 1, cuotasDeLaCompra: 1, cuotasQueTePertenecen: 1, porcentaje: 100, valorCuotaTotal: 30000, tarjeta: null })).toBe('Pago único');
    expect(lineaDetalle({ tipo: 'COBRO_PUNTUAL', categoria: 'SERVICIO', montoTotal: 184500, modoDivision: 'IGUAL', notas: null })).toBe('Tu parte de $184,500.00 (a partes iguales)');
    expect(lineaDetalle(null)).toBeNull();
  });
});

describe('FormularioCobroComponent', () => {
  afterEach(() => verificarHttp());

  it('construirCobro: IGUAL incluye al propietario solo si participa; PORCENTAJE y MONTO envían el valor de cada uno', () => {
    const base = { concepto: ' Luz ', categoria: 'SERVICIO' as const, fechaGasto: '2026-10-14', periodo: '2026-10', montoTotal: 184500, notas: '', miPersonaId: 1 };
    const igual = construirCobro({ ...base, modoDivision: 'IGUAL', yoParticipo: true, seleccion: [{ personaId: 2, valor: '' }, { personaId: 3, valor: '' }] });
    expect(igual).toEqual({ concepto: 'Luz', categoria: 'SERVICIO', fechaGasto: '2026-10-14', periodo: '2026-10', montoTotal: '184500', modoDivision: 'IGUAL', participantes: [{ personaId: 2 }, { personaId: 3 }, { personaId: 1 }] });
    expect(construirCobro({ ...base, modoDivision: 'IGUAL', yoParticipo: false, seleccion: [{ personaId: 2, valor: '' }] }).participantes).toEqual([{ personaId: 2 }]);
    expect(construirCobro({ ...base, modoDivision: 'PORCENTAJE', yoParticipo: true, seleccion: [{ personaId: 2, valor: '30' }] }).participantes).toEqual([{ personaId: 2, porcentaje: '30' }]);
    expect(construirCobro({ ...base, modoDivision: 'MONTO', yoParticipo: true, seleccion: [{ personaId: 2, valor: '50000' }], notas: ' x ' })).toEqual(
      jasmine.objectContaining({ participantes: [{ personaId: 2, monto: '50000' }], notas: 'x' }),
    );
  });

  it('miPersona es la enlazada al usuario', () => {
    expect(miPersona(PERSONAS)?.id).toBe(1);
    expect(miPersona([persona(2, 'x')])).toBeNull();
  });

  function crear(cobroInicial: CobroPuntual | null = null) {
    configurarTestBed([FormularioCobroComponent]);
    const fixture = TestBed.createComponent(FormularioCobroComponent);
    fixture.componentInstance.cobro = cobroInicial;
    fixture.componentInstance.personas = PERSONAS;
    fixture.componentInstance.periodoInicial = '2026-10';
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('previsualiza el reparto en vivo y guarda con POST /cobros-puntuales', () => {
    const c = crear();
    const guardado = jasmine.createSpy('guardado');
    c.guardado.subscribe(guardado);
    c.form.patchValue({ concepto: 'Luz octubre', montoTotal: 184500, fechaGasto: '2026-10-14' });
    c.alternar(2);
    c.alternar(3);
    expect(c.reparto.partes.map((p) => p.monto)).toEqual([61500, 61500, 61500]); // yo también participo (por defecto)
    expect(c.reparto.montoACobrar).toBe(123000);
    c.form.patchValue({ yoParticipo: false });
    expect(c.reparto.partes.map((p) => p.monto)).toEqual([92250, 92250]);

    c.enviar();
    const req = esperar('POST', 'cobros-puntuales');
    expect(req.request.body).toEqual(jasmine.objectContaining({ concepto: 'Luz octubre', montoTotal: '184500', modoDivision: 'IGUAL', periodo: '2026-10', participantes: [{ personaId: 2 }, { personaId: 3 }] }));
    req.flush(cobro());
    expect(guardado).toHaveBeenCalled();
  });

  it('no envía si falta el total o las personas, y explica por qué', () => {
    const c = crear();
    c.form.patchValue({ concepto: 'Mercado' });
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
    expect(c.intentado).toBeTrue();
    expect(c.totalInvalido).toBeTrue();
    expect(c.reparto.error).toBeTruthy();
  });

  it('en modo PORCENTAJE exige el valor de cada persona', () => {
    const c = crear();
    c.form.patchValue({ concepto: 'Mercado', montoTotal: 200000, modoDivision: 'PORCENTAJE' });
    c.alternar(2);
    expect(c.reparto.error).toContain('porcentaje');
    c.valores.controls['2'].setValue('40');
    expect(c.reparto.error).toBeNull();
    expect(c.reparto.parteDelPropietario).toBe(120000);
  });

  it('el periodo propuesto es el que se estaba viendo; sin él sigue a la fecha del gasto hasta que se toca', () => {
    const c = crear(); // se abrió desde octubre
    c.form.controls.fechaGasto.setValue('2026-11-03');
    expect(c.form.controls.periodo.value).toBe('2026-10');

    TestBed.resetTestingModule();
    configurarTestBed([FormularioCobroComponent]);
    const fixture = TestBed.createComponent(FormularioCobroComponent);
    fixture.componentInstance.personas = PERSONAS;
    fixture.detectChanges();
    const libre = fixture.componentInstance;
    libre.form.controls.fechaGasto.setValue('2026-11-03');
    expect(libre.form.controls.periodo.value).toBe('2026-11');
    libre.form.controls.periodo.markAsDirty(); // al escribir en el campo, Angular marca «dirty» antes de emitir el valor
    libre.form.controls.periodo.setValue('2026-12');
    libre.form.controls.fechaGasto.setValue('2027-01-05');
    expect(libre.form.controls.periodo.value).toBe('2026-12'); // ya lo eligió el usuario
  });

  it('editar carga el cobro y envía PUT; el error del servidor se muestra', () => {
    const c = crear(cobro({ modoDivision: 'PORCENTAJE', participantes: [{ personaId: 2, nombre: 'Andrés', iniciales: 'AN', color: null, monto: 60000, porcentaje: 30, esPropio: false }] }));
    expect(c.form.controls.concepto.value).toBe('Recibo de la luz');
    expect(c.estaMarcada(2)).toBeTrue();
    expect(c.valores.controls['2'].value).toBe('30');
    c.enviar();
    const req = esperar('PUT', 'cobros-puntuales/10');
    errorHttp(req, 409, { message: 'El cobro está anulado' });
    expect(c.errorServidor).toBe('El cobro está anulado');
  });
});

describe('AprobarReporteComponent', () => {
  afterEach(() => verificarHttp());

  it('modo sugerido y cuerpo según lo elegido', () => {
    const coincide = { notificacionId: 1, transaccionId: 77, fecha: '2026-10-20', monto: 61500, cuentaId: 4 };
    expect(modoSugerido({ correoCoincidente: coincide }, [{ id: 1 }])).toBe('enlazar');
    expect(modoSugerido({ correoCoincidente: null }, [{ id: 1 }])).toBe('cuenta');
    expect(modoSugerido({ correoCoincidente: null }, [])).toBe('anotar');

    expect(construirAprobacion({ correoCoincidente: coincide }, { modo: 'enlazar', cuentaId: null, monto: 61500 })).toEqual({ monto: '61500', transaccionId: 77 });
    expect(construirAprobacion({ correoCoincidente: null }, { modo: 'cuenta', cuentaId: 4, monto: '50000.50' })).toEqual({ monto: '50000.50', cuentaDestinoId: 4 });
    expect(construirAprobacion({ correoCoincidente: null }, { modo: 'anotar', cuentaId: 4, monto: 'abc' })).toEqual({});
  });

  function crear(r: ReportePago) {
    configurarTestBed([AprobarReporteComponent]);
    const fixture = TestBed.createComponent(AprobarReporteComponent);
    fixture.componentInstance.reporte = r;
    fixture.componentInstance.cuentas = [cuentaItem(1, 'Nequi'), cuentaItem(2, 'Ahorros', { esPrincipal: true })];
    fixture.detectChanges();
    responderCatalogos({ cuentas: fixture.componentInstance.cuentas }, { esperadas: 0 }); // el selector de la cuenta pide el catálogo si está visible
    return fixture.componentInstance;
  }

  it('sin correo coincidente propone registrar en la cuenta principal y aprueba con cuentaDestinoId', () => {
    const c = crear(reporte());
    expect(c.modo).toBe('cuenta');
    expect(c.form.controls.cuentaId.value).toBe(2);
    const aprobado = jasmine.createSpy('aprobado');
    c.aprobado.subscribe(aprobado);
    c.enviar();
    const req = esperar('POST', 'cobros/reportes/5/aprobar');
    expect(req.request.body).toEqual({ monto: '61500', cuentaDestinoId: 2 });
    req.flush({ reporteId: 5, estado: 'APROBADO', monto: 61500, movimientoId: 9, transaccionId: 12 });
    expect(aprobado).toHaveBeenCalled();
  });

  it('con correo coincidente propone enlazar el ingreso que ya llegó; avisa si el monto difiere', () => {
    const c = crear(reporte({ correoCoincidente: { notificacionId: 1, transaccionId: 77, fecha: '2026-10-20', monto: 61500, cuentaId: 1 } }));
    expect(c.modo).toBe('enlazar');
    c.form.patchValue({ monto: 50000 });
    expect(c.difiere).toBeTrue();
    c.enviar();
    expect(esperar('POST', 'cobros/reportes/5/aprobar').request.body).toEqual({ monto: '50000', transaccionId: 77 });
  });

  it('no envía un monto inválido ni «cuenta» sin cuenta', () => {
    const c = crear(reporte());
    c.form.patchValue({ monto: 0 });
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
    c.form.patchValue({ monto: 100, cuentaId: null, modo: 'cuenta' });
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
    expect(c.errorServidor).toContain('cuenta');
  });
});

describe('CobrosComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(datos: { cobros?: CobroPuntual[]; reportes?: ReportePago[]; ingresos?: object[]; enlaces?: EnlaceCobro[] } = {}, queryParams: Record<string, string> = {}) {
    configurarTestBed([CobrosComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } }]);
    const fixture = TestBed.createComponent(CobrosComponent);
    fixture.detectChanges();
    responderCatalogos({ personas: PERSONAS }, { esperadas: 1 });
    http().expectOne((r) => r.url === `${API}/cobros-puntuales`).flush(datos.cobros ?? []);
    responder('cobros/reportes', datos.reportes ?? []);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush(datos.ingresos ?? []);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush(datos.enlaces ?? []);
    return fixture.componentInstance;
  }

  it('ordena los pagos por revisar primero (el más antiguo antes) y cuenta los pendientes', () => {
    const c = iniciar({
      reportes: [
        reporte({ id: 1, estado: 'APROBADO', creadoEn: '2026-10-25T00:00:00Z' }),
        reporte({ id: 2, creadoEn: '2026-10-22T00:00:00Z' }),
        reporte({ id: 3, creadoEn: '2026-10-21T00:00:00Z' }),
        reporte({ id: 4, estado: 'RECHAZADO', creadoEn: '2026-10-26T00:00:00Z' }),
      ],
    });
    expect(c.reportes.map((r) => r.id)).toEqual([3, 2, 4, 1]);
    expect(c.pendientes).toBe(2);
    expect(c.reportesVisibles.map((r) => r.id)).toEqual([3, 2]);
    c.filtroReportes = '';
    expect(c.reportesVisibles.length).toBe(4);
    expect(ordenarReportes([]).length).toBe(0);
  });

  it('cada lista se pide con el periodo y el total repartido suma lo que se cobra a los demás', () => {
    const c = iniciar({ cobros: [cobro(), cobro({ id: 11, montoACobrar: 50000 })] });
    expect(c.totalACobrar).toBe(173000);
    expect(c.periodo).toMatch(/^\d{4}-\d{2}$/);
  });

  it('si una lista falla, las demás se muestran y se avisa cuál', () => {
    configurarTestBed([CobrosComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }]);
    const fixture = TestBed.createComponent(CobrosComponent);
    fixture.detectChanges();
    responderCatalogos({ personas: PERSONAS }, { esperadas: 1 });
    errorHttp(http().expectOne((r) => r.url === `${API}/cobros-puntuales`), 500, {});
    responder('cobros/reportes', [reporte()]);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush([]);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
    const c = fixture.componentInstance;
    expect(c.errores.length).toBe(1);
    expect(c.errores[0]).toContain('gastos repartidos');
    expect(c.reportes.length).toBe(1);
  });

  it('respeta ?tab y ?periodo de la URL', () => {
    configurarTestBed([CobrosComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ tab: 'reportes', periodo: '2026-09' }) } } }]);
    const fixture = TestBed.createComponent(CobrosComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.pestana).toBe('reportes');
    expect(fixture.componentInstance.periodo).toBe('2026-09');
    responderCatalogos({ personas: PERSONAS }, { esperadas: 1 });
    const req = http().expectOne((r) => r.url === `${API}/cobros-puntuales`);
    expect(req.request.params.get('periodo')).toBe('2026-09');
    req.flush([]);
    responder('cobros/reportes', []);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush([]);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
  });

  it('anular pide confirmación y envía DELETE', () => {
    const c = iniciar({ cobros: [cobro()] });
    c.pedirAnular(c.cobros[0]);
    http().expectNone((r) => r.method === 'DELETE');
    c.confirmarAnular();
    esperar('DELETE', 'cobros-puntuales/10').flush(cobro({ estado: 'ANULADO' }));
    http().expectOne((r) => r.url === `${API}/cobros-puntuales`).flush([]);
    responder('cobros/reportes', []);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush([]);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
    expect(c.confirmandoAnular).toBeNull();
  });

  it('rechazar exige un motivo y lo envía', () => {
    const c = iniciar({ reportes: [reporte()] });
    c.pedirRechazo(c.reportes[0]);
    c.motivoRechazo = ' ';
    c.confirmarRechazo();
    http().expectNone((r) => r.method === 'POST');
    c.motivoRechazo = 'No veo la transferencia';
    c.confirmarRechazo();
    const req = esperar('POST', 'cobros/reportes/5/rechazar');
    expect(req.request.body).toEqual({ motivo: 'No veo la transferencia' });
    req.flush(reporte({ estado: 'RECHAZADO' }));
    http().expectOne((r) => r.url === `${API}/cobros-puntuales`).flush([]);
    responder('cobros/reportes', []);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush([]);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
  });

  it('aprobar abre el modal con el reporte y al terminar avisa y recarga', () => {
    const c = iniciar({ reportes: [reporte()] });
    const exito = spyOn(TestBed.inject(ToastService), 'exito');
    c.abrirAprobar(c.reportes[0]);
    expect(c.aprobando?.id).toBe(5);
    TestBed.inject(ModalService).close();
    expect(c.aprobando).toBeNull();
    c.onAprobado({ reporteId: 5, estado: 'APROBADO', monto: 61500, movimientoId: 1, transaccionId: null });
    expect(exito).toHaveBeenCalled();
    http().expectOne((r) => r.url === `${API}/cobros-puntuales`).flush([]);
    responder('cobros/reportes', []);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush([]);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
  });

  it('aplicar un ingreso sugerido abona a la persona en el periodo elegido', () => {
    const c = iniciar({ ingresos: [{ notificacionId: 1, transaccionId: 40, fecha: '2026-10-06T00:00:00Z', personaId: 5, persona: 'Alicia Buitrago', monto: 2000000, concepto: 'x', cuentaId: 2 }] });
    c.aplicarIngreso(c.ingresos[0]);
    const req = esperar('POST', 'cobros/pagos/aplicar-ingreso');
    expect(req.request.body).toEqual({ transaccionId: 40, personaId: 5, periodo: c.periodo });
    req.flush({ movimientoId: 1, transaccionId: 40, monto: 2000000, personaId: 5, periodo: c.periodo });
    http().expectOne((r) => r.url === `${API}/cobros-puntuales`).flush([]);
    responder('cobros/reportes', []);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush([]);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
  });

  it('enlaces: arma la URL pública y el enlace de WhatsApp con el celular de la persona', () => {
    const c = iniciar({ enlaces: [enlace()] });
    expect(c.urlDe(c.enlaces[0])).toBe(`${window.location.origin}/p/${'T'.repeat(43)}`);
    const wa = c.whatsapp(c.enlaces[0]);
    expect(wa.startsWith('https://wa.me/573104445566?text=')).toBeTrue();
    expect(decodeURIComponent(wa)).toContain('Hola Andrés');
  });
});

describe('CompartirCobroComponent', () => {
  afterEach(() => verificarHttp());

  it('construirEnlace envía mensaje, instrucciones y vigencia; rotar solo si se pide', () => {
    const v = { mensaje: ' Hola ', instruccionesPago: ' Bre-B ', diasVigencia: 30 };
    expect(construirEnlace(2, '2026-10', v)).toEqual({ personaId: 2, periodo: '2026-10', mensaje: 'Hola', instruccionesPago: 'Bre-B', diasVigencia: 30 });
    expect(construirEnlace(2, '2026-10', v, true).rotarToken).toBeTrue();
  });

  function crear() {
    configurarTestBed([CompartirCobroComponent]);
    const fixture = TestBed.createComponent(CompartirCobroComponent);
    const c = fixture.componentInstance;
    c.personaId = 2;
    c.nombre = 'Andrés Gómez';
    c.celular = '3104445566';
    c.periodo = '2026-10';
    fixture.detectChanges();
    return c;
  }

  it('si aún no hay enlace, genera uno y arma el enlace de WhatsApp', () => {
    const c = crear();
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
    expect(c.enlace).toBeNull();
    expect(c.form.controls.mensaje.value).toContain('Hola Andrés');
    const cambiado = jasmine.createSpy('cambiado');
    c.cambiado.subscribe(cambiado);
    c.form.patchValue({ instruccionesPago: 'Bre-B @felipe' });
    c.generar();
    const req = esperar('POST', 'cobros/enlaces');
    expect(req.request.body).toEqual(jasmine.objectContaining({ personaId: 2, periodo: '2026-10', instruccionesPago: 'Bre-B @felipe', diasVigencia: 45 }));
    req.flush(enlace());
    expect(c.enlace?.token).toBe('T'.repeat(43));
    expect(c.url).toBe(`${window.location.origin}/p/${'T'.repeat(43)}`);
    expect(c.whatsapp).toContain('wa.me/573104445566');
    expect(cambiado).toHaveBeenCalled();
  });

  it('si ya hay enlace lo muestra con su mensaje; desactivar lo revoca', () => {
    const c = crear();
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([enlace({ mensaje: 'Mensaje guardado' }), enlace({ id: 9, personaId: 99 })]);
    expect(c.enlace?.id).toBe(3);
    expect(c.form.controls.mensaje.value).toBe('Mensaje guardado');
    c.desactivar();
    esperar('POST', 'cobros/enlaces/3/revocar').flush(enlace({ vigente: false, revocado: true }));
    expect(c.enlace?.vigente).toBeFalse();
  });

  it('un error al generar se muestra', () => {
    const c = crear();
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
    c.generar();
    errorHttp(esperar('POST', 'cobros/enlaces'), 404, { message: 'Persona 2 no encontrada' });
    expect(c.error).toBe('Persona 2 no encontrada');
  });
});

describe('CobroPublicoComponent', () => {
  afterEach(() => verificarHttp());
  const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

  function publico(extra: Partial<CobroPublico> = {}): CobroPublico {
    return {
      version: 1, periodo: '2026-10', generadoEn: '2026-10-20T12:00:00.000Z', propietario: { nombre: 'Felipe Hernández' }, persona: { nombre: 'Andrés Gómez', iniciales: 'AG', color: null },
      bloques: [{ clave: 'cobrosPuntuales', titulo: 'Servicios, mercado y eventos del mes', subtotal: 61500, items: [{ fecha: '2026-10-14', concepto: 'Recibo de la luz', monto: 61500, signo: 1, impacto: 61500, origen: 'COBRO_PUNTUAL', detalle: null }] }],
      obligaciones: [], resumen: { totalCargos: 61500, totalAbonosYFavor: 0, saldoNetoFinal: 61500, estado: 'DEBE', saldoAnterior: 10000, saldoTotalAcumulado: 71500 },
      mensaje: 'Hola', instruccionesPago: 'Bre-B @felipe', venceEn: '2099-01-01T00:00:00.000Z', actualizadoEn: '2026-10-20T12:00:00.000Z', reportes: [], ...extra,
    };
  }

  function crear() {
    configurarTestBed([CobroPublicoComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: TOKEN }) } } }]);
    const fixture = TestBed.createComponent(CobroPublicoComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('resumenSaldo: debe, al día y a favor', () => {
    expect(resumenSaldo({ saldoTotalAcumulado: 71500 }, 'Felipe Hernández')).toEqual({ titulo: 'Le debes a Felipe', monto: 71500, clase: 'debe', porPagar: 71500 });
    expect(resumenSaldo({ saldoTotalAcumulado: 0 }, null)).toEqual({ titulo: 'Estás al día', monto: 0, clase: 'alDia', porPagar: 0 });
    expect(resumenSaldo({ saldoTotalAcumulado: -5000 }, 'Felipe')).toEqual({ titulo: 'Tienes saldo a favor', monto: 5000, clase: 'aFavor', porPagar: 0 });
  });

  it('mensajePublico: enlace inválido, demasiados intentos, sin conexión y detalle del servidor', () => {
    expect(mensajePublico({ status: 404 }, 'x')).toContain('no es válido o ya venció');
    expect(mensajePublico({ status: 429 }, 'x')).toContain('muchos intentos');
    expect(mensajePublico({ status: 0 }, 'x')).toContain('conexión');
    expect(mensajePublico({ status: 400, error: { message: 'Datos inválidos', errors: { monto: ['El monto no es válido'] } } }, 'x')).toBe('El monto no es válido');
    expect(mensajePublico({ status: 500 }, 'por defecto')).toBe('por defecto');
  });

  it('carga el detalle sin sesión, sugiere pagar el saldo y muestra cada concepto', () => {
    const fixture = crear();
    http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(publico());
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.saldo?.porPagar).toBe(71500);
    expect(c.form.controls.monto.value).toBe(71500);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Hola, Andrés');
    expect(texto).toContain('Recibo de la luz');
    expect(texto).toContain('Le debes a Felipe');
    expect(texto).toContain('Cómo pagar');
  });

  it('un enlace inválido muestra el mensaje y no el formulario', () => {
    const fixture = crear();
    errorHttp(http().expectOne(`${API}/publico/cobros/${TOKEN}`), 404, { message: 'x' });
    fixture.detectChanges();
    expect(fixture.componentInstance.error).toContain('no es válido o ya venció');
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
  });

  it('reporta el pago sin comprobante y recarga para mostrar el aviso', () => {
    const fixture = crear();
    http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(publico());
    const c = fixture.componentInstance;
    c.form.patchValue({ monto: 71500, fechaPago: '2026-10-21', medio: 'NEQUI', referencia: ' R1 ', comentario: '' });
    c.reportar();
    const req = http().expectOne(`${API}/publico/cobros/${TOKEN}/pagos`);
    expect(req.request.body).toEqual({ monto: '71500', fechaPago: '2026-10-21', medio: 'NEQUI', referencia: 'R1' });
    req.flush({ id: 1, estado: 'PENDIENTE', creadoEn: null, mensaje: 'Recibimos tu reporte.' });
    expect(c.enviado).toBe('Recibimos tu reporte.');
    http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(publico({ reportes: [{ id: 1, monto: 71500, fechaPago: '2026-10-21', estado: 'PENDIENTE', motivoRechazo: null, montoAprobado: null, creadoEn: null, conComprobante: false }] }));
  });

  it('no envía con monto inválido y muestra el error del servidor', () => {
    const fixture = crear();
    http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(publico({ resumen: { totalCargos: 0, totalAbonosYFavor: 0, saldoNetoFinal: 0, estado: 'PAZ_Y_SALVO', saldoAnterior: 0, saldoTotalAcumulado: 0 } }));
    const c = fixture.componentInstance;
    c.reportar();
    http().expectNone((r) => r.method === 'POST');
    expect(c.intentado).toBeTrue();
    c.form.patchValue({ monto: 1000 });
    c.reportar();
    errorHttp(http().expectOne(`${API}/publico/cobros/${TOKEN}/pagos`), 429, { message: 'x' });
    expect(c.errorReporte).toContain('muchos intentos');
  });
});


describe('archivo.helper — comprobantes', () => {
  it('reduce proporcionalmente al lado máximo y nunca agranda', () => {
    expect(escalarDimensiones(4000, 3000)).toEqual({ ancho: LADO_MAX_IMAGEN, alto: 1200 });
    expect(escalarDimensiones(3000, 4000)).toEqual({ ancho: 1200, alto: LADO_MAX_IMAGEN });
    expect(escalarDimensiones(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(escalarDimensiones(5000, 10, 1000)).toEqual({ ancho: 1000, alto: 2 });
    expect(escalarDimensiones(0, 0)).toEqual({ ancho: 1, alto: 1 });
  });

  it('solo fotos (JPG, PNG, WebP) y PDF', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) expect(tipoPermitido(t)).toBeTrue();
    for (const t of ['image/gif', 'text/html', 'application/zip', '', null, undefined]) expect(tipoPermitido(t)).toBeFalse();
  });

  it('tamaño legible y bytes de un base64', () => {
    expect(tamanoLegible(512)).toBe('512 B');
    expect(tamanoLegible(48_000)).toBe('48 KB');
    expect(tamanoLegible(1_258_291)).toBe('1.3 MB');
    expect(bytesDeBase64(btoa('hola'))).toBe(4);
    expect(bytesDeBase64(btoa('hola!'))).toBe(5);
    expect(bytesDeBase64(btoa('ho'))).toBe(2);
    expect(MAX_BYTES_COMPROBANTE).toBeLessThan(2_400_000); // el backend acepta hasta 2.4 MB decodificados
  });
});
