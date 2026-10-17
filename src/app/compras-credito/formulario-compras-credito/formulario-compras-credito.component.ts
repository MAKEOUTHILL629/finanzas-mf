import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
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
import { hoyIso } from '../../shared/periodo.helper';
import { GRUPO_ACTIVAS, GRUPO_HISTORICAS } from '../../shared/ui/select/select.helpers';
import { esCompraRetroactiva, plasticoParaFecha, terminacion, vigenciaLegible } from '../../tarjetas/tarjetas.constants';

@Component({
  selector: 'app-formulario-compras-credito',
  templateUrl: './formulario-compras-credito.component.html',
  styleUrls: ['./formulario-compras-credito.component.css']
})
export class FormularioComprasCreditoComponent implements OnInit, OnDestroy {

  // Referencia al trigger del autocomplete
  @ViewChild('autoConceptTrigger', { read: MatAutocompleteTrigger })
  autocompleteTrigger!: MatAutocompleteTrigger;

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

  readonly terminacion = terminacion;
  readonly vigencia = vigenciaLegible;

  /** «American Express ··1927 — 1.8895% E.M.»: el plástico ACTIVO y la tasa que se importará al campo de interés. */
  readonly etiquetarTarjeta = (t: ItemTarjeta): string => `${t.etiqueta}${t.tasaInteresCompra != null ? ` — ${t.tasaInteresCompra}% E.M.` : ''}`;

  // Flags
  isNewConcept = false;
  isLoadingConcepts = false;
  isSubmitting = false;
  showResponsablesSection = false;
  porcentajeRestante = 100;
  interestAutoFilled = false;  // true cuando la tasa se importó automáticamente de la tarjeta

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService,
    private modalService: ModalService,
    private catalogos: CatalogosService,
    private sugerencias: SugerenciasService
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
      interest: [0, [Validators.required, Validators.min(0)]],
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
      porcentajePago: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      cantidadPago: ['', [Validators.required, Validators.min(0)]],
      cantidadCuotas: ['', [Validators.required, Validators.min(1)]]
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

    // Las cuotas de la compra se reflejan en las que se le asignan al responsable propuesto
    this.purchaseForm.get('installments')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.sincronizarResponsable());
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
        if (state === null && this.autocompleteTrigger?.panelOpen) {
          this.autocompleteTrigger.closePanel();
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
        } else {
          this.isNewConcept = false;
        }
      });
  }

  private autoFillFromConcept(habitual: ComercioHabitual): void {
    const valueControl = this.purchaseForm.get('purchaseValue');
    const installmentsControl = this.purchaseForm.get('installments');
    const cardControl = this.purchaseForm.get('cardId');

    if (valueControl && !valueControl.dirty && habitual.ultimoValor) {
      valueControl.setValue(this.formatCurrency(habitual.ultimoValor));
    }
    if (installmentsControl && !installmentsControl.dirty && habitual.cuotas) {
      installmentsControl.setValue(habitual.cuotas);
    }
    if (cardControl && !cardControl.dirty && habitual.tarjetaId && this.creditCards.some((t) => t.id === habitual.tarjetaId && t.tipo !== 'DEBITO')) {
      cardControl.setValue(habitual.tarjetaId);
    }
    // el responsable habitual de ese comercio se deja elegido (sin agregarlo: el usuario confirma con «Agregar»)
    const persona = this.responsableForm.get('personaId');
    if (persona && !persona.dirty && habitual.personaId && this.responsables.length === 0 && this.personasDisponibles.some((p) => p.id === habitual.personaId)) {
      persona.setValue(habitual.personaId);
      this.showResponsablesSection = true;
    }
  }

  displayFn(concept: string): string {
    return concept || '';
  }

  closeAutocompletePanel(): void {
    setTimeout(() => {
      if (this.autocompleteTrigger && this.autocompleteTrigger.panelOpen) {
        this.autocompleteTrigger.closePanel();
      }
    }, 300);
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
   * Si ya hay una persona elegida en el formulario de responsable (p. ej. la sugerida), su monto y sus cuotas siguen al valor y a las
   * cuotas de la compra: se eligió antes de escribir el valor, y sin esto «Agregar» guardaría $0.
   */
  private sincronizarResponsable(): void {
    if (!this.responsableForm?.get('personaId')?.value) return;
    const porcentaje = this.responsableForm.get('porcentajePago')?.value;
    if (porcentaje !== null && porcentaje !== undefined && porcentaje !== '') this.updateCantidadPago(Number(porcentaje));
    const cuotas = this.responsableForm.get('cantidadCuotas');
    if (cuotas && !cuotas.dirty) cuotas.setValue(this.purchaseForm.get('installments')?.value || 1, { emitEvent: false });
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

  toggleResponsablesSection(): void {
    this.showResponsablesSection = !this.showResponsablesSection;
  }

  private updatePersonasDisponibles(): void {
    const responsablesIds = new Set(this.responsables.map(r => r.persona));
    this.personasDisponibles = this.personas.filter(p => !responsablesIds.has(p.id));
    this.filtroPersonas = (p: ItemPersona) => !responsablesIds.has(p.id);
  }

  private calcularPorcentajeRestante(): void {
    const porcentajeAsignado = this.responsables.reduce((sum, r) => sum + r.porcentajePago, 0);
    this.porcentajeRestante = Math.max(0, 100 - porcentajeAsignado);

    this.responsableForm.get('porcentajePago')?.setValidators([
      Validators.required,
      Validators.min(0),
      Validators.max(this.porcentajeRestante)
    ]);
    this.responsableForm.get('porcentajePago')?.updateValueAndValidity();
  }

  private updateCantidadPago(porcentaje: number): void {
    if (porcentaje !== null && porcentaje !== undefined) {
      const valorCompra = this.parseCurrencyValue(this.purchaseForm.get('purchaseValue')?.value);
      const cantidadPago = this.roundToTwoDecimals((porcentaje / 100) * valorCompra);
      this.responsableForm.get('cantidadPago')?.setValue(cantidadPago, { emitEvent: false });
    }
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

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  // ==================== ENVÍO DEL FORMULARIO ====================

  onSubmit(): void {
    this.purchaseForm.markAllAsTouched();

    const firstInvalidControl = document.querySelector('form .ng-invalid');
    if (firstInvalidControl) {
      (firstInvalidControl as HTMLElement).focus();
    }

    if (this.purchaseForm.invalid) {
      return;
    }

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
      // Solo si el usuario puede elegir (compra retroactiva): si no, el servidor guarda el plástico vigente en esa fecha.
      ...(this.mostrarSelectorPlastico && formValue.plasticoId ? { plasticoId: parseInt(formValue.plasticoId, 10) } : {})
    };
  }

  private savePurchase(purchase: ComprasCredito): void {
    this.apiService.post<ComprasCredito>('compras-credito', purchase)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmitting = false)
      )
      .subscribe({
        next: response => {

          if (this.responsables.length > 0 && response.id) {
            this.saveResponsables(response.id);
          } else {
            this.resetForm();
            this.modalService.close();
            this.modalService.notifyCompraCreated(); // Notificar que se creó la compra
          }
        },
        error: err => { void err; }
      });
  }

  private saveResponsables(compraId: number): void {
    const responsablesWithCompra = this.responsables.map(r => ({
      ...r,
      compraCredito: compraId
    }));

    const saveOperations = responsablesWithCompra.map(responsable =>
      this.apiService.post<ResponsableCompraCredito>('compras-credito/responsables', responsable).toPromise()
    );

    Promise.all(saveOperations)
      .then(() => {
        this.resetForm();
        this.modalService.close();
        this.modalService.notifyCompraCreated();
      })
      .catch(err => {
        void err;
        this.resetForm();
      });
  }

  private resetForm(): void {
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
    this.porcentajeRestante = 100;
    this.isNewConcept = false;
    this.interestAutoFilled = false;
    this.showResponsablesSection = false;
    // Recalcular validadores de porcentajePago (Validators.max se queda con
    // el valor de la compra anterior si no se resetea explícitamente)
    this.calcularPorcentajeRestante();
    this.updatePersonasDisponibles();
    this.sugerencias.invalidar(); // la compra recién guardada ya cuenta para lo habitual
    this.loadConcepts();
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
