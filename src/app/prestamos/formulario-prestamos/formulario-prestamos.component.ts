import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../servicios/api-services.service';

@Component({
  selector: 'app-formulario-prestamos',
  templateUrl: './formulario-prestamos.component.html',
  styleUrl: './formulario-prestamos.component.css'
})
export class FormularioPrestamosComponent implements OnInit {
  loanForm: FormGroup = new FormGroup({});
  personas: Persona[] = [];
  estados: string[] = ['Pendiente', 'Pagado', 'Vencido'];

  constructor(private fb: FormBuilder, private apiService: ApiServicesService) {}

  ngOnInit() {
    this.initForm();
    this.loadPersonas();
  }

  initForm() {
    this.loanForm = this.fb.group({
      valorPrestado: ['', [Validators.required, Validators.min(0)]],
      concepto: ['', Validators.required],
      fechaCobro: ['', Validators.required],
      responsablePersona: ['', Validators.required],
      estado: ['', Validators.required],
      comentarios: ['']
    });
  }

  loadPersonas() {
    // Aquí cargarías la lista de personas desde tu servicio
    // Por ahora, usaremos datos de ejemplo

    this.apiService.get<Persona[]>('personas').subscribe({
      next: (data) => {
        this.personas = data;
      },
      error: (err) => {
        console.error('Error fetching people:', err);
      }
    });

  }

  onSubmit() {
    if (this.loanForm.valid) {
      console.log(this.loanForm.value);
      // Aquí iría la lógica para guardar el préstamo
      this.apiService.post('prestamos', {...this.loanForm.value, responsable: Number(this.loanForm.get('responsablePersona')?.value)        }).subscribe({
        next: (data) => {
          console.log('Loan saved successfully', data);
          // Aquí iría la lógica para cerrar el modal
        },
        error: (err) => {
          console.error('Error saving loan:', err);
        }
      });
    } else {
      this.markFormGroupTouched(this.loanForm);
    }
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
