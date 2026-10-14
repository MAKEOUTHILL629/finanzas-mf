import { Component, OnInit, OnDestroy } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { PagoMensualPersonaDetalle } from '../../modelos/pagos';
import { ApiServicesService } from '../../services/api-services.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedListasService } from '../../services/shared-listas.service';
import { Persona } from '../../modelos/persona';
import { sortCollection, sumByField } from '../../shared/table-filter.helper';

export interface ResumenTarjeta {
  tarjeta: number;
  totalResponsable: number;
  totalInteres: number;
  totalCapital: number;
  totalSaldo: number;
}

@Component({
  selector: 'app-pago-persona-mes-detalle',
  templateUrl: './pago-persona-mes-detalle.component.html',
  styleUrl: './pago-persona-mes-detalle.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('400ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class PagoPersonaMesDetalleComponent implements OnInit, OnDestroy {
  pagosMensualesPersonaDetalle: PagoMensualPersonaDetalle[] = [];
  persona?: Persona;
  fechaPago: Date = new Date();
  idPersona: number = 0;
  mes: number = 0;
  year: number = 0;
  sortColumn: keyof PagoMensualPersonaDetalle | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiServicesService,
    private route: ActivatedRoute,
    private sharedListas: SharedListasService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPagosMensualesPersonaDetalle();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPagosMensualesPersonaDetalle(): void {
    this.idPersona = Number(this.route.snapshot.paramMap.get('id')) || 1;

    this.route.queryParamMap.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        this.mes = Number(params.get('mes')) || (new Date().getMonth() + 1);
        this.year = Number(params.get('year')) || new Date().getFullYear();
        return this.apiService.get<PagoMensualPersonaDetalle[]>(
          `pagos/personas/${this.idPersona}?mes=${this.mes}&year=${this.year}`
        );
      })
    ).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (pagosProductosDetalleMes) => {
        this.pagosMensualesPersonaDetalle = pagosProductosDetalleMes || [];
        this.persona = this.sharedListas.findPersonaFast(this.idPersona) ||
                       this.sharedListas.listaPersonas.find(p => p.id === this.idPersona);
        if (this.pagosMensualesPersonaDetalle.length > 0) {
          this.fechaPago = this.pagosMensualesPersonaDetalle[0].fechaPago;
        }
      },
      error: (error) => { void error; }
    });
  }

  get sortedData(): PagoMensualPersonaDetalle[] {
    if (!this.sortColumn) {
      return this.pagosMensualesPersonaDetalle;
    }
    return sortCollection(this.pagosMensualesPersonaDetalle, this.sortColumn, this.sortDirection);
  }

  /**
   * Método que se invoca al hacer click en el header de la tabla.
   * Determina si se ordena ascendente o descendente y setea las variables.
   */
  onSort(column: keyof PagoMensualPersonaDetalle): void {
    if (this.sortColumn === column) {
      this.sortDirection = (this.sortDirection === 'asc') ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  /**
   * Formatear la fecha en formato DD/MM/YYYY
   */
  formatearFecha(fecha: Date): string {
    const dateObj = new Date(fecha);
    const dia = String(dateObj.getDate()).padStart(2, '0');
    const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
    const anio = dateObj.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  /**
   * Resumen: Calcula totales por TARJETA
   * Devuelve un array de { tarjeta, totalResponsable, totalInteres, totalCapital, totalSaldo }
   */
  get resumenPorTarjeta(): ResumenTarjeta[] {
    const map = new Map<number, ResumenTarjeta>();

    for (const item of this.pagosMensualesPersonaDetalle) {
      if (!map.has(item.tarjeta)) {
        map.set(item.tarjeta, {
          tarjeta: item.tarjeta,
          totalResponsable: 0,
          totalInteres: 0,
          totalCapital: 0,
          totalSaldo: 0
        });
      }
      const resumen = map.get(item.tarjeta)!;
      resumen.totalResponsable = Math.round((resumen.totalResponsable + (item.valorPagoResponsable || 0) + Number.EPSILON) * 100) / 100;
      resumen.totalInteres = Math.round((resumen.totalInteres + (item.interesPagado || 0) + Number.EPSILON) * 100) / 100;
      resumen.totalCapital = Math.round((resumen.totalCapital + (item.aporteCapital || 0) + Number.EPSILON) * 100) / 100;
      resumen.totalSaldo = Math.round((resumen.totalSaldo + (item.saldoRestante || 0) + Number.EPSILON) * 100) / 100;
    }

    return Array.from(map.values());
  }

  /**
   * Resumen: Totales Generales sumando TODAS las tarjetas
   */
  get resumenGeneral(): ResumenTarjeta {
    return {
      tarjeta: 0,
      totalResponsable: sumByField(this.resumenPorTarjeta, 'totalResponsable'),
      totalInteres: sumByField(this.resumenPorTarjeta, 'totalInteres'),
      totalCapital: sumByField(this.resumenPorTarjeta, 'totalCapital'),
      totalSaldo: sumByField(this.resumenPorTarjeta, 'totalSaldo')
    };
  }

  irDetalleCompra(compra: number): void {
    this.router.navigate(['/compra-credito-detalle', compra], {
      state: { compra: compra },
    });
  }
}
