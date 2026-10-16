import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA, Provider, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { FormatoFechaCortaPipe } from '../pipes/formato-fecha-corta.pipe';
import { FormatoFechaPipe } from '../pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '../pipes/formato-moneda.pipe';
import { Catalogos, ItemCategoria, ItemCuenta, ItemPersona, ItemTarjeta } from '../modelos/catalogos';
import { SelectComponent } from '../shared/ui/select/select.component';

export const API = environment.apiUrl;

/** Configura TestBed para un componente del módulo ERP: pipes propios, formularios, router y HTTP simulado. */
export function configurarTestBed(declarations: Type<unknown>[], providers: Provider[] = []): void {
  TestBed.configureTestingModule({
    declarations: [...declarations, FormatoMonedaPipe, FormatoFechaPipe, FormatoFechaCortaPipe, SelectComponent],
    imports: [ReactiveFormsModule, FormsModule, RouterModule.forRoot([])],
    providers: [provideHttpClient(), provideHttpClientTesting(), ...providers],
    schemas: [NO_ERRORS_SCHEMA],
  });
}

export function http(): HttpTestingController {
  return TestBed.inject(HttpTestingController);
}

/** Espera exactamente una petición `metodo` a `ruta` (sin query) y la devuelve. */
export function esperar(metodo: string, ruta: string): TestRequest {
  return http().expectOne((r) => r.method === metodo && r.url === `${API}/${ruta}`);
}

/** Atiende una petición GET con `datos`. */
export function responder(ruta: string, datos: object | null, metodo = 'GET'): TestRequest {
  const req = esperar(metodo, ruta);
  req.flush(datos);
  return req;
}

export function errorHttp(req: TestRequest, status: number, cuerpo: object | null): void {
  req.flush(cuerpo, { status, statusText: 'Error' });
}

/**
 * `afterEach` seguro: verifica que no queden peticiones sin atender, pero solo si el test usó HTTP.
 * (Las pruebas de funciones puras no configuran el TestBed y `http()` lanzaría NullInjectorError.)
 */
export function verificarHttp(): void {
  let controlador: HttpTestingController | null = null;
  try {
    controlador = TestBed.inject(HttpTestingController);
  } catch {
    /* el test no configuró HTTP: nada que verificar */
  }
  controlador?.verify();
}

// ── catálogos de los selectores (`GET /api/lookup`) ──

/** Atiende TODAS las peticiones pendientes a `lookup` con los catálogos dados (los tipos no indicados llegan como arreglos vacíos). */
export function responderCatalogos(datos: Partial<Catalogos> = {}, { esperadas = 1 }: { esperadas?: number } = {}): number {
  const pendientes = http().match((r) => r.method === 'GET' && r.url === `${API}/lookup`);
  if (pendientes.length < esperadas) throw new Error(`Se esperaban ${esperadas} petición(es) a lookup y hay ${pendientes.length}`);
  for (const req of pendientes) {
    const tipos = (req.request.params.get('tipos') ?? 'personas,tarjetas,cuentas,categorias').split(',');
    req.flush(Object.fromEntries(tipos.map((t) => [t, (datos as Record<string, unknown>)[t] ?? []])));
  }
  return pendientes.length;
}

export const persona = (id: number, nombre: string, extra: Partial<ItemPersona> = {}): ItemPersona => ({ id, nombre, iniciales: null, color: null, esPropia: false, tieneUsuario: false, email: null, celular: null, ...extra });
export const cuentaItem = (id: number, nombre: string, extra: Partial<ItemCuenta> = {}): ItemCuenta => ({ id, nombre, tipoCuenta: 'AHORROS', bancoEntidad: null, ultimos4: null, moneda: 'COP', saldoActual: 0, activa: true, esPrincipal: false, ...extra });
export const categoriaItem = (id: number, nombre: string, extra: Partial<ItemCategoria> = {}): ItemCategoria => ({ id, nombre, tipo: 'EGRESO', color: null, icono: null, delSistema: false, ...extra });
export const tarjetaItem = (id: number, franquicia: string, extra: Partial<ItemTarjeta> = {}): ItemTarjeta => ({
  id, nombre: franquicia, franquicia, descripcion: null, ultimos4Activo: null, etiqueta: franquicia, plasticos: [], tasaInteresCompra: null, diaCorte: null, diaLimitePago: null, cupoTotal: null, permiteDolares: false, ...extra,
});
