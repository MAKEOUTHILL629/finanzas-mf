import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, Subject, forkJoin } from 'rxjs';
import { map, startWith, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs/operators';
import { ApiServicesService } from '../../services/api-services.service';
import { ModalService } from '../../services/modal.service';
import { ItemPersona, ItemPlasticoCatalogo, ItemTarjeta, OpcionSelect } from '../../modelos/catalogos';
import { ComprasCredito, ResponsableCompraCredito } from '../../modelos/compras-credito';
import { ComercioHabitual, DEFAULTS_VACIOS, DefaultsFormularios } from '../../modelos/sugerencias';
import { CatalogosService } from '../../services/catalogos.service';
import { SugerenciasService } from '../../services/sugerencias.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { GRUPO_ACTIVAS, GRUPO_HISTORICAS } from '../../shared/ui/select/select.helpers';
import { esCompraRetroactiva, plasticoParaFecha, terminacion, vigenciaLegible } from '../../tarjetas/tarjetas.constants';
import { PrevisualizacionCompra, previsualizarCompra } from './previsualizar-compra.helper';

/** Lo que el formulario rellenó solo con la última compra en un comercio (para decírselo a quien lo llena). */
export interface AutocompletadoComercio {
  concepto: string;
  /** Con el artículo, listos para una frase: «el valor», «las cuotas», «la tarjeta»… */
  campos: string[];
}

/** «a», «a y b», «a, b y c». */
function unirEnLista(items: ReadonlyArray<string>): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0] ?? '';
}

/** Campos obligatorios de la compra, en el orden en que se llenan, con el nombre con el que se piden. */
const CAMPOS_OBLIGATORIOS: ReadonlyArray<readonly [string, string]> = [
  ['concept', 'el concepto'],
  ['purchaseValue', 'el valor'],
  ['purchaseDate', 'la fecha'],
  ['cardId', 'la tarjeta'],
  ['installments', 'las cuotas'],
  ['interest', 'el interés'],
];

@Component({
  selector: 'app-formulario-compras-credito',
  templateUrl: './formulario-compras-credito.component.html',
  styleUrls: ['./formulario-compras-credito.component.css']
})
export class FormularioComprasCreditoComponent implements OnInit, OnDestroy {

  // Referencia al trigger del autocomplete
  @ViewChild('autoConceptTrigger', { read: MatAutocompleteTrigger })
  autocompleteTrigger!: MatAutocompleteTrigger;

  /** «Seguir editando»: recibe el foco cuando aparece la confirmación de descarte. */
  @ViewChild('btnSeguirEditando', { read: ElementRef })
  btnSeguirEditando?: ElementRef<HTMLElement>;

  // Formularios
  purchaseForm!: FormGroup;
  responsableForm!: FormGroup;

  // Datos
  concepts: string[] = [];
  /** Lo habitual de cada comercio que ya usaste (por el concepto en minúsculas). */
  private comercios = new Map<string, ComercioHabitual>();
  /** Lo que el historial sugiere para arrancar (tarjeta, cuotas, persona). */
  private defaults: DefaultsFormularios = DEFAULTS_VACIOS;
  creditCards: ItemTarjeta[] = [];
  personas: ItemPersona[] = [];
  personasDisponibles: ItemPersona[] = [];
  responsables: ResponsableCompraCredito[] = [];
  /** Personas que aún se pueden agregar como responsables (cambia de referencia al agregar/quitar para que el selector se actualice). */
  filtroPersonas: (p: ItemPersona) => boolean = () => true;

  // Observables
  filteredConcepts!: Observable<string[]>;

  /** Plazos que se piden casi siempre: se eligen con un toque en vez de escribirlos. */
  readonly plazosFrecuentes: ReadonlyArray<number> = [1, 3, 6, 12, 24, 36];
  readonly estados: ReadonlyArray<{ valor: string; etiqueta: string }> = [
    { valor: 'pendiente', etiqueta: 'Pendiente' },
    { valor: 'pagado', etiqueta: 'Pagado' },
    { valor: 'cancelado', etiqueta: 'Cancelado' },
  ];

  /** «American Express ··1927 — 1.8895% E.M.»: el plástico ACTIVO y la tasa que se importará al campo de interés. */
  readonly etiquetarTarjeta = (t: ItemTarjeta): string => `${t.etiqueta}${t.tasaInteresCompra != null ? ` — ${t.tasaInteresCompra}% E.M.` : ''}`;

  // Flags
  isNewConcept = false;
  isLoadingConcepts = false;
  isSubmitting = false;
  showResponsablesSection = false;
  detallesAbiertos = false;
  porcentajeRestante = 100;
  interestAutoFilled = false;  // true cuando la tasa se importó automáticamente de la tarjeta
  tagsCompra: string[] = [];
  /** Qué se rellenó solo con lo habitual del comercio escrito (`null` si nada). */
  autocompletado: AutocompletadoComercio | null = null;
  /** El servidor rechazó el guardado (o falló la asignación de responsables): se muestra dentro del formulario. */
  errorServidor: string | null = null;
  /** La compra ya existe en el servidor y solo falló asignar responsables: no se puede guardar de nuevo (se duplicaría). */
  compraGuardada = false;
  /** «¿Descartar lo que escribiste?» en lugar de los botones de siempre. */
  confirmandoDescarte = false;

  private destroy$ = new Subject<void>();
  /** Cuotas de la compra antes del último cambio: los responsables que pagaban «todas» siguen al nuevo número. */
  private cuotasPrevias = 1;
  private memoResumen: { clave: string; valor: PrevisualizacionCompra | null } | null = null;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService,
    private modalService: ModalService,
    private catalogos: CatalogosService,
    private sugerencias: SugerenciasService,
    private host: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.initializeResponsableForm();
    this.loadInitialData();
    this.setupConceptAutocomplete();
    this.listenToConceptChanges();
    this.setupResponsableFormListeners();
    this.listenToModalClose();
    this.listenToCardChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INICIALIZACIÓN ====================

  /** Hoy en hora de Colombia. */
  private getTodayDate(): string {
    return hoyIso();
  }

  private initializeForm(): void {
    this.purchaseForm = this.fb.group({
      concept: ['', Validators.required],
      purchaseValue: ['', [Validators.required, Validators.min(0.01)]],
      purchaseDate: [this.getTodayDate(), Validators.required],
      installments: [1, [Validators.required, Validators.min(1)]],
      // «.» o «1.» pasaban por `min(0)` (parseFloat('.') es NaN): se exige al menos un dígito
      interest: [0, [Validators.required, Validators.min(0), Validators.pattern(/^(?=.*\d)\d*\.?\d*$/)]],
      description: [''],
      status: ['pendiente', Validators.required],
      cardId: ['', Validators.required],
      // Solo se usa en compras retroactivas: con qué plástico (archivado) se pagó. Vacío = que el servidor lo deduzca por la fecha.
      plasticoId: ['']
    });
  }

  private initializeResponsableForm(): void {
    this.responsableForm = this.fb.group({
      personaId: ['', Validators.required],
      porcentajePago: ['', [Validators.required, Validators.min(0.01), Validators.max(100)]],
      cantidadPago: ['', [Validators.required, Validators.min(0)]],
      // la compra parte de 1 cuota; el tope sube con las cuotas de la compra (`ajustarCuotasDeResponsables`)
      cantidadCuotas: ['', [Validators.required, Validators.min(1), Validators.max(1)]]
    });
  }

  // ==================== CARGA DE DATOS ====================

  private loadInitialData(): void {
    this.loadConcepts();
    this.suscribirCatalogos();
  }

  /**
   * Tarjetas y personas vienen del catálogo compartido (con esqueleto, vacío y reintento en cada selector). Se vuelven a asegurar cada
   * vez que se abre el formulario: si algo se creó o cambió desde la última vez, el selector lo trae sin recargar la página.
   */
  private suscribirCatalogos(): void {
    this.catalogos.estado$('tarjetas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.creditCards = e.datos;
      this.aplicarTarjetaPorDefecto();
      const currentCardId = this.purchaseForm.get('cardId')?.value;
      if (currentCardId && e.datos.length > 0) this.applyCardInterestRate(Number(currentCardId));
    });
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.personas = e.datos;
      this.updatePersonasDisponibles();
      this.aplicarPersonaPorDefecto();
    });
    this.catalogos.asegurar(['tarjetas', 'personas']);
  }

  /**
   * Comercios que ya usaste (con lo habitual de cada uno) y valores por defecto del historial. Es opcional: si la consulta falla el
   * formulario queda como siempre, sin sugerencias.
   */
  private loadConcepts(): void {
    this.isLoadingConcepts = true;
    forkJoin([this.sugerencias.comercios(), this.sugerencias.defaults()])
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingConcepts = false))
      )
      .subscribe(([comercios, defaults]) => {
        this.concepts = comercios.map((c) => c.concepto);
        this.comercios = new Map(comercios.map((c) => [c.concepto.toLowerCase(), c]));
        this.defaults = defaults;
        this.aplicarDefaults();
      });
  }

  // ==================== VALORES POR DEFECTO ====================

  /** Tarjeta, cuotas y persona con los que arranca el formulario: lo que más se usa (nunca pisa lo que el usuario ya eligió). */
  private aplicarDefaults(): void {
    const cuotas = this.purchaseForm.get('installments');
    if (cuotas && !cuotas.dirty && this.defaults.cuotas >= 1) cuotas.setValue(this.defaults.cuotas);
    this.aplicarTarjetaPorDefecto();
    this.aplicarPersonaPorDefecto();
  }

  private aplicarTarjetaPorDefecto(): void {
    const control = this.purchaseForm?.get('cardId');
    const id = this.defaults.tarjetaCreditoId;
    if (!control || control.dirty || control.value || id === null) return;
    if (this.creditCards.some((t) => t.id === id && t.tipo !== 'DEBITO')) control.setValue(id);
  }

  /** La persona que se propone como responsable: la última a la que se le asignó una compra o, si no, tú. */
  private aplicarPersonaPorDefecto(): void {
    const control = this.responsableForm?.get('personaId');
    const id = this.defaults.ultimaPersonaCompraId ?? this.defaults.personaPropiaId;
    if (!control || control.dirty || control.value || id === null || this.responsables.length > 0) return;
    if (this.personasDisponibles.some((p) => p.id === id)) control.setValue(id);
  }

  /** Escucha cambios en la tarjeta seleccionada y auto-rellena el campo de interés */
  private listenToCardChanges(): void {
    this.purchaseForm.get('cardId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(cardId => {
        if (cardId) {
          this.applyCardInterestRate(Number(cardId));
        } else {
          this.interestAutoFilled = false;
        }
        this.sugerirPlastico();
      });

    // Una compra retroactiva puede ser de un plástico anterior: se sugiere el que regía en esa fecha.
    this.purchaseForm.get('purchaseDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.sugerirPlastico());

    // Si el usuario edita el interés manualmente, el hint desaparece
    // (setValue con emitEvent:false no dispara este listener)
    this.purchaseForm.get('interest')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.interestAutoFilled) {
          this.interestAutoFilled = false;
        }
      });

    // Las cuotas de la compra se reflejan en las que se le asignan a los responsables (los ya agregados y el que se está proponiendo)
    this.purchaseForm.get('installments')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((cuotas) => {
        this.ajustarCuotasDeResponsables(Number(cuotas));
        this.sincronizarResponsable();
      });
  }

  /** ¿La compra es anterior al plástico activo y la tarjeta tiene plásticos anteriores? Entonces se deja elegir. */
  get mostrarSelectorPlastico(): boolean {
    return esCompraRetroactiva(this.selectedCard, this.purchaseForm.get('purchaseDate')?.value ?? null);
  }

  get plasticosElegibles(): ItemPlasticoCatalogo[] {
    return this.selectedCard?.plasticos ?? [];
  }

  private opcionesPlasticoCache: { origen: ItemPlasticoCatalogo[]; opciones: OpcionSelect[] } | null = null;

  /** Plásticos de la tarjeta para el selector: «Activas» y «Históricas / Reemplazadas» (se busca por los 4 dígitos). */
  get opcionesPlastico(): OpcionSelect[] {
    const origen = this.plasticosElegibles;
    if (this.opcionesPlasticoCache?.origen !== origen) {
      this.opcionesPlasticoCache = {
        origen,
        opciones: origen.map((p) => ({
          valor: p.id,
          etiqueta: terminacion(p.ultimos4),
          detalle: `${p.esActivo ? 'activo' : 'archivado'} · ${vigenciaLegible(p)}`,
          busqueda: p.ultimos4,
          grupo: p.esActivo ? GRUPO_ACTIVAS : GRUPO_HISTORICAS,
        })),
      };
    }
    return this.opcionesPlasticoCache.opciones;
  }

  /** Deja seleccionado el plástico que regía en la fecha de la compra (o nada si no es retroactiva). */
  private sugerirPlastico(): void {
    const control = this.purchaseForm.get('plasticoId');
    if (!control) return;
    if (!this.mostrarSelectorPlastico) {
      control.setValue('', { emitEvent: false });
      return;
    }
    const deducido = plasticoParaFecha(this.plasticosElegibles, this.purchaseForm.get('purchaseDate')?.value ?? null);
    control.setValue(deducido ? String(deducido.id) : '', { emitEvent: false });
  }

  /** Aplica la tasa de interés de compra de la tarjeta al campo de interés.
   *  Siempre se aplica al cambiar de tarjeta; el usuario puede sobrescribir después. */
  private applyCardInterestRate(cardId: number): void {
    const card = this.creditCards.find(c => c.id === cardId);
    const interestControl = this.purchaseForm.get('interest');
    if (card && card.tasaInteresCompra != null) {
      interestControl?.setValue(card.tasaInteresCompra, { emitEvent: false });
      interestControl?.markAsPristine();
      this.interestAutoFilled = true;
    } else {
      this.interestAutoFilled = false;
    }
  }

  // ==================== AUTOCOMPLETADO ====================

  private listenToModalClose(): void {
    this.modalService.modalState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state === null) {
          if (this.autocompleteTrigger?.panelOpen) this.autocompleteTrigger.closePanel();
          this.confirmandoDescarte = false;
          // la compra ya se guardó (solo falló asignar responsables): al cerrar, el formulario queda limpio para la siguiente
          if (this.compraGuardada) this.resetForm();
        }
        if (state === 'compra-credito-form') this.catalogos.asegurar(['tarjetas', 'personas']);
      });
  }

  private setupConceptAutocomplete(): void {
    const conceptControl = this.purchaseForm.get('concept');
    if (conceptControl) {
      this.filteredConcepts = conceptControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        map(value => this._filterConcepts(value || '')),
        takeUntil(this.destroy$)
      );
    } else {
      this.filteredConcepts = new Observable<string[]>();
    }
  }

  private _filterConcepts(value: string): string[] {
    const filterValue = value.toLowerCase().trim();
    if (!filterValue) {
      return this.concepts.slice();
    }
    return this.concepts.filter(concept => concept.toLowerCase().includes(filterValue));
  }

  private listenToConceptChanges(): void {
    this.purchaseForm.get('concept')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        const currentConcept = (value || '').trim();
        if (currentConcept && this.concepts.length > 0 && !this.isLoadingConcepts) {
          const habitual = this.comercios.get(currentConcept.toLowerCase());
          this.isNewConcept = !habitual;
          // Autocompletado inteligente: lo habitual de ese comercio (cuotas, tarjeta, valor, responsable)
          if (habitual) this.autoFillFromConcept(habitual);
          else this.autocompletado = null;
        } else {
          this.isNewConcept = false;
          this.autocompletado = null;
        }
      });
  }

  private autoFillFromConcept(habitual: ComercioHabitual): void {
    const valueControl = this.purchaseForm.get('purchaseValue');
    const installmentsControl = this.purchaseForm.get('installments');
    const cardControl = this.purchaseForm.get('cardId');
    const campos: string[] = [];

    if (valueControl && !valueControl.dirty && habitual.ultimoValor) {
      valueControl.setValue(this.formatCurrency(habitual.ultimoValor));
      campos.push('el valor');
    }
    if (installmentsControl && !installmentsControl.dirty && habitual.cuotas) {
      installmentsControl.setValue(habitual.cuotas);
      campos.push('las cuotas');
    }
    if (cardControl && !cardControl.dirty && habitual.tarjetaId && this.creditCards.some((t) => t.id === habitual.tarjetaId && t.tipo !== 'DEBITO')) {
      cardControl.setValue(habitual.tarjetaId);
      campos.push('la tarjeta');
    }
    // el responsable habitual de ese comercio se deja elegido (sin agregarlo: el usuario confirma con «Agregar»)
    const persona = this.responsableForm.get('personaId');
    if (persona && !persona.dirty && habitual.personaId && this.responsables.length === 0 && this.personasDisponibles.some((p) => p.id === habitual.personaId)) {
      persona.setValue(habitual.personaId);
      this.showResponsablesSection = true;
      campos.push('el responsable');
    }
    // el valor llegó sin pasar por el campo: el responsable propuesto (y los ya agregados) deben seguirlo, o «Agregar» guardaría $0
    this.sincronizarResponsable();
    this.autocompletado = campos.length > 0 ? { concepto: habitual.concepto, campos } : null;
  }

  displayFn(concept: string): string {
    return concept || '';
  }

  // ==================== FORMATEO DE CAMPOS ====================

  handleCurrencyInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const originalValue = inputElement.value;

    const numericValue = originalValue.replace(/[^0-9]/g, '');

    if (numericValue === '') {
      inputElement.value = '';
      this.purchaseForm.get('purchaseValue')?.patchValue('', { emitEvent: false });
      this.sincronizarResponsable();
      return;
    }

    const formatted = this.formatCurrency(parseFloat(numericValue));

    inputElement.value = formatted;
    this.purchaseForm.get('purchaseValue')?.patchValue(formatted, { emitEvent: false });
    this.sincronizarResponsable();
  }

  /**
   * Los responsables siguen al valor y a las cuotas de la compra: el monto de los ya agregados se recalcula con su porcentaje, y si ya hay
   * una persona elegida en el formulario de responsable (p. ej. la sugerida), su monto y sus cuotas también (se eligió antes de escribir
   * el valor, y sin esto «Agregar» guardaría $0).
   */
  private sincronizarResponsable(): void {
    this.recalcularMontosDeResponsables();
    if (!this.responsableForm?.get('personaId')?.value) return;
    const porcentaje = this.responsableForm.get('porcentajePago')?.value;
    if (porcentaje !== null && porcentaje !== undefined && porcentaje !== '') this.updateCantidadPago(Number(porcentaje));
    const cuotas = this.responsableForm.get('cantidadCuotas');
    if (cuotas && !cuotas.dirty) cuotas.setValue(this.purchaseForm.get('installments')?.value || 1, { emitEvent: false });
  }

  private recalcularMontosDeResponsables(): void {
    const valorCompra = this.parseCurrencyValue(this.purchaseForm?.get('purchaseValue')?.value);
    for (const r of this.responsables) r.cantidadPago = this.roundToTwoDecimals((r.porcentajePago / 100) * valorCompra);
  }

  /** Un responsable que pagaba todas las cuotas sigue pagando todas; ninguno puede pagar más cuotas de las que tiene la compra. */
  private ajustarCuotasDeResponsables(nuevas: number): void {
    if (!Number.isInteger(nuevas) || nuevas < 1) return;
    const previas = this.cuotasPrevias;
    this.cuotasPrevias = nuevas;
    for (const r of this.responsables) {
      if (r.cantidadCuotas === previas || r.cantidadCuotas > nuevas) r.cantidadCuotas = nuevas;
    }
    const cuotas = this.responsableForm?.get('cantidadCuotas');
    cuotas?.setValidators([Validators.required, Validators.min(1), Validators.max(nuevas)]);
    cuotas?.updateValueAndValidity({ emitEvent: false });
  }

  handleInterestInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const originalValue = inputElement.value;

    let newValue = originalValue.replace(/,/g, '.');
    newValue = newValue.replace(/[^0-9.]/g, '');

    const parts = newValue.split('.');
    if (parts.length > 2) {
      newValue = parts[0] + '.' + parts.slice(1).join('');
    }

    if (originalValue !== newValue) {
      const selectionStart = inputElement.selectionStart;
      const selectionEnd = inputElement.selectionEnd;

      inputElement.value = newValue;
      this.purchaseForm.get('interest')?.patchValue(newValue, { emitEvent: false });

      if (selectionStart !== null && selectionEnd !== null) {
        inputElement.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }

  private formatCurrency(value: number): string {
    if (isNaN(value)) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private parseCurrencyValue(value: string | number | null): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/\./g, '');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }

  // ==================== ELECCIÓN RÁPIDA (CUOTAS, ESTADO) ====================

  elegirCuotas(cuotas: number): void {
    const control = this.installments;
    control?.setValue(cuotas);
    control?.markAsDirty();
  }

  /** El plazo que recibe el foco con Tab: el elegido o, si las cuotas no son una de las frecuentes, el primero (una sola parada de Tab para todo el grupo). */
  get indiceAtajoTabulable(): number {
    return Math.max(0, this.plazosFrecuentes.indexOf(Number(this.installments?.value)));
  }

  /** Flechas ← → (↑ ↓), inicio y fin eligen el plazo y le pasan el foco, como en cualquier grupo de opciones nativo. */
  tecladoCuotas(evento: KeyboardEvent): void {
    const total = this.plazosFrecuentes.length;
    const actual = this.indiceAtajoTabulable;
    const destino = evento.key === 'ArrowRight' || evento.key === 'ArrowDown' ? (actual + 1) % total
      : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp' ? (actual - 1 + total) % total
      : evento.key === 'Home' ? 0
      : evento.key === 'End' ? total - 1
      : -1;
    if (destino < 0) return;
    evento.preventDefault();
    this.elegirCuotas(this.plazosFrecuentes[destino]);
    const grupo = evento.currentTarget as HTMLElement;
    setTimeout(() => grupo.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }

  elegirEstado(valor: string): void {
    const control = this.status;
    control?.setValue(valor);
    control?.markAsDirty();
  }

  get indiceEstado(): number {
    return Math.max(0, this.estados.findIndex((e) => e.valor === this.status?.value));
  }

  /** Flechas ← → (↑ ↓) mueven la selección del estado y su foco, como en cualquier control segmentado nativo. */
  tecladoEstado(evento: KeyboardEvent): void {
    const paso = evento.key === 'ArrowRight' || evento.key === 'ArrowDown' ? 1 : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp' ? -1 : 0;
    if (paso === 0) return;
    evento.preventDefault();
    const siguiente = this.estados[(this.indiceEstado + paso + this.estados.length) % this.estados.length];
    this.elegirEstado(siguiente.valor);
    const grupo = evento.currentTarget as HTMLElement;
    setTimeout(() => grupo.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }

  // ==================== GESTIÓN DE RESPONSABLES ====================

  private setupResponsableFormListeners(): void {
    this.responsableForm.get('porcentajePago')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(porcentaje => this.updateCantidadPago(porcentaje));

    this.responsableForm.get('cantidadPago')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(cantidad => this.updatePorcentajePago(cantidad));

    this.responsableForm.get('personaId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onPersonaSelected());
  }

  private updatePersonasDisponibles(): void {
    const responsablesIds = new Set(this.responsables.map(r => r.persona));
    this.personasDisponibles = this.personas.filter(p => !responsablesIds.has(p.id));
    this.filtroPersonas = (p: ItemPersona) => !responsablesIds.has(p.id);
  }

  private calcularPorcentajeRestante(): void {
    const porcentajeAsignado = this.responsables.reduce((sum, r) => sum + r.porcentajePago, 0);
    // redondeado: 100 − 33,3 − 33,3 daría 33.400000000000006 en pantalla y en el tope del campo
    this.porcentajeRestante = this.roundToTwoDecimals(Math.max(0, 100 - porcentajeAsignado));

    this.responsableForm.get('porcentajePago')?.setValidators([
      Validators.required,
      Validators.min(0.01),
      Validators.max(this.porcentajeRestante)
    ]);
    this.responsableForm.get('porcentajePago')?.updateValueAndValidity();
  }

  private updateCantidadPago(porcentaje: number | null): void {
    const cantidad = this.responsableForm.get('cantidadPago');
    // sin porcentaje (campo borrado) tampoco hay monto: no se deja el del valor anterior
    if (porcentaje === null || porcentaje === undefined || (porcentaje as unknown) === '') {
      cantidad?.setValue('', { emitEvent: false });
      return;
    }
    const valorCompra = this.parseCurrencyValue(this.purchaseForm.get('purchaseValue')?.value);
    cantidad?.setValue(this.roundToTwoDecimals((porcentaje / 100) * valorCompra), { emitEvent: false });
  }

  private updatePorcentajePago(cantidad: number): void {
    if (cantidad !== null && cantidad !== undefined) {
      const valorCompra = this.parseCurrencyValue(this.purchaseForm.get('purchaseValue')?.value);
      if (valorCompra > 0) {
        const porcentajePago = this.roundToTwoDecimals((cantidad / valorCompra) * 100);
        this.responsableForm.get('porcentajePago')?.setValue(porcentajePago, { emitEvent: false });
      }
    }
  }

  private onPersonaSelected(): void {
    const personaId = this.responsableForm.get('personaId')?.value;
    if (personaId) {
      const installments = this.purchaseForm.get('installments')?.value || 1;
      this.responsableForm.get('cantidadCuotas')?.setValue(installments);
      this.responsableForm.get('porcentajePago')?.setValue(this.porcentajeRestante);
      this.updateCantidadPago(this.porcentajeRestante);
    }
  }

  addResponsable(): void {
    if (this.responsableForm.valid && this.porcentajeRestante > 0) {
      const newResponsable: ResponsableCompraCredito = {
        persona: parseInt(this.responsableForm.value.personaId, 10),
        porcentajePago: parseFloat(this.responsableForm.value.porcentajePago),
        cantidadPago: parseFloat(this.responsableForm.value.cantidadPago),
        cantidadCuotas: parseInt(this.responsableForm.value.cantidadCuotas, 10)
      };

      this.responsables.push(newResponsable);
      this.calcularPorcentajeRestante();
      this.updatePersonasDisponibles();
      this.responsableForm.reset();
    }
  }

  removeResponsable(index: number): void {
    this.responsables.splice(index, 1);
    this.calcularPorcentajeRestante();
    this.updatePersonasDisponibles();
  }

  getPersonaNombre(id: number): string {
    const persona = this.personas.find(p => p.id === Number(id));
    return persona ? persona.nombre || 'N/A' : 'N/A';
  }

  /** Iniciales para el círculo de cada responsable: las de la persona o, si no tiene, las dos primeras letras de su nombre. */
  getPersonaIniciales(id: number): string {
    const persona = this.personas.find(p => p.id === Number(id));
    return (persona?.iniciales || persona?.nombre?.slice(0, 2) || '?').toUpperCase();
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  // ==================== CANCELAR / DESCARTAR ====================

  /** Sin nada escrito se cierra de una; con cambios se pide confirmar (el cierre por la X o Esc conserva el borrador). */
  get hayCambios(): boolean {
    return this.purchaseForm.dirty || this.responsables.length > 0 || this.tagsCompra.length > 0 || !!this.responsableForm.get('personaId')?.dirty;
  }

  cancelar(): void {
    if (!this.hayCambios) {
      this.modalService.close();
      return;
    }
    this.confirmandoDescarte = true;
    setTimeout(() => this.btnSeguirEditando?.nativeElement.focus());
  }

  seguirEditando(): void {
    this.confirmandoDescarte = false;
  }

  descartar(): void {
    this.reiniciarFormulario();
    this.modalService.close();
  }

  /** Cierra sin tocar nada más (el formulario se limpia solo si la compra ya se había guardado: ver `listenToModalClose`). */
  cerrar(): void {
    this.modalService.close();
  }

  // ==================== ENVÍO DEL FORMULARIO ====================

  onSubmit(): void {
    if (this.isSubmitting || this.compraGuardada) return;
    this.purchaseForm.markAllAsTouched();

    if (this.purchaseForm.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, .ng-invalid input')?.focus();
      return;
    }

    this.errorServidor = null;
    this.isSubmitting = true;
    const formValue = this.purchaseForm.getRawValue();
    const purchaseData = this.preparePurchaseData(formValue);

    this.savePurchase(purchaseData);
  }

  private preparePurchaseData(formValue: any): ComprasCredito {
    const purchaseValue = this.parseCurrencyValue(formValue.purchaseValue);
    const installments = parseInt(formValue.installments, 10);
    const interest = parseFloat(formValue.interest);

    return {
      concepto: formValue.concept.trim(),
      valorCompra: isNaN(purchaseValue) ? 0 : purchaseValue,
      fechaCompra: formValue.purchaseDate,
      numeroCuotas: isNaN(installments) ? 0 : installments,
      interes: isNaN(interest) ? 0 : interest,
      descripcion: formValue.description?.trim() || '',
      estado: formValue.status,
      tarjeta: parseInt(formValue.cardId, 10),
      fechaUltimaCuota: formValue.purchaseDate,
      pagoMensual: 0,
      ...(this.tagsCompra.length > 0 ? { tags: [...this.tagsCompra] } : {}),
      // Solo si el usuario puede elegir (compra retroactiva): si no, el servidor guarda el plástico vigente en esa fecha.
      ...(this.mostrarSelectorPlastico && formValue.plasticoId ? { plasticoId: parseInt(formValue.plasticoId, 10) } : {})
    };
  }

  private savePurchase(purchase: ComprasCredito): void {
    this.apiService.post<ComprasCredito>('compras-credito', purchase)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          if (this.responsables.length > 0 && response.id) {
            this.saveResponsables(response.id);
          } else {
            this.isSubmitting = false;
            this.terminar();
          }
        },
        error: err => {
          this.isSubmitting = false;
          this.errorServidor = mensajeDeError(err, 'No se pudo guardar la compra. Inténtalo de nuevo.');
          this.llevarAlError();
        }
      });
  }

  /** Si se envió con Enter desde un campo de arriba, el aviso (junto a «Guardar») queda fuera de la vista: se trae. */
  private llevarAlError(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.compra__pie .erp-alert--danger')?.scrollIntoView({ block: 'nearest' }));
  }

  private saveResponsables(compraId: number): void {
    const peticiones = this.responsables.map(r =>
      this.apiService.post<ResponsableCompraCredito>('compras-credito/responsables', { ...r, compraCredito: compraId })
    );

    forkJoin(peticiones)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => this.terminar(),
        error: err => {
          // la compra ya está creada: que la lista la muestre, y que no se pueda guardar otra vez la misma
          this.compraGuardada = true;
          this.modalService.notifyCompraCreated();
          this.errorServidor = `La compra se guardó, pero no se pudieron asignar los responsables (${mensajeDeError(err, 'error desconocido')}). Asígnalos desde el detalle de la compra.`;
          this.llevarAlError();
        }
      });
  }

  private terminar(): void {
    this.resetForm();
    this.modalService.close();
    this.modalService.notifyCompraCreated(); // Notificar que se creó la compra
  }

  /**
   * Tras guardar: formulario limpio y lo habitual de la compra recién guardada ya cuenta para las sugerencias. Los valores por defecto NO se
   * aplican aquí: los del historial anterior quedarían puestos y los nuevos (que llegan con `loadConcepts`) ya no los reemplazarían.
   */
  private resetForm(): void {
    this.reiniciarFormulario(false);
    this.sugerencias.invalidar();
    this.loadConcepts();
  }

  /** Deja el formulario como recién abierto; con `conDefaults`, con las sugerencias del historial (tarjeta, cuotas, persona) ya aplicadas. */
  private reiniciarFormulario(conDefaults = true): void {
    // Restaurar valores por defecto en lugar de dejar nulls
    this.purchaseForm.reset({
      concept: '',
      purchaseValue: '',
      purchaseDate: this.getTodayDate(),
      installments: 1,
      interest: 0,
      description: '',
      status: 'pendiente',
      cardId: '',
      plasticoId: ''
    });
    this.responsableForm.reset();
    this.responsables = [];
    this.tagsCompra = [];
    this.porcentajeRestante = 100;
    this.cuotasPrevias = 1;
    this.isNewConcept = false;
    this.interestAutoFilled = false;
    this.autocompletado = null;
    this.errorServidor = null;
    this.compraGuardada = false;
    this.confirmandoDescarte = false;
    this.showResponsablesSection = false;
    this.detallesAbiertos = false;
    // Recalcular validadores de porcentajePago (Validators.max se queda con
    // el valor de la compra anterior si no se resetea explícitamente)
    this.calcularPorcentajeRestante();
    this.updatePersonasDisponibles();
    if (conDefaults) this.aplicarDefaults();
  }

  // ==================== LO QUE SE VE ====================

  /**
   * Vista previa de la compra con lo que ya se escribió (promedio por cuota, intereses, total, primer pago). `null` mientras falte algo.
   * Se memoriza por las entradas para no recalcular las cuotas en cada ciclo de detección de cambios.
   */
  get resumen(): PrevisualizacionCompra | null {
    const v = this.purchaseForm.getRawValue();
    const entrada = {
      valor: this.parseCurrencyValue(v.purchaseValue),
      numeroCuotas: Number(v.installments),
      interesMensual: parseFloat(String(v.interest)),
      fechaCompra: String(v.purchaseDate ?? ''),
      diaCorte: this.selectedCard?.diaCorte ?? null,
    };
    const clave = JSON.stringify(entrada);
    if (this.memoResumen?.clave !== clave) this.memoResumen = { clave, valor: previsualizarCompra(entrada) };
    return this.memoResumen.valor;
  }

  /** Lo que aún se necesita para poder guardar: «el valor y la tarjeta». Vacío si el formulario ya es válido. */
  get faltantes(): string {
    return unirEnLista(CAMPOS_OBLIGATORIOS.filter(([nombre]) => this.purchaseForm.get(nombre)?.invalid).map(([, etiqueta]) => etiqueta));
  }

  /** «el valor, las cuotas y la tarjeta»: lo que se rellenó con la última compra del comercio. */
  get textoAutocompletado(): string {
    return unirEnLista(this.autocompletado?.campos ?? []);
  }

  /** Persona elegida para ser responsable que todavía no se agregó con «Agregar» (solo se avisa con la sección de responsables abierta). */
  get responsablePendiente(): string | null {
    if (!this.showResponsablesSection || this.porcentajeRestante <= 0) return null;
    const id = this.responsableForm.get('personaId')?.value;
    return id && this.responsableForm.valid ? this.getPersonaNombre(Number(id)) : null;
  }

  get porcentajeAsignado(): number {
    return 100 - this.porcentajeRestante;
  }

  /** Línea de la sección «Responsables» cuando está cerrada: «Luis 60 % · Andrés 40 %». */
  get resumenResponsables(): string {
    if (this.responsables.length === 0) return 'Sin asignar';
    return this.responsables.map(r => `${this.getPersonaNombre(r.persona || 0)} ${r.porcentajePago} %`).join(' · ');
  }

  /** Línea de la sección «Más detalles» cuando está cerrada: «Pendiente · 2 etiquetas · con descripción». */
  get resumenDetalles(): string {
    const partes = [this.estados.find(e => e.valor === this.status?.value)?.etiqueta ?? 'Pendiente'];
    if (this.tagsCompra.length > 0) partes.push(this.tagsCompra.length === 1 ? '1 etiqueta' : `${this.tagsCompra.length} etiquetas`);
    if ((this.description?.value ?? '').trim()) partes.push('con descripción');
    return partes.join(' · ');
  }

  /** La nota bajo «Concepto» («Rellenamos…» / «Comercio nuevo»): la plantilla y el `aria-describedby` del campo usan esta misma condición. */
  get mostrarNotaConcepto(): boolean {
    return !this.mostrarError('concept') && !this.isLoadingConcepts && (!!this.autocompletado || this.isNewConcept);
  }

  /** ¿El porcentaje o las cuotas del responsable que se está proponiendo están fuera de rango? (el botón «Agregar» lo explica con esto). */
  errorDeResponsable(campo: 'porcentajePago' | 'cantidadCuotas'): 'max' | 'min' | null {
    const errores = this.responsableForm.get(campo)?.errors;
    return errores?.['max'] ? 'max' : errores?.['min'] ? 'min' : null;
  }

  /** ¿Se muestra el error de este campo? Solo después de tocarlo o escribir en él (no se regaña antes de tiempo). */
  mostrarError(nombre: string): boolean {
    const control = this.purchaseForm.get(nombre);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  // ==================== GETTERS ====================

  get concept(): AbstractControl | null { return this.purchaseForm.get('concept'); }
  get purchaseValue(): AbstractControl | null { return this.purchaseForm.get('purchaseValue'); }
  get purchaseDate(): AbstractControl | null { return this.purchaseForm.get('purchaseDate'); }
  get installments(): AbstractControl | null { return this.purchaseForm.get('installments'); }
  get interest(): AbstractControl | null { return this.purchaseForm.get('interest'); }
  get description(): AbstractControl | null { return this.purchaseForm.get('description'); }
  get status(): AbstractControl | null { return this.purchaseForm.get('status'); }
  get cardId(): AbstractControl | null { return this.purchaseForm.get('cardId'); }

  /** Devuelve la tarjeta actualmente seleccionada */
  get selectedCard(): ItemTarjeta | undefined {
    const id = Number(this.purchaseForm.get('cardId')?.value);
    return id ? this.creditCards.find(c => c.id === id) : undefined;
  }
}
