import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CruceDeuda } from '../../modelos/erp';
import { ItemPersona } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';
import { LedgerDeudasService } from '../../services/ledger-deudas.service';
import { ModalService } from '../../services/modal.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { normalizeSearchText } from '../../shared/utils';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';
import { ColumnaTabla } from '../../shared/ui/apple-table/apple-table.types';
import { EstadoFiltros, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';

export const MODAL_CRUCE = 'cruce-form';

@Component({
  selector: 'app-lista-cruces',
  templateUrl: './lista-cruces.component.html',
  styleUrl: './lista-cruces.component.css'
})
export class ListaCrucesComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_CRUCE;

  cruces: CruceDeuda[] = [];
  /** Lo que queda tras el buscador. */
  visibles: CruceDeuda[] = [];
  estadoFiltros: EstadoFiltros = estadoVacio();

  readonly principal: AccionUI = { id: 'nuevo', etiqueta: 'Nuevo cruce', icono: 'add', tooltip: 'Registrar que una persona pagó la deuda de otra' };

  readonly columnas: ColumnaTabla<CruceDeuda>[] = [
    { id: 'fecha', titulo: 'Fecha', valor: (c) => c.fecha_cruce, formato: 'fechaCorta', prioridad: 1, anchoMin: 110 },
    { id: 'abona', titulo: 'Quien abona', valor: (c) => this.nombre(c, 'abona'), prioridad: 2, anchoMin: 140 },
    { id: 'asume', titulo: 'Quien asume la deuda', valor: (c) => this.nombre(c, 'asume'), prioridad: 2, anchoMin: 160 },
    { id: 'concepto', titulo: 'Concepto', valor: (c) => c.concepto, prioridad: 1, anchoMin: 200 },
    { id: 'destino', titulo: 'Aplicado a', valor: (c) => this.destino(c), prioridad: 3, anchoMin: 140 },
    { id: 'monto', titulo: 'Monto', valor: (c) => c.monto, formato: 'moneda', prioridad: 1, anchoMin: 120 },
  ];
  personas: ItemPersona[] = [];
  /** El formulario existe solo mientras el modal está abierto. */
  formularioAbierto = false;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private ledgerService: LedgerDeudasService,
    private catalogos: CatalogosService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.formularioAbierto = false;
    });
    // Nombres de las personas (y las del formulario): catálogo compartido; si falla, la lista de cruces se muestra igual.
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.personas = e.datos;
      this.aplicar();
    });
    this.catalogos.asegurar(['personas']);
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.ledgerService
      .getCrucesDeuda()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (cruces) => {
          this.cruces = cruces;
          this.aplicar();
        },
        error: (err) => {
          this.cruces = [];
          this.aplicar();
          this.error = mensajeDeError(err, 'No se pudieron cargar los cruces de deuda.');
        }
      });
  }

  alAccionar(id: string): void {
    if (id === 'nuevo') this.nuevo();
  }

  alFiltrar(estado: EstadoFiltros): void {
    this.estadoFiltros = estado;
    this.aplicar();
  }

  /** Busca por concepto, comentario, personas, destino o monto (sin tildes; todas las palabras). */
  private aplicar(): void {
    const palabras = normalizeSearchText(this.estadoFiltros.busqueda ?? '').split(/\s+/).filter(Boolean);
    this.visibles =
      palabras.length === 0
        ? this.cruces
        : this.cruces.filter((c) => {
            const texto = normalizeSearchText([c.concepto, c.comentarios, this.nombre(c, 'abona'), this.nombre(c, 'asume'), this.destino(c), c.monto].join(' '));
            return palabras.every((p) => texto.includes(p));
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
}
