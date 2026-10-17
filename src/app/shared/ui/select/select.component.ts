import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EstadoCatalogo, OpcionSelect, TipoCatalogo } from '../../../modelos/catalogos';
import { CatalogosService } from '../../../services/catalogos.service';
import { opcionesDeCatalogo, TEXTO_CATALOGO } from './select.helpers';

export type ValorSelect = number | string | null;

/**
 * Selector del sistema de diseño: un combobox BUSCABLE (`<app-searchable-select>`; en pantallas angostas, una hoja inferior) que:
 *  · se alimenta de un catálogo compartido (`catalogo="personas|tarjetas|cuentas|categorias"`) o de una lista (`opciones`);
 *  · busca por nombre, últimos 4 dígitos (`*1927`, también los de plásticos anteriores), tipo de producto, etc., y agrupa
 *    («Activas» / «Históricas», «Frecuentes» / «Todas las personas»);
 *  · muestra un esqueleto mientras carga, un mensaje de vacío y un error con «Reintentar» (nunca queda mudo ni vacío sin explicación);
 *  · conserva el valor seleccionado aunque el catálogo llegue después que el valor del formulario;
 *  · funciona con `formControlName` / `ngModel` y entrega el `id` numérico (o `null`).
 */
@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
})
export class SelectComponent implements ControlValueAccessor, OnInit, OnChanges, OnDestroy {
  /** Catálogo compartido del que salen las opciones. */
  @Input() catalogo: TipoCatalogo | null = null;
  /** Opciones propias (si no se usa `catalogo`). */
  @Input() opciones: OpcionSelect[] = [];
  /** Filtro sobre los elementos del catálogo (p. ej. categorías de un tipo, personas distintas a las ya elegidas). */
  @Input() filtro: ((item: any) => boolean) | null = null;
  /** Etiqueta propia para cada elemento del catálogo (por defecto la estándar de cada catálogo). */
  @Input() etiquetar: ((item: any) => string) | null = null;
  /** Cuentas: ofrecer solo las activas (por defecto sí). La cuenta ya seleccionada se conserva aunque esté inactiva. */
  @Input() soloActivas = true;
  /** Tarjetas: ofrecer también las de débito (por defecto solo las de crédito). */
  @Input() incluirDebito = false;
  @Input() inputId: string | null = null;
  @Input() placeholder = 'Selecciona…';
  /** Permite volver a «sin selección» (campos opcionales). En los obligatorios el marcador no se puede elegir. */
  @Input() permitirVacio = true;
  @Input() invalido = false;
  @Input() ariaLabel: string | null = null;
  @Input() ariaDescribedby: string | null = null;
  /** Texto cuando no hay registros (por defecto «No hay personas registradas.»). */
  @Input() textoVacio: string | null = null;
  /** Enlace para crear lo que falta (aparece solo cuando el catálogo está vacío). */
  @Input() enlaceCrear: { texto: string; ruta: string } | null = null;
  /** Abre la lista al aparecer (editores en línea de una celda). */
  @Input() abrirAlMostrar = false;
  /** Personas: ids más usados que van primero («Frecuentes»); todas las demás siguen debajo. */
  @Input() frecuentes: ReadonlyArray<number> | null = null;
  /** Se emite al cambiar la selección con la opción elegida (para formularios que necesitan más que el id). */
  @Output() elegido = new EventEmitter<OpcionSelect | null>();
  /** Se cerró la lista (se eligió algo o no): el campo fue «tocado». */
  @Output() tocado = new EventEmitter<void>();

  valor: ValorSelect = null;
  deshabilitado = false;
  estado: EstadoCatalogo<any> | null = null;
  opcionesVisibles: OpcionSelect[] = [];

  private suscripcion?: Subscription;
  private alCambiarFn: (v: ValorSelect) => void = () => undefined;
  private alTocarFn: () => void = () => undefined;

  constructor(private catalogos: CatalogosService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.conectar();
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['catalogo'] && !cambios['catalogo'].firstChange) this.conectar();
    else this.recalcular();
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  /** Muestra el esqueleto solo si todavía no hay nada que enseñar (con datos viejos se enseñan mientras se actualiza). */
  get cargandoSinDatos(): boolean {
    return !!this.catalogo && !!this.estado && this.estado.cargando && this.estado.datos.length === 0 && !this.estado.cargado;
  }

  get error(): string | null {
    return this.catalogo && this.estado ? this.estado.error : null;
  }

  get sinOpciones(): boolean {
    return !this.cargandoSinDatos && this.opcionesVisibles.length === 0;
  }

  get mensajeVacio(): string {
    if (this.textoVacio) return this.textoVacio;
    return this.catalogo ? TEXTO_CATALOGO[this.catalogo].vacio : 'No hay opciones disponibles.';
  }

  reintentar(): void {
    if (this.catalogo) this.catalogos.recargar([this.catalogo]);
  }

  /** El combobox eligió (o limpió) una opción. */
  alElegir(opcion: OpcionSelect | null): void {
    this.valor = opcion ? opcion.valor : null;
    this.alCambiarFn(this.valor);
    this.elegido.emit(opcion);
  }

  alSalir(): void {
    this.alTocarFn();
    this.tocado.emit();
  }

  // ── ControlValueAccessor ──

  writeValue(v: ValorSelect | undefined): void {
    this.valor = v === undefined || v === '' ? null : v;
    this.recalcular();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: ValorSelect) => void): void {
    this.alCambiarFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocarFn = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado = deshabilitado;
    this.cdr.markForCheck();
  }

  // ── interno ──

  private conectar(): void {
    this.suscripcion?.unsubscribe();
    this.estado = null;
    if (!this.catalogo) {
      this.recalcular();
      return;
    }
    this.suscripcion = this.catalogos.estado$(this.catalogo).subscribe((e) => {
      this.estado = e;
      this.recalcular();
      this.cdr.markForCheck();
    });
    // Cada vez que se monta un selector se garantiza el catálogo (no repite la petición si ya está fresco o en curso).
    this.catalogos.asegurar([this.catalogo]);
  }

  private recalcular(): void {
    if (this.catalogo) {
      this.opcionesVisibles = opcionesDeCatalogo(this.catalogo, this.estado?.datos ?? [], {
        filtro: this.filtro,
        etiquetar: this.etiquetar,
        soloActivas: this.soloActivas,
        incluirDebito: this.incluirDebito,
        frecuentes: this.frecuentes,
        valorActual: this.valor,
      });
    } else {
      this.opcionesVisibles = this.opciones;
    }
  }
}
