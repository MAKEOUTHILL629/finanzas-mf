import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Prestamo } from '../../modelos/prestamos';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../services/api-services.service';
import { ModalService } from '../../services/modal.service';
import { SharedListasService } from '../../services/shared-listas.service';
import { matchesSearchFields, matchesExactFilter } from '../../shared/utils';

@Component({
  selector: 'app-tabla-prestamos',
  templateUrl: './tabla-prestamos.component.html',
  styleUrl: './tabla-prestamos.component.css'
})
export class TablaPrestamosComponent implements OnInit, OnDestroy {
  prestamos: Prestamo[] = [];
  filteredPrestamos: Prestamo[] = [];
  filterForm: FormGroup = new FormGroup({});
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
    this.initializeForm();
    this.loadPrestamos();
    this.loadPersonas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeForm(): void {
    this.filterForm = this.fb.group({
      fechaInicial: [''],
      fechaFinal: [''],
      responsable: [''],
      estado: [''],
      conceptoBusqueda: [''] // Campo para búsqueda por concepto
    });

    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());
  }

  loadPrestamos(): void {
    this.apiService.get<Prestamo[]>('prestamos')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.prestamos = data || [];
          this.applyFilters();
        },
        error: (err) => { void err; }
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

  applyFilters(): void {
    const filters = this.filterForm.value;
    const fechaInicial = filters.fechaInicial ? new Date(filters.fechaInicial) : null;
    const fechaFinal = filters.fechaFinal ? new Date(filters.fechaFinal) : null;
    const busqueda = filters.conceptoBusqueda;

    this.filteredPrestamos = this.prestamos.filter(prestamo => {
      const fechaCobro = prestamo.fechaCobro ? new Date(prestamo.fechaCobro) : null;
      if (fechaInicial && fechaCobro && fechaCobro < fechaInicial) return false;
      if (fechaFinal && fechaCobro && fechaCobro > fechaFinal) return false;
      if (!matchesExactFilter(prestamo.responsable, filters.responsable)) return false;
      if (!matchesExactFilter(prestamo.estado, filters.estado)) return false;
      if (busqueda && !matchesSearchFields(busqueda, [prestamo.concepto, prestamo.comentarios])) return false;
      return true;
    });
  }

  resetFilters(): void {
    this.filterForm.reset();
    this.filteredPrestamos = [...this.prestamos];
  }

  openCreditForm(): void {
    this.modalService.open('prestamo-form');
  }

  getPersonaNombre(id: number): string {
    const nombre = this.sharedListasService.getNombrePersonaById(id);
    if (nombre) return nombre;
    const persona = this.personas.find(p => p.id == id);
    return persona ? persona.nombre : 'N/A';
  }
}
