import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, finalize, takeUntil } from 'rxjs/operators';
import { Categoria, CuentaFinanciera, FiltroTransacciones, Transaccion } from '../../modelos/erp';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { ModalService } from '../../services/modal.service';
import { TransaccionesService } from '../../services/transacciones.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import {
  ESTADOS_TRANSACCION,
  TIPOS_TRANSACCION,
  TotalesTransacciones,
  claseEstadoTransaccion,
  efectoDe,
  etiquetaEstadoTransaccion,
  reglasDeTipo,
  totalesDe,
} from '../transacciones.constants';

export const MODAL_TRANSACCION = 'transaccion-form';
/** El backend admite hasta 500 por página; con un filtro mensual alcanza de sobra. */
export const LIMITE_CONSULTA = 500;
export const TAM_PAGINA = 25;

export interface FiltrosTransaccion {
  /** `YYYY-MM`; vacío = todos los periodos */
  periodo: string;
  tipo: string;
  estado: string;
  cuenta: string;
  categoria: string;
}

/** Traduce los filtros de pantalla a los parámetros del backend (sin enviar los vacíos). */
export function filtroDeConsulta(f: FiltrosTransaccion): FiltroTransacciones {
  return {
    ...(esPeriodoValido(f.periodo) ? { periodo: f.periodo } : {}),
    ...(f.tipo ? { tipo: f.tipo as FiltroTransacciones['tipo'] } : {}),
    ...(f.estado ? { estado: f.estado as FiltroTransacciones['estado'] } : {}),
    ...(f.cuenta ? { cuentaId: Number(f.cuenta) } : {}),
    ...(f.categoria ? { categoriaId: Number(f.categoria) } : {}),
    limit: LIMITE_CONSULTA,
  };
}

@Component({
  selector: 'app-lista-transacciones',
  templateUrl: './lista-transacciones.component.html',
  styleUrl: './lista-transacciones.component.css'
})
export class ListaTransaccionesComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_TRANSACCION;
  readonly tipos = TIPOS_TRANSACCION;
  readonly estados = ESTADOS_TRANSACCION;
  readonly claseEstado = claseEstadoTransaccion;
  readonly etiquetaEstado = etiquetaEstadoTransaccion;
  readonly reglas = reglasDeTipo;
  readonly efecto = efectoDe;
  readonly TAM_PAGINA = TAM_PAGINA;

  private fb = inject(FormBuilder);
  filtros = this.fb.nonNullable.group({ periodo: periodoActual(), tipo: '', estado: '', cuenta: '', categoria: '' });

  items: Transaccion[] = [];
  total = 0;
  totales: TotalesTransacciones = { ingresos: 0, egresos: 0, neto: 0, pendientesRevision: 0 };
  pagina = 0;

  cuentas: CuentaFinanciera[] = [];
  categorias: Categoria[] = [];

  /** Transacción en edición (null = alta). El formulario existe solo mientras el modal está abierto. */
  formularioAbierto = false;
  editando: Transaccion | null = null;
  confirmandoAnular: Transaccion | null = null;
  trabajando = false;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private transaccionesService: TransaccionesService,
    private cuentasService: CuentasFinancierasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) {
        this.formularioAbierto = false;
        this.editando = null;
      }
    });
    // listas para los filtros: si fallan, la pantalla funciona igual (sin esos desplegables)
    forkJoin({
      cuentas: this.cuentasService.getCuentas().pipe(catchError(() => of([] as CuentaFinanciera[]))),
      categorias: this.cuentasService.getCategorias().pipe(catchError(() => of([] as Categoria[]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ cuentas, categorias }) => {
        this.cuentas = cuentas;
        this.categorias = categorias;
      });

    this.filtros.valueChanges.pipe(debounceTime(150), takeUntil(this.destroy$)).subscribe(() => {
      this.pagina = 0;
      this.cargar();
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
    this.transaccionesService
      .getTransacciones(filtroDeConsulta(this.filtros.getRawValue()))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (r) => {
          this.items = r.items;
          this.total = r.total;
          this.totales = totalesDe(r.items);
        },
        error: (err) => {
          this.items = [];
          this.total = 0;
          this.totales = totalesDe([]);
          this.error = mensajeDeError(err, 'No se pudieron cargar las transacciones.');
        }
      });
  }

  // ── periodo ──

  moverPeriodo(delta: number): void {
    const actual = this.filtros.controls.periodo.value;
    this.filtros.controls.periodo.setValue(desplazarPeriodo(esPeriodoValido(actual) ? actual : periodoActual(), delta));
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  get hayFiltros(): boolean {
    const f = this.filtros.getRawValue();
    return !!(f.tipo || f.estado || f.cuenta || f.categoria);
  }

  quitarFiltros(): void {
    this.filtros.patchValue({ tipo: '', estado: '', cuenta: '', categoria: '' });
  }

  // ── paginación en memoria ──

  get filasPagina(): Transaccion[] {
    return this.items.slice(this.pagina * TAM_PAGINA, (this.pagina + 1) * TAM_PAGINA);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.items.length / TAM_PAGINA));
  }

  irPagina(delta: number): void {
    this.pagina = Math.min(this.totalPaginas - 1, Math.max(0, this.pagina + delta));
  }

  get truncado(): boolean {
    return this.total > this.items.length;
  }

  // ── alta / edición ──

  nueva(): void {
    this.editando = null;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  editar(t: Transaccion): void {
    this.editando = t;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onGuardada(): void {
    const eraEdicion = !!this.editando;
    this.modalService.close();
    this.toast.exito(eraEdicion ? 'Transacción actualizada.' : 'Transacción registrada.');
    this.cargar();
  }

  // ── confirmar una pendiente / anular ──

  confirmar(t: Transaccion): void {
    this.trabajando = true;
    this.transaccionesService
      .actualizarTransaccion(t.id, { estado: 'CONFIRMADO' })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.toast.exito('Transacción confirmada: el saldo de la cuenta ya se actualizó.');
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo confirmar la transacción.'))
      });
  }

  pedirAnular(t: Transaccion): void {
    this.confirmandoAnular = t;
  }

  cancelarAnular(): void {
    this.confirmandoAnular = null;
  }

  confirmarAnular(): void {
    const t = this.confirmandoAnular;
    if (!t) return;
    this.trabajando = true;
    this.transaccionesService
      .anularTransaccion(t.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoAnular = null;
          this.toast.exito('Transacción anulada: el saldo se revirtió.');
          this.cargar();
        },
        error: (err) => {
          this.confirmandoAnular = null;
          this.toast.error(mensajeDeError(err, 'No se pudo anular la transacción.'));
        }
      });
  }

  // ── presentación ──

  nombreCuenta(id: number | null): string {
    return id === null ? '' : (this.cuentas.find((c) => c.id === id)?.nombre ?? `Cuenta #${id}`);
  }

  nombreCategoria(id: number | null): string {
    return id === null ? '' : (this.categorias.find((c) => c.id === id)?.nombre ?? '');
  }

  /** "Origen → Destino" según lo que aplica al tipo. */
  cuentasDe(t: Transaccion): string {
    const o = this.nombreCuenta(t.cuenta_origen_id);
    const d = this.nombreCuenta(t.cuenta_destino_id);
    return o && d ? `${o} → ${d}` : o || d || '—';
  }

  puedeEditar(t: Transaccion): boolean {
    return t.estado !== 'ANULADO';
  }

  trackById(_: number, t: Transaccion): number {
    return t.id;
  }
}
