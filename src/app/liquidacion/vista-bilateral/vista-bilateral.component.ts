import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { LiquidacionBilateral } from '../../modelos/liquidacion-bilateral';
import { LiquidacionMensualService } from '../../services/liquidacion-mensual.service';
import { mensajeDeError } from '../../shared/http-error.helper';

@Component({
  selector: 'app-vista-bilateral',
  templateUrl: './vista-bilateral.component.html',
  styleUrl: './vista-bilateral.component.css',
})
export class VistaBilateralComponent implements OnChanges, OnDestroy {
  @Input() periodo = '';
  @Input() personaId: number | null = null;
  @Output() cerrado = new EventEmitter<void>();

  camara: LiquidacionBilateral | null = null;
  cargando = false;
  error: string | null = null;
  mensajeCierre: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(private liquidacion: LiquidacionMensualService) {}

  ngOnChanges(): void {
    if (this.periodo && this.personaId) this.cargar();
    else this.camara = null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    if (!this.personaId) return;
    this.cargando = true;
    this.liquidacion.getBilateral(this.periodo, this.personaId).pipe(takeUntil(this.destroy$), finalize(() => (this.cargando = false))).subscribe({
      next: (c) => (this.camara = c),
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo cargar la vista bilateral.')),
    });
  }

  cerrar(modo: 'LIQUIDAR_Y_PAGAR_TOTAL' | 'CERRAR_Y_ARRASTRAR_SALDO'): void {
    if (!this.personaId) return;
    this.liquidacion.cerrarCruce(this.periodo, this.personaId, modo).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.mensajeCierre = modo === 'LIQUIDAR_Y_PAGAR_TOTAL' ? 'Mes liquidado: el periodo siguiente arranca en $0.' : 'Mes cerrado: el saldo queda como «Saldo Anterior» del periodo siguiente.';
        this.cerrado.emit();
        this.cargar();
      },
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo cerrar el mes.')),
    });
  }

  multa(): void {
    if (!this.personaId) return;
    this.liquidacion.registrarMulta(this.periodo, this.personaId, 10000, 'Multa por no anotar').pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.cargar(),
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo registrar la multa.')),
    });
  }

  etiquetaRegla(item: { reglaDivision: string; porcentajeAplicado: number | null }): string {
    if (item.reglaDivision === 'SALDO_ANTERIOR') return 'Saldo Anterior';
    if (item.reglaDivision === 'ABONO') return 'Abono';
    if (item.reglaDivision === '50_50') return '50/50';
    if (item.reglaDivision === 'PRORRATA') return 'Prorrata';
    if (item.porcentajeAplicado !== null) return `${item.porcentajeAplicado}%`;
    return '100% contraparte';
  }
}
