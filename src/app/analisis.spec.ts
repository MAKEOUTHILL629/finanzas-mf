import { TestBed } from '@angular/core/testing';
import { EstadoCuentaPersona, FlujoCaja, MovimientoExtracto } from './modelos/erp';
import { Tarjeta } from './modelos/tarjeta';
import { EstadoCuentaComponent } from './deudas/estado-cuenta/estado-cuenta.component';
import { esAbono, etiquetaMovimiento, iniciales, tieneActividad, totalesEstadoCuenta } from './deudas/deudas.constants';
import { FormularioAbonoComponent, construirAbono } from './deudas/formulario-abono/formulario-abono.component';
import { FormularioCruceComponent } from './deudas/formulario-cruce/formulario-cruce.component';
import { ListaCrucesComponent } from './deudas/lista-cruces/lista-cruces.component';
import { FlujoCajaComponent, estaVacio, piezasDeDesembolso } from './flujo-caja/flujo-caja.component';
import { ToastService } from './shared/toast/toast.service';
import { FormularioTarjetaComponent, cambiosDeTarjeta, valoresDeTarjeta } from './tarjetas/formulario-tarjeta/formulario-tarjeta.component';
import { ListaTarjetasComponent, pendientesDeConfigurar } from './tarjetas/lista-tarjetas/lista-tarjetas.component';
import { API, configurarTestBed, errorHttp, esperar, http, responder, verificarHttp } from './testing/erp-testing';
import { periodoActual } from './shared/periodo.helper';

function fila(extra: Partial<EstadoCuentaPersona> = {}): EstadoCuentaPersona {
  return {
    persona_id: 2, nombre: 'Andrés Gómez', iniciales_nombre: null, color_representativo: null, cuotas_tc_mes: 100.1, recurrentes_compartidos_mes: 0, prestamos_mes: 50,
    cruces_asumidos_mes: 0, abonos_recibidos_mes: 30, saldo_neto_mes: 120.1, saldo_total_acumulado: 500.2, ...extra,
  };
}
function flujo(extra: Partial<FlujoCaja> = {}): FlujoCaja {
  return { total_ingresos: 5000000, total_egresos_directos: 800000, total_tarjetas: 1200000, total_esperado_recurrentes: 300000, total_por_cobrar_terceros: 400000, desembolso_bruto_mes: 2300000, gasto_neto_real_tuyo: 1900000, flujo_caja_libre_estimado: 3100000, ...extra };
}
function tarjeta(extra: Partial<Tarjeta> = {}): Tarjeta {
  return { id: 4, franquicia: 'Visa', descripcion: 'Oro *1927', tasaInteresCompra: 1.8895, tasaInteresAvance: null, cuotaManejo: null, diaCorte: null, diaLimitePago: null, cupoTotal: null, permiteDolares: false, ...extra };
}

describe('Tarjetas', () => {
  afterEach(() => verificarHttp());

  it('pendientesDeConfigurar indica qué falta', () => {
    expect(pendientesDeConfigurar(tarjeta())).toEqual(['día de corte', 'día límite de pago']);
    expect(pendientesDeConfigurar(tarjeta({ diaCorte: 15, diaLimitePago: 5 }))).toEqual([]);
    expect(pendientesDeConfigurar(tarjeta({ diaCorte: 15, diaLimitePago: 5, descripcion: 'Oro' }))).toEqual(['últimos 4 dígitos']);
    // la columna propia de los últimos 4 dígitos también lo resuelve
    expect(pendientesDeConfigurar(tarjeta({ diaCorte: 15, diaLimitePago: 5, descripcion: 'Oro', ultimos4Digitos: '1927,9587' }))).toEqual([]);
  });

  it('los últimos 4 dígitos ya no se editan en el formulario de configuración: se gestionan como plásticos', () => {
    const t = tarjeta({ ultimos4Digitos: '1927,9587' });
    // aunque la tarjeta traiga dígitos, el formulario nunca los envía: no hay "cambio" por ellos
    expect(cambiosDeTarjeta(t, valoresDeTarjeta(t))).toEqual({});
    expect(Object.keys(valoresDeTarjeta(t))).not.toContain('ultimos4Digitos');
    configurarTestBed([FormularioTarjetaComponent]);
    const fixture = TestBed.createComponent(FormularioTarjetaComponent);
    fixture.componentRef.setInput('tarjeta', tarjeta({ plasticos: [
      { id: 2, tarjetaId: 4, ultimos4: '1927', esActivo: true, vigenteDesde: '2024-12-27', vigenteHasta: null, motivoReemplazo: null, reemplazaAId: 1, notas: null },
      { id: 1, tarjetaId: 4, ultimos4: '9587', esActivo: false, vigenteDesde: null, vigenteHasta: '2024-03-16', motivoReemplazo: null, reemplazaAId: null, notas: null },
    ] }));
    fixture.detectChanges();
    expect(Object.keys(fixture.componentInstance.form.controls)).not.toContain('ultimos4Digitos');
    const texto = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Plásticos de esta tarjeta');
    expect(texto).toContain('··1927');
    expect(texto).toContain('Activo');
    expect(texto).toContain('··9587');
    expect(texto).toContain('Archivado');
  });

  it('cambiosDeTarjeta envía solo lo modificado y nunca valores vacíos', () => {
    const t = tarjeta({ diaCorte: 15, cupoTotal: 5000000 });
    expect(cambiosDeTarjeta(t, valoresDeTarjeta(t))).toEqual({});
    expect(cambiosDeTarjeta(t, { ...valoresDeTarjeta(t), diaCorte: 20, diaLimitePago: 5, cupoTotal: '6000000.50', permiteDolares: true, tasaInteresAvance: 2.1 })).toEqual({
      diaCorte: 20, diaLimitePago: 5, cupoTotal: '6000000.50', permiteDolares: true, tasaInteresAvance: '2.1',
    });
    expect(cambiosDeTarjeta(t, { ...valoresDeTarjeta(t), diaCorte: null, cupoTotal: null })).toEqual({});
    expect(cambiosDeTarjeta(t, { ...valoresDeTarjeta(t), descripcion: ' Oro *4321 ' })).toEqual({ descripcion: 'Oro *4321' });
  });

  it('el formulario valida días 1-31 y tasas con máximo 4 decimales, y envía PUT', () => {
    configurarTestBed([FormularioTarjetaComponent]);
    const fixture = TestBed.createComponent(FormularioTarjetaComponent);
    fixture.componentRef.setInput('tarjeta', tarjeta());
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.enviar();
    expect(c.sinCambios).toBeTrue();
    c.form.patchValue({ diaCorte: 32 });
    expect(c.form.controls.diaCorte.invalid).toBeTrue();
    c.form.patchValue({ diaCorte: 15.5 });
    expect(c.form.controls.diaCorte.invalid).toBeTrue();
    c.form.patchValue({ diaCorte: 15, tasaInteresCompra: 1.88955 });
    expect(c.form.controls.tasaInteresCompra.invalid).toBeTrue();
    c.form.patchValue({ tasaInteresCompra: 1.8895, diaLimitePago: 5 });
    expect(c.form.valid).toBeTrue();
    c.enviar();
    const req = esperar('PUT', 'tarjetas/4');
    expect(req.request.body).toEqual({ diaCorte: 15, diaLimitePago: 5 });
    req.flush(tarjeta({ diaCorte: 15, diaLimitePago: 5 }));
  });

  it('la lista carga y reemplaza la tarjeta guardada', () => {
    configurarTestBed([ListaTarjetasComponent]);
    const fixture = TestBed.createComponent(ListaTarjetasComponent);
    fixture.detectChanges();
    responder('tarjetas', [tarjeta(), tarjeta({ id: 5, franquicia: 'Master' })]);
    const c = fixture.componentInstance;
    expect(c.nombre(c.tarjetas[0])).toBe('Visa · Oro *1927');
    c.editar(c.tarjetas[0]);
    expect(c.editando?.id).toBe(4);
    c.onGuardada(tarjeta({ diaCorte: 15 }));
    expect(c.tarjetas[0].diaCorte).toBe(15);
    expect(c.tarjetas.length).toBe(2);
  });
});

describe('Flujo de caja', () => {
  afterEach(() => verificarHttp());

  it('piezasDeDesembolso omite lo que vale cero; estaVacio detecta un mes sin movimientos', () => {
    expect(piezasDeDesembolso(flujo()).map((p) => [p.clave, p.valor])).toEqual([['egresos', 800000], ['tarjetas', 1200000], ['recurrentes', 300000]]);
    expect(piezasDeDesembolso(flujo({ total_tarjetas: 0, total_esperado_recurrentes: 0 })).map((p) => p.clave)).toEqual(['egresos']);
    const cero = flujo({ total_ingresos: 0, total_egresos_directos: 0, total_tarjetas: 0, total_esperado_recurrentes: 0, total_por_cobrar_terceros: 0 });
    expect(estaVacio(cero)).toBeTrue();
    expect(estaVacio(flujo())).toBeFalse();
  });

  it('carga el periodo actual y arma los gráficos', () => {
    configurarTestBed([FlujoCajaComponent]);
    const fixture = TestBed.createComponent(FlujoCajaComponent);
    fixture.detectChanges();
    http().expectOne((r) => r.url === `${API}/analytics/flujo-caja` && r.params.get('periodo') === periodoActual()).flush(flujo());
    const c = fixture.componentInstance;
    expect(c.vacio).toBeFalse();
    expect(c.piezas.length).toBe(3);
    expect(c.donaData.labels).toEqual(['Egresos directos', 'Cuotas de tarjetas', 'Gastos recurrentes']);
    expect(c.barrasData.datasets[0].data).toEqual([5000000, 2300000, 400000, 1900000]);
  });

  it('cambiar de mes pide ese periodo; un error se muestra', () => {
    configurarTestBed([FlujoCajaComponent]);
    const fixture = TestBed.createComponent(FlujoCajaComponent);
    fixture.detectChanges();
    http().expectOne((r) => r.url.includes('flujo-caja')).flush(flujo());
    const c = fixture.componentInstance;
    c.moverPeriodo(-1);
    const anterior = c.periodo;
    errorHttp(http().expectOne((r) => r.params.get('periodo') === anterior), 400, { message: 'periodo debe tener formato YYYY-MM' });
    expect(c.error).toBe('periodo debe tener formato YYYY-MM');
    expect(c.flujo).toBeNull();
    c.onPeriodoChange('no-es-un-mes');
    http().expectNone((r) => r.url.includes('flujo-caja'));
  });
});

describe('Estado de cuenta y cruces', () => {
  afterEach(() => verificarHttp());

  it('constantes: totales exactos, actividad, iniciales y etiquetas', () => {
    expect(totalesEstadoCuenta([fila(), fila({ persona_id: 3, cuotas_tc_mes: 0.2, saldo_total_acumulado: null })])).toEqual(
      jasmine.objectContaining({ cuotasTc: 100.3, saldoAcumulado: 500.2 })
    );
    expect(tieneActividad(fila())).toBeTrue();
    expect(tieneActividad(fila({ cuotas_tc_mes: 0, prestamos_mes: 0, abonos_recibidos_mes: 0, saldo_neto_mes: 0, saldo_total_acumulado: 0 }))).toBeFalse();
    expect(iniciales('Andrés Gómez')).toBe('AG');
    expect(iniciales('Papá', 'pp')).toBe('PP');
    expect(iniciales(null)).toBe('?');
    expect(etiquetaMovimiento('CARGO_CUOTA_TC')).toBe('Cuota de tarjeta');
    expect(esAbono('ABONO_PAGO_RECIBIDO')).toBeTrue();
    expect(esAbono('CARGO_PRESTAMO_DIRECTO')).toBeFalse();
  });

  function iniciar(filas: EstadoCuentaPersona[]) {
    configurarTestBed([EstadoCuentaComponent]);
    const fixture = TestBed.createComponent(EstadoCuentaComponent);
    fixture.detectChanges();
    http().expectOne((r) => r.url === `${API}/ledger/estado-cuenta` && r.params.get('periodo') === periodoActual()).flush(filas);
    return fixture.componentInstance;
  }

  it('oculta las personas sin actividad hasta que se pidan', () => {
    const c = iniciar([fila(), fila({ persona_id: 3, cuotas_tc_mes: 0, prestamos_mes: 0, abonos_recibidos_mes: 0, saldo_neto_mes: 0, saldo_total_acumulado: 0 })]);
    expect(c.visibles.map((f) => f.persona_id)).toEqual([2]);
    expect(c.ocultas).toBe(1);
    c.verTodas = true;
    expect(c.visibles.length).toBe(2);
  });

  it('seleccionar una persona pide su extracto del periodo; volver a pulsarla lo cierra', () => {
    const c = iniciar([fila()]);
    c.seleccionar(c.filas[0]);
    const movimientos: MovimientoExtracto[] = [{ id: 1, fecha_movimiento: '2026-10-05T00:00:00.000Z', periodo_imputacion: periodoActual(), tipo_movimiento: 'CARGO_CUOTA_TC', concepto: 'Cuota 3/12', signo: 1, monto: 100, impacto_saldo: 100, estado: 'CONFIRMADO' }];
    http().expectOne((r) => r.url === `${API}/ledger/personas/2/extracto` && r.params.get('periodo') === periodoActual()).flush(movimientos);
    expect(c.extracto.length).toBe(1);
    c.seleccionar(c.filas[0]);
    expect(c.seleccionada).toBeNull();
  });

  it('un error del extracto no rompe el estado de cuenta', () => {
    const c = iniciar([fila()]);
    c.seleccionar(c.filas[0]);
    errorHttp(http().expectOne((r) => r.url.includes('/extracto')), 404, { message: 'Persona 2 no encontrada' });
    expect(c.errorExtracto).toBe('Persona 2 no encontrada');
    expect(c.filas.length).toBe(1);
  });

  it('tras un abono avisa el monto y recarga', () => {
    const c = iniciar([fila()]);
    const exito = spyOn(TestBed.inject(ToastService), 'exito');
    c.onAbonado({ movimientoId: 77, personaId: 2, monto: 250000.5, periodoImputacion: periodoActual() });
    expect(exito).toHaveBeenCalledWith('Abono registrado: $250,000.50 (movimiento #77).');
    http().expectOne((r) => r.url === `${API}/ledger/estado-cuenta`).flush([]);
  });

  it('construirAbono incluye el corte solo si se eligió', () => {
    const v = { cuentaDestinoId: 1, monto: 1000.5, periodoImputacion: '2026-10', concepto: ' Abono ', corteId: null };
    expect(construirAbono(v)).toEqual({ cuentaDestinoId: 1, monto: '1000.5', periodoImputacion: '2026-10', concepto: 'Abono' });
    expect(construirAbono({ ...v, corteId: 5 }).liquidarPrestamosCorteId).toBe(5);
  });

  it('el formulario de abono propone el saldo, ofrece solo cuentas COP y envía POST', () => {
    configurarTestBed([FormularioAbonoComponent]);
    const fixture = TestBed.createComponent(FormularioAbonoComponent);
    fixture.componentRef.setInput('persona', fila());
    fixture.componentRef.setInput('periodo', '2026-10');
    fixture.detectChanges();
    responder('cuentas-financieras', [{ id: 1, nombre: 'Bancolombia', moneda: 'COP', saldo_actual: 5 }, { id: 2, nombre: 'Dólares', moneda: 'USD', saldo_actual: 5 }]);
    responder('cortes-cobro', []);
    const c = fixture.componentInstance;
    expect(c.cuentas.map((x) => x.id)).toEqual([1]);
    expect(c.form.controls.cuentaDestinoId.value).toBe(1);
    expect(c.form.controls.monto.value).toBe(500.2);
    expect(c.form.controls.concepto.value).toBe('Abono de Andrés Gómez');
    c.form.patchValue({ monto: 100.255 });
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
    c.form.patchValue({ monto: 100.25 });
    let abonado: unknown;
    c.abonado.subscribe((r) => (abonado = r));
    c.enviar();
    const req = esperar('POST', 'personas/2/abonar');
    expect(req.request.body).toEqual({ cuentaDestinoId: 1, monto: '100.25', periodoImputacion: '2026-10', concepto: 'Abono de Andrés Gómez' });
    req.flush({ movimientoId: 5, personaId: 2, monto: 100.25, periodoImputacion: '2026-10' });
    expect(abonado).toEqual(jasmine.objectContaining({ movimientoId: 5 }));
  });

  it('un abono con corte que el SP rechaza (422) se explica en el formulario', () => {
    configurarTestBed([FormularioAbonoComponent]);
    const fixture = TestBed.createComponent(FormularioAbonoComponent);
    fixture.componentRef.setInput('persona', fila());
    fixture.componentRef.setInput('periodo', '2026-10');
    fixture.detectChanges();
    responder('cuentas-financieras', [{ id: 1, nombre: 'B', moneda: 'COP', saldo_actual: 5 }]);
    responder('cortes-cobro', [{ id: 5, concepto: 'Corte', fecha_inicio: '2026-10-01T00:00:00.000Z', fecha_final: '2026-10-31T00:00:00.000Z', estado: 'ACTIVO' }]);
    const c = fixture.componentInstance;
    c.form.patchValue({ monto: 10, corteId: 5 });
    c.enviar();
    errorHttp(esperar('POST', 'personas/2/abonar'), 422, { message: 'No se pudo liquidar los préstamos del corte' });
    expect(c.errorServidor).toBe('No se pudo liquidar los préstamos del corte');
  });

  it('el formulario de cruce exige personas distintas y ofrece los préstamos pendientes de quien asume', () => {
    configurarTestBed([FormularioCruceComponent]);
    const fixture = TestBed.createComponent(FormularioCruceComponent);
    fixture.componentRef.setInput('personas', [{ id: 2, nombre: 'Andrés' }, { id: 3, nombre: 'Papá' }]);
    fixture.detectChanges();
    http().expectOne((r) => r.url === `${API}/prestamos` && r.params.get('estado') === 'Pendiente').flush([
      { id: 30, concepto: 'Mercado', responsable: 2, estado: 'Pendiente', valorPrestado: 100, saldoPendiente: 60 },
      { id: 31, concepto: 'Otro', responsable: 3, estado: 'Pendiente', valorPrestado: 10, saldoPendiente: null },
      { id: 32, concepto: 'Pagado', responsable: 2, estado: 'Pagado', valorPrestado: 10, saldoPendiente: 0 },
    ]);
    const c = fixture.componentInstance;
    c.form.patchValue({ personaQueAbonaId: 3, personaQueAsumeDeudaId: 3, monto: 100, concepto: 'Cuota casa' });
    expect(c.form.errors?.['mismaPersona']).toBeTrue();
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
    c.form.patchValue({ personaQueAsumeDeudaId: 2 });
    expect(c.prestamosDeLaPersona.map((p) => p.id)).toEqual([30]);
    c.form.patchValue({ prestamoDestinoId: 30, comentarios: ' ok ' });
    c.enviar();
    const req = esperar('POST', 'cruces-deuda');
    expect(req.request.body).toEqual(jasmine.objectContaining({ personaQueAbonaId: 3, personaQueAsumeDeudaId: 2, monto: '100', concepto: 'Cuota casa', prestamoDestinoId: 30, comentarios: 'ok' }));
    req.flush({ id: 1 });
  });

  it('la lista de cruces resuelve nombres y destino', () => {
    configurarTestBed([ListaCrucesComponent]);
    const fixture = TestBed.createComponent(ListaCrucesComponent);
    fixture.detectChanges();
    responder('cruces-deuda', [
      { id: 1, fecha_cruce: '2026-10-05T00:00:00.000Z', persona_que_abona_id: 3, persona_que_asume_deuda_id: 2, monto: 100, prestamo_destino_id: 30, periodo_recurrente_destino_id: null, concepto: 'Cuota', comentarios: null, persona_que_abona: { id: 3, nombre: 'Papá' } },
    ]);
    responder('personas', [{ id: 2, nombre: 'Andrés' }, { id: 3, nombre: 'Papá' }]);
    const c = fixture.componentInstance;
    expect(c.nombre(c.cruces[0], 'abona')).toBe('Papá');
    expect(c.nombre(c.cruces[0], 'asume')).toBe('Andrés');
    expect(c.destino(c.cruces[0])).toBe('Préstamo #30');
  });
});
