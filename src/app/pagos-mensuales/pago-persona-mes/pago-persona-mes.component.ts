import { Component, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../servicios/api-services.service';
import { PagoMensualPersona } from '../../modelos/pagos';
import { Router } from '@angular/router';


interface PersonaConPagos extends Persona {
  pagos: PagoMensualPersona[];
  expandido: boolean;
}

@Component({
  selector: 'app-pago-persona-mes',
  templateUrl: './pago-persona-mes.component.html',
  styleUrl: './pago-persona-mes.component.css',
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ height: '0', opacity: '0', overflow: 'hidden' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ height: '*', opacity: '1' }))
      ]),
      transition(':leave', [
        style({ height: '*', opacity: '1', overflow: 'hidden' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ height: '0', opacity: '0' }))
      ])
    ])
  ]
})
export class PagoPersonaMesComponent implements OnInit {
  personasConPagos: PersonaConPagos[] = [];
  mesActual: number = 0;
  yearActual: number = new Date().getFullYear();

  constructor(private apiService: ApiServicesService, private route: Router) {}

  ngOnInit() {
    // Obtener el mes actual en formato de texto
    const fechaActual = new Date();
    this.mesActual = fechaActual.getMonth();

    // Datos de ejemplo
    this.loadPagosPersonasMensual();
  }

  toggleExpandir(persona: PersonaConPagos) {
    persona.expandido = !persona.expandido;
  }

  esMesActual(fechaPago: Date): boolean {
    return new Date(fechaPago).getMonth() === this.mesActual  && new Date(fechaPago).getFullYear() === new Date().getFullYear();
  }


  loadPagosPersonasMensual() {
    // Cargar la lista de personas desde tu servicio
    this.apiService.get<Persona[]>(`personas`).subscribe((personas) => {
      this.apiService.get<PagoMensualPersona[]>(`pagos/personas`).subscribe(
        (pagos) => {
          console.log("SE CARGARON LOS PAGOS")
          console.log(pagos)
          this.personasConPagos = personas.map((persona) => {
            return {
              ...persona,
              pagos: pagos.filter((pago) => pago.persona === persona.id),
              expandido: false,
            };
          });
        },
        (error) => console.error('Error cargando personas', error)
      );
    });
  }

  detallePagosMesPersona(idPersona: number, mes: Date) {

    const fecha : Date  = new Date(mes);
    const mesObtenido = fecha.getMonth() + 1;
    const yearObtenido = fecha.getFullYear();

    this.route.navigate(['/pagos-mes-personas-detalle', idPersona], { queryParams: { mes:mesObtenido, year: yearObtenido } });
  }
}
