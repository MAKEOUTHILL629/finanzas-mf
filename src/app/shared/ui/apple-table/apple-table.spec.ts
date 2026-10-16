import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { COMPONENTES_UI, DIRECTIVAS_UI, estilosDePrueba } from '../../../testing/erp-testing';
import { CambioPagina, ColumnaTabla, OrdenTabla } from './apple-table.types';
import { compararValores, formatearCelda } from './apple-table.component';

interface Fila {
  id: number;
  nombre: string;
  monto: number;
  fecha: string;
  estado: string;
}

const filas = (n: number): Fila[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, nombre: `Compra ${String(i + 1).padStart(2, '0')}`, monto: (n - i) * 1000, fecha: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, estado: i % 2 ? 'Pagado' : 'Pendiente' }));

const COLUMNAS: ColumnaTabla<Fila>[] = [
  { id: 'nombre', titulo: 'Nombre', valor: (f) => f.nombre, prioridad: 1, anchoMin: 160 },
  { id: 'monto', titulo: 'Monto', valor: (f) => f.monto, formato: 'moneda', prioridad: 1, anchoMin: 120 },
  { id: 'fecha', titulo: 'Fecha', valor: (f) => new Date(f.fecha), formato: 'fechaCorta', prioridad: 2, anchoMin: 120 },
  { id: 'estado', titulo: 'Estado', valor: (f) => f.estado, prioridad: 2, anchoMin: 120 },
  { id: 'extra', titulo: 'Extra', valor: () => 'x', prioridad: 3, anchoMin: 150 },
];

@Component({
  template: `
    <div [style.width.px]="ancho">
      <app-apple-table
        [columnas]="columnas"
        [filas]="datos"
        clave="id"
        [almacenamiento]="almacen"
        [tamanoPagina]="tamano"
        [filaClicable]="true"
        [servidor]="servidor"
        [total]="total"
        [cargando]="cargando"
        [pie]="pie"
        [columnaTitulo]="titulo"
        [anchoAcciones]="acciones"
        [filaClase]="claseFila"
        textoVacio="Nada por aquí"
        (filaClick)="clicados.push($event.id)"
        (paginaChange)="paginas.push($event)"
        (ordenChange)="ordenes.push($event)"
      >
        <ng-template appCelda="estado" let-f><span class="celda-estado">[{{ f.estado }}]</span></ng-template>
        <ng-template appAccionesFila let-f><button type="button" class="accion-fila">ver {{ f.id }}</button></ng-template>
      </app-apple-table>
    </div>
  `,
})
class AnfitrionTablaComponent {
  ancho = 1000;
  columnas = COLUMNAS;
  datos: Fila[] = filas(25);
  almacen: string | null = null;
  tamano = 10;
  servidor = false;
  total = 0;
  cargando = false;
  pie: Record<string, string> | null = null;
  titulo: string | null = null;
  acciones = 120;
  claseFila = (f: Fila): string => (f.id === 2 ? 'apt-fila--activa' : '');
  clicados: number[] = [];
  paginas: CambioPagina[] = [];
  ordenes: (OrdenTabla | null)[] = [];
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('AppleTableComponent', () => {
  let f: ComponentFixture<AnfitrionTablaComponent>;
  const el = () => f.nativeElement as HTMLElement;
  const q = (sel: string) => el().querySelector(sel) as HTMLElement | null;
  const qa = (sel: string) => Array.from(el().querySelectorAll<HTMLElement>(sel));
  const filasTexto = () => qa('tbody tr').map((tr) => tr.querySelector('td')!.textContent!.trim());

  beforeEach(async () => {
    estilosDePrueba();
    localStorage.removeItem('finanzas-tabla-prueba');
    await TestBed.configureTestingModule({
      declarations: [AnfitrionTablaComponent, ...COMPONENTES_UI],
      imports: [...DIRECTIVAS_UI],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    f = TestBed.createComponent(AnfitrionTablaComponent);
    f.detectChanges();
    await esperar(60); // ResizeObserver
    f.detectChanges();
  });
  afterEach(() => localStorage.removeItem('finanzas-tabla-prueba'));

  it('muestra encabezados, la primera página y el rango de registros', () => {
    expect(qa('thead th button span').map((b) => b.textContent!.trim())).toContain('Nombre');
    expect(qa('tbody tr').length).toBe(10);
    expect(q('.apt-paginacion__rango')!.textContent).toContain('Mostrando 1–10 de 25');
    expect(q('.apt-contador')!.textContent).toContain('25');
  });

  it('pagina: siguiente, número y cambio de tamaño; la última página tiene el resto', () => {
    (qa('button[aria-label="Página siguiente"]')[0]).click();
    f.detectChanges();
    expect(q('.apt-paginacion__rango')!.textContent).toContain('Mostrando 11–20 de 25');
    expect(filasTexto()[0]).toBe('Compra 11');
    (qa('button[aria-label="Última página"]')[0]).click();
    f.detectChanges();
    expect(qa('tbody tr').length).toBe(5);
    const tam = q('.apt-paginacion__tamano select') as HTMLSelectElement;
    tam.value = '50';
    tam.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(qa('tbody tr').length).toBe(25);
    expect(q('button[aria-label="Página siguiente"]')).toBeNull(); // una sola página: no hay navegación
  });

  it('ordena: ascendente → descendente → sin orden, con aria-sort y números por magnitud', () => {
    const th = () => qa('thead th')[1];
    const boton = () => th().querySelector('button') as HTMLButtonElement;
    boton().click();
    f.detectChanges();
    expect(th().getAttribute('aria-sort')).toBe('ascending');
    expect(qa('tbody tr td:nth-child(2)')[0].textContent).toContain('$1,000.00');
    boton().click();
    f.detectChanges();
    expect(th().getAttribute('aria-sort')).toBe('descending');
    expect(qa('tbody tr td:nth-child(2)')[0].textContent).toContain('$25,000.00');
    boton().click();
    f.detectChanges();
    expect(th().getAttribute('aria-sort')).toBe('none');
    expect(filasTexto()[0]).toBe('Compra 01');
    expect(f.componentInstance.ordenes.map((o) => o?.direccion ?? null)).toEqual(['asc', 'desc', null]);
  });

  it('usa la plantilla de celda de la columna y la de acciones de la fila', () => {
    expect(q('tbody .celda-estado')!.textContent).toBe('[Pendiente]');
    expect(qa('tbody .accion-fila').length).toBe(10);
  });

  it('un clic o Enter en la fila avisa con ella; el clic en una acción no', () => {
    qa('tbody tr')[2].click();
    qa('tbody tr')[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    qa('tbody .accion-fila')[0].click();
    expect(f.componentInstance.clicados).toEqual([3, 4]);
  });

  it('elige las columnas visibles y lo recuerda en el navegador', async () => {
    f.componentInstance.almacen = 'prueba';
    f.detectChanges();
    (q('.apt-columnas button') as HTMLButtonElement).click();
    f.detectChanges();
    const opciones = qa('.apt-menu__opcion');
    expect(opciones.map((o) => o.textContent!.trim())).toEqual(['Fecha', 'Estado', 'Extra']); // las de prioridad 1 no se pueden ocultar
    (opciones[0].querySelector('input') as HTMLInputElement).click();
    f.detectChanges();
    expect(qa('thead th').some((t) => t.textContent!.includes('Fecha'))).toBeFalse();
    expect(JSON.parse(localStorage.getItem('finanzas-tabla-prueba')!).ocultas).toEqual(['fecha']);

    // una tabla nueva con el mismo nombre recuerda la elección
    const g = TestBed.createComponent(AnfitrionTablaComponent);
    g.componentInstance.almacen = 'prueba';
    g.detectChanges();
    await esperar(60);
    g.detectChanges();
    expect((g.nativeElement as HTMLElement).querySelectorAll('thead th').length).toBe(5); // 4 columnas + acciones (Fecha oculta)
  });

  it('sin espacio oculta primero las columnas menos importantes y nunca aparece scroll horizontal', async () => {
    f.componentInstance.ancho = 700;
    f.detectChanges();
    await esperar(120);
    f.detectChanges();
    const titulos = qa('thead th').map((t) => t.textContent!.trim());
    expect(titulos.some((t) => t.includes('Nombre'))).toBeTrue();
    expect(titulos.some((t) => t.includes('Monto'))).toBeTrue();
    expect(titulos.some((t) => t.includes('Extra'))).toBeFalse(); // prioridad 3: la primera en irse
    expect(q('.apt-aviso')!.textContent).toContain('oculta');
    const contenedor = q('.apt-contenedor')!;
    expect(getComputedStyle(contenedor).overflowX).toBe('clip');
  });

  it('si la tabla real no cabe (aunque anchoMin diga que sí) quita columnas hasta que quepa, sin scroll horizontal', async () => {
    const f2 = f;
    f2.componentInstance.columnas = [
      { id: 'nombre', titulo: 'Nombre', valor: (x) => x.nombre, prioridad: 1, anchoMin: 20 },
      { id: 'a', titulo: 'Un encabezado muy largo que nunca cabe', valor: (x) => x.estado, prioridad: 3, anchoMin: 20 },
      { id: 'b', titulo: 'Otro encabezado larguísimo que tampoco cabe', valor: (x) => x.estado, prioridad: 3, anchoMin: 20 },
      { id: 'c', titulo: 'Y un tercer encabezado interminable', valor: (x) => x.estado, prioridad: 2, anchoMin: 20 },
    ];
    f2.componentInstance.ancho = 700;
    f2.detectChanges();
    await esperar(150);
    f2.detectChanges();
    const tabla = q('.apt-tabla') as HTMLElement;
    const contenedor = q('.apt-contenedor') as HTMLElement;
    expect(tabla.offsetWidth).toBeLessThanOrEqual(contenedor.clientWidth + 1);
    expect(qa('thead th').some((t) => t.textContent!.includes('Nombre'))).toBeTrue(); // la de prioridad 1 nunca se quita
    expect(q('.apt-aviso')!.textContent).toContain('oculta');
  });

  it('en pantallas angostas cada fila es una tarjeta con lo esencial y el resto al expandir', async () => {
    f.componentInstance.ancho = 380;
    f.detectChanges();
    await esperar(120);
    f.detectChanges();
    expect(q('table')).toBeNull();
    expect(qa('.apt-item').length).toBe(10);
    expect(qa('.apt-item')[0].textContent).toContain('Compra 01');
    expect(qa('.apt-item')[0].textContent).not.toContain('Extra');
    (qa('.apt-item__mas')[0]).click();
    f.detectChanges();
    expect(qa('.apt-item')[0].querySelector('.apt-item__detalle')!.textContent).toContain('Extra');
    expect(qa('.apt-item')[0].querySelector('.accion-fila')).not.toBeNull();
  });

  it('en la tarjeta móvil el título es la columna elegida y no se repite en el resto', async () => {
    f.componentInstance.ancho = 380;
    f.componentInstance.titulo = 'monto';
    f.detectChanges();
    await esperar(120);
    f.detectChanges();
    const item = qa('.apt-item')[0];
    expect(item.querySelector('.apt-item__nombre')!.textContent).toContain('$25,000.00');
    expect(Array.from(item.querySelectorAll('.apt-item__meta dt')).map((d) => d.textContent!.trim())).toEqual(['Nombre']);
  });

  it('el ancho reservado para las acciones decide cuántas columnas caben', async () => {
    f.componentInstance.ancho = 900;
    f.detectChanges();
    await esperar(120);
    f.detectChanges();
    const antes = qa('thead th').length;
    f.componentInstance.acciones = 400;
    f.detectChanges();
    await esperar(120);
    f.detectChanges();
    expect(qa('thead th').length).toBeLessThan(antes);
  });

  it('en modo servidor solo pinta lo recibido y avisa de los cambios', () => {
    f.componentInstance.servidor = true;
    f.componentInstance.datos = filas(10);
    f.componentInstance.total = 95;
    f.detectChanges();
    expect(q('.apt-paginacion__rango')!.textContent).toContain('de 95');
    (qa('button[aria-label="Página siguiente"]')[0]).click();
    f.detectChanges();
    expect(f.componentInstance.paginas.at(-1)).toEqual({ pagina: 1, tamano: 10 });
  });

  it('muestra una fila de totales al pie y resalta la fila que indica filaClase', () => {
    expect(q('tfoot')).toBeNull();
    f.componentInstance.pie = { nombre: 'Total', monto: '$325,000.00' };
    f.detectChanges();
    const celdas = qa('tfoot td').map((td) => td.textContent!.trim());
    expect(celdas.slice(0, 2)).toEqual(['Total', '$325,000.00']);
    expect(celdas.length).toBe(qa('thead th').length); // una celda por columna (incluida la de acciones)
    expect(qa('tbody tr')[1].classList.contains('apt-fila--activa')).toBeTrue();
    expect(qa('tbody tr')[0].classList.contains('apt-fila--activa')).toBeFalse();
  });

  it('un enlace o botón dentro de la fila no la abre', () => {
    const enlace = document.createElement('a');
    enlace.href = '#x';
    enlace.textContent = 'ir';
    enlace.addEventListener('click', (e) => e.preventDefault());
    qa('tbody tr')[0].querySelector('td')!.appendChild(enlace);
    enlace.click();
    expect(f.componentInstance.clicados).toEqual([]);
  });

  it('cargando muestra esqueletos y vacío muestra el texto', () => {
    f.componentInstance.cargando = true;
    f.detectChanges();
    expect(qa('.apt-esqueleto app-skeleton').length).toBe(6);
    f.componentInstance.cargando = false;
    f.componentInstance.datos = [];
    f.detectChanges();
    expect(q('.apt-vacio')!.textContent).toContain('Nada por aquí');
  });
});

describe('helpers de la tabla', () => {
  it('formatearCelda da formato de moneda, número, porcentaje y vacío', () => {
    expect(formatearCelda(1234.5, 'moneda')).toBe('$1,234.50');
    expect(formatearCelda(12, 'porcentaje')).toContain('12');
    expect(formatearCelda(null, 'moneda')).toBe('—');
    expect(formatearCelda('hola')).toBe('hola');
    expect(formatearCelda(new Date('2026-10-15T00:00:00Z'), 'fechaCorta')).toContain('2026');
  });

  it('compararValores ordena números, fechas y texto (sin tildes), y deja los vacíos al final', () => {
    expect(compararValores(2, 10)).toBeLessThan(0);
    expect(compararValores('Álvaro', 'beto')).toBeLessThan(0);
    expect(compararValores('Compra 2', 'Compra 10')).toBeLessThan(0); // orden natural
    expect(compararValores(new Date('2026-01-01'), new Date('2026-02-01'))).toBeLessThan(0);
    expect(compararValores(null, 5)).toBeGreaterThan(0);
    expect(compararValores('', undefined)).toBe(0);
  });
});
