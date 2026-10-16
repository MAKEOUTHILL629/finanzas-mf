import { TestBed } from '@angular/core/testing';
import { ResumenMensualTarjeta, Transaccion } from '../modelos/erp';
import { ModalService } from '../services/modal.service';
import { periodoActual } from '../shared/periodo.helper';
import { ToastService } from '../shared/toast/toast.service';
import { ItemCuenta } from '../modelos/catalogos';
import { API, configurarTestBed, cuentaItem, errorHttp, esperar, http, responder, responderCatalogos, verificarHttp } from '../testing/erp-testing';
import { ExtractosTarjetasComponent, MODAL_PAGO_EXTRACTO } from './extractos-tarjetas/extractos-tarjetas.component';
import { FormularioPagarExtractoComponent } from './formulario-pagar-extracto/formulario-pagar-extracto.component';

function extracto(extra: Partial<ResumenMensualTarjeta> = {}): ResumenMensualTarjeta {
  return {
    tarjeta_id: 4, franquicia: 'Visa', nombre_tarjeta: 'Oro', dia_corte: 15, dia_limite_pago: 5, periodo_facturacion: '2026-10', total_cuotas_mes: 6,
    total_extracto_cop: 1200000.5, componente_en_usd: 0, todas_trm_confirmadas: true, total_responsabilidad_terceros: 200000.25, total_propio: 1000000.25, ...extra,
  };
}

function pagoPrevio(extra: Partial<Transaccion> = {}): Transaccion {
  return {
    id: 90, owner_user_id: 1, tipo_transaccion: 'PAGO_TARJETA', cuenta_origen_id: 1, cuenta_destino_id: null, tarjeta_pagada_id: 4, categoria_id: null,
    fecha_transaccion: '2026-11-03T15:00:00.000Z', concepto: 'Pago extracto Visa - Oro (2026-10)', moneda_original: 'COP', monto_original: 1200000.5, tasa_cambio: 1,
    monto_cop: 1200000.5, origen_registro: 'MANUAL', estado: 'CONFIRMADO', notas: null, created_at: null, ...extra,
  };
}

describe('ExtractosTarjetasComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(filas: ResumenMensualTarjeta[]): ExtractosTarjetasComponent {
    configurarTestBed([ExtractosTarjetasComponent]);
    const fixture = TestBed.createComponent(ExtractosTarjetasComponent);
    fixture.detectChanges();
    http().expectOne((r) => r.url === `${API}/tarjetas/resumen-mensual` && r.params.get('periodo') === periodoActual()).flush(filas);
    return fixture.componentInstance;
  }

  it('totaliza extracto, parte propia y de terceros', () => {
    const c = iniciar([extracto(), extracto({ tarjeta_id: 5, total_extracto_cop: 0.1, total_propio: 0.1, total_responsabilidad_terceros: 0 }), extracto({ tarjeta_id: 6, total_extracto_cop: 0.2, total_propio: 0.2, total_responsabilidad_terceros: 0 })]);
    expect(c.totales).toEqual({ extracto: 1200000.8, propio: 1000000.55, terceros: 200000.25 });
    expect(c.nombreTarjeta(c.resumenes[0])).toBe('Visa · Oro');
    expect(c.nombreTarjeta(extracto({ franquicia: null, nombre_tarjeta: null, tarjeta_id: 8 }))).toBe('Tarjeta #8');
    expect(c.tieneUsd(extracto({ componente_en_usd: 12.5 }))).toBeTrue();
  });

  it('cambiar de mes vuelve a pedir ese periodo; un valor inválido se ignora', () => {
    const c = iniciar([]);
    c.moverPeriodo(-1);
    const anterior = c.periodo;
    http().expectOne((r) => r.params.get('periodo') === anterior).flush([]);
    c.onPeriodoChange('');
    c.onPeriodoChange('2026-13');
    http().expectNone((r) => r.url.includes('resumen-mensual'));
    expect(c.periodo).toBe(anterior);
    expect(c.esMesActual()).toBeFalse();
    c.irAlMesActual();
    http().expectOne((r) => r.params.get('periodo') === periodoActual()).flush([]);
  });

  it('los parámetros del enlace a las cuotas son mes 1-12 y año', () => {
    const c = iniciar([]);
    c.periodo = '2026-03';
    expect(c.paramsCuotas).toEqual({ mes: 3, year: 2026 });
  });

  it('abrir el pago selecciona la tarjeta y cerrar el modal la descarta', () => {
    const c = iniciar([extracto()]);
    const modal = TestBed.inject(ModalService);
    c.abrirPago(c.resumenes[0]);
    expect(c.seleccionada?.tarjeta_id).toBe(4);
    modal.close();
    expect(c.seleccionada).toBeNull();
  });

  it('tras pagar avisa el monto y la transacción, y recarga el extracto', () => {
    const c = iniciar([extracto()]);
    const exito = spyOn(TestBed.inject(ToastService), 'exito');
    c.onPagado({ transaccionId: 55, tarjetaId: 4, cuentaOrigenId: 1, periodo: '2026-10', montoPagado: 1200000.5 });
    expect(exito).toHaveBeenCalledWith('Extracto pagado: $1,200,000.50. Se registró la transacción #55.');
    http().expectOne((r) => r.url.includes('resumen-mensual')).flush([]);
  });

  it('el error de carga se muestra', () => {
    configurarTestBed([ExtractosTarjetasComponent]);
    const fixture = TestBed.createComponent(ExtractosTarjetasComponent);
    fixture.detectChanges();
    errorHttp(http().expectOne((r) => r.url.includes('resumen-mensual')), 500, {});
    expect(fixture.componentInstance.error).toContain('problema');
    expect(MODAL_PAGO_EXTRACTO).toBe('pagar-extracto-form');
  });
});

/** Cuenta del catálogo de los selectores (`GET /api/lookup`). */
const cuenta = (id: number, saldo: number, moneda = 'COP') => cuentaItem(id, `Cuenta ${id}`, { saldoActual: saldo, moneda });

describe('FormularioPagarExtractoComponent', () => {
  let c: FormularioPagarExtractoComponent;
  afterEach(() => verificarHttp());

  function iniciar(cuentas: ItemCuenta[], transacciones: Transaccion[] = [], resumen = extracto()): void {
    configurarTestBed([FormularioPagarExtractoComponent]);
    const fixture = TestBed.createComponent(FormularioPagarExtractoComponent);
    fixture.componentRef.setInput('resumen', resumen);
    fixture.detectChanges();
    c = fixture.componentInstance;
    responderCatalogos({ cuentas });
    http().expectOne((r) => r.url === `${API}/transacciones` && r.params.get('tipo') === 'PAGO_TARJETA').flush({ total: transacciones.length, limit: 200, offset: 0, items: transacciones });
  }

  it('propone el total del extracto y solo ofrece cuentas en pesos', () => {
    iniciar([cuenta(1, 5000000), cuenta(2, 100, 'USD'), cuenta(3, 10)]);
    expect(c.form.controls.montoPagado.value).toBe(1200000.5);
    expect(c.cuentas.map((x) => x.id)).toEqual([1, 3]);
    expect(c.form.controls.cuentaOrigenId.value).toBeNull(); // hay dos: debe elegir
  });

  it('con una sola cuenta la preselecciona', () => {
    iniciar([cuenta(1, 5000000)]);
    expect(c.form.controls.cuentaOrigenId.value).toBe(1);
  });

  it('sin cuentas no se puede pagar', () => {
    iniciar([]);
    expect(c.cuentas.length).toBe(0);
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
  });

  it('calcula el saldo resultante y avisa si quedaría negativo', () => {
    iniciar([cuenta(1, 1000000)]);
    expect(c.saldoResultante).toBe(-200000.5);
    expect(c.dejaSaldoNegativo).toBeTrue();
    c.form.controls.montoPagado.setValue(1000000);
    expect(c.saldoResultante).toBe(0);
    expect(c.dejaSaldoNegativo).toBeFalse();
    c.form.controls.montoPagado.setValue(1.005);
    expect(c.saldoResultante).toBeNull(); // importe inválido
    c.form.controls.montoPagado.setValue(1200000.5 + 0.1);
  });

  it('exige la confirmación explícita antes de enviar', () => {
    iniciar([cuenta(1, 9000000)]);
    expect(c.form.valid).toBeFalse();
    c.enviar();
    http().expectNone((r) => r.method === 'POST');
    c.form.controls.confirmo.setValue(true);
    expect(c.form.valid).toBeTrue();
  });

  it('detecta un pago previo del MISMO extracto (no anulado) y exige una segunda confirmación', () => {
    iniciar(
      [cuenta(1, 9000000)],
      [
        pagoPrevio(),
        pagoPrevio({ id: 91, estado: 'ANULADO' }), // anulado: no cuenta
        pagoPrevio({ id: 92, tarjeta_pagada_id: 9 }), // otra tarjeta
        pagoPrevio({ id: 93, concepto: 'Pago extracto Visa - Oro (2026-09)' }), // otro periodo
      ]
    );
    expect(c.pagosPrevios.map((t) => t.id)).toEqual([90]);
    c.form.controls.confirmo.setValue(true);
    expect(c.form.valid).toBeFalse();
    c.form.controls.confirmoDuplicado.setValue(true);
    expect(c.form.valid).toBeTrue();
  });

  it('si no se pueden consultar los pagos previos igual permite pagar', () => {
    configurarTestBed([FormularioPagarExtractoComponent]);
    const fixture = TestBed.createComponent(FormularioPagarExtractoComponent);
    fixture.componentRef.setInput('resumen', extracto());
    fixture.detectChanges();
    responderCatalogos({ cuentas: [cuenta(1, 9000000)] });
    errorHttp(http().expectOne((r) => r.url === `${API}/transacciones`), 500, {});
    expect(fixture.componentInstance.pagosPrevios).toEqual([]);
    expect(fixture.componentInstance.cuentas.length).toBe(1);
    expect(fixture.componentInstance.errorServidor).toBeNull();
  });

  it('envía cuenta, periodo del extracto y monto como texto; emite el resultado', () => {
    iniciar([cuenta(1, 9000000)]);
    c.form.patchValue({ montoPagado: 1200000.5, confirmo: true });
    let resultado: unknown;
    c.pagado.subscribe((r) => (resultado = r));
    c.enviar();
    const req = esperar('POST', 'tarjetas/4/pagar-extracto');
    expect(req.request.body).toEqual({ cuentaOrigenId: 1, periodo: '2026-10', montoPagado: '1200000.5' });
    const respuesta = { transaccionId: 55, tarjetaId: 4, cuentaOrigenId: 1, periodo: '2026-10', montoPagado: 1200000.5 };
    req.flush(respuesta);
    expect(resultado).toEqual(respuesta);
  });

  it('muestra el error del SP y no emite pagado', () => {
    iniciar([cuenta(1, 9000000)]);
    c.form.patchValue({ confirmo: true });
    let pagados = 0;
    c.pagado.subscribe(() => pagados++);
    c.enviar();
    errorHttp(esperar('POST', 'tarjetas/4/pagar-extracto'), 404, { message: 'Cuenta financiera 1 no encontrada' });
    expect(c.errorServidor).toBe('Cuenta financiera 1 no encontrada');
    expect(c.enviando).toBeFalse();
    expect(pagados).toBe(0);
  });
});
