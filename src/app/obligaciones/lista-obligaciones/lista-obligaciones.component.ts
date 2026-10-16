import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { Periodo, ResumenObligacionMes, TipoObligacionMes } from '../../modelos/erp';
import { ObligacionesMesService } from '../../services/obligaciones-mes.service';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../shared/toast/toast.service';
import { porcentajeAvance, sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { TIPOS_OBLIGACION, etiquetaTipoObligacion, iconoTipoObligacion } from '../obligaciones.constants';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';

export interface GrupoPeriodo {
  periodo: Periodo;
  titulo: string;
  obligaciones: ResumenObligacionMes[];
}

export const MODAL_OBLIGACION = 'obligacion-form';

@Component({
  selector: 'app-lista-obligaciones',
  templateUrl: './lista-obligaciones.component.html',
  styleUrl: './lista-obligaciones.component.css'
})
export class ListaObligacionesComponent implements OnInit, OnDestroy {
  readonly principal: AccionUI = { id: 'nueva', etiqueta: 'Nueva obligación', icono: 'add', tooltip: 'Crear una cuota con meta mensual (carro, casa…)' };

  alAccionar(id: string): void {
    if (id === 'nueva') this.abrirFormulario();
  }

  readonly modalId = MODAL_OBLIGACION;
  readonly tipos = TIPOS_OBLIGACION;
  readonly etiquetaTipo = etiquetaTipoObligacion;
  readonly iconoTipo = iconoTipoObligacion;
  readonly porcentaje = porcentajeAvance;

  /** '' = todos los periodos */
  periodo: Periodo | '' = '';
  tipo: TipoObligacionMes | '' = '';

  obligaciones: ResumenObligacionMes[] = [];
  grupos: GrupoPeriodo[] = [];
  totales = { meta: 0, aportado: 0, restante: 0 };

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private obligacionesService: ObligacionesMesService,
    private modalService: ModalService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.obligacionesService
      .getObligaciones(this.periodo || undefined, this.tipo || undefined)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (filas) => {
          this.obligaciones = filas;
          this.grupos = this.agruparPorPeriodo(filas);
          this.totales = {
            meta: sumarMonedas(filas.map((f) => f.meta_mensual)),
            aportado: sumarMonedas(filas.map((f) => f.aporte_total_real)),
            restante: sumarMonedas(filas.map((f) => f.restante_real)),
          };
        },
        error: (err) => {
          this.obligaciones = [];
          this.grupos = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar las obligaciones.');
        }
      });
  }

  onPeriodoChange(valor: string): void {
    this.periodo = esPeriodoValido(valor) ? valor : '';
    this.cargar();
  }

  onTipoChange(valor: string): void {
    this.tipo = (valor as TipoObligacionMes) || '';
    this.cargar();
  }

  /** Flechas de mes: si estaba en "todos", arranca desde el mes actual. */
  moverPeriodo(delta: number): void {
    this.periodo = desplazarPeriodo(this.periodo || periodoActual(), delta);
    this.cargar();
  }

  verTodos(): void {
    this.periodo = '';
    this.cargar();
  }

  abrirFormulario(): void {
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onCreada(): void {
    this.modalService.close();
    this.toast.exito('Obligación creada.');
    this.cargar();
  }

  abrirDetalle(o: ResumenObligacionMes): void {
    void this.router.navigate(['/obligaciones', o.obligacion_mes_id]);
  }

  nombrePeriodo(p: string | null): string {
    return nombrePeriodo(p);
  }

  esCompletada(o: ResumenObligacionMes): boolean {
    return o.estado_calculado === 'COMPLETADO';
  }

  trackById(_: number, o: ResumenObligacionMes): number {
    return o.obligacion_mes_id;
  }

  trackByPeriodo(_: number, g: GrupoPeriodo): string {
    return g.periodo;
  }

  private agruparPorPeriodo(filas: ResumenObligacionMes[]): GrupoPeriodo[] {
    const mapa = new Map<string, ResumenObligacionMes[]>();
    for (const fila of filas) {
      const clave = fila.periodo ?? 'sin-periodo';
      mapa.set(clave, [...(mapa.get(clave) ?? []), fila]);
    }
    // el backend ya devuelve periodo desc; se conserva ese orden
    return [...mapa.entries()].map(([periodo, obligaciones]) => ({
      periodo,
      titulo: nombrePeriodo(periodo) || 'Sin periodo',
      obligaciones,
    }));
  }
}
