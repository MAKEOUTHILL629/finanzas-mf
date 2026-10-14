import { Component, OnInit } from '@angular/core';
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
  constructor(readonly themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.initTheme();
  }
}
