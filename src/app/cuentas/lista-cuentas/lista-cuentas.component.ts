import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CuentaFinanciera } from '../../modelos/erp';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { ModalService } from '../../services/modal.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { enmascarar4, etiquetaTipoCuenta, iconoTipoCuenta } from '../cuentas.constants';

export const MODAL_CUENTA = 'cuenta-form';

/** Saldo total por moneda de las cuentas activas (no se mezclan monedas). */
export function saldosPorMoneda(cuentas: CuentaFinanciera[]): Array<{ moneda: string; saldo: number; cuentas: number }> {
  const mapa = new Map<string, CuentaFinanciera[]>();
  for (const c of cuentas.filter((x) => x.is_active !== false)) mapa.set(c.moneda, [...(mapa.get(c.moneda) ?? []), c]);
  return [...mapa.entries()]
    .map(([moneda, lista]) => ({ moneda, saldo: sumarMonedas(lista.map((c) => c.saldo_actual)), cuentas: lista.length }))
    .sort((a, b) => (a.moneda === 'COP' ? -1 : b.moneda === 'COP' ? 1 : a.moneda.localeCompare(b.moneda)));
}

@Component({
  selector: 'app-lista-cuentas',
  templateUrl: './lista-cuentas.component.html',
  styleUrl: './lista-cuentas.component.css'
})
export class ListaCuentasComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_CUENTA;
  readonly etiquetaTipo = etiquetaTipoCuenta;
  readonly iconoTipo = iconoTipoCuenta;
  readonly enmascarar = enmascarar4;

  cuentas: CuentaFinanciera[] = [];
  saldos: Array<{ moneda: string; saldo: number; cuentas: number }> = [];
  mostrarInactivas = false;

  /** Cuenta que se edita (null = alta); el formulario existe solo mientras el modal está abierto. */
  formularioAbierto = false;
  cuentaEditando: CuentaFinanciera | null = null;
  confirmandoBorrado: CuentaFinanciera | null = null;
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
        this.cuentaEditando = null;
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
      .getCuentas()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (c) => {
          this.cuentas = c;
          this.saldos = saldosPorMoneda(c);
        },
        error: (err) => {
          this.cuentas = [];
          this.saldos = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar las cuentas.');
        }
      });
  }

  get visibles(): CuentaFinanciera[] {
    return this.mostrarInactivas ? this.cuentas : this.cuentas.filter((c) => c.is_active !== false);
  }

  get inactivas(): number {
    return this.cuentas.filter((c) => c.is_active === false).length;
  }

  // ── alta / edición ──

  nueva(): void {
    this.cuentaEditando = null;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  editar(c: CuentaFinanciera): void {
    this.cuentaEditando = c;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onGuardada(): void {
    const eraEdicion = !!this.cuentaEditando;
    this.modalService.close();
    this.toast.exito(eraEdicion ? 'Cuenta actualizada.' : 'Cuenta creada.');
    this.cargar();
  }

  // ── activar / desactivar ──

  alternarActiva(c: CuentaFinanciera): void {
    const activar = c.is_active === false;
    this.trabajando = true;
    this.cuentasService
      .actualizarCuenta(c.id, { isActive: activar })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.toast.exito(activar ? 'Cuenta activada.' : 'Cuenta desactivada. Sus movimientos se conservan.');
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo cambiar el estado de la cuenta.'))
      });
  }

  // ── borrado ──

  pedirBorrado(c: CuentaFinanciera): void {
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
      .eliminarCuenta(c.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoBorrado = null;
          this.toast.exito('Cuenta eliminada.');
          this.cargar();
        },
        error: (err) => {
          this.confirmandoBorrado = null;
          // 409: ya tiene transacciones; el backend sugiere desactivarla
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar la cuenta.'));
        }
      });
  }

  trackById(_: number, c: CuentaFinanciera): number {
    return c.id;
  }
}
