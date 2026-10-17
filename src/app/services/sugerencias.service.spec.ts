import { TestBed } from '@angular/core/testing';
import { ComercioHabitual, DEFAULTS_VACIOS, DefaultsFormularios } from '../modelos/sugerencias';
import { configurarTestBed, errorHttp, esperar, http, verificarHttp } from '../testing/erp-testing';
import { SugerenciasService, VIGENCIA_SUGERENCIAS_MS } from './sugerencias.service';

const DEFAULTS: DefaultsFormularios = {
  tarjetaCreditoId: 2, tarjetaDebitoId: 12, cuentaId: 1, cuotas: 1, personaPropiaId: 1, personaAporteIds: [3, 2], ultimaPersonaCompraId: 1, ultimaPersonaAporteId: 2,
};
const COMERCIO: ComercioHabitual = { concepto: 'Didi Food', veces: 71, ultimaFecha: '2026-10-15', cuotas: 1, ultimoValor: 35625, tarjetaId: 2, categoriaId: null, cuentaId: null, personaId: 1 };

describe('SugerenciasService', () => {
  let s: SugerenciasService;
  let ahora: number;

  beforeEach(() => {
    TestBed.resetTestingModule();
    configurarTestBed([], [SugerenciasService]); // el servicio de verdad (por defecto las pruebas usan uno de mentira)
    s = TestBed.inject(SugerenciasService);
    ahora = 1_000_000;
    s.ahora = () => ahora;
  });
  afterEach(() => verificarHttp());

  it('pide los valores por defecto al servidor y los entrega', () => {
    let recibido: DefaultsFormularios | undefined;
    s.defaults().subscribe((d) => (recibido = d));
    esperar('GET', 'sugerencias/formularios').flush(DEFAULTS);
    expect(recibido).toEqual(DEFAULTS);
  });

  it('pide los comercios al servidor', () => {
    let recibido: ComercioHabitual[] | undefined;
    s.comercios().subscribe((c) => (recibido = c));
    esperar('GET', 'sugerencias/comercios').flush([COMERCIO]);
    expect(recibido).toEqual([COMERCIO]);
  });

  it('abrir varios formularios seguidos NO repite la consulta mientras lo aprendido sea reciente', () => {
    const a = jasmine.createSpy('a');
    const b = jasmine.createSpy('b');
    s.defaults().subscribe(a);
    s.defaults().subscribe(b); // aún en vuelo: se comparte la misma petición
    esperar('GET', 'sugerencias/formularios').flush(DEFAULTS);
    ahora += VIGENCIA_SUGERENCIAS_MS - 1;
    const c = jasmine.createSpy('c');
    s.defaults().subscribe(c); // ya respondida y vigente: sin red
    http().expectNone((r) => r.url.endsWith('sugerencias/formularios'));
    expect(a).toHaveBeenCalledOnceWith(DEFAULTS);
    expect(b).toHaveBeenCalledOnceWith(DEFAULTS);
    expect(c).toHaveBeenCalledOnceWith(DEFAULTS);
  });

  it('pasada la vigencia vuelve a preguntar', () => {
    s.comercios().subscribe();
    esperar('GET', 'sugerencias/comercios').flush([COMERCIO]);
    ahora += VIGENCIA_SUGERENCIAS_MS + 1;
    let nuevo: ComercioHabitual[] | undefined;
    s.comercios().subscribe((c) => (nuevo = c));
    esperar('GET', 'sugerencias/comercios').flush([]);
    expect(nuevo).toEqual([]);
  });

  it('invalidar() olvida lo aprendido (tras registrar algo nuevo)', () => {
    s.defaults().subscribe();
    esperar('GET', 'sugerencias/formularios').flush(DEFAULTS);
    s.comercios().subscribe();
    esperar('GET', 'sugerencias/comercios').flush([COMERCIO]);
    s.invalidar();
    s.defaults().subscribe();
    s.comercios().subscribe();
    esperar('GET', 'sugerencias/formularios').flush(DEFAULTS);
    esperar('GET', 'sugerencias/comercios').flush([COMERCIO]);
  });

  it('NUNCA falla: si el servidor no responde entrega valores vacíos y la próxima vez lo intenta de nuevo', () => {
    let d: DefaultsFormularios | undefined;
    let c: ComercioHabitual[] | undefined;
    let error = false;
    s.defaults().subscribe({ next: (x) => (d = x), error: () => (error = true) });
    s.comercios().subscribe({ next: (x) => (c = x), error: () => (error = true) });
    errorHttp(esperar('GET', 'sugerencias/formularios'), 500, {});
    errorHttp(esperar('GET', 'sugerencias/comercios'), 0, null);
    expect(error).toBeFalse();
    expect(d).toEqual(DEFAULTS_VACIOS);
    expect(c).toEqual([]);

    // el fallo no se recuerda: la siguiente consulta va de nuevo al servidor
    let reintento: DefaultsFormularios | undefined;
    s.defaults().subscribe((x) => (reintento = x));
    esperar('GET', 'sugerencias/formularios').flush(DEFAULTS);
    expect(reintento).toEqual(DEFAULTS);
  });
});
