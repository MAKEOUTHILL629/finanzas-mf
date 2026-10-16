import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { COMPONENTES_UI, DIRECTIVAS_UI } from '../../../testing/erp-testing';
import { AccionUI } from '../acciones/acciones.component';
import { DefinicionFiltro, EstadoFiltros, estadoVacio, resumenValor, tieneValor } from './filter-bar.types';

const FILTROS: DefinicionFiltro[] = [
  {
    id: 'personas',
    tipo: 'seleccion',
    etiqueta: 'Persona',
    icono: 'person',
    multiple: true,
    opciones: [
      { valor: 1, etiqueta: 'Felipe' },
      { valor: 2, etiqueta: 'Andrés' },
      { valor: 3, etiqueta: 'Papá' },
    ],
  },
  {
    id: 'tarjeta',
    tipo: 'seleccion',
    etiqueta: 'Tarjeta',
    opciones: [
      { valor: 10, etiqueta: 'Visa ··1927', grupo: 'Activas' },
      { valor: 11, etiqueta: 'Amex ··9587', grupo: 'Históricas' },
    ],
  },
  { id: 'fechas', tipo: 'fechas', etiqueta: 'Fecha' },
  { id: 'cuotas', tipo: 'numero', etiqueta: 'Cuotas' },
  { id: 'incompletas', tipo: 'interruptor', etiqueta: 'Sin responsables' },
];

@Component({
  template: `<app-filter-bar
    placeholder="Buscar compras"
    [segmentos]="segmentos"
    [filtros]="filtros"
    [estado]="estado"
    (estadoChange)="estado = $event; cambios.push($event)"
  ></app-filter-bar>`,
})
class AnfitrionFiltrosComponent {
  segmentos = [
    { valor: 'todas', etiqueta: 'Todas', cantidad: 9 },
    { valor: 'pendientes', etiqueta: 'Pendientes', cantidad: 4 },
    { valor: 'pagadas', etiqueta: 'Pagadas', cantidad: 5 },
  ];
  filtros = FILTROS;
  estado: EstadoFiltros = estadoVacio('todas');
  cambios: EstadoFiltros[] = [];
}

describe('FilterBarComponent', () => {
  let f: ComponentFixture<AnfitrionFiltrosComponent>;
  const el = () => f.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AnfitrionFiltrosComponent, ...COMPONENTES_UI],
      imports: [RouterModule.forRoot([]), ...DIRECTIVAS_UI],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    f = TestBed.createComponent(AnfitrionFiltrosComponent);
    f.detectChanges();
  });

  it('el buscador espera 300 ms tras dejar de escribir y avisa una sola vez', fakeAsync(() => {
    const input = q('.fb-buscador__input') as HTMLInputElement;
    for (const t of ['c', 'ca', 'cas', 'casa']) {
      input.value = t;
      input.dispatchEvent(new Event('input'));
      tick(100);
    }
    expect(f.componentInstance.cambios.length).toBe(0);
    tick(300);
    expect(f.componentInstance.cambios.length).toBe(1);
    expect(f.componentInstance.estado.busqueda).toBe('casa');
  }));

  it('borrar la búsqueda avisa al instante', fakeAsync(() => {
    const input = q('.fb-buscador__input') as HTMLInputElement;
    input.value = 'nevera';
    input.dispatchEvent(new Event('input'));
    tick(300);
    f.detectChanges();
    (q('.fb-buscador__limpiar') as HTMLButtonElement).click();
    expect(f.componentInstance.estado.busqueda).toBe('');
  }));

  it('los estados rápidos muestran su cantidad y cambian el segmento', () => {
    const items = qa('.fb-segmentos .erp-segmented__item');
    expect(items.map((i) => i.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Todas9', 'Pendientes4', 'Pagadas5']);
    items[1].click();
    f.detectChanges();
    expect(f.componentInstance.estado.segmento).toBe('pendientes');
    expect(q('.fb-segmentos')!.style.getPropertyValue('--seg-index')).toBe('1');
  });

  it('un chip de selección múltiple abre su panel, elige varias opciones y se resume', () => {
    (qa('.fb-chip')[0]).click();
    f.detectChanges();
    expect(q('.fb-panel')).not.toBeNull();
    const opciones = qa('.fb-opcion');
    expect(opciones.length).toBe(3);
    opciones[0].click();
    f.detectChanges();
    opciones[1].click();
    f.detectChanges();
    expect(f.componentInstance.estado.valores['personas']).toEqual([1, 2]);
    expect(qa('.fb-chip')[0].textContent).toContain('Felipe +1');
    expect(qa('.fb-chip')[0].classList.contains('fb-chip--activo')).toBeTrue();
    expect(q('.fb-panel')).not.toBeNull(); // sigue abierto para elegir más
  });

  it('una selección simple cierra el panel y agrupa las opciones', () => {
    (qa('.fb-chip')[1]).click();
    f.detectChanges();
    expect(qa('.fb-panel__grupo').map((g) => g.textContent!.trim())).toEqual(['Activas', 'Históricas']);
    qa('.fb-opcion')[1].click();
    f.detectChanges();
    expect(f.componentInstance.estado.valores['tarjeta']).toBe(11);
    expect(q('.fb-panel')).toBeNull();
  });

  it('el rango de fechas, el número y el interruptor producen valores', () => {
    (qa('.fb-chip')[2]).click();
    f.detectChanges();
    const [desde, hasta] = qa('.fb-panel__fechas input') as HTMLInputElement[];
    desde.value = '2026-10-01';
    desde.dispatchEvent(new Event('change'));
    hasta.value = '2026-10-31';
    hasta.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.estado.valores['fechas']).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });

    (qa('.fb-chip')[3]).click();
    f.detectChanges();
    const numero = q('.fb-panel__numero input') as HTMLInputElement;
    numero.value = '12';
    numero.dispatchEvent(new Event('change'));
    expect(f.componentInstance.estado.valores['cuotas']).toBe(12);

    (qa('.fb-chip')[4]).click();
    f.detectChanges();
    const casilla = q('.fb-panel__interruptor input') as HTMLInputElement;
    casilla.click();
    expect(f.componentInstance.estado.valores['incompletas']).toBeTrue();
  });

  it('cuenta los filtros activos y «Limpiar filtros» los quita todos', fakeAsync(() => {
    (qa('.fb-chip')[0]).click();
    f.detectChanges();
    qa('.fb-opcion')[2].click();
    f.detectChanges();
    qa('.fb-segmentos .erp-segmented__item')[2].click();
    f.detectChanges();
    expect(q('.fb-resumen__texto')!.textContent).toContain('2 filtros activos');
    (q('.fb-resumen__limpiar') as HTMLButtonElement).click();
    f.detectChanges();
    expect(f.componentInstance.estado).toEqual(estadoVacio('todas'));
    expect(q('.fb-resumen')).toBeNull();
  }));

  it('la «x» de un chip activo quita solo ese filtro', () => {
    (qa('.fb-chip')[0]).click();
    f.detectChanges();
    qa('.fb-opcion')[0].click();
    f.detectChanges();
    (q('.fb-chip__quitar') as HTMLButtonElement).click();
    f.detectChanges();
    expect(f.componentInstance.estado.valores['personas']).toBeUndefined();
  });

  it('Escape y el clic fuera cierran el panel', () => {
    (qa('.fb-chip')[0]).click();
    f.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(q('.fb-panel')).toBeNull();
    (qa('.fb-chip')[0]).click();
    f.detectChanges();
    document.body.click();
    f.detectChanges();
    expect(q('.fb-panel')).toBeNull();
  });
});

describe('tipos de filtro', () => {
  it('tieneValor y resumenValor', () => {
    const sel = FILTROS[0];
    expect(tieneValor(sel, [])).toBeFalse();
    expect(tieneValor(sel, [1])).toBeTrue();
    expect(resumenValor(sel, [2])).toBe('Andrés');
    expect(resumenValor(sel, [2, 3])).toBe('Andrés +1');
    const fechas = FILTROS[2];
    expect(tieneValor(fechas, { desde: null, hasta: null })).toBeFalse();
    expect(resumenValor(fechas, { desde: '2026-10-01', hasta: null })).toBe('Desde 2026-10-01');
    expect(tieneValor(FILTROS[3], 0)).toBeTrue(); // 0 cuotas es un valor válido
    expect(tieneValor(FILTROS[4], false)).toBeFalse();
  });
});

@Component({
  template: `<app-acciones [principal]="principal" [secundarias]="secundarias" (accion)="clics.push($event)"></app-acciones>`,
})
class AnfitrionAccionesComponent {
  principal: AccionUI = { id: 'nueva', etiqueta: 'Nueva compra', icono: 'add', tooltip: 'Registrar una compra' };
  secundarias: AccionUI[] = [
    { id: 'csv', etiqueta: 'Carga masiva', icono: 'upload_file' },
    { id: 'refrescar', etiqueta: 'Actualizar', icono: 'refresh', cargando: false },
    { id: 'bloqueada', etiqueta: 'Bloqueada', icono: 'lock', deshabilitada: true },
  ];
  clics: string[] = [];
}

describe('AccionesComponent', () => {
  let f: ComponentFixture<AnfitrionAccionesComponent>;
  const el = () => f.nativeElement as HTMLElement;
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AnfitrionAccionesComponent, ...COMPONENTES_UI],
      imports: [RouterModule.forRoot([]), ...DIRECTIVAS_UI],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    f = TestBed.createComponent(AnfitrionAccionesComponent);
    f.detectChanges();
  });

  it('en escritorio: secundarias con texto y la principal destacada', () => {
    const botones = qa('.acc--escritorio button');
    expect(botones.map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['upload_fileCarga masiva', 'refreshActualizar', 'lockBloqueada', 'addNueva compra']);
    expect(botones[3].classList.contains('erp-btn--primary')).toBeTrue();
    expect((botones[2] as HTMLButtonElement).disabled).toBeTrue();
  });

  it('cada acción emite su id; una deshabilitada no', () => {
    qa('.acc--escritorio button')[0].click();
    qa('.acc--escritorio button')[3].click();
    qa('.acc--escritorio button')[2].click();
    expect(f.componentInstance.clics).toEqual(['csv', 'nueva']);
  });

  it('en móvil hay un único botón flotante con la acción principal y su nombre accesible', () => {
    const fab = qa('.acc--movil .acc__fab');
    expect(fab.length).toBe(1);
    expect(fab[0].getAttribute('aria-label')).toBe('Nueva compra');
    fab[0].click();
    expect(f.componentInstance.clics).toEqual(['nueva']);
  });

  it('«Más acciones» abre el menú con las secundarias y se cierra al elegir', () => {
    (qa('.acc__mas button')[0]).click();
    f.detectChanges();
    const items = qa('.acc__item');
    expect(items.map((i) => i.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['upload_fileCarga masiva', 'refreshActualizar', 'lockBloqueada']);
    items[0].click();
    f.detectChanges();
    expect(f.componentInstance.clics).toEqual(['csv']);
    expect(qa('.acc__item').length).toBe(0);
  });

  it('una acción cargando bloquea los clics', () => {
    f.componentInstance.secundarias = [{ id: 'refrescar', etiqueta: 'Actualizando…', icono: 'sync', cargando: true }];
    f.detectChanges();
    qa('.acc--escritorio button')[0].click();
    expect(f.componentInstance.clics).toEqual([]);
    expect(qa('.acc--escritorio button')[0].getAttribute('aria-busy')).toBe('true');
  });
});
