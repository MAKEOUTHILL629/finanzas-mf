/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { RecurrentePersona } from '../modelos/aportes';
import { RecurrentesPersonaService } from '../services/recurrentes-persona.service';
import { API, configurarTestBed, errorHttp, esperar, http, responder, verificarHttp } from '../testing/erp-testing';
import { FormularioRecurrentePersonaComponent, plazoCoherente } from './formulario-recurrente-persona/formulario-recurrente-persona.component';
import { ListaRecurrentesPersonaComponent } from './lista-recurrentes-persona/lista-recurrentes-persona.component';
import {
  ETIQUETA_ESTADO_VISUAL,
  cambiosDeRecurrente,
  construirRecurrente,
  estadoVisual,
  etiquetaNaturaleza,
  etiquetaNaturalezaCorta,
  filtrarRecurrentes,
  mesFinPrevisto,
  textoProgreso,
  totalMensual,
} from './recurrentes-persona.constants';

const recurrente = (extra: Partial<RecurrentePersona> = {}): RecurrentePersona => ({
  id: 3, personaId: 2, personaNombre: 'Andrés Gómez', personaIniciales: 'AG', personaColor: '#34C759', concepto: 'Plan de celular', valorMensual: 65000,
  naturaleza: 'CARGO_A_COBRAR', modalidadDuracion: 'PLAZO_FIJO', vitalicio: false, numeroMeses: 6, mesInicio: '2026-08', mesFin: '2027-01', cuotasGeneradas: 3, diaCobro: 1,
  activo: true, estado: 'ACTIVO', notas: null, progreso: { actual: 3, total: 6, porcentaje: 50 }, ...extra,
});
const vitalicio = (extra: Partial<RecurrentePersona> = {}) =>
  recurrente({ id: 4, personaId: 4, personaNombre: 'Luis Fernando', concepto: 'Descuento', valorMensual: 10000, naturaleza: 'ABONO_A_FAVOR', modalidadDuracion: 'INDEFINIDO', vitalicio: true, numeroMeses: null, mesFin: null, progreso: null, cuotasGeneradas: 2, ...extra });
const personas = [{ id: 2, nombre: 'Andrés Gómez' }, { id: 4, nombre: 'Luis Fernando' }];
const valores = (extra: object = {}) => ({ personaId: 2, concepto: ' Plan de celular ', valorMensual: 65000 as number | string | null, naturaleza: 'CARGO_A_COBRAR' as any, modalidadDuracion: 'PLAZO_FIJO' as any, numeroMeses: 6 as number | string | null, mesInicio: '2026-08', diaCobro: 1 as number | string | null, notas: '', ...extra });

describe('Recurrentes por persona — lógica', () => {
  it('mes de fin: inicio + (X − 1) meses', () => {
    expect(mesFinPrevisto('2026-10', 6)).toBe('2027-03');
    expect(mesFinPrevisto('2026-10', '1')).toBe('2026-10');
    expect(mesFinPrevisto('2026-10', 0)).toBeNull();
    expect(mesFinPrevisto('2026-13', 3)).toBeNull();
    expect(mesFinPrevisto(null, 3)).toBeNull();
  });

  it('etiquetas, progreso y estado visual', () => {
    expect(etiquetaNaturaleza('CARGO_A_COBRAR')).toBe('Me debe pagar cada mes');
    expect(etiquetaNaturaleza('ABONO_A_FAVOR')).toBe('Saldo a favor / descuento mensual');
    expect(etiquetaNaturalezaCorta('ABONO_A_FAVOR')).toBe('A favor');
    expect(textoProgreso(recurrente())).toBe('3 / 6 meses');
    expect(textoProgreso(vitalicio())).toBe('Vitalicio');
    expect(estadoVisual(recurrente())).toBe('activo');
    expect(estadoVisual(recurrente({ activo: false }))).toBe('pausado');
    expect(estadoVisual(recurrente({ estado: 'FINALIZADO' }))).toBe('finalizado');
    expect(ETIQUETA_ESTADO_VISUAL.pausado).toBe('Pausado');
  });

  it('cuerpo de alta: el plazo solo viaja con PLAZO_FIJO; el concepto y las notas se recortan', () => {
    expect(construirRecurrente(valores())).toEqual({
      personaId: 2, concepto: 'Plan de celular', valorMensual: '65000', naturaleza: 'CARGO_A_COBRAR', modalidadDuracion: 'PLAZO_FIJO', numeroMeses: 6, mesInicio: '2026-08', diaCobro: 1,
    });
    const indefinido = construirRecurrente(valores({ modalidadDuracion: 'INDEFINIDO', numeroMeses: 6, notas: ' nota ', diaCobro: '' }));
    expect('numeroMeses' in indefinido).toBe(false);
    expect('diaCobro' in indefinido).toBe(false);
    expect(indefinido.notas).toBe('nota');
  });

  it('cambios al editar: solo lo modificado; con cuotas generadas no se reenvía el inicio ni la naturaleza', () => {
    const original = recurrente();
    expect(cambiosDeRecurrente(original, valores())).toEqual({});
    expect(cambiosDeRecurrente(original, valores({ valorMensual: '70000.00', concepto: 'Plan celular', notas: 'x' }))).toEqual({ valorMensual: '70000.00', concepto: 'Plan celular', notas: 'x' });
    expect(cambiosDeRecurrente(original, valores({ numeroMeses: 12 }))).toEqual({ numeroMeses: 12 });
    expect(cambiosDeRecurrente(original, valores({ mesInicio: '2026-09', naturaleza: 'ABONO_A_FAVOR' }))).toEqual({});
    // sin cuotas generadas, sí se pueden cambiar
    expect(cambiosDeRecurrente(recurrente({ cuotasGeneradas: 0 }), valores({ mesInicio: '2026-09', naturaleza: 'ABONO_A_FAVOR' }))).toEqual({ mesInicio: '2026-09', naturaleza: 'ABONO_A_FAVOR' });
    // pasar a de por vida no envía plazo
    expect(cambiosDeRecurrente(original, valores({ modalidadDuracion: 'INDEFINIDO' }))).toEqual({ modalidadDuracion: 'INDEFINIDO' });
  });

  it('filtros y totales mensuales (solo activos no finalizados)', () => {
    const lista = [recurrente(), vitalicio(), recurrente({ id: 5, activo: false, valorMensual: 1000 }), recurrente({ id: 6, estado: 'FINALIZADO', valorMensual: 2000 })];
    expect(filtrarRecurrentes(lista, { personaId: 2 }).length).toBe(3);
    expect(filtrarRecurrentes(lista, { activo: false }).map((r) => r.id)).toEqual([5]);
    expect(filtrarRecurrentes(lista, { modalidadDuracion: 'INDEFINIDO' }).map((r) => r.id)).toEqual([4]);
    expect(filtrarRecurrentes(lista, { personaId: null, activo: null, modalidadDuracion: null }).length).toBe(4);
    expect(totalMensual(lista)).toEqual({ cobros: 65000, favores: 10000 });
  });

  it('plazoCoherente: con plazo fijo exige un entero entre 1 y 600; de por vida no valida el plazo', () => {
    const grupo = (modalidadDuracion: string, numeroMeses: unknown) =>
      new FormGroup({ modalidadDuracion: new FormControl(modalidadDuracion), numeroMeses: new FormControl(numeroMeses) });
    expect(plazoCoherente(grupo('PLAZO_FIJO', 6))).toBeNull();
    expect(plazoCoherente(grupo('PLAZO_FIJO', 600))).toBeNull();
    for (const mal of [null, '', 0, 601, 2.5, 'abc']) expect(plazoCoherente(grupo('PLAZO_FIJO', mal))).toEqual({ plazoInvalido: true });
    expect(plazoCoherente(grupo('INDEFINIDO', null))).toBeNull();
  });
});

describe('RecurrentesPersonaService (contrato con el backend)', () => {
  beforeEach(() => configurarTestBed([]));
  afterEach(() => verificarHttp());

  it('lista con filtros limpios, crea, edita con PATCH, elimina y genera el mes', () => {
    const s = TestBed.inject(RecurrentesPersonaService);
    s.getRecurrentes().subscribe();
    expect(esperar('GET', 'recurrentes-persona').request.params.keys()).toEqual([]);
    s.getRecurrentes({ personaId: 2, activo: false, modalidadDuracion: null }).subscribe();
    const req = esperar('GET', 'recurrentes-persona');
    expect(req.request.params.get('personaId')).toBe('2');
    expect(req.request.params.get('activo')).toBe('false');
    expect(req.request.params.has('modalidadDuracion')).toBe(false);

    s.crear(construirRecurrente(valores())).subscribe();
    expect(esperar('POST', 'recurrentes-persona').request.body.numeroMeses).toBe(6);
    s.actualizar(3, { activo: false }).subscribe();
    expect(esperar('PATCH', 'recurrentes-persona/3').request.body).toEqual({ activo: false });
    s.eliminar(3).subscribe();
    esperar('DELETE', 'recurrentes-persona/3');
    s.generarMes('2026-10').subscribe();
    expect(esperar('POST', 'recurrentes-persona/generar-mes/2026-10').request.body).toEqual({});
  });
});

describe('ListaRecurrentesPersonaComponent', () => {
  afterEach(() => verificarHttp());

  function montar(lista: RecurrentePersona[] = [recurrente(), vitalicio()]) {
    configurarTestBed([ListaRecurrentesPersonaComponent]);
    const f = TestBed.createComponent(ListaRecurrentesPersonaComponent);
    f.detectChanges();
    responder('recurrentes-persona', lista);
    responder('personas', personas);
    f.detectChanges();
    return f;
  }
  const texto = (f: any) => {
    f.detectChanges();
    return (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  };

  it('tabla con persona, tipo, valor, progreso k/X o distintivo vitalicio y totales mensuales', () => {
    const f = montar();
    const t = texto(f);
    for (const esperado of ['Recurrentes por persona', 'Andrés Gómez', 'Plan de celular', '$65,000.00', '3 / 6 meses', 'Vitalicio', 'Descuento', 'A cobrar', 'A favor', 'Se cobra cada mes', 'Se descuenta cada mes', 'Desde Agosto 2026 hasta Enero 2027']) {
      expect(t).toContain(esperado);
    }
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    expect(f.nativeElement.querySelector('[role=progressbar]').getAttribute('aria-valuenow')).toBe('50');
  });

  it('filtrar por duración y quitar filtros', () => {
    const f = montar();
    f.componentInstance.cambiarFiltro('modalidadDuracion', 'INDEFINIDO');
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    f.componentInstance.cambiarFiltro('personaId', 2);
    f.detectChanges();
    expect(texto(f)).toContain('Ningún recurrente coincide');
    f.componentInstance.reiniciarFiltros();
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('pausar llama a PATCH activo=false y recarga', () => {
    const f = montar();
    f.componentInstance.alternarActivo(recurrente());
    const req = esperar('PATCH', 'recurrentes-persona/3');
    expect(req.request.body).toEqual({ activo: false });
    req.flush(recurrente({ activo: false }));
    responder('recurrentes-persona', [recurrente({ activo: false }), vitalicio()]);
    responder('personas', personas);
    f.detectChanges();
    expect(texto(f)).toContain('Pausado');
  });

  it('eliminar pide confirmación y anula el historial', () => {
    const f = montar();
    f.componentInstance.pedirEliminar(recurrente());
    f.detectChanges();
    expect(texto(f)).toContain('¿Eliminar «Plan de celular» de Andrés Gómez?');
    expect(texto(f)).toContain('3 generados');
    f.componentInstance.confirmarEliminar();
    responder('recurrentes-persona/3', { eliminado: true, movimientosAnulados: 3 }, 'DELETE');
    responder('recurrentes-persona', [vitalicio()]);
    responder('personas', personas);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(f.componentInstance.eliminando).toBeNull();
  });

  it('vacío invita a crear el primero; el error ofrece reintentar', () => {
    const vacio = montar([]);
    expect(texto(vacio)).toContain('Aún no hay recurrentes por persona');
    TestBed.resetTestingModule();

    configurarTestBed([ListaRecurrentesPersonaComponent]);
    const f = TestBed.createComponent(ListaRecurrentesPersonaComponent);
    f.detectChanges();
    errorHttp(esperar('GET', 'recurrentes-persona'), 500, { message: 'x' });
    http().match((r) => r.url === `${API}/personas`); // la otra petición del forkJoin queda cancelada o abierta: se descarta
    f.detectChanges();
    expect(texto(f)).toContain('Reintentar');
  });
});

describe('FormularioRecurrentePersonaComponent', () => {
  afterEach(() => verificarHttp());

  function montar(entradas: Partial<FormularioRecurrentePersonaComponent> = {}) {
    configurarTestBed([FormularioRecurrentePersonaComponent]);
    const f = TestBed.createComponent(FormularioRecurrentePersonaComponent);
    Object.assign(f.componentInstance, { personas }, entradas);
    f.detectChanges();
    return f;
  }
  const texto = (f: any) => {
    f.detectChanges();
    return (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  };

  it('alta por plazo fijo: muestra en qué mes termina y envía POST', () => {
    const f = montar();
    const c = f.componentInstance;
    c.form.patchValue({ personaId: 2, concepto: 'Seguro', valorMensual: 80000, modalidadDuracion: 'PLAZO_FIJO', numeroMeses: 6, mesInicio: '2026-10' });
    expect(c.mesFin).toBe('2027-03');
    expect(texto(f)).toContain('Terminará en Marzo 2027');
    let creado: any = null;
    c.guardado.subscribe((r) => (creado = r));
    c.enviar();
    const req = esperar('POST', 'recurrentes-persona');
    expect(req.request.body).toEqual({ personaId: 2, concepto: 'Seguro', valorMensual: '80000', naturaleza: 'CARGO_A_COBRAR', modalidadDuracion: 'PLAZO_FIJO', numeroMeses: 6, mesInicio: '2026-10', diaCobro: 1 });
    req.flush(recurrente());
    expect(creado.id).toBe(3);
  });

  it('de por vida no pide plazo ni envía numeroMeses', () => {
    const f = montar();
    const c = f.componentInstance;
    c.form.patchValue({ personaId: 4, concepto: 'Descuento', valorMensual: 10000, naturaleza: 'ABONO_A_FAVOR', numeroMeses: 99 });
    expect(c.plazoFijo).toBe(false);
    expect(texto(f)).not.toContain('Cantidad de meses');
    c.enviar();
    const body = esperar('POST', 'recurrentes-persona').request.body;
    expect(body.naturaleza).toBe('ABONO_A_FAVOR');
    expect('numeroMeses' in body).toBe(false);
  });

  it('plazo fijo sin meses no envía nada y marca el error', () => {
    const f = montar();
    const c = f.componentInstance;
    c.form.patchValue({ personaId: 2, concepto: 'x', valorMensual: 1, modalidadDuracion: 'PLAZO_FIJO' });
    c.enviar();
    f.detectChanges();
    expect(c.form.hasError('plazoInvalido')).toBe(true);
    expect(texto(f)).toContain('Un número entero entre 1 y 600');
    expect(c.enviando).toBe(false);
  });

  it('editar: carga el recurrente, bloquea persona, inicio y tipo si ya generó cuotas y envía solo los cambios', () => {
    const f = montar({ recurrente: recurrente() });
    const c = f.componentInstance;
    expect(c.editando).toBe(true);
    expect(c.bloqueado).toBe(true);
    expect(c.form.controls.personaId.disabled).toBe(true);
    expect(c.form.controls.mesInicio.disabled).toBe(true);
    expect(c.form.controls.naturaleza.disabled).toBe(true);
    expect(texto(f)).toContain('Ya generó 3 cuotas');
    c.form.controls.valorMensual.setValue(70000);
    c.enviar();
    const req = esperar('PATCH', 'recurrentes-persona/3');
    expect(req.request.body).toEqual({ valorMensual: '70000' });
    req.flush(recurrente({ valorMensual: 70000 }));
  });

  it('un error del servidor se muestra', () => {
    const f = montar();
    const c = f.componentInstance;
    c.form.patchValue({ personaId: 2, concepto: 'x', valorMensual: 1 });
    c.enviar();
    errorHttp(esperar('POST', 'recurrentes-persona'), 404, { message: 'Persona 2 no encontrada' });
    expect(texto(f)).toContain('Persona 2 no encontrada');
  });
});
