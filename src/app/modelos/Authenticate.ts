// Interface para la respuesta esperada del endpoint de login
export interface AuthResponse {
  status: string; // 'ok' u 'error'
  token: string;  // El JWT
  message?: string; // Mensaje de error opcional
}

// Interface para las credenciales de login
export interface Credentials {
  email: string;
  password: string;
}
