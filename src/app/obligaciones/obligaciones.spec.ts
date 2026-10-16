import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AporteDiaConDetalle, ResumenObligacionMes } from '../modelos/erp';
import { ToastService } from '../shared/toast/toast.service';
import { API, configurarTestBed, errorHttp, esperar, http, persona, responder, responderCatalogos, verificarHttp } from '../testing/erp-testing';
import { DetalleObligacionComponent } from './detalle-obligacion/detalle-obligacion.component';
import { FormularioAportesComponent } from './formulario-aportes/formulario-aportes.component';
import { FormularioObligacionComponent } from './formulario-obligacion/formulario-obligacion.component';
import { ListaObligacionesComponent } from './lista-obligaciones/lista-obligaciones.component';

function resumen(extra: Partial<ResumenObligacionMes> = {}): ResumenObligacionMes {
  return {
    obligacion_mes_id: 3, owner_user_id: 1, tipo_obligacion: 'CUOTA_CARRO', responsable_principal_id: 3, responsable_principal_nombre: 'Papá',
    concepto: 'Cuota del carro', periodo: '2026-10', meta_mensual: 1000000, fecha_inicio: '2026-10-01T00:00:00.000Z', fecha_final: '2026-10-31T00:00:00.000Z',
    estado_calculado: 'ABIERTO', dias_aportados: 3, cantidad_registros: 4, aporte_total_real: 400000.5, restante_real: 599999.5,
    aportado_directo_responsable: 300000.5, aportado_por_cruces: 100000, ...extra,
  };
}

const PERSONAS = [
  persona(1, 'Felipe', { esPropia: true, tieneUsuario: true }),
  persona(2, 'Andrés'),
  persona(3, 'Papá'),
];

describe('ListaObligacionesComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(filas: ResumenObligacionMes[]): ListaObligacionesComponent {
    configurarTestBed([ListaObligacionesComponent]);
    const fixture = TestBed.createComponent(ListaObligacionesComponent);
    fixture.detectChanges();
    responder('obligaciones-mes', filas);
    return fixture.componentInstance;
  }

  it('agrupa por periodo y suma meta, aportado y restante sin errores de coma flotante', () => {
    const c = iniciar([
      resumen({ obligacion_mes_id: 1, periodo: '2026-10', meta_mensual: 1000000, aporte_total_real: 0.1, restante_real: 999999.9 }),
      resumen({ obligacion_mes_id: 2, periodo: '2026-10', meta_mensual: 500000, aporte_total_real: 0.2, restante_real: 499999.8 }),
      resumen({ obligacion_mes_id: 3, periodo: '2026-09', meta_mensual: 200000, aporte_total_real: 200000, restante_real: 0, estado_calculado: 'COMPLETADO' }),
    ]);
    expect(c.grupos.map((g) => [g.titulo, g.obligaciones.length])).toEqual([['Octubre 2026', 2], ['Septiembre 2026', 1]]);
    expect(c.totales).toEqual({ meta: 1700000, aportado: 200000.3, restante: 1499999.7 });
    expect(c.esCompletada(c.obligaciones[2])).toBeTrue();
  });

  it('cambiar el periodo o el tipo vuelve a pedir al backend con esos filtros', () => {
    const c = iniciar([]);
    c.onPeriodoChange('2026-10');
    let req = http().expectOne((r) => r.url === `${API}/obligaciones-mes` && r.params.get('periodo') === '2026-10' && !r.params.has('tipo'));
    req.flush([]);
    c.onTipoChange('CUOTA_CASA');
    req = http().expectOne((r) => r.params.get('periodo') === '2026-10' && r.params.get('tipo') === 'CUOTA_CASA');
    req.flush([]);
    c.verTodos();
    http().expectOne((r) => r.url === `${API}/obligaciones-mes` && r.params.keys().length === 1 && r.params.get('tipo') === 'CUOTA_CASA').flush([]);
  });

  it('las flechas de mes parten del mes actual cuando se veían todos los periodos', () => {
    const c = iniciar([]);
    c.moverPeriodo(1);
    expect(c.periodo).toMatch(/^\d{4}-\d{2}$/);
    http().expectOne((r) => r.params.get('periodo') === c.periodo).flush([]);
  });

  it('un valor de periodo inválido (campo vaciado) equivale a "todos"', () => {
    const c = iniciar([]);
    c.onPeriodoChange('2026-10');
    http().expectOne((r) => r.params.has('periodo')).flush([]);
    c.onPeriodoChange('');
    http().expectOne((r) => r.url === `${API}/obligaciones-mes` && !r.params.has('periodo')).flush([]);
    expect(c.periodo).toBe('');
  });

  it('un error del servidor se muestra y no deja filas', () => {
    configurarTestBed([ListaObligacionesComponent]);
    const fixture = TestBed.createComponent(ListaObligacionesComponent);
    fixture.detectChanges();
    errorHttp(esperar('GET', 'obligaciones-mes'), 500, {});
    expect(fixture.componentInstance.error).toContain('problema');
    expect(fixture.componentInstance.obligaciones).toEqual([]);
    expect(fixture.componentInstance.cargando).toBeFalse();
  });
});

describe('FormularioObligacionComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(): FormularioObligacionComponent {
    configurarTestBed([FormularioObligacionComponent]);
    const fixture = TestBed.createComponent(FormularioObligacionComponent);
    fixture.detectChanges();
    responderCatalogos({ personas: PERSONAS });
    return fixture.componentInstance;
  }

  it('al cambiar el periodo acompaña las fechas, salvo las que el usuario ya tocó', () => {
    const c = iniciar();
    c.form.controls.periodo.setValue('2027-02');
    c.onPeriodoChange();
    expect(c.form.controls.fechaInicio.value).toBe('2027-02-01');
    expect(c.form.controls.fechaFinal.value).toBe('2027-02-28');

    c.form.controls.fechaFinal.setValue('2027-03-05');
    c.form.controls.fechaFinal.markAsDirty();
    c.form.controls.periodo.setValue('2027-04');
    c.onPeriodoChange();
    expect(c.form.controls.fechaInicio.value).toBe('2027-04-01');
    expect(c.form.controls.fechaFinal.value).toBe('2027-03-05');
  });

  it('valida meta, responsable y fechas', () => {
    const c = iniciar();
    c.enviar();
    expect(c.form.invalid).toBeTrue();
    http().expectNone((r) => r.method === 'POST');

    c.form.patchValue({ concepto: 'Cuota', responsablePrincipalId: 3, metaMensual: 1500000.555 });
    expect(c.form.controls.metaMensual.invalid).toBeTrue();
    c.form.patchValue({ metaMensual: 1500000.5, fechaInicio: '2026-10-10', fechaFinal: '2026-10-01' });
    expect(c.form.errors?.['fechasInvertidas']).toBeTrue();
    c.form.patchValue({ fechaFinal: '2026-10-31' });
    expect(c.form.valid).toBeTrue();
  });

  it('envía el cuerpo con la meta como texto', () => {
    const c = iniciar();
    c.form.patchValue({ tipoObligacion: 'CUOTA_CASA', concepto: '  Cuota casa ', periodo: '2026-10', responsablePrincipalId: 3, metaMensual: 1500000.5, fechaInicio: '2026-10-01', fechaFinal: '' });
    let creada = 0;
    c.creada.subscribe(() => creada++);
    c.enviar();
    const req = esperar('POST', 'obligaciones-mes');
    expect(req.request.body).toEqual({
      tipoObligacion: 'CUOTA_CASA', responsablePrincipalId: 3, concepto: 'Cuota casa', periodo: '2026-10', metaMensual: '1500000.5', fechaInicio: '2026-10-01',
    });
    req.flush({ id: 9 });
    expect(creada).toBe(1);
  });

  it('un error de validación del backend se muestra en el formulario', () => {
    const c = iniciar();
    c.form.patchValue({ concepto: 'x', responsablePrincipalId: 3, metaMensual: 10 });
    c.enviar();
    errorHttp(esperar('POST', 'obligaciones-mes'), 400, { message: 'Datos inválidos', errors: { fechas: ['Las fechas deben tener formato yyyy-MM-dd'] } });
    expect(c.errorServidor).toBe('fechas: Las fechas deben tener formato yyyy-MM-dd');
  });
});

describe('FormularioAportesComponent', () => {
  let c: FormularioAportesComponent;
  afterEach(() => verificarHttp());

  function iniciar(obligacion = resumen()): void {
    configurarTestBed([FormularioAportesComponent]);
    const fixture: ComponentFixture<FormularioAportesComponent> = TestBed.createComponent(FormularioAportesComponent);
    fixture.componentRef.setInput('obligacion', obligacion);
    fixture.detectChanges();
    responderCatalogos({ personas: PERSONAS });
    fixture.detectChanges();
    c = fixture.componentInstance;
  }

  it('preselecciona al responsable principal y arranca con una fila', () => {
    iniciar();
    expect(c.items.length).toBe(1);
    expect(c.items.at(0).controls.personaId.value).toBe(3);
  });

  it('agrega y quita filas (mínimo 1, máximo 50)', () => {
    iniciar();
    c.agregarFila();
    expect(c.items.length).toBe(2);
    c.quitarFila(0);
    c.quitarFila(0);
    expect(c.items.length).toBe(1);
    for (let i = 0; i < 60; i++) c.agregarFila();
    expect(c.items.length).toBe(50);
  });

  it('aviso de préstamo: solo cuando aporta alguien que no es el responsable ni el titular', () => {
    iniciar();
    const fila = c.items.at(0);
    expect(c.generaPrestamo(fila)).toBeFalse(); // el responsable
    fila.controls.personaId.setValue(1);
    expect(c.generaPrestamo(fila)).toBeFalse(); // yo (persona enlazada al usuario)
    fila.controls.personaId.setValue(2);
    expect(c.generaPrestamo(fila)).toBeTrue(); // un tercero
    expect(c.filasConPrestamo).toBe(1);
    expect(c.nombrePersona(2)).toBe('Andrés');
  });

  it('el total solo suma importes válidos y sin errores de coma flotante', () => {
    iniciar();
    c.agregarFila();
    c.agregarFila();
    c.items.at(0).controls.valor.setValue(0.1);
    c.items.at(1).controls.valor.setValue(0.2);
    c.items.at(2).controls.valor.setValue(5.123); // inválido: no cuenta
    expect(c.total).toBe(0.3);
  });

  it('no envía si algún valor es inválido', () => {
    iniciar();
    c.items.at(0).controls.valor.setValue(0);
    c.enviar();
    expect(c.form.touched).toBeTrue();
    http().expectNone((r) => r.method === 'POST');
  });

  it('envía fecha, notas e ítems con valores como texto; emite el día registrado', () => {
    iniciar();
    c.form.patchValue({ fecha: '2026-10-12', notas: ' sábado ' });
    c.items.at(0).patchValue({ valor: 150000.5, metodo: 'Nequi', comentarios: ' abono ' });
    c.agregarFila();
    c.items.at(1).patchValue({ personaId: 2, valor: 20000, metodo: 'Fisico', comentarios: '' });
    let recibido: AporteDiaConDetalle | undefined;
    c.registrado.subscribe((d) => (recibido = d));
    c.enviar();
    const req = esperar('POST', 'obligaciones-mes/3/aportes-dia');
    expect(req.request.body).toEqual({
      fecha: '2026-10-12',
      notas: 'sábado',
      items: [
        { personaId: 3, valor: '150000.5', metodo: 'Nequi', comentarios: 'abono' },
        { personaId: 2, valor: '20000', metodo: 'Fisico' },
      ],
    });
    const respuesta = { aporte_dia_id: 1, detalles: [] } as unknown as AporteDiaConDetalle;
    req.flush(respuesta);
    expect(recibido).toEqual(respuesta);
    expect(c.items.length).toBe(1); // el formulario se reinicia
  });

  it('muestra el error del servidor sin perder lo escrito', () => {
    iniciar();
    c.items.at(0).patchValue({ valor: 100 });
    c.enviar();
    errorHttp(esperar('POST', 'obligaciones-mes/3/aportes-dia'), 404, { message: 'Persona 9 no encontrada' });
    expect(c.errorServidor).toBe('Persona 9 no encontrada');
    expect(c.items.at(0).controls.valor.value).toBe(100);
  });

  it('si la obligación aún no empieza, la fecha por defecto es su inicio', () => {
    iniciar(resumen({ fecha_inicio: '2999-01-01T00:00:00.000Z', fecha_final: '2999-01-31T00:00:00.000Z', periodo: '2999-01' }));
    expect(c.form.controls.fecha.value).toBe('2999-01-01');
  });

  it('si la obligación ya terminó, la fecha por defecto es su fin', () => {
    iniciar(resumen({ fecha_inicio: '2000-01-01T00:00:00.000Z', fecha_final: '2000-01-31T00:00:00.000Z', periodo: '2000-01' }));
    expect(c.form.controls.fecha.value).toBe('2000-01-31');
  });
});

describe('DetalleObligacionComponent', () => {
  afterEach(() => verificarHttp());

  function dia(id: number, extra: Partial<AporteDiaConDetalle> = {}): AporteDiaConDetalle {
    return { aporte_dia_id: id, obligacion_mes_id: 3, mes_concepto: null, periodo: '2026-10', fecha: '2026-10-05T00:00:00.000Z', notas: null, items_count: 1, valor_total_dia: 100, detalles: [], ...extra };
  }

  function iniciar(id = '3'): DetalleObligacionComponent {
    configurarTestBed([DetalleObligacionComponent], [{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } }]);
    const fixture = TestBed.createComponent(DetalleObligacionComponent);
    fixture.detectChanges();
    responder(`obligaciones-mes/${id}/resumen`, resumen());
    responder(`obligaciones-mes/${id}/aportes-dia`, [dia(10), dia(11)]);
    return fixture.componentInstance;
  }

  it('carga resumen y aportes por día (las personas vienen del catálogo, ya no de esta pantalla)', () => {
    const c = iniciar();
    expect(c.resumen?.concepto).toBe('Cuota del carro');
    expect(c.dias.length).toBe(2);
    expect(c.esCompletada()).toBeFalse();
  });

  it('despliega y pliega el desglose de un día', () => {
    const c = iniciar();
    expect(c.estaAbierto(c.dias[0])).toBeFalse();
    c.alternarDia(c.dias[0]);
    expect(c.estaAbierto(c.dias[0])).toBeTrue();
    expect(c.estaAbierto(c.dias[1])).toBeFalse();
    c.alternarDia(c.dias[0]);
    expect(c.estaAbierto(c.dias[0])).toBeFalse();
  });

  it('al registrar aportes avisa cuántos préstamos se generaron y recarga', () => {
    const c = iniciar();
    const toast = TestBed.inject(ToastService);
    const exito = spyOn(toast, 'exito');
    const conPrestamo = dia(12, { detalles: [{ id: 1, prestamo_cruce_generado_id: 77 }, { id: 2, prestamo_cruce_generado_id: null }] as never });
    c.onRegistrado(conPrestamo);
    expect(exito).toHaveBeenCalledWith('Aportes registrados. Se generaron 1 préstamo por cobrar.');
    responder('obligaciones-mes/3/resumen', resumen());
    responder('obligaciones-mes/3/aportes-dia', []);
    expect(c.dias.length).toBe(0);
  });

  it('un id inválido no llama al backend; un 404 se explica', () => {
    configurarTestBed([DetalleObligacionComponent], [{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '-4' })) } }]);
    const f = TestBed.createComponent(DetalleObligacionComponent);
    f.detectChanges();
    expect(f.componentInstance.error).toContain('no es válida');
    http().expectNone(() => true);
  });
});
