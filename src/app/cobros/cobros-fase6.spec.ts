/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, flushMicrotasks, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { AjusteCobro, CobroPublico, EnlaceCobro, MetodoPago, MetodoPagoPublico, ObjecionCobro, ObjecionPublica } from '../modelos/cobros-personas';
import { ModalService } from '../services/modal.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { ToastService } from '../shared/toast/toast.service';
import { API, configurarTestBed, errorHttp, esperar, http, responder, responderCatalogos, verificarHttp } from '../testing/erp-testing';
import { CobroPublicoComponent, MODAL_OBJETAR_COBRO } from './cobro-publico/cobro-publico.component';
import { DescuentoEnlaceComponent } from './descuento-enlace/descuento-enlace.component';
import { MetodosPagoPublicoComponent } from './metodos-pago-publico/metodos-pago-publico.component';
import { MetodosPagoComponent } from './metodos-pago/metodos-pago.component';
import { ObservacionesCobroComponent } from './observaciones-cobro/observaciones-cobro.component';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

const metodo = (extra: Partial<MetodoPagoPublico> = {}): MetodoPagoPublico => ({ id: 1, tipo: 'NEQUI', entidad: 'Nequi', numero: '300 123 4567', titular: 'Felipe Hernández', documento: null, instrucciones: null, tieneQr: false, ...extra });
const metodoAdmin = (extra: Partial<MetodoPago> = {}): MetodoPago => ({ id: 1, tipo: 'NEQUI', entidad: 'Nequi', numero: '300 123 4567', titular: 'Felipe', documento: null, instrucciones: null, cuentaId: null, tieneQr: false, activo: true, orden: 0, creadoEn: '2026-10-17T00:00:00.000Z', ...extra });

const enlace = (extra: Partial<EnlaceCobro> = {}): EnlaceCobro => ({
  id: 3, personaId: 2, persona: 'Andrés', periodo: '2026-10', token: 'T'.repeat(43), ruta: `/p/${'T'.repeat(43)}`, mensaje: null, instruccionesPago: null, expiraEn: '2099-01-01T00:00:00.000Z', revocado: false, vigente: true,
  vistas: 1, ultimaVistaEn: null, snapshotEn: '2026-10-20T12:00:00.000Z', resumen: { totalCargos: 61500, totalAbonosYFavor: 0, saldoNetoFinal: 61500, estado: 'DEBE', saldoAnterior: 0, saldoTotalAcumulado: 61500 }, reportesPendientes: 0, objecionesAbiertas: 1, ...extra,
});

/** `navigator.clipboard` de mentira: el de Karma exige permisos y foco. */
function simularPortapapeles(): jasmine.Spy {
  const escribir = jasmine.createSpy('writeText').and.resolveTo(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
  return escribir;
}

describe('MetodosPagoPublicoComponent — «¿Dónde puedes pagar?»', () => {
  let f: ComponentFixture<MetodosPagoPublicoComponent>;
  const el = () => f.nativeElement as HTMLElement;
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  function crear(metodos: MetodoPagoPublico[], instrucciones: string | null = null): void {
    configurarTestBed([MetodosPagoPublicoComponent]);
    f = TestBed.createComponent(MetodosPagoPublicoComponent);
    f.componentInstance.metodos = metodos;
    f.componentInstance.token = TOKEN;
    f.componentInstance.instrucciones = instrucciones;
    f.detectChanges();
  }

  it('muestra una tarjeta por medio, con su número legible, titular, documento e indicaciones', () => {
    crear([metodo(), metodo({ id: 2, tipo: 'CUENTA_AHORROS', entidad: 'Bancolombia', numero: '12345678901', titular: 'Felipe', documento: '1.023.456.789', instrucciones: 'Pon tu nombre en la descripción' })]);
    const tarjetas = qa('.wallet');
    expect(tarjetas.length).toBe(2);
    expect(tarjetas[0].classList).toContain('wallet--morado');
    expect(tarjetas[0].textContent).toContain('Nequi');
    expect(tarjetas[0].querySelector('.wallet-numero')!.textContent).toBe('300 123 4567');
    expect(tarjetas[1].classList).toContain('wallet--azul');
    expect(tarjetas[1].querySelector('.wallet-numero')!.textContent).toBe('1234 5678 901');
    expect(tarjetas[1].textContent).toContain('1.023.456.789');
    expect(tarjetas[1].textContent).toContain('Pon tu nombre en la descripción');
    expect(el().textContent).toContain('¿Dónde puedes pagar?');
  });

  it('«Copiar número» copia el número limpio y confirma con «¡Copiado!» un momento', fakeAsync(() => {
    const escribir = simularPortapapeles();
    crear([metodo(), metodo({ id: 2, tipo: 'CUENTA_AHORROS', entidad: 'Bancolombia', numero: '123-456789-01' })]);
    const botones = qa('.wallet-boton--principal');
    expect(botones[0].textContent).toContain('Copiar número');
    botones[0].click();
    flushMicrotasks();
    f.detectChanges();
    expect(escribir).toHaveBeenCalledWith('3001234567');
    expect(botones[0].textContent).toContain('¡Copiado!');
    expect(botones[1].textContent).toContain('Copiar número'); // solo el que se copió
    expect(el().querySelector('[role="status"]')!.textContent).toContain('Copiado');

    tick(2600);
    f.detectChanges();
    expect(botones[0].textContent).toContain('Copiar número');

    botones[1].click();
    flushMicrotasks();
    expect(escribir).toHaveBeenCalledWith('12345678901');
    tick(2600);
  }));

  it('si el navegador no deja copiar, explica cómo hacerlo a mano', fakeAsync(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: jasmine.createSpy().and.rejectWith(new Error('denegado')) }, configurable: true });
    spyOn(document, 'execCommand').and.returnValue(false);
    crear([metodo()]);
    qa('.wallet-boton--principal')[0].click();
    flushMicrotasks();
    f.detectChanges();
    expect(el().querySelector('.wallet-error')!.textContent).toContain('No se pudo copiar');
    tick(2600);
  }));

  it('el QR se muestra bajo demanda con la dirección del enlace', () => {
    crear([metodo({ tieneQr: true })]);
    expect(el().querySelector('.wallet-qr')).toBeNull();
    const boton = qa('.wallet-boton').find((b) => b.textContent!.includes('Ver QR'))!;
    boton.click();
    f.detectChanges();
    const img = el().querySelector<HTMLImageElement>('.wallet-qr img')!;
    expect(img.getAttribute('src')).toBe(`${API}/publico/cobros/${TOKEN}/metodos/1/qr`);
    expect(boton.textContent).toContain('Ocultar QR');
    boton.click();
    f.detectChanges();
    expect(el().querySelector('.wallet-qr')).toBeNull();
  });

  it('las indicaciones libres se pueden copiar', fakeAsync(() => {
    const escribir = simularPortapapeles();
    crear([], 'Bre-B @felipe');
    expect(el().querySelector('.mp-indicaciones p')!.textContent).toBe('Bre-B @felipe');
    el().querySelector<HTMLButtonElement>('.mp-copiar')!.click();
    flushMicrotasks();
    f.detectChanges();
    expect(escribir).toHaveBeenCalledWith('Bre-B @felipe');
    expect(el().querySelector('.mp-copiar')!.textContent).toContain('¡Copiado!');
    tick(2600);
  }));
});

describe('CobroPublicoComponent — fase 6', () => {
  afterEach(() => verificarHttp());
  let f: ComponentFixture<CobroPublicoComponent>;
  let c: CobroPublicoComponent;
  const el = () => f.nativeElement as HTMLElement;
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  const objecion = (extra: Partial<ObjecionPublica> = {}): ObjecionPublica => ({
    id: 1, alcance: 'ITEM', itemClave: 'abc123', concepto: 'Recibo de la luz', monto: 61500, comentario: 'Este gasto no era mío', montoPropuesto: null, estado: 'ABIERTA', resolucion: null, respuesta: null, montoAjuste: null,
    creadaEn: '2026-10-20T15:00:00.000Z', resueltaEn: null, ...extra,
  });

  function publico(extra: Partial<CobroPublico> = {}): CobroPublico {
    return {
      version: 1, periodo: '2026-10', generadoEn: '2026-10-20T12:00:00.000Z', propietario: { nombre: 'Felipe Hernández' }, persona: { nombre: 'Andrés Gómez', iniciales: 'AG', color: null },
      bloques: [{ clave: 'cobrosPuntuales', titulo: 'Servicios, mercado y eventos del mes', subtotal: 61500, items: [{ clave: 'abc123', fecha: '2026-10-14', concepto: 'Recibo de la luz', monto: 61500, signo: 1, impacto: 61500, origen: 'COBRO_PUNTUAL', detalle: null }] }],
      obligaciones: [], resumen: { totalCargos: 61500, totalAbonosYFavor: 0, saldoNetoFinal: 61500, estado: 'DEBE', saldoAnterior: 10000, saldoTotalAcumulado: 71500 },
      mensaje: null, instruccionesPago: null, venceEn: '2099-01-01T00:00:00.000Z', actualizadoEn: '2026-10-20T12:00:00.000Z', reportes: [], metodosPago: [], objeciones: [], ...extra,
    };
  }

  function abrir(datos: CobroPublico = publico()): void {
    configurarTestBed([CobroPublicoComponent, MetodosPagoPublicoComponent, ModalComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: TOKEN }) } } }]);
    f = TestBed.createComponent(CobroPublicoComponent);
    c = f.componentInstance;
    f.detectChanges();
    http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(datos);
    f.detectChanges();
  }

  describe('medios de pago', () => {
    it('con saldo por pagar muestra la tarjeta «¿Dónde puedes pagar?»; sin deuda no', () => {
      abrir(publico({ metodosPago: [metodo(), metodo({ id: 2, entidad: 'Bancolombia', tipo: 'CUENTA_AHORROS', numero: '12345678901' })] }));
      expect(qa('.wallet').length).toBe(2);
      expect(el().textContent).toContain('¿Dónde puedes pagar?');
    });

    it('al día: no se muestran medios de pago', () => {
      abrir(publico({ metodosPago: [metodo()], resumen: { totalCargos: 0, totalAbonosYFavor: 0, saldoNetoFinal: 0, estado: 'PAZ_Y_SALVO', saldoAnterior: 0, saldoTotalAcumulado: 0 } }));
      expect(qa('.wallet').length).toBe(0);
    });

    it('un servidor anterior a la fase 6 (sin las listas nuevas) no rompe la página', () => {
      const viejo: any = publico();
      delete viejo.metodosPago;
      delete viejo.objeciones;
      abrir(viejo);
      expect(c.cobro!.metodosPago).toEqual([]);
      expect(c.cobro!.objeciones).toEqual([]);
      expect(el().textContent).toContain('Recibo de la luz');
    });
  });

  describe('pago rechazado', () => {
    const reporte = (id: number, estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO') => ({ id, monto: 71500, fechaPago: '2026-10-21', estado, motivoRechazo: estado === 'RECHAZADO' ? 'El comprobante no corresponde al monto acordado' : null, montoAprobado: null, creadoEn: null, conComprobante: true });

    it('muestra una alerta clara con el comentario del propietario', () => {
      abrir(publico({ reportes: [reporte(2, 'RECHAZADO')] }));
      const alerta = el().querySelector('.pub-rechazo')!;
      expect(alerta.textContent).toContain('fue rechazado');
      expect(alerta.textContent).toContain('El comprobante no corresponde al monto acordado');
      expect(alerta.getAttribute('role')).toBe('alert');
    });

    it('si después envió otro aviso, la alerta se va', () => {
      abrir(publico({ reportes: [reporte(2, 'PENDIENTE'), reporte(1, 'RECHAZADO')] }));
      expect(el().querySelector('.pub-rechazo')).toBeNull();
    });
  });

  describe('abono parcial', () => {
    it('al escribir menos de lo que debe avisa cuánto quedaría y ofrece «Pagar todo»', () => {
      abrir();
      c.form.controls.monto.setValue(20000);
      f.detectChanges();
      expect(c.analisis.tipo).toBe('parcial');
      expect(el().querySelector('.pub-parcial')!.textContent).toContain('Abono parcial');
      expect(el().querySelector('.pub-parcial')!.textContent).toContain('$51,500.00');
      el().querySelector<HTMLButtonElement>('.pub-todo')!.click();
      f.detectChanges();
      expect(c.form.controls.monto.value).toBe(71500);
      expect(c.analisis.tipo).toBe('total');
      expect(el().querySelector('.pub-parcial')).toBeNull();
      expect(el().querySelector('.pub-todo')).toBeNull();
    });

    it('más de lo que debe: lo dice', () => {
      abrir();
      c.form.controls.monto.setValue(100000);
      f.detectChanges();
      expect(el().querySelector('.pub-exceso')!.textContent).toContain('$28,500.00');
    });

    it('tras enviar un abono parcial se muestra cuánto sigue pendiente; en «Mis avisos» sale la insignia', () => {
      abrir();
      c.form.patchValue({ monto: 20000, fechaPago: '2026-10-21' });
      c.reportar();
      const req = http().expectOne(`${API}/publico/cobros/${TOKEN}/pagos`);
      req.flush({ id: 9, estado: 'PENDIENTE', creadoEn: null, parcial: true, saldoRestante: 51500, mensaje: 'Recibimos tu abono.' });
      expect(c.avisoParcial).toBe(51500);
      http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(publico({ reportes: [{ id: 9, monto: 20000, fechaPago: '2026-10-21', estado: 'PENDIENTE', motivoRechazo: null, montoAprobado: null, parcial: true, creadoEn: null, conComprobante: false }] }));
      f.detectChanges();
      expect(el().textContent).toContain('Quedan');
      expect(el().textContent).toContain('$51,500.00');
      expect(el().textContent).toContain('Abono parcial');
    });
  });

  describe('observaciones', () => {
    it('cada cobro trae «Observar»; abre el formulario sobre ese cobro y exige un comentario', () => {
      abrir();
      const abierto: Array<string | null> = [];
      TestBed.inject(ModalService).modalState$.subscribe((s) => abierto.push(s));
      const boton = qa('.pub-item .pub-observar')[0];
      expect(boton.getAttribute('aria-label')).toContain('Recibo de la luz');
      boton.click();
      f.detectChanges();
      expect(abierto[abierto.length - 1]).toBe(MODAL_OBJETAR_COBRO);
      expect(c.observando).toEqual({ alcance: 'ITEM', clave: 'abc123', concepto: 'Recibo de la luz', monto: 61500 });
      expect(el().querySelector('.pub-obs-blanco')!.textContent).toContain('Recibo de la luz');

      c.enviarObservacion(); // sin comentario
      f.detectChanges();
      http().expectNone((r) => r.method === 'POST');
      expect(el().querySelector('.pub-obs-form .erp-field-error')!.textContent).toContain('obligatorio');
    });

    it('envía la observación con el rubro y el comentario, muestra la confirmación y recarga', () => {
      abrir();
      qa('.pub-item .pub-observar')[0].click();
      c.formObservacion.patchValue({ comentario: '  Ya te había abonado $50.000 de esto ', montoPropuesto: 11500 });
      c.enviarObservacion();
      const req = http().expectOne(`${API}/publico/cobros/${TOKEN}/objeciones`);
      expect(req.request.body).toEqual({ alcance: 'ITEM', itemClave: 'abc123', comentario: 'Ya te había abonado $50.000 de esto', montoPropuesto: '11500' });
      req.flush({ ...objecion(), mensaje: 'Recibimos tu observación.' });
      expect(c.observacionEnviada).toBe('Recibimos tu observación.');
      expect(c.observando).toBeNull();
      http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(publico({ objeciones: [objecion()] }));
      f.detectChanges();
      expect(el().textContent).toContain('Recibimos tu observación.');
      // el rubro ya no ofrece observar otra vez: dice que está esperando respuesta
      expect(qa('.pub-item .pub-observar').length).toBe(0);
      expect(el().querySelector('.pub-item .pub-observar-enviada')!.textContent).toContain('Observación enviada');
    });

    it('se puede observar el total, sin rubro', () => {
      abrir();
      qa('.pub-observar--total')[0].click();
      c.formObservacion.patchValue({ comentario: 'No reconozco el total' });
      c.enviarObservacion();
      const req = http().expectOne(`${API}/publico/cobros/${TOKEN}/objeciones`);
      expect(req.request.body).toEqual({ alcance: 'TOTAL', comentario: 'No reconozco el total' });
      req.flush({ ...objecion({ alcance: 'TOTAL', itemClave: null, concepto: null, monto: null }), mensaje: 'ok' });
      http().expectOne(`${API}/publico/cobros/${TOKEN}`).flush(publico({ objeciones: [objecion({ alcance: 'TOTAL', itemClave: null, concepto: null, monto: null })] }));
      f.detectChanges();
      expect(qa('.pub-observar--total').length).toBe(0);
      expect(el().textContent).toContain('esperando respuesta');
    });

    it('si el servidor rechaza la observación se muestra el motivo y se puede corregir', () => {
      abrir();
      qa('.pub-item .pub-observar')[0].click();
      c.formObservacion.patchValue({ comentario: 'No era mío' });
      c.enviarObservacion();
      errorHttp(http().expectOne(`${API}/publico/cobros/${TOKEN}/objeciones`), 409, { message: 'Ya tienes varias observaciones esperando respuesta.' });
      f.detectChanges();
      expect(c.errorObservacion).toContain('varias observaciones');
      expect(c.enviandoObservacion).toBeFalse();
      expect(c.observando).not.toBeNull(); // el formulario sigue abierto
    });

    it('«Mis observaciones» muestra la respuesta del propietario y lo que se descontó', () => {
      abrir(publico({ objeciones: [objecion({ estado: 'RESUELTA', resolucion: 'AJUSTADA', respuesta: 'Tienes razón, lo ajusté', montoAjuste: 21500 }), objecion({ id: 2, alcance: 'TOTAL', itemClave: null, concepto: null, monto: null, comentario: 'No reconozco el total' })] }));
      const items = qa('.pub-obs');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Monto ajustado');
      expect(items[0].textContent).toContain('Tienes razón, lo ajusté');
      expect(items[0].textContent).toContain('$21,500.00');
      expect(items[1].textContent).toContain('Esperando respuesta');
      expect(items[1].textContent).toContain('El total');
    });
  });
});

describe('ObservacionesCobroComponent — resolver', () => {
  afterEach(() => verificarHttp());
  let f: ComponentFixture<ObservacionesCobroComponent>;
  let c: ObservacionesCobroComponent;
  const el = () => f.nativeElement as HTMLElement;
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  const obs = (extra: Partial<ObjecionCobro> = {}): ObjecionCobro => ({
    id: 7, alcance: 'ITEM', itemClave: 'abc', concepto: 'Recibo de la luz', monto: 61500, comentario: 'Solo usé la mitad del mes', montoPropuesto: 40000, estado: 'ABIERTA', resolucion: null, respuesta: null, montoAjuste: null,
    creadaEn: '2026-10-20T15:00:00.000Z', resueltaEn: null, enlaceId: 3, personaId: 2, persona: 'Andrés', periodo: '2026-10', movimientoId: null, ...extra,
  });

  function crear(lista: ObjecionCobro[] = [obs()], enlaces: EnlaceCobro[] = [enlace()]): void {
    configurarTestBed([ObservacionesCobroComponent]);
    f = TestBed.createComponent(ObservacionesCobroComponent);
    c = f.componentInstance;
    c.periodo = '2026-10';
    c.enlaces = enlaces;
    f.componentInstance.ngOnChanges({ periodo: { currentValue: '2026-10', previousValue: undefined, firstChange: true, isFirstChange: () => true } });
    f.detectChanges();
    const req = http().expectOne((r) => r.url === `${API}/cobros/objeciones`);
    expect(req.request.params.get('periodo')).toBe('2026-10');
    req.flush(lista);
    f.detectChanges();
  }

  it('lista lo que está por responder con lo que la persona dijo y contadores por estado', () => {
    crear([obs(), obs({ id: 8, estado: 'RESUELTA', resolucion: 'MANTENIDA', respuesta: 'Así quedó' })]);
    expect(qa('.obs').length).toBe(1); // por defecto «Por responder»
    expect(qa('.obs')[0].textContent).toContain('Andrés');
    expect(qa('.obs')[0].textContent).toContain('Recibo de la luz');
    expect(qa('.obs')[0].textContent).toContain('Solo usé la mitad del mes');
    expect(qa('.obs')[0].textContent).toContain('Cree que debe $40,000.00');
    expect(c.contar('ABIERTA')).toBe(1);
    expect(c.contar('RESUELTA')).toBe(1);
    c.filtro = '';
    f.detectChanges();
    expect(qa('.obs').length).toBe(2);
  });

  it('sin nada por responder lo explica', () => {
    crear([]);
    expect(el().querySelector('app-empty-state')!.textContent).toContain('Nada por responder');
  });

  it('«Ajustar el monto» (lo más probable si propuso uno) muestra cómo quedaría su total antes de confirmar', () => {
    crear();
    qa('.obs .cobro-acciones button')[0].click();
    f.detectChanges();
    expect(c.borrador!.accion).toBe('AJUSTAR');
    expect(c.borrador!.monto).toBe('40000');
    const previa = el().querySelector('.previa')!;
    expect(previa.textContent).toContain('$61,500.00'); // lo que debe hoy
    expect(previa.textContent).toContain('$40,000.00'); // 61.500 − 21.500 de descuento
    expect(previa.textContent).toContain('Descuento de $21,500.00');
    expect(c.previa!.saldoNuevo).toBe(40000);
  });

  it('confirma el ajuste: manda acción, monto y mensaje; actualiza la tarjeta y avisa al padre con el enlace recalculado', () => {
    crear();
    const avisos: unknown[] = [];
    c.cambio.subscribe((x) => avisos.push(x));
    const exito = spyOn(TestBed.inject(ToastService), 'exito');
    c.abrirResolucion(c.objeciones[0]);
    c.borrador!.respuesta = 'Tienes razón, lo ajusto';
    c.confirmar();
    const req = esperar('POST', 'cobros/objeciones/7/resolver');
    expect(req.request.body).toEqual({ accion: 'AJUSTAR', monto: '40000', respuesta: 'Tienes razón, lo ajusto' });
    const nuevoEnlace = enlace({ resumen: { totalCargos: 61500, totalAbonosYFavor: 21500, saldoNetoFinal: 40000, estado: 'DEBE', saldoAnterior: 0, saldoTotalAcumulado: 40000 }, objecionesAbiertas: 0 });
    req.flush({ objecion: obs({ estado: 'RESUELTA', resolucion: 'AJUSTADA', respuesta: 'Tienes razón, lo ajusto', montoAjuste: 21500, movimientoId: 99 }), descuento: 21500, enlace: nuevoEnlace });
    f.detectChanges();
    expect(c.borrador).toBeNull();
    expect(c.objeciones[0]).toMatchObjectLike({ estado: 'RESUELTA', resolucion: 'AJUSTADA' });
    expect(avisos).toEqual([nuevoEnlace]);
    expect(exito).toHaveBeenCalledWith(jasmine.stringContaining('$40,000.00'));
  });

  it('«Mantener» exige explicarle a la persona por qué (no se envía vacío)', () => {
    crear([obs({ montoPropuesto: null })]);
    c.abrirResolucion(c.objeciones[0]);
    c.elegirAccion('MANTENER');
    expect(c.puedeConfirmar).toBeFalse();
    c.confirmar();
    http().expectNone((r) => r.method === 'POST');
    f.detectChanges();
    expect(el().querySelector('.resolver .erp-field-error')!.textContent).toContain('motivo');
    c.borrador!.respuesta = 'Está en el recibo que te mandé';
    expect(c.puedeConfirmar).toBeTrue();
    c.confirmar();
    const req = esperar('POST', 'cobros/objeciones/7/resolver');
    expect(req.request.body).toEqual({ accion: 'MANTENER', respuesta: 'Está en el recibo que te mandé' });
    req.flush({ objecion: obs({ estado: 'RESUELTA', resolucion: 'MANTENIDA', respuesta: 'Está en el recibo que te mandé' }), descuento: null, enlace: enlace() });
    expect(c.objeciones[0].estado).toBe('RESUELTA');
  });

  it('el monto nuevo debe ser menor a lo cobrado y el descuento no puede pasar de lo que debe', () => {
    crear();
    c.abrirResolucion(c.objeciones[0]);
    c.borrador!.monto = '61500';
    expect(c.previa!.error).toContain('menor a lo cobrado');
    expect(c.puedeConfirmar).toBeFalse();
    c.elegirAccion('DESCUENTO');
    c.borrador!.monto = '70000';
    expect(c.previa!.error).toContain('no puede pasar');
    c.borrador!.monto = '10000';
    expect(c.previa!.saldoNuevo).toBe(51500);
    expect(c.puedeConfirmar).toBeTrue();
  });

  it('sobre el total solo se puede mantener o descontar; «Excluir» descuenta todo el rubro', () => {
    crear([obs({ alcance: 'TOTAL', itemClave: null, concepto: null, monto: null, montoPropuesto: null }), obs({ id: 9 })]);
    c.filtro = '';
    expect(c.acciones(c.objeciones[0]).map((a) => a.valor)).toEqual(['MANTENER', 'DESCUENTO']);
    expect(c.acciones(c.objeciones[1]).map((a) => a.valor)).toEqual(['MANTENER', 'AJUSTAR', 'EXCLUIR', 'DESCUENTO']);
    c.abrirResolucion(c.objeciones[1]);
    c.elegirAccion('EXCLUIR');
    expect(c.previa).toMatchObjectLike({ descuento: 61500, saldoNuevo: 0 });
    expect(c.puedeConfirmar).toBeTrue();
  });

  it('un error del servidor se muestra y no se pierde lo escrito', () => {
    crear();
    c.abrirResolucion(c.objeciones[0]);
    c.confirmar();
    errorHttp(esperar('POST', 'cobros/objeciones/7/resolver'), 409, { message: 'Esta observación ya fue resuelta' });
    f.detectChanges();
    expect(c.errorResolucion).toBe('Esta observación ya fue resuelta');
    expect(c.borrador).not.toBeNull();
    expect(c.trabajando).toBeFalse();
  });

  it('una observación ya resuelta con descuento se puede deshacer: vuelve a quedar abierta', () => {
    crear([obs({ estado: 'RESUELTA', resolucion: 'EXCLUIDA', montoAjuste: 61500, movimientoId: 99 })]);
    c.filtro = 'RESUELTA';
    f.detectChanges();
    expect(qa('.obs')[0].textContent).toContain('Se le descontaron $61,500.00');
    const avisos: unknown[] = [];
    c.cambio.subscribe((x) => avisos.push(x));
    qa('.obs .cobro-acciones button')[0].click();
    esperar('DELETE', 'cobros/ajustes/99').flush({ deshecho: true, movimientoId: 99 });
    http().expectOne((r) => r.url === `${API}/cobros/objeciones`).flush([obs()]);
    expect(avisos.length).toBe(1);
    expect(c.objeciones[0].estado).toBe('ABIERTA');
  });
});

describe('DescuentoEnlaceComponent', () => {
  afterEach(() => verificarHttp());
  let f: ComponentFixture<DescuentoEnlaceComponent>;
  let c: DescuentoEnlaceComponent;
  const el = () => f.nativeElement as HTMLElement;

  const ajuste = (extra: Partial<AjusteCobro> = {}): AjusteCobro => ({ movimientoId: 50, monto: 5000, concepto: 'Descuento del propietario: Ya me había abonado', fecha: '2026-10-20T00:00:00.000Z', objecionId: null, ...extra });

  function crear(e: EnlaceCobro = enlace(), ajustes: AjusteCobro[] = []): void {
    configurarTestBed([DescuentoEnlaceComponent]);
    f = TestBed.createComponent(DescuentoEnlaceComponent);
    c = f.componentInstance;
    c.enlace = e;
    f.detectChanges();
    responder(`cobros/enlaces/${e.id}/ajustes`, ajustes);
    f.detectChanges();
  }

  it('muestra lo que debe, vista previa del total nuevo y lista los descuentos vigentes', () => {
    crear(enlace(), [ajuste()]);
    expect(el().textContent).toContain('Descuento para Andrés');
    c.monto = '11500';
    f.detectChanges();
    expect(c.previa).toMatchObjectLike({ descuento: 11500, saldoNuevo: 50000 });
    expect(el().querySelector('.dto-previa')!.textContent).toContain('$50,000.00');
    expect(el().querySelector('.dto-ajustes')!.textContent).toContain('Ya me había abonado');
  });

  it('exige un motivo; no pasa de lo que debe; «Todo» descuenta el saldo completo', () => {
    crear();
    c.monto = '70000';
    c.motivo = 'abc';
    expect(c.previa.error).toContain('no puede pasar');
    expect(c.puedeAplicar).toBeFalse();
    c.descontarTodo();
    expect(c.monto).toBe('61500');
    c.motivo = 'a';
    expect(c.puedeAplicar).toBeFalse();
    c.aplicar();
    http().expectNone((r) => r.method === 'POST');
    c.motivo = 'Todo perdonado';
    expect(c.puedeAplicar).toBeTrue();
  });

  it('aplica el descuento: manda monto y motivo, avisa con el enlace recalculado y recarga la lista', () => {
    crear();
    const avisos: unknown[] = [];
    c.cambio.subscribe((x) => avisos.push(x));
    c.monto = '11500';
    c.motivo = 'Ya me había abonado';
    c.aplicar();
    const req = esperar('POST', 'cobros/enlaces/3/descuento');
    expect(req.request.body).toEqual({ monto: '11500', motivo: 'Ya me había abonado' });
    const nuevo = enlace({ resumen: { totalCargos: 61500, totalAbonosYFavor: 11500, saldoNetoFinal: 50000, estado: 'DEBE', saldoAnterior: 0, saldoTotalAcumulado: 50000 } });
    req.flush({ movimientoId: 50, descuento: 11500, enlace: nuevo });
    expect(avisos).toEqual([nuevo]);
    expect(c.saldo).toBe(50000);
    expect(c.monto).toBe('');
    responder('cobros/enlaces/3/ajustes', [ajuste({ monto: 11500 })]);
    expect(c.ajustes.length).toBe(1);
  });

  it('«Deshacer» anula un descuento y avisa', () => {
    crear(enlace(), [ajuste()]);
    const avisos: unknown[] = [];
    c.cambio.subscribe((x) => avisos.push(x));
    el().querySelector<HTMLButtonElement>('.dto-ajustes button')!.click();
    esperar('DELETE', 'cobros/ajustes/50').flush({ deshecho: true, movimientoId: 50 });
    responder('cobros/enlaces/3/ajustes', []);
    expect(avisos.length).toBe(1);
    expect(c.ajustes).toEqual([]);
  });

  it('quien no debe nada no puede recibir un descuento', () => {
    crear(enlace({ resumen: { totalCargos: 0, totalAbonosYFavor: 0, saldoNetoFinal: 0, estado: 'PAZ_Y_SALVO', saldoAnterior: 0, saldoTotalAcumulado: 0 } }));
    expect(el().textContent).toContain('no debe nada');
    expect(el().querySelector('#dto-monto')).toBeNull();
  });
});

describe('MetodosPagoComponent — administrar medios de pago', () => {
  afterEach(() => verificarHttp());
  let f: ComponentFixture<MetodosPagoComponent>;
  let c: MetodosPagoComponent;
  const el = () => f.nativeElement as HTMLElement;
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  /** Al abrir el formulario el selector de cuentas pide su catálogo. */
  const atenderCatalogos = () => http().match((r) => r.url === `${API}/lookup`).forEach((r) => r.flush({ personas: [], tarjetas: [], cuentas: [], categorias: [] }));

  function crear(lista: MetodoPago[] = [metodoAdmin(), metodoAdmin({ id: 2, tipo: 'CUENTA_AHORROS', entidad: 'Bancolombia', numero: '12345678901', orden: 1 })]): void {
    configurarTestBed([MetodosPagoComponent, MetodosPagoPublicoComponent, ModalComponent]);
    f = TestBed.createComponent(MetodosPagoComponent);
    c = f.componentInstance;
    f.detectChanges();
    responder('metodos-pago', lista);
    f.detectChanges();
  }

  it('lista los medios en orden y muestra cómo los ve la persona', () => {
    crear();
    expect(qa('.mp-item').map((x) => x.querySelector('strong')!.textContent)).toEqual(['Nequi', 'Bancolombia']);
    expect(qa('.mp-item')[1].textContent).toContain('1234 5678 901');
    expect(qa('.mp-previa .wallet').length).toBe(2);
  });

  it('sin medios invita a agregar el primero', () => {
    crear([]);
    expect(el().querySelector('app-empty-state')!.textContent).toContain('Aún no tienes medios de pago');
  });

  it('el interruptor oculta un medio de los enlaces (PATCH) y avisa al padre', () => {
    crear();
    const avisos: unknown[] = [];
    c.cambio.subscribe(() => avisos.push(1));
    el().querySelector<HTMLButtonElement>('.mp-interruptor')!.click();
    const req = esperar('PATCH', 'metodos-pago/1');
    expect(req.request.body).toEqual({ activo: false });
    req.flush(metodoAdmin({ activo: false }));
    f.detectChanges();
    expect(avisos.length).toBe(1);
    expect(qa('.mp-item')[0].classList).toContain('mp-item--inactivo');
    expect(qa('.mp-previa .wallet').length).toBe(1); // la vista previa solo muestra los activos
  });

  it('agrega un medio validando el número según el tipo y lo envía limpio', () => {
    crear([]);
    c.abrirNuevo();
    f.detectChanges();
    atenderCatalogos();
    c.form.patchValue({ tipo: 'NEQUI', entidad: 'Nequi', numero: '12345', titular: '  Felipe ' });
    c.guardar();
    http().expectNone((r) => r.method === 'POST');
    f.detectChanges();
    expect(el().textContent).toContain('El celular debe tener 10 dígitos');

    c.form.patchValue({ numero: '300 123 4567' });
    c.guardar();
    const req = esperar('POST', 'metodos-pago');
    expect(req.request.body).toEqual({ tipo: 'NEQUI', entidad: 'Nequi', numero: '300 123 4567', titular: 'Felipe', activo: true });
    req.flush(metodoAdmin({ id: 5 }));
    responder('metodos-pago', [metodoAdmin({ id: 5 })]);
    expect(c.formularioAbierto).toBeFalse();
  });

  it('elegir «Daviplata» o «Llave» sugiere la entidad, sin pisar un banco ya escrito', () => {
    crear([]);
    c.abrirNuevo();
    c.alElegirTipo('DAVIPLATA');
    expect(c.form.controls.entidad.value).toBe('Daviplata');
    c.form.controls.entidad.setValue('Davivienda');
    c.alElegirTipo('NEQUI');
    expect(c.form.controls.entidad.value).toBe('Davivienda');
  });

  it('edita un medio (PATCH con todo el formulario) y un error del servidor se muestra sin cerrar el formulario', () => {
    crear();
    c.abrirEditar(c.metodos[0]);
    f.detectChanges();
    atenderCatalogos();
    c.form.patchValue({ titular: 'Felipe H.' });
    c.guardar();
    errorHttp(esperar('PATCH', 'metodos-pago/1'), 400, { message: 'El número no es válido' });
    f.detectChanges();
    expect(c.errorForm).toBe('El número no es válido');
    expect(c.formularioAbierto).toBeTrue();
    expect(c.guardando).toBeFalse();
  });

  it('el QR se sube aparte, después de guardar el medio', () => {
    crear([]);
    c.abrirNuevo();
    f.detectChanges();
    atenderCatalogos();
    c.form.patchValue({ tipo: 'LLAVE', entidad: 'Bre-B', numero: '@felipe123' });
    c.qrNuevo = { nombre: 'qr.png', tipo: 'image/png', datos: 'iVBORw0KGgo=' };
    c.guardar();
    esperar('POST', 'metodos-pago').flush(metodoAdmin({ id: 8, tipo: 'LLAVE' }));
    const qr = esperar('PUT', 'metodos-pago/8/qr');
    expect(qr.request.body).toEqual({ qr: { nombre: 'qr.png', tipo: 'image/png', datos: 'iVBORw0KGgo=' } });
    qr.flush(metodoAdmin({ id: 8, tieneQr: true }));
    responder('metodos-pago', [metodoAdmin({ id: 8, tieneQr: true })]);
    expect(c.formularioAbierto).toBeFalse();
  });

  it('subir y bajar intercambia posiciones; eliminar pide confirmación', () => {
    crear();
    c.mover(c.metodos[0], 1);
    esperar('PATCH', 'metodos-pago/1').flush(metodoAdmin({ orden: 1 }));
    const otro = esperar('PATCH', 'metodos-pago/2');
    expect(otro.request.body).toEqual({ orden: 0 });
    otro.flush(metodoAdmin({ id: 2, orden: 0 }));
    responder('metodos-pago', [metodoAdmin({ id: 2, orden: 0 }), metodoAdmin({ id: 1, orden: 1 })]);

    c.pedirEliminar(c.metodos[0]);
    f.detectChanges();
    expect(el().querySelector('.erp-alert--warning')!.textContent).toContain('¿Eliminar');
    c.confirmarEliminar();
    esperar('DELETE', 'metodos-pago/2').flush({ eliminado: true });
    responder('metodos-pago', [metodoAdmin({ id: 1, orden: 1 })]);
    expect(c.confirmandoEliminar).toBeNull();
  });
});

// `toMatchObject` no existe en Jasmine: pequeño ayudante para comparar solo algunos campos.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jasmine {
    interface Matchers<T> {
      toMatchObjectLike(esperado: Partial<T>): boolean;
    }
  }
}
beforeAll(() => {
  jasmine.addMatchers({
    toMatchObjectLike: () => ({
      compare: (real: any, esperado: any) => {
        const falta = Object.entries(esperado).filter(([k, v]) => JSON.stringify(real?.[k]) !== JSON.stringify(v));
        return { pass: falta.length === 0, message: `Se esperaba ${JSON.stringify(esperado)} en ${JSON.stringify(real)}` };
      },
    }),
  });
});

void responderCatalogos;
