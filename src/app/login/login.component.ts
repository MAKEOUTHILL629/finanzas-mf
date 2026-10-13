import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthServiceService } from '../services/auth-service.service';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  loginForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  isPasswordVisible = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthServiceService,
    private router: Router,
    public themeService: ThemeService
  ) { }

  get isDarkTheme(): boolean { return this.themeService.isDark; }
  toggleTheme(): void { this.themeService.toggle(); }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      // Define los controles del formulario y sus validadores
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]] // Mínimo 8 caracteres (ejemplo)
    });
  }

  // Getters para facilitar el acceso a los controles en la plantilla
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  onSubmit(): void {
    // Marcar todos los campos como 'touched' para mostrar errores de validación si existen
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      this.errorMessage = "Por favor, corrige los errores en el formulario.";
      return; // No continuar si el formulario es inválido
    }

    this.isLoading = true;
    this.errorMessage = null; // Limpiar errores previos

    const credentials = this.loginForm.value;

    this.authService.login(credentials)
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/compras-credito']);
        },
        error: (error) => {
          const status: number = error?.status ?? -1;
          const isNetworkError: boolean = status === 0 || error?.isTimeout || error?.isNetworkError;

          if (isNetworkError) {
            this.errorMessage = 'Estamos teniendo problemas con nuestros servidores. Por favor inténtalo más tarde.';
          } else if (status === 401) {
            this.errorMessage = 'Email o contraseña incorrectos.';
          } else if (status === 400) {
            this.errorMessage = 'Solicitud inválida. Verifica los datos enviados.';
          } else {
            this.errorMessage = 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.';
          }
        }
      });
  }

  togglePasswordVisibility(): void {
    this.isPasswordVisible = !this.isPasswordVisible;
  }
}
