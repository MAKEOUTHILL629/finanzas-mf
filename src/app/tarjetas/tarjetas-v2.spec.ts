/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { LineaTiempo, ProductoLineaTiempo } from '../modelos/linea-tiempo';
import { PlasticoTarjeta, Tarjeta } from '../modelos/tarjeta';
import { API, anchoEscritorio, configurarTestBed, cuentaItem, errorHttp, esperar, esperarTabla, responder, responderCatalogos, tarjetaItem, verificarHttp } from '../testing/erp-testing';
import { opcionesDeCatalogo } from '../shared/ui/select/select.helpers';
import { estadoVacio } from '../shared/ui/filter-bar/filter-bar.types';
import { FormularioNuevaTarjetaComponent, cuerpoNuevaTarjeta, opcionesDeRenovacion, problemaNuevaTarjeta, ValoresNuevaTarjeta } from './formulario-nueva-tarjeta/formulario-nueva-tarjeta.component';
import { FormularioPlasticoComponent, cuerpoHistorico } from './formulario-plastico/formulario-plastico.component';
import { FormularioTarjetaComponent, cambiosDeTarjeta, valoresDeTarjeta } from './formulario-tarjeta/formulario-tarjeta.component';
import { ListaTarjetasComponent, pendientesDeConfigurar } from './lista-tarjetas/lista-tarjetas.component';
import { LineaTiempoProductosComponent } from './linea-tiempo/linea-tiempo.component';
import { barraDe, conteoProductos, descripcionProducto, duracionLegible, filtrarProductos, marcasDeAnio, montoCorto, posicionEnEscala } from './linea-tiempo/linea-tiempo.helpers';
import { conteoTarjetas, estaActiva, filtrarTarjetas } from './tarjetas-filtros';
import { esDebito, etiquetaEstadoPlastico, nombreTarjeta, tipoDe, tonoEstadoPlastico } from './tarjetas.constants';

const plastico = (id: number, ultimos4: string, extra: Partial<PlasticoTarjeta> = {}): PlasticoTarjeta => ({
  id, tarjetaId: 1, ultimos4, esActivo: false, vigenteDesde: null, vigenteHasta: null, motivoReemplazo: null, reemplazaAId: null, notas: null, ...extra,
});

const credito = (extra: Partial<Tarjeta> = {}): Tarjeta => ({
  id: 2, tipo: 'CREDITO', franquicia: 'American Express', cuentaId: null, alias: null, esGenerica: false, ultimos4Activo: '1927', ultimos4Digitos: '1927,0088,9587',
  plasticos: [plastico(3, '1927', { esActivo: true, estado: 'ACTIVA', vigenteDesde: '2024-12-27', tarjetaId: 2 }), plastico(4, '0088', { estado: 'REEMPLAZADA', vigenteDesde: '2024-03-20', vigenteHasta: '2024-06-04', tarjetaId: 2 }), plastico(2, '9587', { estado: 'REEMPLAZADA', vigenteHasta: '2024-03-16', tarjetaId: 2 })],
  diaCorte: 15, diaLimitePago: 5, ...extra,
});
const debito = (extra: Partial<Tarjeta> = {}): Tarjeta => ({
  id: 9, tipo: 'DEBITO', franquicia: 'Débito', alias: 'Débito *3698', cuentaId: 2, esGenerica: false, ultimos4Activo: '7992', ultimos4Digitos: '7992,8949,4278',
  plasticos: [plastico(10, '7992', { esActivo: true, estado: 'ACTIVA', vigenteDesde: '2026-09-19', tarjetaId: 9 }), plastico(8, '8949', { estado: 'REEMPLAZADA', vigenteDesde: '2025-01-05', vigenteHasta: '2025-03-10', tarjetaId: 9 })], ...extra,
});
const generica = (): Tarjeta => ({ id: 11, tipo: 'CREDITO', franquicia: 'Tarjeta de crédito', alias: 'Crédito (sin número)', esGenerica: true, plasticos: [] });

describe('tarjetas — tipo, alias y estado de los plásticos', () => {
  it('nombreTarjeta prefiere el alias; tipoDe y esDebito tratan «sin tipo» como crédito', () => {
    expect(nombreTarjeta(debito())).toBe('Débito *3698');
    expect(nombreTarjeta(credito())).toBe('American Express');
    expect(tipoDe({})).toBe('CREDITO');
    expect(esDebito(debito())).toBeTrue();
    expect(esDebito(credito())).toBeFalse();
    expect(esDebito(undefined)).toBeFalse();
  });

  it('etiqueta y tono del estado de un plástico (con o sin el estado calculado por el servidor)', () => {
    expect(etiquetaEstadoPlastico({ estado: 'ACTIVA', esActivo: true })).toBe('Activa');
    expect(etiquetaEstadoPlastico({ estado: 'REEMPLAZADA', esActivo: false })).toBe('Reemplazada');
    expect(etiquetaEstadoPlastico({ estado: 'INACTIVA', esActivo: false })).toBe('Histórica');
    expect(etiquetaEstadoPlastico({ esActivo: true })).toBe('Activa');
    expect(etiquetaEstadoPlastico({ esActivo: false })).toBe('Histórica');
    expect(tonoEstadoPlastico({ estado: 'ACTIVA', esActivo: true })).toBe('success');
    expect(tonoEstadoPlastico({ estado: 'REEMPLAZADA', esActivo: false })).toBe('info');
    expect(tonoEstadoPlastico({ esActivo: false })).toBe('neutral');
  });

  it('una tarjeta de débito o «sin número» no tiene pendientes de configuración de crédito', () => {
    expect(pendientesDeConfigurar(debito())).toEqual([]);
    expect(pendientesDeConfigurar(generica())).toEqual([]);
    expect(pendientesDeConfigurar(credito({ diaCorte: null }))).toEqual(['día de corte']);
  });
});

describe('filtros de tarjetas', () => {
  const tarjetas = [credito(), debito(), generica(), credito({ id: 3, franquicia: 'Mastercard', ultimos4Activo: null, ultimos4Digitos: '7293', plasticos: [plastico(6, '7293', { estado: 'INACTIVA', vigenteHasta: '2024-03-16', tarjetaId: 3 })] })];
  const ctx = { nombreCuenta: (id: number | null | undefined) => (id === 2 ? 'Bancolombia Principal' : '') };
  const ids = (e: object) => filtrarTarjetas(tarjetas, { ...estadoVacio('todas'), ...e }, ctx).map((t) => t.id);

  it('el segmento separa crédito de débito', () => {
    expect(ids({})).toEqual([2, 9, 11, 3]);
    expect(ids({ segmento: 'credito' })).toEqual([2, 11, 3]);
    expect(ids({ segmento: 'debito' })).toEqual([9]);
  });

  it('activas o históricas: la «sin número» y las que tienen plástico vigente son activas', () => {
    expect(estaActiva(tarjetas[2])).toBeTrue();
    expect(estaActiva(tarjetas[3])).toBeFalse();
    expect(ids({ valores: { estado: 'ACTIVA' } })).toEqual([2, 9, 11]);
    expect(ids({ valores: { estado: 'HISTORICA' } })).toEqual([3]);
  });

  it('busca por nombre, alias, dígitos de cualquier plástico, tipo y nombre de la cuenta (sin tildes)', () => {
    expect(ids({ busqueda: 'american' })).toEqual([2]);
    expect(ids({ busqueda: '8949' })).toEqual([9]); // un plástico archivado también cuenta
    expect(ids({ busqueda: 'principal' })).toEqual([9]);
    expect(ids({ busqueda: 'debito' })).toEqual([9]);
    expect(ids({ busqueda: 'sin numero' })).toEqual([11]);
    expect(ids({ busqueda: 'zzz' })).toEqual([]);
  });

  it('filtra por cuenta y cuenta por segmento con el resto de filtros aplicados', () => {
    expect(ids({ valores: { cuentas: [2] } })).toEqual([9]);
    expect(conteoTarjetas(tarjetas, estadoVacio('debito'), ctx)).toEqual({ todas: 4, credito: 3, debito: 1 });
    expect(conteoTarjetas(tarjetas, { ...estadoVacio('todas'), valores: { estado: 'ACTIVA' } }, ctx)).toEqual({ todas: 3, credito: 2, debito: 1 });
  });
});

describe('selector de tarjetas: el débito no se ofrece en las compras', () => {
  it('opcionesDeCatalogo oculta las de débito salvo que se pidan, y conserva la ya elegida', () => {
    const lista = [tarjetaItem(1, 'Visa', { tipo: 'CREDITO' }), tarjetaItem(2, 'Débito', { tipo: 'DEBITO', etiqueta: 'Débito ··7992' }), tarjetaItem(3, 'Antigua')];
    const base = { filtro: null, etiquetar: null, soloActivas: true, valorActual: null };
    expect(opcionesDeCatalogo('tarjetas', lista, base).map((o) => o.valor)).toEqual([1, 3]);
    expect(opcionesDeCatalogo('tarjetas', lista, { ...base, incluirDebito: true }).map((o) => o.valor)).toEqual([1, 2, 3]);
    expect(opcionesDeCatalogo('tarjetas', lista, { ...base, valorActual: 2 }).map((o) => o.valor)).toEqual([1, 2, 3]);
  });
});

describe('FormularioNuevaTarjetaComponent', () => {
  afterEach(() => verificarHttp());
  const valores = (extra: Partial<ValoresNuevaTarjeta> = {}): ValoresNuevaTarjeta => ({
    tipo: 'DEBITO', cuentaId: 2, ultimos4: '7992', franquicia: '', alias: '', estado: 'ACTIVA', desde: '2026-09-19', hasta: '', plasticoAnteriorId: null, motivo: '', diaCorte: null, diaLimitePago: null, cupoTotal: null, notas: '', ...extra,
  });

  it('el cuerpo solo lleva lo llenado; una de crédito agrega corte, límite y cupo; una renovación no manda cuenta ni estado', () => {
    expect(cuerpoNuevaTarjeta(valores())).toEqual({ tipo: 'DEBITO', ultimos4: '7992', cuentaId: 2, fechaInicioUso: '2026-09-19' });
    expect(cuerpoNuevaTarjeta(valores({ tipo: 'CREDITO', cuentaId: null, franquicia: ' Visa ', alias: ' ', diaCorte: '15', diaLimitePago: 5, cupoTotal: '12000000', notas: ' x ' }))).toEqual({
      tipo: 'CREDITO', ultimos4: '7992', franquicia: 'Visa', fechaInicioUso: '2026-09-19', diaCorte: 15, diaLimitePago: 5, cupoTotal: '12000000', notas: 'x',
    });
    expect(cuerpoNuevaTarjeta(valores({ estado: 'INACTIVA', hasta: '2027-01-31' }))).toEqual({ tipo: 'DEBITO', ultimos4: '7992', cuentaId: 2, estado: 'INACTIVA', fechaFinUso: '2027-01-31', fechaInicioUso: '2026-09-19' });
    expect(cuerpoNuevaTarjeta(valores({ plasticoAnteriorId: '12', motivo: 'ROBO', cuentaId: 99, estado: 'INACTIVA' }))).toEqual({ tipo: 'DEBITO', ultimos4: '7992', plasticoAnteriorId: 12, fechaInicioUso: '2026-09-19', motivo: 'ROBO' });
  });

  it('problemaNuevaTarjeta: dígitos, cuenta obligatoria en débito y fechas coherentes', () => {
    expect(problemaNuevaTarjeta(valores())).toBeNull();
    expect(problemaNuevaTarjeta(valores({ ultimos4: '79' }))).toContain('4 últimos dígitos');
    expect(problemaNuevaTarjeta(valores({ cuentaId: null }))).toContain('cuenta');
    expect(problemaNuevaTarjeta(valores({ tipo: 'CREDITO', cuentaId: null }))).toBeNull(); // en crédito es opcional
    expect(problemaNuevaTarjeta(valores({ cuentaId: null, plasticoAnteriorId: 5 }))).toBeNull(); // la renovación toma la cuenta de la tarjeta
    expect(problemaNuevaTarjeta(valores({ estado: 'INACTIVA', desde: '2026-05-01', hasta: '2026-01-01' }))).toContain('fin');
  });

  it('opcionesDeRenovacion ofrece solo los plásticos activos del mismo tipo', () => {
    const lista = [credito(), debito(), generica()];
    expect(opcionesDeRenovacion(lista, 'CREDITO').map((o) => o.plasticoId)).toEqual([3]);
    expect(opcionesDeRenovacion(lista, 'DEBITO').map((o) => [o.plasticoId, o.etiqueta])).toEqual([[10, 'Débito *3698 ··7992']]);
  });

  function montar(entradas: Record<string, unknown> = {}) {
    configurarTestBed([FormularioNuevaTarjetaComponent]);
    const f = TestBed.createComponent(FormularioNuevaTarjetaComponent);
    for (const [k, v] of Object.entries(entradas)) f.componentRef.setInput(k, v);
    f.detectChanges();
    responderCatalogos({ cuentas: [cuentaItem(2, 'Bancolombia Principal', { ultimos4: '3698' })] });
    f.detectChanges();
    return f;
  }
  const texto = (f: any) => (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  it('abre con el tipo pedido; cambiar a débito pide la cuenta y envía POST', () => {
    const f = montar({ tipoInicial: 'CREDITO' });
    const c = f.componentInstance;
    expect(texto(f)).toContain('Nueva tarjeta');
    expect(texto(f)).toContain('Día de corte'); // solo en crédito
    c.elegirTipo('DEBITO');
    f.detectChanges();
    expect(texto(f)).not.toContain('Día de corte');
    expect(texto(f)).toContain('Elige la cuenta de la tarjeta');

    c.form.patchValue({ ultimos4: '7992' });
    c.enviar(); // sin cuenta
    expect(c.problema).toContain('cuenta');
    expect(c.enviando).toBeFalse();

    c.form.patchValue({ cuentaId: 2, alias: 'Débito *3698' });
    c.enviar();
    const req = esperar('POST', 'tarjetas');
    expect(req.request.body).toEqual(jasmine.objectContaining({ tipo: 'DEBITO', ultimos4: '7992', cuentaId: 2, alias: 'Débito *3698' }));
    let creada: Tarjeta | null = null;
    c.creada.subscribe((t) => (creada = t));
    req.flush(debito());
    expect((creada as Tarjeta | null)?.id).toBe(9);
  });

  it('con tarjetas existentes ofrece «reemplaza a…» y la renovación se anuncia', () => {
    const f = montar({ tarjetas: [credito(), debito()], tipoInicial: 'DEBITO' });
    const c = f.componentInstance;
    expect(c.opcionesRenovacion.length).toBe(1);
    c.form.patchValue({ plasticoAnteriorId: 10, ultimos4: '1234' });
    f.detectChanges();
    expect(c.renueva).toBeTrue();
    expect(texto(f)).toContain('Renovar plástico');
    expect(texto(f)).not.toContain('Cuenta asociada'); // la renovación hereda la cuenta
    c.enviar();
    expect(esperar('POST', 'tarjetas').request.body).toEqual(jasmine.objectContaining({ tipo: 'DEBITO', plasticoAnteriorId: 10, ultimos4: '1234' }));
  });

  it('muestra el error del servidor y no emite creada', () => {
    const f = montar({ tipoInicial: 'CREDITO' });
    const c = f.componentInstance;
    c.form.patchValue({ ultimos4: '1927' });
    c.enviar();
    errorHttp(esperar('POST', 'tarjetas'), 409, { message: 'Los dígitos 1927 ya pertenecen a "American Express"' });
    expect(c.errorServidor).toContain('1927');
    expect(c.enviando).toBeFalse();
  });
});

describe('formulario de edición de tarjeta — alias y cuenta', () => {
  afterEach(() => verificarHttp());

  it('cambiosDeTarjeta envía el alias y la cuenta solo si cambiaron (y null para quitar la cuenta de una de crédito)', () => {
    const t = debito();
    expect(cambiosDeTarjeta(t, valoresDeTarjeta(t))).toEqual({});
    expect(cambiosDeTarjeta(t, { ...valoresDeTarjeta(t), alias: ' Débito principal ', cuentaId: '5' })).toEqual({ alias: 'Débito principal', cuentaId: 5 });
    const c = credito({ cuentaId: 2 });
    expect(cambiosDeTarjeta(c, { ...valoresDeTarjeta(c), cuentaId: null })).toEqual({ cuentaId: null });
  });

  it('una de débito no muestra los campos de crédito y exige la cuenta', () => {
    configurarTestBed([FormularioTarjetaComponent]);
    const f = TestBed.createComponent(FormularioTarjetaComponent);
    f.componentRef.setInput('tarjeta', debito());
    f.detectChanges();
    responderCatalogos({ cuentas: [cuentaItem(2, 'Bancolombia Principal')] });
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(t).toContain('Cuenta asociada');
    expect(t).not.toContain('Día de corte');
    expect(t).not.toContain('Cupo total');
    const c = f.componentInstance;
    c.form.patchValue({ cuentaId: null, alias: 'x' });
    c.enviar();
    expect(c.enviando).toBeFalse(); // sin cuenta no se envía
  });
});

describe('formulario de plástico — plástico anterior (histórico)', () => {
  afterEach(() => verificarHttp());

  it('cuerpoHistorico lleva solo lo llenado', () => {
    expect(cuerpoHistorico({ ultimos4: ' 8949 ', vigenteDesde: '2025-01-05', vigenteHasta: '2025-03-10', motivo: 'PERDIDA', notas: ' ' })).toEqual({ ultimos4: '8949', vigenteDesde: '2025-01-05', vigenteHasta: '2025-03-10', motivo: 'PERDIDA' });
    expect(cuerpoHistorico({ ultimos4: '8949', vigenteDesde: '', vigenteHasta: '', motivo: '', notas: 'n' })).toEqual({ ultimos4: '8949', notas: 'n' });
  });

  it('en modo «anterior» envía POST …/plasticos, no cambia el vigente y rechaza un cierre anterior al inicio', () => {
    configurarTestBed([FormularioPlasticoComponent]);
    const f = TestBed.createComponent(FormularioPlasticoComponent);
    f.componentRef.setInput('tarjeta', credito());
    f.detectChanges();
    const c = f.componentInstance;
    c.elegirModo('anterior');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('No cambia el plástico vigente');
    c.form.patchValue({ ultimos4: '1927' });
    expect(c.efecto.tipo).toBe('YA_ACTIVO'); // ya existe
    c.form.patchValue({ ultimos4: '5555', vigenteDesde: '2023-01-01', vigenteHasta: '2022-01-01' });
    expect(c.cierreAnteriorAlInicio).toBeTrue();
    c.enviar();
    expect(c.enviando).toBeFalse();

    c.form.patchValue({ vigenteHasta: '2023-12-31' });
    let r: any = null;
    c.guardado.subscribe((x) => (r = x));
    c.enviar();
    const req = esperar('POST', 'tarjetas/2/plasticos');
    expect(req.request.body).toEqual({ ultimos4: '5555', vigenteDesde: '2023-01-01', vigenteHasta: '2023-12-31' });
    req.flush([plastico(3, '1927', { esActivo: true }), plastico(9, '5555')]);
    expect(r.historico).toBeTrue();
    expect(r.plasticoActivo.ultimos4).toBe('1927');
  });
});

describe('ListaTarjetasComponent — crédito, débito y filtros', () => {
  afterEach(() => verificarHttp());

  function montar(tarjetas: Tarjeta[]) {
    configurarTestBed([ListaTarjetasComponent]);
    const f = TestBed.createComponent(ListaTarjetasComponent);
    f.detectChanges();
    responderCatalogos({ cuentas: [cuentaItem(2, 'Bancolombia Principal')] });
    responder('tarjetas', tarjetas);
    f.detectChanges();
    return f;
  }

  it('muestra cada tarjeta con su tipo; la de débito dice a qué cuenta pertenece y no trae cifras de crédito', () => {
    const f = montar([credito(), debito(), generica()]);
    const el = f.nativeElement as HTMLElement;
    const texto = el.textContent!.replace(/\s+/g, ' ');
    expect(el.querySelectorAll('article.tarjeta').length).toBe(3);
    expect(texto).toContain('Débito *3698');
    expect(texto).toContain('De la cuenta Bancolombia Principal');
    expect(texto).toContain('Sin número');
    expect(el.querySelectorAll('article.tarjeta')[1].querySelector('.cifras')).toBeNull();
    expect(el.querySelectorAll('article.tarjeta')[0].querySelector('.cifras')).not.toBeNull();
    // el de débito no tiene «Historial» (no hay compras a crédito)
    expect(el.querySelectorAll('article.tarjeta')[1].textContent).not.toContain('Historial');
  });

  it('el segmento Débito y la búsqueda recortan la lista; «Nueva tarjeta» abre el formulario con el tipo del segmento', () => {
    const f = montar([credito(), debito()]);
    const c = f.componentInstance;
    c.alFiltrar({ ...estadoVacio('debito') });
    f.detectChanges();
    expect(c.visibles.map((t) => t.id)).toEqual([9]);
    expect(c.segmentos.map((s) => [s.valor, s.cantidad])).toEqual([['todas', 2], ['credito', 1], ['debito', 1]]);
    c.nueva();
    expect(c.creando).toBeTrue();
    expect(c.tipoNueva).toBe('DEBITO');
    c.alFiltrar({ ...estadoVacio('todas'), busqueda: 'zzz' });
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Ninguna tarjeta coincide');
  });

  it('onCreada agrega una tarjeta nueva y reemplaza la línea si fue una renovación', () => {
    const f = montar([credito()]);
    const c = f.componentInstance;
    c.onCreada(debito());
    expect(c.tarjetas.map((t) => t.id)).toEqual([2, 9]);
    c.onCreada(credito({ ultimos4Activo: '4444' }));
    expect(c.tarjetas.length).toBe(2);
    expect(c.tarjetas[0].ultimos4Activo).toBe('4444');
  });
});

describe('línea de tiempo — helpers', () => {
  it('posicionEnEscala sitúa cada fecha entre 0 y 100 % y recorta los extremos', () => {
    expect(posicionEnEscala('2021-01-01', '2021-01-01', '2023-01-01')).toBe(0);
    expect(posicionEnEscala('2023-01-01', '2021-01-01', '2023-01-01')).toBe(100);
    expect(posicionEnEscala('2022-01-01', '2021-01-01', '2023-01-01')).toBeCloseTo(50, 0);
    expect(posicionEnEscala('2019-01-01', '2021-01-01', '2023-01-01')).toBe(0);
    expect(posicionEnEscala('2030-01-01', '2021-01-01', '2023-01-01')).toBe(100);
    expect(posicionEnEscala(null, '2021-01-01', '2023-01-01')).toBe(0);
  });

  it('barraDe: abierta hasta hoy, ancho mínimo visible y sin inicio no se dibuja', () => {
    expect(barraDe({ desde: '2022-01-01', hasta: null }, '2021-01-01', '2023-01-01')).toEqual(jasmine.objectContaining({ abierta: true, sinFechas: false }));
    expect(barraDe({ desde: '2022-01-01', hasta: null }, '2021-01-01', '2023-01-01').izquierda).toBeCloseTo(50, 0);
    expect(barraDe({ desde: '2022-06-01', hasta: '2022-06-01' }, '2021-01-01', '2023-01-01').ancho).toBeGreaterThanOrEqual(0.6);
    expect(barraDe({ desde: null, hasta: null }, '2021-01-01', '2023-01-01')).toEqual(jasmine.objectContaining({ sinFechas: true, ancho: 0 }));
  });

  it('marcasDeAnio da un primero de enero por año dentro de la escala', () => {
    expect(marcasDeAnio('2021-08-09', '2026-10-16').map((m) => m.anio)).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(marcasDeAnio('2021-08-09', '2026-10-16')[0].posicion).toBeGreaterThan(0);
    expect(marcasDeAnio('2026-10-16', '2026-10-16')).toEqual([]);
  });

  it('duracionLegible y montoCorto', () => {
    expect(duracionLegible('2026-10-01', '2026-10-02', '2026-10-16')).toBe('1 día');
    expect(duracionLegible('2026-07-16', null, '2026-10-16')).toBe('3 meses');
    expect(duracionLegible('2021-08-09', null, '2026-10-16')).toBe('5 años y 2 meses');
    expect(duracionLegible(null, null, '2026-10-16')).toBe('');
    expect(montoCorto(957_550.93)).toBe('$958 mil');
    expect(montoCorto(38_395_548)).toBe('$38 M');
    expect(montoCorto(2_300_000_000)).toBe('$2,3 mil M');
    expect(montoCorto(500)).toBe('$500');
  });
});

const prod = (extra: Partial<ProductoLineaTiempo> = {}): ProductoLineaTiempo => ({
  clave: 'plastico:3', tipo: 'CREDITO', etiqueta: 'Crédito *1927', detalle: 'American Express', ultimos4: '1927', estado: 'ACTIVA', generica: false, desde: '2024-12-27', hasta: null,
  movimientos: 385, monto: 48_742_381, fuente: 'AVISOS', compras: 246, transacciones: 0, avisos: 385, primerUso: '2024-12-27', ultimoUso: '2026-10-15', tarjetaId: 2, plasticoId: 3, cuentaId: null, ...extra,
});
const LINEA: LineaTiempo = {
  desde: '2021-08-09', hasta: '2026-10-16',
  productos: [
    prod({ clave: 'cuenta:2', tipo: 'CUENTA', etiqueta: 'Cuenta *3698', detalle: 'Bancolombia Principal', ultimos4: '3698', desde: '2021-08-09', movimientos: 855, monto: 164_088_740, tarjetaId: null, plasticoId: null, cuentaId: 2, transacciones: 0, compras: 0 }),
    prod({ clave: 'plastico:2', etiqueta: 'Crédito *9587', ultimos4: '9587', estado: 'REEMPLAZADA', desde: '2022-01-04', hasta: '2024-03-16', movimientos: 189, monto: 38_395_548 }),
    prod(),
    prod({ clave: 'plastico:10', tipo: 'DEBITO', etiqueta: 'Débito *7992', detalle: 'Débito · Débito *3698', ultimos4: '7992', desde: '2026-09-19', movimientos: 23, monto: 957_551, compras: 0 }),
    prod({ clave: 'plastico:8', tipo: 'DEBITO', etiqueta: 'Débito *8949', ultimos4: '8949', estado: 'REEMPLAZADA', desde: '2025-01-05', hasta: '2025-03-10', movimientos: 3, monto: 232_798, compras: 0 }),
    prod({ clave: 'cuenta:7', tipo: 'CUENTA', etiqueta: 'Cuenta (sin número)', ultimos4: null, generica: true, estado: 'INACTIVA', desde: '2021-08-27', hasta: '2026-07-22', movimientos: 0, monto: 0, fuente: 'NINGUNA' }),
  ],
  totales: { productos: 6, activos: 3, movimientos: 1500, monto: 100 },
};

describe('línea de tiempo — filtros', () => {
  const ids = (e: object) => filtrarProductos(LINEA.productos, { ...estadoVacio('todos'), ...e }).map((p) => p.clave);

  it('por tipo, estado y texto', () => {
    expect(ids({})).toHaveSize(6);
    expect(ids({ segmento: 'CUENTA' })).toEqual(['cuenta:2', 'cuenta:7']);
    expect(ids({ segmento: 'DEBITO' })).toEqual(['plastico:10', 'plastico:8']);
    expect(ids({ valores: { estado: 'ACTIVA' } })).toEqual(['cuenta:2', 'plastico:3', 'plastico:10']);
    expect(ids({ valores: { estado: 'HISTORICA' } })).toEqual(['plastico:2', 'plastico:8', 'cuenta:7']);
    expect(ids({ busqueda: '7992' })).toEqual(['plastico:10']);
    expect(ids({ busqueda: 'sin numero' })).toEqual(['cuenta:7']);
    expect(conteoProductos(LINEA.productos, estadoVacio('DEBITO'))).toEqual({ todos: 6, CREDITO: 2, DEBITO: 2, CUENTA: 2 });
  });

  it('descripcionProducto resume periodo, estado y movimientos', () => {
    expect(descripcionProducto(LINEA.productos[2], '2026-10-16')).toBe('Crédito *1927 · Activa · 2024-12-27 → hoy (1 año y 10 meses) · 385 movimientos · $49 M');
    expect(descripcionProducto(LINEA.productos[5], '2026-10-16')).toContain('sin movimientos');
  });
});

describe('LineaTiempoProductosComponent', () => {
  afterEach(() => verificarHttp());

  async function montar(datos: LineaTiempo | null = LINEA) {
    configurarTestBed([LineaTiempoProductosComponent]);
    const f = TestBed.createComponent(LineaTiempoProductosComponent);
    anchoEscritorio(f);
    f.detectChanges();
    if (datos) responder('productos-financieros/linea-tiempo', datos);
    await esperarTabla(f);
    return f;
  }
  const texto = (f: any) => (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  it('pinta una barra por producto con su texto, los años de la escala y el resumen', async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.lt-fila').length).toBe(6);
    expect(el.querySelectorAll('.lt-barra').length).toBe(6);
    expect(el.querySelectorAll('.lt-escala .lt-marca').length).toBe(5);
    const t = texto(f);
    for (const esperado of ['Cuenta *3698', 'Crédito *1927', 'Débito *7992', 'Cuenta (sin número)', 'Productos', 'En uso hoy', 'Movimientos', '385 mov.', 'Sin movimientos']) expect(t).toContain(esperado);
    // los que siguen en uso llegan hasta hoy; los históricos no
    expect(el.querySelectorAll('.lt-barra--abierta').length).toBe(3);
  });

  it('un clic abre el detalle del producto (aria-expanded) y otro lo cierra', async () => {
    const f = await montar();
    const cab = (f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.lt-cabecera')[2];
    expect(cab.getAttribute('aria-expanded')).toBe('false');
    cab.click();
    f.detectChanges();
    expect(cab.getAttribute('aria-expanded')).toBe('true');
    expect(texto(f)).toContain('Compras registradas');
    expect(texto(f)).toContain('Las cifras salen de los avisos del banco');
    cab.click();
    f.detectChanges();
    await f.whenStable(); // la salida del panel termina con su animación
    f.detectChanges();
    expect(texto(f)).not.toContain('Compras registradas');
  });

  it('filtra por tipo con la barra de filtros', async () => {
    const f = await montar();
    f.componentInstance.alFiltrar(estadoVacio('DEBITO'));
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelectorAll('.lt-fila').length).toBe(2);
    expect(f.componentInstance.segmentos.map((s: any) => [s.valor, s.cantidad])).toEqual([['todos', 6], ['CREDITO', 2], ['DEBITO', 2], ['CUENTA', 2]]);
  });

  it('error con «Reintentar» y estado vacío', async () => {
    const f = await montar(null);
    errorHttp(esperar('GET', 'productos-financieros/linea-tiempo'), 500, { message: 'x' });
    f.detectChanges();
    expect(texto(f)).toContain('Reintentar');
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.erp-alert--danger button')!.click();
    responder('productos-financieros/linea-tiempo', { desde: '2026-10-16', hasta: '2026-10-16', productos: [], totales: { productos: 0, activos: 0, movimientos: 0, monto: 0 } });
    f.detectChanges();
    expect(texto(f)).toContain('Aún no hay productos');
  });
});
