import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ComprasCredito,
  CuotaDetalle,
  months,
} from '../../modelos/compras-credito';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiServicesService } from '../../services/api-services.service';
import { formatDateOnly, partesFechaCalendario } from '../../shared/date-only.helper';
import { ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Tarjeta } from '../../modelos/tarjeta';

@Component({
  selector: 'app-detalle-compras-credito',
  templateUrl: './detalle-compras-credito.component.html',
  styleUrl: './detalle-compras-credito.component.css',
})
export class DetalleComprasCreditoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private pendingNavigationState: ComprasCredito | null = null;
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

    // Capturar el estado de la navegación sincrónicamente antes de cualquier suscripción
    const navigation = this.router.getCurrentNavigation();
    this.pendingNavigationState = (navigation?.extras?.state?.['compra'] as ComprasCredito) ?? null;

    // Suscribirse a cambios de param para soportar reutilización del componente
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = Number(params.get('id'));
        this.resetearEstado();

        // Usar estado de navegación solo en la primera carga
        const navState = this.pendingNavigationState;
        this.pendingNavigationState = null;

        if (navState?.concepto && Number(navState.id) === id) {
          this.compraCredito = navState;
          this.compraOriginal = { ...navState };
          this.compraEditada = { ...navState };
          this.loadCuotas();
        } else {
          this.apiService.get<ComprasCredito>(`compras-credito/detalle/${id}`).subscribe({
            next: (data) => {
              this.compraCredito = data;
              this.compraOriginal = { ...data };
              this.compraEditada = { ...data };
              this.loadCuotas();
            },
            error: (err) => { /* error handler */ }
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resetearEstado(): void {
    this.compraCredito = undefined;
    this.compraOriginal = undefined;
    this.compraEditada = {};
    this.cuotaDetalles = [];
    this.camposEditando = {};
    this.hayCambios = false;
    this.hayCambiosResponsables = false;
    this.cambiosResponsables = [];
    this.responsablesModificados = [];
    this.mostrarModalConfirmacion = false;
    this.mostrarModalEliminacion = false;
    // Limpiar datos del gráfico
    this.lineChartData.datasets[0].data = [];
    this.lineChartData.datasets[1].data = [];
    this.lineChartData.datasets[2].data = [];
    this.lineChartData.labels = [];
  }
  loadCuotas(): void {
    if (!this.compraCredito?.id) return;
    this.apiService
      .get<CuotaDetalle[]>(`compras-credito/${this.compraCredito.id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.cuotaDetalles = data;
          this.cuotaDetalles.sort(
            (a, b) => (a.numeroCuota || 0) - (b.numeroCuota || 0)
          );

          this.configurarCampos();
        },
        error: (err) => {
          void err;
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
    const compraFormateada = {
      id: this.compraCredito?.id,
      fechaCompra: formatDateOnly(this.compraCredito?.fechaCompra || new Date()),
      concepto: this.compraCredito?.concepto,
      valorCompra: this.compraCredito?.valorCompra,
      numeroCuotas: this.compraCredito?.numeroCuotas,
      interes: this.compraCredito?.interes,
      descripcion: this.compraCredito?.descripcion,
      estado: this.compraCredito?.estado,
      tarjeta: this.compraCredito?.tarjeta,
    };
    this.apiService
      .post<CuotaDetalle[]>(`recalcular-compra-credito`, compraFormateada)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.cuotaDetalles = data;
          this.loadCuotas();
        },
        error: (err) => {
          void err;
        },
      });
  }

  configurarCampos(): void {
    this.lineChartData.datasets[0].data = [];
    this.lineChartData.datasets[1].data = [];
    this.lineChartData.datasets[2].data = [];
    this.lineChartData.labels = []; // Reset labels para evitar acumulación

    this.cuotaDetalles.forEach(
      (cuota) => {
        this.lineChartData.datasets[0].data.push(cuota.interesPagado || 0);
        this.lineChartData.datasets[2].data.push(cuota.aporteCapital || 0);
        this.lineChartData.datasets[1].data.push(cuota.saldoRestante || 0);

        const { mes, anio } = partesFechaCalendario(cuota.fechaPago || new Date());
        this.lineChartData.labels?.push(`${months[mes]} del ${anio}`);
      }
    );
    this.chart?.update();
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

    this.apiService
      .delete(`compras-credito/${this.compraCredito.id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eliminando = false;
          this.mostrarModalEliminacion = false;
          // Navegar al componente de tabla
          this.router.navigate(['/compras-credito']);
        },
        error: (err) => {
          void err;
          this.eliminando = false;
          alert('Error al eliminar la compra. Por favor, intente nuevamente.');
        },
      });
  }

  // ==================== EDICIÓN DE COMPRA ====================

  activarEdicion(campo: string): void {
    this.camposEditando[campo] = true;
    const key = campo as keyof ComprasCredito;
    // Pre-rellenar siempre con el valor actual si no fue editado aún
    if (this.compraEditada[key] === undefined || this.compraEditada[key] === null) {
      this.compraEditada = {
        ...this.compraEditada,
        [key]: this.compraCredito?.[key]
      };
    }
  }

  /** Formatea una fecha (ISO o string) al formato yyyy-MM-dd requerido por <input type="date"> */
  getDateForInput(value: any): string {
    if (!value) return '';
    try {
      return formatDateOnly(value);
    } catch {
      return String(value).substring(0, 10);
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
        const fechaOriginal = valorOriginal ? formatDateOnly(valorOriginal) : '';
        const fechaEditada = valorEditado ? formatDateOnly(valorEditado) : '';
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

    // Determinar qué actualizar
    const campos = ['concepto', 'valorCompra', 'fechaCompra', 'numeroCuotas', 'interes', 'descripcion', 'estado', 'tarjeta'];
    const hayCambiosCompra = campos.some(campo => {
      const valorOriginal = this.compraOriginal?.[campo as keyof ComprasCredito];
      const valorEditado = this.compraEditada[campo as keyof ComprasCredito];
      if (campo === 'fechaCompra') {
        const fechaOriginal = valorOriginal ? formatDateOnly(valorOriginal) : '';
        const fechaEditada = valorEditado ? formatDateOnly(valorEditado) : '';
        return fechaOriginal !== fechaEditada;
      }
      return valorOriginal !== valorEditado;
    });

    const promesas: Promise<any>[] = [];

    // Actualizar compra si hay cambios
    if (hayCambiosCompra) {
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
        datosActualizacion.fechaCompra = formatDateOnly(datosActualizacion.fechaCompra) as any;
      }

      promesas.push(this.apiService.put<ComprasCredito>('compras-credito', datosActualizacion).toPromise());
    }

    // Actualizar responsables si hay cambios
    if (this.hayCambiosResponsables && this.responsableComponent) {
      promesas.push(this.responsableComponent.actualizarResponsables(this.responsablesModificados));
    }

    // Ejecutar todas las actualizaciones
    Promise.all(promesas)
      .then(() => {
        this.actualizando = false;
        this.mostrarModalConfirmacion = false;

        // Recargar datos usando el endpoint detalle para obtener todos los campos calculados
        const id = this.compraCredito?.id;
        if (id) {
          this.apiService.get<ComprasCredito>(`compras-credito/detalle/${id}`).subscribe({
            next: (data) => {
              this.compraCredito = data;
              this.compraOriginal = { ...data };
              this.compraEditada = { ...data };
              this.hayCambios = false;
              this.hayCambiosResponsables = false;
              this.cambiosResponsables = [];
              this.responsablesModificados = [];
              this.camposEditando = {};
              this.mostrarModalConfirmacion = false;
              this.loadCuotas();
              alert('Actualización exitosa');
            },
            error: (err) => { void err; }
          });
        }
      })
      .catch((err) => {
        void err;
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
        const fechaOriginal = valorOriginal ? formatDateOnly(valorOriginal) : '';
        const fechaEditada = valorEditado ? formatDateOnly(valorEditado) : '';
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
    this.apiService.get<Tarjeta[]>('tarjetas')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.tarjetas = data;
        },
        error: (err) => {
          void err;
        },
      });
  }
}
