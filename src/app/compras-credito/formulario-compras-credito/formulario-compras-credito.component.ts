import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, Subject } from 'rxjs';
import { map, startWith, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs/operators';
import { ApiServicesService } from '../../servicios/api-services.service';
import { ModalService } from '../../servicios/modal.service';
import { Tarjeta } from '../../modelos/tarjeta';
import { ComprasCredito, ResponsableCompraCredito } from '../../modelos/compras-credito';
import { Persona } from '../../modelos/persona';

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
  conceptsMap: Map<string, ComprasCredito> = new Map();
  creditCards: Tarjeta[] = [];
  personas: Persona[] = [];
  personasDisponibles: Persona[] = [];
  responsables: ResponsableCompraCredito[] = [];

  // Observables
  filteredConcepts!: Observable<string[]>;

  // Flags
  isNewConcept = false;
  isLoadingConcepts = false;
  isLoadingCards = false;
  isLoadingPersonas = false;
  isSubmitting = false;
  showResponsablesSection = false;
  porcentajeRestante = 100;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.initializeResponsableForm();
    this.loadInitialData();
    this.setupConceptAutocomplete();
    this.listenToConceptChanges();
    this.setupResponsableFormListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INICIALIZACIÓN ====================

  private initializeForm(): void {
    this.purchaseForm = this.fb.group({
      concept: ['', Validators.required],
      purchaseValue: ['', [Validators.required, Validators.min(0.01)]],
      purchaseDate: ['', Validators.required],
      installments: [1, [Validators.required, Validators.min(1)]],
      interest: [0, [Validators.required, Validators.min(0)]],
      description: [''],
      status: ['', Validators.required],
      cardId: ['', Validators.required]
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
    this.loadCreditCards();
    this.loadPersonas();
  }

  private loadConcepts(): void {
    this.isLoadingConcepts = true;
    this.apiService.get<ComprasCredito[]>('compras-credito')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingConcepts = false)
      )
      .subscribe({
        next: compras => {
          this.concepts = Array.from(new Set(
            compras.map(c => c.concepto?.trim()).filter(c => !!c)
          )) as string[];

          // Crear mapa para autocompletado inteligente
          compras.forEach(compra => {
            if (compra.concepto) {
              this.conceptsMap.set(compra.concepto.trim(), compra);
            }
          });
        },
        error: err => console.error('Error cargando conceptos:', err)
      });
  }

  private loadCreditCards(): void {
    this.isLoadingCards = true;
    this.apiService.get<Tarjeta[]>('tarjetas')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingCards = false)
      )
      .subscribe({
        next: cards => this.creditCards = cards,
        error: err => console.error('Error cargando tarjetas:', err)
      });
  }

  private loadPersonas(): void {
    this.isLoadingPersonas = true;
    this.apiService.get<Persona[]>('personas')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingPersonas = false)
      )
      .subscribe({
        next: personas => {
          this.personas = personas;
          this.updatePersonasDisponibles();
        },
        error: err => console.error('Error cargando personas:', err)
      });
  }

  // ==================== AUTOCOMPLETADO ====================

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
          this.isNewConcept = !this.concepts.some(c => c.toLowerCase() === currentConcept.toLowerCase());

          // Autocompletado inteligente
          if (!this.isNewConcept) {
            const compraExistente = this.conceptsMap.get(currentConcept);
            if (compraExistente) {
              this.autoFillFromConcept(compraExistente);
            }
          }
        } else {
          this.isNewConcept = false;
        }
      });
  }

  private autoFillFromConcept(compra: ComprasCredito): void {
    const valueControl = this.purchaseForm.get('purchaseValue');
    const installmentsControl = this.purchaseForm.get('installments');
    const interestControl = this.purchaseForm.get('interest');
    const cardControl = this.purchaseForm.get('cardId');

    if (valueControl && !valueControl.dirty && compra.valorCompra) {
      valueControl.setValue(this.formatCurrency(compra.valorCompra));
    }
    if (installmentsControl && !installmentsControl.dirty && compra.numeroCuotas) {
      installmentsControl.setValue(compra.numeroCuotas);
    }
    if (interestControl && !interestControl.dirty && compra.interes !== undefined) {
      interestControl.setValue(compra.interes);
    }
    if (cardControl && !cardControl.dirty && compra.tarjeta) {
      cardControl.setValue(compra.tarjeta);
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
    }, 150);
  }

  // ==================== FORMATEO DE CAMPOS ====================

  handleCurrencyInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const originalValue = inputElement.value;

    const numericValue = originalValue.replace(/[^0-9]/g, '');

    if (numericValue === '') {
      inputElement.value = '';
      this.purchaseForm.get('purchaseValue')?.patchValue('', { emitEvent: false });
      return;
    }

    const formatted = this.formatCurrency(parseFloat(numericValue));

    inputElement.value = formatted;
    this.purchaseForm.get('purchaseValue')?.patchValue(formatted, { emitEvent: false });
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
    const persona = this.personas.find(p => p.id === id);
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
      console.warn('Formulario inválido. Por favor revise los campos marcados.');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.purchaseForm.getRawValue();
    const purchaseData = this.preparePurchaseData(formValue);

    console.log('Preparado para guardar:', purchaseData);
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
      pagoMensual: 0
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
          console.log('Compra guardada exitosamente:', response);

          if (this.responsables.length > 0 && response.id) {
            this.saveResponsables(response.id);
          } else {
            this.resetForm();
            this.modalService.close();
            this.modalService.notifyCompraCreated(); // Notificar que se creó la compra
          }
        },
        error: err => console.error('Error guardando compra:', err)
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
        console.log('Responsables guardados exitosamente');
        this.resetForm();        this.modalService.close();
        this.modalService.notifyCompraCreated(); // Notificar que se creó la compra      })
      })
        .catch(err => {
        console.error('Error guardando responsables:', err);
        this.resetForm();
      });
  }

  private resetForm(): void {
    this.purchaseForm.reset();
    this.responsableForm.reset();
    this.responsables = [];
    this.porcentajeRestante = 100;
    this.isNewConcept = false;
    this.showResponsablesSection = false;
    this.updatePersonasDisponibles();
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
}
