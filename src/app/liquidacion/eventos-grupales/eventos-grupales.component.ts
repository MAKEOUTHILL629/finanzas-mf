import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { EventoGrupal, LiquidacionEvento } from '../../modelos/liquidacion-bilateral';
import { EventosGrupalesService } from '../../services/eventos-grupales.service';
import { CatalogosService } from '../../services/catalogos.service';
import { ItemPersona } from '../../modelos/catalogos';
import { mensajeDeError } from '../../shared/http-error.helper';

@Component({
  selector: 'app-eventos-grupales',
  templateUrl: './eventos-grupales.component.html',
  styleUrl: './eventos-grupales.component.css',
})
export class EventosGrupalesComponent implements OnInit, OnDestroy {
  eventos: EventoGrupal[] = [];
  personas: ItemPersona[] = [];
  liquidacion: LiquidacionEvento | null = null;
  error: string | null = null;
  cargando = false;

  nuevoNombre = '';
  nuevoParticipantes: Array<{ personaId: number | null; aliasBloque: string; peso: number }> = [{ personaId: null, aliasBloque: '', peso: 1 }];
  gastoTexto = '';
  gastoMonto: number | null = null;
  gastoPagador: number | null = null;

  private destroy$ = new Subject<void>();

  constructor(private eventosService: EventosGrupalesService, private catalogos: CatalogosService) {}

  ngOnInit(): void {
    this.catalogos.estado$('personas').pipe(takeUntil(this.destroy$)).subscribe((e) => (this.personas = e.datos));
    this.catalogos.asegurar(['personas']);
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.eventosService.listar().pipe(takeUntil(this.destroy$), finalize(() => (this.cargando = false))).subscribe({
      next: (e) => (this.eventos = e),
      error: (err) => (this.error = mensajeDeError(err, 'No se pudieron cargar los eventos.')),
    });
  }

  agregarParticipante(): void {
    this.nuevoParticipantes.push({ personaId: null, aliasBloque: '', peso: 1 });
  }

  crearEvento(): void {
    const participantes = this.nuevoParticipantes.filter((p) => p.personaId !== null).map((p) => ({ personaId: p.personaId as number, aliasBloque: p.aliasBloque || undefined, peso: p.peso || 1 }));
    if (!this.nuevoNombre.trim() || participantes.length === 0) return;
    this.eventosService.crear({ nombre: this.nuevoNombre.trim(), participantes }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.nuevoNombre = ''; this.cargar(); },
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo crear el evento.')),
    });
  }

  verLiquidacion(evento: EventoGrupal): void {
    this.eventosService.liquidacion(evento.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (l) => (this.liquidacion = l),
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo liquidar el evento.')),
    });
  }

  agregarGasto(evento: EventoGrupal): void {
    if (!this.gastoTexto.trim() || !this.gastoMonto || !this.gastoPagador) return;
    this.eventosService.agregarGasto(evento.id, { descripcion: this.gastoTexto.trim(), montoTotal: this.gastoMonto, pagadoPorParticipanteId: this.gastoPagador }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.gastoTexto = ''; this.gastoMonto = null; this.verLiquidacion(evento); },
      error: (err) => (this.error = mensajeDeError(err, 'No se pudo agregar el gasto.')),
    });
  }

  nombrePersona(id: number): string {
    if (this.liquidacion) {
      const b = this.liquidacion.balances.find((x) => x.personaId === id);
      if (b?.alias) return b.alias;
    }
    return this.personas.find((p) => p.id === id)?.nombre ?? `Persona ${id}`;
  }
}
