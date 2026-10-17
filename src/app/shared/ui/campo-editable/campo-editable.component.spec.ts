import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OpcionSelect } from '../../../modelos/catalogos';
import { configurarTestBed, verificarHttp } from '../../../testing/erp-testing';
import { formatearEntradaMoneda, leerMoneda } from '../../moneda.util';
import { CampoEditableComponent, TipoCampoEditable } from './campo-editable.component';

@Component({
  template: `<app-campo-editable
    etiqueta="Descripción"
    [tipo]="tipo"
    [valor]="valor"
    [faltante]="faltante"
    [requerido]="requerido"
    [soloLectura]="soloLectura"
    [guardando]="guardando"
    [error]="error"
    [min]="min"
    [max]="max"
    [opciones]="opciones"
    sufijo=""
    (guardar)="emitidos.push($event)"
  ></app-campo-editable>`,
})
class AnfitrionComponent {
  tipo: TipoCampoEditable = 'texto';
  valor: string | number | null = null;
  faltante = false;
  requerido = false;
  soloLectura = false;
  guardando = false;
  error: string | null = null;
  min: number | null = null;
  max: number | null = null;
  opciones: OpcionSelect[] = [];
  emitidos: Array<string | number | null> = [];
}

describe('formatearEntradaMoneda / leerMoneda', () => {
  it('agrupa miles con coma, un solo punto decimal y máximo dos decimales', () => {
    expect(formatearEntradaMoneda('1234567')).toBe('1,234,567');
    expect(formatearEntradaMoneda('1234567.5')).toBe('1,234,567.5');
    expect(formatearEntradaMoneda('1234.567')).toBe('1,234.56');
    expect(formatearEntradaMoneda('12.3.4')).toBe('12.34');
    expect(formatearEntradaMoneda('$ 2,400,000 COP')).toBe('2,400,000');
    expect(formatearEntradaMoneda('.5')).toBe('0.5');
    expect(formatearEntradaMoneda('007')).toBe('7');
    expect(formatearEntradaMoneda('')).toBe('');
    expect(formatearEntradaMoneda('abc')).toBe('');
  });

  it('leerMoneda devuelve el número o null', () => {
    expect(leerMoneda('1,234,567.5')).toBe(1234567.5);
    expect(leerMoneda('0')).toBe(0);
    expect(leerMoneda('')).toBeNull();
    expect(leerMoneda('.')).toBeNull();
    expect(leerMoneda(null)).toBeNull();
    expect(leerMoneda(42)).toBe(42);
  });
});

describe('CampoEditableComponent', () => {
  let f: ComponentFixture<AnfitrionComponent>;
  let a: AnfitrionComponent;
  const el = () => f.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s);
  const campo = () => f.debugElement.query(By.directive(CampoEditableComponent)).componentInstance as CampoEditableComponent;

  beforeEach(() => {
    configurarTestBed([AnfitrionComponent]);
    f = TestBed.createComponent(AnfitrionComponent);
    a = f.componentInstance;
  });
  afterEach(() => verificarHttp());

  function pintar(): void {
    f.detectChanges();
  }

  /** Abre el editor, escribe `texto` y pulsa la tecla (o sale del campo). */
  function escribir(texto: string, tecla: 'Enter' | 'Escape' | 'blur' = 'Enter', extra: KeyboardEventInit = {}): HTMLInputElement {
    q<HTMLButtonElement>('.ce-valor')?.click(); // si ya se está editando (tras un error) se sigue en el mismo control
    f.detectChanges();
    const control = q<HTMLInputElement>('.ce-control')!;
    control.value = texto;
    control.dispatchEvent(new Event('input'));
    if (tecla === 'blur') control.dispatchEvent(new Event('blur'));
    else control.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true, ...extra }));
    f.detectChanges();
    return control;
  }

  describe('ver', () => {
    it('muestra el valor; una moneda con el formato de la app; vacío como «—»', () => {
      a.valor = 'Éxito Ibagué';
      pintar();
      expect(q('.ce-texto')!.textContent!.trim()).toBe('Éxito Ibagué');
      a.tipo = 'moneda';
      a.valor = 2400000;
      pintar();
      expect(q('.ce-texto')!.textContent!.trim()).toBe('$2,400,000.00');
      a.valor = null;
      pintar();
      expect(q('.ce-texto')!.textContent!.trim()).toBe('—');
    });

    it('un dato que falta invita a completarlo y se resalta; con valor ya no', () => {
      a.faltante = true;
      pintar();
      expect(q('.ce-texto')!.textContent!.trim()).toBe('Agregar descripción');
      expect(q('.ce--faltante')).not.toBeNull();
      a.valor = 'Algo';
      pintar();
      expect(q('.ce--faltante')).toBeNull();
    });

    it('solo lectura y guardando bloquean la edición', () => {
      a.valor = 'x';
      a.soloLectura = true;
      pintar();
      expect(q<HTMLButtonElement>('.ce-valor')!.disabled).toBe(true);
      expect(q('.ce-icono')).toBeNull();
      a.soloLectura = false;
      a.guardando = true;
      pintar();
      expect(q<HTMLButtonElement>('.ce-valor')!.disabled).toBe(true);
      expect(q('.ce-giro')).not.toBeNull();
    });
  });

  describe('editar texto', () => {
    it('Enter guarda lo escrito (sin espacios sobrantes) y vuelve a la vista con el valor nuevo mientras responde el servidor', () => {
      a.valor = 'Antes';
      pintar();
      escribir('  Después  ');
      expect(a.emitidos).toEqual(['Después']);
      expect(q('.ce-control')).toBeNull();
      expect(q('.ce-texto')!.textContent!.trim()).toBe('Después'); // pendiente

      // el servidor responde: manda el valor guardado
      a.valor = 'Después';
      pintar();
      expect(q('.ce-texto')!.textContent!.trim()).toBe('Después');
    });

    it('si el guardado falla se vuelve al valor anterior y se muestra el error', () => {
      a.valor = 'Antes';
      pintar();
      escribir('Nuevo');
      expect(q('.ce-texto')!.textContent!.trim()).toBe('Nuevo');
      a.error = 'No se pudo guardar';
      pintar();
      expect(q('.ce-texto')!.textContent!.trim()).toBe('Antes');
      expect(q('.ce-error')!.textContent).toContain('No se pudo guardar');
    });

    it('salir del campo también guarda; sin cambios no emite', () => {
      a.valor = 'Igual';
      pintar();
      escribir('Otro', 'blur');
      expect(a.emitidos).toEqual(['Otro']);
      a.valor = 'Otro';
      pintar();
      escribir('Otro', 'Enter');
      expect(a.emitidos).toEqual(['Otro']); // no hubo cambio
    });

    it('Escape cancela sin guardar y vaciar un dato opcional emite null', () => {
      a.valor = 'Antes';
      pintar();
      escribir('Cambio', 'Escape');
      expect(a.emitidos).toEqual([]);
      expect(q('.ce-control')).toBeNull();
      escribir('   ', 'Enter');
      expect(a.emitidos).toEqual([null]);
    });

    it('un dato requerido no se puede dejar vacío', () => {
      a.valor = 'Antes';
      a.requerido = true;
      pintar();
      escribir('   ');
      expect(a.emitidos).toEqual([]);
      expect(q('.ce-control')).not.toBeNull(); // sigue editando
      expect(q('.ce-error')!.textContent).toContain('No puede quedar vacío');
    });
  });

  describe('otros tipos', () => {
    it('moneda: da formato mientras se escribe y emite el número', () => {
      a.tipo = 'moneda';
      a.valor = 100;
      a.requerido = true;
      pintar();
      const control = escribir('1234567.5', 'Enter');
      expect(control.value).toBe('1,234,567.5');
      expect(a.emitidos).toEqual([1234567.5]);
    });

    it('moneda requerida: no acepta 0 ni vacío', () => {
      a.tipo = 'moneda';
      a.valor = 100;
      a.requerido = true;
      pintar();
      escribir('0');
      expect(a.emitidos).toEqual([]);
      expect(q('.ce-error')!.textContent).toContain('mayor a 0');
    });

    it('entero: valida el rango y que sea entero', () => {
      a.tipo = 'entero';
      a.valor = 12;
      a.min = 1;
      a.max = 120;
      a.requerido = true;
      pintar();
      escribir('0');
      expect(q('.ce-error')!.textContent).toContain('Mínimo 1');
      escribir('121');
      expect(q('.ce-error')!.textContent).toContain('Máximo 120');
      escribir('6.5');
      expect(q('.ce-error')!.textContent).toContain('entero');
      expect(a.emitidos).toEqual([]);
      escribir('24');
      expect(a.emitidos).toEqual([24]);
    });

    it('fecha: emite yyyy-MM-dd', () => {
      a.tipo = 'fecha';
      a.valor = '2026-10-01';
      a.requerido = true;
      pintar();
      escribir('2026-10-15');
      expect(a.emitidos).toEqual(['2026-10-15']);
    });

    it('decimal (interés): admite decimales dentro del rango', () => {
      a.tipo = 'decimal';
      a.valor = 1.9;
      a.min = 0;
      a.max = 20;
      pintar();
      escribir('2.35');
      expect(a.emitidos).toEqual([2.35]);
    });

    it('selección: elegir una opción emite su valor; la misma opción no', () => {
      a.tipo = 'seleccion';
      a.valor = 'Pendiente';
      a.requerido = true;
      a.opciones = [{ valor: 'Pendiente', etiqueta: 'Pendiente' }, { valor: 'Pagado', etiqueta: 'Pagado' }];
      pintar();
      campo().elegir('Pendiente');
      expect(a.emitidos).toEqual([]);
      campo().elegir('Pagado');
      expect(a.emitidos).toEqual(['Pagado']);
      campo().elegir(null); // requerido: no se puede vaciar
      expect(a.emitidos).toEqual(['Pagado']);
    });
  });
});
