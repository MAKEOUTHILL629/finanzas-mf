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

  private readonly MENU_STATE_KEY = 'finanzas-menu-state'; // Key para localStorage

  // Mantenemos la estructura original de tus items principales que requieren login
  // La lógica de si se muestran o no, la haremos en el HTML con *ngIf
  loggedInMenuItems = [
    { label: 'Compras Crédito', icon: 'credit_card', route: '/compras-credito' },
    { label: 'Préstamos', icon: 'account_balance_wallet', route: '/prestamos' },
    { label: 'Pagos Mes', icon: 'calendar_today', route: '/pagos-mes' },
    { label: 'Pagos Persona', icon: 'people', route: '/pagos-mes-personas' },
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
    this.loadMenuState(); // Carga el estado persistido
    this.checkScreenSize(); // Comprueba el tamaño inicial
    // Asigna el observable del servicio para usarlo en la plantilla con async pipe
    this.isUserLoggedIn$ = this.authService.isLoggedIn$;
  }

  // Lógica para abrir/cerrar el menú con persistencia
  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    this.saveMenuState();
  }

  // Lógica para detectar tamaño de pantalla
  private checkScreenSize() {
    this.isMobile = window.innerWidth < 768;
    // Si ya hay estado guardado, respetarlo; si no, usar comportamiento por defecto
    if (!localStorage.getItem(this.MENU_STATE_KEY)) {
      this.isMenuOpen = !this.isMobile;
      this.saveMenuState();
    }
  }

  // Guardar estado del menú en localStorage
  private saveMenuState(): void {
    try {
      localStorage.setItem(this.MENU_STATE_KEY, JSON.stringify({
        isOpen: this.isMenuOpen,
        timestamp: new Date().getTime()
      }));
    } catch (error) {
      console.warn('No se pudo guardar el estado del menú:', error);
    }
  }

  // Cargar estado del menú desde localStorage
  private loadMenuState(): void {
    try {
      const savedState = localStorage.getItem(this.MENU_STATE_KEY);
      if (savedState) {
        const { isOpen } = JSON.parse(savedState);
        this.isMenuOpen = isOpen;
      }
    } catch (error) {
      console.warn('No se pudo cargar el estado del menú:', error);
    }
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
