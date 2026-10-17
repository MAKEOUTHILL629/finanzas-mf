import { Provider } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ComercioHabitual } from '../modelos/sugerencias';
import { Transaccion } from '../modelos/erp';
import { ModalService } from '../services/modal.service';
import { desdeDatetimeLocalBogota, hoyIso } from '../shared/periodo.helper';
import { ToastService } from '../shared/toast/toast.service';
import { API, categoriaItem, configurarTestBed, cuentaItem, errorHttp, esperar, http, responderCatalogos, sugerenciasDe, tarjetaItem, verificarHttp } from '../testing/erp-testing';
import {
  FormularioTransaccionComponent,
  aDatetimeLocal,
  calcularCambiosTransaccion,
  construirAlta,
  valoresDeTransaccion,
} from './formulario-transaccion/formulario-transaccion.component';
import { LIMITE_CONSULTA, ListaTransaccionesComponent, filtroDeConsulta } from './lista-transacciones/lista-transacciones.component';
import { estadoVacio } from '../shared/ui/filter-bar/filter-bar.types';
import { conteoPorSegmentoTx, filtrarTransacciones, segmentoDeTx, textoBuscableTx } from './transacciones-filtros';
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

  it('aDatetimeLocal usa la hora de Colombia sin segundos, sin importar el huso del navegador', () => {
    expect(aDatetimeLocal(new Date('2026-10-05T13:07:00Z'))).toBe('2026-10-05T08:07');
    expect(aDatetimeLocal(new Date('2026-10-06T04:30:00Z'))).toBe('2026-10-05T23:30'); // el día todavía es el 5 en Bogotá
    expect(aDatetimeLocal(new Date('2027-01-01T05:00:00Z'))).toBe('2027-01-01T00:00'); // medianoche: «00», no «24»
  });

  it('lo que se escribe en el formulario se entiende como hora de Colombia al enviarlo y al comparar', () => {
    expect(desdeDatetimeLocalBogota('2026-10-05T08:07').toISOString()).toBe('2026-10-05T13:07:00.000Z');
    const original = tx({ fecha_transaccion: '2026-10-05T15:30:00.000Z' });
    const v = valoresDeTransaccion(original);
    expect(v.fechaTransaccion).toBe('2026-10-05T10:30');
    expect(calcularCambiosTransaccion(original, v)).toEqual({}); // sin tocar la fecha no hay cambio
    expect(calcularCambiosTransaccion(original, { ...v, fechaTransaccion: '2026-10-05T11:00' })).toEqual({ fechaTransaccion: '2026-10-05T16:00:00.000Z' });
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
    expect(usd.fechaTransaccion).toBe('2026-10-05T15:30:00.000Z'); // 10:30 en Bogotá
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

  function crear(transaccion: Transaccion | null = null, providers: Provider[] = []) {
    TestBed.resetTestingModule();
    configurarTestBed([FormularioTransaccionComponent], providers);
    const fixture = TestBed.createComponent(FormularioTransaccionComponent);
    fixture.componentRef.setInput('transaccion', transaccion);
    fixture.detectChanges();
    responderCatalogos({ cuentas: [cuenta(3), cuenta(7)], categorias: [categoria(5, 'Alimentación')], tarjetas: [tarjetaItem(4, 'Visa', { descripcion: 'Oro', nombre: 'Visa · Oro' })] });
    return fixture.componentInstance;
  }

  describe('valores por defecto inteligentes', () => {
    const comercio = (extra: Partial<ComercioHabitual> = {}): ComercioHabitual => ({
      concepto: 'Mercado Éxito', veces: 9, ultimaFecha: '2026-10-01', cuotas: null, ultimoValor: null, tarjetaId: null, categoriaId: 5, cuentaId: 7, personaId: null, ...extra,
    });

    it('la fecha y hora de arranque son las de Colombia', () => {
      const c = crear();
      const fecha = c.form.controls.fechaTransaccion.value as string;
      expect(fecha.slice(0, 10)).toBe(hoyIso());
      expect(Math.abs(desdeDatetimeLocalBogota(fecha).getTime() - Date.now())).toBeLessThan(120_000); // el «ahora» de Colombia, a lo sumo 2 minutos de diferencia
    });

    it('sin historial el formulario arranca vacío', () => {
      const c = crear();
      expect(c.form.controls.cuentaOrigenId.value).toBeNull();
    });

    it('un egreso arranca en la cuenta que más usas; un ingreso, recibiendo en ella; una transferencia, solo con el origen', () => {
      const c = crear(null, [sugerenciasDe({ cuentaId: 7 })]);
      expect(c.form.controls.cuentaOrigenId.value).toBe(7);
      c.form.patchValue({ tipoTransaccion: 'INGRESO' });
      expect(c.form.controls.cuentaDestinoId.value).toBe(7);
      c.form.patchValue({ tipoTransaccion: 'TRANSFERENCIA' });
      expect(c.form.controls.cuentaOrigenId.value).toBe(7);
      expect(c.form.controls.cuentaDestinoId.value).toBeNull(); // el destino lo elige el usuario
    });

    it('un pago de tarjeta propone la tarjeta de crédito que más usas', () => {
      const c = crear(null, [sugerenciasDe({ cuentaId: 7, tarjetaCreditoId: 4 })]);
      c.form.patchValue({ tipoTransaccion: 'PAGO_TARJETA' });
      expect(c.form.controls.tarjetaPagadaId.value).toBe(4);
      expect(c.form.controls.cuentaOrigenId.value).toBe(7);
    });

    it('no usa una cuenta que ya no existe ni pisa lo que el usuario eligió', () => {
      expect(crear(null, [sugerenciasDe({ cuentaId: 999 })]).form.controls.cuentaOrigenId.value).toBeNull();
      const c = crear(null, [sugerenciasDe({ cuentaId: 7 })]);
      c.form.controls.cuentaOrigenId.setValue(3);
      c.form.controls.cuentaOrigenId.markAsDirty();
      c.form.patchValue({ tipoTransaccion: 'PAGO_TARJETA' });
      c.form.patchValue({ tipoTransaccion: 'EGRESO' });
      expect(c.form.controls.cuentaOrigenId.value).toBe(3);
    });

    it('al editar no se cambia nada por sugerencias', () => {
      const c = crear(tx({ id: 11, cuenta_origen_id: 3 }), [sugerenciasDe({ cuentaId: 7 })]);
      expect(c.form.controls.cuentaOrigenId.value).toBe(3);
    });

    it('el concepto ofrece los comercios que ya usaste y, al escribir uno, propone su categoría y su cuenta habituales', fakeAsync(() => {
      const c = crear(null, [sugerenciasDe({ cuentaId: 3 }, [comercio(), comercio({ concepto: 'Taxi', categoriaId: null, cuentaId: null })])]);
      expect(c.comercios.map((x) => x.concepto)).toEqual(['Mercado Éxito', 'Taxi']);
      c.form.controls.concepto.setValue('MERCADO éxito');
      tick(400);
      expect(c.form.controls.categoriaId.value).toBe(5);
      expect(c.form.controls.cuentaOrigenId.value).toBe(7); // la de ese comercio, no la general
    }));

    it('lo que ya elegiste no se pisa al escribir un comercio habitual', fakeAsync(() => {
      const c = crear(null, [sugerenciasDe({ cuentaId: 3 }, [comercio()])]);
      c.form.controls.categoriaId.setValue(8);
      c.form.controls.categoriaId.markAsDirty();
      c.form.controls.concepto.setValue('Mercado Éxito');
      tick(400);
      expect(c.form.controls.categoriaId.value).toBe(8);
    }));

    it('tras registrar, el formulario vuelve a arrancar con lo habitual', () => {
      const c = crear(null, [sugerenciasDe({ cuentaId: 7 })]);
      c.form.patchValue({ concepto: 'Mercado', montoOriginal: 1000 });
      c.enviar();
      esperar('POST', 'transacciones').flush(tx());
      expect(c.form.controls.concepto.value).toBe('');
      expect(c.form.controls.cuentaOrigenId.value).toBe(7);
    });
  });

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

  it('filtroDeConsulta solo envía el periodo (válido) y siempre pide el máximo', () => {
    expect(filtroDeConsulta({ periodo: '2026-10' })).toEqual({ periodo: '2026-10', limit: LIMITE_CONSULTA });
    expect(filtroDeConsulta({ periodo: '' })).toEqual({ limit: LIMITE_CONSULTA });
    expect(filtroDeConsulta({ periodo: 'basura' })).toEqual({ limit: LIMITE_CONSULTA });
  });

  it('pide el mes actual al abrir y calcula totales y nombres', () => {
    const c = iniciar([tx({ id: 1, tipo_transaccion: 'INGRESO', cuenta_origen_id: null, cuenta_destino_id: 3, monto_cop: 1000, categoria_id: 5 }), tx({ id: 2, monto_cop: 400 })]);
    expect(c.totales).toEqual({ ingresos: 1000, egresos: 400, neto: 600, pendientesRevision: 0 });
    expect(c.nombreCuenta(3)).toBe('Bancolombia');
    expect(c.nombreCategoria(5)).toBe('Alimentación');
    expect(c.cuentasDe(c.items[0])).toBe('Bancolombia');
    expect(c.cuentasDe(tx({ cuenta_origen_id: 3, cuenta_destino_id: 3 }))).toBe('Bancolombia → Bancolombia');
  });

  it('cambiar el periodo vuelve a consultar con ese mes', (done) => {
    const c = iniciar([]);
    c.filtros.patchValue({ periodo: '2026-09' });
    setTimeout(() => {
      const req = http().expectOne((r) => r.url === `${API}/transacciones` && r.params.get('periodo') === '2026-09');
      expect(req.request.params.get('limit')).toBe(String(LIMITE_CONSULTA));
      req.flush({ total: 0, limit: LIMITE_CONSULTA, offset: 0, items: [] });
      done();
    }, 250);
  });

  it('la barra de filtros recorta lo cargado SIN volver a consultar y los totales siguen a lo visible', () => {
    const c = iniciar([
      tx({ id: 1, tipo_transaccion: 'INGRESO', cuenta_origen_id: null, cuenta_destino_id: 3, monto_cop: 1000, categoria_id: 5, concepto: 'Salario' }),
      tx({ id: 2, monto_cop: 400, concepto: 'Mercado' }),
      tx({ id: 3, monto_cop: 50, estado: 'PENDIENTE_REVISION', concepto: 'Café' }),
    ]);
    expect(c.filtradas.length).toBe(3);
    expect(c.segmentos.map((s) => [s.valor, s.cantidad])).toEqual([['todas', 3], ['confirmadas', 2], ['revision', 1], ['anuladas', 0]]);
    c.alFiltrar({ ...estadoVacio('todas'), valores: { tipos: ['EGRESO'] } });
    expect(c.filtradas.map((t) => t.id)).toEqual([2, 3]);
    expect(c.totales).toEqual({ ingresos: 0, egresos: 400, neto: -400, pendientesRevision: 1 });
    http().expectNone((r) => r.url === `${API}/transacciones`);
  });

  it('arma los chips de filtro con los catálogos', () => {
    const c = iniciar([]);
    expect(c.definicionFiltros.map((f) => f.id)).toEqual(['tipos', 'cuentas', 'categorias', 'origen', 'fechas']);
    const cuentas = c.definicionFiltros.find((f) => f.id === 'cuentas');
    expect(cuentas && cuentas.tipo === 'seleccion' ? cuentas.opciones.map((o) => o.etiqueta) : []).toEqual(['Bancolombia']);
  });

  it('avisa cuando hay más de lo que se pudo traer', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => tx({ id: i + 1 }));
    const c = iniciar(muchas, 900);
    expect(c.truncado).toBeTrue();
    expect(c.filtradas.length).toBe(30);
  });

  it('el clic en una fila abre la edición, salvo en las anuladas', () => {
    const c = iniciar([tx({ id: 1 }), tx({ id: 2, estado: 'ANULADO' })]);
    c.abrir(c.items[1]);
    expect(c.formularioAbierto).toBeFalse();
    c.abrir(c.items[0]);
    expect(c.formularioAbierto).toBeTrue();
    expect(c.editando?.id).toBe(1);
  });

  it('las anuladas se atenúan', () => {
    const c = iniciar([]);
    expect(c.claseFila(tx({ estado: 'ANULADO' }))).toBe('apt-fila--tenue');
    expect(c.claseFila(tx())).toBe('');
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

describe('filtros de Transacciones', () => {
  const ctx = {
    nombreCuenta: (id: number | null) => (id === 3 ? 'Bancolombia' : id === 4 ? 'Nequi' : ''),
    nombreCategoria: (id: number | null) => (id === 5 ? 'Alimentación' : id === 6 ? 'Transporte' : ''),
  };
  const datos = [
    tx({ id: 1, concepto: 'Mercado Éxito', categoria_id: 5, monto_cop: 120000, fecha_transaccion: '2026-10-05T15:30:00.000Z' }),
    tx({ id: 2, tipo_transaccion: 'INGRESO', cuenta_origen_id: null, cuenta_destino_id: 4, concepto: 'Salario', monto_cop: 3000000, fecha_transaccion: '2026-10-01T05:30:00.000Z', origen_registro: 'EMAIL_AUTO' }),
    tx({ id: 3, concepto: 'Taxi', categoria_id: 6, estado: 'PENDIENTE_REVISION', cuenta_origen_id: 4, fecha_transaccion: '2026-10-31T04:30:00.000Z', notas: 'aeropuerto' }),
    tx({ id: 4, concepto: 'Compra anulada', estado: 'ANULADO' }),
  ];
  const ids = (l: Transaccion[]) => l.map((t) => t.id);
  const con = (extra: object) => ids(filtrarTransacciones(datos, { ...estadoVacio('todas'), ...extra }, ctx));

  it('segmentoDeTx mapea el estado', () => {
    expect(segmentoDeTx({ estado: 'CONFIRMADO' })).toBe('confirmadas');
    expect(segmentoDeTx({ estado: 'PENDIENTE_REVISION' })).toBe('revision');
    expect(segmentoDeTx({ estado: 'ANULADO' })).toBe('anuladas');
    expect(segmentoDeTx({ estado: null })).toBeNull();
  });

  it('el segmento filtra por estado', () => {
    expect(ids(filtrarTransacciones(datos, estadoVacio('revision'), ctx))).toEqual([3]);
    expect(ids(filtrarTransacciones(datos, estadoVacio('anuladas'), ctx))).toEqual([4]);
    expect(ids(filtrarTransacciones(datos, estadoVacio('confirmadas'), ctx))).toEqual([1, 2]);
  });

  it('el buscador mira concepto, categoría, cuenta, tipo, estado, notas y monto, sin tildes', () => {
    expect(con({ busqueda: 'exito' })).toEqual([1]);
    expect(con({ busqueda: 'alimentacion' })).toEqual([1]);
    expect(con({ busqueda: 'nequi' })).toEqual([2, 3]);
    expect(con({ busqueda: 'ingreso' })).toEqual([2]);
    expect(con({ busqueda: 'aeropuerto' })).toEqual([3]);
    expect(con({ busqueda: 'correo' })).toEqual([2]);
    expect(con({ busqueda: '3000000' })).toEqual([2]);
    expect(con({ busqueda: 'pendiente revision' })).toEqual([3]);
    expect(textoBuscableTx(datos[0], ctx)).toContain('bancolombia');
  });

  it('filtra por tipo, cuenta (origen o destino), categoría y origen', () => {
    expect(con({ valores: { tipos: ['INGRESO'] } })).toEqual([2]);
    expect(con({ valores: { cuentas: [4] } })).toEqual([2, 3]);
    expect(con({ valores: { cuentas: [3] } })).toEqual([1, 4]);
    expect(con({ valores: { categorias: [5, 6] } })).toEqual([1, 3]);
    expect(con({ valores: { origen: ['EMAIL_AUTO'] } })).toEqual([2]);
    expect(con({ valores: { cuentas: [4], tipos: ['EGRESO'] } })).toEqual([3]);
  });

  it('el rango de fechas se mide por día de Bogotá e incluye el último día', () => {
    expect(con({ valores: { fechas: { desde: '2026-10-05', hasta: '2026-10-05' } } })).toEqual([1, 4]);
    expect(con({ valores: { fechas: { desde: '2026-10-30', hasta: null } } })).toEqual([3]); // 04:30Z = 23:30 del 30 en Bogotá
    expect(con({ valores: { fechas: { desde: null, hasta: '2026-10-01' } } })).toEqual([2]); // 05:30Z del 1 = 00:30 del 1 en Bogotá: el último día se incluye
  });

  it('los contadores por segmento respetan el resto de filtros', () => {
    expect(conteoPorSegmentoTx(datos, estadoVacio('todas'), ctx)).toEqual({ todas: 4, confirmadas: 2, revision: 1, anuladas: 1 });
    expect(conteoPorSegmentoTx(datos, { ...estadoVacio('anuladas'), valores: { cuentas: [4] } }, ctx)).toEqual({ todas: 2, confirmadas: 1, revision: 1, anuladas: 0 });
  });
});
