import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ActualizarCuentaFinanciera, CrearCuentaFinanciera, CuentaFinanciera, TipoCuentaFinanciera } from '../../modelos/erp';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { importeNoNegativoOpcional } from '../../shared/validadores';
import { PATRON_ULTIMOS_4, TIPOS_CUENTA } from '../cuentas.constants';

/** Alta (`cuenta = null`) o edición de una cuenta. El saldo solo se fija al crear: después lo mueven las transacciones. */
@Component({
  selector: 'app-formulario-cuenta',
  templateUrl: './formulario-cuenta.component.html'
})
export class FormularioCuentaComponent implements OnInit, OnDestroy {
  @Input() cuenta: CuentaFinanciera | null = null;
  @Output() guardada = new EventEmitter<CuentaFinanciera>();
  @Output() cancelar = new EventEmitter<void>();

  readonly tipos = TIPOS_CUENTA;
  enviando = false;
  errorServidor: string | null = null;
  sinCambios = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    tipoCuenta: ['AHORROS' as TipoCuentaFinanciera, Validators.required],
    bancoEntidad: [''],
    ultimos4Digitos: ['', [Validators.maxLength(60), Validators.pattern(PATRON_ULTIMOS_4)]],
    moneda: ['COP', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    saldoInicial: [null as number | string | null, importeNoNegativoOpcional],
    esPrincipal: [false],
  });

  constructor(private cuentasService: CuentasFinancierasService) {}

  get esEdicion(): boolean {
    return !!this.cuenta;
  }

  ngOnInit(): void {
    if (this.cuenta) {
      this.form.reset({
        nombre: this.cuenta.nombre,
        tipoCuenta: this.cuenta.tipo_cuenta,
        bancoEntidad: this.cuenta.banco_entidad ?? '',
        ultimos4Digitos: this.cuenta.ultimos_4_digitos ?? '',
        moneda: this.cuenta.moneda,
        saldoInicial: null,
        esPrincipal: !!this.cuenta.es_principal,
      });
      // la moneda no se puede cambiar una vez creada la cuenta
      this.form.controls.moneda.disable();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Cambios respecto a la cuenta original (solo en edición). El backend no admite borrar banco ni últimos 4 con vacío. */
  construirCambios(): ActualizarCuentaFinanciera {
    const v = this.form.getRawValue();
    const c = this.cuenta as CuentaFinanciera;
    const cambios: ActualizarCuentaFinanciera = {};
    if ((v.nombre ?? '').trim() !== c.nombre) cambios.nombre = (v.nombre ?? '').trim();
    if (v.tipoCuenta !== c.tipo_cuenta) cambios.tipoCuenta = v.tipoCuenta as TipoCuentaFinanciera;
    const banco = (v.bancoEntidad ?? '').trim();
    if (banco && banco !== (c.banco_entidad ?? '')) cambios.bancoEntidad = banco;
    const ult = (v.ultimos4Digitos ?? '').trim();
    if (ult && ult !== (c.ultimos_4_digitos ?? '')) cambios.ultimos4Digitos = ult;
    if (!!v.esPrincipal !== !!c.es_principal) cambios.esPrincipal = !!v.esPrincipal;
    return cambios;
  }

  construirAlta(): CrearCuentaFinanciera {
    const v = this.form.getRawValue();
    const banco = (v.bancoEntidad ?? '').trim();
    const ult = (v.ultimos4Digitos ?? '').trim();
    return {
      nombre: (v.nombre ?? '').trim(),
      tipoCuenta: v.tipoCuenta as TipoCuentaFinanciera,
      moneda: (v.moneda ?? 'COP').toUpperCase(),
      ...(banco ? { bancoEntidad: banco } : {}),
      ...(ult ? { ultimos4Digitos: ult } : {}),
      ...(v.esPrincipal ? { esPrincipal: true } : {}),
      ...(v.saldoInicial !== null && v.saldoInicial !== undefined && v.saldoInicial !== '' ? { saldoInicial: String(v.saldoInicial) } : {}),
    };
  }

  enviar(): void {
    this.errorServidor = null;
    this.sinCambios = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    let peticion;
    if (this.cuenta) {
      const cambios = this.construirCambios();
      if (Object.keys(cambios).length === 0) {
        this.sinCambios = true;
        return;
      }
      peticion = this.cuentasService.actualizarCuenta(this.cuenta.id, cambios);
    } else {
      peticion = this.cuentasService.crearCuenta(this.construirAlta());
    }
    this.enviando = true;
    peticion
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (c) => this.guardada.emit(c),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar la cuenta.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
