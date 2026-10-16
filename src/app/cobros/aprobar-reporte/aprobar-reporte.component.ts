import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AprobarReporte, ReportePago, ResultadoAprobacion } from '../../modelos/cobros-personas';
import { CuentaFinanciera } from '../../modelos/erp';
import { CobrosPersonasService } from '../../services/cobros-personas.service';
import { esImporteValido } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { etiquetaMedio } from '../cobros.constants';

/** Cómo se registra el pago que la persona reportó. */
export type ModoAprobacion = 'enlazar' | 'cuenta' | 'anotar';

/** Cuerpo de `POST /cobros/reportes/:id/aprobar` según lo elegido. */
export function construirAprobacion(r: Pick<ReportePago, 'correoCoincidente'>, v: { modo: ModoAprobacion; cuentaId: number | null; monto: number | string | null }): AprobarReporte {
  const cuerpo: AprobarReporte = {};
  if (v.monto !== null && v.monto !== '' && esImporteValido(v.monto)) cuerpo.monto = String(v.monto);
  if (v.modo === 'enlazar' && r.correoCoincidente) cuerpo.transaccionId = r.correoCoincidente.transaccionId;
  if (v.modo === 'cuenta' && v.cuentaId !== null) cuerpo.cuentaDestinoId = Number(v.cuentaId);
  return cuerpo;
}

/** Modo que se propone: enlazar si el dinero ya llegó por correo; si no, registrar en la cuenta principal (o en la única cuenta). */
export function modoSugerido(r: Pick<ReportePago, 'correoCoincidente'>, cuentas: Pick<CuentaFinanciera, 'id'>[]): ModoAprobacion {
  if (r.correoCoincidente) return 'enlazar';
  return cuentas.length > 0 ? 'cuenta' : 'anotar';
}

@Component({
  selector: 'app-aprobar-reporte',
  templateUrl: './aprobar-reporte.component.html',
  styleUrl: './aprobar-reporte.component.css'
})
export class AprobarReporteComponent implements OnInit, OnDestroy {
  @Input({ required: true }) reporte!: ReportePago;
  @Input() cuentas: CuentaFinanciera[] = [];
  @Output() aprobado = new EventEmitter<ResultadoAprobacion>();
  @Output() cancelar = new EventEmitter<void>();

  readonly medio = etiquetaMedio;
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    modo: ['anotar' as ModoAprobacion],
    cuentaId: [null as number | null],
    monto: [null as number | string | null, Validators.required],
  });

  constructor(private cobros: CobrosPersonasService) {}

  ngOnInit(): void {
    const principal = this.cuentas.find((c) => c.es_principal) ?? this.cuentas[0];
    this.form.reset({
      modo: modoSugerido(this.reporte, this.cuentas),
      cuentaId: this.reporte.correoCoincidente?.cuentaId ?? principal?.id ?? null,
      monto: this.reporte.montoReportado,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get modo(): ModoAprobacion {
    return this.form.controls.modo.value as ModoAprobacion;
  }

  get montoInvalido(): boolean {
    return !esImporteValido(this.form.controls.monto.value);
  }

  get difiere(): boolean {
    const m = Number(this.form.controls.monto.value);
    return Number.isFinite(m) && Math.abs(m - this.reporte.montoReportado) > 0.001;
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.montoInvalido) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.modo === 'cuenta' && this.form.controls.cuentaId.value === null) {
      this.errorServidor = 'Elige la cuenta donde recibiste el dinero.';
      return;
    }
    const v = this.form.getRawValue();
    this.enviando = true;
    this.cobros
      .aprobarReporte(this.reporte.id, construirAprobacion(this.reporte, { modo: this.modo, cuentaId: v.cuentaId, monto: v.monto }))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.aprobado.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo aprobar el pago.'))
      });
  }
}
