import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CompraHistorial, HistorialTarjeta, ResponsableHistorial } from '../../modelos/tarjeta';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombreTarjeta, terminacion, vigenciaLegible } from '../tarjetas.constants';

const POR_PAGINA = 100;

/** «Andrés 50 %, Papá 25 %» (solo para mostrar). */
export function resumenResponsables(rs: ResponsableHistorial[]): string {
  return rs
    .map((r) => `${(r.nombre ?? 'Persona').split(' ')[0]}${r.porcentaje !== null ? ` ${Math.round(r.porcentaje * 100) / 100} %` : ''}`)
    .join(', ');
}

/** ¿Quedan compras por traer? */
export function hayMas(h: Pick<HistorialTarjeta, 'paginacion'> | null, cargadas: number): boolean {
  return !!h && cargadas < h.paginacion.total;
}

@Component({
  selector: 'app-historial-tarjeta',
  templateUrl: './historial-tarjeta.component.html',
  styleUrl: './historial-tarjeta.component.css'
})
export class HistorialTarjetaComponent implements OnInit, OnDestroy {
  readonly terminacion = terminacion;
  readonly vigencia = vigenciaLegible;
  readonly responsables = resumenResponsables;

  tarjetaId = 0;
  historial: HistorialTarjeta | null = null;
  compras: CompraHistorial[] = [];
  /** `null` = todos los plásticos. */
  plasticoId: number | null = null;
  desde = '';
  hasta = '';

  cargando = true;
  cargandoMas = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private tarjetas: TarjetasService) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.tarjetaId = Number(p.get('id'));
      this.cargar();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get titulo(): string {
    return this.historial ? nombreTarjeta(this.historial.tarjeta) : 'Tarjeta';
  }

  get masPorTraer(): boolean {
    return hayMas(this.historial, this.compras.length);
  }

  get filtrado(): boolean {
    return this.plasticoId !== null || !!this.desde || !!this.hasta;
  }

  filtrarPlastico(id: number | null): void {
    if (this.plasticoId === id) return;
    this.plasticoId = id;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.plasticoId = null;
    this.desde = '';
    this.hasta = '';
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.tarjetas
      .getHistorial(this.tarjetaId, { plasticoId: this.plasticoId, desde: this.desde, hasta: this.hasta, limite: POR_PAGINA })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (h) => {
          this.historial = h;
          this.compras = h.compras;
        },
        error: (err) => {
          this.historial = null;
          this.compras = [];
          this.error = mensajeDeError(err, 'No se pudo cargar el historial de la tarjeta.');
        }
      });
  }

  cargarMas(): void {
    if (!this.historial || this.cargandoMas) return;
    this.cargandoMas = true;
    this.tarjetas
      .getHistorial(this.tarjetaId, { plasticoId: this.plasticoId, desde: this.desde, hasta: this.hasta, limite: POR_PAGINA, pagina: this.historial.paginacion.pagina + 1 })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargandoMas = false))
      )
      .subscribe({
        next: (h) => {
          this.historial = h;
          this.compras = [...this.compras, ...h.compras];
        },
        error: (err) => (this.error = mensajeDeError(err, 'No se pudieron traer más compras.'))
      });
  }

  trackCompra(_: number, c: CompraHistorial): number {
    return c.id;
  }
}
