import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { CompraDePersona, DesgloseTarjeta, DetalleEstadoCuentaPersona, EstadoCuentaPersonas, ResumenPersona } from '../modelos/estado-cuenta-personas';
import { periodoActual } from '../shared/periodo.helper';
import { API, configurarTestBed, errorHttp, http, verificarHttp } from '../testing/erp-testing';
import { DetallePersonaComponent } from './detalle-persona/detalle-persona.component';
import { ListaPersonasComponent } from './lista-personas/lista-personas.component';
import { aPersonaDeAbono, claseEstadoCuota, etiquetaEstadoCuota, nombreTarjeta, segmentosPorTarjeta, textoCuota, textoPorcentaje } from './personas.constants';

const tarjeta = (extra: Partial<DesgloseTarjeta> = {}): DesgloseTarjeta => ({ tarjetaId: 1, tarjeta: 'Visa · Oro', totalMes: 150000, porVencer: 700000, numeroCompras: 2, ...extra });

const compra = (extra: Partial<CompraDePersona> = {}): CompraDePersona => ({
  compraId: 7,
  concepto: 'Nevera',
  fechaCompra: '2026-09-10T00:00:00.000Z',
  valorCompra: 1200000,
  numeroCuotasCompra: 12,
  cuotasDeLaPersona: 12,
  porcentaje: 50,
  plastico: '1927',
  cuotaDelMes: { numero: 2, monto: 50000, fechaPago: '2026-10-31T00:00:00.000Z', estado: 'PENDIENTE', cubierto: 0, pendiente: 50000 },
  restantes: { cuotas: 10, monto: 500000 },
  ...extra,
});

const resumen = (extra: Partial<ResumenPersona> = {}): ResumenPersona => ({
  persona: { id: 2, nombre: 'Andrés Gómez', iniciales: null, color: null },
  periodo: periodoActual(),
  pagoDelMes: 150000,
  pagoDelMesTarjetas: 150000,
  abonosDelMes: 0,
  saldoAnterior: 50000,
  saldoExigible: 200000,
  aPagarAhora: 200000,
  porVencer: 700000,
  porVencerTarjetas: 700000,
  deudaTotal: 900000,
  estado: 'DEBE',
  historicoSinCargar: { cuotas: 0, monto: 0 },
  tieneActividad: true,
  porTarjeta: [tarjeta()],
  ...extra,
});

const detalle = (extra: Partial<DetalleEstadoCuentaPersona> = {}): DetalleEstadoCuentaPersona => ({
  ...resumen(),
  desglosePorTarjeta: [tarjeta({ compras: [compra(), compra({ compraId: 8, concepto: 'Celular', porcentaje: 100, cuotasDeLaPersona: 3, numeroCuotasCompra: 6 })] })],
  cuotasAnterioresPendientes: [],
  otrosCargos: {},
  abonos: { items: [], subtotal: 0 },
  faltanteObligacion: 0,
  sobranteDeAbonos: 0,
  ...extra,
});

const totales = (extra: Partial<EstadoCuentaPersonas['totales']> = {}): EstadoCuentaPersonas['totales'] => ({
  pagoDelMes: 150000,
  aPagarAhora: 200000,
  porVencer: 700000,
  deudaTotal: 900000,
  historicoSinCargar: { cuotas: 0, monto: 0 },
  ...extra,
});

describe('Personas · helpers', () => {
  it('textoCuota explica cuándo solo le tocan las primeras cuotas', () => {
    expect(textoCuota(compra())).toBe('Cuota 2 de 12');
    expect(textoCuota(compra({ cuotasDeLaPersona: 3, cuotaDelMes: { numero: 1, monto: 1, fechaPago: '', estado: 'PENDIENTE', cubierto: 0, pendiente: 1 } }))).toBe('Cuota 1 de 3 (de 12)');
    expect(textoCuota(compra({ cuotaDelMes: null, cuotasDeLaPersona: 3 }))).toBe('3 cuotas');
  });

  it('textoPorcentaje no deja decimales de más', () => {
    expect(textoPorcentaje(50)).toBe('50 %');
    expect(textoPorcentaje(33.5)).toContain('33');
    expect(textoPorcentaje(null)).toBe('0 %');
  });

  it('etiquetas del estado de la cuota', () => {
    expect(etiquetaEstadoCuota('PAGADA')).toBe('Pagada');
    expect(etiquetaEstadoCuota('PARCIAL')).toBe('Pagada en parte');
    expect(etiquetaEstadoCuota(undefined)).toBe('Pendiente');
    expect(claseEstadoCuota('PAGADA')).toBe('erp-badge--success');
  });

  it('segmentosPorTarjeta reparte el mes entre las tarjetas y omite las que no cobran nada', () => {
    const segs = segmentosPorTarjeta([tarjeta({ totalMes: 75000 }), tarjeta({ tarjetaId: 2, tarjeta: 'Mastercard', totalMes: 25000 }), tarjeta({ tarjetaId: 3, tarjeta: 'Amex', totalMes: 0 })]);
    expect(segs.map((s) => [s.tarjeta, s.porcentaje])).toEqual([['Visa · Oro', 75], ['Mastercard', 25]]);
    expect(segmentosPorTarjeta([])).toEqual([]);
  });

  it('nombreTarjeta tiene respaldo cuando la compra no tiene tarjeta', () => {
    expect(nombreTarjeta({ tarjetaId: null, tarjeta: null })).toBe('Sin tarjeta');
    expect(nombreTarjeta({ tarjetaId: 9, tarjeta: null })).toBe('Tarjeta #9');
  });

  it('aPersonaDeAbono propone abonar lo que debe pagar ahora', () => {
    const p = aPersonaDeAbono(resumen());
    expect(p.persona_id).toBe(2);
    expect(p.saldo_total_acumulado).toBe(200000);
  });
});

describe('ListaPersonasComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(datos: EstadoCuentaPersonas | null, estado = 200) {
    configurarTestBed([ListaPersonasComponent, DetallePersonaComponent]);
    const fixture = TestBed.createComponent(ListaPersonasComponent);
    fixture.detectChanges();
    const req = http().expectOne((r) => r.url === `${API}/personas/estado-cuenta` && r.params.get('periodo') === periodoActual());
    if (datos) req.flush(datos);
    else errorHttp(req, estado, { message: 'No disponible' });
    fixture.detectChanges();
    return fixture;
  }

  it('muestra «Total a pagar este mes» y «Deuda total pendiente» de cada persona', () => {
    const fixture = iniciar({ periodo: periodoActual(), personas: [resumen()], totales: totales() });
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Andrés Gómez');
    expect(texto).toContain('Total a pagar este mes');
    expect(texto).toContain('Deuda total pendiente');
    expect(texto).toContain('Visa · Oro');
    expect(fixture.componentInstance.cargando).toBeFalse();
  });

  it('pide las personas sin deuda solo cuando se activa la casilla', () => {
    const fixture = iniciar({ periodo: periodoActual(), personas: [], totales: totales({ pagoDelMes: 0, aPagarAhora: 0, porVencer: 0, deudaTotal: 0 }) });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nadie te debe nada');
    fixture.componentInstance.alternarTodas();
    http().expectOne((r) => r.url === `${API}/personas/estado-cuenta` && r.params.get('todas') === 'true').flush({ periodo: periodoActual(), personas: [resumen({ pagoDelMes: 0, deudaTotal: 0, estado: 'PAZ_Y_SALVO' })], totales: totales() });
    expect(fixture.componentInstance.personas.length).toBe(1);
  });

  it('avisa de las cuotas anteriores sin registrar sin sumarlas', () => {
    const fixture = iniciar({ periodo: periodoActual(), personas: [resumen({ historicoSinCargar: { cuotas: 2, monto: 90000 } })], totales: totales({ historicoSinCargar: { cuotas: 2, monto: 90000 } }) });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 cuotas de meses anteriores');
  });

  it('«Ver desglose» pide el detalle de esa persona y lo muestra por tarjeta', () => {
    const fixture = iniciar({ periodo: periodoActual(), personas: [resumen()], totales: totales() });
    const c = fixture.componentInstance;
    c.alternar(c.personas[0]);
    fixture.detectChanges();
    http().expectOne((r) => r.url === `${API}/personas/2/estado-cuenta` && r.params.get('periodo') === periodoActual()).flush(detalle());
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Nevera');
    expect(texto).toContain('Cuota 2 de 12');
    expect(texto).toContain('Celular');
    c.alternar(c.personas[0]);
    expect(c.abierta).toBeNull();
  });

  it('?persona=ID abre el desglose de esa persona (enlace desde el inicio)', () => {
    configurarTestBed([ListaPersonasComponent, DetallePersonaComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ persona: '2' }) } } }]);
    const fixture = TestBed.createComponent(ListaPersonasComponent);
    fixture.detectChanges();
    http().expectOne((r) => r.url === `${API}/personas/estado-cuenta`).flush({ periodo: periodoActual(), personas: [resumen()], totales: totales() });
    fixture.detectChanges();
    expect(fixture.componentInstance.abierta).toBe(2);
    http().expectOne((r) => r.url === `${API}/personas/2/estado-cuenta`).flush(detalle());
  });

  it('un error al cargar se explica y permite reintentar', () => {
    const fixture = iniciar(null, 500);
    expect(fixture.componentInstance.error).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reintentar');
    fixture.componentInstance.cargar();
    http().expectOne((r) => r.url === `${API}/personas/estado-cuenta`).flush({ periodo: periodoActual(), personas: [], totales: totales() });
    expect(fixture.componentInstance.error).toBeNull();
  });
});

describe('DetallePersonaComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(d: DetalleEstadoCuentaPersona) {
    configurarTestBed([DetallePersonaComponent]);
    const fixture = TestBed.createComponent(DetallePersonaComponent);
    fixture.componentRef.setInput('personaId', 2);
    fixture.componentRef.setInput('periodo', periodoActual());
    fixture.detectChanges();
    http().expectOne((r) => r.url === `${API}/personas/2/estado-cuenta`).flush(d);
    fixture.detectChanges();
    return fixture;
  }

  it('la primera tarjeta llega desplegada con la cuota k de N, el porcentaje y lo que queda', () => {
    const fixture = iniciar(detalle());
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('50 %');
    expect(texto).toContain('Cuota 2 de 12');
    expect(texto).toContain('10 cuotas');
    expect(texto).toContain('Pendiente');
  });

  it('marca las cuotas saldadas y las pagadas en parte', () => {
    const fixture = iniciar(
      detalle({
        desglosePorTarjeta: [
          tarjeta({
            compras: [
              compra({ cuotaDelMes: { numero: 2, monto: 50000, fechaPago: '', estado: 'PAGADA', cubierto: 50000, pendiente: 0 } }),
              compra({ compraId: 8, concepto: 'Celular', cuotaDelMes: { numero: 1, monto: 100000, fechaPago: '', estado: 'PARCIAL', cubierto: 20000, pendiente: 80000 } }),
            ],
          }),
        ],
      })
    );
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Pagada');
    expect(texto).toContain('Pagada en parte');
    expect(texto).toContain('Faltan');
  });

  it('se puede plegar y desplegar una tarjeta', () => {
    const fixture = iniciar(detalle());
    const c = fixture.componentInstance;
    const t = c.detalle!.desglosePorTarjeta[0];
    expect(c.estaAbierta(t)).toBeTrue();
    c.alternar(t);
    expect(c.estaAbierta(t)).toBeFalse();
    c.alternar(t);
    expect(c.estaAbierta(t)).toBeTrue();
  });

  it('lista las cuotas anteriores sin pagar y los otros cargos del mes', () => {
    const fixture = iniciar(
      detalle({
        cuotasAnterioresPendientes: [{ compraId: 7, concepto: 'Nevera', tarjeta: 'Visa · Oro', periodo: '2026-09', numeroCuota: 1, cuotasDeLaCompra: 12, monto: 50000, estado: 'PENDIENTE', pendiente: 50000 }],
        otrosCargos: { prestamos: { subtotal: 200000, items: [{ id: 1 } as never] } },
      })
    );
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Cuotas de meses anteriores sin pagar');
    expect(texto).toContain('Préstamos');
  });

  it('recarga al cambiar el periodo y descarta la respuesta de la petición anterior', () => {
    const fixture = iniciar(detalle());
    fixture.componentRef.setInput('periodo', '2026-01');
    fixture.detectChanges();
    fixture.componentRef.setInput('periodo', '2026-02');
    fixture.detectChanges();
    const pendientes = http().match((r) => r.url === `${API}/personas/2/estado-cuenta`);
    expect(pendientes.length).toBe(2);
    expect(pendientes[0].cancelled).toBeTrue(); // la de enero ya no importa
    pendientes[1].flush(detalle({ periodo: '2026-02' }));
    expect(fixture.componentInstance.detalle?.periodo).toBe('2026-02');
  });

  it('un error se muestra con opción de reintentar', () => {
    configurarTestBed([DetallePersonaComponent]);
    const fixture = TestBed.createComponent(DetallePersonaComponent);
    fixture.componentRef.setInput('personaId', 2);
    fixture.componentRef.setInput('periodo', periodoActual());
    fixture.detectChanges();
    errorHttp(http().expectOne((r) => r.url === `${API}/personas/2/estado-cuenta`), 404, { message: 'Persona 2 no encontrada' });
    fixture.detectChanges();
    expect(fixture.componentInstance.error).toBe('Persona 2 no encontrada');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reintentar');
  });
});
