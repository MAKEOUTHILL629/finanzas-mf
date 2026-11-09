import { Directive, ElementRef, Input, OnChanges, SimpleChanges, forwardRef, numberAttribute } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { esCifraDeMoneda, formatearMonedaConCursor, leerMoneda, normalizarMonedaPegada, textoDeMoneda } from '../../moneda.util';

// Angular exige que las transformaciones de `@Input` sean funciones declaradas (no constantes) para analizarlas al compilar.
function numeroONulo(v: unknown): number | null {
  return v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
}

function decimalesPermitidos(v: unknown): number {
  return numberAttribute(v, 2);
}

/**
 * Campo de dinero (COP) que da formato mientras se escribe: `1500000` → `$ 1.500.000`, con coma para los decimales (`$ 1.500,50`).
 * Reemplaza a `type="number"`: el formulario sigue recibiendo un `number` (o `null` si está vacío), así que `formControlName`,
 * `[formControl]` y `[(ngModel)]` funcionan igual que antes, y `min` / `max` se validan igual (errores `min` y `max` de Angular).
 *
 *   <input appInput appMoneda id="monto" formControlName="monto" min="0.01" />
 *   <input appInput appMoneda decimales="0" prefijo="" [(ngModel)]="cuota" />   <!-- pesos enteros; sin «$» (la pantalla ya lo pone) -->
 *
 * - Los miles se ponen solos y el cursor se queda donde estaba al escribir o borrar en medio de la cifra.
 * - Un punto tecleado se ignora (en COP es el separador de miles); los decimales se escriben con coma.
 * - Pegar `1.500.000,50` o `1,500,000.50` (de un banco o una hoja de cálculo) se interpreta bien.
 * - `decimales`: cifras decimales permitidas (2 por defecto; 0 = pesos enteros; 4 para una TRM). `prefijo`: texto que antecede a la cifra.
 */
@Directive({
  selector: 'input[appMoneda]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MonedaDirective), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => MonedaDirective), multi: true },
  ],
  host: {
    '(input)': 'alEscribir($event)',
    '(paste)': 'alPegar($event)',
    '(blur)': 'alSalir()',
  },
})
export class MonedaDirective implements ControlValueAccessor, Validator, OnChanges {
  @Input({ transform: decimalesPermitidos }) decimales = 2;
  @Input() prefijo = '$ ';
  @Input({ transform: numeroONulo }) min: number | null = null;
  @Input({ transform: numeroONulo }) max: number | null = null;

  private valor: number | null = null;
  /** Lo último que dejamos escrito: sirve para saber qué se borró cuando el usuario pulsa Retroceso o Supr. */
  private previo = '';
  private alCambiar: (valor: number | null) => void = () => {};
  private alTocar: () => void = () => {};
  private alCambiarValidacion: () => void = () => {};

  constructor(private el: ElementRef<HTMLInputElement>) {
    const campo = el.nativeElement;
    campo.type = 'text'; // con `number` el navegador no deja leer ni mover el cursor
    campo.autocomplete = 'off';
    campo.setAttribute('inputmode', 'decimal');
    campo.classList.add('erp-input--moneda');
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['decimales']) this.el.nativeElement.setAttribute('inputmode', this.decimales > 0 ? 'decimal' : 'numeric');
    if (cambios['decimales'] || cambios['prefijo']) this.pintar(); // el valor del formulario se muestra con el formato nuevo
    if (cambios['min'] || cambios['max']) this.alCambiarValidacion();
  }

  // ───────── ControlValueAccessor ─────────

  writeValue(valor: unknown): void {
    const n = valor === null || valor === undefined || valor === '' ? null : Number(valor);
    this.valor = n !== null && Number.isFinite(n) ? n : null;
    this.pintar();
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.el.nativeElement.disabled = deshabilitado;
  }

  // ───────── Validator (lo que antes hacía el atributo `min`/`max` de `type="number"`) ─────────

  validate(control: AbstractControl): ValidationErrors | null {
    const v = control.value;
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (this.min !== null && n < this.min) return { min: { min: this.min, actual: n } };
    if (this.max !== null && n > this.max) return { max: { max: this.max, actual: n } };
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.alCambiarValidacion = fn;
  }

  // ───────── Lo que escribe la persona ─────────

  alEscribir(evento: Event): void {
    const campo = this.el.nativeElement;
    const { inputType, data } = evento as InputEvent;
    let crudo = campo.value;
    let cursor = campo.selectionStart ?? crudo.length;

    if (inputType === 'insertText' && data === ',') {
      // Una segunda coma (o cualquier coma en pesos enteros) no cabe: se descarta y el decimal que ya había se conserva.
      const sinTecla = crudo.slice(0, cursor - 1) + crudo.slice(cursor);
      if (this.decimales <= 0 || sinTecla.includes(',')) {
        crudo = sinTecla;
        cursor -= 1;
      }
    } else if ((inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') && this.soloSeBorroUnAdorno(crudo)) {
      // Retroceso sobre un punto de miles no cambiaría nada (el formato lo volvería a poner): se borra la cifra de al lado.
      const i = inputType === 'deleteContentBackward' ? cursor - 1 : cursor;
      if (i >= 0 && i < crudo.length && esCifraDeMoneda(crudo[i], this.decimales)) {
        crudo = crudo.slice(0, i) + crudo.slice(i + 1);
        cursor = i;
      }
    }
    this.aplicar(crudo, cursor);
  }

  alPegar(evento: ClipboardEvent): void {
    const texto = evento.clipboardData?.getData('text');
    if (!texto) return;
    evento.preventDefault();
    const campo = this.el.nativeElement;
    const inicio = campo.selectionStart ?? campo.value.length;
    const fin = campo.selectionEnd ?? inicio;
    const pegado = normalizarMonedaPegada(texto);
    this.aplicar(campo.value.slice(0, inicio) + pegado + campo.value.slice(fin), inicio + pegado.length);
  }

  alSalir(): void {
    const campo = this.el.nativeElement;
    // «1.500,» (coma sin decimales) no es una cifra terminada: se quita al salir.
    if (campo.value.endsWith(',')) this.poner(campo.value.slice(0, -1));
    this.alTocar();
  }

  // ───────── Internos ─────────

  /** Desde la última vez que formateamos, ¿lo único que desapareció fue un adorno (punto de miles, símbolo, espacio) y no una cifra? */
  private soloSeBorroUnAdorno(actual: string): boolean {
    const cifras = (t: string) => [...t].filter((c) => esCifraDeMoneda(c, this.decimales)).length;
    return this.previo.length - actual.length === 1 && cifras(this.previo) === cifras(actual);
  }

  private aplicar(crudo: string, cursor: number): void {
    const campo = this.el.nativeElement;
    const r = formatearMonedaConCursor(crudo, cursor, this.decimales, this.prefijo);
    this.poner(r.texto);
    if (document.activeElement === campo) campo.setSelectionRange(r.cursor, r.cursor);
    this.valor = leerMoneda(r.texto);
    this.alCambiar(this.valor);
  }

  /** Muestra el valor del formulario con el formato del campo. */
  private pintar(): void {
    const cuerpo = textoDeMoneda(this.valor, this.decimales);
    this.poner(cuerpo === '' ? '' : this.prefijo + cuerpo);
  }

  private poner(texto: string): void {
    const campo = this.el.nativeElement;
    if (campo.value !== texto) campo.value = texto;
    this.previo = texto;
  }
}
