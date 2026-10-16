import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AporteDiaConDetalle, MetodoAporte, RegistrarAportesDia, ResumenObligacionMes } from '../../modelos/erp';
import { ItemPersona } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';
import { ObligacionesMesService } from '../../services/obligaciones-mes.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { finDePeriodo, hoyIso } from '../../shared/periodo.helper';
import { METODOS_APORTE } from '../obligaciones.constants';
import { importeConDosDecimales } from '../../shared/validadores';

/** El backend admite hasta 50 ítems por día. */
export const MAX_ITEMS_APORTE = 50;

type FilaAporte = FormGroup<{
  personaId: FormControl<number | null>;
  valor: FormControl<number | null>;
  metodo: FormControl<MetodoAporte | null>;
  comentarios: FormControl<string | null>;
}>;

@Component({
  selector: 'app-formulario-aportes',
  templateUrl: './formulario-aportes.component.html',
  styleUrl: './formulario-aportes.component.css'
})
export class FormularioAportesComponent implements OnChanges, OnInit, OnDestroy {
  @Input({ required: true }) obligacion!: ResumenObligacionMes;
  /** Personas del catálogo compartido (para saber a quién se le genera un préstamo y mostrar su nombre). */
  personas: ItemPersona[] = [];
  @Output() registrado = new EventEmitter<AporteDiaConDetalle>();
  @Output() cancelar = new EventEmitter<void>();

  readonly metodos = METODOS_APORTE;
  readonly maxItems = MAX_ITEMS_APORTE;
  enviando = false;
  errorServidor: string | null = null;

  private destroy$ = new Subject<void>();
  private readonly fb = inject(FormBuilder);

  form = this.fb.group({
    fecha: [hoyIso(), Validators.required],
    notas: [''],
    items: this.fb.array<FilaAporte>([]),
  });

  constructor(private obligacionesService: ObligacionesMesService, private catalogos: CatalogosService) {
    this.agregarFila();
  }

  ngOnInit(): void {
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.personas = e.datos;
      this.preseleccionarResponsable();
    });
    this.catalogos.asegurar(['personas']);
  }

  get items(): FormArray<FilaAporte> {
    return this.form.controls.items;
  }

  ngOnChanges(cambios: SimpleChanges): void {
    // Al llegar la obligación, la fecha por defecto es hoy si cae dentro de su vigencia; si no, el inicio.
    if (cambios['obligacion'] && this.obligacion && !this.form.controls.fecha.dirty) {
      this.form.controls.fecha.setValue(this.fechaPorDefecto());
    }
    // Si el responsable principal ya está en la lista, se preselecciona en la primera fila vacía.
    if (cambios['obligacion']) this.preseleccionarResponsable();
  }

  private preseleccionarResponsable(): void {
    const primera = this.items.at(0);
    if (primera && !primera.controls.personaId.dirty && this.obligacion?.responsable_principal_id) {
      primera.controls.personaId.setValue(this.obligacion.responsable_principal_id);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  agregarFila(): void {
    if (this.items.length >= this.maxItems) return;
    this.items.push(
      this.fb.group({
        personaId: new FormControl<number | null>(null, Validators.required),
        valor: new FormControl<number | null>(null, [Validators.required, importeConDosDecimales]),
        metodo: new FormControl<MetodoAporte | null>('Fisico', Validators.required),
        comentarios: new FormControl<string | null>(''),
      })
    );
  }

  quitarFila(i: number): void {
    if (this.items.length > 1) this.items.removeAt(i);
  }

  /** Suma de los valores ya válidos, para previsualizar (el total real lo calcula la BD). */
  get total(): number {
    return sumarMonedas(this.items.controls.map((f) => (f.controls.valor.valid ? f.controls.valor.value : 0)));
  }

  /** Los aportes de alguien que no es el responsable ni el titular generan un préstamo POR_COBRAR (Trigger 3). */
  generaPrestamo(fila: FilaAporte): boolean {
    const id = fila.controls.personaId.value;
    if (id === null || id === undefined) return false;
    if (id === this.obligacion?.responsable_principal_id) return false;
    const persona = this.personas.find((p) => p.id === Number(id));
    return !persona?.tieneUsuario;
  }

  nombrePersona(id: number | null): string {
    return this.personas.find((p) => p.id === Number(id))?.nombre ?? 'esa persona';
  }

  get filasConPrestamo(): number {
    return this.items.controls.filter((f) => this.generaPrestamo(f)).length;
  }

  campoInvalido(fila: FilaAporte, nombre: 'personaId' | 'valor' | 'metodo'): boolean {
    const c = fila.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: RegistrarAportesDia = {
      fecha: v.fecha as string,
      ...(v.notas?.trim() ? { notas: v.notas.trim() } : {}),
      items: v.items.map((i) => ({
        personaId: Number(i.personaId),
        valor: String(i.valor),
        metodo: i.metodo as MetodoAporte,
        ...(i.comentarios?.trim() ? { comentarios: i.comentarios.trim() } : {}),
      })),
    };

    this.enviando = true;
    this.obligacionesService
      .registrarAportesDia(this.obligacion.obligacion_mes_id, cuerpo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (dia) => {
          this.reiniciar();
          this.registrado.emit(dia);
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudieron registrar los aportes.'))
      });
  }

  private reiniciar(): void {
    this.items.clear();
    this.agregarFila();
    this.form.reset({ fecha: this.fechaPorDefecto(), notas: '' });
    this.items.at(0).controls.personaId.setValue(this.obligacion?.responsable_principal_id ?? null);
  }

  private fechaPorDefecto(): string {
    const hoy = hoyIso();
    const inicio = this.fechaCorta(this.obligacion?.fecha_inicio);
    const fin = this.fechaCorta(this.obligacion?.fecha_final) ?? (this.obligacion?.periodo ? finDePeriodo(this.obligacion.periodo) : null);
    if (inicio && hoy < inicio) return inicio;
    if (fin && hoy > fin) return fin;
    return hoy;
  }

  /** `2026-10-05T00:00:00.000Z` → `2026-10-05` (columnas `date`: el día de calendario es el prefijo). */
  private fechaCorta(valor: string | null | undefined): string | null {
    return valor ? valor.slice(0, 10) : null;
  }
}
