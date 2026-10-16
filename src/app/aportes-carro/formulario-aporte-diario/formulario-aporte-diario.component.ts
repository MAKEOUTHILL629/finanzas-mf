import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AporteDiario, PeriodoCarro, PersonaResumen, ResultadoAporteDiario } from '../../modelos/aportes';
import { ItemCuenta, ItemPersona } from '../../modelos/catalogos';
import { AportesCarroService } from '../../services/aportes-carro.service';
import { CatalogosService } from '../../services/catalogos.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo, periodoActual, hoyIso } from '../../shared/periodo.helper';
import { importeConDosDecimales } from '../../shared/validadores';
import {
  LineaFormulario,
  METODOS_APORTE_CARRO,
  OpcionPeriodo,
  avisoCruce,
  clasificarMetodo,
  construirAporteDiario,
  etiquetaMetodo,
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
  private filtros = new WeakMap<FilaLinea, { clave: string; fn: (p: ItemPersona) => boolean }>();
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
    private catalogos: CatalogosService
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
    this.lineas.push(fila);
  }

  quitarLinea(i: number): void {
    if (this.lineas.length > 1) this.lineas.removeAt(i);
  }

  private alCambiarMetodo(fila: FilaLinea, metodo: string | null): void {
    if (!metodo) return;
    const persona = personaTrasCambiarMetodo(metodo, fila.controls.personaId.value, this.responsable?.id ?? null, this.miPersonaId);
    fila.controls.personaId.setValue(persona);
    if (!pideCuenta(metodo)) fila.controls.cuentaFinancieraId.setValue(null);
    if (clasificarMetodo(metodo) === 'SALDO_A_FAVOR' && fila.controls.origenObligacionMesId.value === null) {
      fila.controls.origenObligacionMesId.setValue(this.origenSugerido());
    }
  }

  // ── derivados ──

  /** Tu persona (la enlazada a tu usuario): también puede entregar efectivo o transferencias. */
  get miPersonaId(): number | null {
    return this.personas.find((p) => p.esPropia)?.id ?? null;
  }

  /** Quiénes pueden figurar en una línea según su método (en un cruce, cualquiera; en lo demás, el responsable o tú). */
  opcionesPersona(fila: FilaLinea): ItemPersona[] {
    const clase = clasificarMetodo(fila.controls.metodo.value);
    if (clase === 'CRUCE_CUENTAS' || clase === 'OTRO') return this.personas;
    const permitidos = new Set([this.responsable?.id, this.miPersonaId]);
    const lista = this.personas.filter((p) => permitidos.has(p.id));
    // al editar, la persona que ya estaba debe poder verse aunque no cumpla
    const actual = this.personas.find((p) => p.id === fila.controls.personaId.value);
    return actual && !lista.includes(actual) ? [...lista, actual] : lista;
  }

  /**
   * Mismo criterio que `opcionesPersona` pero como filtro del selector del catálogo. Se memoriza por fila: devolver una función nueva
   * en cada ciclo de detección haría que el selector recalcule sus opciones sin parar.
   */
  filtroPersona(fila: FilaLinea): (p: ItemPersona) => boolean {
    const clase = clasificarMetodo(fila.controls.metodo.value);
    const clave = `${clase}|${this.miPersonaId}|${this.responsable?.id ?? ''}`;
    const previo = this.filtros.get(fila);
    if (previo?.clave === clave) return previo.fn;
    const abierto = clase === 'CRUCE_CUENTAS' || clase === 'OTRO';
    const permitidos = new Set([this.responsable?.id, this.miPersonaId]);
    const fn = (p: ItemPersona): boolean => abierto || permitidos.has(p.id);
    this.filtros.set(fila, { clave, fn });
    return fn;
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
