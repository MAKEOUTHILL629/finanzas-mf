import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../servicios/api-services.service';
import { ComprasCredito, ResponsableCompraCredito } from '../../modelos/compras-credito';

@Component({
  selector: 'app-responsable-credito',
  templateUrl: './responsable-credito.component.html',
  styleUrl: './responsable-credito.component.css'
})
export class ResponsableCreditoComponent implements OnInit , OnChanges{
  @Input() compra: ComprasCredito = { id: 0, concepto: '', valorCompra: 0, fechaCompra: new Date(), numeroCuotas: 0, fechaUltimaCuota: new Date(), pagoMensual: 0, interes: 0, descripcion: '', estado: '', tarjeta: 0 };


  responsables: ResponsableCompraCredito[] = [];
  responsableForm: FormGroup;
  personas: Persona[] = []; // Esta lista debería cargarse desde tu servicio
  personasDisponibles: Persona[] = [];
  porcentajeRestante: number = 100;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService // Asume que has creado este servicio
  ) {
    this.responsableForm = this.fb.group({
      personaId: ['', Validators.required],
      porcentajePago: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      cantidadPago: ['', [Validators.required, Validators.min(0)]],
      cantidadCuotas: ['', [Validators.required, Validators.min(1), Validators.max(this.compra.numeroCuotas || 1)]]
    });
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['compra'] && changes['compra'].currentValue) {
      this.loadResponsables();
      this.updateFormValidators();
    }

  }

  ngOnInit() {

    this.loadResponsables();
    this.loadPersonas();
    this.responsableForm.get('porcentajePago')?.valueChanges.subscribe(value => this.updateCantidadPago(value));
    this.responsableForm.get('cantidadPago')?.valueChanges.subscribe(value => this.updatePorcentajePago(value));
    this.responsableForm.get('personaId')?.valueChanges.subscribe(value => this.onPersonaSelected(value));
  }


  loadResponsables() {

    this.apiService.get<ResponsableCompraCredito[]>(`compras-credito/${this.compra.id}/responsables`).subscribe(
      responsables => {
        this.responsables = responsables;
        this.calcularPorcentajeRestante();
        this.updatePersonasDisponibles();
      },
      error => console.error('Error cargando responsables', error)
    );
  }

  updateFormValidators() {
    this.responsableForm.get('cantidadCuotas')?.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(this.compra.numeroCuotas || 1)
    ]);
    this.responsableForm.get('cantidadCuotas')?.updateValueAndValidity();

    this.calcularPorcentajeRestante();
  }

  loadPersonas() {
    // Cargar la lista de personas desde tu servicio
    this.apiService.get<Persona[]>(`personas`).subscribe(
      personas => {
        this.personas = personas;
        this.updatePersonasDisponibles();
      },
      error => console.error('Error cargando personas', error)
    );
  }

  updatePersonasDisponibles() {
    const responsablesIds = new Set(this.responsables.map(r => r.persona));
    this.personasDisponibles = this.personas.filter(p => !responsablesIds.has(p.id));
  }

  calcularPorcentajeRestante() {
    const porcentajeAsignado = this.responsables.reduce((sum, r) => sum + r.porcentajePago, 0);
    this.porcentajeRestante = Math.max(0, 100 - porcentajeAsignado);
    this.responsableForm.get('porcentajePago')?.setValidators([
      Validators.required,
      Validators.min(0),
      Validators.max(this.porcentajeRestante)
    ]);
    this.responsableForm.get('porcentajePago')?.updateValueAndValidity();
  }

  updateCantidadPago(porcentaje: number) {
    if (porcentaje !== null && porcentaje !== undefined) {
      const cantidadPago = this.roundToTwoDecimals((porcentaje / 100) * (this.compra.valorCompra || 0));
      this.responsableForm.get('cantidadPago')?.setValue(cantidadPago, { emitEvent: false });
    }
  }

  updatePorcentajePago(cantidad: number) {
    if (cantidad !== null && cantidad !== undefined) {
      const porcentajePago = this.roundToTwoDecimals((cantidad / (this.compra.valorCompra || 0)) * 100);
      this.responsableForm.get('porcentajePago')?.setValue(porcentajePago, { emitEvent: false });
    }
  }

  onSubmit() {
    if (this.responsableForm.valid) {
      const newResponsable: ResponsableCompraCredito = {
        ...this.responsableForm.value,
        persona: this.personas.find(p => p.id == this.responsableForm.value.personaId)?.id,
        compraCredito:  this.compra.id
      };

      console.log(newResponsable)
      this.apiService.post<ResponsableCompraCredito>(`compras-credito/responsables`, newResponsable).subscribe(
        response => {
          this.responsables.push(response);
          this.responsables.push(response);
          this.calcularPorcentajeRestante();
          this.updatePersonasDisponibles();
          this.responsableForm.reset();
          this.loadResponsables();
        },
        error => console.error('Error añadiendo responsable', error)
      );
    }
  }

  getPersonaNombre(id: number): string {
    const persona = this.personas.find(p => p.id == id);
    return persona ? persona.nombre : 'N/A';
  }

  onPersonaSelected(personaId: string) {
    if (personaId) {
      // Establecer la cantidad de cuotas al valor de numeroCuotasCompra
      this.responsableForm.get('cantidadCuotas')?.setValue(this.compra.numeroCuotas);

      // Establecer el porcentaje de pago al porcentaje restante
      this.responsableForm.get('porcentajePago')?.setValue(this.porcentajeRestante);

      // Actualizar la cantidad de pago basada en el porcentaje
      this.updateCantidadPago(this.porcentajeRestante);
    }
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
