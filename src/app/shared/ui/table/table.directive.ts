import { Directive, HostBinding, Input, booleanAttribute } from '@angular/core';

/**
 * Tabla del sistema de diseño. Se pone sobre un `<table>` nativo (conserva la semántica de lectores de pantalla):
 *   <div class="erp-table-wrap"><table appTable compact stack sticky>…</table></div>
 *
 * · `compact`: menos relleno y sin saltos de línea (muchas columnas).
 * · `stack`: en pantallas angostas cada fila se vuelve una tarjeta (cada `<td>` lleva `data-label`).
 * · `sticky`: la primera columna queda fija al desplazar en horizontal.
 */
@Directive({
  selector: 'table[appTable]'
})
export class TableDirective {
  @HostBinding('class.erp-table') readonly tabla = true;
  @HostBinding('class.erp-table--compact') @Input({ transform: booleanAttribute }) compact = false;
  @HostBinding('class.erp-table--stack') @Input({ transform: booleanAttribute }) stack = false;
  @HostBinding('class.erp-table--sticky') @Input({ transform: booleanAttribute }) sticky = false;
}
