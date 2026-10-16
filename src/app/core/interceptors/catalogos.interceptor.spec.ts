import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CatalogosService } from '../../services/catalogos.service';
import { catalogosAfectados, catalogosInterceptor } from './catalogos.interceptor';

describe('catalogosAfectados (qué selectores cambian con cada operación)', () => {
  it('las lecturas no cambian nada', () => {
    expect(catalogosAfectados('GET', '/api/cuentas-financieras')).toEqual([]);
    expect(catalogosAfectados('get', 'transacciones')).toEqual([]);
  });

  it('crear o editar cuentas, categorías y personas refresca solo su catálogo', () => {
    expect(catalogosAfectados('POST', '/api/cuentas-financieras')).toEqual(['cuentas']);
    expect(catalogosAfectados('PATCH', '/api/cuentas-financieras/7')).toEqual(['cuentas']);
    expect(catalogosAfectados('DELETE', '/api/categorias/3')).toEqual(['categorias']);
    expect(catalogosAfectados('POST', '/api/personas')).toEqual(['personas']);
  });

  it('las tarjetas (plásticos, edición) refrescan tarjetas, y pagar un extracto también el saldo de las cuentas', () => {
    expect(catalogosAfectados('POST', '/api/tarjetas/4/plasticos/reemplazar')).toEqual(['tarjetas', 'cuentas']);
    expect(catalogosAfectados('PUT', '/api/tarjetas/4')).toEqual(['tarjetas', 'cuentas']);
  });

  it('todo lo que mueve dinero (transacciones, abonos, cobros, aportes, correos) refresca los saldos de las cuentas', () => {
    expect(catalogosAfectados('POST', '/api/transacciones')).toEqual(['cuentas']);
    expect(catalogosAfectados('POST', '/api/ledger/personas/2/abonar')).toEqual(['cuentas']);
    expect(catalogosAfectados('POST', '/api/cobros/reportes/5/aprobar')).toEqual(['cuentas']);
    expect(catalogosAfectados('POST', '/api/obligaciones-aportes/aportes-dia')).toEqual(['cuentas']);
    expect(catalogosAfectados('POST', '/api/notificaciones-correo/productos/asignar')).toEqual(['cuentas', 'tarjetas']);
  });

  it('ignora el prefijo /api, /api/v2, la query y las barras iniciales; rutas ajenas no afectan a nada', () => {
    expect(catalogosAfectados('POST', '/api/v2/cuentas-financieras?x=1')).toEqual(['cuentas']);
    expect(catalogosAfectados('POST', 'cuentas-financieras')).toEqual(['cuentas']);
    expect(catalogosAfectados('POST', '/api/auth/login')).toEqual([]);
    expect(catalogosAfectados('POST', '/api/compras-credito/responsables')).toEqual([]);
    expect(catalogosAfectados('POST', '/api/compras-credito')).toEqual([]);
  });
});

describe('catalogosInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let invalidar: jasmine.Spy;
  const API = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([catalogosInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    invalidar = spyOn(TestBed.inject(CatalogosService), 'invalidar');
  });
  afterEach(() => backend.verify());

  it('tras una operación exitosa que cambia datos invalida los catálogos afectados', () => {
    http.post(`${API}/cuentas-financieras`, { nombre: 'Nequi' }).subscribe();
    backend.expectOne(`${API}/cuentas-financieras`).flush({ id: 9 });
    expect(invalidar).toHaveBeenCalledOnceWith('cuentas');
  });

  it('una operación que falla no invalida nada (los datos no cambiaron)', () => {
    http.post(`${API}/cuentas-financieras`, {}).subscribe({ error: () => undefined });
    backend.expectOne(`${API}/cuentas-financieras`).flush({ message: 'x' }, { status: 400, statusText: 'Bad Request' });
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('las lecturas tampoco invalidan', () => {
    http.get(`${API}/cuentas-financieras`).subscribe();
    backend.expectOne(`${API}/cuentas-financieras`).flush([]);
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('una respuesta vacía (204 al eliminar) cuenta como éxito', () => {
    http.delete(`${API}/categorias/3`).subscribe();
    backend.expectOne(`${API}/categorias/3`).flush(null, { status: 204, statusText: 'No Content' });
    expect(invalidar).toHaveBeenCalledOnceWith('categorias');
  });
});
