import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { AuthServiceService } from '../../services/auth-service.service';
import { LayoutMenu, MenuStateService } from '../../services/menu-state.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../toast/toast.service';
import { GRUPOS_MENU, GrupoMenu, ItemMenu, MAX_FAVORITOS } from './menu.config';
import { ItemEnGrupo, buscar, etiquetaCorta, itemActivo, itemsFavoritos } from './menu.helpers';

/**
 * Navegación principal. Se adapta al dispositivo (ver `LayoutMenu`):
 *  - escritorio: barra lateral con grupos que se despliegan de uno en uno (nunca hace falta scroll), buscador,
 *    favoritos y modo compacto (solo íconos, con los grupos como menús emergentes);
 *  - tablet y móvil: barra superior con la sección actual y un panel deslizable con lo mismo;
 *  - móvil: además una barra inferior con los 4 favoritos y «Más».
 * Atajos: `Ctrl/⌘ + K` busca una sección; `Esc` cierra el panel, el menú emergente o limpia la búsqueda.
 */
@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  readonly grupos = GRUPOS_MENU;
  readonly maxFavoritos = MAX_FAVORITOS;

  layout: LayoutMenu = 'sidebar';
  drawerAbierto = false;
  isDarkTheme = true;
  isUserLoggedIn$!: Observable<boolean>;

  /** Texto del buscador y lo que coincide, de más a menos relevante (se recalcula al escribir). */
  consulta = '';
  resultados: ItemEnGrupo[] = [];
  indiceResultado = 0;
  readonly etiquetaCorta = etiquetaCorta;

  favoritos: string[] = [];
  itemsFavoritos: ItemEnGrupo[] = [];

  activo: ItemEnGrupo | null = null;
  /** Único grupo desplegado: el de la sección actual, o el que la persona abra. */
  grupoAbierto: string | null = null;

  /** Menú emergente de un grupo en el modo compacto. */
  flyout: { grupo: GrupoMenu; top: number } | null = null;

  @ViewChild('buscador') buscador?: ElementRef<HTMLInputElement>;
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  @ViewChild('botonAbrir') botonAbrir?: ElementRef<HTMLButtonElement>;

  private destroy$ = new Subject<void>();
  private inicioToque: { x: number; y: number } | null = null;

  constructor(
    private authService: AuthServiceService,
    public themeService: ThemeService,
    public estado: MenuStateService,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.isUserLoggedIn$ = this.authService.isLoggedIn$;

    this.estado.layout$.pipe(takeUntil(this.destroy$)).subscribe((l) => {
      this.layout = l;
      this.flyout = null;
    });
    this.estado.drawerAbierto$.pipe(takeUntil(this.destroy$)).subscribe((abierto) => (this.drawerAbierto = abierto));
    this.estado.favoritos$.pipe(takeUntil(this.destroy$)).subscribe((f) => {
      this.favoritos = f;
      this.itemsFavoritos = itemsFavoritos(this.grupos, f);
    });
    this.themeService.isDarkMode$.pipe(takeUntil(this.destroy$)).subscribe((dark) => (this.isDarkTheme = dark));

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e) => this.alNavegar(e.urlAfterRedirects));
    this.alNavegar(this.router.url);

    // Valida el token contra el backend al iniciar: si expiró, isLoggedIn$ pasa a false y el menú desaparece.
    this.authService.isAuthenticated().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── estado derivado ──

  /** Panel deslizable (tablet y móvil) en lugar de barra lateral. */
  get esPanel(): boolean {
    return this.layout === 'drawer' || this.layout === 'movil';
  }

  get esCompacto(): boolean {
    return this.layout === 'rail';
  }

  get buscando(): boolean {
    return this.consulta.trim().length > 0;
  }

  get tituloActual(): string {
    return this.activo?.item.etiqueta ?? 'Finanzas Make';
  }

  get sinResultados(): boolean {
    return this.buscando && this.resultados.length === 0;
  }

  private alNavegar(url: string): void {
    this.activo = itemActivo(this.grupos, url);
    if (this.activo) this.grupoAbierto = this.activo.grupo.id;
    this.limpiarBusqueda();
    this.flyout = null;
    this.estado.cerrarDrawer();
  }

  esActivo(item: ItemMenu): boolean {
    return this.activo?.item.id === item.id;
  }

  grupoActivo(grupo: GrupoMenu): boolean {
    return this.activo?.grupo.id === grupo.id;
  }

  // ── grupos ──

  estaAbierto(grupo: GrupoMenu): boolean {
    return this.grupoAbierto === grupo.id;
  }

  alternarGrupo(grupo: GrupoMenu): void {
    this.grupoAbierto = this.grupoAbierto === grupo.id ? null : grupo.id;
  }

  // ── buscador ──

  onConsulta(valor: string): void {
    this.consulta = valor;
    this.resultados = buscar(this.grupos, valor);
    this.indiceResultado = 0;
  }

  limpiarBusqueda(): void {
    if (this.consulta) this.onConsulta('');
  }

  esResultadoActivo(item: ItemMenu): boolean {
    return this.buscando && this.resultados[this.indiceResultado]?.item.id === item.id;
  }

  teclaBuscador(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (this.resultados.length === 0) return;
      e.preventDefault();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      this.indiceResultado = (this.indiceResultado + paso + this.resultados.length) % this.resultados.length;
    } else if (e.key === 'Enter') {
      const elegido = this.resultados[this.indiceResultado];
      if (elegido) {
        e.preventDefault();
        this.router.navigateByUrl(elegido.item.ruta);
      }
    } else if (e.key === 'Escape') {
      if (this.consulta) {
        e.preventDefault();
        e.stopPropagation();
        this.limpiarBusqueda();
      }
    }
  }

  /** Lleva el cursor al buscador (abriendo el panel o expandiendo la barra compacta si hace falta). */
  enfocarBuscador(): void {
    if (this.layout === 'rail') this.estado.fijarColapsado(false);
    if (this.esPanel) this.estado.abrirDrawer();
    setTimeout(() => this.buscador?.nativeElement.focus(), this.esPanel ? 260 : 30);
  }

  @HostListener('document:keydown', ['$event'])
  teclaGlobal(e: KeyboardEvent): void {
    if (this.layout === 'invitado') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.enfocarBuscador();
    } else if (e.key === 'Escape') {
      if (this.flyout) this.flyout = null;
      else if (this.drawerAbierto) this.cerrarDrawer();
    }
  }

  // ── favoritos ──

  esFavorito(item: ItemMenu): boolean {
    return this.favoritos.includes(item.id);
  }

  alternarFavorito(item: ItemMenu, e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    const r = this.estado.alternarFavorito(item.id);
    if (r.lleno) this.toast.info(`Ya tienes ${this.maxFavoritos} favoritos: quita uno para fijar «${item.etiqueta}».`);
  }

  // ── barra lateral ──

  alternarColapsado(): void {
    this.estado.alternarColapsado();
  }

  /** Menú emergente de un grupo en el modo compacto. */
  abrirFlyout(grupo: GrupoMenu, e: Event): void {
    e.stopPropagation();
    if (this.flyout?.grupo.id === grupo.id) {
      this.flyout = null;
      return;
    }
    const boton = e.currentTarget as HTMLElement;
    const top = boton.getBoundingClientRect().top;
    // 44 px por ítem + cabecera: se evita que el menú se salga por abajo
    const alto = 56 + grupo.items.length * 44;
    this.flyout = { grupo, top: Math.max(8, Math.min(top, window.innerHeight - alto - 8)) };
  }

  @HostListener('document:click', ['$event'])
  clicFuera(e: MouseEvent): void {
    if (this.flyout && !(e.target as HTMLElement).closest('.flyout, .rail-grupo')) this.flyout = null;
  }

  // ── panel deslizable ──

  abrirDrawer(): void {
    this.estado.abrirDrawer();
    setTimeout(() => this.panel?.nativeElement.querySelector<HTMLElement>('.panel-cerrar')?.focus(), 280);
  }

  cerrarDrawer(devolverFoco = true): void {
    this.estado.cerrarDrawer();
    if (devolverFoco) setTimeout(() => this.botonAbrir?.nativeElement.focus(), 0);
  }

  alElegir(): void {
    // volver a pulsar la sección actual no navega (no hay NavigationEnd): el panel se cierra igual
    if (this.drawerAbierto) this.cerrarDrawer(false);
    this.flyout = null;
  }

  /** El foco no se escapa del panel mientras está abierto. */
  teclaPanel(e: KeyboardEvent): void {
    if (!this.drawerAbierto || e.key !== 'Tab') return;
    const enfocables = Array.from(
      this.panel?.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? []
    ).filter((el) => el.offsetParent !== null);
    if (enfocables.length === 0) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  /** Deslizar el panel hacia la izquierda lo cierra. */
  inicioTactil(e: TouchEvent): void {
    const t = e.touches[0];
    this.inicioToque = { x: t.clientX, y: t.clientY };
  }

  finTactil(e: TouchEvent): void {
    if (!this.inicioToque || !this.drawerAbierto) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this.inicioToque.x;
    const dy = Math.abs(t.clientY - this.inicioToque.y);
    this.inicioToque = null;
    if (dx < -70 && dy < 60) this.cerrarDrawer();
  }

  /** Posición de la pestaña activa en la barra inferior (los favoritos y, al final, «Más»); -1 si ninguna sección está activa. */
  get indiceBarra(): number {
    const i = this.itemsFavoritos.findIndex((f) => this.esActivo(f.item));
    if (i >= 0) return i;
    return this.activo ? this.itemsFavoritos.length : -1;
  }

  // ── tema y sesión ──

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /** El servicio de autenticación limpia el token, actualiza el estado y redirige. */
  logout(): void {
    this.estado.cerrarDrawer();
    this.authService.logout();
  }

  trackGrupo(_: number, g: GrupoMenu): string {
    return g.id;
  }

  trackItem(_: number, i: ItemMenu | ItemEnGrupo): string {
    return 'item' in i ? i.item.id : i.id;
  }
}
