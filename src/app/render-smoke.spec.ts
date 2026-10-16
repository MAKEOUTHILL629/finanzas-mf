/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { DetalleObligacionComponent } from './obligaciones/detalle-obligacion/detalle-obligacion.component';
import { ListaObligacionesComponent } from './obligaciones/lista-obligaciones/lista-obligaciones.component';
import { ExtractosTarjetasComponent } from './extractos/extractos-tarjetas/extractos-tarjetas.component';
import { FormularioPagarExtractoComponent } from './extractos/formulario-pagar-extracto/formulario-pagar-extracto.component';
import { DetallePrestamoComponent } from './prestamos/detalle-prestamo/detalle-prestamo.component';
import { ListaCortesComponent } from './prestamos/lista-cortes/lista-cortes.component';
import { TablaPrestamosComponent } from './prestamos/tabla-prestamos/tabla-prestamos.component';
import { ListaTarjetasComponent } from './tarjetas/lista-tarjetas/lista-tarjetas.component';
import { ListaCuentasComponent } from './cuentas/lista-cuentas/lista-cuentas.component';
import { ListaCategoriasComponent } from './cuentas/lista-categorias/lista-categorias.component';
import { FormularioTransaccionComponent } from './transacciones/formulario-transaccion/formulario-transaccion.component';
import { ListaTransaccionesComponent } from './transacciones/lista-transacciones/lista-transacciones.component';
import { ListaCorreosComponent } from './correos/lista-correos/lista-correos.component';
import { FormularioConciliarComponent } from './correos/formulario-conciliar/formulario-conciliar.component';
import { FlujoCajaComponent } from './flujo-caja/flujo-caja.component';
import { EstadoCuentaComponent } from './deudas/estado-cuenta/estado-cuenta.component';
import { ListaCrucesComponent } from './deudas/lista-cruces/lista-cruces.component';
import { CobrosComponent } from './cobros/cobros.component';
import { CobroPublicoComponent } from './cobros/cobro-publico/cobro-publico.component';
import { FormularioCobroComponent } from './cobros/formulario-cobro/formulario-cobro.component';
import { CompartirCobroComponent } from './cobros/compartir-cobro/compartir-cobro.component';
import { ProductosDetectadosComponent } from './correos/productos-detectados/productos-detectados.component';
import { API, categoriaItem, configurarTestBed, cuentaItem, http, persona, responder, responderCatalogos, tarjetaItem, verificarHttp } from './testing/erp-testing';

/**
 * Humo de renderizado: monta cada pantalla con datos realistas y comprueba lo que se pinta.
 * Atrapa errores de plantilla en tiempo de ejecución (propiedad indefinida, pipe mal usado…) que las pruebas de
 * lógica no ven porque no vuelven a detectar cambios después de responder al backend.
 */
function texto(f: ComponentFixture<unknown>): string {
  f.detectChanges();
  return (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
}
const cuenta = (id: number, extra: object = {}) => ({ id, owner_user_id: 1, nombre: `Cuenta ${id}`, tipo_cuenta: 'AHORROS', banco_entidad: 'Bancolombia', ultimos_4_digitos: '3698,4278', moneda: 'COP', saldo_actual: 1500000.5, is_active: true, created_at: null, ...extra });
const personas = [persona(1, 'Felipe', { esPropia: true, tieneUsuario: true }), persona(2, 'Andrés'), persona(3, 'Papá')];
const prestamo = (extra: object = {}) => ({
  id: 7, valorPrestado: 120000.5, concepto: 'Mercado', fechaCobro: Date.UTC(2026, 9, 15), responsable: 2, estado: 'Pendiente', comentarios: 'semana 2', direccionPrestamo: 'POR_COBRAR',
  saldoPendiente: 120000.5, esRecurrenteMensual: false, cuotaMensualAcordada: null, fechaPrestamo: Date.UTC(2026, 9, 1), metodo: 'Nequi', corteId: 5, creadoPorPersonaId: null, origenCruceAporteId: null,
  aprobaciones: [{ id: 31, prestamoId: 7, personaId: 2, persona: 'Andrés', estado: 'Pendiente', comentarios: null, fechaAprobacion: null }, { id: 32, prestamoId: 7, personaId: 1, persona: 'Felipe', estado: 'Aprobado', comentarios: 'ok', fechaAprobacion: '2026-10-01T12:00:00.000Z' }],
  ...extra,
});
const corte = { id: 5, owner_user_id: 1, concepto: 'Corte octubre', fecha_inicio: '2026-10-01T00:00:00.000Z', fecha_final: '2026-10-31T00:00:00.000Z', estado: 'ACTIVO', created_at: null };
const ruta = (id: string) => ({ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } });

describe('Renderizado de las pantallas (humo)', () => {
  afterEach(() => verificarHttp());

  it('Préstamos: tabla con totales, estado y aprobaciones pendientes', () => {
    configurarTestBed([TablaPrestamosComponent]);
    const f = TestBed.createComponent(TablaPrestamosComponent);
    f.detectChanges();
    responder('prestamos', [prestamo(), prestamo({ id: 8, concepto: 'Domicilio', estado: 'Pagado', saldoPendiente: 0, aprobaciones: [] })]);
    responderCatalogos({ personas });
    responder('cortes-cobro', [corte]);
    const t = texto(f);
    expect(t).toContain('Por cobrar');
    expect(t).toContain('$120,000.50');
    expect(t).toContain('Mercado');
    expect(t).toContain('Andrés');
    expect(t).toContain('Corte octubre');
    expect(t).toContain('1 pendiente');
    expect((f.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(2);
  });

  it('Préstamo: detalle con acciones y aprobaciones por resolver', () => {
    configurarTestBed([DetallePrestamoComponent], [ruta('7')]);
    const f = TestBed.createComponent(DetallePrestamoComponent);
    f.detectChanges();
    responder('prestamos/7', prestamo());
    responderCatalogos({ personas });
    responder('cortes-cobro', [corte]);
    const t = texto(f);
    for (const esperado of ['Mercado', 'Marcar como pagado', 'Anular', 'Aprobar', 'Rechazar', 'Felipe', 'Aprobado', 'Corte octubre', '15 de Octubre del 2026', '$120,000.50']) expect(t).toContain(esperado);
  });

  it('Cortes de cobro: tarjetas con estado, rango y saldo por cobrar', () => {
    configurarTestBed([ListaCortesComponent]);
    const f = TestBed.createComponent(ListaCortesComponent);
    f.detectChanges();
    responder('cortes-cobro', [corte]);
    responder('prestamos', [prestamo()]);
    const t = texto(f);
    for (const esperado of ['Corte octubre', 'Activo', '1 de Octubre del 2026', '31 de Octubre del 2026', '$120,000.50']) expect(t).toContain(esperado);
  });

  const resumenObligacion = { obligacion_mes_id: 3, owner_user_id: 1, tipo_obligacion: 'CUOTA_CARRO', responsable_principal_id: 3, responsable_principal_nombre: 'Papá', concepto: 'Cuota del carro', periodo: '2026-10', meta_mensual: 1000000, fecha_inicio: '2026-10-01T00:00:00.000Z', fecha_final: '2026-10-31T00:00:00.000Z', estado_calculado: 'ABIERTO', dias_aportados: 2, cantidad_registros: 3, aporte_total_real: 400000.5, restante_real: 599999.5, aportado_directo_responsable: 300000.5, aportado_por_cruces: 100000 };

  it('Obligaciones: lista con avance y totales', () => {
    configurarTestBed([ListaObligacionesComponent]);
    const f = TestBed.createComponent(ListaObligacionesComponent);
    f.detectChanges();
    responder('obligaciones-mes', [resumenObligacion]);
    const t = texto(f);
    for (const esperado of ['Octubre 2026', 'Cuota del carro', 'Cuota del carro', 'Papá', '$1,000,000.00', '$400,000.50', 'Abierta', '40.0%']) expect(t).toContain(esperado);
    expect((f.nativeElement as HTMLElement).querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');
  });

  it('Obligación: detalle con aportes por día y desglose desplegable', () => {
    configurarTestBed([DetalleObligacionComponent], [ruta('3')]);
    const f = TestBed.createComponent(DetalleObligacionComponent);
    f.detectChanges();
    responder('obligaciones-mes/3/resumen', resumenObligacion);
    responder('obligaciones-mes/3/aportes-dia', [{
      aporte_dia_id: 10, obligacion_mes_id: 3, mes_concepto: null, periodo: '2026-10', fecha: '2026-10-05T00:00:00.000Z', notas: 'sábado', items_count: 2, valor_total_dia: 300000.5,
      detalles: [{ id: 1, aporte_dia_id: 10, persona_id: 2, valor: 100000, metodo: 'Nequi', comentarios: null, prestamo_cruce_generado_id: 77, created_at: null, persona: { id: 2, nombre: 'Andrés' }, prestamo_cruce: { id: 77, estado: 'Pendiente', valor_prestado: 100000, corte_id: 5 } }],
    }]);
    let t = texto(f);
    for (const esperado of ['Cuota del carro', 'Aportes por día', '5 de Octubre del 2026', '$300,000.50', 'sábado', 'Registrar aportes']) expect(t).toContain(esperado);
    f.componentInstance.alternarDia(f.componentInstance.dias[0]);
    t = texto(f);
    for (const esperado of ['Andrés', 'Nequi', 'Préstamo #77']) expect(t).toContain(esperado);
  });

  it('Extractos: tarjeta con totales y botón de pago; el formulario de pago muestra cuentas', () => {
    configurarTestBed([ExtractosTarjetasComponent]);
    const f = TestBed.createComponent(ExtractosTarjetasComponent);
    f.detectChanges();
    http().expectOne((r) => r.url === `${API}/tarjetas/resumen-mensual`).flush([{
      tarjeta_id: 4, franquicia: 'Visa', nombre_tarjeta: 'Oro', dia_corte: 15, dia_limite_pago: 5, periodo_facturacion: '2026-10', total_cuotas_mes: 6,
      total_extracto_cop: 1200000.5, componente_en_usd: 25.5, todas_trm_confirmadas: false, total_responsabilidad_terceros: 200000.25, total_propio: 1000000.25,
    }]);
    const t = texto(f);
    for (const esperado of ['Visa · Oro', '6 cuotas', 'corte día 15', '$1,200,000.50', '$1,000,000.25', 'Pagar extracto', 'TRM sin confirmar']) expect(t).toContain(esperado);
  });

  it('Pagar extracto: formulario con cuentas, saldo resultante y confirmación', () => {
    configurarTestBed([FormularioPagarExtractoComponent]);
    const f = TestBed.createComponent(FormularioPagarExtractoComponent);
    f.componentRef.setInput('resumen', { tarjeta_id: 4, franquicia: 'Visa', nombre_tarjeta: 'Oro', dia_corte: 15, dia_limite_pago: 5, periodo_facturacion: '2026-10', total_cuotas_mes: 6, total_extracto_cop: 1200000.5, componente_en_usd: 0, todas_trm_confirmadas: true, total_responsabilidad_terceros: 0, total_propio: 1200000.5 });
    f.detectChanges();
    responderCatalogos({ cuentas: [cuentaItem(1, 'Cuenta 1', { saldoActual: 5000000 })] });
    responder('transacciones', { total: 0, limit: 200, offset: 0, items: [] });
    const t = texto(f);
    for (const esperado of ['Pagar extracto', 'Visa · Oro', 'Cuenta 1', 'Saldo de la cuenta después del pago', '$3,799,999.50', 'quedarán como pagadas']) expect(t).toContain(esperado);
  });

  it('Tarjetas: aviso de configuración pendiente', () => {
    configurarTestBed([ListaTarjetasComponent]);
    const f = TestBed.createComponent(ListaTarjetasComponent);
    f.detectChanges();
    responder('tarjetas', [{ id: 4, franquicia: 'Visa', descripcion: 'Oro', tasaInteresCompra: 1.8895, tasaInteresAvance: null, cuotaManejo: null, diaCorte: null, diaLimitePago: null, cupoTotal: null, permiteDolares: false }]);
    const t = texto(f);
    for (const esperado of ['Visa · Oro', 'Falta configurar', 'día de corte', '1.8895%', 'Solo COP', 'Configurar']) expect(t).toContain(esperado);
  });

  it('Cuentas: saldo total y tarjetas de cuenta con últimos 4 enmascarados', () => {
    configurarTestBed([ListaCuentasComponent]);
    const f = TestBed.createComponent(ListaCuentasComponent);
    f.detectChanges();
    responder('cuentas-financieras', [cuenta(1), cuenta(2, { nombre: 'Nequi', tipo_cuenta: 'BILLETERA_DIGITAL', ultimos_4_digitos: null, saldo_actual: -100 })]);
    const t = texto(f);
    for (const esperado of ['Saldo total COP', '$1,499,900.50', 'Cuenta 1', '••3698 ••4278', 'Nequi', 'Billetera digital', '($100.00)']) expect(t).toContain(esperado);
  });

  it('Categorías: agrupadas por tipo, con las del sistema marcadas', () => {
    configurarTestBed([ListaCategoriasComponent]);
    const f = TestBed.createComponent(ListaCategoriasComponent);
    f.detectChanges();
    responder('categorias', [
      { id: 1, owner_user_id: null, nombre: 'Transporte', tipo: 'EGRESO', icono: null, color: '#0071E3', created_at: null },
      { id: 2, owner_user_id: 1, nombre: 'Salario', tipo: 'INGRESO', icono: null, color: null, created_at: null },
    ]);
    const t = texto(f);
    for (const esperado of ['Egresos', 'Ingresos', 'Transporte', 'Sistema', 'Salario']) expect(t).toContain(esperado);
  });

  it('Transacciones: tabla con totales, tipo, estado y monto', () => {
    configurarTestBed([ListaTransaccionesComponent]);
    const f = TestBed.createComponent(ListaTransaccionesComponent);
    f.detectChanges();
    responderCatalogos({ cuentas: [cuentaItem(3, 'Bancolombia')], categorias: [categoriaItem(5, 'Alimentación')] });
    http().expectOne((r) => r.url === `${API}/transacciones`).flush({ total: 2, limit: 500, offset: 0, items: [
      { id: 1, owner_user_id: 1, tipo_transaccion: 'INGRESO', cuenta_origen_id: null, cuenta_destino_id: 3, tarjeta_pagada_id: null, categoria_id: null, fecha_transaccion: '2026-10-05T15:30:00.000Z', concepto: 'Nómina', moneda_original: 'COP', monto_original: 3500000, tasa_cambio: 1, monto_cop: 3500000, origen_registro: 'EMAIL_AUTO', estado: 'CONFIRMADO', notas: null, created_at: null },
      { id: 2, owner_user_id: 1, tipo_transaccion: 'EGRESO', cuenta_origen_id: 3, cuenta_destino_id: null, tarjeta_pagada_id: null, categoria_id: 5, fecha_transaccion: '2026-10-06T15:30:00.000Z', concepto: 'Mercado', moneda_original: 'USD', monto_original: 20, tasa_cambio: 4000, monto_cop: 80000, origen_registro: 'MANUAL', estado: 'PENDIENTE_REVISION', notas: null, created_at: null },
    ] });
    const t = texto(f);
    for (const esperado of ['Ingresos', '$3,500,000.00', 'Nómina', 'desde correo', 'Bancolombia', 'Alimentación', '20.00 USD', 'Pendiente de revisión', 'Confirmar', 'Nueva transacción']) expect(t).toContain(esperado);
    expect((f.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBe(2);
  });

  it('Transacción: formulario con los seis tipos y los campos del tipo elegido', () => {
    configurarTestBed([FormularioTransaccionComponent]);
    const f = TestBed.createComponent(FormularioTransaccionComponent);
    f.detectChanges();
    responderCatalogos({ cuentas: [cuentaItem(3, 'Cuenta 3')], tarjetas: [tarjetaItem(4, 'Visa', { descripcion: 'Oro', nombre: 'Visa · Oro', etiqueta: 'Visa · Oro' })] });
    let t = texto(f);
    for (const esperado of ['Egreso', 'Ingreso', 'Transferencia', 'Pago de tarjeta', 'Pago de préstamo', 'Reembolso de tercero', 'Pagar desde']) expect(t).toContain(esperado);
    expect(t).not.toContain('Tarjeta que se paga');
    f.componentInstance.form.patchValue({ tipoTransaccion: 'PAGO_TARJETA' });
    t = texto(f);
    expect(t).toContain('Tarjeta que se paga');
    expect(t).toContain('Visa · Oro');
    f.componentInstance.form.patchValue({ monedaOriginal: 'USD' });
    expect(texto(f)).toContain('Tasa de cambio a COP');
  });

  it('Correos: tarjeta del correo con monto, producto y motivo; formulario de conciliación', () => {
    configurarTestBed([ListaCorreosComponent]);
    const f = TestBed.createComponent(ListaCorreosComponent);
    f.detectChanges();
    responderCatalogos({ personas });
    http().expectOne((r) => r.url === `${API}/notificaciones-correo`).flush([{
      id: 9, owner_user_id: 1, external_message_id: '<a@b>', remitente: 'x', asunto: 'Compra EXITO', fecha_correo: '2026-10-13T19:00:00.000Z', cuerpo_extraido: null,
      datos_parseados: { monto: '50000', moneda: 'COP', comercio: 'EXITO', ultimos_4: '0000', instrumento: 'TC', ruta: 'COMPRA_TC', tipo: 'Compra', metodo: 'Tarjeta Credito', motivo: 'tarjeta_no_identificada' },
      estado_procesamiento: 'PENDIENTE', transaccion_generada_id: null, compra_credito_generada_id: null, created_at: null,
    }]);
    const t = texto(f);
    for (const esperado of ['Por revisar', 'EXITO', '$50,000.00', '••0000', 'No se pudo identificar la tarjeta', 'Conciliar', 'Descartar']) expect(t).toContain(esperado);
  });

  it('Conciliar: formulario de una compra con responsables', () => {
    configurarTestBed([FormularioConciliarComponent]);
    const f = TestBed.createComponent(FormularioConciliarComponent);
    f.componentRef.setInput('notificacion', { id: 9, asunto: 'Compra EXITO', fecha_correo: '2026-10-13T19:00:00.000Z', compra_credito_generada_id: 5, transaccion_generada_id: null, datos_parseados: { monto: '50000', comercio: 'EXITO', ultimos_4: '1927', instrumento: 'TC' } });
    f.detectChanges();
    responderCatalogos({ personas });
    f.componentInstance.agregarResponsable();
    const t = texto(f);
    for (const esperado of ['Conciliar correo', 'Número de cuotas', '¿Quién paga parte de esta compra?', 'Agregar persona', 'Suma:', '$50,000.00', '••1927']) expect(t).toContain(esperado);
  });

  it('Flujo de caja: resultado, tarjetas de cifras y gráficos', () => {
    configurarTestBed([FlujoCajaComponent]);
    const f = TestBed.createComponent(FlujoCajaComponent);
    f.detectChanges();
    http().expectOne((r) => r.url === `${API}/analytics/flujo-caja`).flush({
      total_ingresos: 5000000, total_egresos_directos: 800000, total_tarjetas: 1200000, total_esperado_recurrentes: 300000, total_por_cobrar_terceros: 400000,
      desembolso_bruto_mes: 2300000, gasto_neto_real_tuyo: 1900000, flujo_caja_libre_estimado: 3100000,
    });
    const t = texto(f);
    for (const esperado of ['Flujo de caja libre estimado', '$3,100,000.00', 'Desembolso bruto', '$2,300,000.00', 'Te devuelven', '¿En qué se va el desembolso?', 'Entra y sale']) expect(t).toContain(esperado);
    expect((f.nativeElement as HTMLElement).querySelectorAll('canvas').length).toBe(2);
  });

  it('Estado de cuenta: tabla con totales, saldo y extracto de la persona elegida', () => {
    configurarTestBed([EstadoCuentaComponent]);
    const f = TestBed.createComponent(EstadoCuentaComponent);
    f.detectChanges();
    http().expectOne((r) => r.url === `${API}/ledger/estado-cuenta`).flush([{ persona_id: 2, nombre: 'Andrés Gómez', iniciales_nombre: 'AG', color_representativo: '#0071E3', cuotas_tc_mes: 100000, recurrentes_compartidos_mes: 0, prestamos_mes: 50000, cruces_asumidos_mes: 0, abonos_recibidos_mes: 30000, saldo_neto_mes: 120000, saldo_total_acumulado: 500000.2 }]);
    let t = texto(f);
    for (const esperado of ['Saldo total por cobrar', 'Andrés Gómez', 'AG', '$500,000.20', 'Abonar']) expect(t).toContain(esperado);
    f.componentInstance.seleccionar(f.componentInstance.filas[0]);
    http().expectOne((r) => r.url === `${API}/ledger/personas/2/extracto`).flush([{ id: 1, fecha_movimiento: '2026-10-05T00:00:00.000Z', periodo_imputacion: '2026-10', tipo_movimiento: 'CARGO_CUOTA_TC', concepto: 'Cuota 3/12 Nevera', signo: 1, monto: 100000, impacto_saldo: 100000, estado: 'CONFIRMADO' }]);
    t = texto(f);
    for (const esperado of ['Extracto de Andrés Gómez', 'Cuota 3/12 Nevera', 'Cuota de tarjeta', 'Registrar abono']) expect(t).toContain(esperado);
  });

  it('Cruces de deuda: tabla con nombres y destino', () => {
    configurarTestBed([ListaCrucesComponent]);
    const f = TestBed.createComponent(ListaCrucesComponent);
    f.detectChanges();
    responder('cruces-deuda', [{ id: 1, fecha_cruce: '2026-10-05T00:00:00.000Z', persona_que_abona_id: 3, persona_que_asume_deuda_id: 2, monto: 100000, prestamo_destino_id: 30, periodo_recurrente_destino_id: null, concepto: 'Cuota casa', comentarios: null }]);
    responderCatalogos({ personas });
    const t = texto(f);
    for (const esperado of ['Cruces de deuda', 'Papá', 'Andrés', 'Cuota casa', 'Préstamo #30', '$100,000.00']) expect(t).toContain(esperado);
  });
});


describe('Renderizado — correos inteligentes y cobros a personas (humo)', () => {
  afterEach(() => verificarHttp());

  const cobro = {
    id: 10, concepto: 'Recibo de la luz', categoria: 'SERVICIO', fechaGasto: '2026-10-14T00:00:00.000Z', periodo: '2026-10', montoTotal: 184500, modoDivision: 'IGUAL', estado: 'ACTIVO', notas: 'Octubre',
    transaccionId: null, compraCreditoId: null, notificacionId: null, montoACobrar: 123000, parteDelPropietario: 61500,
    participantes: [
      { personaId: 1, nombre: 'Felipe', iniciales: 'FE', color: null, monto: 61500, porcentaje: null, esPropio: true },
      { personaId: 2, nombre: 'Andrés', iniciales: 'AN', color: null, monto: 61500, porcentaje: null, esPropio: false },
    ],
  };
  const reporte = {
    id: 5, enlaceId: 3, personaId: 2, persona: 'Andrés', periodo: '2026-10', montoReportado: 61500, fechaPago: '2026-10-20T00:00:00.000Z', medio: 'BREB', referencia: 'ABC1', comentario: 'Listo',
    tieneComprobante: true, comprobanteNombre: 'c.jpg', comprobanteTipo: 'image/jpeg', comprobanteTamano: 48000, estado: 'PENDIENTE', montoAprobado: null, motivoRechazo: null, revisadoEn: null,
    creadoEn: '2026-10-20T15:00:00.000Z', transaccionId: null, movimientoId: null,
    correoCoincidente: { notificacionId: 1, transaccionId: 77, fecha: '2026-10-20T00:00:00.000Z', monto: 61500, cuentaId: 1 },
  };

  it('Cobros: resumen, gastos repartidos y pagos por revisar con el aviso de que el dinero ya llegó', () => {
    configurarTestBed([CobrosComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }]);
    const f = TestBed.createComponent(CobrosComponent);
    f.detectChanges();
    responderCatalogos({ personas, cuentas: [cuentaItem(1, 'Cuenta 1')] });
    http().expectOne((r) => r.url === `${API}/cobros-puntuales`).flush([cobro]);
    responder('cobros/reportes', [reporte]);
    http().expectOne((r) => r.url === `${API}/cobros/ingresos-sugeridos`).flush([{ notificacionId: 2, transaccionId: 40, fecha: '2026-10-06T00:00:00.000Z', personaId: 5, persona: 'Alicia Buitrago', monto: 2000000, concepto: 'x', cuentaId: 1 }]);
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
    let t = texto(f);
    for (const esperado of ['Cobros a personas', 'Repartir un gasto', 'Recibo de la luz', '$184,500.00', 'Se te debe', '$123,000.00', 'Andrés', 'Pagos por revisar', 'Ingresos por aplicar']) expect(t).toContain(esperado);

    f.componentInstance.pestana = 'reportes';
    t = texto(f);
    for (const esperado of ['Andrés', '$61,500.00', 'Bre-B', 'ABC1', 'Ver comprobante', 'El dinero ya llegó', 'Aprobar', 'Rechazar']) expect(t).toContain(esperado);

    f.componentInstance.pestana = 'ingresos';
    t = texto(f);
    for (const esperado of ['Alicia Buitrago', '$2,000,000.00', 'Aplicar a']) expect(t).toContain(esperado);

    f.componentInstance.pestana = 'enlaces';
    expect(texto(f)).toContain('Aún no compartes enlaces');
  });

  it('Repartir un gasto: personas, modos y vista previa del reparto', () => {
    configurarTestBed([FormularioCobroComponent]);
    const f = TestBed.createComponent(FormularioCobroComponent);
    f.componentInstance.personas = personas as never;
    f.componentInstance.periodoInicial = '2026-10';
    f.detectChanges();
    f.componentInstance.form.patchValue({ concepto: 'Mercado', montoTotal: 90000 });
    f.componentInstance.alternar(2);
    f.componentInstance.alternar(3);
    const t = texto(f);
    for (const esperado of ['Repartir un gasto', 'Servicio', 'Mercado', 'A partes iguales', 'Por porcentaje', 'Monto fijo', 'Andrés', 'Papá', 'Yo también participo', 'Se te debe en total', '$60,000.00', 'Octubre 2026']) expect(t).toContain(esperado);
  });

  it('Compartir con una persona: sin enlace aún ofrece generarlo con el mensaje y cómo pagar', () => {
    configurarTestBed([CompartirCobroComponent]);
    const f = TestBed.createComponent(CompartirCobroComponent);
    f.componentInstance.personaId = 2;
    f.componentInstance.nombre = 'Andrés Gómez';
    f.componentInstance.celular = '3104445566';
    f.componentInstance.periodo = '2026-10';
    f.detectChanges();
    http().expectOne((r) => r.url === `${API}/cobros/enlaces`).flush([]);
    const t = texto(f);
    for (const esperado of ['Compartir con Andrés Gómez', 'Octubre 2026', 'Mensaje para Andrés Gómez', '¿Cómo te paga?', 'El enlace dura', 'Generar enlace']) expect(t).toContain(esperado);
  });

  it('Página pública: saldo, detalle con porcentaje y cuota, cómo pagar, formulario con comprobante y avisos anteriores', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    configurarTestBed([CobroPublicoComponent], [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token }) } } }]);
    const f = TestBed.createComponent(CobroPublicoComponent);
    f.detectChanges();
    http().expectOne(`${API}/publico/cobros/${token}`).flush({
      version: 1, periodo: '2026-10', generadoEn: '2026-10-20T12:00:00.000Z', propietario: { nombre: 'Felipe Hernández' }, persona: { nombre: 'Andrés Gómez', iniciales: 'AG', color: null },
      bloques: [
        { clave: 'cuotasTarjetas', titulo: 'Compras con tarjeta de crédito', subtotal: 100000, items: [{ fecha: '2026-10-05T00:00:00.000Z', concepto: 'Cuota 2/6 - Nevera', monto: 100000, signo: 1, impacto: 100000, origen: 'COMPRA_CREDITO', detalle: { tipo: 'CUOTA_TARJETA', compra: 'Nevera', fechaCompra: null, valorCompra: 1200000, numeroCuota: 2, cuotasDeLaCompra: 6, cuotasQueTePertenecen: 6, porcentaje: 50, valorCuotaTotal: 200000, tarjeta: 'Visa' } }] },
        { clave: 'abonosRealizados', titulo: 'Pagos y abonos', subtotal: -30000, items: [{ fecha: '2026-10-08T00:00:00.000Z', concepto: 'Pago Nequi', monto: 30000, signo: -1, impacto: -30000, origen: 'PAGO_RECIBIDO', detalle: null }] },
      ],
      obligaciones: [{ concepto: 'Cuota del carro octubre', metaMensual: 1000000, montoAbonado: 600000, saldoPendiente: 400000 }],
      resumen: { totalCargos: 500000, totalAbonosYFavor: 30000, saldoNetoFinal: 470000, estado: 'DEBE', saldoAnterior: 50000, saldoTotalAcumulado: 520000 },
      mensaje: 'Hola Andrés, este es el resumen.', instruccionesPago: 'Bre-B @felipe', venceEn: '2099-01-01T00:00:00.000Z', actualizadoEn: '2026-10-20T12:00:00.000Z',
      reportes: [{ id: 1, monto: 100000, fechaPago: '2026-10-10T00:00:00.000Z', estado: 'RECHAZADO', motivoRechazo: 'No lo veo', montoAprobado: null, creadoEn: null, conComprobante: true }],
    });
    const t = texto(f);
    for (const esperado of [
      'Hola, Andrés', 'Resumen de Octubre 2026', 'de parte de Felipe Hernández', 'Le debes a Felipe', '$520,000.00', 'De meses anteriores', '$50,000.00',
      'Cómo pagar', 'Bre-B @felipe', 'Compras con tarjeta de crédito', 'Cuota 2 de 6 · 50 % de $200,000.00 · compra de $1,200,000.00 · Visa', 'Pagos y abonos', 'Faltan $400,000.00',
      'Avisar que pagué', 'Adjuntar foto o PDF', 'Enviar aviso de pago', 'Mis avisos de pago', 'Rechazado', 'No lo veo', 'Este enlace es personal',
    ]) expect(t).toContain(esperado);
    // sin menú ni datos de otras personas: solo la hoja pública
    expect((f.nativeElement as HTMLElement).querySelector('app-menu')).toBeNull();
  });

  it('Productos detectados: sugerencias, asignados y acciones', () => {
    configurarTestBed([ProductosDetectadosComponent]);
    const f = TestBed.createComponent(ProductosDetectadosComponent);
    f.detectChanges();
    responder('notificaciones-correo/productos', [
      { ultimos4: '1927', instrumento: 'TC', esDebito: false, correos: 384, pendientes: 380, primera: '2024-12-27T00:00:00.000Z', ultima: '2026-10-13T00:00:00.000Z', totalCop: '48706756', asignadoA: null,
        sugerencia: { tipo: 'TARJETA_EXISTENTE', tarjetaId: 2, tarjeta: 'American Express', votos: 192, total: 193, automatica: true } },
      { ultimos4: '3698', instrumento: 'CUENTA', esDebito: false, correos: 855, pendientes: 855, primera: '2021-08-09T00:00:00.000Z', ultima: '2026-09-27T00:00:00.000Z', totalCop: '1', asignadoA: null,
        sugerencia: { tipo: 'CREAR_CUENTA', nombre: 'Bancolombia *3698', tipoCuenta: 'AHORROS', esPrincipal: true } },
      { ultimos4: '9491', instrumento: 'TC', esDebito: false, correos: 188, pendientes: 0, primera: null, ultima: null, totalCop: '2', asignadoA: { tipo: 'TARJETA', id: 1, nombre: 'Mastercard' }, sugerencia: null },
    ]);
    responderCatalogos({ tarjetas: [tarjetaItem(1, 'Mastercard'), tarjetaItem(2, 'American Express')] });
    const t = texto(f);
    for (const esperado of ['Cuentas y tarjetas detectadas', '3 en tus correos', '2 sin asignar', '••1927', 'Tarjeta de crédito', 'Sin asignar', 'Es tu American Express', '192 de 193', '••3698', 'Parece tu cuenta principal', 'Mastercard', 'Aceptar sugerencias (2)', 'Reprocesar pendientes']) {
      expect(t).toContain(esperado);
    }
  });
});
