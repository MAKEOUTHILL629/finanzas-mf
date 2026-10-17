import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { OpcionSelect, TipoCatalogo } from '../../../modelos/catalogos';
import { categoriaItem, cuentaItem, persona, responderCatalogos, tarjetaItem } from '../../../testing/erp-testing';
import { SearchableSelectComponent } from '../searchable-select/searchable-select.component';
import { SelectComponent } from './select.component';
import { GRUPO_ACTIVAS, GRUPO_FRECUENTES, GRUPO_HISTORICAS, GRUPO_TODAS, detalleDeCatalogo, etiquetaDeCatalogo, opcionesDeCatalogo, ordenarConFrecuentes, valoresIguales } from './select.helpers';

@Component({
  template: `<app-select
    inputId="s1"
    [catalogo]="catalogo"
    [opciones]="opciones"
    [filtro]="filtro"
    [permitirVacio]="permitirVacio"
    [soloActivas]="soloActivas"
    [frecuentes]="frecuentes"
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
  frecuentes: number[] | null = null;
  enlace: { texto: string; ruta: string } | null = null;
  control = new FormControl<number | string | null>(null);
  elegido: OpcionSelect | null | undefined;
}

describe('SelectComponent (selector con catálogos compartidos)', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let host: AnfitrionComponent;
  let http: HttpTestingController;

  const boton = () => fixture.nativeElement.querySelector('button.ss-boton') as HTMLButtonElement;
  const buscador = () => document.querySelector('input.ss-buscador') as HTMLInputElement;
  /** Abre la lista (si no lo está) y devuelve lo que muestra: las etiquetas de las opciones y los encabezados de grupo, en orden. */
  const abrir = () => {
    if (!document.querySelector('.ss-panel')) boton().click();
    fixture.detectChanges();
  };
  const textos = () => {
    abrir();
    return Array.from(document.querySelectorAll('.ss-opcion-texto')).map((o) => (o as HTMLElement).textContent?.trim());
  };
  const grupos = () => {
    abrir();
    return Array.from(document.querySelectorAll('.ss-grupo')).map((o) => (o as HTMLElement).textContent?.trim());
  };
  const valorMostrado = () => boton().querySelector('.ss-valor')?.textContent?.trim();
  const texto = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  function montar(config: Partial<AnfitrionComponent> = {}): void {
    TestBed.configureTestingModule({
      declarations: [SelectComponent, SearchableSelectComponent, AnfitrionComponent],
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

  /** Elige con un clic la opción de ese valor ('' = limpiar la selección). */
  const elegir = (valor: string) => {
    if (valor === '') {
      (fixture.nativeElement.querySelector('.ss-limpiar') as HTMLButtonElement).click();
    } else {
      abrir();
      const opciones = Array.from(document.querySelectorAll('.ss-opcion')) as HTMLElement[];
      const objetivo = opciones.find((o) => o.textContent?.includes(valor));
      if (!objetivo) throw new Error(`No hay una opción que contenga «${valor}»`);
      objetivo.click();
    }
    fixture.detectChanges();
  };

  it('mientras carga muestra un esqueleto dentro del campo (deshabilitado y marcado como ocupado)', () => {
    montar();
    expect(boton().disabled).toBeTrue();
    expect(boton().getAttribute('aria-busy')).toBe('true');
    expect(valorMostrado()).toBe('Cargando…');
    expect(fixture.nativeElement.querySelector('.ss-esqueleto')).not.toBeNull();
    responderCatalogos({ personas: [persona(2, 'Andrés')] });
    fixture.detectChanges();
    expect(boton().disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.ss-esqueleto')).toBeNull();
    expect(valorMostrado()).toBe('Elige…');
  });

  it('lista las opciones del catálogo y entrega el id NUMÉRICO (no un texto)', () => {
    montar();
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá')] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Andrés', 'Papá']);
    elegir('Papá');
    expect(host.control.value).toBe(3);
    expect(typeof host.control.value).toBe('number');
    expect(host.elegido).toEqual(jasmine.objectContaining({ valor: 3, etiqueta: 'Papá' }));
    expect(valorMostrado()).toBe('Papá');
    elegir(''); // volver a «sin selección»
    expect(host.control.value).toBeNull();
    expect(host.elegido).toBeNull();
    expect(valorMostrado()).toBe('Elige…');
  });

  it('se puede buscar por nombre (sin importar tildes ni mayúsculas) y elegir con el teclado', () => {
    montar();
    responderCatalogos({ personas: [persona(2, 'Andrés Gómez'), persona(3, 'Papá'), persona(4, 'Tía Marta')] });
    fixture.detectChanges();
    abrir();
    buscador().value = 'ANDRES';
    buscador().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(textos()).toEqual(['Andrés Gómez']);
    buscador().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.control.value).toBe(2);
  });

  it('conserva el valor del formulario aunque el catálogo llegue DESPUÉS (editar un registro no deja el campo en blanco)', () => {
    montar();
    host.control.setValue(3);
    fixture.detectChanges();
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá')] });
    fixture.detectChanges();
    expect(valorMostrado()).toBe('Papá');
    host.control.setValue('2'); // un id como texto (formularios antiguos) también se reconoce
    fixture.detectChanges();
    expect(valorMostrado()).toBe('Andrés');
    host.control.setValue(null);
    fixture.detectChanges();
    expect(valorMostrado()).toBe('Elige…');
  });

  it('en un campo obligatorio no hay botón para quitar la selección', () => {
    montar({ permitirVacio: false });
    responderCatalogos({ personas: [persona(2, 'Andrés')] });
    host.control.setValue(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ss-limpiar')).toBeNull();
    host.permitirVacio = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ss-limpiar')).not.toBeNull();
  });

  it('catálogo vacío: avisa, ofrece crear lo que falta y no se puede abrir', () => {
    montar({ catalogo: 'cuentas', enlace: { texto: 'Crear una cuenta', ruta: '/cuentas' } });
    responderCatalogos({ cuentas: [] });
    fixture.detectChanges();
    expect(boton().disabled).toBeTrue();
    expect(texto()).toContain('No hay cuentas registradas.');
    expect(texto()).toContain('Crear una cuenta');
  });

  it('si la carga falla muestra el error con «Reintentar» y al reintentar vuelve a pedir; los datos viejos siguen disponibles', () => {
    montar({ catalogo: 'tarjetas' });
    http.expectOne(`${environment.apiUrl}/lookup?tipos=tarjetas`).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('Reintentar');
    expect(texto()).not.toContain('No hay tarjetas registradas'); // un fallo no se disfraza de «vacío»
    const reintentar = fixture.nativeElement.querySelector('.ui-select-error button') as HTMLButtonElement;
    reintentar.click();
    responderCatalogos({ tarjetas: [tarjetaItem(1, 'Visa', { etiqueta: 'Visa ··1927' })] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Visa ··1927']);
    expect(texto()).not.toContain('Reintentar');
  });

  it('filtra con la función del formulario y conserva la opción ya elegida aunque el filtro la descartaría', () => {
    montar({ filtro: (p: { id: number }) => p.id !== 2 });
    host.control.setValue(2);
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá'), persona(4, 'Tía')] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Andrés', 'Papá', 'Tía']); // 2 se conserva por estar elegida
    host.control.setValue(null);
    fixture.detectChanges();
    expect(textos()).toEqual(['Papá', 'Tía']);
  });

  it('un cambio del filtro (nueva función) recalcula las opciones', () => {
    montar({ filtro: () => true });
    responderCatalogos({ personas: [persona(2, 'Andrés'), persona(3, 'Papá')] });
    fixture.detectChanges();
    host.filtro = (p: { id: number }) => p.id === 3;
    fixture.detectChanges();
    expect(textos()).toEqual(['Papá']);
  });

  it('cuentas: solo las activas (en «Activas»), salvo la que ya estaba elegida (en «Históricas»); con soloActivas=false, todas', () => {
    montar({ catalogo: 'cuentas' });
    host.control.setValue(9);
    responderCatalogos({ cuentas: [cuentaItem(1, 'Ahorros', { ultimos4: '3698,4278' }), cuentaItem(9, 'Vieja', { activa: false })] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Ahorros ··3698', 'Vieja (inactiva)']);
    expect(grupos()).toEqual([GRUPO_ACTIVAS, GRUPO_HISTORICAS]);
    host.control.setValue(null);
    fixture.detectChanges();
    expect(textos()).toEqual(['Ahorros ··3698']);
    expect(grupos()).toEqual([]); // un solo grupo: sin encabezados
    host.soloActivas = false;
    fixture.detectChanges();
    expect(textos()).toEqual(['Ahorros ··3698', 'Vieja (inactiva)']);
  });

  it('cuentas: se buscan por los últimos 4 dígitos, también por los de la lista de varios grupos', () => {
    montar({ catalogo: 'cuentas' });
    responderCatalogos({ cuentas: [cuentaItem(1, 'Ahorros', { ultimos4: '3698,4278' }), cuentaItem(2, 'Padre', { ultimos4: '4248' })] });
    fixture.detectChanges();
    abrir();
    buscador().value = '*4278';
    buscador().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(textos()).toEqual(['Ahorros ··3698']);
  });

  it('tarjetas: «Activas» arriba y «Históricas / Reemplazadas» abajo; se busca por cualquier plástico, también los anteriores', () => {
    const plastico = (id: number, ultimos4: string, esActivo: boolean) => ({ id, ultimos4, esActivo, vigenteDesde: null, vigenteHasta: null });
    montar({ catalogo: 'tarjetas' });
    responderCatalogos({
      tarjetas: [
        tarjetaItem(1, 'Amex', { etiqueta: 'American Express ··1927', ultimos4Activo: '1927', plasticos: [plastico(1, '1927', true), plastico(2, '0088', false)] }),
        tarjetaItem(2, 'Codensa', { etiqueta: 'Codensa', esGenerica: true }),
        tarjetaItem(3, 'Vieja', { etiqueta: 'Visa vieja', plasticos: [plastico(3, '5555', false)] }),
      ],
    });
    fixture.detectChanges();
    expect(textos()).toEqual(['American Express ··1927', 'Codensa', 'Visa vieja']);
    expect(grupos()).toEqual([GRUPO_ACTIVAS, GRUPO_HISTORICAS]);
    buscador().value = '0088'; // un plástico anterior de la Amex
    buscador().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(textos()).toEqual(['American Express ··1927']);
    expect((document.querySelector('.ss-opcion-detalle') as HTMLElement).textContent).toContain('antes ··0088');
  });

  it('personas: las más frecuentes van primero y todas las demás siguen debajo (nadie queda fuera)', () => {
    montar({ frecuentes: [4, 2] });
    responderCatalogos({ personas: [persona(1, 'Felipe'), persona(2, 'Andrés'), persona(3, 'Papá'), persona(4, 'Luis'), persona(5, 'Ana')] });
    fixture.detectChanges();
    expect(textos()).toEqual(['Luis', 'Andrés', 'Felipe', 'Papá', 'Ana']);
    expect(grupos()).toEqual([GRUPO_FRECUENTES, GRUPO_TODAS]);
  });

  it('con opciones propias (sin catálogo) funciona igual y no pide nada al servidor', () => {
    montar({ catalogo: null, opciones: [{ valor: 'a', etiqueta: 'Alfa' }, { valor: 7, etiqueta: 'Siete' }] });
    expect(textos()).toEqual(['Alfa', 'Siete']);
    elegir('Alfa');
    expect(host.control.value).toBe('a');
    elegir('Siete');
    expect(host.control.value).toBe(7);
  });

  it('deshabilitar el control deshabilita el selector', () => {
    montar();
    responderCatalogos({ personas: [persona(2, 'Andrés')] });
    host.control.disable();
    fixture.detectChanges();
    expect(boton().disabled).toBeTrue();
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
    expect(detalleDeCatalogo('cuentas', cuentaItem(1, 'x'))).toBeUndefined();
    expect(detalleDeCatalogo('personas', persona(1, 'x'))).toBeUndefined();
  });

  it('ordenarConFrecuentes: sin ninguna frecuente presente deja la lista como estaba', () => {
    const base = [{ valor: 1, etiqueta: 'A' }, { valor: 2, etiqueta: 'B' }];
    expect(ordenarConFrecuentes(base, [9])).toEqual(base);
    expect(ordenarConFrecuentes(base, [2]).map((o) => [o.valor, o.grupo])).toEqual([[2, GRUPO_FRECUENTES], [1, GRUPO_TODAS]]);
    // si todas son frecuentes no hace falta el grupo «Todas»
    expect(ordenarConFrecuentes(base, [2, 1]).map((o) => [o.valor, o.grupo])).toEqual([[2, GRUPO_FRECUENTES], [1, GRUPO_FRECUENTES]]);
  });

  it('opcionesDeCatalogo nunca repite un id y respeta el etiquetador propio', () => {
    const r = opcionesDeCatalogo('personas', [persona(1, 'A'), persona(1, 'A bis'), persona(2, 'B')], { filtro: null, etiquetar: (p: { nombre: string }) => p.nombre.toUpperCase(), soloActivas: true, valorActual: null });
    expect(r.map((o) => [o.valor, o.etiqueta])).toEqual([[1, 'A'], [2, 'B']]);
  });
});
