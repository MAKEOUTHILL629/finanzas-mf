import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthServiceService } from '../services/auth-service.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  loginForm!: FormGroup; // Usaremos el operador '!' para indicar que se inicializará en ngOnInit
  isLoading = false;
  errorMessage: string | null = null;
  isPasswordVisible = false; // Para mostrar/ocultar contraseña (opcional)

  constructor(
    private fb: FormBuilder,
    private authService: AuthServiceService, // Inyecta tu servicio de autenticación
    private router: Router // Para redirigir después del login
  ) { }

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
        // finalize se ejecuta siempre, al completar o al haber error
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          // ¡Login exitoso!
          console.log('Login successful', response);
          // Redirigir al dashboard principal o a la página de inicio de la app
          this.router.navigate(['/compras-credito']); // <-- Ajusta a tu ruta principal
        },
        error: (error) => {
          // Manejo de errores del backend
          console.error('Login failed:', error);
          if (error.status === 401) {
            this.errorMessage = 'Email o contraseña incorrectos.';
          } else if (error.status === 400) {
             this.errorMessage = 'Solicitud inválida. Verifica los datos enviados.';
          } else {
            this.errorMessage = 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.';
            // Podrías loggear el error completo en un sistema de monitoreo
          }
        }
      });
  }

  togglePasswordVisibility(): void {
    this.isPasswordVisible = !this.isPasswordVisible;
  }
}
