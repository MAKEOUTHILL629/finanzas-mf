import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { OpcionSelect, TipoCatalogo } from '../../../modelos/catalogos';
import { categoriaItem, cuentaItem, persona, responderCatalogos, tarjetaItem } from '../../../testing/erp-testing';
import { SelectComponent } from './select.component';
import { detalleDeCatalogo, etiquetaDeCatalogo, opcionesDeCatalogo, valoresIguales } from './select.helpers';

@Component({
  template: `<app-select
    inputId="s1"
    [catalogo]="catalogo"
    [opciones]="opciones"
    [filtro]="filtro"
    [permitirVacio]="permitirVacio"
    [soloActivas]="soloActivas"
    [enlaceCrear]="enlace"
    placeholder="Elige…"
    [formControl]="control"
    (elegido)="elegido = $event"
  ></app-select>`,
})
class AnfitrionComponent {
  catalogo: TipoCatalogo | null = 'personas';
  opciones: OpcionSelect[] = [];
  filtro: ((i: any) => boolean) | null = null;
  permitirVacio = true;
  soloActivas = true;
  enlace: { texto: string; ruta: string } | null = null;
  control = new FormControl<number | string | null>(null);
  elegido: OpcionSelect | null | undefined;
}

describe('SelectComponent (selector con catálogos compartidos)', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let host: AnfitrionComponent;
  let http: HttpTestingController;

  const select = () => fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  const textos = () => Array.from(select().options).map((o) => o.textContent?.trim());
  const texto = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  function montar(config: Partial<AnfitrionComponent> = {}): void {
    TestBed.configureTestingModule({
      declarations: [SelectComponent, AnfitrionComponent],
      imports: [ReactiveFormsModule, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AnfitrionComponent);
    host = fixture.componentInstance;
    Object.assign(host, config);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  const elegir = (valor: string) => {
    select().value = valor;
    select().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('mientras carga muestra un esqueleto dentro del campo (deshabilitado y marcado como ocupado)', () => {
    montar();
    expect(select().disabled).toBeTrue();
    expect(select().getAttribute('aria-busy')).toBe('true');
    expect(textos()).toEqual(['Cargando…']);
    expect(fixture.nativeElement.querySelector('.ui-select-esqueleto')).not.toBeNull();
    responderCatalogos({ personas: [persona(2, 'Andrés')] });
    fixture.detectChanges();
    expect(select().disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.ui-select-esqueleto')).toBeNull();
  });

  it('lista las opciones del catálogo y entrega el id NUMÉRICO (no el texto del <select>)', () => {
    montar();
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá')] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Andrés', 'Papá']);
    elegir('3');
    expect(host.control.value).toBe(3);
    expect(typeof host.control.value).toBe('number');
    expect(host.elegido).toEqual(jasmine.objectContaining({ valor: 3, etiqueta: 'Papá' }));
    elegir(''); // volver a «sin selección»
    expect(host.control.value).toBeNull();
    expect(host.elegido).toBeNull();
  });

  it('conserva el valor del formulario aunque el catálogo llegue DESPUÉS (editar un registro no deja el campo en blanco)', () => {
    montar();
    host.control.setValue(3);
    fixture.detectChanges();
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá')] });
    fixture.detectChanges();
    expect(select().options[select().selectedIndex].textContent?.trim()).toBe('Papá');
    host.control.setValue('2'); // un id como texto (formularios antiguos) también se reconoce
    fixture.detectChanges();
    expect(select().options[select().selectedIndex].textContent?.trim()).toBe('Andrés');
    host.control.setValue(null);
    fixture.detectChanges();
    expect(select().selectedIndex).toBe(0);
  });

  it('en un campo obligatorio el marcador no se puede volver a elegir', () => {
    montar({ permitirVacio: false });
    responderCatalogos({ personas: [persona(2, 'Andrés')] });
    fixture.detectChanges();
    expect(select().options[0].disabled).toBeTrue();
  });

  it('catálogo vacío: avisa, ofrece crear lo que falta y no se puede abrir', () => {
    montar({ catalogo: 'cuentas', enlace: { texto: 'Crear una cuenta', ruta: '/cuentas' } });
    responderCatalogos({ cuentas: [] });
    fixture.detectChanges();
    expect(select().disabled).toBeTrue();
    expect(texto()).toContain('No hay cuentas registradas.');
    expect(texto()).toContain('Crear una cuenta');
  });

  it('si la carga falla muestra el error con «Reintentar» y al reintentar vuelve a pedir; los datos viejos siguen disponibles', () => {
    montar({ catalogo: 'tarjetas' });
    http.expectOne(`${environment.apiUrl}/lookup?tipos=tarjetas`).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('Reintentar');
    expect(texto()).not.toContain('No hay tarjetas registradas'); // un fallo no se disfraza de «vacío»
    const boton = fixture.nativeElement.querySelector('.ui-select-error button') as HTMLButtonElement;
    boton.click();
    responderCatalogos({ tarjetas: [tarjetaItem(1, 'Visa', { etiqueta: 'Visa ··1927' })] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Visa ··1927']);
    expect(texto()).not.toContain('Reintentar');
  });

  it('filtra con la función del formulario y conserva la opción ya elegida aunque el filtro la descartaría', () => {
    montar({ filtro: (p: { id: number }) => p.id !== 2 });
    host.control.setValue(2);
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá'), persona(4, 'Tía')] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Andrés', 'Papá', 'Tía']); // 2 se conserva por estar elegida
    host.control.setValue(null);
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Papá', 'Tía']);
  });

  it('un cambio del filtro (nueva función) recalcula las opciones', () => {
    montar({ filtro: () => true });
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá')] });
    fixture.detectChanges();
    host.filtro = (p: { id: number }) => p.id === 3;
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Papá']);
  });

  it('cuentas: solo las activas, salvo la que ya estaba elegida; con soloActivas=false, todas', () => {
    montar({ catalogo: 'cuentas' });
    host.control.setValue(9);
    responderCatalogos({ cuentas: [cuentaItem(1, 'Ahorros', { ultimos4: '3698,4278' }), cuentaItem(9, 'Vieja', { activa: false })] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Ahorros ··3698', 'Vieja (inactiva)']);
    host.control.setValue(null);
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Ahorros ··3698']);
    host.soloActivas = false;
    fixture.detectChanges();
    expect(textos()).toEqual(['Elige…', 'Ahorros ··3698', 'Vieja (inactiva)']);
  });

  it('con opciones propias (sin catálogo) funciona igual y no pide nada al servidor', () => {
    montar({ catalogo: null, opciones: [{ valor: 'a', etiqueta: 'Alfa' }, { valor: 7, etiqueta: 'Siete' }] });
    expect(textos()).toEqual(['Elige…', 'Alfa', 'Siete']);
    elegir('a');
    expect(host.control.value).toBe('a');
    elegir('7');
    expect(host.control.value).toBe(7);
  });

  it('deshabilitar el control deshabilita el selector', () => {
    montar();
    responderCatalogos({ personas: [persona(2, 'Andrés')] });
    host.control.disable();
    fixture.detectChanges();
    expect(select().disabled).toBeTrue();
  });

  it('dos selectores del mismo catálogo comparten UNA petición', () => {
    montar();
    const segundo = TestBed.createComponent(AnfitrionComponent);
    segundo.detectChanges();
    expect(responderCatalogos({ personas: [] })).toBe(1);
  });
});

describe('select.helpers', () => {
  it('valoresIguales compara ids sin importar si son número o texto, y vacío nunca coincide', () => {
    expect(valoresIguales(5, '5')).toBeTrue();
    expect(valoresIguales('5', 5)).toBeTrue();
    expect(valoresIguales(5, 6)).toBeFalse();
    expect(valoresIguales(null, null)).toBeFalse();
    expect(valoresIguales('', 0)).toBeFalse();
  });

  it('etiquetas estándar de cada catálogo', () => {
    expect(etiquetaDeCatalogo('personas', persona(1, 'Felipe'))).toBe('Felipe');
    expect(etiquetaDeCatalogo('tarjetas', tarjetaItem(1, 'Visa', { etiqueta: 'Visa ··1927' }))).toBe('Visa ··1927');
    expect(etiquetaDeCatalogo('cuentas', cuentaItem(1, 'Ahorros', { ultimos4: '3698,4278' }))).toBe('Ahorros ··3698');
    expect(etiquetaDeCatalogo('cuentas', cuentaItem(1, 'Vieja', { activa: false }))).toBe('Vieja (inactiva)');
    expect(etiquetaDeCatalogo('categorias', categoriaItem(1, 'Mercado'))).toBe('Mercado');
    expect(detalleDeCatalogo('cuentas', cuentaItem(1, 'x', { moneda: 'USD' }))).toBe('USD');
    expect(detalleDeCatalogo('personas', persona(1, 'x'))).toBeUndefined();
  });

  it('opcionesDeCatalogo nunca repite un id y respeta el etiquetador propio', () => {
    const r = opcionesDeCatalogo('personas', [persona(1, 'A'), persona(1, 'A bis'), persona(2, 'B')], { filtro: null, etiquetar: (p: { nombre: string }) => p.nombre.toUpperCase(), soloActivas: true, valorActual: null });
    expect(r.map((o) => [o.valor, o.etiqueta])).toEqual([[1, 'A'], [2, 'B']]);
  });
});
