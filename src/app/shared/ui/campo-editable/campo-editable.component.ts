import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { OpcionSelect, TipoCatalogo } from '../../../modelos/catalogos';
import { formatearEntradaMoneda, leerMoneda, moneda } from '../../moneda.util';

export type TipoCampoEditable = 'texto' | 'textarea' | 'moneda' | 'fecha' | 'entero' | 'decimal' | 'seleccion';
export type ValorCampoEditable = string | number | null;

/**
 * Campo que se edita en el sitio (estilo Ajustes de iOS): muestra «Etiqueta ··· valor»; al tocar el valor se vuelve un control
 * del tipo adecuado y al terminar (Enter o salir del campo) emite `(guardar)` con el valor nuevo. Escape cancela.
 * La pantalla hace el guardado (PATCH) y avisa con `[guardando]` / `[error]`; mientras tanto se ve el valor nuevo con un indicador.
 * Si el campo está vacío y es `faltante`, invita a completarlo («Agregar descripción»).
 *
 *   <app-campo-editable etiqueta="Descripción" tipo="texto" [valor]="compra.descripcion" [faltante]="…" [guardando]="…" (guardar)="…"></app-campo-editable>
 */
@Component({
  selector: 'app-campo-editable',
  templateUrl: './campo-editable.component.html',
  styleUrl: './campo-editable.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampoEditableComponent implements OnChanges {
  @Input({ required: true }) etiqueta!: string;
  @Input() tipo: TipoCampoEditable = 'texto';
  @Input() valor: ValorCampoEditable | undefined = null;
  /** Texto que se muestra (por ejemplo la fecha ya formateada o el nombre de la tarjeta); por defecto sale del valor. */
  @Input() texto: string | null = null;
  @Input() placeholder = '';
  /** `$` o `%`… se pinta junto al control mientras se edita y tras el valor al verlo. */
  @Input() prefijo = '';
  @Input() sufijo = '';
  @Input() ayuda: string | null = null;
  @Input() requerido = false;
  @Input() soloLectura = false;
  /** Se resalta (borde punteado + «Agregar…») cuando falta este dato. */
  @Input() faltante = false;
  /** Llama la atención un momento (al pulsar el aviso «Faltan X datos»). */
  @Input() resaltar = false;
  @Input() guardando = false;
  @Input() error: string | null = null;
  @Input() maxlength: number | null = null;
  @Input() min: number | null = null;
  @Input() max: number | null = null;
  @Input() paso = 1;
  /** Para `tipo="seleccion"`: opciones propias o un catálogo compartido. */
  @Input() opciones: OpcionSelect[] = [];
  @Input() catalogo: TipoCatalogo | null = null;
  @Input() filtro: ((item: unknown) => boolean) | null = null;
  @Input() textoVacio: string | null = null;
  /** `id` del elemento (para llevar la vista hasta él). */
  @Input() idCampo: string | null = null;

  @Output() guardar = new EventEmitter<string | number | null>();

  @ViewChild('entrada') entrada?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  editando = false;
  borrador = '';
  errorLocal: string | null = null;
  /** Lo que se acaba de enviar: se sigue mostrando mientras llega la respuesta. */
  pendiente: ValorCampoEditable | undefined = undefined;
  private cancelando = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['valor'] && !cambios['valor'].firstChange) this.pendiente = undefined;
    if (cambios['guardando'] && !this.guardando) this.pendiente = undefined;
    if (cambios['error'] && this.error) this.pendiente = undefined;
  }

  get idEtiqueta(): string {
    return `${this.idCampo ?? 'ce'}-etiqueta`;
  }

  get bloqueado(): boolean {
    return this.soloLectura || this.guardando;
  }

  get vacio(): boolean {
    const v = this.pendiente !== undefined ? this.pendiente : this.valor;
    return v === null || v === undefined || v === '';
  }

  /** Lo que se ve cuando no se está editando. */
  get textoVisible(): string {
    if (this.pendiente === undefined && this.texto !== null && this.texto !== '') return this.texto;
    const v = this.pendiente !== undefined ? this.pendiente : this.valor;
    if (v === null || v === undefined || v === '') return '';
    if (this.tipo === 'moneda') return moneda(Number(v));
    if (this.tipo === 'seleccion') return this.opciones.find((o) => o.valor === v)?.etiqueta ?? String(v);
    return String(v);
  }

  get invitacion(): string {
    return this.placeholder || `Agregar ${this.etiqueta.toLowerCase()}`;
  }

  get tipoInput(): string {
    switch (this.tipo) {
      case 'fecha':
        return 'date';
      case 'entero':
      case 'decimal':
        return 'number';
      default:
        return 'text';
    }
  }

  get modoTeclado(): string | null {
    return this.tipo === 'moneda' || this.tipo === 'decimal' ? 'decimal' : this.tipo === 'entero' ? 'numeric' : null;
  }

  // ───────── editar ─────────

  editar(): void {
    if (this.bloqueado || this.editando) return;
    this.errorLocal = null;
    this.cancelando = false;
    const v = this.valor;
    if (this.tipo === 'moneda') this.borrador = v === null || v === undefined || v === '' ? '' : formatearEntradaMoneda(String(v));
    else this.borrador = v === null || v === undefined ? '' : String(v);
    this.editando = true;
    this.cdr.detectChanges();
    const control = this.entrada?.nativeElement;
    control?.focus();
    if (control && 'select' in control && this.tipo !== 'fecha') control.select();
  }

  alEscribir(evento: Event): void {
    const control = evento.target as HTMLInputElement;
    if (this.tipo === 'moneda') {
      const formateado = formatearEntradaMoneda(control.value);
      this.borrador = formateado;
      control.value = formateado;
    } else {
      this.borrador = control.value;
    }
    this.errorLocal = null;
  }

  alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      this.cancelar();
    } else if (evento.key === 'Enter' && (this.tipo !== 'textarea' || evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault();
      this.confirmar();
    }
  }

  cancelar(): void {
    this.cancelando = true;
    this.editando = false;
    this.errorLocal = null;
  }

  /** Valida lo escrito y, si cambió, lo emite. Si no cambió o no es válido, no guarda. */
  confirmar(): void {
    if (!this.editando || this.cancelando) return;
    const resultado = this.leerBorrador();
    if (resultado.error) {
      this.errorLocal = resultado.error;
      return;
    }
    this.editando = false;
    this.errorLocal = null;
    if (this.igualAlActual(resultado.valor)) return;
    this.pendiente = resultado.valor;
    this.guardar.emit(resultado.valor);
  }

  /** `tipo="seleccion"`: se eligió una opción. */
  elegir(valor: string | number | null): void {
    if (this.requerido && (valor === null || valor === '')) return;
    if (valor === this.valor || (valor !== null && this.valor !== null && String(valor) === String(this.valor))) return;
    this.editando = false;
    this.pendiente = valor;
    this.guardar.emit(valor);
  }

  /** `tipo="seleccion"`: se cerró la lista sin (o con) elegir. */
  alCerrarLista(): void {
    this.editando = false;
    this.cdr.markForCheck();
  }

  private igualAlActual(nuevo: string | number | null): boolean {
    const actual = this.valor;
    if (nuevo === null) return actual === null || actual === undefined || actual === '';
    if (actual === null || actual === undefined) return false;
    if (typeof nuevo === 'number') return Number(actual) === nuevo;
    return String(actual) === nuevo;
  }

  private leerBorrador(): { valor: string | number | null; error?: string } {
    const bruto = this.borrador;
    switch (this.tipo) {
      case 'texto':
      case 'textarea': {
        const t = bruto.trim();
        if (t === '' && this.requerido) return { valor: null, error: 'No puede quedar vacío' };
        return { valor: t === '' ? null : t };
      }
      case 'moneda': {
        const n = leerMoneda(bruto);
        if (n === null) return this.requerido ? { valor: null, error: 'Escribe un valor' } : { valor: null };
        if (n < 0 || (this.requerido && n === 0)) return { valor: null, error: 'Debe ser mayor a 0' };
        return { valor: n };
      }
      case 'fecha':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return this.requerido ? { valor: null, error: 'Elige una fecha' } : { valor: null };
        return { valor: bruto };
      case 'entero':
      case 'decimal': {
        if (bruto.trim() === '') return this.requerido ? { valor: null, error: 'Escribe un número' } : { valor: null };
        const n = Number(bruto);
        if (!Number.isFinite(n)) return { valor: null, error: 'Escribe un número' };
        if (this.tipo === 'entero' && !Number.isInteger(n)) return { valor: null, error: 'Debe ser un número entero' };
        if (this.min !== null && n < this.min) return { valor: null, error: `Mínimo ${this.min}` };
        if (this.max !== null && n > this.max) return { valor: null, error: `Máximo ${this.max}` };
        return { valor: n };
      }
      default:
        return { valor: bruto };
    }
  }
}
