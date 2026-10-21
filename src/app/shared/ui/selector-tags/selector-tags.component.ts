import { Component, EventEmitter, Input, OnChanges, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ItemTagCatalogo } from '../../../modelos/catalogos';

export const TAGS_SUGERIDOS_DEFAULT: ReadonlyArray<ItemTagCatalogo> = [
  { slug: '#rappi', nombre: 'Rappi', frecuencia: 0, color: '#FF3B30' },
  { slug: '#didi-food', nombre: 'DiDi Food', frecuencia: 0, color: '#FF9500' },
  { slug: '#didi-rides', nombre: 'DiDi Rides', frecuencia: 0, color: '#007AFF' },
  { slug: '#domicilios', nombre: 'Domicilios', frecuencia: 0, color: '#FF9500' },
  { slug: '#transporte', nombre: 'Transporte', frecuencia: 0, color: '#007AFF' },
  { slug: '#comida', nombre: 'Comida', frecuencia: 0, color: '#34C759' },
  { slug: '#viajes', nombre: 'Viajes', frecuencia: 0, color: '#5856D6' },
  { slug: '#ropa', nombre: 'Ropa', frecuencia: 0, color: '#AF52DE' },
  { slug: '#suscripciones', nombre: 'Suscripciones', frecuencia: 0, color: '#FF2D55' },
  { slug: '#mercado', nombre: 'Mercado', frecuencia: 0, color: '#34C759' },
  { slug: '#hogar', nombre: 'Hogar', frecuencia: 0, color: '#00C7BE' },
  { slug: '#recurrente', nombre: 'Recurrente', frecuencia: 0, color: '#5856D6' },
];

export function normalizarSlugTagUi(raw: string): string {
  const limpio = (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return limpio ? `#${limpio}` : '';
}

@Component({
  selector: 'app-selector-tags',
  templateUrl: './selector-tags.component.html',
  styleUrl: './selector-tags.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorTagsComponent),
      multi: true,
    },
  ],
})
export class SelectorTagsComponent implements ControlValueAccessor, OnChanges {
  @Input() tags: string[] = [];
  @Input() sugerencias: ItemTagCatalogo[] = [];
  @Input() placeholder = 'Escribir tag y pulsar Enter (ej. #rappi)...';
  @Input() modoCompacto = false;
  @Input() deshabilitado = false;
  @Output() tagsChange = new EventEmitter<string[]>();

  textoEntrada = '';
  abierto = false;
  editandoInline = false;

  private onChange: (val: string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngOnChanges(): void {
    this.tags = this.limpiarLista(this.tags);
  }

  writeValue(val: string[] | null | undefined): void {
    this.tags = this.limpiarLista(val);
  }

  registerOnChange(fn: (val: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.deshabilitado = isDisabled;
  }

  get catalogoCombinado(): ItemTagCatalogo[] {
    const mapa = new Map<string, ItemTagCatalogo>();
    for (const d of TAGS_SUGERIDOS_DEFAULT) mapa.set(d.slug, d);
    for (const s of this.sugerencias ?? []) {
      const slug = normalizarSlugTagUi(s.slug);
      if (slug) mapa.set(slug, { ...s, slug });
    }
    return [...mapa.values()];
  }

  get opcionesFiltradas(): ItemTagCatalogo[] {
    const filtro = this.textoEntrada.trim().toLowerCase().replace(/^#+/, '');
    const actuales = new Set(this.tags);
    return this.catalogoCombinado
      .filter((item) => !actuales.has(item.slug))
      .filter((item) => !filtro || item.slug.includes(filtro) || item.nombre.toLowerCase().includes(filtro))
      .slice(0, 8);
  }

  colorDeTag(slug: string): string {
    const encontrado = this.catalogoCombinado.find((t) => t.slug === slug);
    return encontrado?.color ?? '#007AFF';
  }

  activarInputInline(): void {
    if (this.deshabilitado) return;
    this.editandoInline = true;
    this.abierto = true;
  }

  alEnfocar(): void {
    if (this.deshabilitado) return;
    this.abierto = true;
  }

  alDesenfocar(): void {
    this.onTouched();
    setTimeout(() => {
      if (this.textoEntrada.trim()) {
        this.agregarDesdeTexto(this.textoEntrada);
      }
      this.abierto = false;
      this.editandoInline = false;
    }, 150);
  }

  alPresionarTecla(event: KeyboardEvent): void {
    if (this.deshabilitado) return;
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      event.stopPropagation();
      this.agregarDesdeTexto(this.textoEntrada);
      return;
    }
    if (event.key === 'Backspace' && !this.textoEntrada && this.tags.length > 0) {
      this.eliminarTag(this.tags[this.tags.length - 1]);
      return;
    }
    if (event.key === 'Escape') {
      this.textoEntrada = '';
      this.abierto = false;
      this.editandoInline = false;
    }
  }

  agregarDesdeTexto(raw: string): void {
    if (this.deshabilitado) return;
    const partes = raw.split(',');
    let cambio = false;
    const actuales = [...this.tags];
    for (const p of partes) {
      const slug = normalizarSlugTagUi(p);
      if (slug && !actuales.includes(slug)) {
        actuales.push(slug);
        cambio = true;
      }
    }
    this.textoEntrada = '';
    if (cambio) {
      this.actualizarValor(actuales);
    }
  }

  seleccionarSugerencia(item: ItemTagCatalogo): void {
    if (this.deshabilitado) return;
    if (!this.tags.includes(item.slug)) {
      this.actualizarValor([...this.tags, item.slug]);
    }
    this.textoEntrada = '';
    this.abierto = false;
    this.editandoInline = false;
  }

  eliminarTag(slug: string): void {
    if (this.deshabilitado) return;
    const filtrados = this.tags.filter((t) => t !== slug);
    this.actualizarValor(filtrados);
  }

  private actualizarValor(nuevos: string[]): void {
    this.tags = nuevos;
    this.onChange(this.tags);
    this.tagsChange.emit(this.tags);
  }

  private limpiarLista(val: string[] | null | undefined): string[] {
    if (!Array.isArray(val)) return [];
    const unicos = new Set<string>();
    for (const item of val) {
      const slug = normalizarSlugTagUi(item);
      if (slug) unicos.add(slug);
    }
    return [...unicos];
  }
}
