import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../../services/theme.service';
import { BadgeComponent } from './badge/badge.component';
import { ButtonComponent } from './button/button.component';
import { CardComponent } from './card/card.component';
import { EmptyStateComponent } from './empty-state/empty-state.component';
import { FieldComponent, InputDirective } from './field/field.component';
import { PageHeaderComponent } from './page-header/page-header.component';
import { TableDirective } from './table/table.directive';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';

@Component({
  template: `
    <app-page-header titulo="Cuentas" subtitulo="Tus cuentas" idTitulo="t"><button appButton="primary">Nueva</button></app-page-header>
    <app-card id="c1" titulo="Resumen" padding="lg" variant="solid" interactive>contenido</app-card>
    <app-card id="c2">simple</app-card>
    <button id="b1" appButton="secondary" size="sm" icon (click)="clics = clics + 1">+</button>
    <button id="b2" appButton="danger" block [loading]="cargando" (click)="clics = clics + 1">Borrar</button>
    <a id="b3" appButton="ghost" size="lg">Enlace</a>
    <app-badge id="g1" tone="success" icon="check_circle">Pagada</app-badge>
    <app-badge id="g2" solid tone="danger">3</app-badge>
    <app-field label="Monto" for="m" [required]="true" hint="Sin puntos" [error]="error"><input id="m" appInput [invalid]="!!error" /></app-field>
    <select id="s" appInput></select>
    <textarea id="t2" appInput></textarea>
    <table id="tb" appTable compact stack><tbody></tbody></table>
    <table id="tb2" appTable></table>
    <app-empty-state icon="inbox" titulo="Nada aquí" descripcion="Prueba otro mes"><button appButton="primary">Crear</button></app-empty-state>
  `,
})
class AnfitrionComponent {
  clics = 0;
  cargando = false;
  error: string | null = null;
}

describe('Sistema de diseño · componentes base', () => {
  function montar() {
    TestBed.configureTestingModule({
      declarations: [AnfitrionComponent, ButtonComponent, CardComponent, BadgeComponent, FieldComponent, InputDirective, TableDirective, PageHeaderComponent, EmptyStateComponent],
    });
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    const q = (sel: string) => (fixture.nativeElement as HTMLElement).querySelector(sel) as HTMLElement;
    return { fixture, q, host: fixture.componentInstance };
  }

  it('el botón pone las clases de variante, tamaño, ícono y bloque sobre el elemento nativo', () => {
    const { q } = montar();
    for (const c of ['erp-btn', 'erp-btn--secondary', 'erp-btn--sm', 'erp-btn--icon']) expect(q('#b1').classList.contains(c)).withContext(c).toBeTrue();
    expect(q('#b2').className).toContain('erp-btn--danger');
    expect(q('#b2').className).toContain('erp-btn--block');
    expect(q('#b3').tagName).toBe('A');
    expect(q('#b3').classList.contains('erp-btn--ghost') && q('#b3').classList.contains('erp-btn--lg')).toBeTrue();
  });

  it('mientras carga, el botón se marca ocupado y no deja pasar los clics', () => {
    const { fixture, q, host } = montar();
    host.cargando = true;
    fixture.detectChanges();
    expect(q('#b2').className).toContain('erp-btn--loading');
    expect(q('#b2').getAttribute('aria-busy')).toBe('true');
    q('#b2').click();
    expect(host.clics).toBe(0);
    host.cargando = false;
    fixture.detectChanges();
    q('#b2').click();
    expect(host.clics).toBe(1);
  });

  it('la tarjeta aplica variante, espaciado e interacción, y muestra su título', () => {
    const { q } = montar();
    expect(q('#c1').className).toContain('erp-card');
    expect(q('#c1').className).toContain('erp-card--solid');
    expect(q('#c1').className).toContain('erp-card--pad-lg');
    expect(q('#c1').className).toContain('erp-card--clickable');
    expect(q('#c1 .erp-card-title').textContent).toBe('Resumen');
    expect(q('#c2').className.trim()).toBe('erp-card');
  });

  it('la insignia usa el tono, el ícono y el relleno sólido', () => {
    const { q } = montar();
    expect(q('#g1').className).toContain('erp-badge--success');
    expect(q('#g1 .material-icons').textContent).toBe('check_circle');
    expect(q('#g2').className).toContain('erp-badge--solid');
    expect(q('#g2').className).toContain('erp-badge--danger');
  });

  it('el campo conecta etiqueta y control, y el error reemplaza a la ayuda', () => {
    const { fixture, q, host } = montar();
    expect(q('app-field label').getAttribute('for')).toBe('m');
    expect(q('app-field .erp-req')).not.toBeNull();
    expect(q('app-field .erp-field-hint').textContent).toBe('Sin puntos');
    expect(q('#m').className).toContain('erp-input');
    host.error = 'Obligatorio';
    fixture.detectChanges();
    expect(q('app-field .erp-field-error').textContent).toBe('Obligatorio');
    expect(q('app-field .erp-field-hint')).toBeNull();
    expect(q('#m').className).toContain('erp-input--invalid');
    expect(q('#m').getAttribute('aria-invalid')).toBe('true');
  });

  it('appInput elige la clase según la etiqueta (input, select, textarea)', () => {
    const { q } = montar();
    expect(q('#s').className).toContain('erp-select');
    expect(q('#t2').className).toContain('erp-textarea');
  });

  it('appTable aplica la clase base y los modificadores que se escriben sin valor', () => {
    const { q } = montar();
    expect(q('#tb').className).toContain('erp-table erp-table--compact erp-table--stack');
    expect(q('#tb2').className).toBe('erp-table');
  });

  it('la cabecera de página muestra título, subtítulo y las acciones proyectadas', () => {
    const { q } = montar();
    expect(q('app-page-header h1').textContent).toBe('Cuentas');
    expect(q('app-page-header h1').id).toBe('t');
    expect(q('app-page-header .erp-subtitle').textContent).toBe('Tus cuentas');
    expect(q('app-page-header .erp-actions button').textContent).toBe('Nueva');
  });

  it('el estado vacío es una tarjeta con ícono, título, descripción y acción', () => {
    const { q } = montar();
    expect(q('app-empty-state').className).toContain('erp-empty');
    expect(q('app-empty-state h2').textContent).toBe('Nada aquí');
    expect(q('app-empty-state p').textContent).toBe('Prueba otro mes');
    expect(q('app-empty-state button')).not.toBeNull();
  });
});

describe('ThemeToggleComponent y ThemeService', () => {
  const CLAVE = 'finanzas-theme';
  beforeEach(() => {
    localStorage.removeItem(CLAVE);
    TestBed.configureTestingModule({ declarations: [ThemeToggleComponent, ButtonComponent], providers: [ThemeService] });
    TestBed.inject(ThemeService).animarCambios = false; // el cambio de tema es síncrono en las pruebas
  });
  afterEach(() => localStorage.removeItem(CLAVE));

  it('sin preferencia guardada la elección es «sistema» y se puede cambiar a claro y oscuro (se guarda)', () => {
    const servicio = TestBed.inject(ThemeService);
    expect(servicio.preference).toBe('system');
    servicio.setPreference('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(CLAVE)).toBe('light');
    expect(servicio.preference).toBe('light');
    servicio.setPreference('dark');
    expect(servicio.isDark).toBeTrue();
    expect(localStorage.getItem(CLAVE)).toBe('dark');
  });

  it('«sistema» borra lo guardado y vuelve a seguir al sistema operativo', () => {
    const servicio = TestBed.inject(ThemeService);
    servicio.setPreference('dark');
    servicio.setPreference('system');
    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(servicio.preference).toBe('system');
    const sistemaOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    expect(servicio.isDark).toBe(sistemaOscuro);
  });

  it('el color de la barra del navegador acompaña al tema', () => {
    const servicio = TestBed.inject(ThemeService);
    servicio.setPreference('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#000000');
    servicio.setPreference('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F5F5F7');
  });

  it('el selector segmentado marca la opción activa y cambia el tema al pulsar', () => {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>('.erp-segmented__item'));
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual(['Sistema', 'Claro', 'Oscuro']);
    items[2].click();
    fixture.detectChanges();
    expect(items[2].getAttribute('aria-checked')).toBe('true');
    expect(items[0].getAttribute('aria-checked')).toBe('false');
    expect(el.querySelector<HTMLElement>('.erp-segmented')!.style.getPropertyValue('--seg-index')).toBe('2');
    expect(TestBed.inject(ThemeService).isDark).toBeTrue();
  });

  it('las flechas del teclado recorren las opciones', () => {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    const grupo = (fixture.nativeElement as HTMLElement).querySelector('.erp-segmented')!;
    TestBed.inject(ThemeService).setPreference('system');
    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(TestBed.inject(ThemeService).preference).toBe('light');
    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(TestBed.inject(ThemeService).preference).toBe('system');
  });

  it('la variante de ícono alterna entre claro y oscuro', () => {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.componentRef.setInput('variant', 'icon');
    fixture.detectChanges();
    const servicio = TestBed.inject(ThemeService);
    servicio.setPreference('light');
    fixture.detectChanges();
    const boton = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(boton.getAttribute('aria-label')).toBe('Cambiar a tema oscuro');
    boton.click();
    expect(servicio.isDark).toBeTrue();
  });
});
