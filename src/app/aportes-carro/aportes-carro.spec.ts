/* eslint-disable @typescript-eslint/no-explicit-any */
import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AporteDiario, DetalleAporteDiario, PeriodoCarro, ResumenCarro } from '../modelos/aportes';
import { AportesCarroService } from '../services/aportes-carro.service';
import { API, configurarTestBed, cuentaItem, errorHttp, esperar, http, persona as personaCatalogo, responder, responderCatalogos, sugerenciasDe, verificarHttp } from '../testing/erp-testing';
import { desplazarPeriodo, periodoActual } from '../shared/periodo.helper';
import { AportesCarroComponent } from './aportes-carro.component';
import {
  SIN_FILTROS,
  avisoCruce,
  chipsDeAporte,
  claseEstadoPeriodo,
  clasificarMetodo,
  construirAporteDiario,
  esDeOtroMes,
  etiquetaEstadoPeriodo,
  etiquetaMetodo,
  filtrarPeriodos,
  hayFiltros,
  opcionesDePeriodo,
  periodosConExcedente,
  metodoTrasCambiarPersona,
  personaTrasCambiarMetodo,
  personasEnAportes,
  pideCuenta,
  primerNombre,
  proyeccionDelMes,
  textoEstadoPeriodo,
} from './aportes-carro.constants';
import { FormularioAporteDiarioComponent } from './formulario-aporte-diario/formulario-aporte-diario.component';
import { FormularioExcedenteComponent, construirExcedente } from './formulario-excedente/formulario-excedente.component';
import { FormularioPeriodoCarroComponent, construirPeriodo } from './formulario-periodo-carro/formulario-periodo-carro.component';

// ───────────────────────────── datos de prueba ─────────────────────────────
const persona = (id: number, nombre: string) => ({ id, nombre, iniciales: nombre.slice(0, 2).toUpperCase(), color: '#0071E3' });
const papa = persona(4, 'Luis Fernando');
const detalle = (extra: Partial<DetalleAporteDiario> = {}): DetalleAporteDiario => ({
  id: 1, aporteDiarioId: 10, valor: 600000, metodo: 'EFECTIVO', metodoCanonico: 'EFECTIVO', personaId: 4, personaNombre: 'Luis Fernando', personaColor: null,
  comentarios: null, cuentaFinancieraId: 9, cuentaNombre: 'Efectivo', transaccionId: 55, prestamoCruceGeneradoId: null, esCruce: false, origenObligacionMesId: null, ...extra,
});
const cruce = (extra: Partial<DetalleAporteDiario> = {}) =>
  detalle({ id: 2, valor: 100000.5, metodo: 'CRUCE_CUENTAS', metodoCanonico: 'CRUCE_CUENTAS', personaId: 2, personaNombre: 'Andrés Gómez', esCruce: true, prestamoCruceGeneradoId: 77, cuentaFinancieraId: null, cuentaNombre: null, transaccionId: null, comentarios: 'arreglo', ...extra });
const aporte = (extra: Partial<AporteDiario> = {}): AporteDiario => ({ id: 10, obligacionMesId: 66, periodo: '2026-09', fecha: '2026-10-14T00:00:00.000Z', notas: null, valorTotal: 700000.5, detalles: [detalle(), cruce()], ...extra });
const periodo = (extra: Partial<PeriodoCarro> = {}): PeriodoCarro => ({
  id: 66, tipoObligacion: 'CUOTA_CARRO', periodo: '2026-09', concepto: 'Septiembre 2026', responsable: papa, valorCuotaObjetivo: 1000000, montoAbonado: 700000.5, saldoPendiente: 299999.5,
  saldoAFavorGenerado: 0, saldoAFavorAplicado: 0, saldoAFavorDisponible: 0, estado: 'PARCIAL', estadoCalculado: 'ABIERTO', progresoPorcentaje: 70, aportadoPorCruces: 100000.5,
  aportadoDirecto: 600000, cantidadAportes: 1, aportes: [aporte()], ...extra,
});
const conExcedente = (extra: Partial<PeriodoCarro> = {}) =>
  periodo({ id: 60, periodo: '2026-04', concepto: 'Abril 2026', montoAbonado: 1245000, saldoPendiente: 0, saldoAFavorGenerado: 245000, saldoAFavorDisponible: 245000, estado: 'CON_SALDO_A_FAVOR', progresoPorcentaje: 100, aportes: [aporte({ id: 11, obligacionMesId: 60, periodo: '2026-04', valorTotal: 1245000, detalles: [detalle({ id: 5, valor: 1245000, aporteDiarioId: 11 })] })], ...extra });
const resumen = (extra: Partial<ResumenCarro> = {}): ResumenCarro => ({
  tipoObligacion: 'CUOTA_CARRO', responsable: papa, cuotaBase: 1000000, periodoActual: periodoActual(), periodoSeleccionadoId: 66, saldoAFavorDisponibleGlobal: 245000,
  periodos: [periodo(), conExcedente()], ...extra,
});
const personas = [personaCatalogo(1, 'Felipe', { esPropia: true, tieneUsuario: true }), personaCatalogo(2, 'Andrés Gómez'), personaCatalogo(4, 'Luis Fernando')];
const cuentas = [
  cuentaItem(9, 'Efectivo', { tipoCuenta: 'EFECTIVO' }),
  cuentaItem(8, 'Bancolombia', { bancoEntidad: 'Bancolombia', ultimos4: '1234', saldoActual: 1000000 }),
  cuentaItem(7, 'Dólares', { moneda: 'USD', saldoActual: 10 }),
];
function texto(f: ComponentFixture<unknown>): string {
  f.detectChanges();
  return (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
}

// ───────────────────────────── lógica pura ─────────────────────────────
describe('Aportes del carro — lógica', () => {
  it('etiquetas de método: canónicos y heredados de AppSheet', () => {
    expect(etiquetaMetodo('EFECTIVO')).toBe('Efectivo');
    expect(etiquetaMetodo('Fisico')).toBe('Efectivo');
    expect(etiquetaMetodo('Bancolombia')).toBe('Transferencia · Bancolombia');
    expect(etiquetaMetodo('Nequi')).toBe('Transferencia · Nequi');
    expect(etiquetaMetodo('Prestamo')).toBe('Cruce de cuentas');
    expect(etiquetaMetodo('Carrera')).toBe('Carrera');
    expect(etiquetaMetodo(null)).toBe('Aporte');
  });

  it('clasifica igual que el backend y decide cuándo pedir cuenta', () => {
    expect(clasificarMetodo('Fisico')).toBe('EFECTIVO');
    expect(clasificarMetodo('Nequi')).toBe('TRANSFERENCIA');
    expect(clasificarMetodo('Prestamo')).toBe('CRUCE_CUENTAS');
    expect(clasificarMetodo('SALDO_A_FAVOR')).toBe('SALDO_A_FAVOR');
    expect(clasificarMetodo('Uso Carro')).toBe('OTRO');
    expect(clasificarMetodo(null)).toBe('OTRO');
    expect(pideCuenta('EFECTIVO')).toBe(true);
    expect(pideCuenta('Bancolombia')).toBe(true);
    expect(pideCuenta('CRUCE_CUENTAS')).toBe(false);
    expect(pideCuenta('SALDO_A_FAVOR')).toBe(false);
  });

  it('estado del mes: etiqueta, color y el texto del badge de la cabecera', () => {
    expect(etiquetaEstadoPeriodo('CON_SALDO_A_FAVOR')).toBe('Con saldo a favor');
    expect(claseEstadoPeriodo('COMPLETADO')).toBe('success');
    expect(claseEstadoPeriodo('PARCIAL')).toBe('warning');
    expect(claseEstadoPeriodo('PENDIENTE')).toBe('danger');
    expect(claseEstadoPeriodo('CON_SALDO_A_FAVOR')).toBe('info');
    expect(textoEstadoPeriodo(periodo())).toBe('Faltan $299,999.50');
    expect(textoEstadoPeriodo(conExcedente())).toBe('Saldo a favor: +$245,000.00');
    expect(textoEstadoPeriodo(periodo({ estado: 'COMPLETADO' }))).toBe('Completado');
  });

  it('chips de un aporte: sin repetir y con el nombre de quien asume el cruce', () => {
    expect(chipsDeAporte(aporte()).map((c) => [c.texto, c.tipo])).toEqual([['Efectivo', 'efectivo'], ['Cruce: Andrés', 'cruce']]);
    const repetidos = aporte({ detalles: [detalle(), detalle({ id: 3 }), detalle({ id: 4, metodo: 'Nequi', metodoCanonico: 'TRANSFERENCIA' })] });
    expect(chipsDeAporte(repetidos).map((c) => c.texto)).toEqual(['Efectivo', 'Transferencia · Nequi']);
    expect(primerNombre('Luis Fernando Hernández')).toBe('Luis');
    expect(primerNombre(null)).toBe('la persona');
  });

  it('persona sugerida al cambiar de método', () => {
    expect(personaTrasCambiarMetodo('CRUCE_CUENTAS', 4, 4)).toBeNull(); // hay que elegir quién asume
    expect(personaTrasCambiarMetodo('CRUCE_CUENTAS', 2, 4)).toBe(2);
    expect(personaTrasCambiarMetodo('EFECTIVO', 2, 4, 1)).toBe(4); // un tercero vuelve al responsable
    expect(personaTrasCambiarMetodo('TRANSFERENCIA', 1, 4, 1)).toBe(1); // tú también puedes entregar
    expect(personaTrasCambiarMetodo('SALDO_A_FAVOR', 1, 4, 1)).toBe(4);
    expect(personaTrasCambiarMetodo('Carrera', 2, 4)).toBe(2); // heredado: no se toca
  });

  it('al elegir a una persona el método se ajusta a lo que acepta el servidor: un tercero solo puede aportar como cruce', () => {
    // responsable 4, tú 1, tercero 2
    expect(metodoTrasCambiarPersona('EFECTIVO', 2, 4, 1)).toEqual({ metodo: 'CRUCE_CUENTAS', cambio: true });
    expect(metodoTrasCambiarPersona('TRANSFERENCIA', 2, 4, 1)).toEqual({ metodo: 'CRUCE_CUENTAS', cambio: true });
    expect(metodoTrasCambiarPersona('SALDO_A_FAVOR', 2, 4, 1)).toEqual({ metodo: 'CRUCE_CUENTAS', cambio: true });
    expect(metodoTrasCambiarPersona('SALDO_A_FAVOR', 1, 4, 1).cambio).toBeTrue(); // el saldo a favor es solo del responsable
    expect(metodoTrasCambiarPersona('EFECTIVO', 4, 4, 1).cambio).toBeFalse();
    expect(metodoTrasCambiarPersona('EFECTIVO', 1, 4, 1).cambio).toBeFalse(); // tú también puedes entregar efectivo
    expect(metodoTrasCambiarPersona('CRUCE_CUENTAS', 2, 4, 1).cambio).toBeFalse();
    expect(metodoTrasCambiarPersona('Carrera', 2, 4, 1)).toEqual({ metodo: 'Carrera', cambio: false }); // heredado: no se toca
    expect(metodoTrasCambiarPersona('EFECTIVO', null, 4, 1).cambio).toBeFalse(); // sin persona no hay nada que ajustar
  });

  it('aviso del cruce: a quién se le carga el valor', () => {
    expect(avisoCruce('Andrés')).toBe('Este valor se abonará a la cuota del carro y se cargará automáticamente a la cuenta por cobrar de Andrés a fin de mes.');
    expect(avisoCruce('Luis', true)).toContain('sin cargar a nadie');
  });

  it('arma el cuerpo: solo envía cuenta con efectivo/transferencia y origen con saldo a favor', () => {
    const cuerpo = construirAporteDiario({
      fecha: '2026-10-14',
      periodo: '2026-09',
      notas: '  entrega  ',
      lineas: [
        { valor: 600000, metodo: 'EFECTIVO', personaId: 4, cuentaFinancieraId: 9, comentarios: '' },
        { valor: '100000.50', metodo: 'CRUCE_CUENTAS', personaId: 2, cuentaFinancieraId: 9, comentarios: ' arreglo ' },
        { valor: 50000, metodo: 'SALDO_A_FAVOR', personaId: 4, cuentaFinancieraId: null, comentarios: null, origenObligacionMesId: 60 },
        { id: 8, valor: 1000, metodo: 'Carrera', personaId: 4, cuentaFinancieraId: null, comentarios: null },
      ],
    });
    expect(cuerpo).toEqual({
      fecha: '2026-10-14',
      periodo: '2026-09',
      notas: 'entrega',
      detalles: [
        { valor: '600000', metodo: 'EFECTIVO', personaId: 4, cuentaFinancieraId: 9 },
        { valor: '100000.50', metodo: 'CRUCE_CUENTAS', personaId: 2, comentarios: 'arreglo' }, // la cuenta no viaja con un cruce
        { valor: '50000', metodo: 'SALDO_A_FAVOR', personaId: 4, origenObligacionMesId: 60 },
        { id: 8, valor: '1000', metodo: 'Carrera', personaId: 4 }, // el método heredado se conserva tal cual
      ],
    });
  });

  it('opciones de periodo: los existentes más anterior, actual y siguiente, del más reciente al más antiguo', () => {
    const hoy = '2026-10';
    const o = opcionesDePeriodo([{ periodo: '2026-09' }, { periodo: '2025-08' }], hoy);
    expect(o.map((x) => x.periodo)).toEqual(['2026-11', '2026-10', '2026-09', '2025-08']);
    expect(o.map((x) => x.existe)).toEqual([false, false, true, true]);
    expect(o[1].etiqueta).toBe('Octubre 2026');
  });

  it('filtros: por mes, persona y método; los meses sin aportes que coincidan se ocultan', () => {
    const lista = [periodo(), conExcedente()];
    expect(hayFiltros(SIN_FILTROS)).toBe(false);
    expect(filtrarPeriodos(lista, SIN_FILTROS).length).toBe(2);
    expect(filtrarPeriodos(lista, { ...SIN_FILTROS, periodo: '2026-04' }).map((p) => p.periodo)).toEqual(['2026-04']);
    expect(filtrarPeriodos(lista, { ...SIN_FILTROS, personaId: 2 }).map((p) => p.periodo)).toEqual(['2026-09']); // solo Septiembre tiene a Andrés
    expect(filtrarPeriodos(lista, { ...SIN_FILTROS, metodo: 'CRUCE_CUENTAS' })[0].aportes.length).toBe(1);
    expect(filtrarPeriodos(lista, { ...SIN_FILTROS, metodo: 'SALDO_A_FAVOR' })).toEqual([]);
    expect(personasEnAportes(lista).map((p) => p.nombre)).toEqual(['Andrés Gómez', 'Luis Fernando']);
    expect(periodosConExcedente(lista).map((p) => p.periodo)).toEqual(['2026-04']);
  });

  it('un aporte de otro mes (pago de octubre para septiembre) se distingue', () => {
    expect(esDeOtroMes(aporte(), '2026-09')).toBe(true);
    expect(esDeOtroMes(aporte({ fecha: '2026-09-05T00:00:00.000Z' }), '2026-09')).toBe(false);
  });

  it('proyección del mes tras guardar: falta / excedente / cubierta; al editar no cuenta dos veces el propio aporte', () => {
    const p = { valorCuotaObjetivo: 1000000, montoAbonado: 700000.5 };
    expect(proyeccionDelMes(p, 100000)).toEqual({ abonadoDespues: 800000.5, faltante: 199999.5, excedente: 0 });
    expect(proyeccionDelMes(p, 399999.5)).toEqual({ abonadoDespues: 1100000, faltante: 0, excedente: 100000 });
    expect(proyeccionDelMes(p, 299999.5)).toEqual({ abonadoDespues: 1000000, faltante: 0, excedente: 0 });
    expect(proyeccionDelMes(p, 700000.5, 700000.5)).toEqual({ abonadoDespues: 700000.5, faltante: 299999.5, excedente: 0 });
    expect(proyeccionDelMes(null, 5)).toBeNull();
  });

  it('cuerpos de periodo y excedente', () => {
    expect(construirPeriodo({ periodo: '2026-10', valorCuota: 1400000, concepto: ' ' })).toEqual({ periodo: '2026-10', valorCuota: '1400000' });
    expect(construirPeriodo({ periodo: '2026-10', valorCuota: '1400000.50', concepto: 'Octubre 2026' })).toEqual({ periodo: '2026-10', valorCuota: '1400000.50', concepto: 'Octubre 2026' });
    expect(construirExcedente({ destino: 'SIGUIENTE_MES', valor: 50000, periodoImputacion: '2026-10' })).toEqual({ destino: 'SIGUIENTE_MES', valor: '50000' });
    expect(construirExcedente({ destino: 'ESTADO_CUENTA', valor: 50000, periodoImputacion: '2026-10' })).toEqual({ destino: 'ESTADO_CUENTA', valor: '50000', periodoImputacion: '2026-10' });
  });
});

// ───────────────────────────── servicio HTTP ─────────────────────────────
describe('AportesCarroService (contrato con el backend)', () => {
  beforeEach(() => configurarTestBed([]));
  afterEach(() => verificarHttp());

  it('resumen: GET con el periodo solo si se indica', () => {
    const s = TestBed.inject(AportesCarroService);
    s.getResumen().subscribe();
    expect(esperar('GET', 'obligaciones-aportes/carro/resumen').request.params.keys()).toEqual([]);
    s.getResumen('2026-10').subscribe();
    expect(esperar('GET', 'obligaciones-aportes/carro/resumen').request.params.get('periodo')).toBe('2026-10');
    s.getResumenWhatsApp('2026-10').subscribe();
    expect(esperar('GET', 'obligaciones-aportes/carro/resumen-whatsapp').request.params.get('periodo')).toBe('2026-10');
  });

  it('periodos, aportes diarios y excedente usan los verbos y rutas del backend', () => {
    const s = TestBed.inject(AportesCarroService);
    s.guardarPeriodo({ periodo: '2026-10', valorCuota: '1400000' }).subscribe();
    expect(esperar('POST', 'obligaciones-aportes/periodos').request.body).toEqual({ periodo: '2026-10', valorCuota: '1400000' });
    const cuerpo = { fecha: '2026-10-14', detalles: [{ valor: '1', metodo: 'EFECTIVO', personaId: 4 }] };
    s.crearAporteDiario(cuerpo).subscribe();
    expect(esperar('POST', 'obligaciones-aportes/aportes-diarios').request.body).toEqual(cuerpo);
    s.actualizarAporteDiario(10, cuerpo).subscribe();
    expect(esperar('PUT', 'obligaciones-aportes/aportes-diarios/10').request.body).toEqual(cuerpo);
    s.eliminarAporteDiario(10).subscribe();
    esperar('DELETE', 'obligaciones-aportes/aportes-diarios/10');
    s.aplicarExcedente(60, { destino: 'SIGUIENTE_MES', valor: '5' }).subscribe();
    expect(esperar('POST', 'obligaciones-aportes/periodos/60/aplicar-excedente').request.body).toEqual({ destino: 'SIGUIENTE_MES', valor: '5' });
  });
});

// ───────────────────────────── pantalla ─────────────────────────────
describe('AportesCarroComponent', () => {
  afterEach(() => verificarHttp());

  function montar(datos: ResumenCarro | null = resumen()) {
    configurarTestBed([AportesCarroComponent]);
    const f = TestBed.createComponent(AportesCarroComponent);
    f.detectChanges();
    if (datos) responder('obligaciones-aportes/carro/resumen', datos);
    f.detectChanges();
    return f;
  }

  it('muestra los indicadores, el acordeón por mes y cómo se compuso cada aporte', () => {
    const f = montar();
    const t = texto(f);
    for (const esperado of [
      'Aportes del carro', 'Cuota de Septiembre 2026', '$1,000,000.00', '$700,000.50 abonado', 'Faltan $299,999.50',
      'Saldo a favor de Luis Fernando', '$245,000.00', 'Aplicar a mes / cruzar cuenta',
      'Septiembre 2026', 'Abril 2026', 'Saldo a favor: +$245,000.00',
    ]) expect(t).toContain(esperado);
    // el mes de los indicadores está desplegado: su aporte, su fecha y sus chips
    expect(t).toContain('14 de Octubre del 2026');
    expect(t).toContain('Cruce: Andrés');
    expect(t).toContain('de otro mes');
    // el otro mes arranca cerrado
    expect(f.nativeElement.querySelectorAll('.periodo-cuerpo').length).toBe(1);
  });

  it('desplegar un mes muestra su aviso de saldo a favor; ver detalle muestra el desglose', () => {
    const f = montar();
    const cabeceras = f.nativeElement.querySelectorAll('.periodo-cabecera') as NodeListOf<HTMLButtonElement>;
    expect(cabeceras[1].getAttribute('aria-expanded')).toBe('false');
    cabeceras[1].click();
    expect(texto(f)).toContain('Este mes quedó con $245,000.00 de saldo a favor sin aplicar');

    const verDetalle = f.nativeElement.querySelector('button[aria-label^="Ver detalle"]') as HTMLButtonElement;
    verDetalle.click();
    const t = texto(f);
    expect(t).toContain('Le cargas esta deuda');
    expect(t).toContain('arreglo');
    expect(f.nativeElement.querySelector('.desglose')).not.toBeNull();
  });

  it('filtrar por persona deja solo los aportes que la incluyen; sin coincidencias avisa', () => {
    const f = montar();
    f.componentInstance.cambiarFiltro('personaId', 2);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.periodo').length).toBe(1);
    expect(texto(f)).toContain('Quitar filtros');
    f.componentInstance.cambiarFiltro('metodo', 'SALDO_A_FAVOR');
    expect(texto(f)).toContain('Ningún aporte coincide');
    f.componentInstance.reiniciarFiltros();
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.periodo').length).toBe(2);
  });

  it('eliminar pide confirmación explicando qué se anula y luego borra y recarga', () => {
    const f = montar();
    (f.nativeElement.querySelector('button[aria-label^="Eliminar el aporte"]') as HTMLButtonElement).click();
    const t = texto(f);
    expect(t).toContain('¿Eliminar el aporte de $700,000.50');
    expect(t).toContain('Se anularán 1 cruce');
    expect(t).toContain('Se revertirán 1 ingreso');

    (Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((b) => b.textContent!.includes('Sí, eliminar'))!.click();
    responder('obligaciones-aportes/aportes-diarios/10', { eliminado: true, aporteDiarioId: 10, detallesEliminados: 2, crucesAnulados: 1, transaccionesAnuladas: 1 }, 'DELETE');
    responder('obligaciones-aportes/carro/resumen', resumen({ periodos: [periodo({ aportes: [], cantidadAportes: 0, montoAbonado: 0, estado: 'PENDIENTE', saldoPendiente: 1000000 })] }));
    f.detectChanges();
    expect(f.componentInstance.eliminando).toBeNull();
    expect(texto(f)).toContain('Aún no hay aportes en este mes');
  });

  it('cancelar la eliminación no llama al servidor', () => {
    const f = montar();
    f.componentInstance.pedirEliminar(aporte());
    f.componentInstance.cancelarEliminar();
    expect(f.componentInstance.eliminando).toBeNull();
  });

  it('sin periodos invita a configurar la cuota; sin el mes actual avisa', () => {
    const vacio = montar(resumen({ periodos: [], periodoSeleccionadoId: null, saldoAFavorDisponibleGlobal: 0, responsable: null, cuotaBase: null }));
    expect(texto(vacio)).toContain('Aún no hay periodos de la cuota');

    TestBed.resetTestingModule();
    const f = montar(resumen({ periodos: [periodo({ periodo: desplazarPeriodo(periodoActual(), -2) })] }));
    expect(texto(f)).toContain('Aún no configuras la cuota de');
  });

  it('un error del servidor se muestra con reintento', () => {
    configurarTestBed([AportesCarroComponent]);
    const f = TestBed.createComponent(AportesCarroComponent);
    f.detectChanges();
    errorHttp(esperar('GET', 'obligaciones-aportes/carro/resumen'), 500, { message: 'falló' });
    expect(texto(f)).toContain('Reintentar');
    expect((Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((b) => b.textContent!.includes('Agregar aporte'))!.disabled).toBe(true);
    f.componentInstance.cargar();
    responder('obligaciones-aportes/carro/resumen', resumen());
    f.detectChanges();
    expect(f.componentInstance.error).toBeNull();
  });

  it('abrir el formulario de aporte, de periodo y de excedente', () => {
    const f = montar();
    f.componentInstance.abrirAporte();
    expect(f.componentInstance.aporteAbierto).toBe(true);
    expect(f.componentInstance.periodoDelFormulario).toBe('2026-09'); // el mes de los indicadores
    f.componentInstance.cerrarModal();
    expect(f.componentInstance.aporteAbierto).toBe(false);

    f.componentInstance.abrirAporte(aporte());
    expect(f.componentInstance.aporteEnEdicion?.id).toBe(10);
    f.componentInstance.cerrarModal();
    expect(f.componentInstance.aporteEnEdicion).toBeNull();

    f.componentInstance.abrirPeriodo();
    expect(f.componentInstance.periodoAbierto).toBe(true);
    f.componentInstance.abrirExcedente();
    expect(f.componentInstance.excedenteAbierto).toBe(true);
    expect(f.componentInstance.periodoExcedenteId).toBe(60);
  });
});

// ───────────────────────────── formulario del aporte ─────────────────────────────
describe('FormularioAporteDiarioComponent', () => {
  afterEach(() => verificarHttp());

  function montar(entradas: Partial<FormularioAporteDiarioComponent> = {}, providers: Provider[] = []) {
    TestBed.resetTestingModule(); // algunas pruebas montan dos formularios
    configurarTestBed([FormularioAporteDiarioComponent], providers);
    const f = TestBed.createComponent(FormularioAporteDiarioComponent);
    Object.assign(f.componentInstance, { periodos: [periodo(), conExcedente()], responsable: papa, cuotaBase: 1000000, periodoInicial: '2026-09' }, entradas);
    f.detectChanges();
    responderCatalogos({ personas, cuentas });
    f.detectChanges();
    return f;
  }

  it('arranca con una línea de efectivo a nombre del responsable y solo ofrece cuentas en pesos', () => {
    const f = montar();
    const c = f.componentInstance;
    expect(c.lineas.length).toBe(1);
    expect(c.lineas.at(0).controls.metodo.value).toBe('EFECTIVO');
    expect(c.lineas.at(0).controls.personaId.value).toBe(4);
    expect(c.cuentas.map((x) => x.nombre)).toEqual(['Efectivo', 'Bancolombia']); // la cuenta en USD se descarta
    expect(c.form.controls.periodo.value).toBe('2026-09');
    expect(texto(f)).toContain('Valor total del día');
  });

  it('un cruce de cuentas pide quién asume la deuda y avisa a quién se le carga', () => {
    const f = montar();
    const c = f.componentInstance;
    c.agregarLinea();
    const fila = c.lineas.at(1);
    fila.controls.metodo.setValue('CRUCE_CUENTAS');
    expect(fila.controls.personaId.value).toBeNull(); // hay que elegir
    fila.controls.personaId.setValue(2);
    const t = texto(f);
    expect(t).toContain('Quién asume la deuda');
    expect(t).toContain('se cargará automáticamente a la cuenta por cobrar de Andrés a fin de mes');
  });

  it('el selector de persona ofrece a TODAS las personas con cualquier método (no solo al responsable y a ti)', () => {
    const f = montar();
    const c = f.componentInstance;
    expect(c.opcionesPersona.map((p) => p.nombre)).toEqual(['Felipe', 'Andrés Gómez', 'Luis Fernando']);
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#fa-persona-0')!.click(); // línea de efectivo
    f.detectChanges();
    expect(Array.from(document.querySelectorAll('.ss-opcion-texto')).map((x) => x.textContent?.trim())).toEqual(['Felipe', 'Andrés Gómez', 'Luis Fernando']);
  });

  it('las personas que más aportan van primero (Frecuentes) y las demás siguen debajo', () => {
    const f = montar({}, [sugerenciasDe({ personaAporteIds: [2, 4], ultimaPersonaAporteId: 2 })]);
    const c = f.componentInstance;
    expect(c.frecuentes).toEqual([2, 4]);
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#fa-persona-0')!.click();
    f.detectChanges();
    expect(Array.from(document.querySelectorAll('.ss-opcion-texto')).map((x) => x.textContent?.trim())).toEqual(['Andrés Gómez', 'Luis Fernando', 'Felipe']);
    expect(Array.from(document.querySelectorAll('.ss-grupo')).map((x) => x.textContent?.trim())).toEqual(['Frecuentes', 'Todas las personas']);
  });

  it('elegir a un tercero con efectivo pasa solo a «Cruce de cuentas» y lo explica; volver al responsable no deja el aviso', () => {
    const f = montar();
    const c = f.componentInstance;
    const fila = c.lineas.at(0);
    fila.controls.cuentaFinancieraId.setValue(9);
    fila.controls.personaId.setValue(2); // Andrés, que no es el responsable
    f.detectChanges();
    expect(fila.controls.metodo.value).toBe('CRUCE_CUENTAS');
    expect(fila.controls.personaId.value).toBe(2); // la persona elegida se respeta
    expect(fila.controls.cuentaFinancieraId.value).toBeNull(); // un cruce no entra a una cuenta
    expect(c.avisoCambio(fila)).toContain('Andrés no es el responsable de la cuota');
    expect(c.avisoCambio(fila)).toContain('«Efectivo» a «Cruce de cuentas»');
    expect(texto(f)).toContain('pasó de «Efectivo» a «Cruce de cuentas»');

    fila.controls.metodo.setValue('EFECTIVO'); // el usuario lo cambia a mano: un tercero vuelve al responsable
    expect(fila.controls.personaId.value).toBe(4);
    expect(c.avisoCambio(fila)).toBeNull();
  });

  it('un aporte de un tercero con el método ya ajustado se envía como cruce (no como efectivo, que el servidor rechazaría)', () => {
    const f = montar();
    const c = f.componentInstance;
    c.lineas.at(0).patchValue({ valor: 50000, personaId: 2 });
    c.enviar();
    const req = esperar('POST', 'obligaciones-aportes/aportes-diarios');
    expect(req.request.body.detalles).toEqual([jasmine.objectContaining({ metodo: 'CRUCE_CUENTAS', personaId: 2, valor: '50000' })]);
    req.flush({ aporteDiario: aporte(), periodo: periodo(), transaccionesCreadas: 0, crucesGenerados: 1 });
  });

  it('en un cruce se propone al último tercero que aportó (no al responsable ni a ti)', () => {
    const f = montar({}, [sugerenciasDe({ ultimaPersonaAporteId: 2 })]);
    const c = f.componentInstance;
    c.agregarLinea();
    c.lineas.at(1).controls.metodo.setValue('CRUCE_CUENTAS');
    expect(c.lineas.at(1).controls.personaId.value).toBe(2);
    const g = montar({}, [sugerenciasDe({ ultimaPersonaAporteId: 4 })]); // el último fue el responsable: hay que elegir
    g.componentInstance.agregarLinea();
    g.componentInstance.lineas.at(1).controls.metodo.setValue('CRUCE_CUENTAS');
    expect(g.componentInstance.lineas.at(1).controls.personaId.value).toBeNull();
  });

  it('suma el total, proyecta el mes y no deja guardar con valores inválidos', () => {
    const f = montar();
    const c = f.componentInstance;
    c.lineas.at(0).controls.valor.setValue(100000);
    c.agregarLinea();
    c.lineas.at(1).controls.valor.setValue('50000.55');
    c.lineas.at(1).controls.personaId.setValue(4);
    expect(c.total).toBe(150000.55);
    const t = texto(f);
    expect(t).toContain('$150,000.55');
    expect(t).toContain('le faltarían $149,998.95'); // 1.000.000 − (700.000,50 + 150.000,55)

    c.lineas.at(1).controls.valor.setValue('10.123'); // 3 decimales
    c.enviar();
    expect(c.lineas.at(1).controls.valor.invalid).toBe(true);
    expect(c.enviando).toBe(false); // ninguna petición (verificarHttp lo comprobaría)
  });

  it('un mes que no existe avisa que se creará con la cuota del último periodo', () => {
    const f = montar();
    f.componentInstance.form.controls.periodo.setValue('2026-12');
    expect(texto(f)).toContain('Aún no existe este mes: se creará con la cuota de $1,000,000.00');
  });

  it('guardar: POST con las líneas (cuenta solo en efectivo, comentario recortado) y emite el resultado', () => {
    const f = montar();
    const c = f.componentInstance;
    let emitido: any = null;
    c.guardado.subscribe((r) => (emitido = r));
    c.form.patchValue({ fecha: '2026-10-14', periodo: '2026-09', notas: 'Entrega' });
    c.lineas.at(0).patchValue({ valor: 600000, cuentaFinancieraId: 9 });
    c.agregarLinea();
    const cr = c.lineas.at(1);
    cr.controls.metodo.setValue('CRUCE_CUENTAS');
    cr.patchValue({ valor: 100000.5, personaId: 2, comentarios: ' arreglo ' });

    c.enviar();
    const req = esperar('POST', 'obligaciones-aportes/aportes-diarios');
    expect(req.request.body).toEqual({
      fecha: '2026-10-14',
      periodo: '2026-09',
      notas: 'Entrega',
      detalles: [
        { valor: '600000', metodo: 'EFECTIVO', personaId: 4, cuentaFinancieraId: 9 },
        { valor: '100000.5', metodo: 'CRUCE_CUENTAS', personaId: 2, comentarios: 'arreglo' },
      ],
    });
    req.flush({ aporteDiario: aporte(), periodo: periodo(), transaccionesCreadas: 1, crucesGenerados: 1 });
    expect(emitido.crucesGenerados).toBe(1);
  });

  it('editar: carga las líneas con su id, conserva el método heredado y envía PUT', () => {
    const heredado = aporte({ detalles: [detalle({ id: 5, valor: 1000, metodo: 'Carrera', metodoCanonico: 'OTRO', cuentaFinancieraId: null }), cruce({ id: 6 })] });
    const f = montar({ aporte: heredado });
    const c = f.componentInstance;
    expect(c.editando).toBe(true);
    expect(c.lineas.length).toBe(2);
    expect(c.lineas.at(0).controls.id.value).toBe(5);
    expect(c.metodoHeredado(c.lineas.at(0))).toBe('Carrera');
    expect(c.metodoHeredado(c.lineas.at(1))).toBeNull();
    expect(c.form.controls.fecha.value).toBe('2026-10-14');
    expect(texto(f)).toContain('Editar aporte diario');
    // al editar no se cuenta dos veces el propio aporte: del mes se resta lo que ya aportaba y se suma lo del formulario
    expect(c.proyeccion?.abonadoDespues).toBe(101000.5);

    c.lineas.at(1).controls.comentarios.setValue('arreglo corregido');
    c.enviar();
    const req = esperar('PUT', 'obligaciones-aportes/aportes-diarios/10');
    expect(req.request.body.detalles).toEqual([
      { id: 5, valor: '1000', metodo: 'Carrera', personaId: 4 },
      { id: 6, valor: '100000.5', metodo: 'CRUCE_CUENTAS', personaId: 2, comentarios: 'arreglo corregido' },
    ]);
    req.flush({ aporteDiario: heredado, periodo: periodo(), transaccionesCreadas: 0, crucesGenerados: 1 });
  });

  it('un error del servidor se muestra y no cierra el formulario', () => {
    const f = montar();
    const c = f.componentInstance;
    c.lineas.at(0).controls.valor.setValue(1000);
    c.enviar();
    errorHttp(esperar('POST', 'obligaciones-aportes/aportes-diarios'), 409, { message: 'El cruce con Andrés ya fue pagado' });
    expect(texto(f)).toContain('ya fue pagado');
    expect(c.enviando).toBe(false);
  });

  it('SALDO_A_FAVOR ofrece los meses con excedente y sugiere el primero', () => {
    const f = montar();
    const c = f.componentInstance;
    c.agregarLinea();
    const fila = c.lineas.at(1);
    fila.controls.metodo.setValue('SALDO_A_FAVOR');
    expect(fila.controls.personaId.value).toBe(4);
    expect(fila.controls.origenObligacionMesId.value).toBe(60);
    expect(texto(f)).toContain('Abril 2026 — disponible $245,000.00');
  });
});

// ───────────────────────────── periodo y excedente ─────────────────────────────
describe('FormularioPeriodoCarroComponent', () => {
  afterEach(() => verificarHttp());

  function montar(entradas: Partial<FormularioPeriodoCarroComponent> = {}) {
    configurarTestBed([FormularioPeriodoCarroComponent]);
    const f = TestBed.createComponent(FormularioPeriodoCarroComponent);
    Object.assign(f.componentInstance, { periodos: [periodo()], cuotaBase: 1810000 }, entradas);
    f.detectChanges();
    return f;
  }

  it('un mes nuevo sugiere la cuota del último periodo y se crea', () => {
    const f = montar();
    const c = f.componentInstance;
    expect(c.form.controls.valorCuota.value).toBe(1810000);
    expect(texto(f)).toContain('Mes nuevo');
    let guardado: any = null;
    c.guardado.subscribe((r) => (guardado = r));
    c.form.controls.periodo.setValue('2026-10');
    c.enviar();
    const req = esperar('POST', 'obligaciones-aportes/periodos');
    expect(req.request.body).toEqual({ periodo: '2026-10', valorCuota: '1810000' });
    req.flush({ creado: true, periodo: periodo({ periodo: '2026-10' }) });
    expect(guardado.creado).toBe(true);
  });

  it('un mes existente muestra su cuota y avisa que se actualiza', () => {
    const f = montar({ periodoInicial: '2026-09' });
    expect(f.componentInstance.form.controls.periodo.value).toBe('2026-09');
    expect(f.componentInstance.form.controls.valorCuota.value).toBe(1000000);
    const t = texto(f);
    expect(t).toContain('Ya existe: se actualizará su cuota');
    expect(t).toContain('Septiembre 2026 lleva $700,000.50 abonados');
    expect(t).toContain('Actualizar cuota');
  });

  it('rechaza una cuota con 3 decimales o vacía', () => {
    const f = montar();
    const c = f.componentInstance;
    c.form.controls.valorCuota.setValue('100.555');
    c.enviar();
    expect(c.form.invalid).toBe(true);
    c.form.controls.valorCuota.setValue(null);
    c.enviar();
    expect(c.enviando).toBe(false);
  });
});

describe('FormularioExcedenteComponent', () => {
  afterEach(() => verificarHttp());

  function montar(entradas: Partial<FormularioExcedenteComponent> = {}) {
    configurarTestBed([FormularioExcedenteComponent]);
    const f = TestBed.createComponent(FormularioExcedenteComponent);
    Object.assign(f.componentInstance, { periodos: [conExcedente()], responsableNombre: 'Luis Fernando' }, entradas);
    f.detectChanges();
    return f;
  }

  it('por defecto traslada todo el saldo al mes siguiente', () => {
    const f = montar();
    const c = f.componentInstance;
    expect(c.form.controls.valor.value).toBe(245000);
    expect(c.siguiente).toBe('2026-05');
    expect(texto(f)).toContain('Trasladarlo al mes siguiente (Mayo 2026)');
    let r: any = null;
    c.aplicado.subscribe((x) => (r = x));
    c.enviar();
    const req = esperar('POST', 'obligaciones-aportes/periodos/60/aplicar-excedente');
    expect(req.request.body).toEqual({ destino: 'SIGUIENTE_MES', valor: '245000' });
    req.flush({ destino: 'SIGUIENTE_MES', valorAplicado: 245000, movimientoId: null, periodoDestino: periodo({ periodo: '2026-05' }), periodo: conExcedente() });
    expect(r.valorAplicado).toBe(245000);
  });

  it('cruzar contra el estado de cuenta envía el mes de imputación', () => {
    const f = montar();
    const c = f.componentInstance;
    c.form.patchValue({ destino: 'ESTADO_CUENTA', valor: 45000, periodoImputacion: '2026-10' });
    expect(texto(f)).toContain('Estado de cuenta del mes');
    c.enviar();
    expect(esperar('POST', 'obligaciones-aportes/periodos/60/aplicar-excedente').request.body).toEqual({ destino: 'ESTADO_CUENTA', valor: '45000', periodoImputacion: '2026-10' });
  });

  it('no deja aplicar más de lo disponible', () => {
    const f = montar();
    const c = f.componentInstance;
    c.form.controls.valor.setValue(245000.01);
    c.form.controls.valor.markAsDirty();
    expect(c.excede).toBe(true);
    expect(texto(f)).toContain('Solo hay $245,000.00 disponibles');
    c.enviar();
    expect(c.enviando).toBe(false);
  });

  it('sin meses con saldo a favor avisa y bloquea el envío', () => {
    const f = montar({ periodos: [] });
    expect(texto(f)).toContain('Ningún mes tiene saldo a favor disponible');
    expect((f.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
  });
});
