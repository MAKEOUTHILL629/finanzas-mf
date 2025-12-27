import { Component, OnInit } from '@angular/core';
import { ComprasCreditoService } from '../../servicios/compras-credito.service';
import {
  ColumnasCompraCredito,
  ComprasCredito,
  ResponsableCompraCredito,
  SortableFields,
} from '../../modelos/compras-credito';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Tarjeta } from '../../modelos/tarjeta';
import { ApiServicesService } from '../../servicios/api-services.service';
import { Router } from '@angular/router';
import { ModalService } from '../../servicios/modal.service';
import { Persona } from '../../modelos/persona';
import { capitalize } from '../../shared/utils';
import { SharedListasService } from '../../services/shared-listas.service';

@Component({
  selector: 'app-tabla-compras-credito',
  templateUrl: './tabla-compras-credito.component.html',
  styleUrl: './tabla-compras-credito.component.css',
})
export class TablaComprasCreditoComponent implements OnInit {
  comprasCredito: ComprasCredito[] = [];
  isLoading = false;
  error: string | null = null;

  filteredPurchases: ComprasCredito[] = [];
  filterForm: FormGroup;
  sortColumn: SortableFields = 'fechaCompra';
  sortDirection: 'asc' | 'desc' = 'asc';

  estados: string[] = ['Pendiente', 'Pagado', 'Cancelado'];

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
    private comprasCreditoService: ComprasCreditoService,
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
      tarjeta: [''],
      concepto: [''],
      estado: [''],
    });
  }
  ngOnInit(): void {
    this.loadTarjetas();
    this.loadPersonas();
    this.loadProducts();

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
    this.applyFilters();
  }

  loadTarjetas(): void {
    this.apiService.get<Tarjeta[]>('tarjetas').subscribe({
      next: (data) => {
        this.tarjetas = data;
        this.sharedListasService.listaTarjetas = data;
      },
      error: (err) => {
        console.error('Error fetching credit cards:', err);
      },
    });
  }

  obtenerTarjeta(id: number): string {
    const tarjeta = this.tarjetas.find((tarjeta) => tarjeta.id === id);
    return tarjeta?.franquicia ? tarjeta.franquicia : 'N/A';
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;
    this.apiService.get<ComprasCredito[]>('compras-credito').subscribe({
      next: (data) => {
        this.comprasCredito = data;

        this.filteredPurchases = [...this.comprasCredito].sort((a, b) => {
          const aFecha = new Date(a.fechaCompra || 0);
          const bFecha = new Date(b.fechaCompra || 0);
          return bFecha.getTime() - aFecha.getTime();
        });

        this.estados = Array.from(new Set(  this.comprasCredito.map((compra) => capitalize(compra.estado || 'Todos')) ));
        this.isLoading = false;
      },
      error: (err) => {
        this.error =
          'Error al cargar los productos. Por favor, intente de nuevo.';
        this.isLoading = false;
        console.error('Error fetching products:', err);
      },
    });
  }

  applyFilters() {
    const filters = this.filterForm.value;

    this.filteredPurchases = this.comprasCredito.filter((purchase) => {
      let matchesFilter = true;

      if (filters.fechaCompraInicio && purchase.fechaCompra) {
        const filterDate = new Date(filters.fechaCompraInicio);
        matchesFilter = matchesFilter && purchase.fechaCompra >= filterDate;
      }

      if (filters.fechaCompraFin && purchase.fechaCompra) {
        const filterDate = new Date(filters.fechaCompraFin);
        matchesFilter = matchesFilter && purchase.fechaCompra <= filterDate;
      }

      if (filters.numeroCuotas && purchase.numeroCuotas !== undefined) {
        matchesFilter =
          matchesFilter &&
          purchase.numeroCuotas === parseInt(filters.numeroCuotas, 10);
      }

      if (filters.fechaUltimaCuotaInicio && purchase.fechaUltimaCuota) {
        const filterDate = new Date(filters.fechaUltimaCuotaInicio);
        matchesFilter =
          matchesFilter && purchase.fechaUltimaCuota >= filterDate;
      }

      if (filters.fechaUltimaCuotaFin && purchase.fechaUltimaCuota) {
        const filterDate = new Date(filters.fechaUltimaCuotaFin);
        matchesFilter =
          matchesFilter && purchase.fechaUltimaCuota <= filterDate;
      }

      if (filters.tarjeta && purchase.tarjeta) {
        matchesFilter = matchesFilter && purchase.tarjeta == filters.tarjeta;
      }

      if (filters.concepto && purchase.concepto) {
        matchesFilter =
          matchesFilter &&
          purchase.concepto
            .toLowerCase()
            .includes(filters.concepto.toLowerCase());
      }


      if (filters.estado && purchase.estado) {
        matchesFilter =
          matchesFilter &&
          purchase.estado
            .toLowerCase()
            .includes(filters.estado.toLowerCase());
      }

      return matchesFilter;
    });

    this.sortData(this.sortColumn);
  }

  sortData(column: SortableFields) {
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

  resetFilters() {
    this.filterForm.reset();
    this.loadProducts();
  }

  getPropertyValue(purchase: ComprasCredito, property: SortableFields): any {
    return purchase[property];
  }

  // Método auxiliar para formatear fechas de manera segura
  formatDate(date: Date | undefined): string {
    return date ? date.toLocaleDateString() : 'N/A';
  }

  // Método auxiliar para formatear moneda de manera segura
  formatCurrency(value: number | undefined): string {
    return value !== undefined
      ? value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : 'N/A';
  }

  // Método auxiliar para manejar valores posiblemente undefined
  safeValue(value: any, defaultValue: any = 'N/A'): any {
    return value !== undefined ? value : defaultValue;
  }

  imprimirCompra(compra: ComprasCredito): void {
    console.log(compra);
  }

  irDetalleCompra(compra: ComprasCredito): void {
    this.router.navigate(['/compra-credito-detalle', compra.id], {
      state: { compra: compra },
    });
  }

  openCreditForm() {
    // Aquí irá la lógica para abrir tu formulario de crédito
    this.modalService.open('compra-credito-form');
  }

  pagarProductosTarjetaCredito() {
    this.apiService
      .post<string>('/compras-credito/pagar-productos', {})
      .subscribe({
        next: (data) => {
          console.log('Productos pagados exitosamente', data);
          this.loadProducts();
        },
        error: (err) => {
          console.error('Error pagando productos:', err);
        },
      });
  }

  cargarResponsables(responsables: string) {
    let listaResponsables = responsables.split(',');

    const nombresResponsables: {
      iniciales: string;
      color: string;
      nombre: string;
    }[] = [];

    listaResponsables.forEach((responsable, index) => {
      const persona = this.personas.find((persona) => {
        return persona.id === parseInt(responsable, 10);
      });

      nombresResponsables.push({
        iniciales: persona?.inicialesNombre || '',
        color: persona?.colorRepresentativo || '',
        nombre: persona?.nombre || '',
      });
    });

    return nombresResponsables;
  }

  loadPersonas() {
    this.apiService.get<Persona[]>(`personas`).subscribe(
      (personas) => {
        this.personas = personas;
        this.sharedListasService.listaPersonas = personas;
      },
      (error) => console.error('Error cargando personas', error)
    );
  }
}
