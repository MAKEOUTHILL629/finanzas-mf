import { Component, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { PagoMensualPersonaDetalle } from '../../modelos/pagos';
import { ApiServicesService } from '../../servicios/api-services.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedListasService } from '../../services/shared-listas.service';
import { Persona } from '../../modelos/persona';


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
export class PagoPersonaMesDetalleComponent  implements OnInit {
  pagosMensualesPersonaDetalle: PagoMensualPersonaDetalle[] = [];
  persona?: Persona;
  fechaPago: Date = new Date();
  idPersona: number = 0;
  mes: number = 0;
  year: number = 0;
  sortColumn: keyof PagoMensualPersonaDetalle | null = null;

  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private apiService: ApiServicesService, private route: ActivatedRoute, private sharedListas: SharedListasService, private router:Router ) {}
  ngOnInit(): void {

    this.loadPagosMensualesPersonaDetalle();
  }

  loadPagosMensualesPersonaDetalle() {

    this.idPersona = Number(this.route.snapshot.paramMap.get('id')) || 1;

    this.route.queryParamMap.subscribe(params => {
      this.mes = Number(params.get('mes')) || 1;
      this.year = Number(params.get('year')) || 2021;
    });



    this.apiService.get<PagoMensualPersonaDetalle[]>(`pagos/personas/${this.idPersona}?mes=${this.mes}&year=${this.year}`).subscribe(
      (pagosProductosDetalleMes) => {
        console.log("SE CARGARON LOS PAGOS DETALLE")
        console.log(pagosProductosDetalleMes)
        this.pagosMensualesPersonaDetalle = pagosProductosDetalleMes;
        this.persona = this.sharedListas.listaPersonas.find(persona => persona.id === this.idPersona);
        this.fechaPago = pagosProductosDetalleMes[0].fechaPago;
      },
      (error) => console.error('Error cargando pagos', error)
    );
  }

  get sortedData(): PagoMensualPersonaDetalle[] {
    if (!this.sortColumn) {
      // Si no se ha hecho clic en ninguna columna todavía, retorna los datos en su orden original
      return this.pagosMensualesPersonaDetalle;
    }

    return [...this.pagosMensualesPersonaDetalle].sort((a, b) => {
      let valA: any = a[this.sortColumn!];
      let valB: any = b[this.sortColumn!];

      // Si la columna es fecha, comparamos timestamps
      if (this.sortColumn === 'fechaPago') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      // Comparación genérica (números o strings)
      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
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
    // Creamos un Map para ir sumando por cada tarjeta
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
      resumen.totalResponsable += item.valorPagoResponsable;
      resumen.totalInteres += item.interesPagado;
      resumen.totalCapital += item.aporteCapital;
      resumen.totalSaldo += item.saldoRestante;
    }

    return Array.from(map.values());
  }

  /**
   * Resumen: Totales Generales sumando TODAS las tarjetas
   */
  get resumenGeneral(): ResumenTarjeta {
    return this.resumenPorTarjeta.reduce<ResumenTarjeta>((acc, curr) => {
      acc.totalResponsable += curr.totalResponsable;
      acc.totalInteres += curr.totalInteres;
      acc.totalCapital += curr.totalCapital;
      acc.totalSaldo += curr.totalSaldo;
      return acc;
    }, {
      tarjeta: 0,
      totalResponsable: 0,
      totalInteres: 0,
      totalCapital: 0,
      totalSaldo: 0
    });
  }

  irDetalleCompra(compra: number): void {
      this.router.navigate(['/compra-credito-detalle', compra], {
        state: { compra: compra },
      });
    }
}
