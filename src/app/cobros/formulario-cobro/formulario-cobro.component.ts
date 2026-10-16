import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, FormControl, FormRecord, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CategoriaCobro, CobroPuntual, GuardarCobroPuntual, ModoDivision } from '../../modelos/cobros-personas';
import { ItemPersona } from '../../modelos/catalogos';
import { CobrosPersonasService } from '../../services/cobros-personas.service';
import { esImporteValido } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { esPeriodoValido, hoyIso, nombrePeriodo } from '../../shared/periodo.helper';
import { CATEGORIAS_COBRO, MODOS_DIVISION, ResultadoReparto, calcularReparto, iconoCategoria } from '../cobros.constants';

/** Persona que es el propietario de la cuenta (la enlazada a su usuario): su parte no genera deuda. */
export function miPersona(personas: ItemPersona[]): ItemPersona | null {
  return personas.find((p) => p.esPropia) ?? null;
}

export interface EntradaCobro {
  concepto: string;
  categoria: CategoriaCobro;
  fechaGasto: string;
  periodo: string;
  montoTotal: number | string | null;
  modoDivision: ModoDivision;
  notas: string;
  /** Personas marcadas, con el valor que se escribió (porcentaje o monto según el modo). */
  seleccion: Array<{ personaId: number; valor: string }>;
  yoParticipo: boolean;
  miPersonaId: number | null;
}

/** Cuerpo de `POST/PUT /api/cobros-puntuales` a partir de lo que hay en pantalla. */
export function construirCobro(e: EntradaCobro): GuardarCobroPuntual {
  const incluirme = e.modoDivision === 'IGUAL' && e.yoParticipo && e.miPersonaId !== null;
  const personas = e.seleccion.filter((s) => s.personaId !== e.miPersonaId);
  const participantes = personas.map((s) => ({
    personaId: s.personaId,
    ...(e.modoDivision === 'PORCENTAJE' ? { porcentaje: String(s.valor) } : {}),
    ...(e.modoDivision === 'MONTO' ? { monto: String(s.valor) } : {}),
  }));
  if (incluirme) participantes.push({ personaId: e.miPersonaId as number });
  return {
    concepto: e.concepto.trim(),
    categoria: e.categoria,
    fechaGasto: e.fechaGasto,
    periodo: e.periodo,
    montoTotal: String(e.montoTotal),
    modoDivision: e.modoDivision,
    participantes,
    ...(e.notas.trim() ? { notas: e.notas.trim() } : {}),
  };
}

/**
 * Reparte un gasto entre varias personas (el recibo de la luz, el mercado, una fiesta…). Cada una recibe su parte como cargo en
 * la liquidación del mes que elijas; lo que pagas tú no genera deuda.
 */
@Component({
  selector: 'app-formulario-cobro',
  templateUrl: './formulario-cobro.component.html',
  styleUrl: './formulario-cobro.component.css'
})
export class FormularioCobroComponent implements OnInit, OnDestroy {
  @Input() cobro: CobroPuntual | null = null;
  @Input({ required: true }) personas: ItemPersona[] = [];
  @Input() periodoInicial = '';
  @Output() guardado = new EventEmitter<CobroPuntual>();
  @Output() cancelar = new EventEmitter<void>();

  readonly categorias = CATEGORIAS_COBRO;
  readonly modos = MODOS_DIVISION;
  readonly icono = iconoCategoria;
  readonly nombrePeriodo = nombrePeriodo;

  enviando = false;
  errorServidor: string | null = null;
  intentado = false;
  /** Mientras el usuario no toque el periodo, sigue a la fecha del gasto. */
  private periodoManual = false;

  seleccion = new Set<number>();
  valores = new FormRecord<FormControl<string>>({});

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.nonNullable.group({
    concepto: ['', [Validators.required, Validators.maxLength(255)]],
    categoria: ['SERVICIO' as CategoriaCobro],
    fechaGasto: [hoyIso(), Validators.required],
    periodo: ['', Validators.required],
    montoTotal: ['' as number | string, [Validators.required]],
    modoDivision: ['IGUAL' as ModoDivision],
    yoParticipo: [true],
    notas: ['', Validators.maxLength(1000)],
  });

  constructor(private cobros: CobrosPersonasService) {}

  get esEdicion(): boolean {
    return !!this.cobro;
  }

  get ayudaModo(): string {
    return this.modos.find((m) => m.valor === this.modo)?.ayuda ?? '';
  }

  get yo(): ItemPersona | null {
    return miPersona(this.personas);
  }

  get otras(): ItemPersona[] {
    const yo = this.yo;
    return this.personas.filter((p) => p.id !== yo?.id);
  }

  get modo(): ModoDivision {
    return this.form.controls.modoDivision.value;
  }

  ngOnInit(): void {
    const c = this.cobro;
    if (c) {
      this.form.reset({
        concepto: c.concepto,
        categoria: c.categoria,
        fechaGasto: String(c.fechaGasto).slice(0, 10),
        periodo: c.periodo,
        montoTotal: c.montoTotal,
        modoDivision: c.modoDivision,
        yoParticipo: c.participantes.some((p) => p.esPropio),
        notas: c.notas ?? '',
      });
      this.periodoManual = true;
      for (const p of c.participantes.filter((x) => !x.esPropio)) {
        this.marcar(p.personaId, c.modoDivision === 'PORCENTAJE' ? String(p.porcentaje ?? '') : c.modoDivision === 'MONTO' ? String(p.monto) : '');
      }
    } else {
      this.form.controls.periodo.setValue(this.periodoInicial && esPeriodoValido(this.periodoInicial) ? this.periodoInicial : hoyIso().slice(0, 7));
      this.periodoManual = !!this.periodoInicial;
    }
    this.form.controls.fechaGasto.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((f) => {
      if (!this.periodoManual && /^\d{4}-\d{2}-\d{2}$/.test(f)) this.form.controls.periodo.setValue(f.slice(0, 7));
    });
    this.form.controls.periodo.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.form.controls.periodo.dirty) this.periodoManual = true;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── participantes ──

  estaMarcada(id: number | undefined): boolean {
    return id !== undefined && this.seleccion.has(id);
  }

  alternar(id: number | undefined): void {
    if (id === undefined) return;
    if (this.seleccion.has(id)) {
      this.seleccion.delete(id);
      this.valores.removeControl(String(id));
    } else {
      this.marcar(id, '');
    }
  }

  private marcar(id: number, valor: string): void {
    this.seleccion.add(id);
    this.valores.addControl(String(id), new FormControl<string>(valor, { nonNullable: true }));
  }

  marcarTodas(): void {
    for (const p of this.otras) if (p.id !== undefined && !this.seleccion.has(p.id)) this.marcar(p.id, '');
  }

  nombre(id: number): string {
    return this.personas.find((p) => p.id === id)?.nombre ?? `Persona ${id}`;
  }

  private entrada(): EntradaCobro {
    const v = this.form.getRawValue();
    return {
      concepto: v.concepto,
      categoria: v.categoria,
      fechaGasto: v.fechaGasto,
      periodo: v.periodo,
      montoTotal: v.montoTotal,
      modoDivision: v.modoDivision,
      notas: v.notas,
      seleccion: [...this.seleccion].map((personaId) => ({ personaId, valor: this.valores.controls[String(personaId)]?.value ?? '' })),
      yoParticipo: v.yoParticipo,
      miPersonaId: this.yo?.id ?? null,
    };
  }

  /** Vista previa en vivo de cuánto le toca a cada uno. */
  get reparto(): ResultadoReparto {
    const e = this.entrada();
    const yoId = this.yo?.id ?? null;
    const base = e.seleccion.map((s) => ({ personaId: s.personaId, valor: s.valor }));
    const participantes = e.modoDivision === 'IGUAL' && e.yoParticipo && yoId !== null ? [...base, { personaId: yoId, valor: '' }] : base;
    return calcularReparto(e.montoTotal === '' ? null : e.montoTotal, e.modoDivision, participantes, yoId);
  }

  get totalInvalido(): boolean {
    const t = this.form.controls.montoTotal.value;
    return t === '' || !esImporteValido(t);
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty || this.intentado);
  }

  // ── guardar ──

  enviar(): void {
    this.intentado = true;
    this.errorServidor = null;
    if (this.form.invalid || this.totalInvalido || this.reparto.error) {
      this.form.markAllAsTouched();
      return;
    }
    const cuerpo = construirCobro(this.entrada());
    this.enviando = true;
    const peticion = this.cobro ? this.cobros.actualizarCobro(this.cobro.id, cuerpo) : this.cobros.crearCobro(cuerpo);
    peticion
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (c) => this.guardado.emit(c),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar el gasto repartido.'))
      });
  }
}
