import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CandidataRefinanciamiento, ResultadoEjecucion, SimulacionRefinanciamiento } from '../../modelos/refinanciamiento';
import { ModalService } from '../../services/modal.service';
import { cuotaFrancesa } from '../../shared/amortizacion-francesa.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { API, configurarTestBed, errorHttp, esperar, http, persona, responderCatalogos, sugerenciasDe, tarjetaItem, verificarHttp } from '../../testing/erp-testing';
import { MODAL_UNIFICAR_DEUDA, UnificarDeudaComponent } from './unificar-deuda.component';

const candidata = (extra: Partial<CandidataRefinanciamiento>): CandidataRefinanciamiento => ({
  id: 1,
  concepto: 'Nevera Samsung',
  fechaCompra: '2026-03-10',
  valorCompra: 3_000_000,
  numeroCuotas: 12,
  interes: 1.9,
  plasticoUltimos4: '1927',
  esRefinanciamiento: false,
  cuotasPendientes: 8,
  saldoCapital: 2_000_000,
  restantePorPagar: 2_200_000,
  cuotaProxima: 270_000,
  proximoPeriodo: '2026-11',
  responsables: [{ personaId: 1, porcentaje: 100 }],
  ...extra,
});

const CANDIDATAS = [
  candidata({ id: 1 }),
  candidata({ id: 2, concepto: 'Celular Xiaomi', saldoCapital: 1_000_000, restantePorPagar: 1_100_000, cuotaProxima: 150_000, responsables: [{ personaId: 2, porcentaje: 50 }] }),
  candidata({ id: 3, concepto: 'Unificación anterior', esRefinanciamiento: true, saldoCapital: 500_000, restantePorPagar: 520_000, cuotaProxima: 60_000, responsables: [] }),
];

const simulacionDe = (cuotaUsada: number, extra: Partial<SimulacionRefinanciamiento['resultado']> = {}): SimulacionRefinanciamiento => ({
  tarjetaId: 2,
  compraIds: [1, 2],
  cuotaActualCombinada: 420_000,
  responsables: [{ personaId: 1, porcentaje: 66.67, monto: 2_000_100 }, { personaId: 2, porcentaje: 33.33, monto: 999_900 }],
  resultado: {
    saldo: 3_000_000,
    numeroCuotas: 36,
    tasaMensualPct: 1.9,
    tasaEfectivaAnualPct: 25.3,
    tasaInformadaPct: 1.9,
    cuotaCalculada: cuotaUsada,
    cuotaUsada,
    cuotaPactada: null,
    totalAPagar: cuotaUsada * 36,
    interesTotal: cuotaUsada * 36 - 3_000_000,
    cuotaActualCombinada: 420_000,
    diferenciaMensual: 420_000 - cuotaUsada,
    restantePorPagar: 3_300_000,
    diferenciaTotal: 3_300_000 - cuotaUsada * 36,
    cuotas: [{ numeroCuota: 1, fechaPago: '2026-11-30T00:00:00.000Z', saldoRestante: 2_950_000, interesPagado: 57_000, aporteCapital: 50_000, pagoTotal: 107_000, estado: 'Pendiente', periodoFacturacion: '2026-11' }],
    ...extra,
  },
});

describe('UnificarDeudaComponent', () => {
  let f: ComponentFixture<UnificarDeudaComponent>;
  let c: UnificarDeudaComponent;
  const el = () => f.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s);
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));
  const siguiente = () => qa('.uni-pie button').find((b) => /Siguiente|Unificar deuda/.test(b.textContent ?? ''))!;

  beforeEach(() => {
    configurarTestBed([UnificarDeudaComponent], [sugerenciasDe({ tarjetaCreditoId: 2 })]);
  });
  afterEach(() => verificarHttp());

  /** Crea el componente y abre el asistente: pide los catálogos y las compras de la tarjeta sugerida. */
  function abrir(): void {
    f = TestBed.createComponent(UnificarDeudaComponent);
    c = f.componentInstance;
    f.detectChanges();
    TestBed.inject(ModalService).open(MODAL_UNIFICAR_DEUDA);
    f.detectChanges();
    responderCatalogos({ tarjetas: [tarjetaItem(1, 'Visa'), tarjetaItem(2, 'Amex', { etiqueta: 'Amex ··1927' })], personas: [persona(1, 'Felipe'), persona(2, 'Andrés')] }, { esperadas: 1 });
  }

  function responderCandidatas(datos = CANDIDATAS, tarjeta = '2'): void {
    const req = http().expectOne((r) => r.method === 'GET' && r.url === `${API}/refinanciamientos/candidatas`);
    expect(req.request.params.get('tarjetaId')).toBe(tarjeta);
    req.flush(datos);
    f.detectChanges();
  }

  it('al abrirlo elige la tarjeta habitual y lista las compras con su saldo, cuota y responsables', () => {
    abrir();
    responderCandidatas();
    expect(c.tarjetaId).toBe(2);
    const filas = qa('.uni-item');
    expect(filas.length).toBe(3);
    expect(filas[0].textContent).toContain('Nevera Samsung');
    expect(filas[0].textContent).toContain('$2,000,000.00');
    expect(filas[0].textContent).toContain('8 cuotas pendientes');
    expect(filas[0].textContent).toContain('··1927');
    expect(filas[2].textContent).toContain('Unificación anterior');
    expect(qa('.uni-paso--activo')[0].textContent).toContain('Elegir compras');
  });

  it('«Siguiente» espera a que elijas al menos una compra y los totales siguen la selección', () => {
    abrir();
    responderCandidatas();
    expect(siguiente().hasAttribute('disabled')).toBe(true);

    qa('.uni-check')[0].click();
    qa('.uni-check')[1].click();
    f.detectChanges();
    expect(c.totales).toEqual({ cantidad: 2, saldo: 3_000_000, cuotaActual: 420_000, restante: 3_300_000 });
    expect(q('.uni-total')!.textContent).toContain('$3,000,000.00');
    expect(siguiente().hasAttribute('disabled')).toBe(false);

    qa('.uni-check')[0].click();
    f.detectChanges();
    expect(c.totales.saldo).toBe(1_000_000);

    // «Elegir todas» y «Quitar todas»
    qa('.uni-herramientas button')[0].click();
    f.detectChanges();
    expect(c.seleccion.size).toBe(3);
    qa('.uni-herramientas button')[0].click();
    f.detectChanges();
    expect(c.seleccion.size).toBe(0);
  });

  it('cambiar de tarjeta pide otras compras y descarta la selección; una respuesta tardía de la anterior se ignora', () => {
    abrir();
    const primera = http().expectOne((r) => r.url === `${API}/refinanciamientos/candidatas`);
    c.elegirTarjeta(1);
    const segunda = http().expectOne((r) => r.url === `${API}/refinanciamientos/candidatas` && r.params.get('tarjetaId') === '1');
    segunda.flush([candidata({ id: 9, concepto: 'Compra de la Visa' })]);
    primera.flush(CANDIDATAS); // llegó tarde
    f.detectChanges();
    expect(c.candidatas.map((x) => x.id)).toEqual([9]);
    expect(c.seleccion.size).toBe(0);
  });

  it('muestra un error con «Reintentar» si no cargan las compras, y un estado vacío si no hay ninguna', () => {
    abrir();
    errorHttp(http().expectOne((r) => r.url === `${API}/refinanciamientos/candidatas`), 500, { message: 'Falló' });
    f.detectChanges();
    expect(q('.erp-alert--danger')!.textContent).toContain('Falló');
    c.reintentarCandidatas();
    responderCandidatas([]);
    expect(q('app-empty-state')!.textContent).toContain('Nada para unificar');
  });

  describe('paso 2 · simulación', () => {
    function enPaso2(): void {
      abrir();
      responderCandidatas();
      c.alternar(1);
      c.alternar(2);
      c.siguiente();
      f.detectChanges();
    }

    it('calcula sola la cuota con la fórmula francesa y simula (con espera) mandando la tasa que escribiste', fakeAsync(() => {
      enPaso2();
      expect(c.paso).toBe(2);
      c.form.patchValue({ numeroCuotas: 36, tasa: 1.9 });
      f.detectChanges();
      expect(c.form.controls.cuotaMensual.value).toBe(cuotaFrancesa(3_000_000, 1.9, 36)!);

      tick(349);
      http().expectNone(`${API}/refinanciamientos/simular`);
      tick(1);
      const req = esperar('POST', 'refinanciamientos/simular');
      expect(req.request.body).toEqual({ tarjetaId: 2, compraIds: [1, 2], numeroCuotas: 36, tasaMensual: 1.9, fecha: c.form.controls.fecha.value });
      req.flush(simulacionDe(cuotaFrancesa(3_000_000, 1.9, 36)!));
      f.detectChanges();

      const texto = q('.uni-resultado')!.textContent!;
      expect(texto).toContain('Hoy pagas');
      expect(texto).toContain('$420,000.00');
      expect(texto).toContain('Pagarías menos cada mes');
      expect(q('.uni-lectura--ahorro')).not.toBeNull();
      expect(texto).toContain('Ver las 1 cuotas');
      flush();
    }));

    it('una tasa efectiva anual se envía como tal (el servidor la convierte) y muestra su equivalente mensual', fakeAsync(() => {
      enPaso2();
      c.elegirTipoTasa('anual');
      c.form.patchValue({ numeroCuotas: 24, tasa: 25 });
      f.detectChanges();
      expect(c.equivalenteTasa!.etiqueta).toBe('M.V.');
      expect(c.equivalenteTasa!.valor).toBeCloseTo(1.8769, 3);
      tick(350);
      const req = esperar('POST', 'refinanciamientos/simular');
      expect(req.request.body.tasaEfectivaAnual).toBe(25);
      expect(req.request.body.tasaMensual).toBeUndefined();
      req.flush(simulacionDe(160_000));
      flush();
    }));

    it('la cuota que escribes a mano (del banco, con seguros) se envía junto a la tasa y avisa la tasa real', fakeAsync(() => {
      enPaso2();
      c.form.patchValue({ numeroCuotas: 36, tasa: 1.9 });
      tick(350);
      esperar('POST', 'refinanciamientos/simular').flush(simulacionDe(cuotaFrancesa(3_000_000, 1.9, 36)!));

      c.form.controls.cuotaMensual.setValue(118_000);
      tick(350);
      const req = esperar('POST', 'refinanciamientos/simular');
      expect(c.cuotaAMano).toBe(true);
      expect(req.request.body).toEqual(jasmine.objectContaining({ numeroCuotas: 36, tasaMensual: 1.9, cuotaMensual: 118_000 }));
      req.flush(simulacionDe(118_000, { cuotaPactada: 118_000, tasaMensualPct: 2.35, tasaEfectivaAnualPct: 32.1 }));
      f.detectChanges();
      expect(c.avisoTasaReal).toContain('2.35 % mensual');
      expect(q('.erp-alert--info')!.textContent).toContain('seguros y cargos');

      // «Usar la calculada» vuelve a la fórmula
      c.usarCuotaCalculada();
      expect(c.cuotaAMano).toBe(false);
      expect(c.form.controls.cuotaMensual.value).toBe(cuotaFrancesa(3_000_000, 1.9, 36)!);
      tick(350);
      esperar('POST', 'refinanciamientos/simular').flush(simulacionDe(cuotaFrancesa(3_000_000, 1.9, 36)!));
      flush();
    }));

    it('solo con la cuota del banco (sin tasa) también simula', fakeAsync(() => {
      enPaso2();
      c.form.patchValue({ numeroCuotas: 24 });
      c.form.controls.cuotaMensual.setValue(150_000);
      tick(350);
      const req = esperar('POST', 'refinanciamientos/simular');
      expect(req.request.body.cuotaMensual).toBe(150_000);
      expect(req.request.body.tasaMensual).toBeUndefined();
      req.flush(simulacionDe(150_000, { tasaInformadaPct: null, cuotaCalculada: null, cuotaPactada: 150_000, tasaMensualPct: 1.4, tasaEfectivaAnualPct: 18.2 }));
      flush();
    }));

    it('sin cuotas ni tasa no pide nada; un 400 del servidor se muestra y frena el avance', fakeAsync(() => {
      enPaso2();
      tick(500);
      http().expectNone(`${API}/refinanciamientos/simular`);
      expect(siguiente().hasAttribute('disabled')).toBe(true);

      c.form.patchValue({ numeroCuotas: 36, tasa: 1.9 });
      tick(350);
      errorHttp(esperar('POST', 'refinanciamientos/simular'), 400, { message: 'Datos inválidos', errors: { numeroCuotas: ['El número de cuotas debe ser un entero entre 1 y 120'] } });
      f.detectChanges();
      expect(c.errorSimulacion).toBe('Revisa los datos de la simulación.');
      expect(c.erroresCampo['numeroCuotas']).toContain('entre 1 y 120');
      expect(c.puedeAvanzar).toBe(false);
      flush();
    }));
  });

  describe('paso 3 · confirmar', () => {
    function enPaso3(): void {
      abrir();
      responderCandidatas();
      c.alternar(1);
      c.alternar(2);
      c.siguiente();
      c.form.patchValue({ numeroCuotas: 36, tasa: 1.9 });
      tick(350);
      esperar('POST', 'refinanciamientos/simular').flush(simulacionDe(cuotaFrancesa(3_000_000, 1.9, 36)!));
      f.detectChanges();
      c.siguiente();
      f.detectChanges();
    }

    it('resume lo que va a pasar, quién paga la obligación nueva y la ejecuta en una sola llamada', fakeAsync(() => {
      enPaso3();
      expect(c.paso).toBe(3);
      const texto = q('.uni-confirmar')!.textContent!;
      expect(texto).toContain('2 compras');
      expect(texto).toContain('36 cuotas');
      expect(texto).toContain('Refinanciada');
      expect(qa('.uni-quien li').length).toBe(2);
      expect(qa('.uni-quien li')[0].textContent).toContain('66.67 %');

      const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const cerrar = spyOn(TestBed.inject(ModalService), 'close').and.callThrough();
      const avisarCompra = spyOn(TestBed.inject(ModalService), 'notifyCompraCreated').and.callThrough();
      const exito = spyOn(TestBed.inject(ToastService), 'exito');
      c.concepto = ' Unificación octubre ';
      c.descripcion = 'Oferta por llamada';
      siguiente().click();
      const req = esperar('POST', 'refinanciamientos');
      expect(req.request.body).toEqual(jasmine.objectContaining({ tarjetaId: 2, compraIds: [1, 2], numeroCuotas: 36, tasaMensual: 1.9, concepto: 'Unificación octubre', descripcion: 'Oferta por llamada' }));
      expect(c.ejecutando).toBe(true);
      req.flush({ id: 700, numeroCuotas: 36, absorbidas: [{ id: 1 }, { id: 2 }], simulacion: simulacionDe(100) } as unknown as ResultadoEjecucion);

      expect(exito).toHaveBeenCalledWith(jasmine.stringContaining('2 compras en 36 cuotas'));
      expect(cerrar).toHaveBeenCalled();
      expect(avisarCompra).toHaveBeenCalled();
      expect(navegar).toHaveBeenCalledWith(['/compra-credito-detalle', 700]);
      flush();
    }));

    it('si el servidor lo rechaza se muestra el motivo, no se cierra y se puede reintentar', fakeAsync(() => {
      enPaso3();
      const error = spyOn(TestBed.inject(ToastService), 'error');
      siguiente().click();
      errorHttp(esperar('POST', 'refinanciamientos'), 409, { message: 'Las compras 1 no se pueden unificar' });
      f.detectChanges();
      expect(c.ejecutando).toBe(false);
      expect(c.paso).toBe(3);
      expect(q('.uni-confirmar .erp-alert--danger')!.textContent).toContain('no se pueden unificar');
      expect(error).toHaveBeenCalled();
      flush();
    }));

    it('«Atrás» vuelve al paso anterior conservando lo escrito, y reabrir el asistente empieza de cero', fakeAsync(() => {
      enPaso3();
      c.atras();
      expect(c.paso).toBe(2);
      expect(c.form.controls.numeroCuotas.value).toBe(36);
      expect(c.simulacion).not.toBeNull(); // no se vuelve a simular al retroceder
      tick(500);
      http().expectNone(`${API}/refinanciamientos/simular`);

      TestBed.inject(ModalService).open('otro');
      TestBed.inject(ModalService).open(MODAL_UNIFICAR_DEUDA);
      http().match((r) => r.url === `${API}/lookup`).forEach((r) => r.flush({ personas: [], tarjetas: [], cuentas: [], categorias: [] }));
      responderCandidatas(CANDIDATAS, '2');
      expect(c.paso).toBe(1);
      expect(c.seleccion.size).toBe(0);
      expect(c.form.controls.numeroCuotas.value).toBeNull();
      discardPeriodicTasks();
      flush();
    }));
  });
});
