import { CorteCobro, PrestamoDetalle } from '../modelos/cobros';
import { calcularCambios, valoresDe } from './formulario-editar-prestamo/formulario-editar-prestamo.component';
import { corteParaHoy, ordenarTransferenciasCandidatas } from './formulario-prestamos/formulario-prestamos.component';
import { estadisticasPorCorte } from './lista-cortes/lista-cortes.component';
import { FILTROS_VACIOS, filtrarPrestamos, ordenarPrestamos } from './tabla-prestamos/tabla-prestamos.component';
import { claseEstadoAprobacion, claseEstadoCorte, claseEstadoPrestamo, estaPendiente, resumirAprobaciones, saldoDe } from './prestamos.constants';

const dia = (iso: string) => Date.parse(iso); // 00:00 UTC, como llegan las fechas de calendario

function prestamo(extra: Partial<PrestamoDetalle> = {}): PrestamoDetalle {
  return {
    id: 1,
    fechaCreacion: dia('2026-01-01'),
    valorPrestado: 100000,
    concepto: 'Mercado',
    fechaCobro: dia('2026-10-15'),
    responsable: 2,
    estado: 'Pendiente',
    comentarios: null,
    direccionPrestamo: 'POR_COBRAR',
    saldoPendiente: null,
    esRecurrenteMensual: false,
    cuotaMensualAcordada: null,
    fechaPrestamo: dia('2026-10-01'),
    metodo: 'Nequi',
    corteId: 5,
    creadoPorPersonaId: null,
    origenCruceAporteId: null,
    aprobaciones: [],
    ...extra,
  };
}

describe('prestamos.constants', () => {
  it('saldoDe: saldo explícito, o el valor completo si sigue pendiente, o 0', () => {
    expect(saldoDe(prestamo({ saldoPendiente: 25000.5 }))).toBe(25000.5);
    expect(saldoDe(prestamo({ saldoPendiente: 0, estado: 'Pendiente' }))).toBe(0);
    expect(saldoDe(prestamo({ saldoPendiente: null, estado: 'Pendiente' }))).toBe(100000);
    expect(saldoDe(prestamo({ saldoPendiente: null, estado: 'Pagado' }))).toBe(0);
  });

  it('clases de color por estado (sin distinguir mayúsculas)', () => {
    expect(claseEstadoPrestamo('Pagado')).toBe('success');
    expect(claseEstadoPrestamo('pendiente')).toBe('warning');
    expect(claseEstadoPrestamo('Anulado')).toBe('danger');
    expect(claseEstadoPrestamo(null)).toBe('neutral');
    expect(claseEstadoAprobacion('Aprobado')).toBe('success');
    expect(claseEstadoAprobacion('Rechazado')).toBe('danger');
    expect(claseEstadoAprobacion('Pendiente')).toBe('warning');
    expect(claseEstadoCorte('ACTIVO')).toBe('success');
    expect(claseEstadoCorte('FUTURO')).toBe('info');
    expect(claseEstadoCorte('PASADO')).toBe('neutral');
  });

  it('resumirAprobaciones cuenta pendientes y rechazadas', () => {
    const ap = (id: number, estado: 'Pendiente' | 'Aprobado' | 'Rechazado') => ({ id, prestamoId: 1, personaId: id, persona: 'x', estado, comentarios: null, fechaAprobacion: null });
    expect(resumirAprobaciones(prestamo({ aprobaciones: [ap(1, 'Aprobado'), ap(2, 'Pendiente'), ap(3, 'Rechazado')] }))).toEqual({ total: 3, pendientes: 1, rechazadas: 1 });
    expect(resumirAprobaciones(prestamo())).toEqual({ total: 0, pendientes: 0, rechazadas: 0 });
  });
});

describe('filtrarPrestamos / ordenarPrestamos', () => {
  const lista = [
    prestamo({ id: 1, concepto: 'Mercado de la semana', estado: 'Pagado', responsable: 2, corteId: 5, fechaCobro: dia('2026-09-10') }),
    prestamo({ id: 2, concepto: 'Préstamo para el carro', estado: 'Pendiente', responsable: 3, corteId: null, fechaCobro: dia('2026-10-20'), comentarios: 'cuota de OCTUBRE' }),
    prestamo({ id: 3, concepto: 'Domicilio', estado: 'Pendiente', responsable: 2, corteId: 6, fechaCobro: dia('2026-11-02') }),
  ];

  it('sin filtros devuelve todo', () => {
    expect(filtrarPrestamos(lista, FILTROS_VACIOS).length).toBe(3);
  });

  it('busca sin importar tildes ni mayúsculas, en concepto y comentarios', () => {
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, texto: 'prestamo' }).map((p) => p.id)).toEqual([2]);
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, texto: 'octubre' }).map((p) => p.id)).toEqual([2]);
  });

  it('filtra por estado, responsable y corte (incluido "sin corte")', () => {
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, estado: 'pendiente' }).map((p) => p.id)).toEqual([2, 3]);
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, responsable: '2' }).map((p) => p.id)).toEqual([1, 3]);
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, corte: '6' }).map((p) => p.id)).toEqual([3]);
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, corte: 'sin' }).map((p) => p.id)).toEqual([2]);
  });

  it('filtra por rango de fecha de cobro (inclusive)', () => {
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, desde: '2026-10-20', hasta: '2026-11-02' }).map((p) => p.id)).toEqual([2, 3]);
    expect(filtrarPrestamos(lista, { ...FILTROS_VACIOS, hasta: '2026-09-10' }).map((p) => p.id)).toEqual([1]);
  });

  it('ordena pendientes primero y luego por fecha de cobro descendente', () => {
    expect(ordenarPrestamos(lista).map((p) => p.id)).toEqual([3, 2, 1]);
    expect(estaPendiente(lista[0])).toBeFalse();
  });
});

describe('edición de préstamos: calcularCambios', () => {
  const original = prestamo({ estado: 'Pendiente', saldoPendiente: 80000, metodo: 'Nequi', corteId: 5, fechaCobro: dia('2026-10-15'), comentarios: 'hola' });

  it('valoresDe convierte la fecha de cobro (epoch UTC) al día de calendario correcto', () => {
    expect(valoresDe(original)).toEqual({ estado: 'Pendiente', saldoPendiente: 80000, metodo: 'Nequi', corteId: 5, fechaCobro: '2026-10-15', comentarios: 'hola' });
  });

  it('sin tocar nada no hay cambios', () => {
    expect(calcularCambios(original, valoresDe(original))).toEqual({});
  });

  it('envía solo lo que cambió', () => {
    const v = { ...valoresDe(original), estado: 'Pagado', fechaCobro: '2026-10-20', comentarios: ' nuevo ' };
    expect(calcularCambios(original, v)).toEqual({ estado: 'Pagado', fechaCobro: '2026-10-20', comentarios: 'nuevo' });
  });

  it('el saldo se envía como texto y solo si cambió', () => {
    expect(calcularCambios(original, { ...valoresDe(original), saldoPendiente: '45000.50' })).toEqual({ saldoPendiente: '45000.50' });
    expect(calcularCambios(original, { ...valoresDe(original), saldoPendiente: 0 })).toEqual({ saldoPendiente: '0' });
    expect(calcularCambios(original, { ...valoresDe(original), saldoPendiente: 80000 })).toEqual({});
  });

  it('nunca envía método/corte vacíos (el backend no admite quitarlos)', () => {
    expect(calcularCambios(original, { ...valoresDe(original), metodo: null, corteId: null })).toEqual({});
    expect(calcularCambios(original, { ...valoresDe(original), metodo: 'Fisico', corteId: 9 })).toEqual({ metodo: 'Fisico', corteId: 9 });
  });
});

describe('cortes: corteParaHoy y estadisticasPorCorte', () => {
  const corte = (id: number, ini: string, fin: string, estado: CorteCobro['estado']): CorteCobro => ({
    id, owner_user_id: 1, concepto: `C${id}`, fecha_inicio: `${ini}T00:00:00.000Z`, fecha_final: `${fin}T00:00:00.000Z`, estado, created_at: null,
  });

  it('elige el corte que contiene hoy, prefiriendo el ACTIVO', () => {
    const cortes = [corte(1, '2026-10-01', '2026-10-31', 'FUTURO'), corte(2, '2026-10-10', '2026-11-10', 'ACTIVO'), corte(3, '2026-01-01', '2026-01-31', 'PASADO')];
    expect(corteParaHoy(cortes, '2026-10-15')?.id).toBe(2);
    expect(corteParaHoy(cortes, '2026-10-05')?.id).toBe(1);
    expect(corteParaHoy(cortes, '2026-12-25')).toBeNull();
    expect(corteParaHoy([], '2026-10-15')).toBeNull();
  });

  it('suma el saldo por cobrar solo de los pendientes POR_COBRAR', () => {
    const e = estadisticasPorCorte([
      prestamo({ id: 1, corteId: 5, estado: 'Pendiente', saldoPendiente: 100.1 }),
      prestamo({ id: 2, corteId: 5, estado: 'Pendiente', saldoPendiente: 200.2 }),
      prestamo({ id: 3, corteId: 5, estado: 'Pagado', saldoPendiente: 0 }),
      prestamo({ id: 4, corteId: 5, estado: 'Pendiente', saldoPendiente: 999, direccionPrestamo: 'POR_PAGAR' }),
      prestamo({ id: 5, corteId: null }),
    ]);
    expect(e.get(5)).toEqual({ prestamos: 4, pendientes: 3, saldoPorCobrar: 300.3 });
    expect(e.size).toBe(1);
  });

  it('Iteración 2 Fase 5: ordenarTransferenciasCandidatas filtra últimos 15 días y prioriza coincidencia de monto', () => {
    const txs = [
      { id: 10, tipo_transaccion: 'EGRESO', estado: 'CONFIRMADO', monto_cop: 500000, fecha_transaccion: '2026-10-18T10:00:00Z', concepto: 'Transferencia Nequi' },
      { id: 11, tipo_transaccion: 'EGRESO', estado: 'CONFIRMADO', monto_cop: 150000, fecha_transaccion: '2026-10-19T10:00:00Z', concepto: 'Préstamo amigo' },
      { id: 12, tipo_transaccion: 'EGRESO', estado: 'ANULADO', monto_cop: 150000, fecha_transaccion: '2026-10-19T12:00:00Z', concepto: 'Anulada' },
    ] as any[];
    const res = ordenarTransferenciasCandidatas(txs, 150000, '2026-10-20');
    expect(res.map((r) => r.id)).toEqual([11, 10]);
  });
});
