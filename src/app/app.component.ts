import { Component, OnInit } from '@angular/core';
import { MenuStateService } from './services/menu-state.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'finanzas-mf';

  // Inyectar ThemeService asegura que el tema se resuelva y aplique
  // en document.documentElement y document.body antes del primer render visible.
  constructor(
    readonly themeService: ThemeService,
    /** El layout (`layout-sidebar`, `layout-rail`, `layout-drawer`, `layout-movil`, `layout-invitado`) lo decide el servicio del menú. */
    readonly menuEstado: MenuStateService
  ) {}

  ngOnInit(): void {
    this.themeService.initTheme();
  }
}
