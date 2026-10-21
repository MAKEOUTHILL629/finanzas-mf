import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ComprasCreditoMultimoneda, CuotaDetalle } from '../../modelos/compras-credito';
import { DetalleRefinanciamiento } from '../../modelos/refinanciamiento';
import { ModalService } from '../../services/modal.service';
import { ModalComponent } from '../../shared/modal/modal.component';
import { ToastService } from '../../shared/toast/toast.service';
import { configurarTestBed, errorHttp, esperar, http, responder, responderCatalogos, tarjetaItem, verificarHttp, API } from '../../testing/erp-testing';
import { DetalleComprasCreditoComponent, MODAL_DESHACER_UNIFICACION, MODAL_ELIMINAR_COMPRA } from './detalle-compras-credito.component';

/** Sustituto del componente de responsables (tiene su propia prueba y sus propias peticiones). */
@Component({ selector: 'app-responsable-credito', template: '' })
class ResponsablesFalsoComponent {
  @Input() compra: unknown;
  @Output() cambiosResponsables = new EventEmitter<unknown>();
  @Output() guardado = new EventEmitter<void>();
  actualizarResponsables = jasmine.createSpy('actualizarResponsables').and.resolveTo(undefined);
  resetearCambios = jasmine.createSpy('resetearCambios');
}

const compra = (extra: Partial<ComprasCreditoMultimoneda> = {}): ComprasCreditoMultimoneda => ({
  id: 5,
  concepto: 'Nevera Samsung',
  valorCompra: 2_400_000,
  fechaCompra: Date.UTC(2026, 7, 2) as unknown as Date,
  numeroCuotas: 12,
  fechaUltimaCuota: Date.UTC(2027, 6, 28) as unknown as Date,
  pagoMensual: 214_000,
  interes: 1.9,
  descripcion: 'Éxito Ibagué',
  estado: 'Pendiente',
  tarjeta: 2,
  responsables: '1',
  porcentajePago: 100,
  plasticoId: 11,
  plasticoUltimos4: '1927',
  monedaOriginal: 'COP',
  valorMonedaOriginal: 2_400_000,
  tasaCambioAplicada: 1,
  trmConfirmada: true,
  refinanciamientoId: null,
  esRefinanciamiento: false,
  saldoRefinanciado: null,
  sistemaAmortizacion: 'CAPITAL_FIJO',
  cuotaFijaPactada: null,
  ...extra,
});

const cuotas = (pagadas: number, total = 12, estadoResto = 'Pendiente'): CuotaDetalle[] =>
  Array.from({ length: total }, (_, i) => ({
    id: 100 + i,
    numeroCuota: i + 1,
    fechaPago: new Date(Date.UTC(2026, 8 + i, 28)),
    saldoRestante: 2_400_000 - (i + 1) * 200_000,
    interesPagado: 14_000,
    aporteCapital: 200_000,
    pagoTotal: 214_000,
    compra: 5,
    estado: i < pagadas ? 'Pagado' : estadoResto,
    periodoFacturacion: '2026-10',
  }));

const PLASTICOS = [{ id: 11, tarjetaId: 2, ultimos4: '1927', esActivo: true, vigenteDesde: null, vigenteHasta: null, motivoReemplazo: null, reemplazaAId: null, notas: null }];

describe('DetalleComprasCreditoComponent', () => {
  let f: ComponentFixture<DetalleComprasCreditoComponent>;
  let c: DetalleComprasCreditoComponent;
  const el = () => f.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s);
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  beforeEach(() => {
    configurarTestBed([DetalleComprasCreditoComponent, ResponsablesFalsoComponent, ModalComponent], [
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '5' })), snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
    ]);
  });
  afterEach(() => verificarHttp());

  /** Crea la pantalla y atiende todo lo que pide al cargar. */
  function abrir(datos: ComprasCreditoMultimoneda = compra(), cuotasDe: CuotaDetalle[] = cuotas(2), refinanciamiento?: DetalleRefinanciamiento): void {
    f = TestBed.createComponent(DetalleComprasCreditoComponent);
    c = f.componentInstance;
    f.detectChanges();
    responderCatalogos({ tarjetas: [tarjetaItem(2, 'Amex', { etiqueta: 'Amex ··1927' }), tarjetaItem(3, 'Visa')] });
    responder('compras-credito/detalle/5', datos);
    responder('compras-credito/5', cuotasDe);
    responder('tarjetas/2/plasticos', PLASTICOS);
    if (refinanciamiento) responder('refinanciamientos/5', refinanciamiento);
    f.detectChanges();
  }

  const filaCampo = (idCampo: string) => q<HTMLElement>(`#${idCampo}`)!;
  function editar(idCampo: string, texto: string, tecla: 'Enter' | 'blur' = 'Enter'): void {
    filaCampo(idCampo).querySelector<HTMLButtonElement>('.ce-valor')?.click(); // si ya se está editando (tras un error) se sigue en el mismo control
    f.detectChanges();
    const control = filaCampo(idCampo).querySelector<HTMLInputElement>('.ce-control')!;
    control.value = texto;
    control.dispatchEvent(new Event('input'));
    if (tecla === 'blur') control.dispatchEvent(new Event('blur'));
    else control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    f.detectChanges();
  }

  describe('resumen', () => {
    it('muestra el valor en COP, el estado, la fecha, la tarjeta y el plástico', () => {
      abrir();
      expect(q('.insp-titulo')!.textContent).toContain('Nevera Samsung');
      expect(q('.insp-valor')!.textContent).toContain('$2,400,000.00');
      expect(q('.insp-chips')!.textContent).toContain('En curso');
      expect(q('.insp-sub')!.textContent).toContain('2 de Agosto del 2026');
      expect(q('.insp-sub')!.textContent).toContain('Amex ··1927');
      expect(q('.insp-sub')!.textContent).toContain('··1927');
      expect(q('.insp-pastilla')).toBeNull(); // nada que completar
    });

    it('una compra con todas las cuotas pagadas es «Pagada»', () => {
      abrir(compra({ estado: 'Pagado' }), cuotas(12));
      expect(q('.insp-chips')!.textContent).toContain('Pagada');
      expect(q('.insp-progreso-texto')!.textContent).toContain('Completada');
    });

    it('el avance dice «Cuota X de Y», el saldo de capital pendiente y los totales', () => {
      abrir(compra(), cuotas(2));
      expect(q('.insp-progreso-texto')!.textContent).toContain('Cuota 3 de 12');
      const kpis = q('.insp-kpis')!.textContent!;
      expect(kpis).toContain('$2,000,000.00'); // 10 cuotas × 200.000 de capital pendiente
      expect(kpis).toContain('$214,000.00');
      expect(q('.erp-progress')!.getAttribute('aria-valuenow')).toBe('16.7');
    });

    it('si la carga falla se explica y se puede reintentar', () => {
      f = TestBed.createComponent(DetalleComprasCreditoComponent);
      c = f.componentInstance;
      f.detectChanges();
      responderCatalogos({ tarjetas: [] });
      errorHttp(esperar('GET', 'compras-credito/detalle/5'), 404, { message: 'Compra 5 no encontrada' });
      f.detectChanges();
      expect(q('.erp-alert--danger')!.textContent).toContain('no encontrada');
      c.reintentar();
      responder('compras-credito/detalle/5', compra());
      responder('compras-credito/5', cuotas(0));
      responder('tarjetas/2/plasticos', PLASTICOS);
      f.detectChanges();
      expect(q('.insp-titulo')).not.toBeNull();
    });
  });

  describe('datos por completar', () => {
    const incompleta = () => compra({ descripcion: '', plasticoId: null, plasticoUltimos4: null, porcentajePago: 0, responsables: '' });

    it('el aviso cuenta lo que falta y los campos vacíos se resaltan', () => {
      abrir(incompleta());
      expect(q('.insp-pastilla')!.textContent).toContain('Faltan 3 datos por completar');
      expect(q('.insp-pastilla-lista')!.textContent).toBe('Plástico · Descripción · Responsables');
      expect(filaCampo('campo-descripcion').classList).toContain('ce--faltante');
      expect(filaCampo('campo-plastico').classList).toContain('ce--faltante');
      expect(filaCampo('campo-concepto').classList).not.toContain('ce--faltante');
      expect(filaCampo('campo-descripcion').textContent).toContain('Agregar una descripción');
    });

    it('al pulsar el aviso se resaltan los campos un momento y la vista va al primero', fakeAsync(() => {
      abrir(incompleta());
      const destino = filaCampo('campo-plastico');
      const desplazar = spyOn(destino, 'scrollIntoView');
      q<HTMLButtonElement>('.insp-pastilla')!.click();
      f.detectChanges();
      expect(c.resaltando).toBe(true);
      expect(desplazar).toHaveBeenCalled();
      expect(filaCampo('campo-descripcion').classList).toContain('ce--resaltado');
      tick(2700);
      f.detectChanges();
      expect(c.resaltando).toBe(false);
      discardPeriodicTasks();
      flush();
    }));

    it('completar un dato lo guarda al instante (PATCH) y baja la cuenta del aviso sin recargar las cuotas', () => {
      abrir(incompleta());
      editar('campo-descripcion', 'Éxito Ibagué', 'blur');
      const req = esperar('PATCH', 'compras-credito/5');
      expect(req.request.body).toEqual({ descripcion: 'Éxito Ibagué' });
      expect(filaCampo('campo-descripcion').textContent).toContain('Éxito Ibagué'); // se ve de inmediato
      req.flush(compra({ ...incompleta(), descripcion: 'Éxito Ibagué' }));
      f.detectChanges();
      expect(q('.insp-pastilla')!.textContent).toContain('Faltan 2 datos por completar');
      http().expectNone(`${API}/compras-credito/5`); // texto: la tabla de cuotas no se toca
      expect(c.guardando.size).toBe(0);
    });

    it('al elegir el plástico se envía plasticoId y el aviso desaparece cuando ya no falta nada', () => {
      abrir(compra({ descripcion: 'x', plasticoId: null, plasticoUltimos4: null }));
      expect(q('.insp-pastilla')!.textContent).toContain('Falta 1 dato por completar');
      c.guardarCampo('plastico', 11);
      const req = esperar('PATCH', 'compras-credito/5');
      expect(req.request.body).toEqual({ plasticoId: 11 });
      req.flush(compra());
      f.detectChanges();
      expect(q('.insp-pastilla')).toBeNull();
      expect(q('.insp-sub')!.textContent).toContain('··1927');
    });
  });

  describe('edición en línea', () => {
    it('un cambio financiero (cuotas) se guarda y vuelve a leer la tabla de cuotas', () => {
      abrir();
      editar('campo-numeroCuotas', '6');
      const req = esperar('PATCH', 'compras-credito/5');
      expect(req.request.body).toEqual({ numeroCuotas: 6 });
      req.flush(compra({ numeroCuotas: 6, pagoMensual: 420_000 }));
      responder('compras-credito/5', cuotas(0, 6));
      f.detectChanges();
      expect(c.cuotaDetalles.length).toBe(6);
      expect(q('.insp-valor-sub')!.textContent).toContain('6 cuotas');
      expect(q('.insp-progreso-texto')!.textContent).toContain('Cuota 1 de 6');
    });

    it('el valor se guarda como número y la fecha como yyyy-MM-dd', () => {
      abrir();
      editar('campo-valorCompra', '3500000');
      let req = esperar('PATCH', 'compras-credito/5');
      expect(req.request.body).toEqual({ valorCompra: 3_500_000 });
      req.flush(compra({ valorCompra: 3_500_000 }));
      responder('compras-credito/5', cuotas(0));
      f.detectChanges();

      editar('campo-fechaCompra', '2026-09-15');
      req = esperar('PATCH', 'compras-credito/5');
      expect(req.request.body).toEqual({ fechaCompra: '2026-09-15' });
      req.flush(compra({ fechaCompra: Date.UTC(2026, 8, 15) as unknown as Date }));
      responder('compras-credito/5', cuotas(0));
      f.detectChanges();
      expect(q('.insp-sub')!.textContent).toContain('15 de Septiembre del 2026');
    });

    it('cambiar la tarjeta vuelve a leer sus plásticos', () => {
      abrir();
      c.guardarCampo('tarjeta', 3);
      const req = esperar('PATCH', 'compras-credito/5');
      expect(req.request.body).toEqual({ tarjeta: 3 });
      req.flush(compra({ tarjeta: 3, plasticoId: 21, plasticoUltimos4: '8811' }));
      responder('compras-credito/5', cuotas(0));
      responder('tarjetas/3/plasticos', []);
      f.detectChanges();
      expect(q('.insp-sub')!.textContent).toContain('··8811');
    });

    it('si el servidor rechaza el cambio se avisa, se conserva el valor anterior y se puede reintentar', () => {
      abrir();
      const error = spyOn(TestBed.inject(ToastService), 'error');
      editar('campo-interes', '25');
      // 25 > 20: lo frena el propio campo, nada se envía
      http().expectNone(`${API}/compras-credito/5`);
      expect(filaCampo('campo-interes').textContent).toContain('Máximo 20');

      editar('campo-interes', '2.5');
      errorHttp(esperar('PATCH', 'compras-credito/5'), 409, { message: 'La compra no se puede modificar' });
      f.detectChanges();
      expect(error).toHaveBeenCalledWith('La compra no se puede modificar');
      expect(c.compraCredito!.interes).toBe(1.9);
      expect(filaCampo('campo-interes').textContent).toContain('1.9');
      expect(c.guardando.size).toBe(0);
    });

    it('una compra en dólares permite confirmar la TRM', () => {
      abrir(compra({ monedaOriginal: 'USD', valorMonedaOriginal: 600, tasaCambioAplicada: 4000, trmConfirmada: false }));
      expect(q('.insp-pastilla')!.textContent).toContain('TRM definitiva');
      expect(filaCampo('campo-trm').textContent).toContain('4000');
      c.guardarCampo('trm', 4150);
      const req = esperar('PATCH', 'compras-credito/5/confirmar-trm');
      expect(req.request.body).toEqual({ nuevaTrm: 4150, confirmarDefinitivo: true });
      req.flush({});
      responder('compras-credito/detalle/5', compra({ monedaOriginal: 'USD', tasaCambioAplicada: 4150, trmConfirmada: true }));
      responder('compras-credito/5', cuotas(0));
      responder('tarjetas/2/plasticos', PLASTICOS);
      f.detectChanges();
      expect(q('.insp-pastilla')).toBeNull();
    });
  });

  describe('refinanciamiento', () => {
    const maestra = (): DetalleRefinanciamiento => ({
      id: 5,
      concepto: 'Refinanciamiento Amex 2026-10-17',
      esMaestra: true,
      maestraId: 5,
      fechaCompra: '2026-10-17',
      saldoUnificado: 3_000_000,
      numeroCuotas: 36,
      tasaMensual: 1.9,
      cuotaMensual: 115_800,
      cuotaPactada: null,
      sistemaAmortizacion: 'FRANCES',
      tarjetaId: 2,
      absorbidas: [
        { id: 31, concepto: 'Celular', fechaCompra: '2026-03-02', valorCompra: 1_800_000, numeroCuotas: 12, estado: 'REFINANCIADA', saldoRefinanciado: 1_200_000, esRefinanciamiento: false },
        { id: 32, concepto: 'Nevera', fechaCompra: '2026-04-02', valorCompra: 2_400_000, numeroCuotas: 12, estado: 'REFINANCIADA', saldoRefinanciado: 1_800_000, esRefinanciamiento: false },
      ],
    });

    it('la compra unificada muestra la insignia que enlaza al refinanciamiento y no deja cambiar sus finanzas', () => {
      abrir(compra({ estado: 'REFINANCIADA', refinanciamientoId: 9, saldoRefinanciado: 1_200_000, descripcion: '' }), cuotas(2, 12, 'REFINANCIADA'), { ...maestra(), id: 9, esMaestra: false, maestraId: 9 });
      // la ruta de detalle pide la compra 5 (absorbida) → devuelve la maestra
      expect(q('.insp-chips')!.textContent).toContain('Refinanciada');
      const enlace = q<HTMLAnchorElement>('.insp-enlace-refi')!;
      expect(enlace.textContent).toContain('Unificada en Refinanciamiento #9');
      expect(enlace.getAttribute('href')).toBe('/compra-credito-detalle/9');
      expect(q('.erp-alert--info')!.textContent).toContain('no se modifican');
      expect(q('.insp-pastilla')).toBeNull(); // una unificada no pide completar nada
      for (const id of ['campo-valorCompra', 'campo-numeroCuotas', 'campo-interes', 'campo-fechaCompra', 'campo-tarjeta', 'campo-estado']) {
        expect(filaCampo(id).querySelector<HTMLButtonElement>('.ce-valor')!.disabled).withContext(id).toBe(true);
      }
      expect(filaCampo('campo-concepto').querySelector<HTMLButtonElement>('.ce-valor')!.disabled).toBe(false);
      expect(c.acciones).toEqual([]);
      expect(q('.insp-refi')!.textContent).toContain('Refinanciamiento #9');
      expect(q('.insp-progreso-texto')!.textContent).toContain('Unificada');
      expect(qa('tbody tr.insp-fila-tenue').length).toBe(10);
    });

    it('la maestra lista las compras unificadas y permite deshacerla; las registradas a mano no', () => {
      abrir(compra({ concepto: 'Refinanciamiento Amex 2026-10-17', esRefinanciamiento: true, sistemaAmortizacion: 'FRANCES', numeroCuotas: 36 }), cuotas(0, 36), maestra());
      expect(q('.insp-chips')!.textContent).toContain('Unificación de deuda');
      expect(qa('.insp-absorbida').map((a) => a.textContent!.replace(/\s+/g, ' ').trim())[0]).toContain('Celular');
      expect(q('.insp-refi')!.textContent).toContain('2 compras');
      expect(q('.insp-refi')!.textContent).toContain('36 cuotas');
      expect(c.acciones.map((a) => a.id)).toEqual(['recalcular', 'deshacer']); // no se elimina: se deshace
      expect(c.puedeEliminar).toBe(false);
      expect(filaCampo('campo-valorCompra').querySelector<HTMLButtonElement>('.ce-valor')!.disabled).toBe(true);

      // histórica (capital fijo): sin «Deshacer»
      c.compraCredito = { ...c.compraCredito!, sistemaAmortizacion: 'CAPITAL_FIJO' };
      expect(c.puedeDeshacer).toBe(false);
    });

    it('«Deshacer unificación» pide confirmación, llama al servidor y vuelve a la lista', () => {
      abrir(compra({ esRefinanciamiento: true, sistemaAmortizacion: 'FRANCES' }), cuotas(0), maestra());
      const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const exito = spyOn(TestBed.inject(ToastService), 'exito');
      const abierto: Array<string | null> = [];
      TestBed.inject(ModalService).modalState$.subscribe((s) => abierto.push(s));
      c.alAccionar('deshacer');
      expect(abierto[abierto.length - 1]).toBe(MODAL_DESHACER_UNIFICACION);
      f.detectChanges();
      expect(el().textContent).toContain('¿Deshacer la unificación?');

      c.deshacerUnificacion();
      esperar('DELETE', 'refinanciamientos/5').flush({ restauradas: 2 });
      expect(exito).toHaveBeenCalledWith(jasmine.stringContaining('2 compras'));
      expect(navegar).toHaveBeenCalledWith(['/compras-credito']);
      expect(abierto[abierto.length - 1]).toBeNull();
    });
  });

  describe('eliminar', () => {
    it('pide confirmación, elimina y vuelve a la lista; si el servidor se niega muestra el motivo', () => {
      abrir();
      const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const error = spyOn(TestBed.inject(ToastService), 'error');
      const abierto: Array<string | null> = [];
      TestBed.inject(ModalService).modalState$.subscribe((s) => abierto.push(s));
      expect(c.acciones.map((a) => a.id)).toEqual(['recalcular', 'eliminar']);
      c.alAccionar('eliminar');
      expect(abierto[abierto.length - 1]).toBe(MODAL_ELIMINAR_COMPRA);

      c.eliminarCompra();
      errorHttp(esperar('DELETE', 'compras-credito/5'), 409, { message: 'La compra está unificada' });
      expect(error).toHaveBeenCalledWith('La compra está unificada');
      expect(navegar).not.toHaveBeenCalled();

      c.eliminarCompra();
      esperar('DELETE', 'compras-credito/5').flush({});
      expect(navegar).toHaveBeenCalledWith(['/compras-credito']);
    });
  });

  describe('responsables', () => {
    it('cuando el componente de responsables avisa un cambio sin guardar aparece la barra para guardarlo o descartarlo', async () => {
      abrir();
      const hijo = f.debugElement.query((d) => d.name === 'app-responsable-credito').componentInstance as ResponsablesFalsoComponent;
      hijo.cambiosResponsables.emit({ hayUsuarios: true, cambios: [], responsablesModificados: [{ id: 1 }] });
      f.detectChanges();
      expect(q('.insp-guardar')!.textContent).toContain('cambios sin guardar');

      q<HTMLButtonElement>('.insp-guardar-botones button:last-child')!.click();
      await f.whenStable();
      f.detectChanges();
      expect(hijo.actualizarResponsables).toHaveBeenCalledWith([{ id: 1 }]);
      expect(q('.insp-guardar')).toBeNull();
    });

    it('agregar o quitar un responsable vuelve a leer la compra (cambia el % asignado) sin reiniciar el componente', () => {
      abrir(compra({ porcentajePago: 0, responsables: '' }));
      expect(q('.insp-pastilla')!.textContent).toContain('Responsables');
      const hijo = f.debugElement.query((d) => d.name === 'app-responsable-credito').componentInstance as ResponsablesFalsoComponent;
      const referencia = c.compraCredito;
      hijo.guardado.emit();
      responder('compras-credito/detalle/5', compra({ porcentajePago: 100, responsables: '1' }));
      f.detectChanges();
      expect(c.compraCredito).toBe(referencia); // misma referencia: el hijo no se vuelve a cargar
      expect(q('.insp-pastilla')).toBeNull();
    });
  });

  describe('Fase 1 (Iteración 3) — Pago único a 1 cuota, tags, comercio canónico y edición 360°', () => {
    it('una compra a 1 cuota oculta la gráfica y tabla de amortización y muestra el Resumen de Pago Único al Corte', () => {
      abrir(compra({ numeroCuotas: 1, valorCompra: 95_000, pagoMensual: 95_000, interes: 0 }), cuotas(0, 1));
      expect(c.esUnaCuota).toBeTrue();
      expect(q('.insp-pago-unico')).not.toBeNull();
      expect(q('.insp-pago-unico')!.textContent).toContain('Compra diferida a 1 sola cuota');
      expect(q('.insp-pago-unico')!.textContent).toContain('Sin intereses a 1 cuota');
      expect(q('.insp-cuotas')).toBeNull();
      expect(q('.insp-grafica')).toBeNull();
      expect(q('.insp-progreso')).toBeNull();
    });

    it('una compra a múltiples cuotas muestra la barra segmentada Apple Storage y resalta la próxima cuota a cobrar', () => {
      abrir(compra({ numeroCuotas: 12 }), cuotas(2, 12));
      expect(c.esUnaCuota).toBeFalse();
      expect(q('.insp-barra-apple')).not.toBeNull();
      expect(q('.insp-leyenda-apple')!.textContent).toContain('Capital pagado');
      expect(qa('tbody tr.insp-fila-proxima').length).toBe(1);
      expect(q('tbody tr.insp-fila-proxima')!.textContent).toContain('Próximo cobro');
    });

    it('permite editar comercioCanonico y guardar tags inline mediante PATCH', () => {
      abrir(compra({ tags: ['#hogar'], comercioCanonico: 'Samsung' }));
      expect(c.inicialesComercio).toBe('SA');

      c.guardarTags(['#hogar', '#electrodomesticos']);
      const reqTags = esperar('PATCH', 'compras-credito/5');
      expect(reqTags.request.body).toEqual({ tags: ['#hogar', '#electrodomesticos'] });
      reqTags.flush(compra({ tags: ['#hogar', '#electrodomesticos'] }));
      f.detectChanges();
      expect(c.compraCredito?.tags).toEqual(['#hogar', '#electrodomesticos']);

      c.guardarCampo('comercioCanonico', 'Samsung Oficial');
      const reqCom = esperar('PATCH', 'compras-credito/5');
      expect(reqCom.request.body).toEqual({ comercioCanonico: 'Samsung Oficial' });
      reqCom.flush(compra({ comercioCanonico: 'Samsung Oficial' }));
      f.detectChanges();
      expect(c.compraCredito?.comercioCanonico).toBe('Samsung Oficial');
    });

    it('permite cargar el Contexto 360° y editar la compra completa (PUT)', () => {
      abrir();
      c.cargarContexto360();
      esperar('GET', 'v2/compras-credito/5/detalle-completo').flush({
        compra: compra({ comercioCanonico: 'Samsung' }),
        tarjeta: null,
        plastico: { id: 11, ultimos4: '1927', esActivo: true, vigenteDesde: null, vigenteHasta: null, tipo: 'FISICO' },
        cuotas: [],
        responsables: [],
        notificacionCorreo: {
          id: 90,
          externalMessageId: 'msg-1',
          remitente: 'alertas@bancolombia.com',
          asunto: 'Compra aprobada',
          fechaCorreo: '2026-08-02T14:00:00Z',
          cuerpoExtraido: 'Compraste en Samsung por $2.400.000',
          datosParseados: null,
          estadoProcesamiento: 'PROCESADO',
          ultimos4: '1927',
          comercioNormalizado: 'Samsung',
          montoOriginal: 2_400_000,
          moneda: 'COP',
          vinculo: 'AUTOMATICO',
        },
        refinanciamiento: null,
        recurrencia: null,
        estadisticasComercio: {
          comercioCanonico: 'Samsung',
          totalHistoricoAnio: 4_800_000,
          cantidadComprasAnio: 2,
          gastoMesTarjeta: 3_000_000,
          porcentajeSobreGastoMesTarjeta: 80,
        },
        resumenPagoUnico: {
          esUnaCuota: false,
          fechaTransaccion: '2026-08-02',
          fechaEstimadaPagoExtracto: '2026-09-28',
          costoFinanciero: 168_000,
          gastoMesTarjeta: 3_000_000,
          porcentajeSobreGastoMesTarjeta: 80,
        },
      });
      f.detectChanges();
      expect(q('.insp-contexto360')!.textContent).toContain('Samsung');
      expect(q('.insp-chips')!.textContent).toContain('Capturada por Correo');

      c.abrirModalEditarCompleta();
      c.formEdicionCompleta.patchValue({ concepto: 'Nevera Samsung No Frost', numeroCuotas: 6 });
      c.tagsEdicionCompleta = ['#hogar'];
      c.guardarEdicionCompleta();
      const reqPut = esperar('PUT', 'compras-credito/5');
      expect(reqPut.request.body).toEqual(
        jasmine.objectContaining({
          concepto: 'Nevera Samsung No Frost',
          numeroCuotas: 6,
          tags: ['#hogar'],
        }),
      );
      reqPut.flush({ message: 'Actualizada' });
      responder('compras-credito/detalle/5', compra({ concepto: 'Nevera Samsung No Frost', numeroCuotas: 6, tags: ['#hogar'] }));
      responder('compras-credito/5', cuotas(0, 6));
      responder('tarjetas/2/plasticos', PLASTICOS);
      f.detectChanges();
      expect(c.compraCredito?.concepto).toBe('Nevera Samsung No Frost');
    });
  });
});
