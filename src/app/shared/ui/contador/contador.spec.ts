import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { ContadorComponent } from './contador.component';

@Component({ template: `<app-contador [valor]="valor" [modo]="modo" [duracion]="duracion" [signo]="signo"></app-contador>` })
class AnfitrionCifraComponent {
  valor = 1250114.5;
  modo: 'completo' | 'compacto' = 'completo';
  duracion = 900;
  signo = false;
}

@Component({ template: `<app-skeleton ancho="60%" alto="2rem"></app-skeleton><app-skeleton variante="linea"></app-skeleton>` })
class SkeletonHostComponent {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ContadorComponent y SkeletonComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ declarations: [ContadorComponent, SkeletonComponent, AnfitrionCifraComponent, SkeletonHostComponent] }));
  afterEach(() => (ContadorComponent.animar = true));

  const texto = (f: { nativeElement: unknown }) => (f.nativeElement as HTMLElement).querySelector('.contador__cifra')!.textContent;

  it('sin animación muestra el valor final con el formato de dinero y lo anuncia a los lectores de pantalla', () => {
    ContadorComponent.animar = false;
    const f = TestBed.createComponent(AnfitrionCifraComponent);
    f.detectChanges();
    expect(texto(f)).toBe('$1,250,114.50');
    expect((f.nativeElement as HTMLElement).querySelector('.erp-sr-only')!.textContent).toBe('$1,250,114.50');
    expect((f.nativeElement as HTMLElement).querySelector('.contador__cifra')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('con signo antepone + a los positivos', () => {
    ContadorComponent.animar = false;
    const f = TestBed.createComponent(AnfitrionCifraComponent);
    f.componentInstance.signo = true;
    f.detectChanges();
    expect(texto(f)).toBe('+$1,250,114.50');
  });

  it('animado: arranca desde cero y termina exactamente en el valor', async () => {
    const f = TestBed.createComponent(AnfitrionCifraComponent);
    f.componentInstance.duracion = 80;
    f.detectChanges();
    expect(texto(f)).not.toBe('$1,250,114.50'); // todavía rodando
    await esperar(500);
    expect(texto(f)).toBe('$1,250,114.50');
  });

  it('un valor nuevo rueda desde el anterior hasta el nuevo', async () => {
    const f = TestBed.createComponent(AnfitrionCifraComponent);
    f.componentInstance.duracion = 40;
    f.detectChanges();
    await esperar(300);
    f.componentInstance.valor = 2000000;
    f.detectChanges();
    await esperar(300);
    expect(texto(f)).toBe('$2,000,000.00');
  });

  it('el esqueleto ocupa el tamaño pedido y se oculta a los lectores de pantalla', () => {
    const f = TestBed.createComponent(SkeletonHostComponent);
    f.detectChanges();
    const todos = (f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('app-skeleton');
    expect(todos[0].classList.contains('erp-skeleton')).toBeTrue();
    expect(todos[0].style.width).toBe('60%');
    expect(todos[0].style.height).toBe('2rem');
    expect(todos[0].getAttribute('aria-hidden')).toBe('true');
    expect(todos[1].classList.contains('erp-skeleton--linea')).toBeTrue();
  });
});
