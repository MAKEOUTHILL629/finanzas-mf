import { Component, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { PagoMensualTarjetaDetalle } from '../../modelos/pagos';
import { ApiServicesService } from '../../services/api-services.service';
import { ActivatedRoute, Router } from '@angular/router';

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
export class PagosMesTarjetasDetalleComponent implements OnInit {
  detallePagoMensual: PagoMensualTarjetaDetalle[] = [];
idTarjeta: number = 0;
mes: number = 0;
year: number = 0;
fechaPago = new Date();
    // Aquí guardaremos la data que se va a mostrar, ya "ordenada"
    sortedData: PagoMensualTarjetaDetalle[] = [];

    // Control del estado de ordenado
    currentSortKey: string = '';
    sortDirection: 'asc' | 'desc' = 'asc';
    constructor(private apiService: ApiServicesService, private route: ActivatedRoute, private router: Router) { }

    ngOnInit(): void {
      // Inicializamos la tabla con los datos originales
      // (podrías hacer una llamada a un servicio, etc.)
      this.loadDetallePagoMensual()
    }


    loadDetallePagoMensual(): void {

      this.idTarjeta = Number(this.route.snapshot.paramMap.get('id')) || 1;

    this.route.queryParamMap.subscribe(params => {
      this.mes = Number(params.get('mes')) || 1;
      this.year = Number(params.get('year')) || 2021;
    });


      this.apiService.get<PagoMensualTarjetaDetalle[]>(`tarjetas/pagos/${this.idTarjeta}?mes=${this.mes}&year=${this.year}`).subscribe(
        data => {
          this.detallePagoMensual = data;
          this.fechaPago = this.detallePagoMensual[0].fechaPago;
          this.sortedData = this.detallePagoMensual.slice();
        },
        error => {
          void error;
        }
      );
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

        // Comparación básica para strings / numbers
        if (aValue < bValue) {
          return this.sortDirection === 'asc' ? -1 : 1;
        } else if (aValue > bValue) {
          return this.sortDirection === 'asc' ? 1 : -1;
        } else {
          return 0;
        }
      });
    }

    // --- Getters para totales ---
    get totalInteresPagado(): number {
      return this.detallePagoMensual.reduce((acc, item) => acc + item.interesPagado, 0);
    }

    get totalAporteCapital(): number {
      return this.detallePagoMensual.reduce((acc, item) => acc + item.aporteCapital, 0);
    }

    get totalPagoTotal(): number {
      return this.detallePagoMensual.reduce((acc, item) => acc + item.pagoTotal, 0);
    }

    get totalSaldoRestante(): number {
      return this.detallePagoMensual.reduce((acc, item) => acc + item.saldoRestante, 0);
    }

    irDetalleCompra(compra: number): void {
      this.router.navigate(['/compra-credito-detalle', compra], {
        state: { compra: compra },
      });
    }
}
