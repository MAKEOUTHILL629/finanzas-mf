import { Injectable, RendererFactory2, Renderer2 } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  private readonly THEME_KEY    = 'finanzas-theme';
  private readonly DEFAULT_THEME: Theme = 'dark';

  private renderer: Renderer2;
  private _theme$ = new BehaviorSubject<Theme>(this.DEFAULT_THEME);

  /** Observable del tema actual ('dark' | 'light') */
  public theme$: Observable<Theme> = this._theme$.asObservable();

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    // Aplica el tema persistido (o el default) en cuanto se instancia el servicio
    this.applyTheme(this.loadSavedTheme());
  }

  get currentTheme(): Theme {
    return this._theme$.value;
  }

  get isDark(): boolean {
    return this._theme$.value === 'dark';
  }

  /** Alterna entre oscuro y claro */
  toggle(): void {
    const next: Theme = this._theme$.value === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
  }

  /** Aplica un tema específico */
  setTheme(theme: Theme): void {
    this.applyTheme(theme);
  }

  // ─────────────────────────────────────────────────────────────────────────
  private applyTheme(theme: Theme): void {
    // Escribe el atributo data-theme en el elemento <html>
    this.renderer.setAttribute(document.documentElement, 'data-theme', theme);
    this._theme$.next(theme);
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch { /* ignore en entornos sin localStorage */ }
  }

  private loadSavedTheme(): Theme {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* ignore */ }
    return this.DEFAULT_THEME;
  }
}
