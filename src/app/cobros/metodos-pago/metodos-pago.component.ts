import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { OpcionSelect } from '../../modelos/catalogos';
import { GuardarMetodoPago, MetodoPago, MetodoPagoPublico, TipoMetodoPago } from '../../modelos/cobros-personas';
import { CobrosPersonasService } from '../../services/cobros-personas.service';
import { ModalService } from '../../services/modal.service';
import { prepararQr, tamanoLegible } from '../../shared/archivo.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { ENTIDADES_SUGERIDAS, TIPOS_METODO_PAGO, errorDeNumeroMetodo, etiquetaMetodoPago, iconoMetodoPago, numeroLegible, claseMetodoPago } from '../cobros-fase6.helpers';

export const MODAL_METODO_PAGO = 'metodo-pago-form';

/**
 * Medios de pago del propietario: dónde le pueden transferir. Se muestran en el enlace de cada persona («¿Dónde puedes pagar?»)
 * con un botón para copiar el número. Aquí se agregan, editan, ordenan, activan/desactivan y se les pone su QR.
 */
@Component({
  selector: 'app-metodos-pago',
  templateUrl: './metodos-pago.component.html',
  styleUrl: './metodos-pago.component.css',
})
export class MetodosPagoComponent implements OnInit, OnDestroy {
  /** Cambió la lista (el enlace de las personas ya muestra otra cosa). */
  @Output() cambio = new EventEmitter<void>();

  readonly modalId = MODAL_METODO_PAGO;
  readonly tipos = TIPOS_METODO_PAGO;
  readonly opcionesTipo: OpcionSelect[] = TIPOS_METODO_PAGO.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }));
  readonly entidades = ENTIDADES_SUGERIDAS;
  readonly etiqueta = etiquetaMetodoPago;
  readonly icono = iconoMetodoPago;
  readonly legible = numeroLegible;
  readonly clase = claseMetodoPago;
  readonly tamano = tamanoLegible;

  metodos: MetodoPago[] = [];
  cargando = true;
  error: string | null = null;
  trabajando = false;

  // formulario
  formularioAbierto = false;
  editando: MetodoPago | null = null;
  intentado = false;
  errorForm: string | null = null;
  guardando = false;
  /** QR elegido en el formulario (aún sin guardar). */
  qrNuevo: { nombre: string; tipo: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'; datos: string } | null = null;
  quitarQrAlGuardar = false;
  errorQr: string | null = null;
  leyendoQr = false;
  /** Vista previa del QR que ya tiene el medio (se pide con la sesión del propietario). */
  qrActualUrl: string | null = null;
  confirmandoEliminar: MetodoPago | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.nonNullable.group({
    tipo: ['NEQUI' as TipoMetodoPago, Validators.required],
    entidad: ['', [Validators.required, Validators.maxLength(80)]],
    numero: ['', [Validators.required, Validators.maxLength(60)]],
    titular: ['', Validators.maxLength(120)],
    documento: ['', Validators.maxLength(30)],
    instrucciones: ['', Validators.maxLength(500)],
    cuentaId: [null as number | null],
    activo: [true],
  });

  constructor(
    private servicio: CobrosPersonasService,
    private modal: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modal.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId && this.formularioAbierto) this.cerrarFormulario(false);
    });
    this.cargar();
  }

  ngOnDestroy(): void {
    this.liberarQrActual();
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.servicio
      .getMetodosPago()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (lista) => (this.metodos = [...lista].sort((a, b) => a.orden - b.orden || a.id - b.id)),
        error: (err) => (this.error = mensajeDeError(err, 'No se pudieron cargar tus medios de pago.')),
      });
  }

  get activos(): number {
    return this.metodos.filter((m) => m.activo).length;
  }

  /** Cómo los ve la persona (vista previa con las tarjetas del enlace). */
  get vistaPrevia(): MetodoPagoPublico[] {
    return this.metodos
      .filter((m) => m.activo)
      .map((m) => ({ id: m.id, tipo: m.tipo, entidad: m.entidad, numero: m.numero, titular: m.titular, documento: m.documento, instrucciones: m.instrucciones, tieneQr: false }));
  }

  get opcionTipo(): (typeof TIPOS_METODO_PAGO)[number] {
    return TIPOS_METODO_PAGO.find((t) => t.valor === this.form.controls.tipo.value) ?? TIPOS_METODO_PAGO[0];
  }

  get errorNumero(): string | null {
    const v = this.form.getRawValue();
    return errorDeNumeroMetodo(v.tipo, v.numero);
  }

  // ───────── formulario ─────────

  abrirNuevo(): void {
    this.editando = null;
    this.prepararFormulario({ tipo: 'NEQUI', entidad: 'Nequi', numero: '', titular: '', documento: '', instrucciones: '', cuentaId: null, activo: true });
    this.modal.open(this.modalId);
  }

  abrirEditar(m: MetodoPago): void {
    this.editando = m;
    this.prepararFormulario({ tipo: m.tipo, entidad: m.entidad, numero: m.numero, titular: m.titular ?? '', documento: m.documento ?? '', instrucciones: m.instrucciones ?? '', cuentaId: m.cuentaId, activo: m.activo });
    if (m.tieneQr) this.cargarQrActual(m.id);
    this.modal.open(this.modalId);
  }

  private prepararFormulario(valores: ReturnType<typeof this.form.getRawValue>): void {
    this.form.reset(valores);
    this.formularioAbierto = true;
    this.intentado = false;
    this.errorForm = null;
    this.qrNuevo = null;
    this.quitarQrAlGuardar = false;
    this.errorQr = null;
    this.liberarQrActual();
  }

  cerrarFormulario(cerrarModal = true): void {
    this.formularioAbierto = false;
    this.liberarQrActual();
    if (cerrarModal) this.modal.close();
  }

  /** Al elegir el tipo se sugiere la entidad (Nequi → «Nequi»); el resto lo escribe la persona. */
  alElegirTipo(tipo: TipoMetodoPago | string | number | null): void {
    if (!tipo) return;
    const entidadActual = this.form.controls.entidad.value.trim();
    const automatica = !entidadActual || ['Nequi', 'Daviplata', 'Bre-B', 'Transfiya'].includes(entidadActual);
    if (automatica) {
      this.form.controls.entidad.setValue({ NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', LLAVE: 'Bre-B' }[tipo as string] ?? '');
    }
  }

  private cargarQrActual(id: number): void {
    this.servicio
      .getQr(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (blob) => (this.qrActualUrl = URL.createObjectURL(blob)), error: () => (this.qrActualUrl = null) });
  }

  private liberarQrActual(): void {
    if (this.qrActualUrl) URL.revokeObjectURL(this.qrActualUrl);
    this.qrActualUrl = null;
  }

  async alElegirQr(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) return;
    this.errorQr = null;
    this.leyendoQr = true;
    try {
      this.qrNuevo = await prepararQr(archivo);
      this.quitarQrAlGuardar = false;
    } catch (e) {
      this.qrNuevo = null;
      this.errorQr = e instanceof Error ? e.message : 'No se pudo leer la imagen.';
    } finally {
      this.leyendoQr = false;
      entrada.value = '';
    }
  }

  get vistaQrNuevo(): string | null {
    return this.qrNuevo ? `data:${this.qrNuevo.tipo};base64,${this.qrNuevo.datos}` : null;
  }

  quitarQr(): void {
    this.qrNuevo = null;
    if (this.editando?.tieneQr) this.quitarQrAlGuardar = true;
  }

  get mostrarQrActual(): boolean {
    return !!this.editando?.tieneQr && !this.quitarQrAlGuardar && !this.qrNuevo;
  }

  guardar(): void {
    this.intentado = true;
    this.errorForm = null;
    const v = this.form.getRawValue();
    if (this.form.invalid || this.errorNumero || this.guardando || this.leyendoQr) {
      this.form.markAllAsTouched();
      return;
    }
    const opcionales = { titular: v.titular.trim() || null, documento: v.documento.trim() || null, instrucciones: v.instrucciones.trim() || null, cuentaId: v.cuentaId };
    const base = { tipo: v.tipo, entidad: v.entidad.trim(), numero: v.numero.trim(), activo: v.activo };
    this.guardando = true;
    const editando = this.editando;
    // al editar, un campo vacío se envía como `null` (lo borra); al crear, simplemente no se envía
    const guardado$ = editando
      ? this.servicio.actualizarMetodoPago(editando.id, { ...base, ...opcionales })
      : this.servicio.crearMetodoPago({ ...base, ...(Object.fromEntries(Object.entries(opcionales).filter(([, valor]) => valor !== null)) as Partial<GuardarMetodoPago>) });
    guardado$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (m) => this.despuesDeGuardar(m, editando),
      error: (err) => {
        this.guardando = false;
        this.errorForm = mensajeDeError(err, 'No se pudo guardar el medio de pago.');
      },
    });
  }

  /** El QR va aparte (otro endpoint): primero se guarda el medio y luego su imagen. */
  private despuesDeGuardar(m: MetodoPago, editando: MetodoPago | null): void {
    const terminar = (final: MetodoPago) => {
      this.guardando = false;
      this.cerrarFormulario();
      this.toast.exito(editando ? 'Medio de pago actualizado.' : 'Medio de pago agregado: las personas ya lo ven en su enlace.');
      this.cargar();
      this.cambio.emit();
      void final;
    };
    const fallo = (err: unknown) => {
      this.guardando = false;
      this.errorForm = `El medio se guardó, pero el QR no: ${mensajeDeError(err, 'inténtalo de nuevo')}`;
      this.cargar();
    };
    if (this.qrNuevo) this.servicio.guardarQr(m.id, this.qrNuevo).pipe(takeUntil(this.destroy$)).subscribe({ next: terminar, error: fallo });
    else if (this.quitarQrAlGuardar) this.servicio.quitarQr(m.id).pipe(takeUntil(this.destroy$)).subscribe({ next: terminar, error: fallo });
    else terminar(m);
  }

  // ───────── acciones sobre la lista ─────────

  alternarActivo(m: MetodoPago): void {
    if (this.trabajando) return;
    this.trabajando = true;
    this.servicio
      .actualizarMetodoPago(m.id, { activo: !m.activo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (r) => {
          this.metodos = this.metodos.map((x) => (x.id === r.id ? r : x));
          this.toast.exito(r.activo ? `${r.entidad}: las personas ya lo ven en su enlace.` : `${r.entidad}: oculto en los enlaces.`);
          this.cambio.emit();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo cambiar el medio de pago.')),
      });
  }

  /** Sube o baja un medio: se intercambian las posiciones con su vecino. */
  mover(m: MetodoPago, delta: -1 | 1): void {
    const i = this.metodos.findIndex((x) => x.id === m.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.metodos.length || this.trabajando) return;
    const otro = this.metodos[j];
    const ordenM = j; // posiciones reales: 0..n-1 (también arregla ordenes repetidos)
    const ordenOtro = i;
    this.trabajando = true;
    this.servicio
      .actualizarMetodoPago(m.id, { orden: ordenM })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () =>
          this.servicio
            .actualizarMetodoPago(otro.id, { orden: ordenOtro })
            .pipe(
              takeUntil(this.destroy$),
              finalize(() => (this.trabajando = false))
            )
            .subscribe({
              next: () => {
                this.cargar();
                this.cambio.emit();
              },
              error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo reordenar.')),
            }),
        error: (err) => {
          this.trabajando = false;
          this.toast.error(mensajeDeError(err, 'No se pudo reordenar.'));
        },
      });
  }

  pedirEliminar(m: MetodoPago): void {
    this.confirmandoEliminar = m;
  }

  confirmarEliminar(): void {
    const m = this.confirmandoEliminar;
    if (!m) return;
    this.trabajando = true;
    this.servicio
      .eliminarMetodoPago(m.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoEliminar = null;
          this.toast.exito('Medio de pago eliminado.');
          this.cargar();
          this.cambio.emit();
        },
        error: (err) => {
          this.confirmandoEliminar = null;
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar el medio de pago.'));
        },
      });
  }

  trackById(_: number, m: { id: number }): number {
    return m.id;
  }
}
