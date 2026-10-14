import { Component, OnInit, OnDestroy } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { PagoMensualTarjetaDetalle } from '../../modelos/pagos';
import { ApiServicesService } from '../../services/api-services.service';
import { ActivatedRoute, Router } from '@angular/router';
import { sumByField } from '../../shared/table-filter.helper';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-pagos-mes-tarjetas-detalle',
  templateUrl: './pagos-mes-tarjetas-detalle.component.html',
  styleUrl: './pagos-mes-tarjetas-detalle.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('400ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class PagosMesTarjetasDetalleComponent implements OnInit, OnDestroy {
  detallePagoMensual: PagoMensualTarjetaDetalle[] = [];
  idTarjeta: number = 0;
  mes: number = 0;
  year: number = 0;
  fechaPago = new Date();
  sortedData: PagoMensualTarjetaDetalle[] = [];

  currentSortKey: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiServicesService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadDetallePagoMensual();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDetallePagoMensual(): void {
    this.idTarjeta = Number(this.route.snapshot.paramMap.get('id')) || 1;

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.mes = Number(params.get('mes')) || 1;
        this.year = Number(params.get('year')) || new Date().getFullYear();

        this.apiService.get<PagoMensualTarjetaDetalle[]>(`tarjetas/pagos/${this.idTarjeta}?mes=${this.mes}&year=${this.year}`)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (data) => {
              this.detallePagoMensual = data;
              if (data && data.length > 0) {
                this.fechaPago = data[0].fechaPago;
              }
              this.sortedData = this.detallePagoMensual.slice();
            },
            error: (error) => {
              void error;
            }
          });
      });
  }

  /**
   * Ordena la tabla según la columna seleccionada.
   * Si vuelves a hacer clic en la misma columna, alterna entre asc y desc.
   */
  sortData(key: keyof PagoMensualTarjetaDetalle): void {
    if (this.currentSortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSortKey = key;
      this.sortDirection = 'asc';
    }

    this.sortedData = this.detallePagoMensual.slice().sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];

      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      } else if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      } else {
        return 0;
      }
    });
  }

  // --- Getters para totales con sumByField seguro ---
  get totalInteresPagado(): number {
    return sumByField(this.detallePagoMensual, item => item.interesPagado);
  }

  get totalAporteCapital(): number {
    return sumByField(this.detallePagoMensual, item => item.aporteCapital);
  }

  get totalPagoTotal(): number {
    return sumByField(this.detallePagoMensual, item => item.pagoTotal);
  }

  get totalSaldoRestante(): number {
    return sumByField(this.detallePagoMensual, item => item.saldoRestante);
  }

  irDetalleCompra(compra: number): void {
    this.router.navigate(['/compra-credito-detalle', compra], {
      state: { compra: compra },
    });
  }
}
