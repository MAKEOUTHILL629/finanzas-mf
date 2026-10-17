import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AporteDiario, PeriodoCarro, PersonaResumen, ResultadoAporteDiario } from '../../modelos/aportes';
import { ItemCuenta, ItemPersona } from '../../modelos/catalogos';
import { AportesCarroService } from '../../services/aportes-carro.service';
import { CatalogosService } from '../../services/catalogos.service';
import { SugerenciasService } from '../../services/sugerencias.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo, periodoActual, hoyIso } from '../../shared/periodo.helper';
import { importeConDosDecimales } from '../../shared/validadores';
import {
  LineaFormulario,
  METODOS_APORTE_CARRO,
  OpcionPeriodo,
  avisoCambioACruce,
  avisoCruce,
  clasificarMetodo,
  construirAporteDiario,
  etiquetaMetodo,
  metodoTrasCambiarPersona,
  opcionesDePeriodo,
  periodosConExcedente,
  personaTrasCambiarMetodo,
  pideCuenta,
  primerNombre,
  proyeccionDelMes,
} from '../aportes-carro.constants';

/** El backend admite hasta 50 líneas por día. */
export const MAX_LINEAS_APORTE = 50;

export type FilaLinea = FormGroup<{
  id: FormControl<number | null>;
  valor: FormControl<number | string | null>;
  metodo: FormControl<string | null>;
  personaId: FormControl<number | null>;
  cuentaFinancieraId: FormControl<number | null>;
  comentarios: FormControl<string | null>;
  origenObligacionMesId: FormControl<number | null>;
}>;

@Component({
  selector: 'app-formulario-aporte-diario',
  templateUrl: './formulario-aporte-diario.component.html',
  styleUrl: './formulario-aporte-diario.component.css'
})
export class FormularioAporteDiarioComponent implements OnInit, OnDestroy {
  @Input({ required: true }) periodos: PeriodoCarro[] = [];
  @Input() responsable: PersonaResumen | null = null;
  @Input() cuotaBase: number | null = null;
  /** Aporte a editar; `null` = registrar uno nuevo. */
  @Input() aporte: AporteDiario | null = null;
  /** Mes al que abona por defecto (el seleccionado en la pantalla). */
  @Input() periodoInicial: string | null = null;
  @Output() guardado = new EventEmitter<ResultadoAporteDiario>();
  @Output() cancelar = new EventEmitter<void>();

  readonly metodos = METODOS_APORTE_CARRO;
  readonly maxLineas = MAX_LINEAS_APORTE;
  readonly etiquetaMetodo = etiquetaMetodo;
  readonly nombrePeriodo = nombrePeriodo;

  personas: ItemPersona[] = [];
  /** Cuentas activas en pesos (los aportes en efectivo o por transferencia entran en COP). */
  cuentas: ItemCuenta[] = [];
  opcionesPeriodo: OpcionPeriodo[] = [];
  cargando = true;
  /** Las personas que más aportan al carro (Smart Sorting): van primero en el selector; todas las demás siguen debajo. */
  frecuentes: number[] = [];
  /** Aviso de las líneas cuyo método cambió solo al elegir a un tercero. */
  private avisosCambio = new WeakMap<FilaLinea, string>();
  /** Último tercero (no responsable ni tú) que aportó: se propone en los cruces de cuentas. */
  private ultimoTercero: number | null = null;
  readonly soloPesos = (c: ItemCuenta): boolean => c.moneda === 'COP';
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    fecha: [hoyIso(), Validators.required],
    periodo: ['', [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
    notas: [''],
    lineas: this.fb.array<FilaLinea>([]),
  });

  constructor(
    private aportesService: AportesCarroService,
    private catalogos: CatalogosService,
    private sugerencias: SugerenciasService
  ) {}

  get lineas(): FormArray<FilaLinea> {
    return this.form.controls.lineas;
  }

  get editando(): boolean {
    return !!this.aporte;
  }

  ngOnInit(): void {
    this.opcionesPeriodo = opcionesDePeriodo(this.periodos, periodoActual());
    const periodo = this.aporte?.periodo ?? this.periodoInicial ?? periodoActual();
    this.form.patchValue({
      fecha: this.aporte ? this.aporte.fecha.slice(0, 10) : hoyIso(),
      periodo,
      notas: this.aporte?.notas ?? '',
    });

    // Personas y cuentas: catálogos compartidos. Las líneas se arman cuando ambos responden (o fallan) para poder sugerir a «tu persona».
    let listo = false;
    combineLatest([this.catalogos.estado$('personas'), this.catalogos.estado$('cuentas')])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([p, c]) => {
        this.personas = p.datos;
        this.cuentas = c.datos.filter((x) => x.activa && this.soloPesos(x));
        if (listo) return;
        const personasListas = p.cargado || p.error !== null;
        const cuentasListas = c.cargado || c.error !== null;
        if (!personasListas || !cuentasListas) return;
        listo = true;
        this.cargando = false;
        const fallo = p.error ?? c.error;
        if (fallo && !(p.cargado && c.cargado)) this.errorServidor = fallo;
        this.cargarLineas();
      });
    this.catalogos.asegurar(['personas', 'cuentas']);

    // Quiénes aportan más (para ordenar el selector) y el último tercero: opcional, nunca bloquea el formulario.
    this.sugerencias.defaults().pipe(takeUntil(this.destroy$)).subscribe((d) => {
      this.frecuentes = d.personaAporteIds;
      this.ultimoTercero = d.ultimaPersonaAporteId;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── líneas ──

  private cargarLineas(): void {
    this.lineas.clear();
    if (this.aporte) {
      for (const d of this.aporte.detalles) {
        this.agregarLinea({
          id: d.id,
          valor: d.valor,
          metodo: d.metodo,
          personaId: d.personaId,
          cuentaFinancieraId: d.cuentaFinancieraId,
          comentarios: d.comentarios ?? '',
          origenObligacionMesId: d.origenObligacionMesId,
        });
      }
    } else {
      this.agregarLinea();
    }
  }

  agregarLinea(inicial: Partial<LineaFormulario> = {}): void {
    if (this.lineas.length >= this.maxLineas) return;
    const metodo = inicial.metodo ?? 'EFECTIVO';
    const fila: FilaLinea = this.fb.group({
      id: new FormControl<number | null>(inicial.id ?? null),
      valor: new FormControl<number | string | null>(inicial.valor ?? null, [Validators.required, importeConDosDecimales]),
      metodo: new FormControl<string | null>(metodo, Validators.required),
      personaId: new FormControl<number | null>(inicial.personaId ?? this.responsable?.id ?? null, Validators.required),
      cuentaFinancieraId: new FormControl<number | null>(inicial.cuentaFinancieraId ?? null),
      comentarios: new FormControl<string | null>(inicial.comentarios ?? ''),
      origenObligacionMesId: new FormControl<number | null>(inicial.origenObligacionMesId ?? null),
    });
    // Al cambiar el método se ajustan la persona y la cuenta sugeridas (y el origen del saldo a favor).
    fila.controls.metodo.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((m) => this.alCambiarMetodo(fila, m));
    // Cualquier persona se puede elegir: si es un tercero, el método pasa solo a «Cruce de cuentas» (lo que acepta el servidor).
    fila.controls.personaId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((p) => this.alCambiarPersona(fila, p));
    this.lineas.push(fila);
  }

  quitarLinea(i: number): void {
    if (this.lineas.length > 1) this.lineas.removeAt(i);
  }

  private alCambiarMetodo(fila: FilaLinea, metodo: string | null): void {
    if (!metodo) return;
    let persona = personaTrasCambiarMetodo(metodo, fila.controls.personaId.value, this.responsable?.id ?? null, this.miPersonaId);
    // en un cruce se propone al tercero que aportó la última vez (si lo hay)
    if (persona === null && clasificarMetodo(metodo) === 'CRUCE_CUENTAS' && this.ultimoTercero !== null && this.ultimoTercero !== this.responsable?.id && this.ultimoTercero !== this.miPersonaId) {
      persona = this.ultimoTercero;
    }
    this.avisosCambio.delete(fila);
    fila.controls.personaId.setValue(persona);
    if (!pideCuenta(metodo)) fila.controls.cuentaFinancieraId.setValue(null);
    if (clasificarMetodo(metodo) === 'SALDO_A_FAVOR' && fila.controls.origenObligacionMesId.value === null) {
      fila.controls.origenObligacionMesId.setValue(this.origenSugerido());
    }
  }

  private alCambiarPersona(fila: FilaLinea, personaId: number | null): void {
    const antes = fila.controls.metodo.value;
    const r = metodoTrasCambiarPersona(antes, personaId, this.responsable?.id ?? null, this.miPersonaId);
    if (!r.cambio) {
      this.avisosCambio.delete(fila);
      return;
    }
    fila.controls.metodo.setValue(r.metodo, { emitEvent: false }); // sin pasar por alCambiarMetodo: la persona elegida se respeta
    fila.controls.cuentaFinancieraId.setValue(null);
    fila.controls.origenObligacionMesId.setValue(null);
    this.avisosCambio.set(fila, avisoCambioACruce(primerNombre(this.nombrePersona(personaId)), antes));
  }

  /** Texto cuando la línea pasó sola a «Cruce de cuentas» por haber elegido a un tercero. */
  avisoCambio(fila: FilaLinea): string | null {
    return this.avisosCambio.get(fila) ?? null;
  }

  // ── derivados ──

  /** Tu persona (la enlazada a tu usuario): también puede entregar efectivo o transferencias. */
  get miPersonaId(): number | null {
    return this.personas.find((p) => p.esPropia)?.id ?? null;
  }

  /** Todas las personas pueden figurar en una línea: el método se ajusta solo (ver `alCambiarPersona`). */
  get opcionesPersona(): ItemPersona[] {
    return this.personas;
  }

  get periodosOrigen(): PeriodoCarro[] {
    return periodosConExcedente(this.periodos);
  }

  private origenSugerido(): number | null {
    return this.periodosOrigen[0]?.id ?? null;
  }

  esMetodo(fila: FilaLinea, ...clases: Array<'EFECTIVO' | 'TRANSFERENCIA' | 'CRUCE_CUENTAS' | 'SALDO_A_FAVOR' | 'OTRO'>): boolean {
    return clases.includes(clasificarMetodo(fila.controls.metodo.value));
  }

  /** Un método heredado de AppSheet (p. ej. «Carrera») que no es una de las cuatro opciones: se conserva para poder editar. */
  metodoHeredado(fila: FilaLinea): string | null {
    const m = fila.controls.metodo.value;
    return m && !this.metodos.some((x) => x.valor === m) ? m : null;
  }

  esResponsable(fila: FilaLinea): boolean {
    return fila.controls.personaId.value === this.responsable?.id;
  }

  nombrePersona(id: number | null): string {
    return this.personas.find((p) => p.id === Number(id))?.nombre ?? 'la persona';
  }

  textoCruce(fila: FilaLinea): string {
    return avisoCruce(primerNombre(this.nombrePersona(fila.controls.personaId.value)), this.esResponsable(fila));
  }

  get total(): number {
    return sumarMonedas(this.lineas.controls.map((f) => (f.controls.valor.valid ? Number(f.controls.valor.value) : 0)));
  }

  get periodoElegido(): PeriodoCarro | null {
    return this.periodos.find((p) => p.periodo === this.form.controls.periodo.value) ?? null;
  }

  get periodoNuevo(): boolean {
    return !!this.form.controls.periodo.value && !this.periodoElegido;
  }

  /** Lo que quedaría del mes tras guardar este aporte. */
  get proyeccion() {
    const ya = this.aporte && this.aporte.periodo === this.form.controls.periodo.value ? this.aporte.valorTotal : 0;
    return proyeccionDelMes(this.periodoElegido, this.total, ya);
  }

  get cuentasSinEfectivo(): boolean {
    return this.cuentas.length === 0;
  }

  campoInvalido(nombre: 'fecha' | 'periodo'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  lineaInvalida(fila: FilaLinea, nombre: 'valor' | 'personaId' | 'metodo'): boolean {
    const c = fila.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  // ── envío ──

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo = construirAporteDiario({
      fecha: v.fecha as string,
      periodo: v.periodo as string,
      notas: v.notas,
      lineas: v.lineas.map((l) => ({ ...l })),
    });

    this.enviando = true;
    const peticion = this.aporte ? this.aportesService.actualizarAporteDiario(this.aporte.id, cuerpo) : this.aportesService.crearAporteDiario(cuerpo);
    peticion
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.guardado.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar el aporte.'))
      });
  }
}
