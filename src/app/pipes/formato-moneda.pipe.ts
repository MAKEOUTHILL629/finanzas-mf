import { formatNumber } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formato monetario de STYLE_APP.txt §4:
 *  - símbolo a la izquierda y pegado: `$1,234.56`; miles con coma y SIEMPRE 2 decimales;
 *  - negativos con paréntesis contables: `($1,234.56)` (nunca con signo menos);
 *  - `'compacto'` (solo para cards y gráficos, no tablas): `$1.2M`, `$450K`;
 *  - sin valor → `—`.
 * El valor llega del backend ya calculado con Decimal; aquí solo se presenta (no se hacen cuentas).
 */
@Pipe({ name: 'moneda', pure: true })
export class FormatoMonedaPipe implements PipeTransform {
  transform(value: number | string | null | undefined, modo: 'completo' | 'compacto' = 'completo'): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';

    // -0.004 se muestra como $0.00, no como ($0.00)
    const negativo = n < 0 && Math.abs(n) >= 0.005;
    const abs = Math.abs(n);
    const texto = modo === 'compacto' ? this.compacto(abs) : formatNumber(abs, 'en-US', '1.2-2');
    return negativo ? `($${texto})` : `$${texto}`;
  }

  private compacto(abs: number): string {
    if (abs >= 1_000_000_000) return `${formatNumber(abs / 1_000_000_000, 'en-US', '1.0-1')}B`;
    if (abs >= 1_000_000) return `${formatNumber(abs / 1_000_000, 'en-US', '1.0-1')}M`;
    if (abs >= 1_000) return `${formatNumber(abs / 1_000, 'en-US', '1.0-0')}K`;
    return formatNumber(abs, 'en-US', '1.2-2');
  }
}
