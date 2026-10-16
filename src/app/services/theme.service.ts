import { Injectable, RendererFactory2, Renderer2, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type Theme = 'dark' | 'light';
/** Lo que el usuario elige: un tema fijo, o «sistema» (sigue al sistema operativo). */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Lo mínimo que usamos de `ViewTransition` (aún no está en todos los tipos de TypeScript). */
interface ViewTransitionLike {
  ready?: Promise<void>;
  finished?: Promise<void>;
  updateCallbackDone?: Promise<void>;
}

/** Color de la barra del navegador (móvil) en cada tema: el mismo fondo de la app. */
const THEME_COLOR: Record<Theme, string> = { light: '#F5F5F7', dark: '#000000' };

@Injectable({
  providedIn: 'root'
})
export class ThemeService implements OnDestroy {

  private readonly THEME_KEY = 'finanzas-theme';
  private readonly DEFAULT_FALLBACK: Theme = 'dark';

  private renderer: Renderer2;
  private _theme$ = new BehaviorSubject<Theme>(this.DEFAULT_FALLBACK);
  private mediaQueryList?: MediaQueryList;
  private mediaQueryListener?: (e: MediaQueryListEvent) => void;
  private storageListener?: (e: StorageEvent) => void;

  /** Si es `true`, el cambio manual de tema se anima con un fundido (View Transitions). Las pruebas lo desactivan para ser síncronas. */
  public animarCambios = true;

  /** Observable del tema actual ('dark' | 'light') */
  public theme$: Observable<Theme> = this._theme$.asObservable();

  /** Observable booleano indicando si el modo oscuro está activo */
  public isDarkMode$: Observable<boolean> = this._theme$.pipe(
    map(theme => theme === 'dark')
  );

  private _preference$ = new BehaviorSubject<ThemePreference>('system');

  /** Preferencia elegida: 'system' mientras no haya un tema guardado manualmente. */
  public preference$: Observable<ThemePreference> = this._preference$.asObservable();

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);

    // 1. Resolver e inicializar tema (localStorage o SO)
    const initialTheme = this.resolveInitialTheme();
    this.applyTheme(initialTheme, false);

    // 2. Escuchar cambios del sistema operativo en tiempo real
    this.setupSystemThemeListener();

    // 3. Sincronizar cambios entre pestañas del navegador
    this.setupStorageListener();
  }

  ngOnDestroy(): void {
    if (this.mediaQueryList && this.mediaQueryListener) {
      if (typeof this.mediaQueryList.removeEventListener === 'function') {
        this.mediaQueryList.removeEventListener('change', this.mediaQueryListener);
      } else {
        (this.mediaQueryList as any).removeListener(this.mediaQueryListener);
      }
    }

    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener);
    }
  }

  get currentTheme(): Theme {
    return this._theme$.value;
  }

  get preference(): ThemePreference {
    return this._preference$.value;
  }

  get isDark(): boolean {
    return this._theme$.value === 'dark';
  }

  isDarkMode(): boolean {
    return this.isDark;
  }

  /**
   * Indica si el tema actual fue elegido manualmente por el usuario y guardado en localStorage.
   */
  isManualPreference(): boolean {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      return saved === 'light' || saved === 'dark';
    } catch {
      return false;
    }
  }

  /**
   * Asegura la inicialización y aplicación temprana del tema en el DOM.
   */
  initTheme(): void {
    const theme = this.resolveInitialTheme();
    this.applyTheme(theme, false);
    this.liberarTransiciones();
  }

  /**
   * Elige «sistema», «claro» u «oscuro». «Sistema» borra lo guardado y vuelve a seguir al sistema operativo.
   */
  setPreference(pref: ThemePreference): void {
    if (pref === 'system') {
      this.resetToSystemTheme();
    } else {
      this.setTheme(pref);
    }
  }

  /**
   * Alterna entre oscuro y claro, persistiendo la decisión en localStorage.
   */
  toggle(): void {
    const next: Theme = this._theme$.value === 'dark' ? 'light' : 'dark';
    this.applyTheme(next, true);
  }

  /**
   * Alias para toggle() garantizando retrocompatibilidad con componentes existentes.
   */
  toggleTheme(): void {
    this.toggle();
  }

  /**
   * Aplica un tema explícito y lo guarda en localStorage.
   */
  setTheme(theme: Theme): void {
    this.applyTheme(theme, true);
  }

  /**
   * Restablece la preferencia de tema al esquema configurado en el sistema operativo.
   */
  resetToSystemTheme(): void {
    try {
      localStorage.removeItem(this.THEME_KEY);
    } catch {
      /* ignore */
    }
    const systemTheme = this.getSystemTheme();
    this.applyTheme(systemTheme, false, true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTODOS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  private resolveInitialTheme(): Theme {
    const saved = this.loadSavedTheme();
    if (saved) {
      return saved;
    }
    return this.getSystemTheme();
  }

  private loadSavedTheme(): Theme | null {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private getSystemTheme(): Theme {
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? 'dark' : 'light';
      } catch {
        return this.DEFAULT_FALLBACK;
      }
    }
    return this.DEFAULT_FALLBACK;
  }

  private applyTheme(theme: Theme, persist: boolean, animar: boolean = persist): void {
    const cambio = theme !== this._theme$.value;

    if (persist) {
      try {
        localStorage.setItem(this.THEME_KEY, theme);
      } catch {
        /* ignore */
      }
    }

    // El DOM y los observadores se actualizan juntos: quien reacciona al tema (p. ej. los gráficos) ya encuentra las variables nuevas.
    const aplicar = () => {
      if (typeof document !== 'undefined') {
        // Sincroniza tanto en <html> (data-theme) como en <body> (para compatibilidad universal)
        this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
        if (document.body) {
          this.renderer.setAttribute(document.body, 'data-theme', theme);
        }
        this.fijarColorDelNavegador(theme);
      }
      this._theme$.next(theme);
      this._preference$.next(persist || this.isManualPreference() ? theme : 'system');
    };

    // Un cambio manual se anima con un fundido de toda la pantalla; el arranque y los cambios del sistema, no.
    if (cambio && animar) {
      this.cambiarSinParpadeo(aplicar);
    } else {
      aplicar();
    }
  }

  /**
   * Cambia el tema en un solo cuadro: con View Transitions el navegador hace un fundido entre la captura anterior
   * y la nueva; sin ellas (o con «reducir movimiento») se suspenden las transiciones mientras cambian las variables,
   * de modo que ninguna superficie queda a medio camino ni desentonada con las demás.
   */
  private cambiarSinParpadeo(aplicar: () => void): void {
    if (typeof document === 'undefined' || !this.animarCambios) {
      aplicar();
      return;
    }
    const reducir = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const vt = (document as Document & { startViewTransition?: (cb: () => void) => ViewTransitionLike }).startViewTransition;
    if (typeof vt === 'function' && !reducir) {
      const transicion = vt.call(document, aplicar);
      // si el usuario cambia de tema otra vez a mitad de la animación el navegador descarta la anterior: no es un error
      for (const promesa of [transicion?.ready, transicion?.finished, transicion?.updateCallbackDone]) promesa?.catch(() => undefined);
      return;
    }
    const raiz = document.documentElement;
    raiz.classList.add('sin-transiciones');
    aplicar();
    void raiz.offsetWidth; // fuerza el recálculo de estilos con las transiciones apagadas
    requestAnimationFrame(() => raiz.classList.remove('sin-transiciones'));
  }

  /** Quita `sin-transiciones` (puesto por el script de arranque de index.html) cuando ya se pintó el primer cuadro. */
  private liberarTransiciones(): void {
    if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('sin-transiciones')));
  }

  private fijarColorDelNavegador(theme: Theme): void {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', THEME_COLOR[theme]);
  }

  private setupSystemThemeListener(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    try {
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQueryListener = (e: MediaQueryListEvent) => {
        // Solo reaccionar al cambio del sistema operativo si el usuario NO ha fijado manualmente un tema
        if (!this.isManualPreference()) {
          const newTheme: Theme = e.matches ? 'dark' : 'light';
          this.applyTheme(newTheme, false);
        }
      };

      if (typeof this.mediaQueryList.addEventListener === 'function') {
        this.mediaQueryList.addEventListener('change', this.mediaQueryListener);
      } else {
        (this.mediaQueryList as any).addListener(this.mediaQueryListener);
      }
    } catch {
      /* ignore en navegadores incompatibles */
    }
  }

  private setupStorageListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.storageListener = (event: StorageEvent) => {
      if (event.key === this.THEME_KEY) {
        const newTheme = event.newValue;
        if (newTheme === 'dark' || newTheme === 'light') {
          this.applyTheme(newTheme, false);
        } else if (newTheme === null) {
          // Si otra pestaña limpió la preferencia, volver al tema del sistema
          this.applyTheme(this.getSystemTheme(), false);
        }
      }
    };

    window.addEventListener('storage', this.storageListener);
  }
}
