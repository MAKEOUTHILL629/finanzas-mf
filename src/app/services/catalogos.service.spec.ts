import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { cuentaItem, persona, tarjetaItem } from '../testing/erp-testing';
import { ApiServicesService } from './api-services.service';
import { CatalogosService, ESPERA_REINTENTO_MS, TTL_CATALOGO_MS } from './catalogos.service';

/** Servicio con reloj controlable para probar el TTL y la espera entre reintentos. */
class CatalogosConReloj extends CatalogosService {
  reloj = 1_000_000;
  protected override ahora(): number {
    return this.reloj;
  }
}

describe('CatalogosService (caché, deduplicación y estados de los selectores)', () => {
  let http: HttpTestingController;
  let s: CatalogosConReloj;
  const URL = `${environment.apiUrl}/lookup`;

  const pendientes = () => http.match((r) => r.method === 'GET' && r.url === URL);
  const unica = () => {
    const todas = pendientes();
    expect(todas.length).withContext('peticiones a lookup').toBe(1);
    return todas[0];
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    s = new CatalogosConReloj(TestBed.inject(ApiServicesService));
  });
  afterEach(() => http.verify());

  it('nace vacío y sin cargar; pedirlo marca «cargando» sin perder nada', () => {
    expect(s.estado('personas')).toEqual({ datos: [], cargando: false, error: null, cargado: false, actualizadoEn: null });
    s.asegurar(['personas']);
    expect(s.estado('personas').cargando).toBeTrue();
    expect(s.estado('cuentas').cargando).toBeFalse(); // solo lo pedido
    expect(unica().request.params.get('tipos')).toBe('personas');
  });

  it('varios catálogos van en UNA sola petición y cada uno recibe lo suyo', () => {
    s.asegurar(['personas', 'cuentas', 'personas']);
    const req = unica();
    expect(req.request.params.get('tipos')).toBe('personas,cuentas');
    req.flush({ personas: [persona(1, 'Felipe')], cuentas: [cuentaItem(3, 'Ahorros')] });
    expect(s.datos('personas').map((p) => p.nombre)).toEqual(['Felipe']);
    expect(s.datos('cuentas').map((c) => c.nombre)).toEqual(['Ahorros']);
    expect(s.estado('personas')).toEqual(jasmine.objectContaining({ cargando: false, cargado: true, error: null, actualizadoEn: s.reloj }));
    expect(s.datos('tarjetas')).toEqual([]);
  });

  it('deduplica: si otro formulario ya lo pidió y sigue en curso no repite la petición', () => {
    s.asegurar(['personas']);
    s.asegurar(['personas']);
    s.asegurar(['personas', 'tarjetas']); // solo tarjetas es nuevo
    const todas = pendientes();
    expect(todas.map((r) => r.request.params.get('tipos'))).toEqual(['personas', 'tarjetas']);
    todas.forEach((r) => r.flush({ personas: [], tarjetas: [] }));
  });

  it('con datos frescos no vuelve a pedir; pasado el TTL sirve lo viejo y actualiza por detrás (stale-while-revalidate)', () => {
    s.asegurar(['personas']);
    unica().flush({ personas: [persona(1, 'Felipe')] });

    s.reloj += TTL_CATALOGO_MS - 1;
    s.asegurar(['personas']);
    http.expectNone(URL);

    s.reloj += 2;
    s.asegurar(['personas']);
    expect(s.estado('personas').cargando).toBeTrue();
    expect(s.datos('personas').length).withContext('lo viejo sigue visible mientras se actualiza').toBe(1);
    unica().flush({ personas: [persona(1, 'Felipe'), persona(2, 'Andrés')] });
    expect(s.datos('personas').length).toBe(2);
    expect(s.estado('personas').cargando).toBeFalse();
  });

  it('si el servidor falla no se pierden los datos anteriores: queda el mensaje y se puede reintentar', () => {
    s.asegurar(['cuentas']);
    unica().flush({ cuentas: [cuentaItem(3, 'Ahorros')] });

    s.recargar(['cuentas']);
    unica().flush({ message: 'boom' }, { status: 500, statusText: 'Error' });
    const e = s.estado('cuentas');
    expect(e.datos.length).toBe(1);
    expect(e.error).toBeTruthy();
    expect(e.cargando).toBeFalse();
    expect(e.cargado).toBeTrue();

    s.recargar(['cuentas']);
    unica().flush({ cuentas: [cuentaItem(3, 'Ahorros'), cuentaItem(4, 'Nequi')] });
    expect(s.estado('cuentas').error).toBeNull();
    expect(s.datos('cuentas').length).toBe(2);
  });

  it('tras un fallo no reintenta solo antes de la espera mínima (nada de ráfagas), y sí después', () => {
    s.asegurar(['tarjetas']);
    unica().flush(null, { status: 0, statusText: 'Unknown Error' });
    expect(s.estado('tarjetas').error).toContain('conexión');

    s.reloj += ESPERA_REINTENTO_MS - 1;
    for (let i = 0; i < 5; i++) s.asegurar(['tarjetas']); // p. ej. un pipe que lo pide en cada ciclo
    http.expectNone(URL);

    s.reloj += 1;
    s.asegurar(['tarjetas']);
    unica().flush({ tarjetas: [tarjetaItem(1, 'Visa')] });
    expect(s.estado('tarjetas').error).toBeNull();
  });

  it('un cuerpo sin el catálogo pedido se trata como error y no pisa datos buenos', () => {
    s.asegurar(['personas']);
    unica().flush({ personas: [persona(1, 'Felipe')] });
    s.recargar(['personas']);
    unica().flush({ cuentas: [] }); // formato inesperado
    expect(s.datos('personas').length).toBe(1);
    expect(s.estado('personas').error).toContain('formato inesperado');
  });

  it('invalidar solo recarga lo que ya estaba cargado (lo demás se cargará completo cuando alguien lo use)', () => {
    s.asegurar(['personas']);
    unica().flush({ personas: [] });

    s.invalidar('cuentas'); // nunca cargado: no pide nada
    http.expectNone(URL);

    s.invalidar('personas', 'cuentas');
    expect(unica().request.params.get('tipos')).toBe('personas');
  });

  it('limpiar vacía todo: otra sesión no debe ver datos de este usuario, ni siquiera de una petición que llega tarde', () => {
    s.asegurar(['personas']);
    const enCurso = unica();
    s.limpiar(); // cierre de sesión con una petición volando
    enCurso.flush({ personas: [persona(1, 'Felipe')] });
    expect(s.datos('personas')).toEqual([]);
    expect(s.estado('personas').cargado).toBeFalse();

    s.asegurar(['personas', 'cuentas']);
    unica().flush({ personas: [persona(1, 'Felipe')], cuentas: [] });
    s.limpiar();
    expect(s.estado('personas')).toEqual({ datos: [], cargando: false, error: null, cargado: false, actualizadoEn: null });
    s.asegurar(['personas']); // vuelve a pedir desde cero
    unica().flush({ personas: [] });
    expect(s.estado('personas').cargado).toBeTrue();
  });

  it('estado$ emite al suscribirse y en cada cambio', () => {
    const estados: boolean[] = [];
    s.estado$('personas').subscribe((e) => estados.push(e.cargando));
    s.asegurar(['personas']);
    unica().flush({ personas: [] });
    expect(estados).toEqual([false, true, false]);
  });
});
