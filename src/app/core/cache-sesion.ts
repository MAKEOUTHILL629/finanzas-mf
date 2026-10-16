/**
 * Los datos que se guardan en memoria para mostrarlos al instante (resumen del inicio…) pertenecen a UNA sesión: al entrar o salir
 * se olvidan todos, así nunca se ve un dato del usuario anterior. Quien guarda algo se registra aquí; `AuthServiceService` los limpia.
 */
const LIMPIADORES = new Set<() => void>();

export function registrarLimpiezaDeSesion(limpiar: () => void): void {
  LIMPIADORES.add(limpiar);
}

export function limpiarCachesDeSesion(): void {
  LIMPIADORES.forEach((l) => l());
}
