import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro, PrestamoDetalle } from '../../modelos/cobros';
import { Persona } from '../../modelos/persona';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { ModalService } from '../../services/modal.service';
import { PersonasService } from '../../services/personas.service';
import { PrestamosService } from '../../services/prestamos.service';
import { sumarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { claseEstadoPrestamo, estaPendiente, resumirAprobaciones, saldoDe } from '../prestamos.constants';

export const MODAL_PRESTAMO = 'prestamo-form';

export interface FiltrosPrestamos {
  texto: string;
  estado: string;
  responsable: string;
  corte: string;
  /** `yyyy-MM-dd` */
  desde: string;
  hasta: string;
}

export const FILTROS_VACIOS: FiltrosPrestamos = { texto: '', estado: '', responsable: '', corte: '', desde: '', hasta: '' };

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra en memoria (son decenas de filas). `corte = 'sin'` selecciona los préstamos sin corte. */
export function filtrarPrestamos(prestamos: PrestamoDetalle[], f: FiltrosPrestamos): PrestamoDetalle[] {
  const texto = sinTildes(f.texto.trim());
  // fechaCobro viaja como epoch-ms a las 00:00 UTC, igual que `Date.parse('yyyy-MM-dd')`
  const desde = f.desde ? Date.parse(f.desde) : null;
  const hasta = f.hasta ? Date.parse(f.hasta) : null;
  return prestamos.filter((p) => {
    if (f.estado && (p.estado ?? '').toLowerCase() !== f.estado.toLowerCase()) return false;
    if (f.responsable && p.responsable !== Number(f.responsable)) return false;
    if (f.corte === 'sin' ? p.corteId !== null : f.corte && p.corteId !== Number(f.corte)) return false;
    if (desde !== null && (p.fechaCobro === null || p.fechaCobro < desde)) return false;
    if (hasta !== null && (p.fechaCobro === null || p.fechaCobro > hasta)) return false;
    if (texto && !sinTildes(`${p.concepto ?? ''} ${p.comentarios ?? ''}`).includes(texto)) return false;
    return true;
  });
}

/** Pendientes primero; luego los más recientes por fecha de cobro. */
export function ordenarPrestamos(prestamos: PrestamoDetalle[]): PrestamoDetalle[] {
  return [...prestamos].sort(
    (a, b) =>
      Number(!estaPendiente(a)) - Number(!estaPendiente(b)) ||
      (b.fechaCobro ?? 0) - (a.fechaCobro ?? 0) ||
      b.id - a.id
  );
}

@Component({
  selector: 'app-tabla-prestamos',
  templateUrl: './tabla-prestamos.component.html',
  styleUrl: './tabla-prestamos.component.css'
})
export class TablaPrestamosComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_PRESTAMO;
  readonly claseEstado = claseEstadoPrestamo;
  readonly resumirAprobaciones = resumirAprobaciones;
  readonly TAM_PAGINA = 40;

  private fb = inject(FormBuilder);
  filtros = this.fb.nonNullable.group({ ...FILTROS_VACIOS });

  prestamos: PrestamoDetalle[] = [];
  visibles: PrestamoDetalle[] = [];
  personas: Persona[] = [];
  cortes: CorteCobro[] = [];
  limite = this.TAM_PAGINA;

  totales = { saldoPorCobrar: 0, pendientes: 0, aprobacionesPendientes: 0, pagados: 0 };

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private prestamosService: PrestamosService,
    private personasService: PersonasService,
    private cortesService: CortesCobroService,
    private modalService: ModalService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.filtros.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.limite = this.TAM_PAGINA;
      this.aplicarFiltros();
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
    forkJoin({
      prestamos: this.prestamosService.getPrestamos(),
      personas: this.personasService.getPersonas(),
      // los nombres de corte son un adorno: si fallan, la tabla sigue funcionando
      cortes: this.cortesService.getCortes().pipe(catchError(() => of([] as CorteCobro[]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ prestamos, personas, cortes }) => {
          this.prestamos = ordenarPrestamos(prestamos ?? []);
          this.personas = personas ?? [];
          this.cortes = cortes;
          this.calcularTotales();
          this.aplicarFiltros();
        },
        error: (err) => {
          this.prestamos = [];
          this.visibles = [];
          this.error = mensajeDeError(err, 'No se pudieron cargar los préstamos.');
        }
      });
  }

  aplicarFiltros(): void {
    this.visibles = filtrarPrestamos(this.prestamos, this.filtros.getRawValue());
  }

  get hayFiltros(): boolean {
    return Object.values(this.filtros.getRawValue()).some((v) => !!v);
  }

  reiniciarFiltros(): void {
    this.filtros.reset({ ...FILTROS_VACIOS });
  }

  verMas(): void {
    this.limite += this.TAM_PAGINA;
  }

  get filasMostradas(): PrestamoDetalle[] {
    return this.visibles.slice(0, this.limite);
  }

  private calcularTotales(): void {
    const pendientes = this.prestamos.filter((p) => estaPendiente(p) && p.direccionPrestamo !== 'POR_PAGAR');
    this.totales = {
      saldoPorCobrar: sumarMonedas(pendientes.map((p) => saldoDe(p))),
      pendientes: pendientes.length,
      aprobacionesPendientes: this.prestamos.reduce((n, p) => n + resumirAprobaciones(p).pendientes, 0),
      pagados: this.prestamos.filter((p) => (p.estado ?? '').toLowerCase() === 'pagado').length,
    };
  }

  abrirFormulario(): void {
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onCreado(): void {
    this.modalService.close();
    this.toast.exito('Préstamo registrado.');
    this.cargar();
  }

  abrirDetalle(p: PrestamoDetalle): void {
    void this.router.navigate(['/prestamos', p.id]);
  }

  nombrePersona(id: number | null | undefined): string {
    return this.personas.find((p) => p.id === id)?.nombre ?? '—';
  }

  nombreCorte(id: number | null | undefined): string {
    return id === null || id === undefined ? '—' : (this.cortes.find((c) => c.id === id)?.concepto ?? `Corte #${id}`);
  }

  saldo(p: PrestamoDetalle): number {
    return saldoDe(p);
  }

  trackById(_: number, p: PrestamoDetalle): number {
    return p.id;
  }
}
