import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiServicesService } from '../../services/api-services.service';
import { MesPagoTarjeta } from '../../modelos/compras-credito';
import { Tarjeta } from '../../modelos/tarjeta';
import { Router } from '@angular/router';
import { SharedListasService } from '../../services/shared-listas.service';
import { normalizeSearchText } from '../../shared/utils';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-pagos-mes-tarjetas',
  templateUrl: './pagos-mes-tarjetas.component.html',
  styleUrl: './pagos-mes-tarjetas.component.css'
})
export class PagosMesTarjetasComponent implements OnInit, OnDestroy {
  mesPagoTarjetas: MesPagoTarjeta[] = [];
  tarjetas: Tarjeta[] = [];
  private destroy$ = new Subject<void>();

  // Secciones colapsables
  showBalance: boolean = true;
  showKeyMonths: boolean = true;
  showAllMonths: boolean = false;

  // Datos para los 3 meses clave
  mesAnteriorData: { tarjetas: {nombre: string, monto: number, id: number, fecha: Date}[], total: number } = { tarjetas: [], total: 0 };
  mesActualData: { tarjetas: {nombre: string, monto: number, id: number, fecha: Date}[], total: number } = { tarjetas: [], total: 0 };
  mesSiguienteData: { tarjetas: {nombre: string, monto: number, id: number, fecha: Date}[], total: number } = { tarjetas: [], total: 0 };

  // Filtros
  tarjetaFiltro: number = 0; // 0 = todas
  busquedaFecha: string = ''; // Búsqueda inteligente de fechas

  // Ordenamiento
  ordenarPor: 'fecha' | 'valor' = 'fecha';
  ordenarDireccion: 'asc' | 'desc' = 'desc';

  constructor(
    private apiService: ApiServicesService,
    private route: Router,
    private sharedListasService: SharedListasService
  ) { }

  ngOnInit(): void {
    this.loadTarjetas();
    this.apiService.get<MesPagoTarjeta[]>('tarjetas/pagos')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.mesPagoTarjetas = data;

          this.mesPagoTarjetas.sort((a, b) => {
            const fechaA = new Date(a.fechaPago);
            const fechaB = new Date(b.fechaPago);
            if (fechaA < fechaB) return -1;
            if (fechaA > fechaB) return 1;
            return 0;
          });
          this.calcularTresMesesClave();
        },
        error: (err) => {
          void err;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  calcularTresMesesClave(): void {
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth();
    const yearActual = fechaActual.getFullYear();

    // Calcular fechas de los 3 meses
    const fechaAnterior = new Date(yearActual, mesActual - 1, 1);
    const fechaSiguiente = new Date(yearActual, mesActual + 1, 1);

    // Filtrar pagos por mes y agrupar por tarjeta
    this.mesAnteriorData = this.agruparPagosPorTarjeta(fechaAnterior);
    this.mesActualData = this.agruparPagosPorTarjeta(fechaActual);
    this.mesSiguienteData = this.agruparPagosPorTarjeta(fechaSiguiente);
  }

  agruparPagosPorTarjeta(fecha: Date): { tarjetas: {nombre: string, monto: number, id: number, fecha: Date}[], total: number } {
    const mes = fecha.getMonth();
    const year = fecha.getFullYear();

    // Filtrar pagos del mes específico
    const pagosMes = this.mesPagoTarjetas.filter(pago => {
      const fechaPago = new Date(pago.fechaPago);
      return fechaPago.getMonth() === mes && fechaPago.getFullYear() === year;
    });

    // Agrupar por tarjeta
    const tarjetasMap = new Map<number, number>();
    pagosMes.forEach(pago => {
      const tarjetaId = pago.tarjeta || 0;
      const montoActual = tarjetasMap.get(tarjetaId) || 0;
      tarjetasMap.set(tarjetaId, montoActual + pago.valorPago);
    });

    // Convertir a array con nombres
    const tarjetasArray = Array.from(tarjetasMap.entries()).map(([id, monto]) => ({
      nombre: this.obtenerTarjeta(id),
      monto: monto,
      id: id,
      fecha: fecha
    }));

    // Calcular total
    const total = tarjetasArray.reduce((sum, t) => sum + t.monto, 0);

    return { tarjetas: tarjetasArray, total };
  }

  // Navegar desde tarjeta de vista rápida
  navegarDesdeTarjeta(tarjetaId: number, fecha: Date): void {
    this.detallePagosMesTarjeta(tarjetaId, fecha);
  }

  // Obtener pagos filtrados y ordenados
  get mesPagoTarjetasFiltrados(): MesPagoTarjeta[] {
    let resultado = [...this.mesPagoTarjetas];

    // Filtrar por tarjeta
    if (this.tarjetaFiltro !== 0) {
      resultado = resultado.filter(pago => pago.tarjeta === this.tarjetaFiltro);
    }

    // Filtrar por búsqueda inteligente de fecha normalizada
    if (this.busquedaFecha && this.busquedaFecha.trim() !== '') {
      resultado = resultado.filter(pago => {
        return this.coincideBusquedaFecha(pago.fechaPago, this.busquedaFecha.trim());
      });
    }

    // Ordenar
    resultado.sort((a, b) => {
      let comparacion = 0;

      if (this.ordenarPor === 'fecha') {
        const fechaA = new Date(a.fechaPago).getTime();
        const fechaB = new Date(b.fechaPago).getTime();
        comparacion = fechaA < fechaB ? -1 : (fechaA > fechaB ? 1 : 0);
      } else {
        comparacion = a.valorPago - b.valorPago;
      }

      return this.ordenarDireccion === 'asc' ? comparacion : -comparacion;
    });

    return resultado;
  }

  // Búsqueda inteligente de fechas
  coincideBusquedaFecha(fechaPago: Date, busqueda: string): boolean {
    const fecha = new Date(fechaPago);
    const mes = fecha.getMonth();
    const year = fecha.getFullYear();
    const busquedaNorm = normalizeSearchText(busqueda);

    const mesesCompletos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mesesCortos = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                         'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // Búsqueda simple: mes completo o abreviado
    const mesNombre = mesesCompletos[mes];
    const mesCorto = mesesCortos[mes];
    if (busquedaNorm === mesNombre || busquedaNorm === mesCorto) {
      return true;
    }

    // Búsqueda con año: "diciembre 2024"
    if (busquedaNorm.includes(' ')) {
      const partes = busquedaNorm.split(' ');
      if (partes.length === 2) {
        const mesBusqueda = partes[0];
        const yearBusqueda = parseInt(partes[1], 10);
        if ((mesBusqueda === mesNombre || mesBusqueda === mesCorto) && year === yearBusqueda) {
          return true;
        }
      }
    }

    // Formato ISO: "2024-12"
    if (busquedaNorm.match(/^\d{4}-\d{1,2}$/)) {
      const [yearStr, mesStr] = busquedaNorm.split('-');
      const yearBusqueda = parseInt(yearStr, 10);
      const mesBusqueda = parseInt(mesStr, 10) - 1;
      if (year === yearBusqueda && mes === mesBusqueda) {
        return true;
      }
    }

    // Rango de meses: "ene-mar"
    if (busquedaNorm.includes('-') && !busquedaNorm.match(/^\d{4}-\d{1,2}$/)) {
      const partes = busquedaNorm.split('-');
      if (partes.length === 2) {
        const mesInicio = mesesCortos.indexOf(partes[0].trim()) !== -1
          ? mesesCortos.indexOf(partes[0].trim())
          : mesesCompletos.indexOf(partes[0].trim());

        const mesFin = mesesCortos.indexOf(partes[1].trim()) !== -1
          ? mesesCortos.indexOf(partes[1].trim())
          : mesesCompletos.indexOf(partes[1].trim());

        if (mesInicio !== -1 && mesFin !== -1) {
          if (mesInicio <= mesFin) {
            return mes >= mesInicio && mes <= mesFin;
          } else {
            return mes >= mesInicio || mes <= mesFin;
          }
        }
      }
    }

    return false;
  }

  aplicarFiltros(): void {
    // Disparado por ngModelChange
  }

  cambiarOrdenamiento(campo: 'fecha' | 'valor'): void {
    if (this.ordenarPor === campo) {
      this.ordenarDireccion = this.ordenarDireccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenarPor = campo;
      this.ordenarDireccion = 'asc';
    }
  }

  limpiarFiltros(): void {
    this.tarjetaFiltro = 0;
    this.busquedaFecha = '';
  }

  toggleSection(section: string): void {
    switch(section) {
      case 'balance':
        this.showBalance = !this.showBalance;
        break;
      case 'keyMonths':
        this.showKeyMonths = !this.showKeyMonths;
        break;
      case 'allMonths':
        this.showAllMonths = !this.showAllMonths;
        break;
    }
  }

  getNombreMes(offset: number): string {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + offset);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
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
        }
      });
  }

  obtenerTarjeta(id: number): string {
    return this.sharedListasService.getNombreTarjetaById(id) || 'N/A';
  }

  esPagoActual(fechaPago: Date): boolean {
    const fecha = new Date(fechaPago);
    const fechaActual = new Date();

    if (!fechaPago) return false;

    return (
      fecha.getMonth() === fechaActual.getMonth() &&
      fecha.getFullYear() === fechaActual.getFullYear()
    );
  }

  detallePagosMesTarjeta(idTarjeta: number, mes: Date): void {
    const fecha: Date = new Date(mes);
    const mesObtenido = fecha.getMonth() + 1;
    const yearObtenido = fecha.getFullYear();

    this.route.navigate(['/pagos-mes', idTarjeta], { queryParams: { mes: mesObtenido, year: yearObtenido } });
  }
}
