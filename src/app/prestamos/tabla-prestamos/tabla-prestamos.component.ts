import { Component } from '@angular/core';
import { Prestamo } from '../../modelos/prestamos';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../servicios/api-services.service';
import { ModalService } from '../../servicios/modal.service';

@Component({
  selector: 'app-tabla-prestamos',
  templateUrl: './tabla-prestamos.component.html',
  styleUrl: './tabla-prestamos.component.css'
})
export class TablaPrestamosComponent {
  prestamos: Prestamo[] = [];
  filteredPrestamos: Prestamo[] = [];
  filterForm: FormGroup = new FormGroup({});
  personas: Persona[] = [];
  estados: string[] = ['Pendiente', 'Pagado', 'Vencido'];

  constructor(private fb: FormBuilder, private apiService: ApiServicesService, private modalService: ModalService) {}

  ngOnInit() {
    this.initializeForm();
    this.loadPrestamos();
    this.loadPersonas();
  }

  initializeForm() {
    this.filterForm = this.fb.group({
      fechaInicial: [''],
      fechaFinal: [''],
      responsable: [''],
      estado: [''],
      conceptoBusqueda: [''] // Nuevo campo para búsqueda por concepto
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  loadPrestamos() {
    // Aquí cargarías los préstamos desde tu servicio
    // Por ahora, usaremos datos de ejemplo
    this.apiService.get<Prestamo[]>('prestamos').subscribe({
      next: (data) => {
        this.prestamos = data;
        this.filteredPrestamos = [...this.prestamos];
      },
      error: (err) => {
        console.error('Error fetching loans:', err);
      }
    });

  }

  loadPersonas() {
    // Aquí cargarías las personas desde tu servicio
   this.apiService.get<Persona[]>('personas').subscribe({
      next: (data) => {
        this.personas = data;
      },
      error: (err) => {
        console.error('Error fetching people:', err);
      }
    }
    );
  }




  applyFilters() {
    const filters = this.filterForm.value;
    this.filteredPrestamos = this.prestamos.filter(prestamo => {
      return (
        (!filters.fechaInicial || (prestamo.fechaCobro || new Date()) >= new Date(filters.fechaInicial)) &&
        (!filters.fechaFinal || (prestamo.fechaCobro || new Date()) <= new Date(filters.fechaFinal)) &&
        (!filters.responsable || prestamo.responsable === filters.responsable) &&
        (!filters.estado || prestamo.estado === filters.estado) &&
        (!filters.conceptoBusqueda ||
          prestamo.concepto?.toLowerCase().includes(filters.conceptoBusqueda.toLowerCase()))
      );
    });
  }

  resetFilters() {
    this.filterForm.reset();
    this.filteredPrestamos = [...this.prestamos];
  }


  openCreditForm() {
    // Aquí irá la lógica para abrir tu formulario de crédito
    this.modalService.open('prestamo-form');
  }

  getPersonaNombre(id: number): string {
    const persona = this.personas.find(p => p.id == id);
    return persona ? persona.nombre : 'N/A';
  }
}
