import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ActualizarCategoria, Categoria, CrearCategoria, TipoCategoria } from '../../modelos/erp';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { TIPOS_CATEGORIA } from '../cuentas.constants';

const COLOR_POR_DEFECTO = '#0071E3';

@Component({
  selector: 'app-formulario-categoria',
  templateUrl: './formulario-categoria.component.html'
})
export class FormularioCategoriaComponent implements OnInit, OnDestroy {
  @Input() categoria: Categoria | null = null;
  @Output() guardada = new EventEmitter<Categoria>();
  @Output() cancelar = new EventEmitter<void>();

  readonly tipos = TIPOS_CATEGORIA;
  enviando = false;
  errorServidor: string | null = null;
  sinCambios = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    tipo: ['EGRESO' as TipoCategoria, Validators.required],
    color: [COLOR_POR_DEFECTO, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
  });

  constructor(private cuentasService: CuentasFinancierasService) {}

  get esEdicion(): boolean {
    return !!this.categoria;
  }

  ngOnInit(): void {
    if (this.categoria) {
      this.form.reset({
        nombre: this.categoria.nombre,
        tipo: this.categoria.tipo,
        color: this.categoria.color ?? COLOR_POR_DEFECTO,
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  enviar(): void {
    this.errorServidor = null;
    this.sinCambios = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const base: CrearCategoria = { nombre: (v.nombre ?? '').trim(), tipo: v.tipo as TipoCategoria, color: v.color ?? undefined };

    let peticion;
    if (this.categoria) {
      const c = this.categoria;
      const cambios: ActualizarCategoria = {};
      if (base.nombre !== c.nombre) cambios.nombre = base.nombre;
      if (base.tipo !== c.tipo) cambios.tipo = base.tipo;
      if (base.color && base.color.toUpperCase() !== (c.color ?? '').toUpperCase()) cambios.color = base.color;
      if (Object.keys(cambios).length === 0) {
        this.sinCambios = true;
        return;
      }
      peticion = this.cuentasService.actualizarCategoria(c.id, cambios);
    } else {
      peticion = this.cuentasService.crearCategoria(base);
    }
    this.enviando = true;
    peticion
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (c) => this.guardada.emit(c),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar la categoría.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
