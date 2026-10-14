import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { esImporteValido } from './dinero.helper';

/** Importe > 0 con a lo sumo 2 decimales (según se escribió). Error: `importe`. */
export function importeConDosDecimales(control: AbstractControl): ValidationErrors | null {
  return esImporteValido(control.value) ? null : { importe: true };
}

/** Igual que `importeConDosDecimales`, pero vacío es válido (campo opcional). */
export function importeOpcional(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return v === null || v === undefined || v === '' ? null : importeConDosDecimales(control);
}

/** Importe >= 0 con a lo sumo 2 decimales (p. ej. un saldo que puede ser 0). Error: `importe`. */
export function importeNoNegativo(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined || v === '') return { importe: true };
  return /^\d+(\.\d{1,2})?$/.test(String(v).trim()) ? null : { importe: true };
}

/** Como `importeNoNegativo`, pero vacío es válido (campo opcional). */
export function importeNoNegativoOpcional(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return v === null || v === undefined || v === '' ? null : importeNoNegativo(control);
}

/** En un grupo, `fin` (si está) no puede ser anterior a `inicio`. Error en el grupo: `fechasInvertidas`. */
export function fechasCoherentes(inicio: string, fin: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const a = grupo.get(inicio)?.value as string | null;
    const b = grupo.get(fin)?.value as string | null;
    return a && b && b < a ? { fechasInvertidas: true } : null;
  };
}
