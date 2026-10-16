import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { HistorialTarjeta, PlasticoTarjeta, Tarjeta } from '../modelos/tarjeta';
import { API, configurarTestBed, errorHttp, esperar, responder, verificarHttp } from '../testing/erp-testing';
import { FormularioPlasticoComponent, cuerpoReemplazo, efectoDelReemplazo } from './formulario-plastico/formulario-plastico.component';
import { HistorialTarjetaComponent, hayMas, resumenResponsables } from './historial-tarjeta/historial-tarjeta.component';
import { ListaTarjetasComponent } from './lista-tarjetas/lista-tarjetas.component';
import { esCompraRetroactiva, etiquetaMotivo, etiquetaTarjetaActiva, nombreTarjeta, plasticoParaFecha, plasticosArchivados, terminacion, vigenciaLegible } from './tarjetas.constants';

const plastico = (id: number, ultimos4: string, extra: Partial<PlasticoTarjeta> = {}): PlasticoTarjeta => ({
  id, tarjetaId: 4, ultimos4, esActivo: false, vigenteDesde: null, vigenteHasta: null, motivoReemplazo: null, reemplazaAId: null, notas: null, ...extra,
});
const amex = (extra: Partial<Tarjeta> = {}): Tarjeta => {
  const plasticos = [
    plastico(3, '1927', { esActivo: true, vigenteDesde: '2024-12-27', reemplazaAId: 2 }),
    plastico(2, '0088', { vigenteDesde: '2024-03-20', vigenteHasta: '2024-06-04', reemplazaAId: 1, motivoReemplazo: 'PERDIDA' }),
    plastico(1, '9587', { vigenteHasta: '2024-03-16' }),
  ];
  return { id: 4, franquicia: 'American Express', diaCorte: 15, diaLimitePago: 5, cupoTotal: 12000000, tasaInteresCompra: 1.88, permiteDolares: false,
    ultimos4Digitos: '1927,0088,9587', ultimos4Activo: '1927', plasticoActivo: plasticos[0], plasticos, ...extra };
};

describe('Tarjetas · plásticos — lógica', () => {
  it('terminacion / nombre / etiqueta del selector muestran la franquicia y el plástico ACTIVO', () => {
    expect(terminacion('1927')).toBe('··1927');
    expect(terminacion(null)).toBe('');
    expect(nombreTarjeta({ id: 3, franquicia: 'Visa', descripcion: 'Oro' })).toBe('Visa · Oro');
    expect(nombreTarjeta({ id: 3 })).toBe('Tarjeta #3');
    expect(etiquetaTarjetaActiva(amex())).toBe('American Express ··1927');
    expect(etiquetaTarjetaActiva({ id: 9, franquicia: 'Codensa' })).toBe('Codensa');
    expect(plasticosArchivados(amex()).map((p) => p.ultimos4)).toEqual(['0088', '9587']);
    expect(etiquetaMotivo('PERDIDA')).toBe('Pérdida');
    expect(etiquetaMotivo(null)).toBe('');
  });

  it('vigenciaLegible resume el rango de cada plástico', () => {
    expect(vigenciaLegible(plastico(1, '1111', { esActivo: true, vigenteDesde: '2024-12-27' }))).toBe('Desde 27/12/2024');
    expect(vigenciaLegible(plastico(1, '1111', { vigenteDesde: '2024-03-20', vigenteHasta: '2024-06-04' }))).toBe('20/03/2024 – 04/06/2024');
    expect(vigenciaLegible(plastico(1, '1111', { vigenteHasta: '2024-03-16' }))).toBe('Hasta 16/03/2024');
    expect(vigenciaLegible(plastico(1, '1111', { esActivo: true }))).toBe('Vigente');
    expect(vigenciaLegible(plastico(1, '1111'))).toBe('Vigencia sin registrar');
  });

  it('plasticoParaFecha elige el plástico que regía en la fecha (igual que el servidor)', () => {
    const t = amex();
    const u4 = (fecha: string | null) => plasticoParaFecha(t.plasticos as PlasticoTarjeta[], fecha)?.ultimos4;
    expect(u4('2023-05-01')).toBe('9587'); // inicio desconocido = el más antiguo
    expect(u4('2024-04-01')).toBe('0088');
    expect(u4('2024-09-01')).toBe('0088'); // hueco sin avisos: sigue el último conocido
    expect(u4('2026-10-15')).toBe('1927');
    expect(u4(null)).toBe('1927');
    expect(plasticoParaFecha([], '2026-01-01')).toBeNull();
    expect(plasticoParaFecha([plastico(9, '9491', { esActivo: true })], '2020-01-01')?.ultimos4).toBe('9491');
  });

  it('esCompraRetroactiva: solo si es anterior al plástico activo y hay plásticos anteriores', () => {
    expect(esCompraRetroactiva(amex(), '2026-10-01')).toBeFalse();
    expect(esCompraRetroactiva(amex(), '2024-12-27')).toBeFalse();
    expect(esCompraRetroactiva(amex(), '2024-05-01')).toBeTrue();
    expect(esCompraRetroactiva(amex({ plasticos: [plastico(3, '1927', { esActivo: true, vigenteDesde: '2024-12-27' })] }), '2020-01-01')).toBeFalse(); // sin plásticos anteriores
    expect(esCompraRetroactiva(amex({ plasticoActivo: null, plasticos: [plastico(3, '1927', { esActivo: true })] }), '2020-01-01')).toBeFalse(); // inicio desconocido
    expect(esCompraRetroactiva(null, '2020-01-01')).toBeFalse();
    expect(esCompraRetroactiva(amex(), null)).toBeFalse();
  });

  it('efectoDelReemplazo avisa si los dígitos son nuevos, de uno archivado o del activo; el cuerpo solo lleva lo llenado', () => {
    const ps = amex().plasticos as PlasticoTarjeta[];
    expect(efectoDelReemplazo(ps, '5555').tipo).toBe('NUEVO');
    expect(efectoDelReemplazo(ps, '9587').tipo).toBe('REACTIVA');
    expect(efectoDelReemplazo(ps, '1927').tipo).toBe('YA_ACTIVO');
    expect(cuerpoReemplazo({ ultimos4: ' 5555 ', vigenteDesde: '2026-10-01', motivo: 'ROBO', notas: ' ' })).toEqual({ ultimos4: '5555', vigenteDesde: '2026-10-01', motivo: 'ROBO' });
    expect(cuerpoReemplazo({ ultimos4: '5555', vigenteDesde: '', motivo: '', notas: 'perdida' })).toEqual({ ultimos4: '5555', notas: 'perdida' });
  });

  it('resumenResponsables y hayMas', () => {
    expect(resumenResponsables([{ personaId: 2, nombre: 'Andrés Gómez', porcentaje: 50, cuotas: 3 }, { personaId: null, nombre: null, porcentaje: null, cuotas: null }])).toBe('Andrés 50 %, Persona');
    expect(hayMas({ paginacion: { pagina: 1, limite: 100, total: 250 } }, 100)).toBeTrue();
    expect(hayMas({ paginacion: { pagina: 3, limite: 100, total: 250 } }, 250)).toBeFalse();
    expect(hayMas(null, 0)).toBeFalse();
  });
});

describe('Tarjetas · plásticos — pantallas', () => {
  afterEach(() => verificarHttp());

  it('la lista muestra el plástico activo, los anteriores archivados y las acciones de reemplazo e historial', () => {
    configurarTestBed([ListaTarjetasComponent]);
    const f = TestBed.createComponent(ListaTarjetasComponent);
    f.detectChanges();
    responder('tarjetas', [amex(), { id: 1, franquicia: 'Mastercard', ultimos4Digitos: '9491', ultimos4Activo: '9491', plasticos: [plastico(7, '9491', { esActivo: true, tarjetaId: 1 })], plasticoActivo: plastico(7, '9491', { esActivo: true, tarjetaId: 1 }) }]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const texto = el.textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Plástico activo ··1927');
    expect(texto).toContain('··0088');
    expect(texto).toContain('··9587');
    expect(texto).toContain('Plástico activo ··9491');
    expect(el.querySelectorAll('.plastico-chip').length).toBe(2); // solo la Amex tiene plásticos anteriores
    expect(el.querySelectorAll('a[href="/tarjetas/4"]').length).toBe(1);
    expect(texto).toContain('Reemplazo');
  });

  it('registrar un reemplazo actualiza la tarjeta en la lista sin recargar y confirma que el historial no cambió', () => {
    configurarTestBed([ListaTarjetasComponent]);
    const f = TestBed.createComponent(ListaTarjetasComponent);
    f.detectChanges();
    responder('tarjetas', [amex()]);
    const c = f.componentInstance;
    c.registrarReemplazo(c.tarjetas[0]);
    expect(c.reemplazando?.id).toBe(4);
    const nuevo = plastico(4, '5555', { esActivo: true, vigenteDesde: '2026-10-01', reemplazaAId: 3 });
    c.onPlasticoGuardado({ plasticoActivo: nuevo, plasticoAnterior: plastico(3, '1927', { vigenteHasta: '2026-09-30' }), plasticos: [nuevo, plastico(3, '1927', { vigenteHasta: '2026-09-30' }), plastico(2, '0088')] });
    expect(c.tarjetas[0].ultimos4Activo).toBe('5555');
    expect(c.tarjetas[0].plasticoActivo?.id).toBe(4);
    expect(c.tarjetas[0].ultimos4Digitos).toBe('5555,1927,0088');
  });

  it('el formulario de reemplazo valida, avisa de lo que va a pasar y envía POST sin tocar nada más', () => {
    configurarTestBed([FormularioPlasticoComponent]);
    const f = TestBed.createComponent(FormularioPlasticoComponent);
    f.componentRef.setInput('tarjeta', amex());
    f.detectChanges();
    const c = f.componentInstance;
    const texto = () => (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(texto()).toContain('tus compras, cuotas pendientes y responsables no cambian');
    expect(texto()).toContain('··1927');

    c.enviar();
    expect(c.form.invalid).toBeTrue(); // sin dígitos

    c.form.patchValue({ ultimos4: '1927' });
    f.detectChanges();
    expect(c.efecto.tipo).toBe('YA_ACTIVO');
    expect(texto()).toContain('Ese ya es el plástico activo');
    c.enviar();
    http_sinPeticiones();

    c.form.patchValue({ ultimos4: '9587' });
    f.detectChanges();
    expect(texto()).toContain('se volverá a activar');

    c.form.patchValue({ ultimos4: '5555', vigenteDesde: '2024-01-01' }); // anterior al inicio del plástico activo (2024-12-27)
    expect(c.inicioAnteriorAlActivo).toBeTrue();
    c.enviar();
    http_sinPeticiones();

    let guardado: unknown = null;
    c.guardado.subscribe((r) => (guardado = r));
    c.form.patchValue({ ultimos4: '5555', vigenteDesde: '2026-10-01', motivo: 'ROBO', notas: ' ' });
    c.enviar();
    const req = esperar('POST', 'tarjetas/4/plasticos/reemplazar');
    expect(req.request.body).toEqual({ ultimos4: '5555', vigenteDesde: '2026-10-01', motivo: 'ROBO' });
    const respuesta = { plasticoActivo: plastico(9, '5555', { esActivo: true }), plasticoAnterior: plastico(3, '1927'), plasticos: [] };
    req.flush(respuesta);
    expect(guardado).toEqual(respuesta);
    expect(c.enviando).toBeFalse();
  });

  it('si el servidor rechaza el reemplazo (409) muestra el motivo y deja corregir', () => {
    configurarTestBed([FormularioPlasticoComponent]);
    const f = TestBed.createComponent(FormularioPlasticoComponent);
    f.componentRef.setInput('tarjeta', amex());
    f.detectChanges();
    const c = f.componentInstance;
    c.form.patchValue({ ultimos4: '1234' });
    c.enviar();
    errorHttp(esperar('POST', 'tarjetas/4/plasticos/reemplazar'), 409, { message: 'Los dígitos 1234 ya pertenecen a "Bancolombia"' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('ya pertenecen a "Bancolombia"');
    expect(c.enviando).toBeFalse();
  });

  describe('historial unificado', () => {
    const historial = (extra: Partial<HistorialTarjeta> = {}): HistorialTarjeta => ({
      tarjeta: { id: 4, franquicia: 'American Express', descripcion: null },
      plasticos: amex().plasticos as PlasticoTarjeta[],
      filtro: { plasticoId: null, desde: null, hasta: null },
      totales: { compras: 2, valorCompras: 1500000, saldoPendiente: 400000.5 },
      porPlastico: [],
      paginacion: { pagina: 1, limite: 100, total: 2 },
      compras: [
        { id: 11, concepto: 'Nevera', fechaCompra: '2024-02-10', valorCompra: 1200000, monedaOriginal: 'COP', numeroCuotas: 12, cuotasPendientes: 0, saldoPendiente: 0, proximaCuota: null, estado: 'Pagado',
          plastico: { id: 1, ultimos4: '9587', esActivo: false }, plasticoInferido: true, responsables: [{ personaId: 2, nombre: 'Andrés Gómez', porcentaje: 50, cuotas: 12 }] },
        { id: 12, concepto: 'Didi', fechaCompra: '2026-10-13', valorCompra: 300000, monedaOriginal: 'COP', numeroCuotas: 3, cuotasPendientes: 2, saldoPendiente: 400000.5, proximaCuota: '2026-11-30', estado: 'Pendiente',
          plastico: { id: 3, ultimos4: '1927', esActivo: true }, plasticoInferido: false, responsables: [] },
      ],
      ...extra,
    });
    const ruta = { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '4' })) } };

    it('pinta las compras de todos los plásticos con su badge, los totales y los filtros por plástico', () => {
      configurarTestBed([HistorialTarjetaComponent], [ruta]);
      const f = TestBed.createComponent(HistorialTarjetaComponent);
      f.detectChanges();
      responder('tarjetas/4/historial', historial());
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      const texto = el.textContent!.replace(/\s+/g, ' ');
      expect(texto).toContain('Historial · American Express');
      expect(texto).toContain('Nevera');
      expect(texto).toContain('Didi');
      expect(texto).toContain('$1,500,000.00');
      expect(texto).toContain('$400,000.50');
      expect(texto).toContain('Andrés 50 %');
      expect(el.querySelectorAll('.plastico-badge').length).toBe(2);
      expect(el.querySelectorAll('.plastico-badge--inferido').length).toBe(1); // la deducida por fecha se distingue
      expect(el.querySelectorAll('.chip').length).toBe(4); // «Todos» + 3 plásticos
      expect(el.querySelector('a[href="/compra-credito-detalle/11"]')).not.toBeNull();
    });

    it('filtrar por plástico vuelve a pedir el historial con plasticoId; cargar más pide la página siguiente', () => {
      configurarTestBed([HistorialTarjetaComponent], [ruta]);
      const f = TestBed.createComponent(HistorialTarjetaComponent);
      f.detectChanges();
      responder('tarjetas/4/historial', historial({ paginacion: { pagina: 1, limite: 100, total: 3 } }));
      const c = f.componentInstance;
      expect(c.masPorTraer).toBeTrue();

      c.cargarMas();
      const masReq = esperar('GET', 'tarjetas/4/historial');
      expect(masReq.request.params.get('pagina')).toBe('2');
      masReq.flush(historial({ paginacion: { pagina: 2, limite: 100, total: 3 }, compras: [{ ...(historial().compras[1]), id: 13, concepto: 'Otra' }] }));
      expect(c.compras.map((x) => x.id)).toEqual([11, 12, 13]);
      expect(c.masPorTraer).toBeFalse();

      c.filtrarPlastico(1);
      const req = esperar('GET', 'tarjetas/4/historial');
      expect(req.request.params.get('plasticoId')).toBe('1');
      expect(req.request.params.get('limite')).toBe('100');
      req.flush(historial({ compras: [historial().compras[0]], filtro: { plasticoId: 1, desde: null, hasta: null }, totales: { compras: 1, valorCompras: 1200000, saldoPendiente: 0 } }));
      expect(c.compras.length).toBe(1);
      expect(c.filtrado).toBeTrue();
      c.filtrarPlastico(1); // mismo filtro: no repite la petición
      c.limpiarFiltros();
      esperar('GET', 'tarjetas/4/historial').flush(historial());
      expect(c.filtrado).toBeFalse();
    });

    it('muestra un error con reintento y el estado vacío', () => {
      configurarTestBed([HistorialTarjetaComponent], [ruta]);
      const f = TestBed.createComponent(HistorialTarjetaComponent);
      f.detectChanges();
      errorHttp(esperar('GET', 'tarjetas/4/historial'), 500, { message: 'boom' });
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).textContent).toContain('Reintentar');
      f.componentInstance.cargar();
      esperar('GET', 'tarjetas/4/historial').flush(historial({ compras: [], totales: { compras: 0, valorCompras: 0, saldoPendiente: 0 }, paginacion: { pagina: 1, limite: 100, total: 0 } }));
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).textContent).toContain('Aún no hay compras en esta tarjeta');
    });
  });
});

/** Ninguna petición HTTP pendiente (el formulario no debe enviar nada si es inválido). */
function http_sinPeticiones(): void {
  verificarHttp();
  void API;
}
