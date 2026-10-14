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

export const API = environment.apiUrl;

/** Configura TestBed para un componente del módulo ERP: pipes propios, formularios, router y HTTP simulado. */
export function configurarTestBed(declarations: Type<unknown>[], providers: Provider[] = []): void {
  TestBed.configureTestingModule({
    declarations: [...declarations, FormatoMonedaPipe, FormatoFechaPipe, FormatoFechaCortaPipe],
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
