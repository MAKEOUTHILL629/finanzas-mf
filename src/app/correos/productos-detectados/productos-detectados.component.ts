import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AsignarProducto, ProductoDetectado, SugerenciaProducto } from '../../modelos/correos-inteligentes';
import { CuentaFinanciera } from '../../modelos/erp';
import { Tarjeta } from '../../modelos/tarjeta';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { NotificacionesCorreoService } from '../../services/notificaciones-correo.service';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { esAceptable, etiquetaProducto, sinAsignar, textoSugerencia } from '../correos.constants';

/** Destinos del selector: `t:ID` tarjeta existente, `c:ID` cuenta existente, o crear una nueva. */
export const NUEVA_TARJETA = 'nueva-tarjeta';
export const NUEVA_CUENTA = 'nueva-cuenta';

export interface ValoresAsignacion {
  destino: string;
  nombre: string;
  esPrincipal: boolean;
}

/** Cuerpo de `POST /productos/asignar` según lo elegido en el selector. `null` si falta algo. */
export function construirAsignacion(p: Pick<ProductoDetectado, 'ultimos4' | 'instrumento'>, v: ValoresAsignacion): AsignarProducto | null {
  const nombre = v.nombre.trim();
  if (v.destino.startsWith('t:') || v.destino.startsWith('c:')) {
    const id = Number(v.destino.slice(2));
    if (!Number.isInteger(id) || id <= 0) return null;
    return { ultimos4: p.ultimos4, destino: v.destino.startsWith('t:') ? 'TARJETA' : 'CUENTA', id };
  }
  if (v.destino === NUEVA_TARJETA) return { ultimos4: p.ultimos4, destino: 'TARJETA', nuevo: { ...(nombre ? { franquicia: nombre } : {}) } };
  if (v.destino === NUEVA_CUENTA) {
    return { ultimos4: p.ultimos4, destino: 'CUENTA', nuevo: { ...(nombre ? { nombre } : {}), ...(v.esPrincipal ? { esPrincipal: true } : {}) } };
  }
  return null;
}

/** Lo que se envía al aceptar la sugerencia de UN producto (la misma que haría «aceptar todo» para ese producto). */
export function asignacionDeSugerencia(p: Pick<ProductoDetectado, 'ultimos4'>, s: SugerenciaProducto | null): AsignarProducto | null {
  if (!s) return null;
  switch (s.tipo) {
    case 'TARJETA_EXISTENTE':
      return { ultimos4: p.ultimos4, destino: 'TARJETA', id: s.tarjetaId };
    case 'AGREGAR_A_CUENTA':
      return { ultimos4: p.ultimos4, destino: 'CUENTA', id: s.cuentaId };
    case 'CREAR_CUENTA':
      return { ultimos4: p.ultimos4, destino: 'CUENTA', nuevo: { nombre: s.nombre, tipoCuenta: s.tipoCuenta, esPrincipal: s.esPrincipal } };
    case 'CREAR_TARJETA':
      return null; // requiere decidir el nombre
  }
}

/**
 * Productos que aparecen en los correos (cuenta o tarjeta, por los últimos 4 dígitos), a cuál de los tuyos pertenece cada
 * uno y qué se sugiere. Es lo que permite que los correos se registren solos en la cuenta o tarjeta correcta.
 */
@Component({
  selector: 'app-productos-detectados',
  templateUrl: './productos-detectados.component.html',
  styleUrl: './productos-detectados.component.css'
})
export class ProductosDetectadosComponent implements OnInit, OnDestroy {
  /** Cambió la asignación de algún producto (la bandeja puede tener correos nuevos por resolver). */
  @Output() cambiado = new EventEmitter<void>();
  @Output() reprocesar = new EventEmitter<void>();

  readonly etiqueta = etiquetaProducto;
  readonly sugerencia = textoSugerencia;
  readonly aceptable = esAceptable;
  readonly NUEVA_TARJETA = NUEVA_TARJETA;
  readonly NUEVA_CUENTA = NUEVA_CUENTA;

  productos: ProductoDetectado[] = [];
  tarjetas: Tarjeta[] = [];
  cuentas: CuentaFinanciera[] = [];
  cargando = true;
  error: string | null = null;
  abierto = true;
  trabajando = false;

  /** Producto que se está asignando a mano (formulario en línea). */
  asignando: ProductoDetectado | null = null;
  errorAsignar: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.nonNullable.group({
    destino: [''],
    nombre: [''],
    esPrincipal: [false],
  });

  constructor(
    private notificaciones: NotificacionesCorreoService,
    private tarjetasService: TarjetasService,
    private cuentasService: CuentasFinancierasService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get porAsignar(): ProductoDetectado[] {
    return sinAsignar(this.productos);
  }

  get asignados(): ProductoDetectado[] {
    return this.productos.filter((p) => p.asignadoA);
  }

  get aceptables(): ProductoDetectado[] {
    return this.porAsignar.filter((p) => esAceptable(p.sugerencia));
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    forkJoin({
      productos: this.notificaciones.getProductos(),
      tarjetas: this.tarjetasService.getTarjetas(),
      cuentas: this.cuentasService.getCuentas(),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (r) => {
          this.productos = r.productos;
          this.tarjetas = r.tarjetas;
          this.cuentas = r.cuentas;
          // si ya está todo asignado el panel arranca plegado para no estorbar
          this.abierto = r.productos.some((p) => !p.asignadoA);
        },
        error: (err) => {
          this.error = mensajeDeError(err, 'No se pudieron cargar los productos de los correos.');
        }
      });
  }

  alternar(): void {
    this.abierto = !this.abierto;
  }

  nombreTarjeta(t: Tarjeta): string {
    return [t.franquicia, t.descripcion].filter(Boolean).join(' · ') || `Tarjeta ${t.id}`;
  }

  // ── aceptar sugerencias ──

  aceptarTodo(): void {
    this.trabajando = true;
    this.notificaciones
      .aceptarSugerencias()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (r) => {
          const n = r.aplicados.length;
          const creados = r.aplicados.filter((a) => a.creado).length;
          this.toast.exito(
            n === 0
              ? 'No había sugerencias con evidencia suficiente: asigna los productos a mano.'
              : `${n} producto${n === 1 ? '' : 's'} asignado${n === 1 ? '' : 's'}${creados ? ` (${creados} creado${creados === 1 ? '' : 's'})` : ''}.`
          );
          this.cargar();
          this.cambiado.emit();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudieron aceptar las sugerencias.'))
      });
  }

  aceptarUno(p: ProductoDetectado): void {
    const datos = asignacionDeSugerencia(p, p.sugerencia);
    if (datos) this.guardar(datos);
  }

  // ── asignar a mano ──

  abrirAsignar(p: ProductoDetectado): void {
    this.asignando = p;
    this.errorAsignar = null;
    this.form.reset({ destino: this.destinoInicial(p), nombre: '', esPrincipal: false });
  }

  cancelarAsignar(): void {
    this.asignando = null;
    this.errorAsignar = null;
  }

  private destinoInicial(p: ProductoDetectado): string {
    const s = p.sugerencia;
    if (s?.tipo === 'TARJETA_EXISTENTE') return `t:${s.tarjetaId}`;
    if (s?.tipo === 'AGREGAR_A_CUENTA') return `c:${s.cuentaId}`;
    return p.instrumento === 'TC' ? NUEVA_TARJETA : NUEVA_CUENTA;
  }

  get creaNueva(): boolean {
    const d = this.form.controls.destino.value;
    return d === NUEVA_TARJETA || d === NUEVA_CUENTA;
  }

  guardarAsignacion(): void {
    if (!this.asignando) return;
    const datos = construirAsignacion(this.asignando, this.form.getRawValue());
    if (!datos) {
      this.errorAsignar = 'Elige a qué producto pertenecen estos dígitos.';
      return;
    }
    this.guardar(datos);
  }

  private guardar(datos: AsignarProducto): void {
    this.trabajando = true;
    this.errorAsignar = null;
    this.notificaciones
      .asignarProducto(datos)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (r) => {
          this.toast.exito(`••${r.ultimos4} → ${r.nombre}${r.creado ? ' (creado)' : ''}.`);
          this.asignando = null;
          this.cargar();
          this.cambiado.emit();
        },
        error: (err) => {
          this.errorAsignar = mensajeDeError(err, 'No se pudo asignar el producto.');
          if (!this.asignando) this.toast.error(this.errorAsignar);
        }
      });
  }

  trackProducto(_: number, p: ProductoDetectado): string {
    return `${p.instrumento}-${p.ultimos4}`;
  }
}
