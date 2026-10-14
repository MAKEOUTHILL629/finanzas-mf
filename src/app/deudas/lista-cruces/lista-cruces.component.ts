import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CruceDeuda } from '../../modelos/erp';
import { Persona } from '../../modelos/persona';
import { LedgerDeudasService } from '../../services/ledger-deudas.service';
import { ModalService } from '../../services/modal.service';
import { PersonasService } from '../../services/personas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';

export const MODAL_CRUCE = 'cruce-form';

@Component({
  selector: 'app-lista-cruces',
  templateUrl: './lista-cruces.component.html',
  styleUrl: './lista-cruces.component.css'
})
export class ListaCrucesComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_CRUCE;

  cruces: CruceDeuda[] = [];
  personas: Persona[] = [];
  /** El formulario existe solo mientras el modal está abierto. */
  formularioAbierto = false;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private ledgerService: LedgerDeudasService,
    private personasService: PersonasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.formularioAbierto = false;
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
    forkJoin({
      cruces: this.ledgerService.getCrucesDeuda(),
      personas: this.personasService.getPersonas().pipe(catchError(() => of([] as Persona[]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ cruces, personas }) => {
          this.cruces = cruces;
          this.personas = personas;
        },
        error: (err) => {
          this.cruces = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar los cruces de deuda.');
        }
      });
  }

  nuevo(): void {
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onCreado(): void {
    this.modalService.close();
    this.toast.exito('Cruce de deuda registrado.');
    this.cargar();
  }

  nombre(c: CruceDeuda, lado: 'abona' | 'asume'): string {
    const embebida = lado === 'abona' ? c.persona_que_abona : c.persona_que_asume;
    const id = lado === 'abona' ? c.persona_que_abona_id : c.persona_que_asume_deuda_id;
    return embebida?.nombre ?? this.personas.find((p) => p.id === id)?.nombre ?? `Persona #${id}`;
  }

  destino(c: CruceDeuda): string {
    if (c.prestamo_destino_id) return `Préstamo #${c.prestamo_destino_id}`;
    if (c.periodo_recurrente_destino_id) return `Gasto recurrente #${c.periodo_recurrente_destino_id}`;
    return '—';
  }

  trackById(_: number, c: CruceDeuda): number {
    return c.id;
  }
}
