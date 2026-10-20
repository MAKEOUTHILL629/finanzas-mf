import { moneda as formatearCOP } from './moneda.util';

/**
 * Helper transversal de WhatsApp (Fases 6 y 7): centraliza todos los mensajes wa.me de la app.
 * Funciones puras: reciben datos ya calculados por el backend y devuelven texto o URL codificada.
 */

export interface ResumenPagoPrestamoWhatsApp {
  nombrePersona: string;
  telefono?: string | null;
  montoPagado: number;
  cuentaDestinoDetalle: string | null;
  fechaPago: string;
  montoInicial: number;
  totalAbonado: number;
  saldoPendiente: number;
  fechaCompromisoPago?: string | null;
  urlPublicaComprobante: string;
}

const dinero = (v: number): string => formatearCOP(v);

export function generarLinkWhatsAppPagoPrestamo(datos: ResumenPagoPrestamoWhatsApp): string {
  const proximo = datos.saldoPendiente > 0
    ? `\n• Próximo pago${datos.fechaCompromisoPago ? ` estimado: ${datos.fechaCompromisoPago}` : ''}`
    : '\n🎉 ¡Quedamos a paz y salvo!';
  const texto = [
    `Hola ${datos.nombrePersona} 👋, ¡muchas gracias por tu ayuda!`,
    'Te comparto el soporte del pago realizado a nuestro préstamo:',
    '',
    `✅ *Valor pagado hoy:* ${dinero(datos.montoPagado)}`,
    `🏦 *Enviado a la cuenta:* ${datos.cuentaDestinoDetalle ?? '—'}`,
    `📅 *Fecha de pago:* ${datos.fechaPago}`,
    '📊 *Resumen del préstamo:*',
    `• Valor inicial: ${dinero(datos.montoInicial)}`,
    `• Total abonado: ${dinero(datos.totalAbonado)}`,
    `• Saldo pendiente: *${dinero(datos.saldoPendiente)}*${proximo}`,
    '',
    '📎 *Puedes ver y descargar el comprobante y el estado de cuenta aquí:*',
    datos.urlPublicaComprobante,
  ].join('\n');
  return linkWhatsApp(datos.telefono, texto);
}

/** URL wa.me con el texto codificado; con teléfono si se conoce (solo dígitos, con indicativo si viene). */
export function linkWhatsApp(telefono: string | null | undefined, texto: string): string {
  const numero = (telefono ?? '').replace(/\D/g, '');
  const destino = numero ? `https://wa.me/${numero}` : 'https://wa.me/';
  return `${destino}?text=${encodeURIComponent(texto)}`;
}

export interface AporteCarroItemWhatsApp {
  fecha: string;
  aportante: string;
  monto: number;
  concepto: string | null;
}

export interface ResumenPeriodoCarroWhatsApp {
  nombrePeriodoMes: string;
  metaMes: number;
  totalRecaudadoMes: number;
  desglosePorPersona: Array<{ nombre: string; monto: number }>;
  excedenteAcumulado: number;
  saldoFaltanteMes: number;
}

/** Mensaje de aportes del carro (Fase 7): último aporte + consolidado del mes. */
export function generarMensajeWhatsAppAporteCarro(params: { ultimoAporte?: AporteCarroItemWhatsApp; resumenPeriodo: ResumenPeriodoCarroWhatsApp }): string {
  const r = params.resumenPeriodo;
  const lineas: string[] = [`🚗 *Resumen Aportes del Carro — ${r.nombrePeriodoMes}*`, ''];
  if (params.ultimoAporte) {
    const u = params.ultimoAporte;
    lineas.push(
      '📝 *Nuevo aporte registrado:*',
      `• *Fecha:* ${u.fecha}`,
      `• *Aportante:* ${u.aportante}`,
      `• *Valor:* *${dinero(u.monto)}*`,
      `• *Concepto:* ${u.concepto ?? 'Aporte del día'}`,
      '',
    );
  }
  lineas.push(
    `📊 *Acumulado del Mes (${r.nombrePeriodoMes}):*`,
    `• *Cuota / Meta del mes:* ${dinero(r.metaMes)}`,
    `• *Total recaudado en el mes:* *${dinero(r.totalRecaudadoMes)}*`,
    ...r.desglosePorPersona.map((p) => `• ${p.nombre}: ${dinero(p.monto)}`),
    `• *Excedente / Saldo a favor:* ${dinero(r.excedenteAcumulado)}`,
    `• *Pendiente por cubrir este mes:* *${dinero(r.saldoFaltanteMes)}*`,
  );
  return lineas.join('\n');
}

export function generarLinkWhatsAppAporteCarro(params: { ultimoAporte?: AporteCarroItemWhatsApp; resumenPeriodo: ResumenPeriodoCarroWhatsApp; telefono?: string | null }): string {
  return linkWhatsApp(params.telefono, generarMensajeWhatsAppAporteCarro(params));
}
