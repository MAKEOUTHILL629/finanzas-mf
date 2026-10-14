import { Injectable, RendererFactory2, Renderer2, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type Theme = 'dark' | 'light';

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

  /** Observable del tema actual ('dark' | 'light') */
  public theme$: Observable<Theme> = this._theme$.asObservable();

  /** Observable booleano indicando si el modo oscuro está activo */
  public isDarkMode$: Observable<boolean> = this._theme$.pipe(
    map(theme => theme === 'dark')
  );

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
    this.applyTheme(systemTheme, false);
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

  private applyTheme(theme: Theme, persist: boolean): void {
    if (typeof document !== 'undefined') {
      // Sincroniza tanto en <html> (data-theme) como en <body> (para compatibilidad universal)
      this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
      if (document.body) {
        this.renderer.setAttribute(document.body, 'data-theme', theme);
      }
    }

    this._theme$.next(theme);

    if (persist) {
      try {
        localStorage.setItem(this.THEME_KEY, theme);
      } catch {
        /* ignore */
      }
    }
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
