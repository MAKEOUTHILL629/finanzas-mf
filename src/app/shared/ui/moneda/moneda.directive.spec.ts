import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MonedaDirective } from './moneda.directive';

@Component({
  template: `
    <input id="reactivo" appMoneda min="0.01" [formControl]="monto" />
    <input id="enteros" appMoneda decimales="0" prefijo="" [formControl]="cuota" />
    <input id="trm" appMoneda decimales="4" prefijo="" [formControl]="tasa" />
    <input id="modelo" appMoneda name="modelo" [(ngModel)]="modelo" />
    <input id="tope" appMoneda [max]="tope" [formControl]="conTope" />
  `,
})
class AnfitrionComponent {
  monto = new FormControl<number | null>(null);
  cuota = new FormControl<number | null>(null);
  tasa = new FormControl<number | null>(null);
  modelo: number | null = null;
  tope = 1000;
  conTope = new FormControl<number | null>(null);
}

describe('MonedaDirective', () => {
  let f: ComponentFixture<AnfitrionComponent>;
  let a: AnfitrionComponent;
  const campo = (id: string) => f.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AnfitrionComponent, MonedaDirective],
      imports: [ReactiveFormsModule, FormsModule],
    });
    f = TestBed.createComponent(AnfitrionComponent);
    a = f.componentInstance;
    f.detectChanges();
  });

  /** Lo que hace el navegador al teclear: deja el texto y el cursor, y avisa con un evento `input`. */
  function teclear(id: string, texto: string, cursor = texto.length, inputType = 'insertText', data: string | null = texto.slice(-1)): void {
    const el = campo(id);
    el.focus();
    el.value = texto;
    el.setSelectionRange(cursor, cursor);
    el.dispatchEvent(new InputEvent('input', { inputType, data, bubbles: true }));
  }

  it('no es un campo numérico del navegador y pide teclado decimal', () => {
    expect(campo('reactivo').type).toBe('text');
    expect(campo('reactivo').getAttribute('inputmode')).toBe('decimal');
    expect(campo('enteros').getAttribute('inputmode')).toBe('numeric');
  });

  it('muestra con formato el valor que le pone el formulario, y vacío si es null', () => {
    a.monto.setValue(1500000);
    expect(campo('reactivo').value).toBe('$ 1.500.000');
    a.monto.setValue(1500.5);
    expect(campo('reactivo').value).toBe('$ 1.500,5');
    a.monto.setValue(null);
    expect(campo('reactivo').value).toBe('');
    a.monto.setValue('27900.00' as unknown as number); // el servidor puede mandar el decimal como texto
    expect(campo('reactivo').value).toBe('$ 27.900');
  });

  it('va dando formato mientras se escribe y el formulario recibe el número', () => {
    teclear('reactivo', '1');
    expect(campo('reactivo').value).toBe('$ 1');
    teclear('reactivo', '$ 15');
    teclear('reactivo', '$ 150');
    teclear('reactivo', '$ 1500');
    expect(campo('reactivo').value).toBe('$ 1.500');
    expect(a.monto.value).toBe(1500);
    teclear('reactivo', '$ 1.5000');
    expect(campo('reactivo').value).toBe('$ 15.000');
    expect(a.monto.value).toBe(15000);
  });

  it('vaciar el campo deja null', () => {
    a.monto.setValue(900);
    teclear('reactivo', '', 0, 'deleteContentBackward', null);
    expect(campo('reactivo').value).toBe('');
    expect(a.monto.value).toBeNull();
  });

  it('los decimales se escriben con coma y llegan como número; una tercera cifra decimal no entra', () => {
    teclear('reactivo', '$ 1.500,');
    expect(campo('reactivo').value).toBe('$ 1.500,');
    teclear('reactivo', '$ 1.500,5');
    expect(a.monto.value).toBe(1500.5);
    teclear('reactivo', '$ 1.500,567');
    expect(campo('reactivo').value).toBe('$ 1.500,56');
    expect(a.monto.value).toBe(1500.56);
  });

  it('un punto tecleado se ignora: «1.500» es mil quinientos, no uno coma cinco', () => {
    teclear('reactivo', '$ 1.', 4, 'insertText', '.');
    expect(campo('reactivo').value).toBe('$ 1');
    teclear('reactivo', '$ 1.500', 7, 'insertText', '0');
    expect(a.monto.value).toBe(1500);
  });

  it('una segunda coma no cabe y conserva el decimal que ya había', () => {
    a.monto.setValue(1.5);
    teclear('reactivo', '$ 1,,5', 4, 'insertText', ',');
    expect(campo('reactivo').value).toBe('$ 1,5');
    expect(a.monto.value).toBe(1.5);
  });

  it('en pesos enteros la coma se descarta', () => {
    teclear('enteros', '15');
    teclear('enteros', '15,', 3, 'insertText', ',');
    expect(campo('enteros').value).toBe('15');
    teclear('enteros', '1500');
    expect(campo('enteros').value).toBe('1.500'); // sin prefijo
    expect(a.cuota.value).toBe(1500);
  });

  it('con 4 decimales (TRM) admite 4.100,5025', () => {
    teclear('trm', '4100,50259');
    expect(campo('trm').value).toBe('4.100,5025');
    expect(a.tasa.value).toBe(4100.5025);
  });

  it('el cursor se queda donde se escribe y no salta al final', () => {
    a.monto.setValue(1234);
    const el = campo('reactivo');
    // cursor tras el «1» de «$ 1.234» (posición 3); se teclea un 9
    teclear('reactivo', '$ 19.234', 4, 'insertText', '9');
    expect(el.value).toBe('$ 19.234');
    expect(el.selectionStart).toBe(4);
  });

  it('Retroceso sobre un punto de miles borra la cifra de al lado, en vez de quedarse trabado', () => {
    a.monto.setValue(1234);
    const el = campo('reactivo');
    el.focus();
    // el navegador quitó el punto de «$ 1.234» con el cursor justo detrás de él → «$ 1234», cursor en 3
    teclear('reactivo', '$ 1234', 3, 'deleteContentBackward', null);
    expect(el.value).toBe('$ 234');
    expect(a.monto.value).toBe(234);
    expect(el.selectionStart).toBe(2);
  });

  it('Supr sobre un punto de miles borra la cifra siguiente', () => {
    a.monto.setValue(1234);
    teclear('reactivo', '$ 1234', 3, 'deleteContentForward', null);
    expect(campo('reactivo').value).toBe('$ 134');
    expect(a.monto.value).toBe(134);
  });

  it('pegar interpreta tanto «1.500.000,50» como «1,500,000.50»', () => {
    for (const pegado of ['1.500.000,50', '1,500,000.50', '$ 1500000.50']) {
      a.monto.setValue(null);
      const datos = new DataTransfer();
      datos.setData('text', pegado);
      const evento = new ClipboardEvent('paste', { clipboardData: datos, cancelable: true, bubbles: true });
      campo('reactivo').dispatchEvent(evento);
      expect(evento.defaultPrevented).toBe(true);
      expect(campo('reactivo').value).withContext(pegado).toBe('$ 1.500.000,50');
      expect(a.monto.value).withContext(pegado).toBe(1500000.5);
    }
  });

  it('al salir quita la coma que quedó sin decimales y marca el campo como tocado', () => {
    teclear('reactivo', '$ 1.500,');
    campo('reactivo').dispatchEvent(new Event('blur'));
    expect(campo('reactivo').value).toBe('$ 1.500');
    expect(a.monto.touched).toBe(true);
  });

  it('valida min como lo hacía type="number" (error `min`), y deja pasar lo vacío', () => {
    a.monto.setValue(0);
    expect(a.monto.errors?.['min']).toEqual({ min: 0.01, actual: 0 });
    a.monto.setValue(0.01);
    expect(a.monto.valid).toBe(true);
    a.monto.setValue(null);
    expect(a.monto.valid).toBe(true);
  });

  it('valida max y se actualiza si el tope cambia', () => {
    a.conTope.setValue(1500);
    expect(a.conTope.errors?.['max']).toEqual({ max: 1000, actual: 1500 });
    a.tope = 2000;
    f.detectChanges();
    a.conTope.updateValueAndValidity();
    expect(a.conTope.valid).toBe(true);
  });

  it('se deshabilita con el formulario', () => {
    a.monto.disable();
    expect(campo('reactivo').disabled).toBe(true);
    a.monto.enable();
    expect(campo('reactivo').disabled).toBe(false);
  });

  it('funciona con ngModel (el modelo recibe el número)', async () => {
    a.modelo = 2500000;
    f.detectChanges();
    await f.whenStable();
    expect(campo('modelo').value).toBe('$ 2.500.000');
    teclear('modelo', '$ 2.500.0001');
    f.detectChanges();
    expect(a.modelo).toBe(25000001);
  });
});
