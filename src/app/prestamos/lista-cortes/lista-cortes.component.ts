import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro, EstadoCorte, PrestamoDetalle } from '../../modelos/cobros';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { ModalService } from '../../services/modal.service';
import { PrestamosService } from '../../services/prestamos.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { claseEstadoCorte, estaPendiente, etiquetaEstadoCorte, saldoDe } from '../prestamos.constants';

export const MODAL_CORTE = 'corte-form';

export interface EstadisticaCorte {
  prestamos: number;
  pendientes: number;
  saldoPorCobrar: number;
}

/** Préstamos y saldo por cobrar de cada corte (id → estadística). Los préstamos por pagar no cuentan como saldo por cobrar. */
export function estadisticasPorCorte(prestamos: PrestamoDetalle[]): Map<number, EstadisticaCorte> {
  const mapa = new Map<number, EstadisticaCorte>();
  const porCorte = new Map<number, PrestamoDetalle[]>();
  for (const p of prestamos) {
    if (p.corteId === null || p.corteId === undefined) continue;
    porCorte.set(p.corteId, [...(porCorte.get(p.corteId) ?? []), p]);
  }
  for (const [id, lista] of porCorte) {
    const pendientes = lista.filter((p) => estaPendiente(p));
    mapa.set(id, {
      prestamos: lista.length,
      pendientes: pendientes.length,
      saldoPorCobrar: sumarMonedas(pendientes.filter((p) => p.direccionPrestamo !== 'POR_PAGAR').map((p) => saldoDe(p))),
    });
  }
  return mapa;
}

@Component({
  selector: 'app-lista-cortes',
  templateUrl: './lista-cortes.component.html',
  styleUrl: './lista-cortes.component.css'
})
export class ListaCortesComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_CORTE;
  readonly claseEstado = claseEstadoCorte;
  readonly etiquetaEstado = etiquetaEstadoCorte;
  readonly filtros: ReadonlyArray<{ valor: '' | EstadoCorte; etiqueta: string }> = [
    { valor: '', etiqueta: 'Todos' },
    { valor: 'ACTIVO', etiqueta: 'Activos' },
    { valor: 'FUTURO', etiqueta: 'Futuros' },
    { valor: 'PASADO', etiqueta: 'Pasados' },
  ];

  cortes: CorteCobro[] = [];
  estadisticas = new Map<number, EstadisticaCorte>();
  filtro: '' | EstadoCorte = '';

  /** Corte que se edita (null = alta). El formulario existe solo mientras el modal está abierto. */
  formularioAbierto = false;
  corteEditando: CorteCobro | null = null;
  /** Corte que espera confirmación de borrado. */
  confirmandoBorrado: CorteCobro | null = null;
  borrando = false;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private cortesService: CortesCobroService,
    private prestamosService: PrestamosService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) {
        this.formularioAbierto = false;
        this.corteEditando = null;
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
    forkJoin({
      cortes: this.cortesService.getCortes(),
      // las estadísticas son un complemento: si fallan, la lista de cortes igual se muestra
      prestamos: this.prestamosService.getPrestamos().pipe(catchError(() => of([] as PrestamoDetalle[]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ cortes, prestamos }) => {
          this.cortes = cortes;
          this.estadisticas = estadisticasPorCorte(prestamos);
        },
        error: (err) => {
          this.cortes = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar los cortes.');
        }
      });
  }

  get visibles(): CorteCobro[] {
    return this.filtro ? this.cortes.filter((c) => c.estado === this.filtro) : this.cortes;
  }

  cantidad(estado: '' | EstadoCorte): number {
    return estado ? this.cortes.filter((c) => c.estado === estado).length : this.cortes.length;
  }

  estadistica(c: CorteCobro): EstadisticaCorte {
    return this.estadisticas.get(c.id) ?? { prestamos: 0, pendientes: 0, saldoPorCobrar: 0 };
  }

  // ── alta / edición ──

  nuevo(): void {
    this.corteEditando = null;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  editar(c: CorteCobro): void {
    this.corteEditando = c;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onGuardado(): void {
    const eraEdicion = !!this.corteEditando;
    this.modalService.close();
    this.toast.exito(eraEdicion ? 'Corte actualizado.' : 'Corte creado.');
    this.cargar();
  }

  // ── borrado ──

  pedirBorrado(c: CorteCobro): void {
    this.confirmandoBorrado = c;
  }

  cancelarBorrado(): void {
    this.confirmandoBorrado = null;
  }

  confirmarBorrado(): void {
    const corte = this.confirmandoBorrado;
    if (!corte) return;
    this.borrando = true;
    this.cortesService
      .eliminarCorte(corte.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.borrando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoBorrado = null;
          this.toast.exito('Corte eliminado.');
          this.cargar();
        },
        error: (err) => {
          this.confirmandoBorrado = null;
          // 409: el corte tiene préstamos; el mensaje del backend ya lo explica
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar el corte.'));
        }
      });
  }

  trackById(_: number, c: CorteCobro): number {
    return c.id;
  }
}
