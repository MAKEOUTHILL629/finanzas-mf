import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ItemPlasticoCatalogo } from '../../../modelos/catalogos';
import { CatalogosService } from '../../../services/catalogos.service';
import { configurarTestBed, cuentaItem, errorHttp, esperar, responderCatalogos, tarjetaItem, verificarHttp } from '../../../testing/erp-testing';
import { SelectProductoComponent } from './select-producto.component';
import { GRUPO_CREDITO, GRUPO_CUENTAS, GRUPO_DEBITO, claveProducto, esTarjetaDeCredito, gruposDe4, opcionesDeProductos, parsearProducto, productoPorUltimos4 } from './productos.helpers';

const plastico = (id: number, ultimos4: string, esActivo = true): ItemPlasticoCatalogo => ({ id, ultimos4, esActivo, vigenteDesde: null, vigenteHasta: null });

const AMEX = tarjetaItem(1, 'American Express', { etiqueta: 'American Express ··1927', ultimos4Activo: '1927', plasticos: [plastico(1, '1927'), plastico(2, '0088', false), plastico(3, '9587', false)] });
const MASTER = tarjetaItem(2, 'Mastercard', { etiqueta: 'Mastercard ··9491', ultimos4Activo: '9491', plasticos: [plastico(4, '9491'), plastico(5, '5052', false)] });
const DEBITO = tarjetaItem(3, 'Mastercard', { tipo: 'DEBITO', cuentaId: 20, etiqueta: 'Débito ··7992', ultimos4Activo: '7992', plasticos: [plastico(6, '7992'), plastico(7, '4278', false)] });
const PRINCIPAL = cuentaItem(20, 'Bancolombia Principal', { ultimos4: '3698', esPrincipal: true });
const PADRE = cuentaItem(21, 'Bancolombia Padre', { ultimos4: '4248' });
const VIEJA = cuentaItem(22, 'Cuenta vieja', { ultimos4: '1111', activa: false });
const TARJETAS = [AMEX, MASTER, DEBITO];
const CUENTAS = [PRINCIPAL, PADRE, VIEJA];

describe('productos.helpers', () => {
  it('claves: se arman y se leen sin confundir una tarjeta con una cuenta del mismo id', () => {
    expect(claveProducto('TARJETA', 3)).toBe('t:3');
    expect(claveProducto('CUENTA', 3)).toBe('c:3');
    expect(parsearProducto('t:3')).toEqual({ tipo: 'TARJETA', id: 3 });
    expect(parsearProducto('c:20')).toEqual({ tipo: 'CUENTA', id: 20 });
    for (const mala of [null, undefined, '', 'x:1', 't:0', 't:', 't:-1', 12, 'tarjeta']) expect(parsearProducto(mala)).toBeNull();
  });

  it('gruposDe4 separa los dígitos de la lista de una cuenta o tarjeta', () => {
    expect(gruposDe4('3698, 4278')).toEqual(['3698', '4278']);
    expect(gruposDe4('1927;9587')).toEqual(['1927', '9587']);
    expect(gruposDe4('12345,67')).toEqual([]);
    expect(gruposDe4(null)).toEqual([]);
  });

  it('opciones: tres grupos (crédito, débito, cuentas) en ese orden; la cuenta inactiva solo si ya estaba elegida', () => {
    const o = opcionesDeProductos(TARJETAS, CUENTAS);
    expect(o.map((x) => [x.valor, x.grupo])).toEqual([
      ['t:1', GRUPO_CREDITO], ['t:2', GRUPO_CREDITO], ['t:3', GRUPO_DEBITO], ['c:20', GRUPO_CUENTAS], ['c:21', GRUPO_CUENTAS],
    ]);
    // la tarjeta muestra sus plásticos anteriores y la de débito, su cuenta
    expect(o[0].detalle).toBe('antes ··0088, ··9587');
    expect(o[2].detalle).toBe('cuenta Bancolombia Principal · antes ··4278');
    expect(opcionesDeProductos(TARJETAS, CUENTAS, { valorActual: 'c:22' }).map((x) => x.valor)).toContain('c:22');
  });

  it('opciones: se pueden ocultar crédito, débito o cuentas', () => {
    expect(opcionesDeProductos(TARJETAS, CUENTAS, { incluirDebito: false, incluirCuentas: false }).map((x) => x.valor)).toEqual(['t:1', 't:2']);
    expect(opcionesDeProductos(TARJETAS, CUENTAS, { incluirCredito: false }).map((x) => x.valor)).toEqual(['t:3', 'c:20', 'c:21']);
  });

  describe('productoPorUltimos4', () => {
    it('encuentra la tarjeta por el plástico vigente o por uno anterior', () => {
      expect(productoPorUltimos4('1927', TARJETAS, CUENTAS, 'TC')).toBe('t:1');
      expect(productoPorUltimos4('0088', TARJETAS, CUENTAS, 'TC')).toBe('t:1');
      expect(productoPorUltimos4('9587', TARJETAS, CUENTAS, 'TC')).toBe('t:1');
      expect(productoPorUltimos4('5052', TARJETAS, CUENTAS, 'TC')).toBe('t:2');
      expect(productoPorUltimos4(' 9491 ', TARJETAS, CUENTAS, 'TC')).toBe('t:2');
    });

    it('un aviso de cuenta va a la tarjeta de débito (también sus plásticos anteriores) o a la cuenta', () => {
      expect(productoPorUltimos4('7992', TARJETAS, CUENTAS, 'CUENTA')).toBe('t:3');
      expect(productoPorUltimos4('4278', TARJETAS, CUENTAS, 'CUENTA')).toBe('t:3');
      expect(productoPorUltimos4('3698', TARJETAS, CUENTAS, 'CUENTA')).toBe('c:20');
      expect(productoPorUltimos4('4248', TARJETAS, CUENTAS, null)).toBe('c:21');
    });

    it('no mezcla clases: un aviso de tarjeta de crédito no se asigna a una cuenta ni a un débito, ni al revés', () => {
      expect(productoPorUltimos4('7992', TARJETAS, CUENTAS, 'TC')).toBeNull();
      expect(productoPorUltimos4('3698', TARJETAS, CUENTAS, 'TC')).toBeNull();
      expect(productoPorUltimos4('1927', TARJETAS, CUENTAS, 'CUENTA')).toBeNull();
    });

    it('si el débito y la cuenta comparten los dígitos (convención antigua «3698,4278») gana la tarjeta de débito', () => {
      const cuenta = cuentaItem(30, 'Ahorros', { ultimos4: '3698,7992' });
      expect(productoPorUltimos4('7992', TARJETAS, [cuenta], 'CUENTA')).toBe('t:3');
    });

    it('no adivina: dígitos de dos tarjetas vigentes, desconocidos o mal escritos → null', () => {
      const otra = tarjetaItem(9, 'Visa', { ultimos4Activo: '1927', plasticos: [plastico(9, '1927')] });
      expect(productoPorUltimos4('1927', [AMEX, otra], CUENTAS, 'TC')).toBeNull();
      expect(productoPorUltimos4('0000', TARJETAS, CUENTAS, 'TC')).toBeNull();
      for (const mala of [null, undefined, '', '12', '12345', 'abcd']) expect(productoPorUltimos4(mala, TARJETAS, CUENTAS)).toBeNull();
    });

    it('entre dos candidatos prefiere al único que sigue vigente', () => {
      const vieja = tarjetaItem(8, 'Visa', { ultimos4Activo: '5555', plasticos: [plastico(8, '1927', false), plastico(10, '5555')] });
      expect(productoPorUltimos4('1927', [AMEX, vieja], [], 'TC')).toBe('t:1');
    });
  });

  it('esTarjetaDeCredito distingue la compra a cuotas del movimiento de cuenta', () => {
    expect(esTarjetaDeCredito('t:1', TARJETAS)).toBeTrue();
    expect(esTarjetaDeCredito('t:3', TARJETAS)).toBeFalse();
    expect(esTarjetaDeCredito('c:20', TARJETAS)).toBeFalse();
    expect(esTarjetaDeCredito(null, TARJETAS)).toBeFalse();
    expect(esTarjetaDeCredito('t:99', TARJETAS)).toBeFalse();
  });
});

@Component({
  template: `<app-select-producto inputId="p" [formControl]="control" [ultimos4]="ultimos4" [instrumento]="instrumento" (autoseleccionado)="auto = $event" (elegido)="elegido = $event"></app-select-producto>`,
})
class AnfitrionComponent {
  control = new FormControl<string | null>(null);
  ultimos4: string | null = null;
  instrumento: 'TC' | 'CUENTA' | null = null;
  auto: { clave: string; ultimos4: string } | null = null;
  elegido: unknown = 'sin evento';
}

describe('SelectProductoComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(opciones: { ultimos4?: string | null; instrumento?: 'TC' | 'CUENTA' | null; valor?: string | null } = {}) {
    TestBed.resetTestingModule();
    configurarTestBed([AnfitrionComponent]);
    const f = TestBed.createComponent(AnfitrionComponent);
    f.componentInstance.ultimos4 = opciones.ultimos4 ?? null;
    f.componentInstance.instrumento = opciones.instrumento ?? null;
    if (opciones.valor !== undefined) f.componentInstance.control.setValue(opciones.valor);
    f.detectChanges();
    return f;
  }

  const select = (f: { nativeElement: HTMLElement }) => f.nativeElement.querySelector('select') as HTMLSelectElement;
  const etiquetas = (f: { nativeElement: HTMLElement }) => Array.from(select(f).querySelectorAll('optgroup')).map((g) => [g.label, Array.from(g.querySelectorAll('option')).map((o) => o.textContent?.trim())]);

  it('muestra un esqueleto mientras cargan y luego las tres secciones agrupadas', async () => {
    const f = iniciar();
    expect(f.nativeElement.querySelector('.sp--cargando')).not.toBeNull();
    expect(select(f).disabled).toBeTrue();
    responderCatalogos({ tarjetas: TARJETAS, cuentas: CUENTAS });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.sp--cargando')).toBeNull();
    expect(etiquetas(f)).toEqual([
      [GRUPO_CREDITO, ['American Express ··1927 — antes ··0088, ··9587', 'Mastercard ··9491 — antes ··5052']],
      [GRUPO_DEBITO, ['Débito ··7992 — cuenta Bancolombia Principal · antes ··4278']],
      [GRUPO_CUENTAS, ['Bancolombia Principal ··3698', 'Bancolombia Padre ··4248']],
    ]);
  });

  it('entrega la clave elegida al formulario y avisa con el producto elegido', async () => {
    const f = iniciar();
    responderCatalogos({ tarjetas: TARJETAS, cuentas: CUENTAS });
    await f.whenStable();
    f.detectChanges();
    select(f).value = 't:3';
    select(f).dispatchEvent(new Event('change'));
    expect(f.componentInstance.control.value).toBe('t:3');
    expect(f.componentInstance.elegido).toEqual({ tipo: 'TARJETA', id: 3 });
    select(f).value = '';
    select(f).dispatchEvent(new Event('change'));
    expect(f.componentInstance.control.value).toBeNull();
  });

  it('elige solo el producto de los últimos 4 y lo avisa; no pisa lo que el formulario ya traía ni lo que el usuario eligió', async () => {
    const f = iniciar({ ultimos4: '0088', instrumento: 'TC' });
    responderCatalogos({ tarjetas: TARJETAS, cuentas: CUENTAS });
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.control.value).toBe('t:1');
    expect(f.componentInstance.auto).toEqual({ clave: 't:1', ultimos4: '0088' });
    expect(select(f).value).toBe('t:1');

    const g = iniciar({ ultimos4: '0088', instrumento: 'TC', valor: 't:2' });
    responderCatalogos({ tarjetas: TARJETAS, cuentas: CUENTAS });
    await g.whenStable();
    expect(g.componentInstance.control.value).toBe('t:2');
    expect(g.componentInstance.auto).toBeNull();
  });

  it('elegirPorUltimos4 elige el producto a pedido; sin coincidencia deja todo igual', async () => {
    const f = iniciar({ instrumento: 'CUENTA' });
    responderCatalogos({ tarjetas: TARJETAS, cuentas: CUENTAS });
    await f.whenStable();
    f.detectChanges();
    const c = f.debugElement.children[0].componentInstance as SelectProductoComponent;
    expect(c.elegirPorUltimos4('9999')).toBeFalse();
    expect(f.componentInstance.control.value).toBeNull();
    expect(c.elegirPorUltimos4('3698')).toBeTrue();
    expect(f.componentInstance.control.value).toBe('c:20');
  });

  it('un error de carga se explica y se puede reintentar; sin nada registrado lo dice con enlace para crear', async () => {
    const f = iniciar();
    errorHttp(esperar('GET', 'lookup'), 500, {});
    f.detectChanges();
    const aviso = f.nativeElement.querySelector('[role=alert]') as HTMLElement;
    expect(aviso.textContent).toContain('Reintentar');
    (aviso.querySelector('button') as HTMLButtonElement).click();
    responderCatalogos({ tarjetas: [], cuentas: [] });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No hay tarjetas ni cuentas registradas');
    expect(select(f).disabled).toBeTrue();
  });

  it('conserva la selección del formulario aunque el catálogo llegue después', async () => {
    const f = iniciar({ valor: 'c:22' }); // cuenta inactiva: no se pierde
    responderCatalogos({ tarjetas: TARJETAS, cuentas: CUENTAS });
    await f.whenStable();
    f.detectChanges();
    expect(select(f).value).toBe('c:22');
    expect(TestBed.inject(CatalogosService).datos('cuentas').length).toBe(3);
  });
});
