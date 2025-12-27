export function capitalize(str: string): string {
  if (str.length === 0) return str; // Verifica si el string está vacío
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
