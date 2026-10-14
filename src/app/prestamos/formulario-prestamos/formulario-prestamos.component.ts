import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../services/api-services.service';
import { ModalService } from '../../services/modal.service';
import { SharedListasService } from '../../services/shared-listas.service';

@Component({
  selector: 'app-formulario-prestamos',
  templateUrl: './formulario-prestamos.component.html',
  styleUrl: './formulario-prestamos.component.css'
})
export class FormularioPrestamosComponent implements OnInit, OnDestroy {
  loanForm: FormGroup = new FormGroup({});
  personas: Persona[] = [];
  estados: string[] = ['Pendiente', 'Pagado', 'Vencido'];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService,
    private modalService: ModalService,
    private sharedListasService: SharedListasService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPersonas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.loanForm = this.fb.group({
      valorPrestado: ['', [Validators.required, Validators.min(0)]],
      concepto: ['', Validators.required],
      fechaCobro: ['', Validators.required],
      responsablePersona: ['', Validators.required],
      estado: ['', Validators.required],
      comentarios: ['']
    });
  }

  loadPersonas(): void {
    if (this.sharedListasService.listaPersonas.length > 0) {
      this.personas = this.sharedListasService.listaPersonas;
      return;
    }

    this.apiService.get<Persona[]>('personas')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.personas = data || [];
          this.sharedListasService.listaPersonas = this.personas;
        },
        error: (err) => { void err; }
      });
  }

  onSubmit(): void {
    if (this.loanForm.valid) {
      const payload = {
        ...this.loanForm.value,
        responsable: Number(this.loanForm.get('responsablePersona')?.value)
      };

      this.apiService.post('prestamos', payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (_data) => {
            this.modalService.close();
            this.loanForm.reset();
          },
          error: (err) => { void err; }
        });
    } else {
      this.markFormGroupTouched(this.loanForm);
    }
  }

  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
