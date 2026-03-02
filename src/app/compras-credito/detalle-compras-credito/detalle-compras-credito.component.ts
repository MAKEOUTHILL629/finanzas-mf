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
import { Tarjeta } from '../../modelos/tarjeta';

@Component({
  selector: 'app-detalle-compras-credito',
  templateUrl: './detalle-compras-credito.component.html',
  styleUrl: './detalle-compras-credito.component.css',
})
export class DetalleComprasCreditoComponent implements OnInit {
  compraCredito: ComprasCredito | undefined;
  compraOriginal: ComprasCredito | undefined; // Copia para comparación
  compraEditada: ComprasCredito = {}; // Valores editados temporalmente

  cuotaDetalles: CuotaDetalle[] = [];
  tarjetas: Tarjeta[] = [];

  // Estados de edición
  camposEditando: { [key: string]: boolean } = {};
  hayCambios: boolean = false;

  // Estados de responsables
  hayCambiosResponsables: boolean = false;
  cambiosResponsables: Array<{ responsable: any; cambiosDetalle: any[] }> = [];
  responsablesModificados: any[] = [];

  // Modales
  mostrarModalEliminacion: boolean = false;
  mostrarModalConfirmacion: boolean = false;
  eliminando: boolean = false;
  actualizando: boolean = false;

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
  @ViewChild('responsableComponent') responsableComponent: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiServicesService
  ) {



  }

  ngOnInit(): void {
    this.loadTarjetas();

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
          this.compraOriginal = { ...data };
          this.compraEditada = { ...data };
          console.log('Compra encontrada:', this.compraCredito);
          this.loadCuotas();
        },
        error: (err) => {
          console.error('Error fetching credit cards:', err);
        },
      });
    }
    if(this.compraCredito?.concepto){
      this.compraOriginal = { ...this.compraCredito };
      this.compraEditada = { ...this.compraCredito };
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

  confirmarEliminacion(): void {
    this.mostrarModalEliminacion = true;
  }

  cancelarEliminacion(): void {
    this.mostrarModalEliminacion = false;
  }

  eliminarCompra(): void {
    if (!this.compraCredito?.id || this.eliminando) {
      return;
    }

    this.eliminando = true;
    console.log('Eliminando compra con ID:', this.compraCredito.id);

    this.apiService
      .delete(`compras-credito/${this.compraCredito.id}`)
      .subscribe({
        next: () => {
          console.log('Compra eliminada exitosamente');
          this.eliminando = false;
          this.mostrarModalEliminacion = false;
          // Navegar al componente de tabla
          this.router.navigate(['/compras-credito']);
        },
        error: (err) => {
          console.error('Error al eliminar la compra:', err);
          this.eliminando = false;
          alert('Error al eliminar la compra. Por favor, intente nuevamente.');
        },
      });
  }

  // ==================== EDICIÓN DE COMPRA ====================

  activarEdicion(campo: string): void {
  this.camposEditando[campo] = true;
  const key = campo as keyof ComprasCredito;
  // Copiar el valor actual a compraEditada si no existe
  if (!this.compraEditada[key]) {
    this.compraEditada = {
      ...this.compraEditada,
      [key]: this.compraCredito?.[key]
    } as Partial<ComprasCredito>;
  }
}

  desactivarEdicion(campo: string): void {
    setTimeout(() => {
      this.camposEditando[campo] = false;
    }, 200);
  }

  actualizarCampo(campo: string, valor: any): void {
    this.compraEditada[campo as keyof ComprasCredito] = valor;
    this.detectarCambios();
  }

  private detectarCambios(): void {
    if (!this.compraOriginal) {
      this.hayCambios = false;
      return;
    }

    const campos = ['concepto', 'valorCompra', 'fechaCompra', 'numeroCuotas', 'interes', 'descripcion', 'estado', 'tarjeta'];

    const hayCambiosCompra = campos.some(campo => {
      const valorOriginal = this.compraOriginal?.[campo as keyof ComprasCredito];
      const valorEditado = this.compraEditada[campo as keyof ComprasCredito];

      // Comparación especial para fechas
      if (campo === 'fechaCompra') {
        const fechaOriginal = valorOriginal ? formatDate(valorOriginal, 'yyyy-MM-dd', 'en-US') : '';
        const fechaEditada = valorEditado ? formatDate(valorEditado, 'yyyy-MM-dd', 'en-US') : '';
        return fechaOriginal !== fechaEditada;
      }

      return valorOriginal !== valorEditado;
    });

    // Combinar cambios de compra y responsables
    this.hayCambios = hayCambiosCompra || this.hayCambiosResponsables;
  }

  cancelarEdicion(): void {
    this.compraEditada = { ...this.compraOriginal };
    this.camposEditando = {};
    this.hayCambios = false;
    // También resetear cambios de responsables
    if (this.responsableComponent) {
      this.responsableComponent.resetearCambios();
    }
  }

  onCambiosResponsables(event: { hayUsuarios: boolean; cambios: any[]; responsablesModificados: any[] }): void {
    this.hayCambiosResponsables = event.hayUsuarios;
    this.cambiosResponsables = event.cambios;
    this.responsablesModificados = event.responsablesModificados;
    // Actualizar el estado general de cambios
    this.detectarCambios();
  }

  prepararActualizacion(): void {
    if (!this.validarCambios()) {
      return;
    }
    this.mostrarModalConfirmacion = true;
  }

  cerrarModalConfirmacion(): void {
    this.mostrarModalConfirmacion = false;
  }

  private validarCambios(): boolean {
    // Validar concepto
    if (!this.compraEditada.concepto || this.compraEditada.concepto.trim() === '') {
      alert('El concepto es requerido');
      return false;
    }

    // Validar valor de compra
    const valorCompra = typeof this.compraEditada.valorCompra === 'string'
      ? this.parseCurrencyValue(this.compraEditada.valorCompra)
      : this.compraEditada.valorCompra;

    if (!valorCompra || valorCompra <= 0) {
      alert('El valor de compra debe ser mayor a 0');
      return false;
    }

    // Validar fecha
    if (!this.compraEditada.fechaCompra) {
      alert('La fecha de compra es requerida');
      return false;
    }

    // Validar número de cuotas
    if (!this.compraEditada.numeroCuotas || this.compraEditada.numeroCuotas < 1) {
      alert('El número de cuotas debe ser al menos 1');
      return false;
    }

    // Validar interés
    if (this.compraEditada.interes === undefined || this.compraEditada.interes === null || this.compraEditada.interes < 0) {
      alert('El interés no puede ser negativo');
      return false;
    }

    // Validar estado
    if (!this.compraEditada.estado) {
      alert('El estado es requerido');
      return false;
    }

    // Validar tarjeta
    if (!this.compraEditada.tarjeta) {
      alert('La tarjeta es requerida');
      return false;
    }

    return true;
  }

  actualizarCompra(): void {
    if (this.actualizando) {
      return;
    }

    this.actualizando = true;
    console.log('Iniciando actualización...');

    // Determinar qué actualizar
    const campos = ['concepto', 'valorCompra', 'fechaCompra', 'numeroCuotas', 'interes', 'descripcion', 'estado', 'tarjeta'];
    const hayCambiosCompra = campos.some(campo => {
      const valorOriginal = this.compraOriginal?.[campo as keyof ComprasCredito];
      const valorEditado = this.compraEditada[campo as keyof ComprasCredito];
      if (campo === 'fechaCompra') {
        const fechaOriginal = valorOriginal ? formatDate(valorOriginal, 'yyyy-MM-dd', 'en-US') : '';
        const fechaEditada = valorEditado ? formatDate(valorEditado, 'yyyy-MM-dd', 'en-US') : '';
        return fechaOriginal !== fechaEditada;
      }
      return valorOriginal !== valorEditado;
    });

    const promesas: Promise<any>[] = [];

    // Actualizar compra si hay cambios
    if (hayCambiosCompra) {
      console.log('Actualizando compra...');
      const datosActualizacion: ComprasCredito = {
        id: this.compraCredito?.id,
        concepto: this.compraEditada.concepto,
        valorCompra: typeof this.compraEditada.valorCompra === 'string'
          ? this.parseCurrencyValue(this.compraEditada.valorCompra)
          : this.compraEditada.valorCompra,
        fechaCompra: this.compraEditada.fechaCompra,
        numeroCuotas: this.compraEditada.numeroCuotas,
        interes: this.compraEditada.interes,
        descripcion: this.compraEditada.descripcion || '',
        estado: this.compraEditada.estado,
        tarjeta: this.compraEditada.tarjeta
      };

      if (datosActualizacion.fechaCompra) {
        datosActualizacion.fechaCompra = formatDate(
          datosActualizacion.fechaCompra,
          'yyyy-MM-dd',
          'en-US'
        ) as any;
      }

      promesas.push(this.apiService.put<ComprasCredito>('compras-credito', datosActualizacion).toPromise());
    }

    // Actualizar responsables si hay cambios
    if (this.hayCambiosResponsables && this.responsableComponent) {
      console.log('Actualizando responsables...');
      promesas.push(this.responsableComponent.actualizarResponsables(this.responsablesModificados));
    }

    // Ejecutar todas las actualizaciones
    Promise.all(promesas)
      .then(() => {
        console.log('Actualización exitosa');
        this.actualizando = false;
        this.mostrarModalConfirmacion = false;

        // Recargar datos
        const id = this.compraCredito?.id;
        if (id) {
          this.apiService.get<ComprasCredito>(`compras-credito/id/${id}`).subscribe({
            next: (data) => {
              this.compraCredito = data;
              this.compraOriginal = { ...data };
              this.compraEditada = { ...data };
              this.hayCambios = false;
              this.camposEditando = {};
              this.hayCambiosResponsables = false;
              this.cambiosResponsables = [];
              this.responsablesModificados = [];
              this.loadCuotas();
              alert('Actualización exitosa');
            },
            error: (err) => console.error('Error recargando:', err)
          });
        }
      })
      .catch((err) => {
        console.error('Error actualizando:', err);
        alert('Error al actualizar. Por favor intente nuevamente.');
        this.actualizando = false;
      });
  }

  obtenerCambios(): { campo: string; valorAnterior: any; valorNuevo: any; }[] {
    if (!this.compraOriginal) return [];

    const cambios: { campo: string; valorAnterior: any; valorNuevo: any; }[] = [];
    const camposLabels: { [key: string]: string } = {
      concepto: 'Concepto',
      valorCompra: 'Valor de Compra',
      fechaCompra: 'Fecha de Compra',
      numeroCuotas: 'Número de Cuotas',
      interes: 'Interés',
      descripcion: 'Descripción',
      estado: 'Estado',
      tarjeta: 'Tarjeta'
    };

    Object.keys(camposLabels).forEach(campo => {
      const valorOriginal = this.compraOriginal?.[campo as keyof ComprasCredito];
      const valorEditado = this.compraEditada[campo as keyof ComprasCredito];

      let hayDiferencia = false;
      let valorAnteriorFormateado = valorOriginal;
      let valorNuevoFormateado = valorEditado;

      // Comparación especial para fechas
      if (campo === 'fechaCompra') {
        const fechaOriginal = valorOriginal ? formatDate(valorOriginal, 'yyyy-MM-dd', 'en-US') : '';
        const fechaEditada = valorEditado ? formatDate(valorEditado, 'yyyy-MM-dd', 'en-US') : '';
        hayDiferencia = fechaOriginal !== fechaEditada;
        valorAnteriorFormateado = fechaOriginal;
        valorNuevoFormateado = fechaEditada;
      } else if (campo === 'valorCompra') {
        // Normalizar valores de moneda para comparar
        const valorOriginalNum = typeof valorOriginal === 'string'
          ? this.parseCurrencyValue(valorOriginal)
          : valorOriginal;
        const valorEditadoNum = typeof valorEditado === 'string'
          ? this.parseCurrencyValue(valorEditado)
          : valorEditado;
        hayDiferencia = valorOriginalNum !== valorEditadoNum;
        valorAnteriorFormateado = valorOriginalNum;
        valorNuevoFormateado = valorEditadoNum;
      } else {
        hayDiferencia = valorOriginal !== valorEditado;
      }

      if (hayDiferencia) {
        cambios.push({
          campo: camposLabels[campo],
          valorAnterior: valorAnteriorFormateado ?? 'N/A',
          valorNuevo: valorNuevoFormateado ?? 'N/A'
        });
      }
    });

    return cambios;
  }

  private parseCurrencyValue(value: string | number | null | undefined): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const numericValue = value.replace(/[^0-9]/g, '');
      return parseFloat(numericValue) || 0;
    }
    return 0;
  }

  formatCurrency(value: string | number | null | undefined): string {
    const numValue = typeof value === 'string' ? this.parseCurrencyValue(value) : (value || 0);
    return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  handleCurrencyInput(event: Event, campo: string): void {
    const input = event.target as HTMLInputElement;
    const numericValue = input.value.replace(/[^0-9]/g, '');
    const formatted = this.formatCurrency(numericValue);
    input.value = formatted;
    this.actualizarCampo(campo, formatted);
  }

  private loadTarjetas(): void {
    this.apiService.get<Tarjeta[]>('tarjetas').subscribe({
      next: (data) => {
        this.tarjetas = data;
      },
      error: (err) => {
        console.error('Error cargando tarjetas:', err);
      },
    });
  }
}
