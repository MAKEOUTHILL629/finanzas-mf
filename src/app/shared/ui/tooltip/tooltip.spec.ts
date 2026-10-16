import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { COMPONENTES_UI, DIRECTIVAS_UI } from '../../../testing/erp-testing';
import { TooltipService } from './tooltip.service';

@Component({
  template: `
    <button id="plano" type="button" appTooltip="Guarda los cambios" [tooltipRetardo]="0">Guardar</button>
    <button id="icono" type="button" appButton="ghost" icon aria-label="Eliminar la cuenta" [tooltipRetardo]="0"><i>delete</i></button>
    <button id="boton" type="button" appButton="primary" appTooltip="Registra un pago" [tooltipRetardo]="0">Pagar</button>
    <button id="sin" type="button" appButton="primary">Sin ayuda</button>
    <button id="titulo" type="button" appTooltip="" title="Título nativo" [tooltipRetardo]="0">T</button>
  `,
})
class AnfitrionTooltipComponent {}

describe('Tooltip (appTooltip)', () => {
  let f: ComponentFixture<AnfitrionTooltipComponent>;
  const boton = (id: string) => (f.nativeElement as HTMLElement).querySelector(`#${id}`) as HTMLElement;
  const globo = () => document.querySelector('.app-tooltip') as HTMLElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [AnfitrionTooltipComponent, ...COMPONENTES_UI], imports: [...DIRECTIVAS_UI] }).compileComponents();
    f = TestBed.createComponent(AnfitrionTooltipComponent);
    f.detectChanges();
  });
  afterEach(() => TestBed.inject(TooltipService).ocultar());

  it('al pasar el cursor muestra el texto y lo asocia al botón; al salir lo quita', () => {
    boton('plano').dispatchEvent(new MouseEvent('mouseenter'));
    expect(globo()!.textContent).toBe('Guarda los cambios');
    expect(globo()!.getAttribute('role')).toBe('tooltip');
    expect(boton('plano').getAttribute('aria-describedby')).toBe(globo()!.id);
    boton('plano').dispatchEvent(new MouseEvent('mouseleave'));
    expect(globo()).toBeNull();
    expect(boton('plano').hasAttribute('aria-describedby')).toBeFalse();
  });

  it('un botón de solo ícono usa su aria-label', () => {
    boton('icono').dispatchEvent(new MouseEvent('mouseenter'));
    expect(globo()!.textContent).toBe('Eliminar la cuenta');
  });

  it('un botón del sistema de diseño también acepta texto propio', () => {
    boton('boton').dispatchEvent(new MouseEvent('mouseenter'));
    expect(globo()!.textContent).toBe('Registra un pago');
  });

  it('un botón con texto visible y sin ayuda no muestra nada', () => {
    boton('sin').dispatchEvent(new MouseEvent('mouseenter'));
    expect(globo()).toBeNull();
  });

  it('solo hay un globo a la vez', () => {
    boton('plano').dispatchEvent(new MouseEvent('mouseenter'));
    boton('icono').dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelectorAll('.app-tooltip').length).toBe(1);
    expect(globo()!.textContent).toBe('Eliminar la cuenta');
  });

  it('Escape lo oculta y el título nativo se retira para no repetir la ayuda', () => {
    boton('plano').dispatchEvent(new MouseEvent('mouseenter'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(globo()).toBeNull();
    expect(boton('titulo').hasAttribute('title')).toBeFalse();
  });

  it('el globo se queda dentro de la pantalla', () => {
    boton('plano').dispatchEvent(new MouseEvent('mouseenter'));
    const r = globo()!.getBoundingClientRect();
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });
});
