import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ResultadoAbonoPersona } from '../../modelos/erp';
import { EstadoCuentaPersonas, ResumenPersona } from '../../modelos/estado-cuenta-personas';
import { EstadoCuentaPersonasService } from '../../services/estado-cuenta-personas.service';
import { ModalService } from '../../services/modal.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { EXPANDIR } from '../../shared/motion';
import { MODAL_ABONO_PERSONA, SegmentoTarjeta, aPersonaDeAbono, claseEstadoDeuda, etiquetaEstadoDeuda, iniciales, segmentosPorTarjeta } from '../personas.constants';
import { ACCION_MES_ACTUAL, AccionUI, ListaAcciones } from '../../shared/ui/acciones/acciones.component';

@Component({
  selector: 'app-lista-personas',
  templateUrl: './lista-personas.component.html',
  styleUrl: './lista-personas.component.css',
  animations: [EXPANDIR]
})
export class ListaPersonasComponent implements OnInit, OnDestroy {
  private readonly accSecundarias = new ListaAcciones();
  get secundarias(): AccionUI[] {
    return this.accSecundarias.obtener(String(this.esMesActual()), () => [
      { id: 'cobros', etiqueta: 'Cobros', icono: 'request_quote', enlace: '/cobros', tooltip: 'Repartir gastos y compartir el cobro con cada persona' },
      ...(this.esMesActual() ? [] : [ACCION_MES_ACTUAL]),
    ]);
  }

  alAccionar(id: string): void {
    if (id === 'mes-actual') this.irAlMesActual();
  }

  readonly modalId = MODAL_ABONO_PERSONA;
  readonly iniciales = iniciales;
  readonly etiquetaEstado = etiquetaEstadoDeuda;
  readonly claseEstado = claseEstadoDeuda;
  readonly aPersonaDeAbono = aPersonaDeAbono;

  periodo = periodoActual();
  datos: EstadoCuentaPersonas | null = null;
  verTodas = false;
  cargando = true;
  error: string | null = null;

  /** Persona con el desglose abierto (solo una a la vez: el detalle pide sus compras al servidor). */
  abierta: number | null = null;
  /** Persona a la que se registra un abono. */
  abonando: ResumenPersona | null = null;

  private readonly ruta = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();
  private segmentos = new Map<number, SegmentoTarjeta[]>();

  constructor(
    private servicio: EstadoCuentaPersonasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // El inicio enlaza con `?persona=ID`: esa persona llega con el desglose abierto.
    const persona = Number(this.ruta.snapshot.queryParamMap.get('persona'));
    if (Number.isInteger(persona) && persona > 0) this.abierta = persona;
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.abonando = null;
    });
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.servicio
      .getResumen(this.periodo, this.verTodas)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (d) => {
          this.datos = d;
          this.segmentos.clear();
          if (this.abierta !== null && !d.personas.some((p) => p.persona.id === this.abierta)) this.abierta = null;
        },
        error: (err) => {
          this.datos = null;
          this.abierta = null;
          this.error = mensajeDeError(err, 'No se pudo cargar lo que debe cada persona.');
        }
      });
  }

  get personas(): ResumenPersona[] {
    return this.datos?.personas ?? [];
  }

  /** Barra apilada de cuánto del pago del mes viene de cada tarjeta (se calcula una vez por carga, no en cada ciclo de detección). */
  segmentosDe(p: ResumenPersona): SegmentoTarjeta[] {
    let s = this.segmentos.get(p.persona.id);
    if (!s) {
      s = segmentosPorTarjeta(p.porTarjeta);
      this.segmentos.set(p.persona.id, s);
    }
    return s;
  }

  // ── periodo ──

  onPeriodoChange(valor: string): void {
    if (!esPeriodoValido(valor)) return;
    this.periodo = valor;
    this.cargar();
  }

  moverPeriodo(delta: number): void {
    this.periodo = desplazarPeriodo(this.periodo, delta);
    this.cargar();
  }

  irAlMesActual(): void {
    this.periodo = periodoActual();
    this.cargar();
  }

  esMesActual(): boolean {
    return this.periodo === periodoActual();
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  alternarTodas(): void {
    this.verTodas = !this.verTodas;
    this.cargar();
  }

  // ── desglose ──

  alternar(p: ResumenPersona): void {
    this.abierta = this.abierta === p.persona.id ? null : p.persona.id;
  }

  // ── abonos ──

  abrirAbono(p: ResumenPersona): void {
    this.abonando = p;
    this.modalService.open(this.modalId);
  }

  cerrarAbono(): void {
    this.modalService.close();
  }

  onAbonado(r: ResultadoAbonoPersona): void {
    this.modalService.close();
    this.toast.exito(`Abono registrado: ${moneda(r.monto)} (movimiento #${r.movimientoId}).`);
    this.cargar();
  }

  trackPersona(_: number, p: ResumenPersona): number {
    return p.persona.id;
  }

  trackSegmento(_: number, s: SegmentoTarjeta): string {
    return s.clave;
  }
}
