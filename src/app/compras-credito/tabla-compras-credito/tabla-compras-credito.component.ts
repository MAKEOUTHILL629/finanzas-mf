import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  ColumnasCompraCredito,
  ComprasCredito,
  SortableFields,
} from '../../modelos/compras-credito';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Tarjeta } from '../../modelos/tarjeta';
import { ApiServicesService } from '../../services/api-services.service';
import { Router } from '@angular/router';
import { ModalService } from '../../services/modal.service';
import { Persona } from '../../modelos/persona';
import { capitalize, matchesSearchFields, normalizeSearchText } from '../../shared/utils';
import { SharedListasService } from '../../services/shared-listas.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-tabla-compras-credito',
  templateUrl: './tabla-compras-credito.component.html',
  styleUrl: './tabla-compras-credito.component.css',
})
export class TablaComprasCreditoComponent implements OnInit, OnDestroy {
  comprasCredito: ComprasCredito[] = [];
  isLoading = false;
  isRefreshing = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  filteredPurchases: ComprasCredito[] = [];
  filterForm: FormGroup;
  sortColumn: SortableFields = 'fechaCompra';
  sortDirection: 'asc' | 'desc' = 'desc'; // Descendente por defecto (más reciente primero)

  estados: string[] = ['Pendiente', 'Pagado', 'Cancelado'];

  // Multiselect states
  selectedEstados: Set<string> = new Set();
  selectedTarjetas: Set<number> = new Set();
  showEstadosDropdown = false;
  showTarjetasDropdown = false;

  sortableColumns: ColumnasCompraCredito[] = [
    { titulo: 'Concepto', columna: 'concepto' },
    { titulo: 'Valor compra', columna: 'valorCompra' },
    { titulo: 'Fecha Compra', columna: 'fechaCompra' },
    { titulo: 'Numero cuotas', columna: 'numeroCuotas' },
    { titulo: 'Fecha ultima cuota', columna: 'fechaUltimaCuota' },
    { titulo: 'Pago mensual', columna: 'pagoMensual' },
    { titulo: 'Interes', columna: 'interes' },
    { titulo: 'Responsables', columna: 'responsables' },
    { titulo: 'Estado', columna: 'estado' },
    { titulo: 'Tarjeta', columna: 'tarjeta' },
  ];

  tarjetas: Tarjeta[] = [];
  personas: Persona[] = [];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService,
    private router: Router,
    private modalService: ModalService,
    private sharedListasService: SharedListasService
  ) {
    this.filterForm = this.fb.group({
      fechaCompraInicio: [''],
      fechaCompraFin: [''],
      numeroCuotas: [''],
      fechaUltimaCuotaInicio: [''],
      fechaUltimaCuotaFin: [''],
      concepto: [''],
      soloSinResponsablesCompletos: [false],
    });
  }

  ngOnInit(): void {
    this.loadTarjetas();
    this.loadPersonas();
    this.loadProducts();

    // Suscribirse a cambios en el formulario
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

    // Suscribirse a notificaciones de compras creadas
    this.modalService.compraCreated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshCompras();
      });

    this.applyFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTarjetas(): void {
    this.apiService.get<Tarjeta[]>('tarjetas')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.tarjetas = data;
          this.sharedListasService.listaTarjetas = data;
        },
        error: (err) => {
          void err;
        },
      });
  }

  obtenerTarjeta(id: number): string {
    return this.sharedListasService.getNombreTarjetaById(id) || 'N/A';
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;
    this.apiService.get<ComprasCredito[]>('compras-credito')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.comprasCredito = data;
          this.estados = Array.from(new Set(this.comprasCredito.map((compra) => capitalize(compra.estado || 'Todos'))));
          this.isLoading = false;
          this.applyFilters();
        },
        error: () => {
          this.error = 'Error al cargar los productos. Por favor, intente de nuevo.';
          this.isLoading = false;
        },
      });
  }

  refreshCompras(): void {
    this.isRefreshing = true;
    this.apiService.get<ComprasCredito[]>('compras-credito')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.comprasCredito = data;
          this.estados = Array.from(new Set(this.comprasCredito.map((compra) => capitalize(compra.estado || 'Todos'))));
          this.isRefreshing = false;
          this.applyFilters();
        },
        error: (err) => {
          void err;
          this.isRefreshing = false;
        },
      });
  }

  applyFilters(): void {
    const filters = this.filterForm.value;

    this.filteredPurchases = this.comprasCredito.filter((purchase) => {
      let matchesFilter = true;

      // Filtro de fecha de compra inicio
      if (filters.fechaCompraInicio && purchase.fechaCompra) {
        const filterDate = new Date(filters.fechaCompraInicio);
        matchesFilter = matchesFilter && new Date(purchase.fechaCompra) >= filterDate;
      }

      // Filtro de fecha de compra fin
      if (filters.fechaCompraFin && purchase.fechaCompra) {
        const filterDate = new Date(filters.fechaCompraFin);
        matchesFilter = matchesFilter && new Date(purchase.fechaCompra) <= filterDate;
      }

      // Filtro de número de cuotas
      if (filters.numeroCuotas && purchase.numeroCuotas !== undefined) {
        matchesFilter =
          matchesFilter &&
          purchase.numeroCuotas === parseInt(filters.numeroCuotas, 10);
      }

      // Filtro de fecha última cuota inicio
      if (filters.fechaUltimaCuotaInicio && purchase.fechaUltimaCuota) {
        const filterDate = new Date(filters.fechaUltimaCuotaInicio);
        matchesFilter =
          matchesFilter && new Date(purchase.fechaUltimaCuota) >= filterDate;
      }

      // Filtro de fecha última cuota fin
      if (filters.fechaUltimaCuotaFin && purchase.fechaUltimaCuota) {
        const filterDate = new Date(filters.fechaUltimaCuotaFin);
        matchesFilter =
          matchesFilter && new Date(purchase.fechaUltimaCuota) <= filterDate;
      }

      // Filtro multiselect de tarjetas
      if (this.selectedTarjetas.size > 0 && purchase.tarjeta) {
        matchesFilter = matchesFilter && this.selectedTarjetas.has(purchase.tarjeta);
      }

      // Filtro de concepto normalizado
      if (filters.concepto) {
        matchesFilter = matchesFilter && matchesSearchFields(filters.concepto, [purchase.concepto, purchase.descripcion]);
      }

      // Filtro multiselect de estados
      if (this.selectedEstados.size > 0 && purchase.estado) {
        const estadoNorm = normalizeSearchText(purchase.estado);
        matchesFilter =
          matchesFilter &&
          Array.from(this.selectedEstados).some(selected =>
            normalizeSearchText(selected) === estadoNorm
          );
      }

      // Filtro de responsables incompletos
      if (filters.soloSinResponsablesCompletos) {
        const porcentaje = purchase.porcentajePago || 0;
        matchesFilter = matchesFilter && porcentaje < 100;
      }

      return matchesFilter;
    });

    this.sortByMostRecent();
  }

  sortByMostRecent(): void {
    this.filteredPurchases.sort((a, b) => {
      const aFecha = new Date(a.fechaCompra || 0).getTime();
      const bFecha = new Date(b.fechaCompra || 0).getTime();
      return bFecha - aFecha;
    });
    this.sortColumn = 'fechaCompra';
    this.sortDirection = 'desc';
  }

  sortData(column: SortableFields): void {
    this.sortColumn = column;
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';

    this.filteredPurchases.sort((a, b) => {
      const aValue = a[column];
      const bValue = b[column];

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return this.sortDirection === 'asc' ? 1 : -1;
      if (bValue === undefined) return this.sortDirection === 'asc' ? -1 : 1;

      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  resetFilters(): void {
    this.filterForm.reset();
    this.selectedEstados.clear();
    this.selectedTarjetas.clear();
    this.loadProducts();
  }

  // Métodos para multiselect de estados
  toggleEstadosDropdown(event: Event): void {
    event.stopPropagation();
    this.showEstadosDropdown = !this.showEstadosDropdown;
    this.showTarjetasDropdown = false;
  }

  toggleEstado(estado: string): void {
    if (this.selectedEstados.has(estado)) {
      this.selectedEstados.delete(estado);
    } else {
      this.selectedEstados.add(estado);
    }
    this.applyFilters();
  }

  isEstadoSelected(estado: string): boolean {
    return this.selectedEstados.has(estado);
  }

  getSelectedEstadosText(): string {
    if (this.selectedEstados.size === 0) return 'Todos los estados';
    if (this.selectedEstados.size === 1) return Array.from(this.selectedEstados)[0];
    return `${this.selectedEstados.size} estados seleccionados`;
  }

  // Métodos para multiselect de tarjetas
  toggleTarjetasDropdown(event: Event): void {
    event.stopPropagation();
    this.showTarjetasDropdown = !this.showTarjetasDropdown;
    this.showEstadosDropdown = false;
  }

  toggleTarjeta(tarjetaId: number): void {
    if (this.selectedTarjetas.has(tarjetaId)) {
      this.selectedTarjetas.delete(tarjetaId);
    } else {
      this.selectedTarjetas.add(tarjetaId);
    }
    this.applyFilters();
  }

  isTarjetaSelected(tarjetaId: number): boolean {
    return this.selectedTarjetas.has(tarjetaId);
  }

  getSelectedTarjetasText(): string {
    if (this.selectedTarjetas.size === 0) return 'Todas las tarjetas';
    if (this.selectedTarjetas.size === 1) {
      const tarjetaId = Array.from(this.selectedTarjetas)[0];
      return this.obtenerTarjeta(tarjetaId);
    }
    return `${this.selectedTarjetas.size} tarjetas seleccionadas`;
  }

  closeDropdowns(): void {
    this.showEstadosDropdown = false;
    this.showTarjetasDropdown = false;
  }

  irDetalleCompra(compra: ComprasCredito): void {
    this.router.navigate(['/compra-credito-detalle', compra.id], {
      state: { compra: compra },
    });
  }

  openCreditForm(): void {
    this.modalService.open('compra-credito-form');
  }

  openCSVUploadForm(): void {
    this.modalService.open('csv-upload-form');
  }

  pagarProductosTarjetaCredito(): void {
    this.apiService
      .post<string>('compras-credito/pagar-productos', {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadProducts();
        },
        error: (err) => {
          void err;
        },
      });
  }

  cargarResponsables(responsables: string): { iniciales: string; color: string; nombre: string }[] {
    if (!responsables) return [];

    const listaResponsables = responsables.split(',').filter(r => r.trim().length > 0);
    return listaResponsables.map((responsable) => {
      const personaId = parseInt(responsable.trim(), 10);
      const persona = this.sharedListasService.findPersonaFast(personaId);

      return {
        iniciales: persona?.inicialesNombre || '',
        color: persona?.colorRepresentativo || '',
        nombre: persona?.nombre || '',
      };
    });
  }

  loadPersonas(): void {
    this.apiService.get<Persona[]>('personas')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (personas) => {
          this.personas = personas;
          this.sharedListasService.listaPersonas = personas;
        },
        error: (error) => {
          void error;
        }
      });
  }
}
