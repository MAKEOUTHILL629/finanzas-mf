import { Component, OnInit, ViewChild } from '@angular/core';
import {
  ComprasCredito,
  CuotaDetalle,
  months,
} from '../../modelos/compras-credito';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiServicesService } from '../../servicios/api-services.service';
import { formatDate } from '@angular/common';
import { ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-detalle-compras-credito',
  templateUrl: './detalle-compras-credito.component.html',
  styleUrl: './detalle-compras-credito.component.css',
})
export class DetalleComprasCreditoComponent implements OnInit {
  compraCredito: ComprasCredito | undefined;

  cuotaDetalles: CuotaDetalle[] = [];

  public lineChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'Interes Pagado',
        backgroundColor: '#DF265E',
        borderColor: '#DF265E',
        pointBackgroundColor: 'rgba(148,159,177,1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(148,159,177,0.8)',
        fill: 'origin',
      },
      {
        data: [],
        label: 'Saldo Restante',
        yAxisID: 'y1',
        backgroundColor: '#FAD02C',
        borderColor: '#FAD02C',
        pointBackgroundColor: 'rgba(148,159,177,1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(148,159,177,0.8)',
        fill: 'origin',
      },
      {
        data: [],
        label: 'Aporte Capital',
        backgroundColor: 'rgba(77,83,96,0.08)',
        borderColor: 'rgba(77,83,96,0.5)',
        pointBackgroundColor: 'rgba(77,83,96,1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(77,83,96,1)',
        fill: 'origin',
      },
    ],
    labels: [],
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0.5,
      },
    },
    scales: {
      // We use this empty structure as a placeholder for dynamic theming.
      y: {
        position: 'left',
      },
      y1: {
        position: 'right',
        grid: {
          color: 'rgba(255,0,0,0.3)',
        },
        ticks: {
          color: '#0C2D48',
        },
      },
    },

    plugins: {
      legend: { display: true },
    },
  };

  public lineChartType: ChartType = 'line';

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiServicesService
  ) {



  }

  ngOnInit(): void {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.compraCredito = navigation.extras.state['compra'];
    }else{
     this.compraCredito = { id: Number(this.route.snapshot.paramMap.get('id')) };
    }

    if (!this.compraCredito?.concepto) {

      console.log('No se encontro la compra en el estado, el id es:', this.compraCredito?.id);
      this.apiService.get<ComprasCredito>(`compras-credito/detalle/${this.compraCredito?.id}`).subscribe({
        next: (data) => {
          this.compraCredito = data;
          console.log('Compra encontrada:', this.compraCredito);
          this.loadCuotas();
        },
        error: (err) => {
          console.error('Error fetching credit cards:', err);
        },
      });
    }
    if(this.compraCredito?.concepto){
      this.loadCuotas();
  }
  }
  loadCuotas(): void {
    this.apiService
      .get<CuotaDetalle[]>(`compras-credito/${this.compraCredito?.id}`)
      .subscribe({
        next: (data) => {
          this.cuotaDetalles = data;
          console.log('Cuotas encontradas:', this.cuotaDetalles);
          this.cuotaDetalles.sort(
            (a, b) => (a.numeroCuota || 0) - (b.numeroCuota || 0)
          );

          this.configurarCampos();
        },
        error: (err) => {
          console.error('Error fetching credit cards:', err);
        },
      });
  }

  obtenerTotalPagado(): number {
    return this.cuotaDetalles.reduce(
      (acc, cuota) => acc + (cuota.pagoTotal || 0),
      0
    );
  }
  obtenerTotalPagadoInteres(): number {
    return this.cuotaDetalles.reduce(
      (acc, cuota) => acc + (cuota.interesPagado || 0),
      0
    );
  }

  recalcularCuotas(): void {
    console.log('Recalculando cuotas ');

    const compraFormateada = {
      id: this.compraCredito?.id,
      fechaCompra: formatDate(
        this.compraCredito?.fechaCompra || new Date(),
        'yyyy-MM-dd',
        'en-US'
      ),
      concepto: this.compraCredito?.concepto,
      valorCompra: this.compraCredito?.valorCompra,
      numeroCuotas: this.compraCredito?.numeroCuotas,
      interes: this.compraCredito?.interes,
      descripcion: this.compraCredito?.descripcion,
      estado: this.compraCredito?.estado,
      tarjeta: this.compraCredito?.tarjeta,
    };

    console.log(compraFormateada);
    this.apiService
      .post<CuotaDetalle[]>(`recalcular-compra-credito`, compraFormateada)
      .subscribe({
        next: (data) => {
          this.cuotaDetalles = data;
          this.loadCuotas();


        },
        error: (err) => {
          console.error('Error fetching credit cards:', err);
        },
      });
  }

  configurarCampos(): void {
    this.lineChartData.datasets[0].data = [];
    this.lineChartData.datasets[1].data = [];
    this.lineChartData.datasets[2].data = [];

     this.cuotaDetalles.forEach(
      (cuota) =>{
        this.lineChartData.datasets[0].data.push(cuota.interesPagado || 0);




        this.lineChartData.datasets[2].data.push(cuota.aporteCapital || 0);

        this.lineChartData.datasets[1].data.push(cuota.saldoRestante || 0);

        const date = new Date(cuota.fechaPago || new Date());

        this.lineChartData.labels?.push (`${months[date.getMonth()]} del ${date.getFullYear()}`);

        this.chart?.update();
      }
    );

    // this.lineChartData.datasets[2].data = this.cuotaDetalles.map(
    //   (cuota) => cuota.aporteCapital || 0
    // );
    // this.lineChartData.datasets[1].data = this.cuotaDetalles.map(
    //   (cuota) => cuota.saldoRestante || 0
    // );


    // this.lineChartData.labels = this.cuotaDetalles.map((cuota) => {
    //   const date = new Date(cuota.fechaPago || new Date());
    //   return `${months[date.getMonth()]} del ${date.getFullYear()}`;
    // });


  }
}
