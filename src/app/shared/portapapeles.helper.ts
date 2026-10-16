/**
 * Copia un texto al portapapeles. Usa la API moderna cuando el navegador la permite (solo en HTTPS o localhost) y, si no,
 * el método clásico con un campo temporal. Devuelve `false` si ninguno funcionó (el llamador puede mostrar el texto).
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* sin permiso: se prueba el método clásico */
  }
  try {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}
