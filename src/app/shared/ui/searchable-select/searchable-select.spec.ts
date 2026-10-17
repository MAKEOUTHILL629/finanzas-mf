import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { OpcionSelect } from '../../../modelos/catalogos';
import { configurarTestBed } from '../../../testing/erp-testing';
import { filasDeLista, filtrarOpciones, moverActiva, normalizarBusqueda } from './searchable-select.helpers';

const OPCIONES: OpcionSelect[] = [
  { valor: 1, etiqueta: 'American Express ··1927', detalle: 'antes ··0088, ··9587', grupo: 'Activas', busqueda: '1927 0088 9587 credito amex' },
  { valor: 2, etiqueta: 'Mastercard ··9491', detalle: 'antes ··5052', grupo: 'Activas', busqueda: '9491 5052 7293 credito' },
  { valor: 3, etiqueta: 'Débito ··7992', detalle: 'cuenta Bancolombia Padre', grupo: 'Activas', busqueda: '7992 debito' },
  { valor: 4, etiqueta: 'Codensa', grupo: 'Históricas / Reemplazadas', busqueda: 'sin numero credito' },
  { valor: 5, etiqueta: 'Exito Mastercard antigua', grupo: 'Históricas / Reemplazadas' },
];

describe('searchable-select.helpers', () => {
  it('normalizarBusqueda: sin tildes ni signos, para que «*1927» y «··1927» busquen 1927', () => {
    expect(normalizarBusqueda('  ÉXITO  ·· *1927 – x ')).toBe('exito 1927 x');
    expect(normalizarBusqueda(null)).toBe('');
  });

  describe('filtrarOpciones', () => {
    it('sin búsqueda devuelve todo en el mismo orden', () => {
      expect(filtrarOpciones(OPCIONES, '').map((o) => o.valor)).toEqual([1, 2, 3, 4, 5]);
      expect(filtrarOpciones(OPCIONES, '   ').map((o) => o.valor)).toEqual([1, 2, 3, 4, 5]);
    });

    it('busca por los últimos 4 dígitos con cualquier forma de escribirlos, incluso los de un plástico anterior', () => {
      for (const q of ['1927', '*1927', '··1927']) expect(filtrarOpciones(OPCIONES, q).map((o) => o.valor)).toEqual([1]);
      expect(filtrarOpciones(OPCIONES, '*0088').map((o) => o.valor)).toEqual([1]);
      expect(filtrarOpciones(OPCIONES, '5052').map((o) => o.valor)).toEqual([2]);
    });

    it('busca por tipo de producto, sin importar mayúsculas ni tildes', () => {
      expect(filtrarOpciones(OPCIONES, 'Crédito').map((o) => o.valor)).toEqual([1, 2, 4]);
      expect(filtrarOpciones(OPCIONES, 'DEBITO').map((o) => o.valor)).toEqual([3]);
      expect(filtrarOpciones(OPCIONES, 'bancolombia padre').map((o) => o.valor)).toEqual([3]);
    });

    it('todas las palabras deben aparecer, en cualquier orden', () => {
      expect(filtrarOpciones(OPCIONES, 'master 9491').map((o) => o.valor)).toEqual([2]);
      expect(filtrarOpciones(OPCIONES, '9491 master').map((o) => o.valor)).toEqual([2]);
      expect(filtrarOpciones(OPCIONES, 'master 1927')).toEqual([]);
    });

    it('dentro de cada grupo van primero las que empiezan por lo escrito, y los grupos conservan su orden', () => {
      const r = filtrarOpciones(OPCIONES, 'master');
      expect(r.map((o) => o.valor)).toEqual([2, 5]);
      const mezcla: OpcionSelect[] = [
        { valor: 'a', etiqueta: 'Compra en Mercado', grupo: 'G1' },
        { valor: 'b', etiqueta: 'Mercado Libre', grupo: 'G1' },
        { valor: 'c', etiqueta: 'Mercadona', grupo: 'G2' },
      ];
      expect(filtrarOpciones(mezcla, 'mercado').map((o) => o.valor)).toEqual(['b', 'a', 'c']);
    });
  });

  describe('filasDeLista', () => {
    it('intercala el encabezado de cada grupo cuando hay más de uno', () => {
      const filas = filasDeLista(OPCIONES);
      expect(filas.map((f) => (f.tipo === 'grupo' ? `# ${f.nombre}` : f.opcion.valor))).toEqual(['# Activas', 1, 2, 3, '# Históricas / Reemplazadas', 4, 5]);
      expect(filas.filter((f) => f.tipo === 'opcion').map((f) => (f.tipo === 'opcion' ? f.indice : -1))).toEqual([0, 1, 2, 3, 4]);
    });

    it('con un solo grupo, o sin grupos, no hay encabezados', () => {
      expect(filasDeLista(OPCIONES.slice(0, 3)).every((f) => f.tipo === 'opcion')).toBeTrue();
      expect(filasDeLista([{ valor: 1, etiqueta: 'a' }, { valor: 2, etiqueta: 'b' }]).length).toBe(2);
      expect(filasDeLista([])).toEqual([]);
    });
  });

  it('moverActiva se queda dentro de la lista', () => {
    expect(moverActiva(0, 3, 1)).toBe(1);
    expect(moverActiva(2, 3, 1)).toBe(2);
    expect(moverActiva(0, 3, -1)).toBe(0);
    expect(moverActiva(1, 20, 8)).toBe(9);
    expect(moverActiva(-1, 3, 1)).toBe(0);
    expect(moverActiva(-1, 3, -1)).toBe(2);
    expect(moverActiva(0, 0, 1)).toBe(-1);
  });
});

@Component({
  template: `<app-searchable-select *ngIf="editando" [opciones]="opciones" [abrirAlMostrar]="true" [valor]="2" (tocado)="editando = false"></app-searchable-select>`,
})
class EditorEnLineaComponent {
  editando = true;
  opciones = OPCIONES;
}

@Component({
  template: `<form (submit)="enviado = true; $event.preventDefault()">
    <app-searchable-select inputId="x" [formControl]="control" [opciones]="opciones" placeholder="Elige" [permitirVacio]="permitirVacio" [cargando]="cargando" (elegido)="ultima = $event"></app-searchable-select>
  </form>`,
})
class AnfitrionComponent {
  control = new FormControl<number | string | null>(null);
  opciones = OPCIONES;
  permitirVacio = true;
  cargando = false;
  ultima: OpcionSelect | null | 'nada' = 'nada';
  enviado = false;
}

describe('SearchableSelectComponent', () => {
  let f: ComponentFixture<AnfitrionComponent>;
  const el = () => f.nativeElement as HTMLElement;
  const boton = () => el().querySelector('button.ss-boton') as HTMLButtonElement;
  const buscador = () => document.querySelector('input.ss-buscador') as HTMLInputElement;
  const textos = () => Array.from(document.querySelectorAll('.ss-opcion-texto')).map((x) => x.textContent?.trim());
  const grupos = () => Array.from(document.querySelectorAll('.ss-grupo')).map((x) => x.textContent?.trim());
  const tecla = (key: string, destino: HTMLElement = buscador()) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    destino.dispatchEvent(e);
    f.detectChanges();
    return e;
  };
  const escribir = (texto: string) => {
    buscador().value = texto;
    buscador().dispatchEvent(new Event('input'));
    f.detectChanges();
  };
  const abrir = async () => {
    boton().click();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    configurarTestBed([AnfitrionComponent]);
    f = TestBed.createComponent(AnfitrionComponent);
    f.detectChanges();
  });

  it('cerrado muestra el marcador o la opción elegida', () => {
    expect(boton().textContent).toContain('Elige');
    expect(boton().getAttribute('aria-expanded')).toBe('false');
    f.componentInstance.control.setValue(3);
    f.detectChanges();
    expect(boton().textContent).toContain('Débito ··7992');
    expect(document.querySelector('.ss-panel')).toBeNull();
  });

  it('al abrir enfoca el buscador y muestra las opciones con sus grupos', async () => {
    await abrir();
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(buscador());
    expect(grupos()).toEqual(['Activas', 'Históricas / Reemplazadas']);
    expect(textos()).toEqual(['American Express ··1927', 'Mastercard ··9491', 'Débito ··7992', 'Codensa', 'Exito Mastercard antigua']);
    expect(document.querySelector('[role=listbox]')).not.toBeNull();
    expect(document.querySelectorAll('[role=option]').length).toBe(5);
  });

  it('escribir filtra al instante (por dígitos, tipo o nombre) y avisa cuando no hay resultados', async () => {
    await abrir();
    escribir('*1927');
    expect(textos()).toEqual(['American Express ··1927']);
    escribir('débito');
    expect(textos()).toEqual(['Débito ··7992']);
    escribir('zzz');
    expect(textos()).toEqual([]);
    expect(document.querySelector('.ss-sin-resultados')?.textContent).toContain('Sin resultados');
    expect(document.querySelector('.ss-sr')?.textContent).toContain('0 resultados');
  });

  it('↓ ↑ Enter eligen con el teclado, actualizan el formulario y cierran devolviendo el foco', async () => {
    await abrir();
    expect(document.querySelector('.ss-opcion--activa')?.textContent).toContain('American Express'); // la primera
    tecla('ArrowDown');
    tecla('ArrowDown');
    expect(buscador().getAttribute('aria-activedescendant')).toBe(document.querySelectorAll('[role=option]')[2].id);
    tecla('ArrowUp');
    const enter = tecla('Enter');
    expect(enter.defaultPrevented).toBeTrue(); // no envía el formulario que la contiene
    expect(f.componentInstance.enviado).toBeFalse();
    expect(f.componentInstance.control.value).toBe(2);
    expect(f.componentInstance.ultima).toEqual(jasmine.objectContaining({ valor: 2 }));
    expect(document.querySelector('.ss-panel')).toBeNull();
    expect(document.activeElement).toBe(boton());
    expect(boton().textContent).toContain('Mastercard ··9491');
  });

  it('al reabrir la opción activa es la elegida; ↓ no pasa de la última ni ↑ de la primera', async () => {
    f.componentInstance.control.setValue(3);
    f.detectChanges();
    await abrir();
    expect(document.querySelector('.ss-opcion--activa')?.textContent).toContain('Débito');
    for (let i = 0; i < 10; i++) tecla('ArrowDown');
    expect(document.querySelector('.ss-opcion--activa')?.textContent).toContain('Exito Mastercard antigua');
    for (let i = 0; i < 10; i++) tecla('ArrowUp');
    expect(document.querySelector('.ss-opcion--activa')?.textContent).toContain('American Express');
  });

  it('Esc cierra la lista sin llegar al diálogo que la contiene y no cambia el valor', async () => {
    const llegoAlDocumento = jasmine.createSpy('escape');
    document.addEventListener('keydown', llegoAlDocumento);
    try {
      await abrir();
      const esc = tecla('Escape');
      expect(esc.defaultPrevented).toBeTrue();
      expect(llegoAlDocumento).not.toHaveBeenCalled();
      expect(document.querySelector('.ss-panel')).toBeNull();
      expect(f.componentInstance.control.value).toBeNull();
      expect(document.activeElement).toBe(boton());
    } finally {
      document.removeEventListener('keydown', llegoAlDocumento);
    }
  });

  it('con un clic elige; con un clic fuera o Tab cierra sin elegir', async () => {
    await abrir();
    (document.querySelectorAll('[role=option]')[3] as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.control.value).toBe(4);

    await abrir();
    document.body.click();
    f.detectChanges();
    expect(document.querySelector('.ss-panel')).toBeNull();
    expect(f.componentInstance.control.value).toBe(4);

    await abrir();
    tecla('Tab');
    expect(document.querySelector('.ss-panel')).toBeNull();
  });

  it('escribir una letra con el campo cerrado lo abre ya buscando; ↓ y Enter también lo abren', async () => {
    tecla('d', boton());
    await f.whenStable();
    f.detectChanges();
    expect(buscador().value).toBe('d');
    expect(textos()).toContain('Débito ··7992');
    tecla('Escape');
    tecla('ArrowDown', boton());
    expect(document.querySelector('.ss-panel')).not.toBeNull();
  });

  it('el botón de limpiar quita la selección solo si el campo es opcional', async () => {
    f.componentInstance.control.setValue(2);
    f.detectChanges();
    const limpiar = el().querySelector('.ss-limpiar') as HTMLButtonElement;
    expect(limpiar).not.toBeNull();
    limpiar.click();
    f.detectChanges();
    expect(f.componentInstance.control.value).toBeNull();
    expect(f.componentInstance.ultima).toBeNull();
    expect(document.querySelector('.ss-panel')).toBeNull(); // limpiar no abre la lista

    f.componentInstance.control.setValue(2);
    f.componentInstance.permitirVacio = false;
    f.detectChanges();
    expect(el().querySelector('.ss-limpiar')).toBeNull();
  });

  it('cargando o deshabilitado no se abre; sin opciones lo dice', async () => {
    f.componentInstance.cargando = true;
    f.detectChanges();
    expect(boton().disabled).toBeTrue();
    expect(el().querySelector('.ss-esqueleto')).not.toBeNull();
    boton().click();
    f.detectChanges();
    expect(document.querySelector('.ss-panel')).toBeNull();

    f.componentInstance.cargando = false;
    f.componentInstance.control.disable();
    f.detectChanges();
    expect(boton().disabled).toBeTrue();

    f.componentInstance.control.enable();
    f.componentInstance.opciones = [];
    f.detectChanges();
    await abrir();
    expect(document.querySelector('.ss-sin-resultados')?.textContent).toContain('No hay opciones');
  });

  it('una opción deshabilitada no se puede elegir', async () => {
    f.componentInstance.opciones = [{ valor: 1, etiqueta: 'Libre' }, { valor: 2, etiqueta: 'Bloqueada', deshabilitada: true }];
    f.detectChanges();
    await abrir();
    (document.querySelectorAll('[role=option]')[1] as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.control.value).toBeNull();
    expect(document.querySelector('.ss-panel')).not.toBeNull();
  });

  it('abrirAlMostrar abre la lista en cuanto aparece (editor en línea de una celda) y al cerrarla avisa que fue «tocado»', async () => {
    TestBed.resetTestingModule();
    configurarTestBed([EditorEnLineaComponent]);
    const g = TestBed.createComponent(EditorEnLineaComponent);
    g.detectChanges();
    await g.whenStable();
    g.detectChanges();
    expect(document.querySelector('.ss-panel')).not.toBeNull();
    expect(document.querySelector('.ss-opcion--activa')?.textContent).toContain('Mastercard'); // la elegida (valor 2)
    (document.querySelector('input.ss-buscador') as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    g.detectChanges();
    expect(g.componentInstance.editando).toBeFalse(); // el editor desaparece y su capa no queda huérfana en <body>
    expect(document.querySelector('.ss-panel')).toBeNull();
  });
});
