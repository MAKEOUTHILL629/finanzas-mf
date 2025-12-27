import { Component, HostListener, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

// Usa el nombre exacto de tu servicio de autenticación
import { AuthServiceService } from '../../services/auth-service.service';

// Ya no necesitamos la interfaz MenuItem aquí, manejaremos la lógica en el template
// interface MenuItem { ... }

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'] // o .scss si lo cambiaste
})
export class MenuComponent implements OnInit {

  isMenuOpen = true; // Mantiene el estado de apertura/cierre
  isMobile = false;  // Mantiene el estado si es vista móvil
  isUserLoggedIn$!: Observable<boolean>; // Observable para el estado de login

  // Mantenemos la estructura original de tus items principales que requieren login
  // La lógica de si se muestran o no, la haremos en el HTML con *ngIf
  loggedInMenuItems = [
    { label: 'Compras Credito', icon: 'credit_card', route: '/compras-credito' }, // Icono sugerido
    { label: 'Prestamo', icon: 'account_balance_wallet', route: '/prestamos' }, // Icono sugerido
    { label: 'Pagos Mes', icon: 'calendar_today', route: '/pagos-mes' }, // Icono sugerido
    { label: 'Pagos Mes Persona', icon: 'people', route: '/pagos-mes-personas' }, // Icono sugerido
    // --- Puedes añadir más items que requieran login aquí ---
  ];

  constructor(
    private authService: AuthServiceService // Inyecta tu servicio de autenticación
  ) {}

  // Listener para detectar cambios de tamaño de pantalla
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  ngOnInit() {
    this.checkScreenSize(); // Comprueba el tamaño inicial
    // Asigna el observable del servicio para usarlo en la plantilla con async pipe
    this.isUserLoggedIn$ = this.authService.isLoggedIn$;
  }

  // Lógica para abrir/cerrar el menú (sin cambios)
  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  // Lógica para detectar tamaño de pantalla (sin cambios)
  private checkScreenSize() {
    this.isMobile = window.innerWidth < 768; // O el breakpoint que uses
    // Comportamiento por defecto: cerrado en móvil, abierto en desktop
    // (puedes ajustar esta lógica si prefieres otro comportamiento inicial)
    this.isMenuOpen = !this.isMobile;
  }

  /**
   * Llama al método logout del AuthService.
   * AuthService se encarga de limpiar el token, actualizar el estado y redirigir.
   */
  logout(): void {
    console.log('[MenuComponent] Logout() llamado');
    // Si estás en móvil y haces logout, cerramos el menú
    if (this.isMobile) {
      this.isMenuOpen = false;
    }
    this.authService.logout();
  }
}
