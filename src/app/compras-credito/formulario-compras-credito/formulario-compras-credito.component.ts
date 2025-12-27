
// import { Component, OnInit } from '@angular/core';
// import { FormBuilder, FormGroup, Validators } from '@angular/forms';
// import { Observable } from 'rxjs';
// import { map, startWith } from 'rxjs/operators';
// import { ApiServicesService } from '../../servicios/api-services.service';
// import { Tarjeta } from '../../modelos/tarjeta';
// import { ComprasCredito } from '../../modelos/compras-credito';

// @Component({
//   selector: 'app-formulario-compras-credito',
//   templateUrl: './formulario-compras-credito.component.html',
//   styleUrl: './formulario-compras-credito.component.css'
// })
// export class FormularioComprasCreditoComponent implements OnInit {
//   purchaseForm: FormGroup ;
//   concepts: string[] = [];
//   creditCards: Tarjeta[] = [];
//   filteredConcepts: Observable<string[]>;
//   isNewConcept: boolean = false;

//   constructor(
//     private fb: FormBuilder,
//     private apiService: ApiServicesService
//   ) {

//     this.purchaseForm = this.fb.group({
//       concept: ['', Validators.required],
//       purchaseValue: ['', [Validators.required, Validators.min(0)]],
//       purchaseDate: ['', Validators.required],
//       installments: ['', [Validators.required, Validators.min(1)]],
//       interest: ['', [Validators.required, Validators.min(0)]],
//       description: [''],
//       status: ['', Validators.required],
//       cardId: ['', Validators.required]
//     });

//     this.filteredConcepts = this.purchaseForm.get('concept')?.valueChanges.pipe(
//       startWith(''),
//       map(value => typeof value === 'string' ? value : value.name),
//       map(name => name ? this._filterConcepts(name) : this.concepts.slice())
//     ) || new Observable<string[]>();

//   }

//   ngOnInit() {

//     this.loadConcepts();
//     this.loadCreditCards();
//     this.setupConceptAutoComplete();
//   }


//   private loadConcepts() {
//     this.apiService.get<ComprasCredito[]>('compras-credito').subscribe(
//       compras => this.concepts =          Array.from(new Set(compras.map(compra => compra.concepto || '') )),
//       error => console.error('Error loading concepts', error)
//     );
//   }

//   private loadCreditCards() {
//     this.apiService.get<Tarjeta[]>('tarjetas').subscribe(
//       cards => this.creditCards = cards,
//       error => console.error('Error loading credit cards', error)
//     );
//   }

//   private setupConceptAutoComplete() {
//     this.filteredConcepts = this.purchaseForm.get('concept')?.valueChanges.pipe(
//       startWith(''),
//       map(value => typeof value === 'string' ? value : value),
//       map(name => name ? this._filterConcepts(name) : this.concepts.slice())
//     ) || new Observable<string[]>();
//   }

//   private _filterConcepts(name: string): string[] {
//     const filterValue = name.toLowerCase();
//     return this.concepts.filter(concept => concept.toLowerCase().includes(filterValue));
//   }

//   displayFn(concept: string): string {
//     return concept && concept ? concept : '';
//   }

//   onSubmit() {
//     if (this.purchaseForm.valid) {
//       const formValue = this.purchaseForm.value;
//       const purchase: ComprasCredito = this.preparePurchaseData(formValue);


//         this.savePurchase(purchase);

//     }
//   }

//   private preparePurchaseData(formValue: any): ComprasCredito {
//     const conceptData = formValue.concept;
//     // const conceptId = typeof conceptData === 'object' ? conceptData.id : null;
//     // const conceptName = typeof conceptData === 'string' ? conceptData : null;

//     return {
//       concepto: formValue.concept,
//       valorCompra: formValue.purchaseValue,
//       fechaCompra: formValue.purchaseDate,
//       fechaUltimaCuota: formValue.purchaseDate,
//       pagoMensual: formValue.purchaseValue,
//       numeroCuotas: formValue.installments,
//       interes: formValue.interest,
//       descripcion: formValue.description? formValue.description : '',
//       estado: formValue.status,
//       tarjeta: +formValue.cardId
//     };
//   }

//   // private createConceptAndSavePurchase(purchase: ComprasCredito) {
//   //   this.apiService.post<string>('concepts', { name: purchase.concepto }).subscribe(
//   //     newConcept => {

//   //       delete purchase.concepto;
//   //       this.savePurchase(purchase);
//   //     },
//   //     error => console.error('Error creating new concept', error)
//   //   );
//   // }

//   private savePurchase(purchase: ComprasCredito) {

//     console.log('Saving purchase', purchase);
//     this.apiService.post<ComprasCredito>('compras-credito', purchase).subscribe(
//       response => {
//         console.log('Purchase saved successfully', response);
//         this.purchaseForm.reset();
//         // Aquí puedes añadir lógica adicional, como mostrar un mensaje de éxito
//       },
//       error => {
//         console.error('Error saving purchase', error);
//         // Aquí puedes añadir lógica para manejar el error, como mostrar un mensaje al usuario
//       }
//     );
//   }

//   onConceptInput(event: any) {
//     const input = event.target.value;
//     this.isNewConcept = !this.concepts.some(concept => concept.toLowerCase() === input.toLowerCase());
//   }

// }



import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core'; // Añadir ViewChild
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { map, startWith, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs/operators'; // Añadir finalize
import { MatAutocompleteTrigger } from '@angular/material/autocomplete'; // <-- Importar MatAutocompleteTrigger

// Asumiendo que estos servicios y modelos están correctamente definidos
import { ApiServicesService } from '../../servicios/api-services.service'; // Ajusta la ruta
import { Tarjeta } from '../../modelos/tarjeta'; // Ajusta la ruta
import { ComprasCredito } from '../../modelos/compras-credito'; // Ajusta la ruta


@Component({
  selector: 'app-formulario-compras-credito',
  templateUrl: './formulario-compras-credito.component.html',
  styleUrls: ['./formulario-compras-credito.component.css'] // o .scss
})
export class FormularioComprasCreditoComponent implements OnInit, OnDestroy {

  // Referencia al trigger del autocomplete en la plantilla HTML
  @ViewChild('autoConceptTrigger', { read: MatAutocompleteTrigger })
  autocompleteTrigger!: MatAutocompleteTrigger;

  purchaseForm!: FormGroup; // Se inicializa en ngOnInit
  concepts: string[] = [];
  creditCards: Tarjeta[] = [];
  filteredConcepts!: Observable<string[]>;
  isNewConcept = false; // Flag para saber si el concepto es nuevo
  isLoadingConcepts = false;
  isLoadingCards = false;
  isSubmitting = false; // Flag para estado de envío

  // Subject para manejar desuscripciones y evitar fugas de memoria
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService
    // Podrías inyectar un servicio de Notificaciones/Snackbars aquí
    // private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadInitialData();
    this.setupConceptAutocomplete();
    this.listenToConceptChanges(); // Escuchar cambios para actualizar isNewConcept
  }

  ngOnDestroy(): void {
    // Completa el Subject para desuscribir todas las suscripciones activas
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Inicialización del formulario reactivo
  private initializeForm(): void {
    this.purchaseForm = this.fb.group({
      concept: ['', Validators.required],
      purchaseValue: [null, [Validators.required, Validators.min(0.01)]], // Mínimo podría ser 0.01
      purchaseDate: ['', Validators.required],
      installments: [null, [Validators.required, Validators.min(1), Validators.pattern('^[1-9][0-9]*$')]],
      interest: [null, [Validators.required, Validators.min(0)]],
      description: [''],
      status: ['pendiente', Validators.required], // VALOR POR DEFECTO
      cardId: ['', Validators.required]
    });
  }

  // Carga datos iniciales (conceptos y tarjetas)
  private loadInitialData(): void {
    this.loadConcepts();
    this.loadCreditCards();
  }

  // Carga la lista inicial de conceptos únicos
  private loadConcepts(): void {
    this.isLoadingConcepts = true;
    this.apiService.get<ComprasCredito[]>('compras-credito')
      .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoadingConcepts = false) // Asegurar que se ponga en false
      )
      .subscribe({
        next: compras => {
          this.concepts = Array.from(new Set(compras.map(compra => compra.concepto).filter((c): c is string => !!c?.trim())))
                               .sort((a, b) => a.localeCompare(b));
          console.log('Conceptos cargados:', this.concepts);
          this.purchaseForm.get('concept')?.updateValueAndValidity({ onlySelf: true, emitEvent: true });
        },
        error: err => {
          console.error('Error loading concepts', err);
        }
      });
  }

  // Carga la lista de tarjetas de crédito
  private loadCreditCards(): void {
    this.isLoadingCards = true;
    this.apiService.get<Tarjeta[]>('tarjetas')
      .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoadingCards = false) // Asegurar que se ponga en false
      )
      .subscribe({
        next: cards => {
          this.creditCards = cards;
          console.log('Tarjetas cargadas:', this.creditCards);
        },
        error: err => {
          console.error('Error loading credit cards', err);
        }
      });
  }

  // Configura el observable para el autocompletado de conceptos
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

  // Lógica de filtrado para el autocompletado
  private _filterConcepts(value: string): string[] {
    const filterValue = value.toLowerCase().trim();
    if (!filterValue) {
      return this.concepts.slice();
    }
    return this.concepts.filter(concept => concept.toLowerCase().includes(filterValue));
  }

  // Escucha cambios en el input de concepto para determinar si es nuevo
  private listenToConceptChanges(): void {
    this.purchaseForm.get('concept')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        const currentConcept = (value || '').trim();
        if (currentConcept && this.concepts.length > 0 && !this.isLoadingConcepts) { // Evitar verificar mientras carga
           this.isNewConcept = !this.concepts.some(c => c.toLowerCase() === currentConcept.toLowerCase());
        } else {
           this.isNewConcept = false;
        }
         // console.log(`Concepto: "${currentConcept}", Es Nuevo: ${this.isNewConcept}`); // Log útil para debug
      });
  }


  /**
   * Función requerida por mat-autocomplete para mostrar el valor en el input.
   */
  displayFn(concept: string): string {
    return concept || '';
  }

  /**
   * Cierra el panel de autocompletado. Se llama en el evento (blur) del input.
   */
  closeAutocompletePanel(): void {
    setTimeout(() => {
      if (this.autocompleteTrigger && this.autocompleteTrigger.panelOpen) { // Verificar si está abierto
        this.autocompleteTrigger.closePanel();
        // console.log('[Autocomplete] Panel cerrado en blur.');
      }
    }, 150); // Un timeout ligeramente mayor puede ser más robusto
  }

  /**
   * Maneja el evento input del campo Interés para reemplazar comas por puntos.
   * @param event El evento del input.
   */
  handleInterestInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const originalValue = inputElement.value;
    // Reemplaza todas las comas por puntos
    const newValue = originalValue.replace(/,/g, '.');
    // Opcional: Podrías añadir lógica para limitar decimales o validar formato aquí

    if (originalValue !== newValue) {
      // Guarda la posición del cursor para restaurarla después de la actualización
      const selectionStart = inputElement.selectionStart;
      const selectionEnd = inputElement.selectionEnd;

      // Actualiza el valor del input visualmente
      inputElement.value = newValue;
      // Actualiza el valor del FormControl
      this.purchaseForm.get('interest')?.patchValue(newValue, { emitEvent: false }); // emitEvent:false previene bucles

      // Restaura la posición del cursor (importante para la UX)
      if (selectionStart !== null && selectionEnd !== null) {
        inputElement.setSelectionRange(selectionStart, selectionEnd);
      }
       console.log(`[Interest Input] Comma replaced. New value: ${newValue}`);
    }
  }


  // --- Manejo del Envío del Formulario ---

  onSubmit(): void {
    this.purchaseForm.markAllAsTouched(); // Marcar para mostrar errores

    // Pequeño scroll hacia el primer campo inválido (mejora UX)
    const firstInvalidControl = document.querySelector('form .ng-invalid');
    if (firstInvalidControl) {
        (firstInvalidControl as HTMLElement).focus();
        // O un scroll más suave:
        // firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }


    if (this.purchaseForm.invalid) {
      console.warn('Formulario inválido. Por favor revise los campos marcados.');
      // this.notificationService.showError('Formulario inválido');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.purchaseForm.getRawValue();
    const purchaseData = this.preparePurchaseData(formValue);

    console.log('Preparado para guardar:', purchaseData);

    // --- Lógica para manejar nuevo concepto (descomentar/adaptar si es necesario) ---
    // if (this.isNewConcept && purchaseData.concepto) {
    //    this.handleNewConceptAndSave(purchaseData);
    // } else {
     //  this.savePurchase(purchaseData);
    // }
    this.savePurchase(purchaseData); // Llama directo por ahora
  }

  // Prepara el objeto de datos para enviar a la API
  private preparePurchaseData(formValue: any): ComprasCredito {
    const purchaseValue = parseFloat(this.cleanCurrencyValue(formValue.purchaseValue));
    const installments = parseInt(formValue.installments, 10);
    const interest = parseFloat(formValue.interest); // Ya tiene '.' gracias a handleInterestInput

    return {
      concepto: formValue.concept.trim(),
      valorCompra: isNaN(purchaseValue) ? 0 : purchaseValue,
      fechaCompra: formValue.purchaseDate,
      numeroCuotas: isNaN(installments) ? 0 : installments,
      interes: isNaN(interest) ? 0 : interest,
      descripcion: formValue.description?.trim() || '',
      estado: formValue.status,
      tarjeta: parseInt(formValue.cardId, 10),
      fechaUltimaCuota: formValue.purchaseDate, // Placeholder
      pagoMensual: 0 // Placeholder
    };
  }

   // Helper para limpiar valor de moneda antes de parseFloat
   private cleanCurrencyValue(value: string | number | null): string {
      if (typeof value === 'number') { return value.toString(); }
      if (typeof value === 'string') {
          // Quita símbolo $ (si lo hubiera), quita puntos de miles, reemplaza coma decimal por punto
          return value.replace(/\$\s?/g, '').replace(/\./g, '').replace(',', '.');
      }
      return '0';
  }

  // Guarda la compra en el backend
  private savePurchase(purchase: ComprasCredito): void {
    this.apiService.post<ComprasCredito>('compras-credito', purchase)
      .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isSubmitting = false) // Asegura que isSubmitting se ponga en false
       )
      .subscribe({
        next: response => {

          this.purchaseForm.reset();
          this.purchaseForm.patchValue({ status: 'pendiente', cardId: '' }); // Resetear con valores por defecto
          this.isNewConcept = false;
          // Considera no recargar conceptos aquí a menos que sea necesario,
          // para no perder el contexto del usuario si quiere añadir otra compra rápido.
        },
        error: err => {

        }
      });
  }

  // Getters para facilitar acceso en la plantilla
  get concept(): AbstractControl | null { return this.purchaseForm.get('concept'); }
  get purchaseValue(): AbstractControl | null { return this.purchaseForm.get('purchaseValue'); }
  get purchaseDate(): AbstractControl | null { return this.purchaseForm.get('purchaseDate'); }
  get installments(): AbstractControl | null { return this.purchaseForm.get('installments'); }
  get interest(): AbstractControl | null { return this.purchaseForm.get('interest'); }
  get description(): AbstractControl | null { return this.purchaseForm.get('description'); }
  get status(): AbstractControl | null { return this.purchaseForm.get('status'); }
  get cardId(): AbstractControl | null { return this.purchaseForm.get('cardId'); }

}
