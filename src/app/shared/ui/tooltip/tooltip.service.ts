import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, OnDestroy } from '@angular/core';

export type PosicionTooltip = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

let contador = 0;

/**
 * Un único globo de ayuda para toda la aplicación (nunca dos a la vez). Se dibuja al final del `<body>` para no quedar recortado por
 * contenedores con `overflow` y se acomoda al borde de la pantalla. Lo manejan las directivas `appTooltip`.
 */
@Injectable({ providedIn: 'root' })
export class TooltipService implements OnDestroy {
  private elemento: HTMLElement | null = null;
  private duenio: HTMLElement | null = null;
  private readonly id = `app-tooltip-${++contador}`;

  constructor(@Inject(DOCUMENT) private doc: Document) {}

  mostrar(anfitrion: HTMLElement, texto: string, posicion: PosicionTooltip = 'arriba'): void {
    if (!texto) return;
    this.ocultar();
    const el = this.doc.createElement('div');
    el.id = this.id;
    el.className = 'app-tooltip';
    el.setAttribute('role', 'tooltip');
    el.textContent = texto;
    this.doc.body.appendChild(el);
    this.elemento = el;
    this.duenio = anfitrion;
    anfitrion.setAttribute('aria-describedby', this.id);
    this.colocar(el, anfitrion, posicion);
    // un cuadro después, para que la transición de entrada se vea
    requestAnimationFrame(() => el.classList.add('app-tooltip--visible'));
  }

  /** Oculta el globo; si se indica `anfitrion`, solo cuando es el suyo (otro botón pudo haberlo tomado ya). */
  ocultar(anfitrion?: HTMLElement): void {
    if (anfitrion && this.duenio !== anfitrion) return;
    this.duenio?.removeAttribute('aria-describedby');
    this.elemento?.remove();
    this.elemento = null;
    this.duenio = null;
  }

  ngOnDestroy(): void {
    this.ocultar();
  }

  private colocar(el: HTMLElement, host: HTMLElement, preferida: PosicionTooltip): void {
    const margen = 8;
    const vista = { ancho: this.doc.documentElement.clientWidth, alto: this.doc.documentElement.clientHeight };
    const r = host.getBoundingClientRect();
    const t = el.getBoundingClientRect();

    const candidatas: Record<PosicionTooltip, { x: number; y: number }> = {
      arriba: { x: r.left + r.width / 2 - t.width / 2, y: r.top - t.height - margen },
      abajo: { x: r.left + r.width / 2 - t.width / 2, y: r.bottom + margen },
      izquierda: { x: r.left - t.width - margen, y: r.top + r.height / 2 - t.height / 2 },
      derecha: { x: r.right + margen, y: r.top + r.height / 2 - t.height / 2 },
    };
    const contrario: Record<PosicionTooltip, PosicionTooltip> = { arriba: 'abajo', abajo: 'arriba', izquierda: 'derecha', derecha: 'izquierda' };
    const cabe = (p: { x: number; y: number }) => p.y >= margen && p.y + t.height <= vista.alto - margen && p.x >= margen && p.x + t.width <= vista.ancho - margen;
    let elegida: PosicionTooltip = preferida;
    if (!cabe(candidatas[preferida]) && cabe(candidatas[contrario[preferida]])) elegida = contrario[preferida];
    const p = candidatas[elegida];
    // se mantiene dentro de la pantalla aunque el anfitrión esté pegado al borde
    const x = Math.min(Math.max(p.x, margen), Math.max(margen, vista.ancho - t.width - margen));
    const y = Math.min(Math.max(p.y, margen), Math.max(margen, vista.alto - t.height - margen));
    el.dataset['posicion'] = elegida;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }
}
