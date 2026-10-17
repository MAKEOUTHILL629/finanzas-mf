import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { EstadoCatalogo, ItemCuenta, ItemTarjeta, OpcionSelect } from '../../../modelos/catalogos';
import { CatalogosService } from '../../../services/catalogos.service';
import { ProductoElegido, opcionesDeProductos, parsearProducto, productoPorUltimos4 } from './productos.helpers';

/**
 * Selector único de producto: tarjetas de crédito, tarjetas de débito y cuentas en una sola lista agrupada.
 *  · Entrega una clave de texto (`t:12` tarjeta, `c:3` cuenta; ver `parsearProducto`) o `null`.
 *  · Con `ultimos4` (y `instrumento`) elige solo el producto al que pertenecen esos dígitos —mirando también los plásticos
 *    anteriores y las tarjetas de débito— mientras el usuario no haya escogido otra cosa.
 *  · Muestra un esqueleto mientras cargan los catálogos, un mensaje si no hay nada y los errores con «Reintentar».
 */
@Component({
  selector: 'app-select-producto',
  templateUrl: './select-producto.component.html',
  styleUrl: './select-producto.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectProductoComponent), multi: true }],
})
export class SelectProductoComponent implements ControlValueAccessor, OnInit, OnChanges, OnDestroy {
  @Input() inputId: string | null = null;
  @Input() placeholder = 'Selecciona la tarjeta o la cuenta';
  @Input() permitirVacio = false;
  @Input() invalido = false;
  @Input() ariaLabel: string | null = null;
  @Input() ariaDescribedby: string | null = null;
  /** Dígitos con los que se elige solo el producto (los del correo). */
  @Input() ultimos4: string | null = null;
  /** Tipo de producto del aviso: una tarjeta de crédito solo puede ser de crédito; una cuenta, de débito o cuenta. */
  @Input() instrumento: 'TC' | 'CUENTA' | null = null;
  @Input() autoseleccionar = true;
  @Input() incluirCredito = true;
  @Input() incluirDebito = true;
  @Input() incluirCuentas = true;
  @Input() enlaceCrear: { texto: string; ruta: string } | null = { texto: 'Ir a Tarjetas', ruta: '/tarjetas' };

  /** Se eligió solo por los últimos 4 dígitos (para avisarle al usuario de dónde salió). */
  @Output() autoseleccionado = new EventEmitter<{ clave: string; ultimos4: string }>();
  @Output() elegido = new EventEmitter<ProductoElegido | null>();

  valor: string | null = null;
  deshabilitado = false;
  tarjetas: ItemTarjeta[] = [];
  cuentas: ItemCuenta[] = [];
  estadoTarjetas: EstadoCatalogo<ItemTarjeta> | null = null;
  estadoCuentas: EstadoCatalogo<ItemCuenta> | null = null;
  opciones: OpcionSelect[] = [];

  private suscripcion?: Subscription;
  private seEligio = false;
  private alCambiarFn: (v: string | null) => void = () => undefined;
  private alTocarFn: () => void = () => undefined;

  constructor(private catalogos: CatalogosService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.suscripcion = combineLatest([this.catalogos.estado$('tarjetas'), this.catalogos.estado$('cuentas')]).subscribe(([t, c]) => {
      this.estadoTarjetas = t;
      this.estadoCuentas = c;
      this.tarjetas = t.datos;
      this.cuentas = c.datos;
      this.recalcular();
      this.cdr.markForCheck();
    });
    this.catalogos.asegurar(['tarjetas', 'cuentas']);
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['ultimos4'] || cambios['instrumento'] || cambios['incluirCredito'] || cambios['incluirDebito'] || cambios['incluirCuentas']) this.recalcular();
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  get cargandoSinDatos(): boolean {
    const sinDatos = (e: EstadoCatalogo<unknown> | null): boolean => !!e && e.cargando && !e.cargado && e.datos.length === 0;
    return sinDatos(this.estadoTarjetas) || sinDatos(this.estadoCuentas);
  }

  get error(): string | null {
    return this.estadoTarjetas?.error ?? this.estadoCuentas?.error ?? null;
  }

  get sinOpciones(): boolean {
    return !this.cargandoSinDatos && this.opciones.length === 0;
  }

  get cargado(): boolean {
    return !!this.estadoTarjetas?.cargado && !!this.estadoCuentas?.cargado;
  }

  reintentar(): void {
    this.catalogos.recargar(['tarjetas', 'cuentas']);
  }

  /** El combobox eligió (o limpió) un producto. */
  alElegir(opcion: OpcionSelect | null): void {
    this.seEligio = true;
    this.fijar(opcion ? String(opcion.valor) : null);
  }

  alSalir(): void {
    this.alTocarFn();
  }

  /** Elige el producto de esos últimos 4 dígitos (si hay uno solo). `true` si lo encontró. */
  elegirPorUltimos4(ultimos4: string): boolean {
    const clave = productoPorUltimos4(ultimos4, this.tarjetas, this.cuentas, this.instrumento);
    if (!clave) return false;
    this.seEligio = true;
    this.fijar(clave);
    return true;
  }

  // ── ControlValueAccessor ──

  writeValue(v: string | null | undefined): void {
    this.valor = v === undefined || v === null || v === '' ? null : String(v);
    if (this.valor !== null) this.seEligio = true;
    this.recalcular();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.alCambiarFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocarFn = fn;
  }

  setDisabledState(d: boolean): void {
    this.deshabilitado = d;
    this.cdr.markForCheck();
  }

  // ── interno ──

  private fijar(clave: string | null): void {
    this.valor = clave;
    this.alCambiarFn(clave);
    this.elegido.emit(clave ? parsearProducto(clave) : null);
    this.recalcular();
    this.cdr.markForCheck();
  }

  private recalcular(): void {
    this.opciones = opcionesDeProductos(this.tarjetas, this.cuentas, {
      valorActual: this.valor,
      incluirCredito: this.incluirCredito,
      incluirDebito: this.incluirDebito,
      incluirCuentas: this.incluirCuentas,
    });
    this.programarAutoseleccion();
  }

  private autoProgramada = false;

  /**
   * Elección automática: solo cuando ya llegaron los catálogos, nadie ha escogido y los dígitos apuntan a UN producto. Se hace en un
   * microtarea para no cambiar el valor del formulario en medio de su propia revisión de cambios.
   */
  private programarAutoseleccion(): void {
    if (this.autoProgramada || !this.autoseleccionar || this.seEligio || this.valor !== null || !this.ultimos4 || !this.cargado) return;
    this.autoProgramada = true;
    queueMicrotask(() => {
      this.autoProgramada = false;
      if (this.seEligio || this.valor !== null || !this.ultimos4) return;
      const clave = productoPorUltimos4(this.ultimos4, this.tarjetas, this.cuentas, this.instrumento);
      if (!clave) return;
      this.seEligio = true;
      this.fijar(clave);
      this.autoseleccionado.emit({ clave, ultimos4: this.ultimos4 });
    });
  }
}
