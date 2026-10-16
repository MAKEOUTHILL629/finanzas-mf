import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom, of } from 'rxjs';
import { routes } from '../app-routing.module';
import { CURVA, duracion } from '../shared/motion';
import { deduplicarGetInterceptor, olvidarLecturasEnCurso } from './interceptors/deduplicar-get.interceptor';
import { PrecargaInteligente, puedePrecargar } from './precarga-inteligente.strategy';

describe('deduplicarGetInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    olvidarLecturasEnCurso();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([deduplicarGetInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('dos lecturas idénticas a la vez salen como una sola petición y las dos reciben la respuesta', async () => {
    const a = firstValueFrom(http.get('/api/personas'));
    const b = firstValueFrom(http.get('/api/personas'));
    backend.expectOne('/api/personas').flush([{ id: 1 }]);
    expect(await a).toEqual([{ id: 1 }]);
    expect(await b).toEqual([{ id: 1 }]);
  });

  it('no mezcla lecturas distintas (otra URL u otros parámetros)', () => {
    http.get('/api/personas').subscribe();
    http.get('/api/tarjetas').subscribe();
    http.get('/api/dashboard/summary', { params: { periodo: '2026-10' } }).subscribe();
    http.get('/api/dashboard/summary', { params: { periodo: '2026-11' } }).subscribe();
    const pedidas = backend.match(() => true);
    expect(pedidas.length).toBe(4);
    pedidas.forEach((p) => p.flush({}));
  });

  it('una vez resuelta, la siguiente lectura sale de nuevo (no es un caché: nunca se muestra un dato viejo)', async () => {
    const primera = firstValueFrom(http.get('/api/personas'));
    backend.expectOne('/api/personas').flush([1]);
    await primera;
    const segunda = firstValueFrom(http.get('/api/personas'));
    backend.expectOne('/api/personas').flush([2]);
    expect(await segunda).toEqual([2]);
  });

  it('las escrituras nunca se comparten', () => {
    http.post('/api/cuentas-financieras', { nombre: 'A' }).subscribe();
    http.post('/api/cuentas-financieras', { nombre: 'A' }).subscribe();
    const pedidas = backend.match('/api/cuentas-financieras');
    expect(pedidas.length).toBe(2);
    pedidas.forEach((p) => p.flush({}));
  });

  it('un error llega a todos los que esperaban y libera la clave', async () => {
    const a = lastValueFrom(http.get('/api/x')).catch((e) => e.status);
    const b = lastValueFrom(http.get('/api/x')).catch((e) => e.status);
    backend.expectOne('/api/x').flush('mal', { status: 500, statusText: 'Error' });
    expect(await a).toBe(500);
    expect(await b).toBe(500);
    http.get('/api/x').subscribe();
    backend.expectOne('/api/x').flush({});
  });
});

describe('precarga de pantallas', () => {
  it('se precarga salvo con «ahorro de datos» o conexión lenta', () => {
    expect(puedePrecargar(undefined)).toBeTrue();
    expect(puedePrecargar({ effectiveType: '4g' })).toBeTrue();
    expect(puedePrecargar({ saveData: true, effectiveType: '4g' })).toBeFalse();
    expect(puedePrecargar({ effectiveType: '3g' })).toBeFalse();
    expect(puedePrecargar({ effectiveType: 'slow-2g' })).toBeFalse();
  });

  it('PrecargaInteligente espera su turno y luego carga la ruta', async () => {
    const estrategia = new PrecargaInteligente();
    estrategia.retardoMs = 1;
    let cargas = 0;
    await lastValueFrom(
      estrategia.preload({}, () => {
        cargas++;
        return of('cargada');
      }),
      { defaultValue: null }
    );
    expect(cargas).toBe(1);
  });
});

describe('enrutador con carga diferida', () => {
  it('todas las pantallas, salvo el inicio de sesión, se cargan de forma diferida', () => {
    const conComponente = routes.filter((r) => r.component).map((r) => r.path);
    expect(conComponente).toEqual(['login']);
    expect(routes.filter((r) => r.loadChildren).length).toBeGreaterThanOrEqual(20);
    expect(routes.some((r) => r.path === '' && r.pathMatch === 'full' && !!r.loadChildren)).toBeTrue();
  });
});

describe('movimiento', () => {
  it('las curvas del sistema son cubic-bezier y la duración se expresa en ms', () => {
    for (const c of Object.values(CURVA)) expect(c).toMatch(/^cubic-bezier\(/);
    expect(duracion(300)).toMatch(/^(0|300)ms$/);
  });
});
