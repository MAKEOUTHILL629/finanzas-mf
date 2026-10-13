import { Component } from '@angular/core';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'finanzas-mf';

  // Inyectar ThemeService lo inicializa y aplica el tema guardado
  // antes del primer render visible (el Renderer2 escribe data-theme en <html>)
  constructor(readonly themeService: ThemeService) {}
}
