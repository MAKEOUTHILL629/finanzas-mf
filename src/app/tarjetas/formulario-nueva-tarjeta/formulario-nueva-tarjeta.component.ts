import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CrearTarjeta, MotivoReemplazo, Tarjeta, TipoTarjeta } from '../../modelos/tarjeta';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { importeOpcional } from '../../shared/validadores';
import { MOTIVOS_REEMPLAZO, esDebito, nombreTarjeta, terminacion } from '../tarjetas.constants';

export interface ValoresNuevaTarjeta {
  tipo: TipoTarjeta;
  cuentaId: number | string | null;
  ultimos4: string;
  franquicia: string;
  alias: string;
  estado: 'ACTIVA' | 'INACTIVA';
  desde: string;
  hasta: string;
  /** Id del plástico al que reemplaza (renovación); vacío = tarjeta nueva. */
  plasticoAnteriorId: number | string | null;
  motivo: string;
  diaCorte: number | string | null;
  diaLimitePago: number | string | null;
  cupoTotal: number | string | null;
  notas: string;
  esTitularExterno: boolean;
  titularPersonaId: number | string | null;
}

const vacio = (v: unknown) => v === null || v === undefined || v === '';

/** Opción del selector «¿reemplaza a un plástico anterior?»: solo los plásticos activos del mismo tipo (una renovación sustituye al vigente). */
export interface OpcionRenovacion {
  plasticoId: number;
  etiqueta: string;
}

export function opcionesDeRenovacion(tarjetas: Tarjeta[], tipo: TipoTarjeta): OpcionRenovacion[] {
  return tarjetas
    .filter((t) => (esDebito(t) ? 'DEBITO' : 'CREDITO') === tipo && !t.esGenerica)
    .flatMap((t) => (t.plasticos ?? []).filter((p) => p.esActivo).map((p) => ({ plasticoId: p.id, etiqueta: `${nombreTarjeta(t)} ${terminacion(p.ultimos4)}` })));
}

/** Cuerpo del POST: solo viaja lo que se llenó; una renovación no manda cuenta ni estado (los toma de la tarjeta y siempre es vigente). */
export function cuerpoNuevaTarjeta(v: ValoresNuevaTarjeta): CrearTarjeta {
  const renueva = !vacio(v.plasticoAnteriorId);
  const cuerpo: CrearTarjeta = { tipo: v.tipo, ultimos4: v.ultimos4.trim() };
  if (renueva) {
    cuerpo.plasticoAnteriorId = Number(v.plasticoAnteriorId);
    if (v.desde) cuerpo.fechaInicioUso = v.desde;
    if (v.motivo) cuerpo.motivo = v.motivo as MotivoReemplazo;
  } else {
    if (!vacio(v.cuentaId)) cuerpo.cuentaId = Number(v.cuentaId);
    if (v.franquicia.trim()) cuerpo.franquicia = v.franquicia.trim();
    if (v.alias.trim()) cuerpo.alias = v.alias.trim();
    if (v.estado === 'INACTIVA') {
      cuerpo.estado = 'INACTIVA';
      if (v.hasta) cuerpo.fechaFinUso = v.hasta;
    }
    if (v.desde) cuerpo.fechaInicioUso = v.desde;
    if (v.tipo === 'CREDITO') {
      if (!vacio(v.diaCorte)) cuerpo.diaCorte = Number(v.diaCorte);
      if (!vacio(v.diaLimitePago)) cuerpo.diaLimitePago = Number(v.diaLimitePago);
      if (!vacio(v.cupoTotal)) cuerpo.cupoTotal = String(v.cupoTotal);
      if (v.esTitularExterno) {
        cuerpo.esTitularExterno = true;
        if (!vacio(v.titularPersonaId)) cuerpo.titularPersonaId = Number(v.titularPersonaId);
      }
    }
  }
  if (v.notas.trim()) cuerpo.notas = v.notas.trim();
  return cuerpo;
}

/** Qué falta para poder guardar (null = nada). Las mismas reglas que valida el servidor. */
export function problemaNuevaTarjeta(v: ValoresNuevaTarjeta): string | null {
  const renueva = !vacio(v.plasticoAnteriorId);
  if (!/^\d{4}$/.test(v.ultimos4.trim())) return 'Escribe los 4 últimos dígitos.';
  if (!renueva && v.tipo === 'DEBITO' && vacio(v.cuentaId)) return 'Una tarjeta de débito pertenece a una cuenta: elige cuál.';
  if (v.estado === 'INACTIVA' && !renueva && v.desde && v.hasta && v.hasta < v.desde) return 'La fecha de fin no puede ser anterior al inicio.';
  return null;
}

/**
 * Crea una tarjeta —de crédito o de débito— o registra el plástico que renueva a otro. No hay límite por cuenta ni por franquicia:
 * una cuenta puede tener varias tarjetas y el historial de los plásticos anteriores se conserva.
 */
@Component({
  selector: 'app-formulario-nueva-tarjeta',
  templateUrl: './formulario-nueva-tarjeta.component.html'
})
export class FormularioNuevaTarjetaComponent implements OnInit, OnChanges, OnDestroy {
  /** Tarjetas ya registradas (para ofrecer «reemplaza a…»). */
  @Input() tarjetas: Tarjeta[] = [];
  /** Tipo con el que se abre el formulario. */
  @Input() tipoInicial: TipoTarjeta = 'CREDITO';
  @Output() creada = new EventEmitter<Tarjeta>();
  @Output() cancelar = new EventEmitter<void>();

  readonly motivos = MOTIVOS_REEMPLAZO;
  readonly tipos: ReadonlyArray<{ valor: TipoTarjeta; etiqueta: string; icono: string }> = [
    { valor: 'CREDITO', etiqueta: 'Crédito', icono: 'credit_card' },
    { valor: 'DEBITO', etiqueta: 'Débito', icono: 'account_balance_wallet' },
  ];

  enviando = false;
  errorServidor: string | null = null;
  intentado = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.nonNullable.group({
    tipo: ['CREDITO' as TipoTarjeta],
    cuentaId: [null as number | string | null],
    ultimos4: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    franquicia: ['', Validators.maxLength(255)],
    alias: ['', Validators.maxLength(255)],
    estado: ['ACTIVA' as 'ACTIVA' | 'INACTIVA'],
    desde: [hoyIso()],
    hasta: [''],
    plasticoAnteriorId: [null as number | string | null],
    motivo: [''],
    diaCorte: [null as number | string | null, [Validators.min(1), Validators.max(31), Validators.pattern(/^\d+$/)]],
    diaLimitePago: [null as number | string | null, [Validators.min(1), Validators.max(31), Validators.pattern(/^\d+$/)]],
    cupoTotal: [null as number | string | null, importeOpcional],
    notas: ['', Validators.maxLength(500)],
    esTitularExterno: [false],
    titularPersonaId: [null as number | string | null],
  });

  constructor(private tarjetasService: TarjetasService) {}

  ngOnInit(): void {
    this.reiniciar();
  }

  ngOnChanges(): void {
    this.reiniciar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private reiniciar(): void {
    this.form.reset({ tipo: this.tipoInicial, cuentaId: null, ultimos4: '', franquicia: '', alias: '', estado: 'ACTIVA', desde: hoyIso(), hasta: '', plasticoAnteriorId: null, motivo: '', diaCorte: null, diaLimitePago: null, cupoTotal: null, notas: '', esTitularExterno: false, titularPersonaId: null });
    this.errorServidor = null;
    this.intentado = false;
  }

  get valores(): ValoresNuevaTarjeta {
    return this.form.getRawValue();
  }

  get tipo(): TipoTarjeta {
    return this.form.controls.tipo.value;
  }

  get renueva(): boolean {
    return !vacio(this.form.controls.plasticoAnteriorId.value);
  }

  get opcionesRenovacion(): OpcionRenovacion[] {
    return opcionesDeRenovacion(this.tarjetas, this.tipo);
  }

  get problema(): string | null {
    return problemaNuevaTarjeta(this.valores);
  }

  elegirTipo(tipo: TipoTarjeta): void {
    this.form.controls.tipo.setValue(tipo);
    this.form.controls.plasticoAnteriorId.setValue(null); // las renovaciones disponibles dependen del tipo
  }

  elegirEstado(estado: 'ACTIVA' | 'INACTIVA'): void {
    this.form.controls.estado.setValue(estado);
    if (estado === 'ACTIVA') this.form.controls.hasta.setValue('');
  }

  campoInvalido(nombre: 'ultimos4' | 'diaCorte' | 'diaLimitePago' | 'cupoTotal' | 'notas'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty || this.intentado);
  }

  enviar(): void {
    this.errorServidor = null;
    this.intentado = true;
    if (this.form.invalid || this.problema) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.tarjetasService
      .crearTarjeta(cuerpoNuevaTarjeta(this.valores))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (t) => this.creada.emit(t),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar la tarjeta.'))
      });
  }
}
