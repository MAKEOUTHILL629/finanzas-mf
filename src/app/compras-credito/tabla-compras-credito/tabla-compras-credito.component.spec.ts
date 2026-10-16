import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ComprasCredito } from '../../modelos/compras-credito';
import { ModalService } from '../../services/modal.service';
import { configurarTestBed, errorHttp, esperar, http, persona, responder, responderCatalogos, tarjetaItem, verificarHttp } from '../../testing/erp-testing';
import { FiltroSeleccion, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';
import { TablaComprasCreditoComponent, tonoEstadoCompra } from './tabla-compras-credito.component';

const compra = (extra: Partial<ComprasCredito>): ComprasCredito => ({
  id: 1,
  concepto: 'Nevera Samsung',
  descripcion: 'Éxito Ibagué',
  valorCompra: 2800000,
  pagoMensual: 233333,
  numeroCuotas: 12,
  fechaCompra: new Date('2026-08-02T12:00:00Z'),
  fechaUltimaCuota: new Date('2027-07-28T12:00:00Z'),
  estado: 'Pendiente',
  tarjeta: 1,
  responsables: '1,2',
  porcentajePago: 100,
  ...extra,
});

const COMPRAS: ComprasCredito[] = [
  compra({ id: 1 }),
  compra({ id: 2, concepto: 'Celular Xiaomi', descripcion: undefined, valorCompra: 900000, pagoMensual: 150000, numeroCuotas: 6, estado: 'Pagado', tarjeta: 2, responsables: '3', porcentajePago: 60 }),
  compra({ id: 3, concepto: 'Unificación de deuda', valorCompra: 5000000, pagoMensual: 300000, estado: 'Refinanciada', responsables: '', porcentajePago: 0 }),
];

const TARJETAS = [tarjetaItem(1, 'Visa', { etiqueta: 'Visa ··1927' }), tarjetaItem(2, 'Amex', { etiqueta: 'Amex ··9587' })];
const PERSONAS = [persona(1, 'Felipe'), persona(2, 'Andrés'), persona(3, 'Papá')];

const esperarResize = () => new Promise((r) => setTimeout(r, 80));

describe('TablaComprasCreditoComponent', () => {
  let f: ComponentFixture<TablaComprasCreditoComponent>;
  let c: TablaComprasCreditoComponent;
  const el = () => f.nativeElement as HTMLElement;
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));
  const filasConcepto = () => qa('tbody tr').map((tr) => tr.querySelector('.concepto')!.textContent!.trim());

  async function crear(): Promise<void> {
    f = TestBed.createComponent(TablaComprasCreditoComponent);
    c = f.componentInstance;
    el().style.display = 'block';
    el().style.width = '1100px';
    f.detectChanges();
  }

  async function cargar(datos: ComprasCredito[] = COMPRAS): Promise<void> {
    responderCatalogos({ tarjetas: TARJETAS, personas: PERSONAS }, { esperadas: 2 });
    responder('compras-credito', datos);
    f.detectChanges();
    await esperarResize();
    f.detectChanges();
  }

  afterEach(() => verificarHttp());

  describe('con datos', () => {
    beforeEach(async () => {
      configurarTestBed([TablaComprasCreditoComponent]);
      await crear();
      await cargar();
    });

    it('lista las compras en la tabla del sistema de diseño y calcula el resumen', () => {
      expect(filasConcepto().sort()).toEqual(['Celular Xiaomi', 'Nevera Samsung', 'Unificación de deuda']);
      expect(c.filtradas.length).toBe(3);
      expect(c.totalValor).toBe(8700000);
      expect(c.totalMensual).toBe(233333); // solo la compra pendiente
      expect(c.pendientes).toBe(1);
      expect(qa('.resumen app-card').length).toBe(3);
    });

    it('los contadores de los estados rápidos suman cada estado', () => {
      expect(c.segmentos.map((s) => [s.valor, s.cantidad])).toEqual([
        ['todas', 3],
        ['pendientes', 1],
        ['pagadas', 1],
        ['refinanciadas', 1],
      ]);
    });

    it('un estado rápido recorta la tabla y el resumen', async () => {
      qa('.fb-segmentos .erp-segmented__item')[2].click();
      f.detectChanges();
      await esperarResize();
      f.detectChanges();
      expect(filasConcepto()).toEqual(['Celular Xiaomi']);
      expect(c.totalValor).toBe(900000);
      expect(c.totalMensual).toBe(0);
    });

    it('filtra por tarjeta, persona y texto combinados', () => {
      c.alFiltrar({ ...estadoVacio('todas'), valores: { tarjetas: [1] } });
      expect(c.filtradas.map((x) => x.id)).toEqual([1, 3]);
      c.alFiltrar({ ...estadoVacio('todas'), busqueda: 'refinanc', valores: { tarjetas: [1] } });
      expect(c.filtradas.map((x) => x.id)).toEqual([3]);
      c.alFiltrar({ ...estadoVacio('todas'), valores: { personas: [3] } });
      expect(c.filtradas.map((x) => x.id)).toEqual([2]);
    });

    it('arma los chips de filtro con los catálogos cargados', () => {
      const porId = (id: string) => c.filtros.find((x) => x.id === id) as FiltroSeleccion;
      expect(porId('personas').opciones!.map((o) => o.etiqueta)).toEqual(['Felipe', 'Andrés', 'Papá']);
      expect(porId('tarjetas').opciones!.map((o) => o.etiqueta)).toEqual(['Visa ··1927', 'Amex ··9587']);
      expect(c.filtros.map((x) => x.id)).toEqual(['personas', 'tarjetas', 'fechaCompra', 'fechaUltimaCuota', 'cuotas', 'sinResponsables']);
    });

    it('un filtro sin resultados muestra el texto de «sin coincidencias» (no el de «aún no hay»)', async () => {
      c.alFiltrar({ ...estadoVacio('todas'), busqueda: 'zzzz' });
      f.detectChanges();
      await esperarResize();
      f.detectChanges();
      expect(el().querySelector('.apt-vacio')!.textContent).toContain('Ninguna compra coincide');
    });

    it('«Actualizar» vuelve a pedir la lista y bloquea la acción mientras tanto', () => {
      c.alAccionar('refrescar');
      expect(c.isRefreshing).toBeTrue();
      expect(c.secundarias.find((a) => a.id === 'refrescar')!.cargando).toBeTrue();
      responder('compras-credito', [COMPRAS[0]]);
      expect(c.isRefreshing).toBeFalse();
      expect(c.filtradas.length).toBe(1);
      expect(c.secundarias.find((a) => a.id === 'refrescar')!.cargando).toBeFalse();
    });

    it('«Nueva compra» y «Carga masiva» abren sus formularios', () => {
      const abrir = spyOn(TestBed.inject(ModalService), 'open');
      c.alAccionar('nueva');
      c.alAccionar('csv');
      expect(abrir.calls.allArgs()).toEqual([['compra-credito-form'], ['csv-upload-form']]);
    });

    it('«Procesar pagos» llama al servidor y recarga la lista', () => {
      c.alAccionar('pagar');
      esperar('POST', 'compras-credito/pagar-productos').flush('ok');
      responder('compras-credito', COMPRAS);
      expect(c.isLoading).toBeFalse();
    });

    it('al abrir una compra navega a su detalle llevando la compra', () => {
      const ir = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      c.irDetalleCompra(COMPRAS[1]);
      expect(ir).toHaveBeenCalledWith(['/compra-credito-detalle', 2], { state: { compra: COMPRAS[1] } });
    });

    it('la insignia de porcentaje distingue completo, parcial y vacío', () => {
      expect(c.clasePorcentaje(100)).toBe('completo');
      expect(c.clasePorcentaje(60)).toBe('parcial');
      expect(c.clasePorcentaje(0)).toBe('vacio');
      expect(c.clasePorcentaje(undefined)).toBe('vacio');
    });
  });

  describe('estados de carga', () => {
    beforeEach(() => configurarTestBed([TablaComprasCreditoComponent]));

    it('si falla la carga muestra el error con «Reintentar» y reintenta', async () => {
      await crear();
      responderCatalogos({}, { esperadas: 2 });
      errorHttp(esperar('GET', 'compras-credito'), 500, { message: 'Se cayó el servidor' });
      f.detectChanges();
      expect(el().querySelector('.erp-alert--danger')!.textContent).toContain('Se cayó el servidor');
      expect(el().querySelector('app-apple-table')).toBeNull();
      (el().querySelector('.erp-alert--danger button') as HTMLButtonElement).click();
      responder('compras-credito', COMPRAS);
      f.detectChanges();
      expect(el().querySelector('.erp-alert--danger')).toBeNull();
      expect(c.filtradas.length).toBe(3);
    });

    it('sin compras invita a registrar la primera', async () => {
      await crear();
      await cargar([]);
      expect(el().querySelector('.apt-vacio')!.textContent).toContain('Aún no hay compras a crédito');
    });

    it('si los catálogos no cargan avisa y permite reintentar', async () => {
      await crear();
      const catalogos = http().match((r) => r.method === 'GET' && r.url.endsWith('/lookup'));
      catalogos.forEach((r) => errorHttp(r, 500, { message: 'Catálogos caídos' }));
      responder('compras-credito', COMPRAS);
      f.detectChanges();
      expect(c.errorCatalogos).toContain('Catálogos caídos');
      expect(el().querySelector('.erp-alert--warning')).not.toBeNull();
    });
  });

  describe('acceso rápido desde el inicio', () => {
    it('con ?accion=nueva abre el formulario y limpia la URL', async () => {
      configurarTestBed([TablaComprasCreditoComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ accion: 'nueva' }) } } }]);
      const navegar = spyOn(Router.prototype, 'navigate').and.resolveTo(true);
      const abrir = spyOn(TestBed.inject(ModalService), 'open');
      await crear();
      await new Promise((r) => setTimeout(r, 10));
      expect(navegar).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { accion: null }, replaceUrl: true }));
      expect(abrir).toHaveBeenCalledWith('compra-credito-form');
      responderCatalogos({}, { esperadas: 2 });
      responder('compras-credito', []);
    });
  });
});

describe('tonoEstadoCompra', () => {
  it('asigna el tono de la insignia según el estado', () => {
    expect(tonoEstadoCompra('Pagado')).toBe('success');
    expect(tonoEstadoCompra('Pendiente')).toBe('warning');
    expect(tonoEstadoCompra('Refinanciada')).toBe('info');
    expect(tonoEstadoCompra('Ajuste Interes')).toBe('neutral');
    expect(tonoEstadoCompra(undefined)).toBe('neutral');
  });
});
