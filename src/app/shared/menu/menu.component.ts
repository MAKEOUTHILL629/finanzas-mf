import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthServiceService } from '../../services/auth-service.service';
import { ThemeService } from '../../services/theme.service';

// Ya no necesitamos la interfaz MenuItem aquí, manejaremos la lógica en el template
// interface MenuItem { ... }

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'] // o .scss si lo cambiaste
})
export class MenuComponent implements OnInit, OnDestroy {

  isMenuOpen = true;
  isMobile = false;
  isUserLoggedIn$!: Observable<boolean>;

  private readonly MENU_STATE_KEY = 'finanzas-menu-state';
  private destroy$ = new Subject<void>();

  // Mantenemos la estructura original de tus items principales que requieren login
  // La lógica de si se muestran o no, la haremos en el HTML con *ngIf
  // `section` (opcional) muestra un encabezado en el menú de escritorio cuando cambia respecto al ítem anterior.
  loggedInMenuItems: Array<{ label: string; icon: string; route: string; section?: string }> = [
    { label: 'Compras Crédito', icon: 'credit_card', route: '/compras-credito' },
    { label: 'Préstamos', icon: 'account_balance_wallet', route: '/prestamos' },
    { label: 'Pagos Mes', icon: 'calendar_today', route: '/pagos-mes' },
    { label: 'Pagos Persona', icon: 'people', route: '/pagos-mes-personas' },
    { label: 'Cortes de cobro', icon: 'event_repeat', route: '/cortes-cobro', section: 'Cobros' },
    { label: 'Tarjetas', icon: 'style', route: '/tarjetas', section: 'Pagos' },
    { label: 'Extractos', icon: 'receipt_long', route: '/extractos', section: 'Pagos' },
    { label: 'Obligaciones', icon: 'home_work', route: '/obligaciones', section: 'Pagos' },
    { label: 'Aportes del carro', icon: 'directions_car', route: '/aportes-carro', section: 'Pagos' },
    { label: 'Cuentas', icon: 'account_balance', route: '/cuentas', section: 'Dinero' },
    { label: 'Transacciones', icon: 'swap_horiz', route: '/transacciones', section: 'Dinero' },
    { label: 'Correos', icon: 'mark_email_unread', route: '/correos', section: 'Dinero' },
    { label: 'Flujo de caja', icon: 'query_stats', route: '/flujo-caja', section: 'Análisis' },
    { label: 'Estado de cuenta', icon: 'groups', route: '/estado-cuenta', section: 'Análisis' },
    { label: 'Liquidación', icon: 'fact_check', route: '/liquidacion', section: 'Análisis' },
    { label: 'Recurrentes persona', icon: 'autorenew', route: '/recurrentes-persona', section: 'Análisis' },
  ];

  /** ¿Hay que pintar el encabezado de sección antes de este ítem? */
  mostrarSeccion(i: number): boolean {
    const actual = this.loggedInMenuItems[i]?.section;
    return !!actual && actual !== this.loggedInMenuItems[i - 1]?.section;
  }

  isDarkTheme: boolean = true;

  constructor(
    private authService: AuthServiceService,
    public themeService: ThemeService
  ) {}

  // Listener para detectar cambios de tamaño de pantalla
  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  ngOnInit() {
    this.loadMenuState();
    this.checkScreenSize();
    this.isUserLoggedIn$ = this.authService.isLoggedIn$;

    // Suscripción reactiva para sincronizar en tiempo real el tema
    // si el SO cambia de light/dark, otra pestaña actualiza storage o el usuario lo alterna
    this.themeService.isDarkMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isDark => {
        this.isDarkTheme = isDark;
      });

    // Valida el token contra el backend al iniciar el menú.
    // Si el token expiró en el servidor, isLoggedIn$ pasa a false reactivamente.
    this.authService.isAuthenticated()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

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
      void error;
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
      void error;
    }
  }

  /**
   * Llama al método logout del AuthService.
   * AuthService se encarga de limpiar el token, actualizar el estado y redirigir.
   */
  logout(): void {
    // Si estás en móvil y haces logout, cerramos el menú
    if (this.isMobile) {
      this.isMenuOpen = false;
    }
    this.authService.logout();
  }
}
