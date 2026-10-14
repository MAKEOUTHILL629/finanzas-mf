import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { iniciales } from '../../deudas/deudas.constants';
import { FiltroRecurrentesPersona, ModalidadDuracion, RecurrentePersona } from '../../modelos/aportes';
import { Persona } from '../../modelos/persona';
import { ModalService } from '../../services/modal.service';
import { PersonasService } from '../../services/personas.service';
import { RecurrentesPersonaService } from '../../services/recurrentes-persona.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
import { nombrePeriodo } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import {
  ETIQUETA_ESTADO_VISUAL,
  estadoVisual,
  etiquetaNaturaleza,
  etiquetaNaturalezaCorta,
  filtrarRecurrentes,
  textoProgreso,
  totalMensual,
} from '../recurrentes-persona.constants';

export const MODAL_RECURRENTE_PERSONA = 'recurrente-persona-form';

@Component({
  selector: 'app-lista-recurrentes-persona',
  templateUrl: './lista-recurrentes-persona.component.html',
  styleUrl: './lista-recurrentes-persona.component.css'
})
export class ListaRecurrentesPersonaComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_RECURRENTE_PERSONA;
  readonly etiquetaNaturaleza = etiquetaNaturaleza;
  readonly etiquetaCorta = etiquetaNaturalezaCorta;
  readonly textoProgreso = textoProgreso;
  readonly estadoVisual = estadoVisual;
  readonly etiquetaEstado = ETIQUETA_ESTADO_VISUAL;
  readonly nombrePeriodo = nombrePeriodo;
  readonly iniciales = iniciales;

  recurrentes: RecurrentePersona[] = [];
  personas: Persona[] = [];
  filtros: FiltroRecurrentesPersona = { personaId: null, activo: null, modalidadDuracion: null };

  cargando = true;
  error: string | null = null;

  /** `null` con el formulario abierto = alta; con valor = edición. */
  formularioAbierto = false;
  enEdicion: RecurrentePersona | null = null;
  eliminando: RecurrentePersona | null = null;
  trabajando = false;

  private destroy$ = new Subject<void>();

  constructor(
    private recurrentesService: RecurrentesPersonaService,
    private personasService: PersonasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) {
        this.formularioAbierto = false;
        this.enEdicion = null;
      }
    });
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    forkJoin({ recurrentes: this.recurrentesService.getRecurrentes(), personas: this.personasService.getPersonas() })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ recurrentes, personas }) => {
          this.recurrentes = recurrentes;
          this.personas = personas;
        },
        error: (err) => {
          this.recurrentes = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar los recurrentes.');
        }
      });
  }

  get visibles(): RecurrentePersona[] {
    return filtrarRecurrentes(this.recurrentes, this.filtros);
  }

  get totales(): { cobros: number; favores: number } {
    return totalMensual(this.recurrentes);
  }

  get hayFiltros(): boolean {
    return this.filtros.personaId !== null || this.filtros.activo !== null || this.filtros.modalidadDuracion !== null;
  }

  cambiarFiltro<K extends keyof FiltroRecurrentesPersona>(clave: K, valor: FiltroRecurrentesPersona[K]): void {
    this.filtros = { ...this.filtros, [clave]: valor === ('' as unknown) ? null : valor };
  }

  reiniciarFiltros(): void {
    this.filtros = { personaId: null, activo: null, modalidadDuracion: null };
  }

  modalidades: Array<{ valor: ModalidadDuracion; etiqueta: string }> = [
    { valor: 'INDEFINIDO', etiqueta: 'De por vida' },
    { valor: 'PLAZO_FIJO', etiqueta: 'Por X meses' },
  ];

  // ── alta / edición ──

  abrirFormulario(r: RecurrentePersona | null = null): void {
    this.enEdicion = r;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onGuardado(r: RecurrentePersona): void {
    const edito = !!this.enEdicion;
    this.modalService.close();
    this.toast.exito(`${edito ? 'Recurrente actualizado' : 'Recurrente creado'}: ${r.concepto} · ${moneda(r.valorMensual)} al mes.`);
    this.cargar();
  }

  // ── pausar / activar ──

  alternarActivo(r: RecurrentePersona): void {
    this.trabajando = true;
    this.recurrentesService
      .actualizar(r.id, { activo: !r.activo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (nuevo) => {
          this.toast.exito(nuevo.activo ? `«${nuevo.concepto}» reactivado.` : `«${nuevo.concepto}» en pausa: no se cobrarán los meses futuros.`);
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo cambiar el estado.'))
      });
  }

  // ── eliminar ──

  pedirEliminar(r: RecurrentePersona): void {
    this.eliminando = r;
  }

  cancelarEliminar(): void {
    this.eliminando = null;
  }

  confirmarEliminar(): void {
    const r = this.eliminando;
    if (!r) return;
    this.trabajando = true;
    this.recurrentesService
      .eliminar(r.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (res) => {
          this.eliminando = null;
          this.toast.exito(`«${r.concepto}» eliminado${res.movimientosAnulados ? ` · ${res.movimientosAnulados} cargo(s) anulado(s) del estado de cuenta` : ''}.`);
          this.cargar();
        },
        error: (err) => {
          this.eliminando = null;
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar.'));
        }
      });
  }

  trackById(_: number, r: RecurrentePersona): number {
    return r.id;
  }
}
