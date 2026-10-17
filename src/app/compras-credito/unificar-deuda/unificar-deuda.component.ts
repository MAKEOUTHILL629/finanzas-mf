import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, map, merge, of, switchMap, takeUntil } from 'rxjs';
import { ItemPersona, ItemTarjeta } from '../../modelos/catalogos';
import { CandidataRefinanciamiento, SimulacionRefinanciamiento } from '../../modelos/refinanciamiento';
import { CatalogosService } from '../../services/catalogos.service';
import { ModalService } from '../../services/modal.service';
import { RefinanciamientosService } from '../../services/refinanciamientos.service';
import { SharedListasService } from '../../services/shared-listas.service';
import { SugerenciasService } from '../../services/sugerencias.service';
import { aCentavos2, tasaEfectivaAnual } from '../../shared/amortizacion-francesa.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { normalizeSearchText } from '../../shared/utils';
import {
  EntradaSimulacion,
  LecturaDiferencia,
  TipoTasa,
  TotalesSeleccion,
  cuotaEstimada,
  lecturaDiferenciaMensual,
  lecturaDiferenciaTotal,
  pedidoDeSimulacion,
  totalesDeSeleccion,
} from './unificar-deuda.helper';

export const MODAL_UNIFICAR_DEUDA = 'unificar-deuda';

export type PasoUnificar = 1 | 2 | 3;

interface ResponsableVista {
  iniciales: string;
  color: string;
  nombre: string;
}

/**
 * Asistente de 3 pasos «Simular / Unificar deuda» (refinanciamiento, plan V2 fase 5):
 *  1. elegir la tarjeta y las compras pendientes que el banco va a unificar;
 *  2. simular con lo que dijo el asesor (cuotas, tasa M.V. o E.A., o la cuota exacta) y comparar con lo que se paga hoy;
 *  3. confirmar: una sola operación atómica en el servidor (las compras quedan «Refinanciada» y nace la obligación nueva).
 */
@Component({
  selector: 'app-unificar-deuda',
  templateUrl: './unificar-deuda.component.html',
  styleUrl: './unificar-deuda.component.css',
})
export class UnificarDeudaComponent implements OnInit, OnDestroy {
  readonly pasos = ['Elegir compras', 'Simular', 'Confirmar'];
  readonly maxCuotas = 120;

  paso: PasoUnificar = 1;

  // ── paso 1
  tarjetaId: number | null = null;
  candidatas: CandidataRefinanciamiento[] = [];
  cargandoCandidatas = false;
  errorCandidatas: string | null = null;
  seleccion = new Set<number>();
  totales: TotalesSeleccion = { cantidad: 0, saldo: 0, cuotaActual: 0, restante: 0 };

  // ── paso 2
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    numeroCuotas: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(this.maxCuotas)]),
    tipoTasa: this.fb.nonNullable.control<TipoTasa>('mensual'),
    tasa: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(100)]),
    cuotaMensual: this.fb.control<number | null>(null, [Validators.min(0)]),
    fecha: this.fb.control<string>(hoyIso()),
  });
  /** La persona escribió la cuota a mano (con seguros o ajustes): manda sobre la calculada. */
  cuotaAMano = false;
  simulacion: SimulacionRefinanciamiento | null = null;
  simulando = false;
  errorSimulacion: string | null = null;
  erroresCampo: Record<string, string> = {};
  difMensual: LecturaDiferencia | null = null;
  difTotal: LecturaDiferencia | null = null;

  // ── paso 3
  concepto = '';
  descripcion = '';
  ejecutando = false;
  errorEjecucion: string | null = null;

  tarjetas: ItemTarjeta[] = [];
  personas: ItemPersona[] = [];

  private readonly disparar$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private candidatasVersion = 0;

  constructor(
    private api: RefinanciamientosService,
    private modal: ModalService,
    private catalogos: CatalogosService,
    private listas: SharedListasService,
    private sugerencias: SugerenciasService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.catalogos.estado$('tarjetas').pipe(takeUntil(this.destroy$)).subscribe((e) => (this.tarjetas = e.datos));
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => (this.personas = e.datos));

    this.modal.modalState$.pipe(takeUntil(this.destroy$)).subscribe((estado) => {
      if (estado !== MODAL_UNIFICAR_DEUDA) return;
      this.catalogos.asegurar(['tarjetas', 'personas']);
      this.reiniciar();
      // la tarjeta de siempre, ya elegida (si no se puede deducir, la persona elige)
      this.sugerencias.defaults().pipe(takeUntil(this.destroy$)).subscribe((d) => {
        if (this.paso === 1 && this.tarjetaId === null && d.tarjetaCreditoId !== null) this.elegirTarjeta(d.tarjetaCreditoId);
      });
    });

    // al cambiar cuotas o tasa se recalcula la cuota estimada (si no la escribieron a mano) y se vuelve a simular
    const { numeroCuotas, tipoTasa, tasa, cuotaMensual, fecha } = this.form.controls;
    merge(numeroCuotas.valueChanges, tipoTasa.valueChanges, tasa.valueChanges)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.actualizarCuotaEstimada();
        this.disparar$.next();
      });
    // lo que se escribe en la cuota manda sobre la calculada (el ajuste programático usa `emitEvent: false`, no pasa por aquí)
    cuotaMensual.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.alEscribirCuota();
      this.disparar$.next();
    });
    fecha.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.disparar$.next());

    this.disparar$
      .pipe(
        debounceTime(350),
        switchMap(() => {
          const pedido = this.pedido();
          this.erroresCampo = {};
          this.errorSimulacion = null;
          if (!pedido) {
            this.simulando = false;
            return of({ simulacion: null as SimulacionRefinanciamiento | null, error: null as unknown });
          }
          this.simulando = true;
          return this.api.simular(pedido).pipe(
            map((simulacion) => ({ simulacion, error: null as unknown })),
            catchError((error) => of({ simulacion: null as SimulacionRefinanciamiento | null, error }))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(({ simulacion, error }) => {
        this.simulando = false;
        this.simulacion = simulacion;
        if (error) this.registrarErrorSimulacion(error);
        this.difMensual = simulacion ? lecturaDiferenciaMensual(simulacion.resultado.diferenciaMensual) : null;
        this.difTotal = simulacion ? lecturaDiferenciaTotal(simulacion.resultado.diferenciaTotal) : null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ───────── estado general ─────────

  /** Vuelve al paso 1 sin nada elegido (cada vez que se abre el asistente). */
  reiniciar(): void {
    this.paso = 1;
    this.tarjetaId = null;
    this.candidatas = [];
    this.cargandoCandidatas = false;
    this.errorCandidatas = null;
    this.seleccion = new Set();
    this.totales = totalesDeSeleccion([], this.seleccion);
    this.cuotaAMano = false;
    this.form.reset({ numeroCuotas: null, tipoTasa: 'mensual', tasa: null, cuotaMensual: null, fecha: hoyIso() }, { emitEvent: false });
    this.simulacion = null;
    this.simulando = false;
    this.errorSimulacion = null;
    this.erroresCampo = {};
    this.difMensual = null;
    this.difTotal = null;
    this.concepto = '';
    this.descripcion = '';
    this.ejecutando = false;
    this.errorEjecucion = null;
  }

  get tarjeta(): ItemTarjeta | undefined {
    return this.tarjetas.find((t) => t.id === this.tarjetaId);
  }

  get puedeAvanzar(): boolean {
    if (this.paso === 1) return this.totales.cantidad > 0 && !this.cargandoCandidatas;
    if (this.paso === 2) return !!this.simulacion && !this.simulando && !this.errorSimulacion;
    return !this.ejecutando;
  }

  // ───────── paso 1 ─────────

  elegirTarjeta(id: number | null): void {
    const nueva = id === null || id === undefined || (id as unknown) === '' ? null : Number(id);
    if (nueva === this.tarjetaId && this.candidatas.length > 0) return;
    this.tarjetaId = nueva;
    this.candidatas = [];
    this.seleccion = new Set();
    this.recalcularTotales();
    this.simulacion = null;
    this.errorCandidatas = null;
    if (nueva === null) return;
    this.cargarCandidatas(nueva);
  }

  reintentarCandidatas(): void {
    if (this.tarjetaId !== null) this.cargarCandidatas(this.tarjetaId);
  }

  private cargarCandidatas(tarjetaId: number): void {
    const version = ++this.candidatasVersion;
    this.cargandoCandidatas = true;
    this.errorCandidatas = null;
    this.api.candidatas(tarjetaId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (lista) => {
        if (version !== this.candidatasVersion) return; // llegó tarde: ya eligieron otra tarjeta
        this.candidatas = lista;
        this.cargandoCandidatas = false;
      },
      error: (error) => {
        if (version !== this.candidatasVersion) return;
        this.cargandoCandidatas = false;
        this.errorCandidatas = mensajeDeError(error, 'No se pudieron cargar las compras de la tarjeta.');
      },
    });
  }

  alternar(id: number): void {
    const siguiente = new Set(this.seleccion);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    this.seleccion = siguiente;
    this.recalcularTotales();
  }

  seleccionarTodas(): void {
    this.seleccion = new Set(this.candidatas.map((c) => c.id));
    this.recalcularTotales();
  }

  limpiarSeleccion(): void {
    this.seleccion = new Set();
    this.recalcularTotales();
  }

  get todasSeleccionadas(): boolean {
    return this.candidatas.length > 0 && this.seleccion.size === this.candidatas.length;
  }

  porId(_: number, c: CandidataRefinanciamiento): number {
    return c.id;
  }

  responsablesDe(c: CandidataRefinanciamiento): ResponsableVista[] {
    return c.responsables.map((r) => {
      const p = this.personaDe(r.personaId);
      return { ...p, nombre: `${p.nombre} · ${r.porcentaje}%` };
    });
  }

  /** Nombre, iniciales y color de una persona (del catálogo compartido; si aún no llegó, lo que sepa la lista de personas). */
  private personaDe(id: number): ResponsableVista {
    const p = this.personas.find((x) => x.id === id);
    const nombre = p?.nombre || this.listas.getNombrePersonaById(id) || 'Persona';
    const iniciales = p?.iniciales || nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    return { iniciales, color: p?.color || '', nombre };
  }

  private recalcularTotales(): void {
    this.totales = totalesDeSeleccion(this.candidatas, this.seleccion);
    this.actualizarCuotaEstimada();
    this.disparar$.next();
  }

  // ───────── paso 2 ─────────

  /** La persona cambió el campo de la cuota: lo que escriba manda (cuota exacta del banco). Vaciarlo vuelve a la calculada. */
  alEscribirCuota(): void {
    const valor = this.form.controls.cuotaMensual.value;
    this.cuotaAMano = valor !== null && valor !== undefined && Number(valor) > 0;
    if (!this.cuotaAMano) this.actualizarCuotaEstimada();
  }

  usarCuotaCalculada(): void {
    this.cuotaAMano = false;
    this.actualizarCuotaEstimada();
    this.disparar$.next();
  }

  /** Cuota que sale de la fórmula con lo escrito (sirve de valor inicial editable del campo «cuota»). */
  get cuotaCalculada(): number | null {
    const v = this.form.getRawValue();
    return cuotaEstimada(this.totales.saldo, v.numeroCuotas, v.tipoTasa, v.tasa);
  }

  /** La tasa efectiva anual equivalente a lo escrito, para que se entienda en las dos unidades. */
  get equivalenteTasa(): { etiqueta: string; valor: number } | null {
    const v = this.form.getRawValue();
    if (v.tasa === null || v.tasa === undefined || !(v.tasa >= 0)) return null;
    if (v.tipoTasa === 'mensual') return { etiqueta: 'E.A.', valor: tasaEfectivaAnual(v.tasa) };
    const mensual = (Math.pow(1 + v.tasa / 100, 1 / 12) - 1) * 100;
    return { etiqueta: 'M.V.', valor: mensual };
  }

  elegirTipoTasa(tipo: TipoTasa): void {
    if (this.form.controls.tipoTasa.value === tipo) return;
    this.form.controls.tipoTasa.setValue(tipo);
  }

  private actualizarCuotaEstimada(): void {
    if (this.cuotaAMano) return;
    const estimada = this.cuotaCalculada;
    const actual = this.form.controls.cuotaMensual.value;
    if (estimada !== actual) this.form.controls.cuotaMensual.setValue(estimada, { emitEvent: false });
  }

  private entrada(): EntradaSimulacion {
    const v = this.form.getRawValue();
    return {
      tarjetaId: this.tarjetaId,
      compraIds: [...this.seleccion],
      numeroCuotas: v.numeroCuotas === null ? null : Number(v.numeroCuotas),
      tipoTasa: v.tipoTasa,
      tasa: v.tasa === null || v.tasa === undefined || (v.tasa as unknown) === '' ? null : Number(v.tasa),
      cuotaMensual: v.cuotaMensual === null || v.cuotaMensual === undefined || (v.cuotaMensual as unknown) === '' ? null : Number(v.cuotaMensual),
      cuotaPactada: this.cuotaAMano,
      fecha: v.fecha || null,
    };
  }

  private pedido() {
    return pedidoDeSimulacion(this.entrada());
  }

  private registrarErrorSimulacion(error: unknown): void {
    const campos = (error as { error?: { errors?: Record<string, unknown> } } | null)?.error?.errors;
    const porCampo: Record<string, string> = {};
    if (campos && typeof campos === 'object') {
      for (const [campo, valor] of Object.entries(campos)) {
        const texto = Array.isArray(valor) ? String(valor[0] ?? '') : String(valor ?? '');
        if (texto) porCampo[campo] = texto;
      }
    }
    this.erroresCampo = porCampo;
    this.errorSimulacion = Object.keys(porCampo).length > 0 ? 'Revisa los datos de la simulación.' : mensajeDeError(error, 'No se pudo simular. Inténtalo de nuevo.');
  }

  /** ¿La cuota del banco implica una tasa distinta a la que dijo el asesor? (incluye seguros o cargos) */
  get avisoTasaReal(): string | null {
    const r = this.simulacion?.resultado;
    if (!r) return null;
    const distinta = r.tasaInformadaPct === null ? r.cuotaPactada !== null : Math.abs(r.tasaMensualPct - r.tasaInformadaPct) > 0.005;
    if (!distinta) return null;
    const mv = aCentavos2(r.tasaMensualPct);
    const ea = aCentavos2(r.tasaEfectivaAnualPct);
    return `Con esa cuota, la tasa real es ${mv} % mensual (${ea} % E.A.): incluye los seguros y cargos del banco.`;
  }

  // ───────── navegación entre pasos ─────────

  siguiente(): void {
    if (!this.puedeAvanzar) return;
    if (this.paso === 1) {
      this.paso = 2;
      this.actualizarCuotaEstimada();
      this.disparar$.next();
    } else if (this.paso === 2) {
      this.paso = 3;
    }
  }

  atras(): void {
    if (this.paso > 1 && !this.ejecutando) this.paso = (this.paso - 1) as PasoUnificar;
  }

  cancelar(): void {
    this.modal.close();
  }

  // ───────── paso 3 ─────────

  /** Nombre con el que se guardará la obligación nueva si la persona no escribe otro. */
  get conceptoSugerido(): string {
    const t = this.tarjeta;
    const nombre = t ? [t.franquicia, t.descripcion].filter(Boolean).join(' ') || t.alias || t.nombre : '';
    return `Refinanciamiento ${nombre} ${this.form.controls.fecha.value || hoyIso()}`.replace(/\s+/g, ' ').trim();
  }

  responsablesDeLaNueva(): Array<ResponsableVista & { porcentaje: number; monto: number }> {
    return (this.simulacion?.responsables ?? []).map((r) => ({ ...this.personaDe(r.personaId), porcentaje: r.porcentaje, monto: r.monto }));
  }

  get comprasElegidas(): CandidataRefinanciamiento[] {
    return this.candidatas.filter((c) => this.seleccion.has(c.id));
  }

  confirmar(): void {
    const pedido = this.pedido();
    if (!pedido || this.ejecutando || !this.simulacion) return;
    this.ejecutando = true;
    this.errorEjecucion = null;
    const concepto = this.concepto.trim();
    const descripcion = this.descripcion.trim();
    this.api
      .ejecutar({ ...pedido, ...(concepto ? { concepto } : {}), ...(descripcion ? { descripcion } : {}) })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.ejecutando = false;
          this.toast.exito(`Deuda unificada: ${res.absorbidas.length} compra${res.absorbidas.length === 1 ? '' : 's'} en ${res.numeroCuotas} cuotas.`);
          this.sugerencias.invalidar();
          this.modal.close();
          this.modal.notifyCompraCreated();
          void this.router.navigate(['/compra-credito-detalle', res.id]);
        },
        error: (error) => {
          this.ejecutando = false;
          this.errorEjecucion = mensajeDeError(error, 'No se pudo unificar la deuda. No se cambió nada.');
          this.toast.error(this.errorEjecucion);
        },
      });
  }

  /** Para buscar dentro de la lista cuando hay muchas compras. */
  busqueda = '';
  get candidatasVisibles(): CandidataRefinanciamiento[] {
    const q = normalizeSearchText(this.busqueda);
    if (!q) return this.candidatas;
    return this.candidatas.filter((c) => normalizeSearchText(`${c.concepto} ${c.plasticoUltimos4 ?? ''}`).includes(q));
  }
}
