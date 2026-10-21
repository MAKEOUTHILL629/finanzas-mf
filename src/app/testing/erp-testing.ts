import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA, Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { FormatoFechaCortaPipe } from '../pipes/formato-fecha-corta.pipe';
import { FormatoFechaPipe } from '../pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '../pipes/formato-moneda.pipe';
import { of } from 'rxjs';
import { Catalogos, ItemCategoria, ItemCuenta, ItemPersona, ItemTarjeta } from '../modelos/catalogos';
import { ComercioHabitual, DEFAULTS_VACIOS, DefaultsFormularios } from '../modelos/sugerencias';
import { SugerenciasService } from '../services/sugerencias.service';
import { AccionesComponent } from '../shared/ui/acciones/acciones.component';
import { AppleTableComponent } from '../shared/ui/apple-table/apple-table.component';
import { AccionesFilaDirective, CeldaTablaDirective, TarjetaFilaDirective } from '../shared/ui/apple-table/apple-table.types';
import { FilterBarComponent } from '../shared/ui/filter-bar/filter-bar.component';
import { BadgeComponent } from '../shared/ui/badge/badge.component';
import { ButtonComponent } from '../shared/ui/button/button.component';
import { CampoEditableComponent } from '../shared/ui/campo-editable/campo-editable.component';
import { CardComponent } from '../shared/ui/card/card.component';
import { ContadorComponent } from '../shared/ui/contador/contador.component';
import { SkeletonComponent } from '../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../shared/ui/empty-state/empty-state.component';
import { FieldComponent, InputDirective } from '../shared/ui/field/field.component';
import { LogoComponent } from '../shared/ui/logo/logo.component';
import { PageHeaderComponent } from '../shared/ui/page-header/page-header.component';
import { SearchableSelectComponent } from '../shared/ui/searchable-select/searchable-select.component';
import { SelectComponent } from '../shared/ui/select/select.component';
import { SelectProductoComponent } from '../shared/ui/select-producto/select-producto.component';
import { SelectorTagsComponent } from '../shared/ui/selector-tags/selector-tags.component';
import { PropagarSimilaresModalComponent } from '../compras-credito/propagar-similares-modal/propagar-similares-modal.component';
import { TableDirective } from '../shared/ui/table/table.directive';
import { ThemeToggleComponent } from '../shared/ui/theme-toggle/theme-toggle.component';
import { TooltipDirective } from '../shared/ui/tooltip/tooltip.directive';

/** Componentes base del sistema de diseño: las plantillas los usan, así que toda prueba de un componente debe declararlos. */
export const COMPONENTES_UI: Type<unknown>[] = [
  AccionesComponent, AccionesFilaDirective, AppleTableComponent, BadgeComponent, ButtonComponent, CampoEditableComponent, CeldaTablaDirective, FilterBarComponent, TarjetaFilaDirective, CardComponent, ContadorComponent, EmptyStateComponent, FieldComponent, InputDirective, LogoComponent, PageHeaderComponent, PropagarSimilaresModalComponent, SearchableSelectComponent, SelectComponent, SelectProductoComponent, SelectorTagsComponent, SkeletonComponent, TableDirective, ThemeToggleComponent,
];
/** Directivas independientes (standalone): van en `imports`, no en `declarations`. */
export const DIRECTIVAS_UI = [TooltipDirective];

/** Da ancho de escritorio al componente: la tabla Apple oculta columnas (a propósito) cuando no caben y la ventana de Karma es angosta. */
export function anchoEscritorio(f: ComponentFixture<unknown>, px = 1400): void {
  (f.nativeElement as HTMLElement).style.cssText = `display:block;width:${px}px`;
}

/** Espera a que la tabla Apple mida su ancho (ResizeObserver) y vuelve a pintar. */
export async function esperarTabla(f: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 80));
  f.detectChanges();
}

export const API = environment.apiUrl;

/**
 * En Karma no se carga la fuente de íconos: sin esto cada ícono se pinta como texto largo («pause_circle») y las tablas parecen mucho más
 * anchas de lo que son. Cada ícono pasa a ser un cuadrado de 24 px, como con la fuente real.
 */
export function estilosDePrueba(): void {
  if (document.getElementById('estilos-de-prueba')) return;
  const estilo = document.createElement('style');
  estilo.id = 'estilos-de-prueba';
  estilo.textContent = '.material-icons{display:inline-block;width:24px;height:24px;overflow:hidden;font-size:0!important;vertical-align:middle}';
  document.head.appendChild(estilo);
}

/**
 * `SugerenciasService` de mentira: devuelve estos valores al instante, sin HTTP. Por defecto cada prueba usa uno SIN sugerencias
 * (los formularios arrancan como siempre); pásalo en `providers` para probar los valores inteligentes.
 */
export function sugerenciasDe(defaults: Partial<DefaultsFormularios> = {}, comercios: ComercioHabitual[] = []) {
  return { provide: SugerenciasService, useValue: { defaults: () => of({ ...DEFAULTS_VACIOS, ...defaults }), comercios: () => of(comercios), invalidar: () => undefined } };
}

/** Configura TestBed para un componente del módulo ERP: pipes propios, formularios, router y HTTP simulado. */
export function configurarTestBed(declarations: Type<unknown>[], providers: Provider[] = [], imports: any[] = []): void {
  estilosDePrueba();
  TestBed.configureTestingModule({
    declarations: [...declarations, FormatoMonedaPipe, FormatoFechaPipe, FormatoFechaCortaPipe, ...COMPONENTES_UI],
    imports: [ReactiveFormsModule, FormsModule, RouterModule.forRoot([]), ...DIRECTIVAS_UI, ...imports],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), sugerenciasDe(), ...providers],
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
