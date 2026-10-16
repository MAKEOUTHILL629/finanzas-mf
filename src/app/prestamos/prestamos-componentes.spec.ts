import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { CorteCobro, PrestamoDetalle } from '../modelos/cobros';
import { ModalService } from '../services/modal.service';
import { hoyIso } from '../shared/periodo.helper';
import { ToastService } from '../shared/toast/toast.service';
import { configurarTestBed, errorHttp, esperar, http, persona, responder, responderCatalogos, verificarHttp } from '../testing/erp-testing';
import { DetallePrestamoComponent } from './detalle-prestamo/detalle-prestamo.component';
import { FormularioCorteComponent } from './formulario-corte/formulario-corte.component';
import { FormularioEditarPrestamoComponent } from './formulario-editar-prestamo/formulario-editar-prestamo.component';
import { FormularioPrestamosComponent } from './formulario-prestamos/formulario-prestamos.component';
import { ListaCortesComponent } from './lista-cortes/lista-cortes.component';
import { TablaPrestamosComponent, filtrosDeBarra } from './tabla-prestamos/tabla-prestamos.component';
import { estadoVacio } from '../shared/ui/filter-bar/filter-bar.types';

const dia = (iso: string) => Date.parse(iso);

const PERSONAS = [persona(2, 'Andrés'), persona(3, 'Papá')];

function corte(id: number, ini: string, fin: string, estado: CorteCobro['estado'], concepto = `Corte ${id}`): CorteCobro {
  return { id, owner_user_id: 1, concepto, fecha_inicio: `${ini}T00:00:00.000Z`, fecha_final: `${fin}T00:00:00.000Z`, estado, created_at: null };
}

function prestamo(extra: Partial<PrestamoDetalle> = {}): PrestamoDetalle {
  return {
    id: 7, fechaCreacion: dia('2026-01-01'), valorPrestado: 120000.5, concepto: 'Mercado', fechaCobro: dia('2026-10-15'), responsable: 2,
    estado: 'Pendiente', comentarios: null, direccionPrestamo: 'POR_COBRAR', saldoPendiente: 120000.5, esRecurrenteMensual: false,
    cuotaMensualAcordada: null, fechaPrestamo: dia('2026-10-01'), metodo: 'Nequi', corteId: 5, creadoPorPersonaId: null, origenCruceAporteId: null,
    aprobaciones: [
      { id: 31, prestamoId: 7, personaId: 2, persona: 'Andrés', estado: 'Pendiente', comentarios: null, fechaAprobacion: null },
      { id: 32, prestamoId: 7, personaId: 1, persona: 'Felipe', estado: 'Aprobado', comentarios: 'ok', fechaAprobacion: '2026-10-01T12:00:00.000Z' },
    ],
    ...extra,
  };
}

describe('FormularioPrestamosComponent', () => {
  let fixture: ComponentFixture<FormularioPrestamosComponent>;
  let c: FormularioPrestamosComponent;

  function iniciar(cortes: CorteCobro[] = []): void {
    configurarTestBed([FormularioPrestamosComponent]);
    fixture = TestBed.createComponent(FormularioPrestamosComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    responderCatalogos({ personas: PERSONAS });
    responder('cortes-cobro', cortes);
    fixture.detectChanges();
  }
  afterEach(() => verificarHttp());

  function llenar(extra: Record<string, unknown> = {}): void {
    c.form.patchValue({ valorPrestado: 250000.75, concepto: '  Cuota del carro ', responsable: 2, fechaCobro: '2026-11-05', ...extra });
  }

  it('propone el corte que contiene hoy y ofrece las personas del catálogo en el selector', () => {
    iniciar([corte(1, '2020-01-01', '2020-01-31', 'PASADO'), corte(9, '2000-01-01', '2999-12-31', 'ACTIVO')]);
    const opciones = (fixture.nativeElement as HTMLElement).querySelectorAll('#pf-responsable option');
    expect(Array.from(opciones).map((o) => o.textContent?.trim())).toEqual(['Selecciona una persona', 'Andrés', 'Papá']);
    expect(c.form.controls.corteId.value).toBe(9);
  });

  it('un formulario inválido no llama al backend', () => {
    iniciar();
    c.enviar();
    expect(c.form.touched).toBeTrue();
    http().expectNone((r) => r.method === 'POST');
  });

  it('rechaza más de 2 decimales y valores no positivos', () => {
    iniciar();
    llenar({ valorPrestado: 10.123 });
    expect(c.form.controls.valorPrestado.invalid).toBeTrue();
    llenar({ valorPrestado: 0 });
    expect(c.form.controls.valorPrestado.invalid).toBeTrue();
    llenar({ valorPrestado: 10.5 });
    expect(c.form.valid).toBeTrue();
  });

  it('envía el cuerpo ampliado: montos como texto, dirección, método, fechas y corte', () => {
    iniciar([corte(9, '2000-01-01', '2999-12-31', 'ACTIVO')]);
    llenar({ metodo: 'Nequi', direccionPrestamo: 'POR_COBRAR', comentarios: ' nota ' });
    let creado = 0;
    c.creado.subscribe(() => creado++);
    c.enviar();
    const req = esperar('POST', 'prestamos');
    expect(req.request.body).toEqual({
      valorPrestado: '250000.75', concepto: 'Cuota del carro', fechaCobro: '2026-11-05', responsable: 2, estado: 'Pendiente', comentarios: 'nota',
      direccionPrestamo: 'POR_COBRAR', fechaPrestamo: hoyIso(), metodo: 'Nequi', corteId: 9,
    });
    req.flush(55);
    expect(creado).toBe(1);
    expect(c.form.controls.concepto.value).toBe(''); // se reinicia para el siguiente alta
  });

  it('un préstamo recurrente exige y envía la cuota mensual', () => {
    iniciar();
    llenar();
    c.form.controls.esRecurrenteMensual.setValue(true);
    expect(c.form.controls.cuotaMensualAcordada.invalid).toBeTrue();
    c.form.controls.cuotaMensualAcordada.setValue(50000);
    expect(c.construirCuerpo()).toEqual(jasmine.objectContaining({ esRecurrenteMensual: true, cuotaMensualAcordada: '50000' }));
    c.form.controls.esRecurrenteMensual.setValue(false);
    expect(c.form.controls.cuotaMensualAcordada.value).toBeNull();
    expect(c.construirCuerpo().esRecurrenteMensual).toBeUndefined();
  });

  it('muestra el error del servidor y no emite creado', () => {
    iniciar();
    llenar();
    let creado = 0;
    c.creado.subscribe(() => creado++);
    c.enviar();
    errorHttp(esperar('POST', 'prestamos'), 400, { message: 'Datos inválidos', errors: { responsable: ['no existe'] } });
    expect(c.errorServidor).toBe('responsable: no existe');
    expect(c.enviando).toBeFalse();
    expect(creado).toBe(0);
  });
});

describe('TablaPrestamosComponent', () => {
  afterEach(() => verificarHttp());

  it('carga, ordena, calcula totales y filtra', () => {
    configurarTestBed([TablaPrestamosComponent]);
    const fixture = TestBed.createComponent(TablaPrestamosComponent);
    const c = fixture.componentInstance;
    fixture.detectChanges();
    responder('prestamos', [
      prestamo({ id: 1, estado: 'Pagado', saldoPendiente: 0, aprobaciones: [] }),
      prestamo({ id: 2, estado: 'Pendiente', saldoPendiente: 100.1 }),
      prestamo({ id: 3, estado: 'Pendiente', saldoPendiente: 200.2, aprobaciones: [] }),
    ]);
    responderCatalogos({ personas: PERSONAS });
    responder('cortes-cobro', [corte(5, '2026-10-01', '2026-10-31', 'ACTIVO', 'Corte octubre')]);

    // pendientes primero; con la misma fecha de cobro, el id más reciente antes
    expect(c.prestamos.map((p) => p.id)).toEqual([3, 2, 1]);
    expect(c.totales).toEqual({ saldoPorCobrar: 300.3, pendientes: 2, aprobacionesPendientes: 1, pagados: 1 });
    expect(c.nombreCorte(5)).toBe('Corte octubre');
    expect(c.nombrePersona(2)).toBe('Andrés');

    c.alFiltrar({ ...estadoVacio('Pagado') });
    expect(c.visibles.map((p) => p.id)).toEqual([1]);
    expect(c.segmentos.map((s) => [s.valor, s.cantidad])).toEqual([['todos', 3], ['Pendiente', 2], ['Pagado', 1], ['Anulado', 0]]);
    c.alFiltrar({ ...estadoVacio('todos'), valores: { corte: 'sin' } });
    expect(c.visibles.length).toBe(c.prestamos.filter((p) => p.corteId === null).length);
    c.alFiltrar(estadoVacio('todos'));
    expect(c.visibles.length).toBe(3);
    expect(c.definicionFiltros.map((f) => f.id)).toEqual(['responsable', 'corte', 'cobro']);
    expect(filtrosDeBarra({ busqueda: 'luz', segmento: 'Pendiente', valores: { responsable: 2, corte: 5, cobro: { desde: '2026-10-01', hasta: null } } })).toEqual({
      texto: 'luz', estado: 'Pendiente', responsable: '2', corte: '5', desde: '2026-10-01', hasta: '',
    });
    expect(filtrosDeBarra(estadoVacio('todos'))).toEqual({ texto: '', estado: '', responsable: '', corte: '', desde: '', hasta: '' });
  });

  it('muestra el error y permite reintentar', () => {
    configurarTestBed([TablaPrestamosComponent]);
    const fixture = TestBed.createComponent(TablaPrestamosComponent);
    const c = fixture.componentInstance;
    fixture.detectChanges();
    errorHttp(esperar('GET', 'prestamos'), 500, {});
    // forkJoin cancela las otras peticiones al fallar una: no se pueden responder
    http().match((r) => r.url.endsWith('/cortes-cobro')).forEach((r) => !r.cancelled && r.flush([]));
    responderCatalogos(); // los catálogos son independientes: se piden una sola vez
    expect(c.error).toContain('problema');
    expect(c.cargando).toBeFalse();
    c.cargar();
    responder('prestamos', []);
    responder('cortes-cobro', []);
    expect(c.error).toBeNull();
  });
});

describe('DetallePrestamoComponent', () => {
  let fixture: ComponentFixture<DetallePrestamoComponent>;
  let c: DetallePrestamoComponent;
  let toast: ToastService;

  function iniciar(id = '7', p: PrestamoDetalle = prestamo()): void {
    configurarTestBed([DetallePrestamoComponent], [{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } }]);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(DetallePrestamoComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    responder(`prestamos/${id}`, p);
    responderCatalogos({ personas: PERSONAS });
    responder('cortes-cobro', [corte(5, '2026-10-01', '2026-10-31', 'ACTIVO', 'Corte octubre')]);
  }
  afterEach(() => verificarHttp());

  it('carga el préstamo, la persona y el nombre del corte', () => {
    iniciar();
    expect(c.prestamo?.concepto).toBe('Mercado');
    expect(c.nombrePersona(2)).toBe('Andrés');
    expect(c.nombreCorte(5)).toBe('Corte octubre');
    expect(c.nombreCorte(null)).toBe('Sin corte');
    expect(c.saldo).toBe(120000.5);
    expect(c.esPendiente).toBeTrue();
  });

  it('un id inválido no llama al backend', () => {
    configurarTestBed([DetallePrestamoComponent], [{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'abc' })) } }]);
    const f = TestBed.createComponent(DetallePrestamoComponent);
    f.detectChanges();
    expect(f.componentInstance.error).toContain('no es válido');
    responderCatalogos(); // los nombres de las personas se piden aparte
    http().expectNone(() => true); // pero nada del préstamo
  });

  it('un 404 se explica sin reintentos', () => {
    configurarTestBed([DetallePrestamoComponent], [{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '9' })) } }]);
    const f = TestBed.createComponent(DetallePrestamoComponent);
    f.detectChanges();
    errorHttp(esperar('GET', 'prestamos/9'), 404, { message: 'Préstamo 9 no encontrado' });
    http().match((r) => r.url.endsWith('/lookup') || r.url.endsWith('/cortes-cobro')).forEach((r) => !r.cancelled && r.flush(r.request.url.endsWith('/lookup') ? { personas: [] } : []));
    expect(f.componentInstance.error).toBe('No encontramos ese préstamo.');
  });

  it('marcar como pagado pide confirmación y envía solo { estado: "Pagado" }', () => {
    iniciar();
    c.pedirConfirmacion('pagar');
    http().expectNone((r) => r.method === 'PATCH'); // todavía no
    c.confirmarAccion();
    const req = esperar('PATCH', 'prestamos/7');
    expect(req.request.body).toEqual({ estado: 'Pagado' });
    req.flush(prestamo({ estado: 'Pagado', saldoPendiente: 0 }));
    expect(c.prestamo?.estado).toBe('Pagado');
    expect(c.accionPendiente).toBeNull();
    expect(c.esPendiente).toBeFalse();
  });

  it('cancelar la confirmación no envía nada', () => {
    iniciar();
    c.pedirConfirmacion('anular');
    c.cancelarAccion();
    c.confirmarAccion();
    http().expectNone((r) => r.method === 'PATCH');
  });

  it('un error al pagar se avisa con un toast y limpia la confirmación', () => {
    iniciar();
    const spy = spyOn(toast, 'error');
    c.pedirConfirmacion('pagar');
    c.confirmarAccion();
    errorHttp(esperar('PATCH', 'prestamos/7'), 400, { message: 'No se puede abonar 0' });
    expect(spy).toHaveBeenCalledWith('No se puede abonar 0');
    expect(c.accionPendiente).toBeNull();
    expect(c.ejecutando).toBeFalse();
  });

  it('aprobar con comentario llama a la aprobación correcta y actualiza solo esa', () => {
    iniciar();
    const pendiente = c.prestamo!.aprobaciones[0];
    c.comentarios[pendiente.id] = '  de acuerdo ';
    c.resolver(pendiente, 'Aprobado');
    const req = esperar('PATCH', 'prestamos/7/aprobaciones/31');
    expect(req.request.body).toEqual({ estado: 'Aprobado', comentarios: 'de acuerdo' });
    req.flush({ ...pendiente, estado: 'Aprobado', comentarios: 'de acuerdo', fechaAprobacion: '2026-10-14T10:00:00.000Z' });
    expect(c.prestamo?.aprobaciones.map((a) => a.estado)).toEqual(['Aprobado', 'Aprobado']);
    expect(c.comentarios[31]).toBeUndefined();
    expect(c.resolviendo).toBeNull();
  });

  it('rechazar sin comentario no envía el campo', () => {
    iniciar();
    c.resolver(c.prestamo!.aprobaciones[0], 'Rechazado');
    const req = esperar('PATCH', 'prestamos/7/aprobaciones/31');
    expect(req.request.body).toEqual({ estado: 'Rechazado' });
    req.flush({ ...c.prestamo!.aprobaciones[0], estado: 'Rechazado' });
    expect(c.prestamo?.aprobaciones[0].estado).toBe('Rechazado');
  });

  it('un 403 al resolver se muestra al usuario', () => {
    iniciar();
    const spy = spyOn(toast, 'error');
    c.resolver(c.prestamo!.aprobaciones[0], 'Aprobado');
    errorHttp(esperar('PATCH', 'prestamos/7/aprobaciones/31'), 403, { message: 'No tienes permiso para resolver esta aprobación' });
    expect(spy).toHaveBeenCalledWith('No tienes permiso para resolver esta aprobación');
  });

  it('tras editar, reemplaza el préstamo y cierra el modal', () => {
    iniciar();
    const modal = TestBed.inject(ModalService);
    const cerrar = spyOn(modal, 'close');
    c.onActualizado(prestamo({ comentarios: 'actualizado' }));
    expect(c.prestamo?.comentarios).toBe('actualizado');
    expect(cerrar).toHaveBeenCalled();
  });
});

describe('FormularioEditarPrestamoComponent', () => {
  afterEach(() => verificarHttp());

  function crear(p = prestamo()) {
    configurarTestBed([FormularioEditarPrestamoComponent]);
    const fixture = TestBed.createComponent(FormularioEditarPrestamoComponent);
    fixture.componentRef.setInput('prestamo', p);
    fixture.componentRef.setInput('cortes', [corte(5, '2026-10-01', '2026-10-31', 'ACTIVO')]);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('sin cambios avisa y no llama al backend', () => {
    const c = crear();
    c.enviar();
    expect(c.sinCambios).toBeTrue();
    http().expectNone((r) => r.method === 'PATCH');
  });

  it('envía únicamente los campos modificados y emite el préstamo actualizado', () => {
    const c = crear();
    let recibido: PrestamoDetalle | undefined;
    c.actualizado.subscribe((p) => (recibido = p));
    c.form.patchValue({ estado: 'Pagado', comentarios: 'cobrado' });
    expect(c.pasaAPagado).toBeTrue();
    c.enviar();
    const req = esperar('PATCH', 'prestamos/7');
    expect(req.request.body).toEqual({ estado: 'Pagado', comentarios: 'cobrado' });
    req.flush(prestamo({ estado: 'Pagado' }));
    expect(recibido?.estado).toBe('Pagado');
  });

  it('un saldo con más de 2 decimales o negativo bloquea el envío', () => {
    const c = crear();
    c.form.patchValue({ saldoPendiente: 10.123 });
    c.enviar();
    expect(c.form.controls.saldoPendiente.invalid).toBeTrue();
    c.form.patchValue({ saldoPendiente: -1 });
    expect(c.form.controls.saldoPendiente.invalid).toBeTrue();
    http().expectNone((r) => r.method === 'PATCH');
  });
});

describe('ListaCortesComponent y FormularioCorteComponent', () => {
  afterEach(() => verificarHttp());

  function crearLista() {
    configurarTestBed([ListaCortesComponent]);
    const fixture = TestBed.createComponent(ListaCortesComponent);
    const c = fixture.componentInstance;
    fixture.detectChanges();
    responder('cortes-cobro', [corte(5, '2026-10-01', '2026-10-31', 'ACTIVO'), corte(6, '2026-11-01', '2026-11-30', 'FUTURO'), corte(7, '2025-01-01', '2025-01-31', 'PASADO')]);
    responder('prestamos', [prestamo({ id: 1, corteId: 5, saldoPendiente: 500 })]);
    return c;
  }

  it('carga cortes con sus estadísticas y filtra por estado', () => {
    const c = crearLista();
    expect(c.cortes.length).toBe(3);
    expect(c.estadistica(c.cortes[0])).toEqual({ prestamos: 1, pendientes: 1, saldoPorCobrar: 500 });
    expect(c.estadistica(c.cortes[1])).toEqual({ prestamos: 0, pendientes: 0, saldoPorCobrar: 0 });
    c.filtro = 'FUTURO';
    expect(c.visibles.map((x) => x.id)).toEqual([6]);
    expect(c.cantidad('')).toBe(3);
    expect(c.cantidad('PASADO')).toBe(1);
  });

  it('si fallan los préstamos igual muestra los cortes', () => {
    configurarTestBed([ListaCortesComponent]);
    const fixture = TestBed.createComponent(ListaCortesComponent);
    fixture.detectChanges();
    responder('cortes-cobro', [corte(5, '2026-10-01', '2026-10-31', 'ACTIVO')]);
    errorHttp(esperar('GET', 'prestamos'), 500, {});
    expect(fixture.componentInstance.cortes.length).toBe(1);
    expect(fixture.componentInstance.error).toBeNull();
  });

  it('eliminar pide confirmación; el 409 del backend se muestra como aviso', () => {
    const c = crearLista();
    const toast = TestBed.inject(ToastService);
    const spy = spyOn(toast, 'error');
    c.pedirBorrado(c.cortes[1]);
    expect(c.confirmandoBorrado?.id).toBe(6);
    c.confirmarBorrado();
    errorHttp(esperar('DELETE', 'cortes-cobro/6'), 409, { message: 'El corte tiene 2 préstamo(s) asociados y no se puede eliminar' });
    expect(spy).toHaveBeenCalledWith('El corte tiene 2 préstamo(s) asociados y no se puede eliminar');
    expect(c.confirmandoBorrado).toBeNull();
  });

  it('el borrado correcto recarga la lista', () => {
    const c = crearLista();
    c.pedirBorrado(c.cortes[1]);
    c.confirmarBorrado();
    esperar('DELETE', 'cortes-cobro/6').flush(null, { status: 204, statusText: 'No Content' });
    responder('cortes-cobro', []);
    responder('prestamos', []);
    expect(c.cortes.length).toBe(0);
  });

  it('el formulario valida las fechas y envía PUT al editar', () => {
    configurarTestBed([FormularioCorteComponent]);
    const fixture = TestBed.createComponent(FormularioCorteComponent);
    fixture.componentRef.setInput('corte', corte(5, '2026-10-01', '2026-10-31', 'ACTIVO', 'Octubre'));
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.form.getRawValue()).toEqual({ concepto: 'Octubre', fechaInicio: '2026-10-01', fechaFinal: '2026-10-31', estado: 'ACTIVO' });

    c.form.patchValue({ fechaFinal: '2026-09-30' });
    c.enviar();
    expect(c.form.errors?.['fechasInvertidas']).toBeTrue();
    http().expectNone((r) => r.method === 'PUT');

    c.form.patchValue({ concepto: ' Octubre 2026 ', fechaFinal: '2026-11-02' });
    let guardado = 0;
    c.guardado.subscribe(() => guardado++);
    c.enviar();
    const req = esperar('PUT', 'cortes-cobro/5');
    expect(req.request.body).toEqual({ concepto: 'Octubre 2026', fechaInicio: '2026-10-01', fechaFinal: '2026-11-02', estado: 'ACTIVO' });
    req.flush(corte(5, '2026-10-01', '2026-11-02', 'ACTIVO'));
    expect(guardado).toBe(1);
  });

  it('el formulario en modo alta usa POST', () => {
    configurarTestBed([FormularioCorteComponent]);
    const fixture = TestBed.createComponent(FormularioCorteComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.esEdicion).toBeFalse();
    c.form.patchValue({ concepto: 'Nuevo', fechaInicio: '2026-12-01', fechaFinal: '2026-12-31', estado: 'FUTURO' });
    c.enviar();
    const req = esperar('POST', 'cortes-cobro');
    expect(req.request.body.concepto).toBe('Nuevo');
    req.flush(corte(8, '2026-12-01', '2026-12-31', 'FUTURO'));
  });
});
