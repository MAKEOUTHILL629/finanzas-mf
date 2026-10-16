import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { LineaTiempo, ProductoLineaTiempo } from '../../modelos/linea-tiempo';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { EXPANDIR } from '../../shared/motion';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';
import { DefinicionFiltro, EstadoFiltros, SegmentoFiltro, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';
import {
  BarraProducto,
  ETIQUETA_ESTADO_PRODUCTO,
  ETIQUETA_TIPO_PRODUCTO,
  MarcaAnio,
  SEGMENTOS_PRODUCTOS,
  SegmentoProductos,
  barraDe,
  conteoProductos,
  descripcionProducto,
  duracionLegible,
  filtrarProductos,
  marcasDeAnio,
  montoCorto,
} from './linea-tiempo.helpers';

const ETIQUETA_SEGMENTO: Record<SegmentoProductos, string> = { todos: 'Todos', CREDITO: 'Crédito', DEBITO: 'Débito', CUENTA: 'Cuentas' };
/** Por debajo de este ancho (% de la escala) el texto de la barra no cabe y se escribe a su lado. */
const ANCHO_MINIMO_TEXTO = 16;

/**
 * Periodo de uso de cada tarjeta (por plástico) y cada cuenta, con sus movimientos: una línea de tiempo horizontal (estilo Apple Health)
 * donde cada renglón es un producto y su barra va de cuándo empezó a usarse a cuándo dejó de usarse (o hoy).
 */
@Component({
  selector: 'app-linea-tiempo-productos',
  templateUrl: './linea-tiempo.component.html',
  styleUrl: './linea-tiempo.component.css',
  animations: [EXPANDIR]
})
export class LineaTiempoProductosComponent implements OnInit, OnDestroy {
  readonly secundarias: AccionUI[] = [
    { id: 'tarjetas', etiqueta: 'Tarjetas', icono: 'credit_card', enlace: '/tarjetas', variante: 'ghost', tooltip: 'Ver y configurar tus tarjetas' },
    { id: 'cuentas', etiqueta: 'Cuentas', icono: 'account_balance', enlace: '/cuentas', variante: 'ghost', tooltip: 'Ver tus cuentas' },
  ];
  readonly etiquetaTipo = ETIQUETA_TIPO_PRODUCTO;
  readonly etiquetaEstado = ETIQUETA_ESTADO_PRODUCTO;
  readonly montoCorto = montoCorto;
  readonly duracion = duracionLegible;
  readonly descripcion = descripcionProducto;

  datos: LineaTiempo | null = null;
  visibles: ProductoLineaTiempo[] = [];
  marcas: MarcaAnio[] = [];

  estadoFiltros: EstadoFiltros = estadoVacio('todos');
  segmentos: SegmentoFiltro[] = SEGMENTOS_PRODUCTOS.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: 0 }));
  readonly definicionFiltros: DefinicionFiltro[] = [
    { id: 'estado', tipo: 'seleccion', etiqueta: 'Estado', icono: 'toggle_on', opciones: [{ valor: 'ACTIVA', etiqueta: 'En uso' }, { valor: 'HISTORICA', etiqueta: 'Históricos' }] },
  ];

  /** Renglones con el detalle abierto. */
  private abiertos = new Set<string>();
  private barras = new Map<string, BarraProducto>();

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private tarjetasService: TarjetasService) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.tarjetasService
      .getLineaTiempo()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (d) => {
          this.datos = d;
          this.marcas = marcasDeAnio(d.desde, d.hasta);
          this.barras = new Map(d.productos.map((p) => [p.clave, barraDe(p, d.desde, d.hasta)]));
          this.aplicar();
        },
        error: (err) => {
          this.datos = null;
          this.visibles = [];
          this.error = mensajeDeError(err, 'No se pudo cargar la línea de tiempo.');
        }
      });
  }

  alFiltrar(estado: EstadoFiltros): void {
    this.estadoFiltros = estado;
    this.aplicar();
  }

  private aplicar(): void {
    const productos = this.datos?.productos ?? [];
    this.visibles = filtrarProductos(productos, this.estadoFiltros);
    const c = conteoProductos(productos, this.estadoFiltros);
    this.segmentos = SEGMENTOS_PRODUCTOS.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: c[s] }));
  }

  barra(p: ProductoLineaTiempo): BarraProducto {
    return this.barras.get(p.clave) ?? { izquierda: 0, ancho: 0, abierta: false, sinFechas: true };
  }

  /** Texto que va dentro de la barra: «385 mov. · $40 M». */
  textoBarra(p: ProductoLineaTiempo): string {
    return p.movimientos === 0 ? 'Sin movimientos' : `${p.movimientos.toLocaleString('es-CO')} mov. · ${montoCorto(p.monto)}`;
  }

  /** La barra es muy corta para el texto: se escribe a su derecha (o a su izquierda si está pegada al final). */
  textoAfuera(p: ProductoLineaTiempo): boolean {
    return this.barra(p).ancho < ANCHO_MINIMO_TEXTO;
  }

  textoALaIzquierda(p: ProductoLineaTiempo): boolean {
    const b = this.barra(p);
    return b.izquierda + b.ancho > 70;
  }

  alternar(p: ProductoLineaTiempo): void {
    if (!this.abiertos.delete(p.clave)) this.abiertos.add(p.clave);
  }

  abierto(p: ProductoLineaTiempo): boolean {
    return this.abiertos.has(p.clave);
  }

  /** Dónde se gestiona el producto. */
  enlaceDe(p: ProductoLineaTiempo): { ruta: unknown[]; texto: string } | null {
    if (p.tipo === 'CUENTA') return { ruta: ['/cuentas'], texto: 'Ver cuentas' };
    return p.tarjetaId ? { ruta: ['/tarjetas'], texto: 'Ver tarjetas' } : null;
  }

  trackClave(_: number, p: ProductoLineaTiempo): string {
    return p.clave;
  }
}
