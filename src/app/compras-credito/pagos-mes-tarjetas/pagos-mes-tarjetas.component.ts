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

  constructor(private apiService: ApiServicesService, private route: Router) { }
  ngOnInit(): void {
    this.loadTarjetas()
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
      },
      error: (err) => {
        console.error('Error fetching credit cards:', err);
      }
  })


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
