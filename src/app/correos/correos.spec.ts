import { TestBed } from '@angular/core/testing';
import { NotificacionCorreo } from '../modelos/erp';
import { ModalService } from '../services/modal.service';
import { ToastService } from '../shared/toast/toast.service';
import { API, configurarTestBed, errorHttp, esperar, http, responder, verificarHttp } from '../testing/erp-testing';
import { admiteConvertirEnPrestamo, claseEstadoCorreo, etiquetaEstadoCorreo, explicarMotivo, interpretarCorreo } from './correos.constants';
import { FormularioConciliarComponent, ValoresConciliacion, construirConfirmacion, modoDe } from './formulario-conciliar/formulario-conciliar.component';
import { ListaCorreosComponent, contarPorEstado } from './lista-correos/lista-correos.component';

function correo(extra: Partial<NotificacionCorreo> = {}): NotificacionCorreo {
  return {
    id: 9, owner_user_id: 1, external_message_id: '<a@b>', remitente: 'alertas@bancolombia.com.co', asunto: 'Compra EXITO', fecha_correo: '2026-10-13T19:00:00.000Z',
    cuerpo_extraido: null, estado_procesamiento: 'PENDIENTE', transaccion_generada_id: null, compra_credito_generada_id: null, created_at: null,
    datos_parseados: { monto: '50000', moneda: 'COP', comercio: 'EXITO', ultimos_4: '1927', instrumento: 'TC', ruta: 'COMPRA_TC', tipo: 'Compra', metodo: 'Tarjeta Credito' },
    ...extra,
  };
}

const vacios = (): ValoresConciliacion => ({
  concepto: '', categoriaId: null, cuentaId: null, tarjetaId: null, monto: null, notas: '', numeroCuotas: 1, responsables: [], convertir: false,
  prestamoResponsableId: null, prestamoFechaCobro: '', prestamoMetodo: null, prestamoComentarios: '',
});

describe('correos.constants', () => {
  it('interpreta datos_parseados con valores por defecto seguros', () => {
    const v = interpretarCorreo(correo());
    expect(v).toEqual(jasmine.objectContaining({ monto: 50000, moneda: 'COP', comercio: 'EXITO', ultimos4: '1927', instrumento: 'TC', ruta: 'COMPRA_TC', motivo: null }));
    const vacio = interpretarCorreo({ datos_parseados: null });
    expect(vacio).toEqual(jasmine.objectContaining({ monto: null, moneda: 'COP', comercio: null, instrumento: null }));
    expect(interpretarCorreo({ datos_parseados: { monto: 'abc', moneda: 'usd', instrumento: 'RARO' } }).monto).toBeNull();
    expect(interpretarCorreo({ datos_parseados: { monto: 12.5, moneda: 'usd' } })).toEqual(jasmine.objectContaining({ monto: 12.5, moneda: 'USD', instrumento: null }));
  });

  it('explica los motivos que deja el backend y conserva los desconocidos', () => {
    expect(explicarMotivo('tarjeta_no_identificada')).toContain('identificar la tarjeta');
    expect(explicarMotivo('trm_no_disponible')).toContain('TRM');
    expect(explicarMotivo('algo_nuevo')).toBe('algo_nuevo');
    expect(explicarMotivo(null)).toBeNull();
  });

  it('estados y conversión a préstamo', () => {
    expect(claseEstadoCorreo('CONCILIADO')).toBe('success');
    expect(claseEstadoCorreo('PENDIENTE')).toBe('warning');
    expect(claseEstadoCorreo('ERROR')).toBe('danger');
    expect(claseEstadoCorreo('IGNORADO')).toBe('neutral');
    expect(etiquetaEstadoCorreo('PENDIENTE')).toBe('Por revisar');
    expect(admiteConvertirEnPrestamo(interpretarCorreo({ datos_parseados: { ruta: 'EGRESO' } }))).toBeTrue();
    expect(admiteConvertirEnPrestamo(interpretarCorreo({ datos_parseados: { ruta: 'INGRESO' } }))).toBeFalse();
  });

  it('cuenta correos por estado', () => {
    expect(contarPorEstado([correo(), correo({ id: 2 }), correo({ id: 3, estado_procesamiento: 'CONCILIADO' })])).toEqual({ '': 3, PENDIENTE: 2, CONCILIADO: 1 });
  });
});

describe('construirConfirmacion (cuerpo de PATCH :id/conciliar)', () => {
  it('modo del correo según lo que el backend ya generó', () => {
    expect(modoDe(correo({ compra_credito_generada_id: 5 }))).toBe('compra');
    expect(modoDe(correo({ transaccion_generada_id: 5 }))).toBe('transaccion');
    expect(modoDe(correo())).toBe('nuevo');
  });

  it('compra importada: solo cuotas > 1 y responsables válidos, con el porcentaje como texto', () => {
    const n = correo({ compra_credito_generada_id: 5 });
    expect(construirConfirmacion(n, { ...vacios(), concepto: ' Nevera ', numeroCuotas: 6, responsables: [{ personaId: 2, porcentajePago: 33.33 }, { personaId: null, porcentajePago: 10 }, { personaId: 3, porcentajePago: 0 }] })).toEqual({
      accion: 'CONFIRMAR', concepto: 'Nevera', numeroCuotas: 6, responsables: [{ personaId: 2, porcentajePago: '33.33' }],
    });
    expect(construirConfirmacion(n, vacios())).toEqual({ accion: 'CONFIRMAR' });
  });

  it('transacción existente: categoría, notas y monto solo si cambió', () => {
    const n = correo({ transaccion_generada_id: 7, datos_parseados: { monto: '50000', ruta: 'EGRESO' } });
    expect(construirConfirmacion(n, { ...vacios(), categoriaId: 4, notas: ' ok ', monto: 50000 })).toEqual({ accion: 'CONFIRMAR', categoriaId: 4, notas: 'ok' });
    expect(construirConfirmacion(n, { ...vacios(), monto: 51000.5 })).toEqual({ accion: 'CONFIRMAR', monto: '51000.5' });
  });

  it('convertir en préstamo solo cuando hay persona y el correo es un egreso', () => {
    const egreso = correo({ transaccion_generada_id: 7, datos_parseados: { monto: '10000', ruta: 'EGRESO' } });
    const v = { ...vacios(), convertir: true, prestamoResponsableId: 3, prestamoFechaCobro: '2026-11-01', prestamoMetodo: 'Nequi', prestamoComentarios: ' te lo cobro ' };
    expect(construirConfirmacion(egreso, v).convertirEnPrestamo).toEqual({ responsableId: 3, fechaCobro: '2026-11-01', metodo: 'Nequi', comentarios: 'te lo cobro' });
    expect(construirConfirmacion(egreso, { ...v, prestamoResponsableId: null }).convertirEnPrestamo).toBeUndefined();
    const ingreso = correo({ transaccion_generada_id: 7, datos_parseados: { monto: '10000', ruta: 'INGRESO' } });
    expect(construirConfirmacion(ingreso, v).convertirEnPrestamo).toBeUndefined();
  });

  it('sin nada generado: tarjeta para una compra de TC, cuenta para lo demás', () => {
    expect(construirConfirmacion(correo(), { ...vacios(), tarjetaId: 4, cuentaId: 9 })).toEqual({ accion: 'CONFIRMAR', tarjetaId: 4 });
    const cuenta = correo({ datos_parseados: { monto: '10', instrumento: 'CUENTA', ruta: 'EGRESO' } });
    expect(construirConfirmacion(cuenta, { ...vacios(), tarjetaId: 4, cuentaId: 9 })).toEqual({ accion: 'CONFIRMAR', cuentaId: 9 });
  });
});

describe('FormularioConciliarComponent', () => {
  afterEach(() => verificarHttp());

  function crear(n: NotificacionCorreo) {
    configurarTestBed([FormularioConciliarComponent]);
    const fixture = TestBed.createComponent(FormularioConciliarComponent);
    fixture.componentRef.setInput('notificacion', n);
    fixture.detectChanges();
    responder('cuentas-financieras', [{ id: 1, nombre: 'Bancolombia', moneda: 'COP' }, { id: 2, nombre: 'Nequi', moneda: 'COP' }]);
    responder('categorias', [{ id: 4, nombre: 'Mercado' }]);
    responder('tarjetas', [{ id: 10, franquicia: 'Visa', descripcion: 'Oro' }, { id: 11, franquicia: 'Master', descripcion: 'Black' }]);
    responder('personas', [{ id: 2, nombre: 'Andrés' }, { id: 3, nombre: 'Papá' }]);
    return fixture.componentInstance;
  }

  it('sin tarjeta identificada exige elegirla antes de confirmar', () => {
    const c = crear(correo({ datos_parseados: { monto: '50000', instrumento: 'TC', ultimos_4: '0000', motivo: 'tarjeta_no_identificada' } }));
    expect(c.modo).toBe('nuevo');
    expect(c.esTarjeta).toBeTrue();
    expect(c.motivo).toContain('identificar la tarjeta');
    expect(c.faltaProducto).toBeTrue();
    c.enviar();
    http().expectNone((r) => r.method === 'PATCH');
    c.form.patchValue({ tarjetaId: 10 });
    c.enviar();
    const req = esperar('PATCH', 'notificaciones-correo/9/conciliar');
    expect(req.request.body).toEqual({ accion: 'CONFIRMAR', concepto: 'Compra EXITO', tarjetaId: 10 });
    req.flush({ notificacion: correo(), transaccion: null, compra: null, prestamoId: null, responsablesCreados: 0 });
  });

  it('una compra importada permite cuotas y responsables con tope de 100 %', () => {
    const c = crear(correo({ compra_credito_generada_id: 5 }));
    expect(c.modo).toBe('compra');
    c.agregarResponsable();
    c.agregarResponsable();
    c.responsables.at(0).patchValue({ personaId: 2, porcentajePago: 60 });
    c.responsables.at(1).patchValue({ personaId: 3, porcentajePago: 50 });
    expect(c.sumaPorcentajes).toBe(110);
    c.enviar();
    http().expectNone((r) => r.method === 'PATCH');
    c.responsables.at(1).patchValue({ porcentajePago: 40 });
    c.form.patchValue({ numeroCuotas: 6 });
    c.enviar();
    const req = esperar('PATCH', 'notificaciones-correo/9/conciliar');
    expect(req.request.body).toEqual({
      accion: 'CONFIRMAR', concepto: 'EXITO', numeroCuotas: 6,
      responsables: [{ personaId: 2, porcentajePago: '60' }, { personaId: 3, porcentajePago: '40' }],
    });
    req.flush({ notificacion: correo(), transaccion: null, compra: null, prestamoId: null, responsablesCreados: 2 });
  });

  it('una transacción de egreso puede convertirse en préstamo y entonces exige la persona', () => {
    const c = crear(correo({ transaccion_generada_id: 7, datos_parseados: { monto: '10000', instrumento: 'CUENTA', ruta: 'EGRESO', comercio: 'Domicilio' } }));
    expect(c.puedeConvertirEnPrestamo).toBeTrue();
    c.form.patchValue({ convertir: true });
    expect(c.form.controls.prestamoResponsableId.invalid).toBeTrue();
    c.enviar();
    http().expectNone((r) => r.method === 'PATCH');
    c.form.patchValue({ prestamoResponsableId: 2 });
    c.enviar();
    expect(esperar('PATCH', 'notificaciones-correo/9/conciliar').request.body.convertirEnPrestamo).toEqual(jasmine.objectContaining({ responsableId: 2 }));
  });

  it('muestra el error del backend (p. ej. 409 si ya estaba conciliado)', () => {
    const c = crear(correo({ datos_parseados: { monto: '10', instrumento: 'CUENTA' } }));
    c.form.patchValue({ cuentaId: 1 });
    c.enviar();
    errorHttp(esperar('PATCH', 'notificaciones-correo/9/conciliar'), 409, { message: 'La notificación ya fue conciliado' });
    expect(c.errorServidor).toBe('La notificación ya fue conciliado');
  });
});

describe('ListaCorreosComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(correos: NotificacionCorreo[]) {
    configurarTestBed([ListaCorreosComponent]);
    const fixture = TestBed.createComponent(ListaCorreosComponent);
    fixture.detectChanges();
    const req = http().expectOne((r) => r.url === `${API}/notificaciones-correo`);
    expect(req.request.params.get('limit')).toBe('300');
    req.flush(correos);
    return fixture.componentInstance;
  }

  it('muestra por defecto los pendientes y cuenta cada estado', () => {
    const c = iniciar([correo({ id: 1 }), correo({ id: 2, estado_procesamiento: 'CONCILIADO' }), correo({ id: 3, estado_procesamiento: 'IGNORADO' })]);
    expect(c.pestana).toBe('PENDIENTE');
    expect(c.visibles.map((x) => x.id)).toEqual([1]);
    expect(c.cantidad('CONCILIADO')).toBe(1);
    expect(c.cantidad('')).toBe(3);
    c.pestana = '';
    expect(c.visibles.length).toBe(3);
  });

  it('descartar pide confirmación, explica el efecto y envía DESCARTAR', () => {
    const c = iniciar([correo({ id: 4, compra_credito_generada_id: 8 })]);
    expect(c.efectoDeDescartar(c.correos[0])).toContain('compra');
    expect(c.efectoDeDescartar(correo({ transaccion_generada_id: 1 }))).toContain('anulada');
    expect(c.efectoDeDescartar(correo())).toContain('ignorado');
    c.pedirDescarte(c.correos[0]);
    http().expectNone((r) => r.method === 'PATCH');
    c.confirmarDescarte();
    const req = esperar('PATCH', 'notificaciones-correo/4/conciliar');
    expect(req.request.body).toEqual({ accion: 'DESCARTAR' });
    req.flush({ notificacion: correo(), transaccion: null, compra: null, prestamoId: null, responsablesCreados: 0 });
    http().expectOne((r) => r.url === `${API}/notificaciones-correo`).flush([]);
  });

  it('al conciliar resume lo que se hizo y recarga', () => {
    const c = iniciar([correo()]);
    const exito = spyOn(TestBed.inject(ToastService), 'exito');
    c.onConciliada({ notificacion: correo(), transaccion: null, compra: null, prestamoId: 31, responsablesCreados: 2 });
    expect(exito).toHaveBeenCalledWith('Correo conciliado: préstamo #31 creado, 2 responsables asignados.');
    http().expectOne((r) => r.url === `${API}/notificaciones-correo`).flush([]);
  });

  it('abrir y cerrar el modal crea y descarta el formulario', () => {
    const c = iniciar([correo()]);
    c.abrirConciliar(c.correos[0]);
    expect(c.conciliando?.id).toBe(9);
    TestBed.inject(ModalService).close();
    expect(c.conciliando).toBeNull();
  });

  it('un error de carga se muestra', () => {
    configurarTestBed([ListaCorreosComponent]);
    const fixture = TestBed.createComponent(ListaCorreosComponent);
    fixture.detectChanges();
    errorHttp(http().expectOne((r) => r.url === `${API}/notificaciones-correo`), 500, {});
    expect(fixture.componentInstance.error).toContain('problema');
  });
});
