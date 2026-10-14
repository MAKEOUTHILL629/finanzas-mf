import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthServiceService } from './auth-service.service';

/** JWT mínimo (sin firma válida: el frontend solo lee `exp`). */
function jwtConExp(expSegundos: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: expSegundos })}.firma`;
}

describe('AuthServiceService.isAuthenticated', () => {
  const URL = `${environment.apiUrl}/auth/token-is-valid`;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('authToken');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem('authToken');
  });

  it('sin token no llama al backend (evita un 401 inevitable) y responde false', (done) => {
    const auth = TestBed.inject(AuthServiceService);
    auth.isAuthenticated().subscribe((r) => {
      expect(r).toBeFalse();
      done();
    });
    http.expectNone(URL);
  });

  it('con un token vencido localmente tampoco llama al backend y lo descarta', (done) => {
    localStorage.setItem('authToken', jwtConExp(Math.floor(Date.now() / 1000) - 60));
    const auth = TestBed.inject(AuthServiceService);
    auth.isAuthenticated().subscribe((r) => {
      expect(r).toBeFalse();
      expect(localStorage.getItem('authToken')).toBeNull();
      done();
    });
    http.expectNone(URL);
  });

  it('con un token vigente sí valida contra el backend', () => {
    localStorage.setItem('authToken', jwtConExp(Math.floor(Date.now() / 1000) + 3600));
    const auth = TestBed.inject(AuthServiceService);
    let logueado: boolean | undefined;
    auth.isLoggedIn$.subscribe((v) => (logueado = v));
    auth.isAuthenticated().subscribe();
    http.expectOne(URL).flush({ status: 'ok' });
    expect(logueado).toBeTrue();
  });

  it('si el backend rechaza el token (401) descarta la sesión: el 401 no se repite en cada navegación', () => {
    localStorage.setItem('authToken', jwtConExp(Math.floor(Date.now() / 1000) + 3600));
    const auth = TestBed.inject(AuthServiceService);
    let logueado: boolean | undefined;
    let resultado: unknown;
    auth.isLoggedIn$.subscribe((v) => (logueado = v));
    auth.isAuthenticated().subscribe((r) => (resultado = r));
    http.expectOne(URL).flush({ status: 'error', message: 'User not found' }, { status: 401, statusText: 'Unauthorized' });
    expect(resultado).toBeFalse();
    expect(logueado).toBeFalse();
    expect(localStorage.getItem('authToken')).toBeNull();

    // la siguiente comprobación ya no sale a la red
    auth.isAuthenticated().subscribe();
    http.expectNone(URL);
  });

  it('un fallo de red o un 5xx NO cierra la sesión (puede ser transitorio)', () => {
    const token = jwtConExp(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('authToken', token);
    const auth = TestBed.inject(AuthServiceService);
    let logueado: boolean | undefined;
    auth.isLoggedIn$.subscribe((v) => (logueado = v));

    auth.isAuthenticated().subscribe();
    http.expectOne(URL).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    auth.isAuthenticated().subscribe();
    http.expectOne(URL).flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(logueado).toBeTrue();
    expect(localStorage.getItem('authToken')).toBe(token);
  });
});
