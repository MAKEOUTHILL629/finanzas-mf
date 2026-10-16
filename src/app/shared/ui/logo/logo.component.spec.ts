import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LogoComponent } from './logo.component';

@Component({
  template: `
    <app-logo id="decorativo" size="48" alt=""></app-logo>
    <app-logo id="con-nombre" alt="Finanzas Make"></app-logo>
  `,
})
class AnfitrionLogoComponent {}

describe('LogoComponent', () => {
  it('pinta el logo de la marca con el tamaño pedido y sin repetirlo para lectores de pantalla cuando es decorativo', () => {
    TestBed.configureTestingModule({ declarations: [AnfitrionLogoComponent, LogoComponent] });
    const f = TestBed.createComponent(AnfitrionLogoComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const decorativo = el.querySelector('#decorativo img') as HTMLImageElement;
    expect(decorativo.getAttribute('src')).toContain('brand/logo.svg');
    expect(decorativo.getAttribute('width')).toBe('48');
    expect(decorativo.getAttribute('height')).toBe('48');
    expect(decorativo.getAttribute('alt')).toBe('');
    const conNombre = el.querySelector('#con-nombre img') as HTMLImageElement;
    expect(conNombre.getAttribute('alt')).toBe('Finanzas Make');
    expect(conNombre.getAttribute('width')).toBe('36'); // tamaño por defecto
  });
});
