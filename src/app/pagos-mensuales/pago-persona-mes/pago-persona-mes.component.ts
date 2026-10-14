import { Component, OnInit, OnDestroy } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../services/api-services.service';
import { SharedListasService } from '../../services/shared-listas.service';
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
export class PagoPersonaMesComponent implements OnInit, OnDestroy {
  personasConPagos: PersonaConPagos[] = [];
  mesActual: number = 0;
  yearActual: number = new Date().getFullYear();

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiServicesService,
    private sharedListasService: SharedListasService,
    private route: Router
  ) {}

  ngOnInit(): void {
    const fechaActual = new Date();
    this.mesActual = fechaActual.getMonth();
    this.yearActual = fechaActual.getFullYear();
    this.loadPagosPersonasMensual();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleExpandir(persona: PersonaConPagos): void {
    persona.expandido = !persona.expandido;
  }

  esMesActual(fechaPago: Date): boolean {
    if (!fechaPago) return false;
    const date = new Date(fechaPago);
    return date.getMonth() === this.mesActual && date.getFullYear() === this.yearActual;
  }

  loadPagosPersonasMensual(): void {
    forkJoin({
      personas: this.apiService.get<Persona[]>('personas'),
      pagos: this.apiService.get<PagoMensualPersona[]>('pagos/personas')
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ personas, pagos }) => {
        const personasList = personas || [];
        const pagosList = pagos || [];

        if (this.sharedListasService.listaPersonas.length === 0 && personasList.length > 0) {
          this.sharedListasService.listaPersonas = personasList;
        }

        this.personasConPagos = personasList.map((persona) => ({
          ...persona,
          pagos: pagosList.filter((pago) => pago.persona === persona.id),
          expandido: false,
        }));
      },
      error: (error) => { void error; }
    });
  }

  detallePagosMesPersona(idPersona: number, mes: Date): void {
    const fecha: Date = new Date(mes);
    const mesObtenido = fecha.getMonth() + 1;
    const yearObtenido = fecha.getFullYear();

    this.route.navigate(['/pagos-mes-personas-detalle', idPersona], {
      queryParams: { mes: mesObtenido, year: yearObtenido }
    });
  }
}
