import { TestBed } from '@angular/core/testing';
import { Transaccion } from '../modelos/erp';
import { ModalService } from '../services/modal.service';
import { ToastService } from '../shared/toast/toast.service';
import { API, categoriaItem, configurarTestBed, cuentaItem, errorHttp, esperar, http, responderCatalogos, tarjetaItem, verificarHttp } from '../testing/erp-testing';
import {
  FormularioTransaccionComponent,
  aDatetimeLocal,
  calcularCambiosTransaccion,
  construirAlta,
  valoresDeTransaccion,
} from './formulario-transaccion/formulario-transaccion.component';
import { LIMITE_CONSULTA, ListaTransaccionesComponent, TAM_PAGINA, filtroDeConsulta } from './lista-transacciones/lista-transacciones.component';
import { claseEstadoTransaccion, efectoDe, etiquetaEstadoTransaccion, reglasDeTipo, totalesDe } from './transacciones.constants';

function tx(extra: Partial<Transaccion> = {}): Transaccion {
  return {
    id: 1, owner_user_id: 1, tipo_transaccion: 'EGRESO', cuenta_origen_id: 3, cuenta_destino_id: null, tarjeta_pagada_id: null, categoria_id: null,
    fecha_transaccion: '2026-10-05T15:30:00.000Z', concepto: 'Mercado', moneda_original: 'COP', monto_original: 120000.5, tasa_cambio: 1, monto_cop: 120000.5,
    origen_registro: 'MANUAL', estado: 'CONFIRMADO', notas: null, created_at: null, ...extra,
  };
}

const cuenta = (id: number, nombre = `Cuenta ${id}`) => cuentaItem(id, nombre, { saldoActual: 100 });
const categoria = (id: number, nombre: string) => categoriaItem(id, nombre);

describe('transacciones.constants', () => {
  it('reglas por tipo: espejo de las del backend', () => {
    expect(reglasDeTipo('EGRESO')).toEqual(jasmine.objectContaining({ requiereOrigen: true, requiereDestino: false, signo: -1 }));
    expect(reglasDeTipo('INGRESO')).toEqual(jasmine.objectContaining({ requiereOrigen: false, requiereDestino: true, signo: 1 }));
    expect(reglasDeTipo('TRANSFERENCIA')).toEqual(jasmine.objectContaining({ requiereOrigen: true, requiereDestino: true, signo: 0 }));
    expect(reglasDeTipo('PAGO_TARJETA')).toEqual(jasmine.objectContaining({ requiereOrigen: true, requiereTarjeta: true }));
    expect(reglasDeTipo('REEMBOLSO_TERCERO').requiereDestino).toBeTrue();
    expect(reglasDeTipo('PAGO_PRESTAMO').requiereOrigen).toBeTrue();
  });

  it('totales: solo CONFIRMADAS, sin transferencias, sin errores de coma flotante', () => {
    const t = totalesDe([
      tx({ tipo_transaccion: 'INGRESO', monto_cop: 0.1 }),
      tx({ tipo_transaccion: 'REEMBOLSO_TERCERO', monto_cop: 0.2 }),
      tx({ tipo_transaccion: 'EGRESO', monto_cop: 0.05 }),
      tx({ tipo_transaccion: 'PAGO_TARJETA', monto_cop: 0.01 }),
      tx({ tipo_transaccion: 'TRANSFERENCIA', monto_cop: 999 }),
      tx({ tipo_transaccion: 'EGRESO', monto_cop: 500, estado: 'ANULADO' }),
      tx({ tipo_transaccion: 'EGRESO', monto_cop: 700, estado: 'PENDIENTE_REVISION' }),
    ]);
    expect(t).toEqual({ ingresos: 0.3, egresos: 0.06, neto: 0.24, pendientesRevision: 1 });
  });

  it('efecto firmado y etiquetas de estado', () => {
    expect(efectoDe(tx({ tipo_transaccion: 'INGRESO', monto_cop: 10 }))).toBe(10);
    expect(efectoDe(tx({ tipo_transaccion: 'EGRESO', monto_cop: 10 }))).toBe(-10);
    expect(efectoDe(tx({ tipo_transaccion: 'TRANSFERENCIA', monto_cop: 10 }))).toBeCloseTo(0);
    expect(claseEstadoTransaccion('CONFIRMADO')).toBe('success');
    expect(claseEstadoTransaccion('PENDIENTE_REVISION')).toBe('warning');
    expect(claseEstadoTransaccion('ANULADO')).toBe('danger');
    expect(etiquetaEstadoTransaccion('PENDIENTE_REVISION')).toBe('Pendiente de revisión');
  });
});

describe('formulario de transacción: construcción de cuerpos', () => {
  const base = valoresDeTransaccion(tx());

  it('aDatetimeLocal usa la hora local sin segundos', () => {
    expect(aDatetimeLocal(new Date(2026, 9, 5, 8, 7))).toBe('2026-10-05T08:07');
  });

  it('el alta solo incluye las referencias que el tipo admite', () => {
    const egreso = construirAlta({ ...base, tipoTransaccion: 'EGRESO', cuentaOrigenId: 3, cuentaDestinoId: 9, tarjetaPagadaId: 4, montoOriginal: 120000.5, concepto: '  Mercado ' });
    expect(egreso).toEqual(jasmine.objectContaining({ tipoTransaccion: 'EGRESO', cuentaOrigenId: 3, concepto: 'Mercado', montoOriginal: '120000.5', monedaOriginal: 'COP' }));
    expect(egreso.cuentaDestinoId).toBeUndefined();
    expect(egreso.tarjetaPagadaId).toBeUndefined();
    expect(egreso.tasaCambio).toBeUndefined();

    const pagoTarjeta = construirAlta({ ...base, tipoTransaccion: 'PAGO_TARJETA', cuentaOrigenId: 3, tarjetaPagadaId: 4 });
    expect(pagoTarjeta).toEqual(jasmine.objectContaining({ cuentaOrigenId: 3, tarjetaPagadaId: 4 }));

    const ingreso = construirAlta({ ...base, tipoTransaccion: 'INGRESO', cuentaOrigenId: null, cuentaDestinoId: 7 });
    expect(ingreso.cuentaDestinoId).toBe(7);
    expect(ingreso.cuentaOrigenId).toBeUndefined();
  });

  it('moneda extranjera envía la tasa; la fecha viaja en ISO UTC', () => {
    const usd = construirAlta({ ...base, monedaOriginal: 'usd', montoOriginal: '49.99', tasaCambio: 4150.1234 });
    expect(usd).toEqual(jasmine.objectContaining({ monedaOriginal: 'USD', montoOriginal: '49.99', tasaCambio: '4150.1234' }));
    expect(usd.fechaTransaccion).toBe(new Date(base.fechaTransaccion).toISOString());
  });

  it('notas vacías no se envían; las notas con texto sí (recortadas)', () => {
    expect(construirAlta({ ...base, notas: '   ' }).notas).toBeUndefined();
    expect(construirAlta({ ...base, notas: ' hola ' }).notas).toBe('hola');
  });

  it('la edición solo envía lo que cambió y permite vaciar referencias con null', () => {
    const original = tx({ categoria_id: 5, notas: 'a' });
    const v = valoresDeTransaccion(original);
    expect(calcularCambiosTransaccion(original, v)).toEqual({});
    expect(calcularCambiosTransaccion(original, { ...v, concepto: ' Otro ', montoOriginal: '99.5', estado: 'PENDIENTE_REVISION' })).toEqual({
      concepto: 'Otro', montoOriginal: '99.5', estado: 'PENDIENTE_REVISION',
    });
    expect(calcularCambiosTransaccion(original, { ...v, categoriaId: null })).toEqual({ categoriaId: null });
    expect(calcularCambiosTransaccion(original, { ...v, cuentaOrigenId: 8 })).toEqual({ cuentaOrigenId: 8 });
  });
});

describe('FormularioTransaccionComponent', () => {
  afterEach(() => verificarHttp());

  function crear(transaccion: Transaccion | null = null) {
    configurarTestBed([FormularioTransaccionComponent]);
    const fixture = TestBed.createComponent(FormularioTransaccionComponent);
    fixture.componentRef.setInput('transaccion', transaccion);
    fixture.detectChanges();
    responderCatalogos({ cuentas: [cuenta(3), cuenta(7)], categorias: [categoria(5, 'Alimentación')], tarjetas: [tarjetaItem(4, 'Visa', { descripcion: 'Oro', nombre: 'Visa · Oro' })] });
    return fixture.componentInstance;
  }

  it('un egreso exige la cuenta de origen; al elegirla queda válido', () => {
    const c = crear();
    c.form.patchValue({ concepto: 'Mercado', montoOriginal: 1000 });
    expect(c.form.errors?.['origen']).toBeTrue();
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
    c.form.patchValue({ cuentaOrigenId: 3 });
    expect(c.form.valid).toBeTrue();
  });

  it('cambiar de tipo vacía las referencias que ya no aplican', () => {
    const c = crear();
    c.form.patchValue({ cuentaOrigenId: 3 });
    c.form.patchValue({ tipoTransaccion: 'INGRESO' });
    expect(c.form.controls.cuentaOrigenId.value).toBeNull();
    expect(c.form.errors?.['destino']).toBeTrue();
  });

  it('una transferencia exige cuentas distintas; un pago de tarjeta exige la tarjeta', () => {
    const c = crear();
    c.form.patchValue({ tipoTransaccion: 'TRANSFERENCIA', cuentaOrigenId: 3, cuentaDestinoId: 3 });
    expect(c.form.errors?.['mismaCuenta']).toBeTrue();
    c.form.patchValue({ cuentaDestinoId: 7 });
    expect(c.form.errors).toBeNull();
    c.form.patchValue({ tipoTransaccion: 'PAGO_TARJETA', cuentaDestinoId: null });
    expect(c.form.errors?.['tarjeta']).toBeTrue();
  });

  it('en moneda extranjera la tasa es obligatoria y se muestra el equivalente en COP', () => {
    const c = crear();
    c.form.patchValue({ concepto: 'Netflix', cuentaOrigenId: 3, monedaOriginal: 'USD', montoOriginal: 10 });
    expect(c.esMonedaExtranjera).toBeTrue();
    expect(c.form.errors?.['tasa']).toBeTrue();
    c.form.patchValue({ tasaCambio: 4100.5 });
    expect(c.form.errors).toBeNull();
    expect(c.equivalenteCop).toBe(41005);
  });

  it('el monto debe ser positivo con máximo 2 decimales', () => {
    const c = crear();
    for (const mal of [0, -5, 1.234, null]) {
      c.form.patchValue({ montoOriginal: mal as never });
      expect(c.form.controls.montoOriginal.invalid).toBeTrue();
    }
    c.form.patchValue({ montoOriginal: 10.5 });
    expect(c.form.controls.montoOriginal.valid).toBeTrue();
  });

  it('el alta envía POST y emite guardada; el formulario se reinicia', () => {
    const c = crear();
    let guardadas = 0;
    c.guardada.subscribe(() => guardadas++);
    c.form.patchValue({ concepto: 'Mercado', montoOriginal: 1000.25, cuentaOrigenId: 3, categoriaId: 5 });
    c.enviar();
    const req = esperar('POST', 'transacciones');
    expect(req.request.body).toEqual(jasmine.objectContaining({ tipoTransaccion: 'EGRESO', cuentaOrigenId: 3, categoriaId: 5, montoOriginal: '1000.25', concepto: 'Mercado', estado: 'CONFIRMADO' }));
    req.flush(tx());
    expect(guardadas).toBe(1);
    expect(c.form.controls.concepto.value).toBe('');
  });

  it('el error de reglas del backend se muestra', () => {
    const c = crear();
    c.form.patchValue({ concepto: 'x', montoOriginal: 5, cuentaOrigenId: 3 });
    c.enviar();
    errorHttp(esperar('POST', 'transacciones'), 400, { message: 'Datos inválidos', errors: { cuentaOrigenId: ['no existe'] } });
    expect(c.errorServidor).toBe('cuentaOrigenId: no existe');
  });

  it('al editar, tipo y moneda quedan bloqueados y solo se envía el PATCH con lo cambiado', () => {
    const c = crear(tx({ id: 11, categoria_id: null }));
    expect(c.form.controls.tipoTransaccion.disabled).toBeTrue();
    expect(c.form.controls.monedaOriginal.disabled).toBeTrue();
    c.enviar();
    expect(c.sinCambios).toBeTrue();
    http().expectNone((r) => r.method === 'PATCH');
    c.form.patchValue({ categoriaId: 5, concepto: 'Mercado grande' });
    c.enviar();
    const req = esperar('PATCH', 'transacciones/11');
    expect(req.request.body).toEqual({ categoriaId: 5, concepto: 'Mercado grande' });
    req.flush(tx());
  });
});

describe('ListaTransaccionesComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(items: Transaccion[], total = items.length) {
    configurarTestBed([ListaTransaccionesComponent]);
    const fixture = TestBed.createComponent(ListaTransaccionesComponent);
    const c = fixture.componentInstance;
    fixture.detectChanges();
    responderCatalogos({ cuentas: [cuenta(3, 'Bancolombia')], categorias: [categoria(5, 'Alimentación')] });
    http().expectOne((r) => r.url === `${API}/transacciones`).flush({ total, limit: LIMITE_CONSULTA, offset: 0, items });
    return c;
  }

  it('filtroDeConsulta no envía filtros vacíos y siempre pide el máximo', () => {
    expect(filtroDeConsulta({ periodo: '2026-10', tipo: '', estado: '', cuenta: '', categoria: '' })).toEqual({ periodo: '2026-10', limit: LIMITE_CONSULTA });
    expect(filtroDeConsulta({ periodo: '', tipo: 'EGRESO', estado: 'CONFIRMADO', cuenta: '3', categoria: '5' })).toEqual({
      tipo: 'EGRESO', estado: 'CONFIRMADO', cuentaId: 3, categoriaId: 5, limit: LIMITE_CONSULTA,
    });
  });

  it('pide el mes actual al abrir y calcula totales y nombres', () => {
    const c = iniciar([tx({ id: 1, tipo_transaccion: 'INGRESO', cuenta_origen_id: null, cuenta_destino_id: 3, monto_cop: 1000, categoria_id: 5 }), tx({ id: 2, monto_cop: 400 })]);
    expect(c.totales).toEqual({ ingresos: 1000, egresos: 400, neto: 600, pendientesRevision: 0 });
    expect(c.nombreCuenta(3)).toBe('Bancolombia');
    expect(c.nombreCategoria(5)).toBe('Alimentación');
    expect(c.cuentasDe(c.items[0])).toBe('Bancolombia');
    expect(c.cuentasDe(tx({ cuenta_origen_id: 3, cuenta_destino_id: 3 }))).toBe('Bancolombia → Bancolombia');
  });

  it('cambiar un filtro vuelve a consultar con esos parámetros (con la paginación reiniciada)', (done) => {
    const c = iniciar([]);
    c.pagina = 3;
    c.filtros.patchValue({ tipo: 'EGRESO' });
    setTimeout(() => {
      const req = http().expectOne((r) => r.url === `${API}/transacciones` && r.params.get('tipo') === 'EGRESO');
      expect(req.request.params.get('limit')).toBe(String(LIMITE_CONSULTA));
      req.flush({ total: 0, limit: LIMITE_CONSULTA, offset: 0, items: [] });
      expect(c.pagina).toBe(0);
      expect(c.hayFiltros).toBeTrue();
      done();
    }, 250);
  });

  it('pagina en memoria y avisa cuando hay más de lo que se pudo traer', () => {
    const muchas = Array.from({ length: TAM_PAGINA + 5 }, (_, i) => tx({ id: i + 1 }));
    const c = iniciar(muchas, 900);
    expect(c.filasPagina.length).toBe(TAM_PAGINA);
    expect(c.totalPaginas).toBe(2);
    c.irPagina(1);
    expect(c.filasPagina.length).toBe(5);
    c.irPagina(5);
    expect(c.pagina).toBe(1);
    c.irPagina(-9);
    expect(c.pagina).toBe(0);
    expect(c.truncado).toBeTrue();
  });

  it('confirmar una pendiente envía PATCH { estado: CONFIRMADO } y recarga', () => {
    const c = iniciar([tx({ id: 8, estado: 'PENDIENTE_REVISION' })]);
    c.confirmar(c.items[0]);
    const req = esperar('PATCH', 'transacciones/8');
    expect(req.request.body).toEqual({ estado: 'CONFIRMADO' });
    req.flush(tx({ id: 8 }));
    http().expectOne((r) => r.url === `${API}/transacciones`).flush({ total: 0, limit: 1, offset: 0, items: [] });
  });

  it('anular pide confirmación y usa DELETE; un error se avisa', () => {
    const c = iniciar([tx({ id: 9 })]);
    const toast = TestBed.inject(ToastService);
    const error = spyOn(toast, 'error');
    c.pedirAnular(c.items[0]);
    http().expectNone((r) => r.method === 'DELETE');
    c.confirmarAnular();
    errorHttp(esperar('DELETE', 'transacciones/9'), 404, { message: 'Transacción 9 no encontrada' });
    expect(error).toHaveBeenCalledWith('Transacción 9 no encontrada');
    expect(c.confirmandoAnular).toBeNull();
  });

  it('las anuladas no se pueden editar y cerrar el modal descarta el formulario', () => {
    const c = iniciar([tx({ id: 1, estado: 'ANULADO' }), tx({ id: 2 })]);
    expect(c.puedeEditar(c.items[0])).toBeFalse();
    expect(c.puedeEditar(c.items[1])).toBeTrue();
    c.editar(c.items[1]);
    expect(c.formularioAbierto).toBeTrue();
    TestBed.inject(ModalService).close();
    expect(c.formularioAbierto).toBeFalse();
    expect(c.editando).toBeNull();
  });

  it('el error de carga se muestra', () => {
    configurarTestBed([ListaTransaccionesComponent]);
    const fixture = TestBed.createComponent(ListaTransaccionesComponent);
    fixture.detectChanges();
    responderCatalogos();
    http().match((r) => r.url.endsWith('/cuentas-financieras') || r.url.endsWith('/categorias')).forEach((r) => r.flush([]));
    errorHttp(http().expectOne((r) => r.url === `${API}/transacciones`), 500, {});
    expect(fixture.componentInstance.error).toContain('problema');
    expect(fixture.componentInstance.items).toEqual([]);
  });
});
