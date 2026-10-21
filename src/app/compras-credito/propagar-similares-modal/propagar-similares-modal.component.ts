import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  CompraSimilarCandidata,
  PropagarEdicionSimilaresPayload,
  ResultadoBusquedaSimilares,
} from '../../modelos/compras-credito';
import { normalizeSearchText } from '../../shared/utils';

@Component({
  selector: 'app-propagar-similares-modal',
  templateUrl: './propagar-similares-modal.component.html',
  styleUrl: './propagar-similares-modal.component.css',
})
export class PropagarSimilaresModalComponent implements OnChanges {
  @Input() resultado: ResultadoBusquedaSimilares | null = null;
  @Input() guardando = false;
  @Output() confirmar = new EventEmitter<PropagarEdicionSimilaresPayload>();
  @Output() omitir = new EventEmitter<void>();

  aplicarCuotas = true;
  aplicarResponsables = true;
  aplicarTags = true;
  aplicarComercioCanonico = true;

  filtroBusqueda = '';
  seleccionadasIds = new Set<number>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resultado'] && this.resultado) {
      this.seleccionadasIds = new Set(this.resultado.candidatas.map((c) => c.id));
      this.filtroBusqueda = '';
      this.aplicarCuotas = true;
      this.aplicarResponsables = (this.resultado.compraOrigen.responsables?.length ?? 0) > 0;
      this.aplicarTags = (this.resultado.compraOrigen.tags?.length ?? 0) > 0;
      this.aplicarComercioCanonico = !!this.resultado.compraOrigen.comercioCanonico;
    }
  }

  get candidatasFiltradas(): CompraSimilarCandidata[] {
    const lista = this.resultado?.candidatas ?? [];
    const q = normalizeSearchText(this.filtroBusqueda.trim());
    if (!q) return lista;
    return lista.filter((c) => {
      const texto = normalizeSearchText(
        `${c.concepto} ${c.descripcion} ${c.fechaCompra ?? ''} ${c.valorTotal} ${c.tarjetaNombre}`,
      );
      return texto.includes(q);
    });
  }

  get totalSeleccionadas(): number {
    return this.seleccionadasIds.size;
  }

  get todasSeleccionadas(): boolean {
    const visibles = this.candidatasFiltradas;
    return visibles.length > 0 && visibles.every((c) => this.seleccionadasIds.has(c.id));
  }

  estaSeleccionada(id: number): boolean {
    return this.seleccionadasIds.has(id);
  }

  alternarSeleccion(id: number): void {
    const copia = new Set(this.seleccionadasIds);
    if (copia.has(id)) copia.delete(id);
    else copia.add(id);
    this.seleccionadasIds = copia;
  }

  alternarTodas(): void {
    const visibles = this.candidatasFiltradas;
    const copia = new Set(this.seleccionadasIds);
    if (this.todasSeleccionadas) {
      visibles.forEach((c) => copia.delete(c.id));
    } else {
      visibles.forEach((c) => copia.add(c.id));
    }
    this.seleccionadasIds = copia;
  }

  get resumenResponsablesOrigen(): string {
    const resps = this.resultado?.compraOrigen.responsables ?? [];
    if (resps.length === 0) return 'Sin responsables';
    return resps.map((r) => `${r.nombre} (${r.porcentajePago}%)`).join(', ');
  }

  get puedeConfirmar(): boolean {
    return (
      this.totalSeleccionadas > 0 &&
      (this.aplicarCuotas || this.aplicarResponsables || this.aplicarTags || this.aplicarComercioCanonico) &&
      !this.guardando
    );
  }

  emitirConfirmacion(): void {
    if (!this.resultado || !this.puedeConfirmar) return;
    this.confirmar.emit({
      compraOrigenId: this.resultado.compraOrigen.id,
      compraDestinoIds: [...this.seleccionadasIds],
      aplicarCuotas: this.aplicarCuotas,
      aplicarResponsables: this.aplicarResponsables,
      aplicarTags: this.aplicarTags,
      aplicarComercioCanonico: this.aplicarComercioCanonico,
      modoTags: 'MERGE',
    });
  }
}
