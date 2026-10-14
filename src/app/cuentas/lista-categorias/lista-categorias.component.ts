import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { Categoria, TipoCategoria } from '../../modelos/erp';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { ModalService } from '../../services/modal.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { CATEGORIAS_SUGERIDAS, TIPOS_CATEGORIA } from '../cuentas.constants';

export const MODAL_CATEGORIA = 'categoria-form';

export interface GrupoCategorias {
  tipo: TipoCategoria;
  etiqueta: string;
  icono: string;
  categorias: Categoria[];
}

/** Agrupa por tipo (egresos, ingresos, ambos), cada grupo ordenado por nombre; omite los grupos vacíos. */
export function agruparCategorias(categorias: Categoria[]): GrupoCategorias[] {
  return TIPOS_CATEGORIA.map((t) => ({
    tipo: t.valor,
    etiqueta: t.etiqueta,
    icono: t.icono,
    categorias: categorias.filter((c) => c.tipo === t.valor).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  })).filter((g) => g.categorias.length > 0);
}

@Component({
  selector: 'app-lista-categorias',
  templateUrl: './lista-categorias.component.html',
  styleUrl: './lista-categorias.component.css'
})
export class ListaCategoriasComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_CATEGORIA;
  readonly sugeridas = CATEGORIAS_SUGERIDAS;

  categorias: Categoria[] = [];
  grupos: GrupoCategorias[] = [];

  formularioAbierto = false;
  categoriaEditando: Categoria | null = null;
  confirmandoBorrado: Categoria | null = null;
  confirmandoSugeridas = false;
  trabajando = false;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private cuentasService: CuentasFinancierasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) {
        this.formularioAbierto = false;
        this.categoriaEditando = null;
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
    this.cuentasService
      .getCategorias()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (c) => {
          this.categorias = c;
          this.grupos = agruparCategorias(c);
        },
        error: (err) => {
          this.categorias = [];
          this.grupos = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar las categorías.');
        }
      });
  }

  esDelSistema(c: Categoria): boolean {
    return c.owner_user_id === null;
  }

  // ── alta / edición ──

  nueva(): void {
    this.categoriaEditando = null;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  editar(c: Categoria): void {
    this.categoriaEditando = c;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onGuardada(): void {
    const eraEdicion = !!this.categoriaEditando;
    this.modalService.close();
    this.toast.exito(eraEdicion ? 'Categoría actualizada.' : 'Categoría creada.');
    this.cargar();
  }

  // ── borrado ──

  pedirBorrado(c: Categoria): void {
    this.confirmandoBorrado = c;
  }

  cancelarBorrado(): void {
    this.confirmandoBorrado = null;
  }

  confirmarBorrado(): void {
    const c = this.confirmandoBorrado;
    if (!c) return;
    this.trabajando = true;
    this.cuentasService
      .eliminarCategoria(c.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoBorrado = null;
          this.toast.exito('Categoría eliminada.');
          this.cargar();
        },
        error: (err) => {
          this.confirmandoBorrado = null;
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar la categoría.'));
        }
      });
  }

  // ── categorías sugeridas (solo tras confirmar) ──

  pedirSugeridas(): void {
    this.confirmandoSugeridas = true;
  }

  cancelarSugeridas(): void {
    this.confirmandoSugeridas = false;
  }

  crearSugeridas(): void {
    this.trabajando = true;
    const existentes = new Set(this.categorias.map((c) => c.nombre.toLowerCase()));
    const nuevas = this.sugeridas.filter((s) => !existentes.has(s.nombre.toLowerCase()));
    if (nuevas.length === 0) {
      this.trabajando = false;
      this.confirmandoSugeridas = false;
      this.toast.info('Ya tienes todas las categorías sugeridas.');
      return;
    }
    forkJoin(nuevas.map((s) => this.cuentasService.crearCategoria({ nombre: s.nombre, tipo: s.tipo, color: s.color })))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (creadas) => {
          this.confirmandoSugeridas = false;
          this.toast.exito(`${creadas.length} categorías creadas.`);
          this.cargar();
        },
        error: (err) => {
          this.confirmandoSugeridas = false;
          this.toast.error(mensajeDeError(err, 'No se pudieron crear todas las categorías.'));
          this.cargar(); // algunas pudieron crearse antes del fallo
        }
      });
  }

  trackById(_: number, c: Categoria): number {
    return c.id;
  }

  trackByTipo(_: number, g: GrupoCategorias): string {
    return g.tipo;
  }
}
