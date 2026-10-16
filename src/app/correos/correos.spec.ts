import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { ProductoDetectado, ResumenReproceso } from '../modelos/correos-inteligentes';
import { NotificacionCorreo } from '../modelos/erp';
import { ModalService } from '../services/modal.service';
import { ToastService } from '../shared/toast/toast.service';
import { API, categoriaItem, configurarTestBed, cuentaItem, errorHttp, esperar, http, persona, responder, responderCatalogos, tarjetaItem, verificarHttp } from '../testing/erp-testing';
import {
  accionesDelResumen,
  admiteConvertirEnPrestamo,
  admiteDeshacer,
  claseEstadoCorreo,
  esAceptable,
  etiquetaEstadoCorreo,
  etiquetaProducto,
  etiquetaVinculo,
  explicarMotivo,
  fechaCorteSugerida,
  interpretarCorreo,
  motivosOrdenados,
  porcentajeAvance,
  sinAsignar,
  textoSugerencia,
} from './correos.constants';
import { ProductosDetectadosComponent, asignacionDeSugerencia, construirAsignacion } from './productos-detectados/productos-detectados.component';
import { ReprocesarCorreosComponent } from './reprocesar-correos/reprocesar-correos.component';
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
    responderCatalogos({
      cuentas: [cuentaItem(1, 'Bancolombia'), cuentaItem(2, 'Nequi')],
      categorias: [categoriaItem(4, 'Mercado')],
      tarjetas: [tarjetaItem(10, 'Visa', { descripcion: 'Oro', nombre: 'Visa · Oro', etiqueta: 'Visa' }), tarjetaItem(11, 'Master', { descripcion: 'Black', nombre: 'Master · Black', etiqueta: 'Master' })],
      personas: [persona(2, 'Andrés'), persona(3, 'Papá')],
    });
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
    responderCatalogos({ personas: [persona(5, 'Alicia Buitrago')] });
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
    responderCatalogos();
    errorHttp(http().expectOne((r) => r.url === `${API}/notificaciones-correo`), 500, {});
    expect(fixture.componentInstance.error).toContain('problema');
  });
});


describe('correos.constants — vínculos, reproceso y productos', () => {
  it('explica los motivos nuevos del sync inteligente', () => {
    for (const m of ['compra_creada_desde_plantilla', 'vinculada_a_compra_existente', 'vinculada_a_transaccion_existente', 'duplicado_de_correo', 'compra_rechazada_o_no_exitosa', 'historico_sin_registro_previo']) {
      expect(explicarMotivo(m)).not.toBe(m);
    }
  });

  it('etiqueta qué hizo el sistema con el correo', () => {
    expect(etiquetaVinculo('EXISTENTE', null)).toEqual(jasmine.objectContaining({ texto: 'Enlazado a lo que ya tenías', clase: 'info' }));
    expect(etiquetaVinculo('DUPLICADO', null)?.texto).toBe('Aviso repetido');
    expect(etiquetaVinculo('CREADA', 'compra_creada_desde_plantilla')?.texto).toContain('valores habituales');
    expect(etiquetaVinculo('CREADA', 'transaccion_confirmada_automaticamente')?.texto).toBe('Registrado automáticamente');
    expect(etiquetaVinculo(null, null)).toBeNull();
  });

  it('solo se puede deshacer lo conciliado por el sistema', () => {
    expect(admiteDeshacer({ estado_procesamiento: 'CONCILIADO', vinculo: 'CREADA' })).toBeTrue();
    expect(admiteDeshacer({ estado_procesamiento: 'CONCILIADO', vinculo: null })).toBeFalse();
    expect(admiteDeshacer({ estado_procesamiento: 'PENDIENTE', vinculo: 'CREADA' })).toBeFalse();
  });

  it('resume el reproceso: acciones en orden, sin las vacías, y motivos pendientes de mayor a menor', () => {
    expect(accionesDelResumen({ duplicados: 2, compras_enlazadas: 5, siguen_pendientes: 1 }).map((a) => [a.clave, a.cantidad])).toEqual([['compras_enlazadas', 5], ['duplicados', 2], ['siguen_pendientes', 1]]);
    const motivos = motivosOrdenados({ vinculada_a_compra_existente: 9, tarjeta_no_identificada: 3, cuenta_no_identificada: 7 });
    expect(motivos.map((m) => [m.motivo, m.cantidad])).toEqual([['cuenta_no_identificada', 7], ['tarjeta_no_identificada', 3]]);
    expect(motivosOrdenados({ vinculada_a_compra_existente: 9 }, false).length).toBe(1);
    expect(porcentajeAvance(25, 100)).toBe(25);
    expect(porcentajeAvance(5, 0)).toBe(0);
    expect(porcentajeAvance(120, 100)).toBe(100);
  });

  it('la fecha de corte sugerida es el día siguiente a la última compra registrada (o el 1.º del mes)', () => {
    // epoch-ms a medianoche UTC, como llegan las fechas de compra del backend legacy
    const compras = [{ fechaCompra: Date.UTC(2026, 4, 24) }, { fechaCompra: Date.UTC(2026, 5, 1) }, { fechaCompra: undefined }];
    expect(fechaCorteSugerida(compras)).toBe('2026-06-02');
    expect(fechaCorteSugerida([{ fechaCompra: Date.UTC(2026, 11, 31) }])).toBe('2027-01-01');
    expect(fechaCorteSugerida([], new Date(2026, 9, 15))).toBe('2026-10-01');
  });

  it('textos de sugerencia y cuáles se pueden aceptar sin pensar', () => {
    const fuerte = { tipo: 'TARJETA_EXISTENTE', tarjetaId: 2, tarjeta: 'Amex', votos: 192, total: 193, automatica: true } as const;
    const debil = { ...fuerte, votos: 1, total: 1, automatica: false };
    expect(textoSugerencia(fuerte)).toContain('192 de 193');
    expect(textoSugerencia(debil)).toContain('solo 1 compra coincide');
    expect(textoSugerencia({ tipo: 'CREAR_CUENTA', nombre: 'x', tipoCuenta: 'AHORROS', esPrincipal: true })).toContain('principal');
    expect(textoSugerencia({ tipo: 'AGREGAR_A_CUENTA', cuentaId: 1, cuenta: 'Ahorros' })).toContain('Ahorros');
    expect(textoSugerencia({ tipo: 'CREAR_TARJETA' })).toContain('nueva');
    expect(textoSugerencia(null)).toBeNull();
    expect([fuerte, debil, { tipo: 'CREAR_TARJETA' } as const, { tipo: 'CREAR_CUENTA', nombre: 'x', tipoCuenta: 'AHORROS', esPrincipal: false } as const].map((x) => esAceptable(x))).toEqual([true, false, false, true]);
    expect(esAceptable(null)).toBeFalse();
    expect(etiquetaProducto({ instrumento: 'TC', esDebito: false })).toBe('Tarjeta de crédito');
    expect(etiquetaProducto({ instrumento: 'CUENTA', esDebito: true })).toBe('Tarjeta débito');
    expect(etiquetaProducto({ instrumento: 'CUENTA', esDebito: false })).toBe('Cuenta');
  });
});

function producto(extra: Partial<ProductoDetectado> = {}): ProductoDetectado {
  return {
    ultimos4: '1927', instrumento: 'TC', esDebito: false, correos: 384, pendientes: 380, primera: '2024-12-27T00:00:00.000Z', ultima: '2026-10-13T00:00:00.000Z', totalCop: '48706756', asignadoA: null,
    sugerencia: { tipo: 'TARJETA_EXISTENTE', tarjetaId: 2, tarjeta: 'American Express', votos: 192, total: 193, automatica: true }, ...extra,
  };
}

describe('ProductosDetectadosComponent', () => {
  afterEach(() => verificarHttp());

  it('construirAsignacion / asignacionDeSugerencia arman el cuerpo según lo elegido', () => {
    const p = { ultimos4: '1927', instrumento: 'TC' as const };
    expect(construirAsignacion(p, { destino: 't:2', nombre: '', esPrincipal: false })).toEqual({ ultimos4: '1927', destino: 'TARJETA', id: 2 });
    expect(construirAsignacion(p, { destino: 'c:7', nombre: '', esPrincipal: false })).toEqual({ ultimos4: '1927', destino: 'CUENTA', id: 7 });
    expect(construirAsignacion(p, { destino: 'nueva-tarjeta', nombre: ' Visa ', esPrincipal: false })).toEqual({ ultimos4: '1927', destino: 'TARJETA', nuevo: { franquicia: 'Visa' } });
    expect(construirAsignacion(p, { destino: 'nueva-cuenta', nombre: 'Ahorros', esPrincipal: true })).toEqual({ ultimos4: '1927', destino: 'CUENTA', nuevo: { nombre: 'Ahorros', esPrincipal: true } });
    expect(construirAsignacion(p, { destino: '', nombre: '', esPrincipal: false })).toBeNull();
    expect(construirAsignacion(p, { destino: 't:abc', nombre: '', esPrincipal: false })).toBeNull();

    expect(asignacionDeSugerencia(p, producto().sugerencia)).toEqual({ ultimos4: '1927', destino: 'TARJETA', id: 2 });
    expect(asignacionDeSugerencia(p, { tipo: 'AGREGAR_A_CUENTA', cuentaId: 7, cuenta: 'x' })).toEqual({ ultimos4: '1927', destino: 'CUENTA', id: 7 });
    expect(asignacionDeSugerencia(p, { tipo: 'CREAR_CUENTA', nombre: 'Bancolombia *1927', tipoCuenta: 'AHORROS', esPrincipal: true })).toEqual({
      ultimos4: '1927', destino: 'CUENTA', nuevo: { nombre: 'Bancolombia *1927', tipoCuenta: 'AHORROS', esPrincipal: true },
    });
    expect(asignacionDeSugerencia(p, { tipo: 'CREAR_TARJETA' })).toBeNull();
    expect(asignacionDeSugerencia(p, null)).toBeNull();
    expect(sinAsignar([producto(), producto({ ultimos4: '9491', asignadoA: { tipo: 'TARJETA', id: 1, nombre: 'Mastercard' } })]).length).toBe(1);
  });

  function iniciar(productos: ProductoDetectado[]) {
    configurarTestBed([ProductosDetectadosComponent]);
    const fixture = TestBed.createComponent(ProductosDetectadosComponent);
    fixture.detectChanges();
    responder('notificaciones-correo/productos', productos);
    responderCatalogos({
      tarjetas: [tarjetaItem(1, 'Mastercard'), tarjetaItem(2, 'American Express', { descripcion: 'Platinum', nombre: 'American Express · Platinum' })],
      cuentas: [cuentaItem(7, 'Ahorros')],
    });
    fixture.detectChanges();
    return fixture;
  }

  const recargar = (productos: ProductoDetectado[] = []) => {
    responder('notificaciones-correo/productos', productos);
  };

  it('muestra cuántos están sin asignar, abierto si falta alguno y plegado si todos están asignados', () => {
    const f = iniciar([producto(), producto({ ultimos4: '9491', asignadoA: { tipo: 'TARJETA', id: 1, nombre: 'Mastercard' }, sugerencia: null })]);
    const c = f.componentInstance;
    expect(c.porAsignar.length).toBe(1);
    expect(c.aceptables.length).toBe(1);
    expect(c.abierto).toBeTrue();
    expect((f.nativeElement as HTMLElement).textContent).toContain('1 sin asignar');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Aceptar sugerencias (1)');
    TestBed.resetTestingModule();

    const todo = iniciar([producto({ asignadoA: { tipo: 'TARJETA', id: 2, nombre: 'Amex' }, sugerencia: null })]);
    expect(todo.componentInstance.abierto).toBeFalse();
    expect((todo.nativeElement as HTMLElement).textContent).toContain('todas asignadas');
  });

  it('aceptar todas las sugerencias llama al backend, avisa y recarga', () => {
    const f = iniciar([producto()]);
    const c = f.componentInstance;
    const cambiado = jasmine.createSpy('cambiado');
    c.cambiado.subscribe(cambiado);
    const exito = spyOn(TestBed.inject(ToastService), 'exito');
    c.aceptarTodo();
    const req = esperar('POST', 'notificaciones-correo/productos/aceptar-sugerencias');
    expect(req.request.body).toEqual({});
    req.flush({ aplicados: [{ ultimos4: '1927', destino: 'TARJETA', id: 2, nombre: 'Amex', creado: false }, { ultimos4: '3698', destino: 'CUENTA', id: 9, nombre: 'Ahorros', creado: true }], omitidos: [] });
    expect(exito).toHaveBeenCalledWith('2 productos asignados (1 creado).');
    expect(cambiado).toHaveBeenCalled();
    recargar();
  });

  it('aceptar la sugerencia de uno y asignar a mano uno nuevo', () => {
    const f = iniciar([producto(), producto({ ultimos4: '5052', sugerencia: { tipo: 'CREAR_TARJETA' } })]);
    const c = f.componentInstance;
    c.aceptarUno(c.productos[0]);
    const req = esperar('POST', 'notificaciones-correo/productos/asignar');
    expect(req.request.body).toEqual({ ultimos4: '1927', destino: 'TARJETA', id: 2 });
    req.flush({ ultimos4: '1927', destino: 'TARJETA', id: 2, nombre: 'American Express', creado: false });
    recargar([producto({ ultimos4: '5052', sugerencia: { tipo: 'CREAR_TARJETA' } })]);

    c.abrirAsignar(c.productos[0]);
    expect(c.form.controls.destino.value).toBe('nueva-tarjeta');
    c.form.patchValue({ nombre: 'Visa' });
    c.guardarAsignacion();
    const nuevo = esperar('POST', 'notificaciones-correo/productos/asignar');
    expect(nuevo.request.body).toEqual({ ultimos4: '5052', destino: 'TARJETA', nuevo: { franquicia: 'Visa' } });
    errorHttp(nuevo, 409, { message: 'Los dígitos 5052 ya pertenecen a otro producto' });
    expect(c.errorAsignar).toContain('ya pertenecen');
    expect(c.asignando).not.toBeNull(); // el formulario sigue abierto para corregir
  });

  it('el formulario en línea propone la tarjeta sugerida y exige elegir un destino', () => {
    const f = iniciar([producto()]);
    const c = f.componentInstance;
    c.abrirAsignar(c.productos[0]);
    expect(c.form.controls.destino.value).toBe('t:2');
    c.form.patchValue({ destino: '' });
    c.guardarAsignacion();
    http().expectNone((r) => r.method === 'POST');
    expect(c.errorAsignar).toContain('Elige');
    c.cancelarAsignar();
    expect(c.asignando).toBeNull();
  });

  it('un error de carga se muestra con opción de reintentar', () => {
    configurarTestBed([ProductosDetectadosComponent]);
    const fixture = TestBed.createComponent(ProductosDetectadosComponent);
    fixture.detectChanges();
    errorHttp(esperar('GET', 'notificaciones-correo/productos'), 500, {});
    http().match(() => true); // forkJoin cancela las demás
    expect(fixture.componentInstance.error).toContain('problema');
  });
});

describe('ReprocesarCorreosComponent', () => {
  afterEach(() => verificarHttp());

  const resumen = (extra: Partial<ResumenReproceso> = {}): ResumenReproceso => ({
    simulado: true, desde: '2026-06-02', evaluados: 40, acciones: { compras_enlazadas: 25, compras_creadas_con_plantilla: 10, duplicados: 3, siguen_pendientes: 2 },
    motivos: { vinculada_a_compra_existente: 25, tarjeta_no_identificada: 2 }, omitidos: 0, errores: [], muestras: [], aprendizajes: [], ...extra,
  });

  function iniciar() {
    configurarTestBed([ReprocesarCorreosComponent]);
    const fixture = TestBed.createComponent(ReprocesarCorreosComponent);
    fixture.detectChanges();
    responder('compras-credito', [{ fechaCompra: Date.UTC(2026, 5, 1) }, { fechaCompra: Date.UTC(2026, 4, 24) }]);
    fixture.detectChanges();
    return fixture;
  }

  it('propone como corte el día siguiente a la última compra y simula SIN escribir', () => {
    const f = iniciar();
    const c = f.componentInstance;
    expect(c.desde).toBe('2026-06-02');
    c.simular();
    const req = esperar('POST', 'notificaciones-correo/reprocesar');
    expect(req.request.body).toEqual({ desde: '2026-06-02', simular: true });
    req.flush(resumen());
    f.detectChanges();
    expect(c.fase).toBe('resumen');
    const t = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('simulación');
    expect(t).toContain('Compras que ya tenías: se enlazan');
    expect(t).toContain('Aplicar estos cambios');
  });

  it('sin fecha de corte no se envía `desde`; si falla la simulación se vuelve a la configuración con el error', () => {
    const f = iniciar();
    const c = f.componentInstance;
    c.sinCorte = true;
    c.simular();
    const req = esperar('POST', 'notificaciones-correo/reprocesar');
    expect(req.request.body).toEqual({ simular: true });
    errorHttp(req, 400, { message: 'desde inválido' });
    expect(c.fase).toBe('config');
    expect(c.error).toBe('desde inválido');
  });

  it('aplicar ejecuta en segundo plano, muestra el avance y termina con el resumen real', fakeAsync(() => {
    configurarTestBed([ReprocesarCorreosComponent]);
    const fixture = TestBed.createComponent(ReprocesarCorreosComponent);
    fixture.detectChanges();
    responder('compras-credito', []);
    const c = fixture.componentInstance;
    const terminado = jasmine.createSpy('terminado');
    c.terminado.subscribe(terminado);
    c.resumen = resumen();
    c.fase = 'resumen';

    c.aplicar();
    const inicio = esperar('POST', 'notificaciones-correo/reprocesar');
    expect(inicio.request.body.simular).toBeFalse();
    inicio.flush({ jobId: 'job-1', total: 40 });

    tick(1500);
    esperar('GET', 'notificaciones-correo/reprocesar/job-1').flush({ jobId: 'job-1', estado: 'EN_CURSO', total: 40, procesados: 10, iniciado: 'x', terminado: null, resumen: null, error: null });
    expect(c.fase).toBe('ejecutando');
    expect(c.avance?.procesados).toBe(10);

    tick(1500);
    esperar('GET', 'notificaciones-correo/reprocesar/job-1').flush({ jobId: 'job-1', estado: 'TERMINADO', total: 40, procesados: 40, iniciado: 'x', terminado: 'y', resumen: resumen({ simulado: false }), error: null });
    expect(c.fase).toBe('listo');
    expect(terminado).toHaveBeenCalledWith(jasmine.objectContaining({ simulado: false, evaluados: 40 }));
    discardPeriodicTasks();
  }));

  it('si el trabajo en segundo plano falla, vuelve al resumen con el motivo', fakeAsync(() => {
    configurarTestBed([ReprocesarCorreosComponent]);
    const fixture = TestBed.createComponent(ReprocesarCorreosComponent);
    fixture.detectChanges();
    responder('compras-credito', []);
    const c = fixture.componentInstance;
    c.resumen = resumen();
    c.fase = 'resumen';
    c.aplicar();
    esperar('POST', 'notificaciones-correo/reprocesar').flush({ jobId: 'j', total: 1 });
    tick(1500);
    esperar('GET', 'notificaciones-correo/reprocesar/j').flush({ jobId: 'j', estado: 'FALLIDO', total: 1, procesados: 0, iniciado: 'x', terminado: 'y', resumen: null, error: 'se cayó la conexión' });
    expect(c.fase).toBe('resumen');
    expect(c.error).toBe('se cayó la conexión');
    discardPeriodicTasks();
  }));
});

describe('ListaCorreosComponent — vínculos y deshacer', () => {
  afterEach(() => verificarHttp());

  function iniciar(correos: NotificacionCorreo[]) {
    configurarTestBed([ListaCorreosComponent]);
    const fixture = TestBed.createComponent(ListaCorreosComponent);
    fixture.detectChanges();
    responderCatalogos({ personas: [persona(5, 'Alicia Buitrago')] });
    http().expectOne((r) => r.url === `${API}/notificaciones-correo`).flush(correos);
    fixture.detectChanges();
    return fixture;
  }

  it('lo que el sistema resolvió solo se rotula, nombra a la persona y se puede deshacer', () => {
    const f = iniciar([correo({ id: 1, estado_procesamiento: 'CONCILIADO', vinculo: 'EXISTENTE', persona_id: 5, compra_credito_generada_id: 8, datos_parseados: { monto: '50000', comercio: 'DIDI', motivo: 'vinculada_a_compra_existente' } })]);
    const c = f.componentInstance;
    c.pestana = 'CONCILIADO';
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('Enlazado a lo que ya tenías');
    expect(t).toContain('Alicia Buitrago');
    expect(t).toContain('Ya tenías esta compra registrada');
    expect(t).toContain('Deshacer');
    expect(c.efectoDeDescartar(c.correos[0])).toContain('se conserva');
    expect(c.efectoDeDescartar(correo({ vinculo: 'DUPLICADO' }))).toContain('repetido');
  });

  it('abre y cierra el reproceso en un modal', () => {
    const f = iniciar([]);
    const c = f.componentInstance;
    c.abrirReproceso();
    expect(c.reprocesando).toBeTrue();
    TestBed.inject(ModalService).close();
    expect(c.reprocesando).toBeFalse();
    c.onReprocesado({ ...({} as ResumenReproceso), acciones: { compras_creadas_con_plantilla: 2, compras_creadas: 1, transacciones_creadas: 4, compras_enlazadas: 6 } } as ResumenReproceso);
    http().expectOne((r) => r.url === `${API}/notificaciones-correo`).flush([]);
  });
});
