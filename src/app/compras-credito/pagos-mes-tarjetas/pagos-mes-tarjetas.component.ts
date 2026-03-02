import { Component, OnInit } from '@angular/core';
import { ApiServicesService } from '../../servicios/api-services.service';
import { MesPagoTarjeta } from '../../modelos/compras-credito';
import { Tarjeta } from '../../modelos/tarjeta';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pagos-mes-tarjetas',
  templateUrl: './pagos-mes-tarjetas.component.html',
  styleUrl: './pagos-mes-tarjetas.component.css'
})
export class PagosMesTarjetasComponent implements OnInit{
  mesPagoTarjetas: MesPagoTarjeta[] = [];
  tarjetas: Tarjeta[] = [];

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
  ordenarDireccion: 'asc' | 'desc' = 'asc';

  constructor(private apiService: ApiServicesService, private route: Router) { }

  ngOnInit(): void {
    this.loadTarjetas();
    this.apiService.get<MesPagoTarjeta[]>('tarjetas/pagos').subscribe({
      next: (data) => {
        this.mesPagoTarjetas = data;

        //Ahora necesito ordenar los pagos por fecha, desde la menor a la mayor, sin usar la funcion getTime()
        this.mesPagoTarjetas.sort((a, b) => {
          const fechaA = new Date(a.fechaPago);
          const fechaB = new Date(b.fechaPago);
          if (fechaA < fechaB) {
            return -1;
          }
          if (fechaA > fechaB) {
            return 1;
          }
          return 0;
        });
        console.log('Pagos mes tarjetas:', this.mesPagoTarjetas);
        console.log(this.mesPagoTarjetas);

        // Calcular datos de los 3 meses clave
        this.calcularTresMesesClave();
      },
      error: (err) => {
        console.error('Error fetching credit cards:', err);
      }
    });
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

    // Filtrar por búsqueda inteligente de fecha
    if (this.busquedaFecha && this.busquedaFecha.trim() !== '') {
      resultado = resultado.filter(pago => {
        return this.coincideBusquedaFecha(pago.fechaPago, this.busquedaFecha.trim());
      });
    }

    // Ordenar
    resultado.sort((a, b) => {
      let comparacion = 0;

      if (this.ordenarPor === 'fecha') {
        const fechaA = new Date(a.fechaPago);
        const fechaB = new Date(b.fechaPago);
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
    const busquedaLower = busqueda.toLowerCase();

    const mesesCompletos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mesesCortos = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                         'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // Búsqueda simple: mes completo o abreviado
    const mesNombre = mesesCompletos[mes];
    const mesCorto = mesesCortos[mes];
    if (busquedaLower === mesNombre || busquedaLower === mesCorto) {
      return true;
    }

    // Búsqueda con año: "diciembre 2024"
    if (busquedaLower.includes(' ')) {
      const partes = busquedaLower.split(' ');
      if (partes.length === 2) {
        const mesBusqueda = partes[0];
        const yearBusqueda = parseInt(partes[1]);
        if ((mesBusqueda === mesNombre || mesBusqueda === mesCorto) && year === yearBusqueda) {
          return true;
        }
      }
    }

    // Formato ISO: "2024-12"
    if (busquedaLower.match(/^\d{4}-\d{1,2}$/)) {
      const [yearStr, mesStr] = busquedaLower.split('-');
      const yearBusqueda = parseInt(yearStr);
      const mesBusqueda = parseInt(mesStr) - 1;
      if (year === yearBusqueda && mes === mesBusqueda) {
        return true;
      }
    }

    // Rango de meses: "ene-mar"
    if (busquedaLower.includes('-') && !busquedaLower.match(/^\d{4}-\d{1,2}$/)) {
      const partes = busquedaLower.split('-');
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
    // Método llamado por ngModelChange
  }

  // Cambiar ordenamiento
  cambiarOrdenamiento(campo: 'fecha' | 'valor'): void {
    if (this.ordenarPor === campo) {
      this.ordenarDireccion = this.ordenarDireccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenarPor = campo;
      this.ordenarDireccion = 'asc';
    }
  }

  // Limpiar filtros
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
    this.apiService.get<Tarjeta[]>('tarjetas').subscribe({
      next: (data) => {
        this.tarjetas = data;
      },
      error: (err) => {
        console.error('Error fetching credit cards:', err);
      }
    });
  }

  obtenerTarjeta(id: number): string {
    const tarjeta = this.tarjetas.find(tarjeta => tarjeta.id === id);
    return tarjeta?.franquicia ? tarjeta.franquicia : 'N/A';
  }

  esPagoActual(fechaPago: Date): boolean {
    fechaPago = new Date(fechaPago);
    const fechaActual = new Date();

    if(fechaPago === undefined || !fechaPago) return false;

    return (
      fechaPago.getMonth() === fechaActual.getMonth() &&
      fechaPago.getFullYear() === fechaActual.getFullYear()
    );
  }

  detallePagosMesTarjeta(idTarjeta: number, mes: Date) {
    const fecha : Date  = new Date(mes);
    const mesObtenido = fecha.getMonth() + 1;
    const yearObtenido = fecha.getFullYear();

    this.route.navigate(['/pagos-mes', idTarjeta], { queryParams: { mes:mesObtenido, year: yearObtenido } });
  }

}
