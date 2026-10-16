import { ChangeDetectionStrategy, Component, Directive, ElementRef, HostBinding, Input, OnChanges, booleanAttribute } from '@angular/core';

let siguienteId = 0;

/**
 * Campo de formulario: etiqueta + control + ayuda + error, con la separación y los colores del sistema.
 * El control proyectado debe llevar `appInput` (o el `<app-select>`); `for` enlaza la etiqueta con su `id`.
 *
 *   <app-field label="Monto" for="monto" [required]="true" [error]="errorMonto" hint="Sin puntos ni comas">
 *     <input appInput id="monto" formControlName="monto" />
 *   </app-field>
 */
@Component({
  selector: 'app-field',
  template: `
    <label class="erp-label" *ngIf="label" [attr.for]="for">
      {{ label }}<span class="erp-req" *ngIf="required" aria-hidden="true">*</span>
    </label>
    <ng-content></ng-content>
    <p class="erp-field-error" role="alert" *ngIf="error">{{ error }}</p>
    <p class="erp-field-hint" *ngIf="hint && !error">{{ hint }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FieldComponent {
  @HostBinding('class.erp-field') readonly campo = true;

  @Input() label: string | null = null;
  /** `id` del control al que apunta la etiqueta. */
  @Input() for: string | null = null;
  @Input({ transform: booleanAttribute }) required = false;
  @Input() hint: string | null = null;
  /** Mensaje de error ya resuelto (si hay, reemplaza a la ayuda). */
  @Input() error: string | null = null;
  readonly uid = `campo-${++siguienteId}`;
}

/** Estilo de campo para `<input>`, `<textarea>` y `<select>` nativos: `<input appInput [invalid]="…">`. */
@Directive({
  selector: 'input[appInput], textarea[appInput], select[appInput]'
})
export class InputDirective implements OnChanges {
  @Input({ transform: booleanAttribute }) invalid = false;

  constructor(private el: ElementRef<HTMLElement>) {
    const tag = el.nativeElement.tagName.toLowerCase();
    el.nativeElement.classList.add(tag === 'textarea' ? 'erp-textarea' : tag === 'select' ? 'erp-select' : 'erp-input');
  }

  ngOnChanges(): void {
    this.el.nativeElement.classList.toggle('erp-input--invalid', this.invalid);
    if (this.invalid) this.el.nativeElement.setAttribute('aria-invalid', 'true');
    else this.el.nativeElement.removeAttribute('aria-invalid');
  }
}
