import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CuotaColaborativa, DetalleCuotasColaborativas } from '../../modelos/aportes-cuota';
import { ComprasCreditoService } from '../../services/compras-credito.service';
import { mensajeDeError } from '../../shared/http-error.helper';

@Component({
  selector: 'app-cuotas-colaborativas',
  templateUrl: './cuotas-colaborativas.component.html',
  styleUrl: './cuotas-colaborativas.component.css',
})
export class CuotasColaborativasComponent implements OnChanges, OnDestroy {
  @Input() compraId: number | null = null;

  detalle: DetalleCuotasColaborativas | null = null;
  cargando = false;
  error: string | null = null;
  nuevoMonto: Record<number, number | null> = {};
  nuevaPersona: Record<number, number | null> = {};
  nuevaModalidad: Record<number, string> = {};
  private destroy$ = new Subject<void>();

  constructor(private compras: ComprasCreditoService) {}

  ngOnChanges(): void {
    if (this.compraId) this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    if (!this.compraId) return;
    this.cargando = true;
    this.compras.getCuotasColaborativas(this.compraId).pipe(takeUntil(this.destroy$), finalize(() => (this.cargando = false))).subscribe({
      next: (d) => (this.detalle = d),
      error: (err) => (this.error = mensajeDeError(err, 'No se pudieron cargar las cuotas colaborativas.')),
    });
  }

  registrarAporte(cuota: CuotaColaborativa): void {
    const monto = this.nuevoMonto[cuota.cuotaDetalleId];
    const personaId = this.nuevaPersona[cuota.cuotaDetalleId];
    if (!monto || !personaId) return;
    this.compras
      .registrarAporteCuota(cuota.cuotaDetalleId, { aportantePersonaId: personaId, monto, modalidad: this.nuevaModalidad[cuota.cuotaDetalleId] ?? 'TRANSFERIDO_A_MI' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => (this.detalle = r.detalle),
        error: (err) => (this.error = mensajeDeError(err, 'No se pudo registrar el aporte.')),
      });
  }
}
