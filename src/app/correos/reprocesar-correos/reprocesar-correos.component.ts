import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, interval, of } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil, takeWhile } from 'rxjs/operators';
import { EstadoTrabajoReproceso, ResumenReproceso } from '../../modelos/correos-inteligentes';
import { ComprasCreditoService } from '../../services/compras-credito.service';
import { NotificacionesCorreoService } from '../../services/notificaciones-correo.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { accionesDelResumen, fechaCorteSugerida, motivosOrdenados, porcentajeAvance } from '../correos.constants';

/** `config` → `simulando` → `resumen` (el usuario revisa) → `ejecutando` (segundo plano) → `listo`. */
export type FaseReproceso = 'config' | 'simulando' | 'resumen' | 'ejecutando' | 'listo';

export const INTERVALO_AVANCE_MS = 1500;

/**
 * Pone al día los correos pendientes con lo que ya se sabe (cuentas y tarjetas asignadas, compras existentes, valores
 * habituales de cada comercio). Primero SIMULA y muestra qué pasaría; solo escribe cuando el usuario lo confirma.
 */
@Component({
  selector: 'app-reprocesar-correos',
  templateUrl: './reprocesar-correos.component.html',
  styleUrl: './reprocesar-correos.component.css'
})
export class ReprocesarCorreosComponent implements OnInit, OnDestroy {
  @Output() terminado = new EventEmitter<ResumenReproceso>();
  @Output() cancelar = new EventEmitter<void>();

  readonly acciones = accionesDelResumen;
  readonly motivos = motivosOrdenados;
  readonly porcentaje = porcentajeAvance;

  fase: FaseReproceso = 'config';
  desde = '';
  sinCorte = false;
  resumen: ResumenReproceso | null = null;
  avance: EstadoTrabajoReproceso | null = null;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private correos: NotificacionesCorreoService,
    private compras: ComprasCreditoService
  ) {}

  ngOnInit(): void {
    this.desde = fechaCorteSugerida([]);
    this.compras
      .getComprasCredito()
      .pipe(takeUntil(this.destroy$), catchError(() => of([])))
      .subscribe((lista) => {
        if (this.fase === 'config') this.desde = fechaCorteSugerida(lista);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private opciones(): { desde?: string } {
    return this.sinCorte || !this.desde ? {} : { desde: this.desde };
  }

  get corteTexto(): string {
    return this.sinCorte || !this.desde ? 'sin fecha de corte (se registra todo lo que falte, sin importar su antigüedad)' : `desde el ${this.desde}`;
  }

  simular(): void {
    this.fase = 'simulando';
    this.error = null;
    this.correos
      .simularReproceso(this.opciones())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.resumen = r;
          this.fase = 'resumen';
        },
        error: (err) => {
          this.error = mensajeDeError(err, 'No se pudo simular el reproceso.');
          this.fase = 'config';
        }
      });
  }

  get registraAlgo(): boolean {
    const a = this.resumen?.acciones ?? {};
    return (a['compras_enlazadas'] ?? 0) + (a['compras_creadas'] ?? 0) + (a['compras_creadas_con_plantilla'] ?? 0) + (a['transacciones_creadas'] ?? 0) + (a['transacciones_enlazadas'] ?? 0) + (a['duplicados'] ?? 0) + (a['ignorados'] ?? 0) > 0;
  }

  volver(): void {
    this.fase = 'config';
    this.resumen = null;
  }

  aplicar(): void {
    this.fase = 'ejecutando';
    this.error = null;
    this.avance = null;
    this.correos
      .iniciarReproceso(this.opciones())
      .pipe(
        takeUntil(this.destroy$),
        switchMap((t) =>
          interval(INTERVALO_AVANCE_MS).pipe(
            switchMap(() => this.correos.getEstadoReproceso(t.jobId)),
            takeWhile((e) => e.estado === 'EN_CURSO', true)
          )
        ),
        finalize(() => undefined)
      )
      .subscribe({
        next: (e) => {
          this.avance = e;
          if (e.estado === 'TERMINADO' && e.resumen) {
            this.resumen = e.resumen;
            this.fase = 'listo';
            this.terminado.emit(e.resumen);
          } else if (e.estado === 'FALLIDO') {
            this.error = e.error ?? 'El reproceso falló.';
            this.fase = 'resumen';
          }
        },
        error: (err) => {
          this.error = mensajeDeError(err, 'No se pudo ejecutar el reproceso. Lo ya hecho se conserva; vuelve a simular.');
          this.fase = 'config';
        }
      });
  }
}
