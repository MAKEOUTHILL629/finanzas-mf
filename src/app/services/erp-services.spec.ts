import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AnalyticsFlujoCajaService } from './analytics-flujo-caja.service';
import { ComprasCreditoService } from './compras-credito.service';
import { CuentasFinancierasService } from './cuentas-financieras.service';
import { limpiarParams } from './http-params.util';
import { LedgerDeudasService } from './ledger-deudas.service';
import { NotificacionesCorreoService } from './notificaciones-correo.service';
import { ObligacionesMesService } from './obligaciones-mes.service';
import { RecurrentesService } from './recurrentes.service';
import { TarjetasService } from './tarjetas.service';
import { TransaccionesService } from './transacciones.service';

/** Verifica que cada servicio llame a la ruta/método/parámetros que expone el backend NestJS. */
describe('Servicios ERP (contrato con el backend NestJS)', () => {
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  /** Espera exactamente una petición a `ruta` (sin query) y devuelve la petición para inspeccionarla. */
  function esperar(metodo: string, ruta: string) {
    return http.expectOne((r) => r.method === metodo && r.url === `${base}/${ruta}`);
  }

  describe('limpiarParams', () => {
    it('descarta undefined, null y cadenas vacías (HttpParams los convertiría en "undefined")', () => {
      expect(limpiarParams({ a: 1, b: undefined, c: null, d: '', e: false, f: 'x' })).toEqual({ a: 1, e: false, f: 'x' });
      expect(limpiarParams(undefined)).toBeUndefined();
    });
  });

  describe('CuentasFinancierasService', () => {
    it('lista cuentas con soloActivas y categorías por tipo', () => {
      const s = TestBed.inject(CuentasFinancierasService);
      s.getCuentas(true).subscribe();
      expect(esperar('GET', 'cuentas-financieras').request.params.get('soloActivas')).toBe('true');
      s.getCuentas().subscribe();
      expect(esperar('GET', 'cuentas-financieras').request.params.keys()).toEqual([]);
      s.getCategorias('EGRESO').subscribe();
      expect(esperar('GET', 'categorias').request.params.get('tipo')).toBe('EGRESO');
    });

    it('crea con saldoInicial, edita por PATCH y elimina por DELETE', () => {
      const s = TestBed.inject(CuentasFinancierasService);
      s.crearCuenta({ nombre: 'Nequi', tipoCuenta: 'BILLETERA_DIGITAL', saldoInicial: '250000.75' }).subscribe();
      expect(esperar('POST', 'cuentas-financieras').request.body).toEqual({ nombre: 'Nequi', tipoCuenta: 'BILLETERA_DIGITAL', saldoInicial: '250000.75' });
      s.actualizarCuenta(3, { ultimos4Digitos: '3698,4278' }).subscribe();
      expect(esperar('PATCH', 'cuentas-financieras/3').request.body).toEqual({ ultimos4Digitos: '3698,4278' });
      s.eliminarCuenta(3).subscribe();
      esperar('DELETE', 'cuentas-financieras/3');
    });
  });

  describe('TransaccionesService', () => {
    it('filtra por periodo/estado sin enviar filtros vacíos', () => {
      const s = TestBed.inject(TransaccionesService);
      s.getTransacciones({ periodo: '2026-10', estado: 'PENDIENTE_REVISION', cuentaId: undefined, limit: 20 }).subscribe();
      const req = esperar('GET', 'transacciones').request;
      expect(req.params.get('periodo')).toBe('2026-10');
      expect(req.params.get('estado')).toBe('PENDIENTE_REVISION');
      expect(req.params.get('limit')).toBe('20');
      expect(req.params.has('cuentaId')).toBeFalse();
    });

    it('crea (montos como string para conservar los decimales), actualiza y anula', () => {
      const s = TestBed.inject(TransaccionesService);
      s.crearTransaccion({ tipoTransaccion: 'EGRESO', cuentaOrigenId: 1, concepto: 'Café', montoOriginal: '0.10' }).subscribe();
      expect(esperar('POST', 'transacciones').request.body.montoOriginal).toBe('0.10');
      s.actualizarTransaccion(9, { categoriaId: 4, estado: 'CONFIRMADO' }).subscribe();
      expect(esperar('PATCH', 'transacciones/9').request.body).toEqual({ categoriaId: 4, estado: 'CONFIRMADO' });
      s.anularTransaccion(9).subscribe();
      esperar('DELETE', 'transacciones/9');
    });
  });

  describe('NotificacionesCorreoService', () => {
    it('getPendientes pide estado_procesamiento=PENDIENTE', () => {
      const s = TestBed.inject(NotificacionesCorreoService);
      s.getPendientes().subscribe();
      expect(esperar('GET', 'notificaciones-correo').request.params.get('estado_procesamiento')).toBe('PENDIENTE');
    });

    it('conciliarNotificacion hace PATCH :id/conciliar con el cuerpo extendido', () => {
      const s = TestBed.inject(NotificacionesCorreoService);
      const cuerpo = {
        accion: 'CONFIRMAR' as const,
        numeroCuotas: 6,
        responsables: [{ personaId: 2, porcentajePago: '33.33' }],
        concepto: 'Nevera',
      };
      s.conciliarNotificacion(9, cuerpo).subscribe();
      const req = esperar('PATCH', 'notificaciones-correo/9/conciliar').request;
      expect(req.body).toEqual(cuerpo);
    });

    it('descartarNotificacion envía accion DESCARTAR', () => {
      TestBed.inject(NotificacionesCorreoService).descartarNotificacion(5).subscribe();
      expect(esperar('PATCH', 'notificaciones-correo/5/conciliar').request.body).toEqual({ accion: 'DESCARTAR' });
    });
  });

  describe('RecurrentesService', () => {
    it('plantillas, periodos, proyectar-mes y pagar', () => {
      const s = TestBed.inject(RecurrentesService);
      s.getPlantillas(true).subscribe();
      expect(esperar('GET', 'recurrentes/plantillas').request.params.get('soloActivas')).toBe('true');
      s.getPeriodos('2026-10', 'PROYECTADO').subscribe();
      const periodos = esperar('GET', 'recurrentes/periodos').request;
      expect(periodos.params.get('periodo')).toBe('2026-10');
      expect(periodos.params.get('estado')).toBe('PROYECTADO');
      s.proyectarMes('2026-11').subscribe();
      expect(esperar('POST', 'recurrentes/proyectar-mes').request.body).toEqual({ periodo: '2026-11' });
      s.pagarPeriodo(4, { montoRealPagado: '150000.50', cuentaOrigenId: 1, crearTransaccion: true }).subscribe();
      expect(esperar('PATCH', 'recurrentes/periodos/4/pagar').request.body.montoRealPagado).toBe('150000.50');
    });
  });

  describe('ObligacionesMesService', () => {
    it('lista, resumen, días y registro de aportes', () => {
      const s = TestBed.inject(ObligacionesMesService);
      s.getObligaciones('2026-10', 'CUOTA_CARRO').subscribe();
      expect(esperar('GET', 'obligaciones-mes').request.params.get('tipo')).toBe('CUOTA_CARRO');
      s.getResumen(2).subscribe();
      esperar('GET', 'obligaciones-mes/2/resumen');
      s.getDias(2).subscribe();
      esperar('GET', 'obligaciones-mes/2/dias');
      s.registrarAportesDia(2, { fecha: '2026-10-10', items: [{ personaId: 3, valor: 1000, metodo: 'Nequi' }] }).subscribe();
      expect(esperar('POST', 'obligaciones-mes/2/aportes-dia').request.body.items.length).toBe(1);
    });
  });

  describe('LedgerDeudasService', () => {
    it('estado de cuenta, extracto, abono y cruces', () => {
      const s = TestBed.inject(LedgerDeudasService);
      s.getEstadoCuenta('2026-10').subscribe();
      expect(esperar('GET', 'ledger/estado-cuenta').request.params.get('periodo')).toBe('2026-10');
      s.getExtracto(7, '2026-10').subscribe();
      expect(esperar('GET', 'ledger/personas/7/extracto').request.params.get('periodo')).toBe('2026-10');
      s.abonarPersona(7, { cuentaDestinoId: 1, monto: '100000', periodoImputacion: '2026-10', concepto: 'Abono' }).subscribe();
      expect(esperar('POST', 'personas/7/abonar').request.body.cuentaDestinoId).toBe(1);
      s.getCrucesDeuda().subscribe();
      esperar('GET', 'cruces-deuda');
      s.crearCruceDeuda({ personaQueAbonaId: 1, personaQueAsumeDeudaId: 2, monto: 5000, concepto: 'Cruce' }).subscribe();
      esperar('POST', 'cruces-deuda');
    });
  });

  describe('AnalyticsFlujoCajaService', () => {
    it('getFlujoCaja pide el periodo', () => {
      TestBed.inject(AnalyticsFlujoCajaService).getFlujoCaja('2026-10').subscribe();
      expect(esperar('GET', 'analytics/flujo-caja').request.params.get('periodo')).toBe('2026-10');
    });
  });

  describe('ComprasCreditoService (legacy)', () => {
    it('usa el apiUrl del entorno (ya no apunta a localhost:9000 fijo)', () => {
      TestBed.inject(ComprasCreditoService).getComprasCredito().subscribe();
      expect(esperar('GET', 'compras-credito').request.url).toBe(`${base}/compras-credito`);
    });
  });

  describe('TarjetasService · plásticos', () => {
    it('lista, reemplaza, corrige y elimina plásticos; el historial manda solo los filtros con valor', () => {
      const s = TestBed.inject(TarjetasService);
      s.getPlasticos(4).subscribe();
      esperar('GET', 'tarjetas/4/plasticos');
      s.reemplazarPlastico(4, { ultimos4: '5555', vigenteDesde: '2026-10-01', motivo: 'ROBO' }).subscribe();
      expect(esperar('POST', 'tarjetas/4/plasticos/reemplazar').request.body).toEqual({ ultimos4: '5555', vigenteDesde: '2026-10-01', motivo: 'ROBO' });
      s.actualizarPlastico(4, 9, { vigenteHasta: null, esActivo: true }).subscribe();
      expect(esperar('PATCH', 'tarjetas/4/plasticos/9').request.body).toEqual({ vigenteHasta: null, esActivo: true });
      s.eliminarPlastico(4, 9).subscribe();
      esperar('DELETE', 'tarjetas/4/plasticos/9');

      s.getHistorial(4, { plasticoId: 3, desde: '', hasta: null, limite: 100 }).subscribe();
      const h = esperar('GET', 'tarjetas/4/historial').request.params;
      expect(h.get('plasticoId')).toBe('3');
      expect(h.get('limite')).toBe('100');
      expect(h.has('desde')).toBeFalse();
      expect(h.has('hasta')).toBeFalse();
      s.getHistorial(4).subscribe();
      expect(esperar('GET', 'tarjetas/4/historial').request.params.keys()).toEqual([]);
    });
  });
});
