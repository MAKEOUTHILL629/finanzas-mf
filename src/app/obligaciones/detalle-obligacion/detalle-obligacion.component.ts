import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AporteDetalle, AporteDiaConDetalle, ResumenObligacionMes } from '../../modelos/erp';
import { Persona } from '../../modelos/persona';
import { ModalService } from '../../services/modal.service';
import { ObligacionesMesService } from '../../services/obligaciones-mes.service';
import { PersonasService } from '../../services/personas.service';
import { porcentajeAvance } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { etiquetaTipoObligacion, iconoTipoObligacion } from '../obligaciones.constants';

export const MODAL_APORTES = 'aportes-form';

@Component({
  selector: 'app-detalle-obligacion',
  templateUrl: './detalle-obligacion.component.html',
  styleUrl: './detalle-obligacion.component.css'
})
export class DetalleObligacionComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_APORTES;
  readonly etiquetaTipo = etiquetaTipoObligacion;
  readonly iconoTipo = iconoTipoObligacion;
  readonly porcentaje = porcentajeAvance;

  obligacionId = 0;
  resumen: ResumenObligacionMes | null = null;
  dias: AporteDiaConDetalle[] = [];
  personas: Persona[] = [];

  cargando = true;
  error: string | null = null;
  /** Días con el desglose desplegado (aporte_dia_id). */
  private abiertos = new Set<number>();

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private obligacionesService: ObligacionesMesService,
    private personasService: PersonasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.obligacionId = Number(params.get('id'));
      if (!Number.isInteger(this.obligacionId) || this.obligacionId <= 0) {
        this.cargando = false;
        this.error = 'La obligación indicada no es válida.';
        return;
      }
      this.cargar();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    forkJoin({
      resumen: this.obligacionesService.getResumen(this.obligacionId),
      dias: this.obligacionesService.getAportesDia(this.obligacionId),
      personas: this.personasService.getPersonas(),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ resumen, dias, personas }) => {
          this.resumen = resumen;
          this.dias = dias;
          this.personas = personas;
        },
        error: (err) => {
          this.resumen = null;
          this.error = err?.status === 404 ? 'No encontramos esa obligación.' : mensajeDeError(err, 'No se pudo cargar la obligación.');
        }
      });
  }

  volver(): void {
    void this.router.navigate(['/obligaciones']);
  }

  abrirFormulario(): void {
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onRegistrado(dia: AporteDiaConDetalle): void {
    this.modalService.close();
    const n = dia.detalles?.length ?? 0;
    const prestamos = (dia.detalles ?? []).filter((d) => d.prestamo_cruce_generado_id).length;
    this.toast.exito(
      prestamos > 0
        ? `Aportes registrados. Se generaron ${prestamos} ${prestamos === 1 ? 'préstamo por cobrar' : 'préstamos por cobrar'}.`
        : `Aportes registrados${n ? ` (${n} en el día)` : ''}.`
    );
    this.cargar();
  }

  alternarDia(dia: AporteDiaConDetalle): void {
    if (this.abiertos.has(dia.aporte_dia_id)) this.abiertos.delete(dia.aporte_dia_id);
    else this.abiertos.add(dia.aporte_dia_id);
  }

  estaAbierto(dia: AporteDiaConDetalle): boolean {
    return this.abiertos.has(dia.aporte_dia_id);
  }

  esCompletada(): boolean {
    return this.resumen?.estado_calculado === 'COMPLETADO';
  }

  nombrePeriodo(p: string | null): string {
    return nombrePeriodo(p);
  }

  nombreAportante(d: AporteDetalle): string {
    return d.persona?.nombre || `Persona #${d.persona_id}`;
  }

  trackByDia(_: number, d: AporteDiaConDetalle): number {
    return d.aporte_dia_id;
  }

  trackByDetalle(_: number, d: AporteDetalle): number {
    return d.id;
  }
}
