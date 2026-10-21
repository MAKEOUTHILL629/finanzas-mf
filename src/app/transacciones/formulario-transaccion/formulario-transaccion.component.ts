import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, finalize, takeUntil } from 'rxjs/operators';
import {
  ActualizarTransaccion,
  CrearTransaccion,
  EstadoTransaccion,
  TipoTransaccion,
  Transaccion,
} from '../../modelos/erp';
import { ItemCategoria, ItemCuenta } from '../../modelos/catalogos';
import { ComercioHabitual, DEFAULTS_VACIOS, DefaultsFormularios } from '../../modelos/sugerencias';
import { CatalogosService } from '../../services/catalogos.service';
import { SugerenciasService } from '../../services/sugerencias.service';
import { TransaccionesService } from '../../services/transacciones.service';
import { esImporteValido } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { aDatetimeLocalBogota, desdeDatetimeLocalBogota } from '../../shared/periodo.helper';
import { ESTADOS_TRANSACCION, TIPOS_TRANSACCION, reglasDeTipo } from '../transacciones.constants';

/** `Date` → valor de `<input type="datetime-local">` en hora de Colombia, sin segundos (así «ahora» es el de Colombia en cualquier navegador). */
export function aDatetimeLocal(d: Date): string {
  return aDatetimeLocalBogota(d);
}

export interface ValoresTransaccion {
  tipoTransaccion: TipoTransaccion;
  cuentaOrigenId: number | null;
  cuentaDestinoId: number | null;
  tarjetaPagadaId: number | null;
  categoriaId: number | null;
  fechaTransaccion: string;
  concepto: string;
  monedaOriginal: string;
  montoOriginal: number | string | null;
  tasaCambio: number | string | null;
  estado: EstadoTransaccion;
  notas: string;
  comisionGMF?: number | string | null;
}

function valoresIniciales(): ValoresTransaccion {
  return {
    tipoTransaccion: 'EGRESO',
    cuentaOrigenId: null,
    cuentaDestinoId: null,
    tarjetaPagadaId: null,
    categoriaId: null,
    fechaTransaccion: aDatetimeLocal(new Date()),
    concepto: '',
    monedaOriginal: 'COP',
    montoOriginal: null,
    tasaCambio: null,
    estado: 'CONFIRMADO',
    notas: '',
    comisionGMF: null,
  };
}

/** Cuerpo de alta: solo las referencias que el tipo admite y la tasa solo si la moneda no es COP. */
export function construirAlta(v: ValoresTransaccion): CrearTransaccion {
  const r = reglasDeTipo(v.tipoTransaccion);
  const moneda = (v.monedaOriginal || 'COP').toUpperCase();
  const notas = v.notas.trim();
  return {
    tipoTransaccion: v.tipoTransaccion,
    ...(r.requiereOrigen && v.cuentaOrigenId !== null ? { cuentaOrigenId: Number(v.cuentaOrigenId) } : {}),
    ...(r.requiereDestino && v.cuentaDestinoId !== null ? { cuentaDestinoId: Number(v.cuentaDestinoId) } : {}),
    ...(r.requiereTarjeta && v.tarjetaPagadaId !== null ? { tarjetaPagadaId: Number(v.tarjetaPagadaId) } : {}),
    ...(v.categoriaId !== null ? { categoriaId: Number(v.categoriaId) } : {}),
    fechaTransaccion: desdeDatetimeLocalBogota(v.fechaTransaccion).toISOString(),
    concepto: v.concepto.trim(),
    monedaOriginal: moneda,
    montoOriginal: String(v.montoOriginal),
    ...(moneda !== 'COP' ? { tasaCambio: String(v.tasaCambio) } : {}),
    estado: v.estado,
    ...(notas ? { notas } : {}),
  };
}

/** Valores del formulario a partir de una transacción existente. */
export function valoresDeTransaccion(t: Transaccion): ValoresTransaccion {
  return {
    tipoTransaccion: t.tipo_transaccion,
    cuentaOrigenId: t.cuenta_origen_id,
    cuentaDestinoId: t.cuenta_destino_id,
    tarjetaPagadaId: t.tarjeta_pagada_id,
    categoriaId: t.categoria_id,
    fechaTransaccion: aDatetimeLocal(new Date(t.fecha_transaccion)),
    concepto: t.concepto,
    monedaOriginal: t.moneda_original,
    montoOriginal: t.monto_original,
    tasaCambio: t.moneda_original === 'COP' ? null : t.tasa_cambio,
    estado: (t.estado ?? 'CONFIRMADO') as EstadoTransaccion,
    notas: t.notas ?? '',
    comisionGMF: null,
  };
}

const mismo = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/** Solo lo que cambió. Las referencias que pasan a vacío se envían como `null` (el backend las admite en el PATCH/PUT). */
export function calcularCambiosTransaccion(original: Transaccion, v: ValoresTransaccion): ActualizarTransaccion {
  const base = valoresDeTransaccion(original);
  const cambios: ActualizarTransaccion = {};
  if (v.tipoTransaccion !== base.tipoTransaccion) cambios.tipoTransaccion = v.tipoTransaccion;
  if (!mismo(v.cuentaOrigenId, base.cuentaOrigenId)) cambios.cuentaOrigenId = v.cuentaOrigenId === null ? null : Number(v.cuentaOrigenId);
  if (!mismo(v.cuentaDestinoId, base.cuentaDestinoId)) cambios.cuentaDestinoId = v.cuentaDestinoId === null ? null : Number(v.cuentaDestinoId);
  if (!mismo(v.tarjetaPagadaId, base.tarjetaPagadaId)) cambios.tarjetaPagadaId = v.tarjetaPagadaId === null ? null : Number(v.tarjetaPagadaId);
  if (!mismo(v.categoriaId, base.categoriaId)) cambios.categoriaId = v.categoriaId === null ? null : Number(v.categoriaId);
  if (v.fechaTransaccion !== base.fechaTransaccion) cambios.fechaTransaccion = desdeDatetimeLocalBogota(v.fechaTransaccion).toISOString();
  if (v.concepto.trim() !== base.concepto.trim()) cambios.concepto = v.concepto.trim();
  if (Number(v.montoOriginal) !== Number(base.montoOriginal)) cambios.montoOriginal = String(v.montoOriginal);
  if (v.monedaOriginal !== 'COP' && Number(v.tasaCambio) !== Number(base.tasaCambio)) cambios.tasaCambio = String(v.tasaCambio);
  if (v.estado !== base.estado) cambios.estado = v.estado;
  if (v.notas.trim() !== base.notas.trim()) cambios.notas = v.notas.trim();
  return cambios;
}

@Component({
  selector: 'app-formulario-transaccion',
  templateUrl: './formulario-transaccion.component.html',
  styleUrl: './formulario-transaccion.component.css'
})
export class FormularioTransaccionComponent implements OnInit, OnDestroy {
  /** Transacción que se edita; `null` = alta. */
  @Input() transaccion: Transaccion | null = null;
  @Output() guardada = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  readonly tipos = TIPOS_TRANSACCION;
  readonly estados = ESTADOS_TRANSACCION.filter((e) => e.valor !== 'ANULADO');

  /** «Bancolombia Ahorros ··3698 (COP)»: la moneda importa al elegir cuentas. */
  readonly etiquetaCuenta = (c: ItemCuenta): string => `${c.nombre}${c.ultimos4 ? ` ··${c.ultimos4.split(/[,;\s]+/)[0]}` : ''} (${c.moneda})${c.activa ? '' : ' · inactiva'}`;
  /** Categorías que aplican al tipo de transacción (las de tipo AMBOS siempre); en un tipo sin categoría propia se ofrecen todas. */
  filtroCategorias: (c: ItemCategoria) => boolean = () => true;

  enviando = false;
  errorServidor: string | null = null;
  sinCambios = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group(
    {
      tipoTransaccion: ['EGRESO' as TipoTransaccion, Validators.required],
      cuentaOrigenId: [null as number | null],
      cuentaDestinoId: [null as number | null],
      tarjetaPagadaId: [null as number | null],
      categoriaId: [null as number | null],
      fechaTransaccion: [aDatetimeLocal(new Date()), Validators.required],
      concepto: ['', [Validators.required, Validators.maxLength(255)]],
      monedaOriginal: ['COP', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
      montoOriginal: [null as number | string | null, [Validators.required, (c: { value: unknown }) => (esImporteValido(c.value) ? null : { importe: true })]],
      tasaCambio: [null as number | string | null],
      estado: ['CONFIRMADO' as EstadoTransaccion, Validators.required],
      notas: [''],
      comisionGMF: [null as number | string | null],
    },
    { validators: (g): ValidationErrors | null => this.validarReglas(g.getRawValue() as ValoresTransaccion) }
  );

  /** Comercios que ya usaste (para sugerir al escribir el concepto) y lo que el historial dice que arranque preseleccionado. */
  comercios: ComercioHabitual[] = [];
  private comerciosPorConcepto = new Map<string, ComercioHabitual>();
  private defaults: DefaultsFormularios = DEFAULTS_VACIOS;
  /** La cuenta de destino la puso la sugerencia (no el usuario): se retira si el tipo deja de ser un ingreso. */
  private destinoSugerido = false;

  constructor(private transaccionesService: TransaccionesService, private catalogos: CatalogosService, private sugerencias: SugerenciasService) {}

  get esEdicion(): boolean {
    return !!this.transaccion;
  }

  get reglas() {
    return reglasDeTipo(this.form.controls.tipoTransaccion.value);
  }

  get esMonedaExtranjera(): boolean {
    return (this.form.controls.monedaOriginal.value || 'COP').toUpperCase() !== 'COP';
  }

  /** Equivalente en COP (solo para previsualizar; la cifra definitiva la calcula el backend con Decimal). */
  get equivalenteCop(): number | null {
    const m = Number(this.form.controls.montoOriginal.value);
    const t = Number(this.form.controls.tasaCambio.value);
    return this.esMonedaExtranjera && Number.isFinite(m) && Number.isFinite(t) && m > 0 && t > 0 ? Math.round(m * t * 100) / 100 : null;
  }

  ngOnInit(): void {
    // Una sola petición trae todo lo que el formulario pueda necesitar según el tipo que se elija (cuentas, tarjetas, categorías).
    this.catalogos.asegurar(['cuentas', 'categorias', 'tarjetas']);
    if (this.transaccion) {
      this.form.reset(valoresDeTransaccion(this.transaccion) as never);
      // tipo y moneda no se cambian al editar: afectan a las reglas y al saldo de otra forma
      this.form.controls.tipoTransaccion.disable();
      this.form.controls.monedaOriginal.disable();
    }

    this.actualizarFiltroCategorias();
    this.form.controls.tipoTransaccion.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.actualizarFiltroCategorias();
      this.aplicarDefaults();
    });
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.limpiarReferenciasQueNoAplican());

    // Solo en el alta: lo habitual (cuenta, tarjeta) y los comercios que ya usaste. Opcional: sin historial todo queda como siempre.
    if (!this.transaccion) {
      combineLatest([this.sugerencias.defaults(), this.sugerencias.comercios(), this.catalogos.estado$('cuentas'), this.catalogos.estado$('tarjetas')])
        .pipe(takeUntil(this.destroy$))
        .subscribe(([defaults, comercios]) => {
          this.defaults = defaults;
          this.comercios = comercios.slice(0, 200);
          this.comerciosPorConcepto = new Map(comercios.map((c) => [c.concepto.toLowerCase(), c]));
          this.aplicarDefaults();
        });
      this.form.controls.concepto.valueChanges.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe((c) => this.alEscribirConcepto(c));
    }
  }

  // ── valores por defecto inteligentes (plan V2, fase 4) ──

  private cuentaExiste(id: number | null): id is number {
    return id !== null && this.catalogos.datos('cuentas').some((c) => c.id === id && c.activa);
  }

  /** Cuenta y tarjeta habituales en los campos que el tipo pide y siguen vacíos (nunca pisa lo que el usuario eligió). */
  private aplicarDefaults(): void {
    if (this.transaccion) return;
    const r = this.reglas;
    const { cuentaOrigenId, cuentaDestinoId, tarjetaPagadaId } = this.form.controls;
    const libre = (c: { value: unknown; dirty: boolean }) => c.value === null && !c.dirty;
    // el destino que se propuso para un ingreso no se arrastra a una transferencia (quedaría igual al origen): ahí lo elige el usuario
    if (this.destinoSugerido && r.requiereOrigen && !cuentaDestinoId.dirty) {
      cuentaDestinoId.setValue(null);
      this.destinoSugerido = false;
    }
    if (r.requiereOrigen && libre(cuentaOrigenId) && this.cuentaExiste(this.defaults.cuentaId)) cuentaOrigenId.setValue(this.defaults.cuentaId);
    // en un ingreso la cuenta habitual es donde se recibe
    if (r.requiereDestino && !r.requiereOrigen && libre(cuentaDestinoId) && this.cuentaExiste(this.defaults.cuentaId)) {
      cuentaDestinoId.setValue(this.defaults.cuentaId);
      this.destinoSugerido = true;
    }
    const tc = this.defaults.tarjetaCreditoId;
    if (r.requiereTarjeta && libre(tarjetaPagadaId) && tc !== null && this.catalogos.datos('tarjetas').some((t) => t.id === tc && t.tipo !== 'DEBITO')) tarjetaPagadaId.setValue(tc);
  }

  /** Si el concepto es un comercio que ya usaste, se propone su categoría y su cuenta habituales (sin pisar lo ya elegido). */
  private alEscribirConcepto(concepto: string | null): void {
    const habitual = this.comerciosPorConcepto.get((concepto ?? '').trim().toLowerCase());
    if (!habitual || this.transaccion) return;
    const { categoriaId, cuentaOrigenId } = this.form.controls;
    if (habitual.categoriaId !== null && categoriaId.value === null && !categoriaId.dirty && this.catalogos.datos('categorias').some((c) => c.id === habitual.categoriaId)) {
      categoriaId.setValue(habitual.categoriaId);
    }
    if (this.reglas.requiereOrigen && habitual.cuentaId !== null && !cuentaOrigenId.dirty && this.cuentaExiste(habitual.cuentaId)) {
      cuentaOrigenId.setValue(habitual.cuentaId);
    }
  }

  private actualizarFiltroCategorias(): void {
    const tipo = this.form.controls.tipoTransaccion.value;
    const propio = tipo === 'INGRESO' ? 'INGRESO' : tipo === 'EGRESO' || tipo === 'PAGO_TARJETA' ? 'EGRESO' : null;
    this.filtroCategorias = propio ? (c: ItemCategoria) => c.tipo === propio || c.tipo === 'AMBOS' : () => true;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Reglas del backend por tipo + tasa obligatoria en moneda extranjera. */
  private validarReglas(v: ValoresTransaccion): ValidationErrors | null {
    const r = reglasDeTipo(v.tipoTransaccion);
    const errores: Record<string, boolean> = {};
    if (r.requiereOrigen && v.cuentaOrigenId === null) errores['origen'] = true;
    if (r.requiereDestino && v.cuentaDestinoId === null) errores['destino'] = true;
    if (r.requiereTarjeta && v.tarjetaPagadaId === null) errores['tarjeta'] = true;
    if (v.tipoTransaccion === 'TRANSFERENCIA' && v.cuentaOrigenId !== null && v.cuentaOrigenId === v.cuentaDestinoId) errores['mismaCuenta'] = true;
    if ((v.monedaOriginal || 'COP').toUpperCase() !== 'COP' && !esImporteValido(v.tasaCambio)) errores['tasa'] = true;
    return Object.keys(errores).length > 0 ? errores : null;
  }

  /** Al cambiar de tipo se vacían las cuentas que ya no aplican (el backend las rechaza). */
  private limpiarReferenciasQueNoAplican(): void {
    const r = this.reglas;
    const { cuentaOrigenId, cuentaDestinoId, tarjetaPagadaId } = this.form.controls;
    if (!r.requiereOrigen && cuentaOrigenId.value !== null) cuentaOrigenId.setValue(null, { emitEvent: false });
    if (!r.requiereDestino && cuentaDestinoId.value !== null) cuentaDestinoId.setValue(null, { emitEvent: false });
    if (!r.requiereTarjeta && tarjetaPagadaId.value !== null) tarjetaPagadaId.setValue(null, { emitEvent: false });
  }

  enviar(): void {
    this.errorServidor = null;
    this.sinCambios = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue() as ValoresTransaccion;
    let peticion;
    if (this.transaccion) {
      const cambios = calcularCambiosTransaccion(this.transaccion, valores);
      if (Object.keys(cambios).length === 0) {
        this.sinCambios = true;
        return;
      }
      peticion = this.transaccionesService.actualizarTransaccion(this.transaccion.id, cambios);
    } else {
      peticion = this.transaccionesService.crearTransaccion(construirAlta(valores));
    }
    this.enviando = true;
    peticion
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: () => {
          if (!this.transaccion) this.reiniciar();
          this.guardada.emit();
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar la transacción.'))
      });
  }

  private reiniciar(): void {
    this.form.reset(valoresIniciales() as never);
    this.sugerencias.invalidar(); // lo recién registrado ya cuenta para lo habitual
    this.aplicarDefaults();
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  mostrarErrorRegla(clave: 'origen' | 'destino' | 'tarjeta' | 'mismaCuenta' | 'tasa'): boolean {
    return !!this.form.errors?.[clave] && (this.form.touched || this.form.dirty);
  }

  /** Iteración 2 — Fase 4: envía transferencia entre cuentas propias creando el par espejo enlazado y opcionalmente el 4x1000. */
  enviarTransferenciaPropia(): void {
    this.errorServidor = null;
    this.form.patchValue({ tipoTransaccion: 'TRANSFERENCIA' });
    if (!this.form.controls.concepto.value?.trim()) {
      this.form.controls.concepto.setValue('Transferencia entre mis cuentas');
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.enviando = true;
    this.transaccionesService
      .crearTransferenciaPropia({
        cuentaOrigenId: Number(v.cuentaOrigenId),
        cuentaDestinoId: Number(v.cuentaDestinoId),
        monto: String(v.montoOriginal),
        monedaOriginal: (v.monedaOriginal || 'COP').toUpperCase(),
        ...(this.esMonedaExtranjera && v.tasaCambio ? { tasaCambio: String(v.tasaCambio) } : {}),
        fechaTransaccion: desdeDatetimeLocalBogota(v.fechaTransaccion ?? aDatetimeLocal(new Date())).toISOString(),
        concepto: v.concepto?.trim() || 'Transferencia entre mis cuentas',
        ...(v.notas?.trim() ? { notas: v.notas.trim() } : {}),
        ...(v.comisionGMF && esImporteValido(v.comisionGMF) ? { comisionGMF: String(v.comisionGMF) } : {}),
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false)),
      )
      .subscribe({
        next: () => {
          this.reiniciar();
          this.guardada.emit();
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo registrar la transferencia entre cuentas propias.')),
      });
  }
}
