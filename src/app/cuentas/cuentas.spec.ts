import { TestBed } from '@angular/core/testing';
import { Categoria, CuentaFinanciera } from '../modelos/erp';
import { ModalService } from '../services/modal.service';
import { ToastService } from '../shared/toast/toast.service';
import { configurarTestBed, errorHttp, esperar, http, responder, verificarHttp } from '../testing/erp-testing';
import { CATEGORIAS_SUGERIDAS, PATRON_ULTIMOS_4, enmascarar4, etiquetaTipoCuenta, iconoTipoCuenta } from './cuentas.constants';
import { FormularioCategoriaComponent } from './formulario-categoria/formulario-categoria.component';
import { FormularioCuentaComponent } from './formulario-cuenta/formulario-cuenta.component';
import { ListaCategoriasComponent, agruparCategorias } from './lista-categorias/lista-categorias.component';
import { ListaCuentasComponent, saldosPorMoneda } from './lista-cuentas/lista-cuentas.component';

function cuenta(extra: Partial<CuentaFinanciera> = {}): CuentaFinanciera {
  return { id: 1, owner_user_id: 1, nombre: 'Bancolombia', tipo_cuenta: 'AHORROS', banco_entidad: 'Bancolombia', ultimos_4_digitos: '3698,4278', moneda: 'COP', saldo_actual: 1000, is_active: true, created_at: null, ...extra };
}
function categoria(extra: Partial<Categoria> = {}): Categoria {
  return { id: 1, owner_user_id: 1, nombre: 'Alimentación', tipo: 'EGRESO', icono: null, color: '#FF9500', created_at: null, ...extra };
}

describe('cuentas.constants', () => {
  it('enmascara uno o varios grupos de 4 dígitos', () => {
    expect(enmascarar4('1234')).toBe('••1234');
    expect(enmascarar4('3698,4278')).toBe('••3698 ••4278');
    expect(enmascarar4('3698 4278;1111')).toBe('••3698 ••4278 ••1111');
    expect(enmascarar4(null)).toBe('');
  });

  it('el patrón de últimos 4 es el mismo que valida el backend', () => {
    for (const ok of ['1234', '3698,4278', '3698, 4278', '3698 4278']) expect(PATRON_ULTIMOS_4.test(ok)).toBeTrue();
    for (const mal of ['123', '12345', 'abcd', '3698,,4278', '3698,']) expect(PATRON_ULTIMOS_4.test(mal)).toBeFalse();
  });

  it('etiquetas e íconos de tipo de cuenta', () => {
    expect(etiquetaTipoCuenta('BILLETERA_DIGITAL')).toBe('Billetera digital');
    expect(iconoTipoCuenta('EFECTIVO')).toBe('payments');
    expect(etiquetaTipoCuenta('RARA')).toBe('RARA');
  });

  it('las categorías sugeridas tienen nombres únicos y color hexadecimal', () => {
    const nombres = CATEGORIAS_SUGERIDAS.map((c) => c.nombre.toLowerCase());
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const c of CATEGORIAS_SUGERIDAS) expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('saldosPorMoneda / agruparCategorias', () => {
  it('suma por moneda solo las cuentas activas, COP primero', () => {
    const r = saldosPorMoneda([
      cuenta({ id: 1, saldo_actual: 0.1 }),
      cuenta({ id: 2, saldo_actual: 0.2 }),
      cuenta({ id: 3, moneda: 'USD', saldo_actual: 50 }),
      cuenta({ id: 4, saldo_actual: 9999, is_active: false }),
    ]);
    expect(r).toEqual([{ moneda: 'COP', saldo: 0.3, cuentas: 2 }, { moneda: 'USD', saldo: 50, cuentas: 1 }]);
  });

  it('agrupa por tipo y ordena por nombre; omite grupos vacíos', () => {
    const g = agruparCategorias([categoria({ id: 1, nombre: 'Transporte' }), categoria({ id: 2, nombre: 'Alimentación' }), categoria({ id: 3, nombre: 'Salario', tipo: 'INGRESO' })]);
    expect(g.map((x) => [x.tipo, x.categorias.map((c) => c.nombre)])).toEqual([['EGRESO', ['Alimentación', 'Transporte']], ['INGRESO', ['Salario']]]);
  });
});

describe('FormularioCuentaComponent', () => {
  afterEach(() => verificarHttp());

  function crear(c: CuentaFinanciera | null = null) {
    configurarTestBed([FormularioCuentaComponent]);
    const fixture = TestBed.createComponent(FormularioCuentaComponent);
    fixture.componentRef.setInput('cuenta', c);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('valida nombre, moneda de 3 letras y los últimos 4', () => {
    const c = crear();
    c.enviar();
    expect(c.form.invalid).toBeTrue();
    c.form.patchValue({ nombre: 'Nu', moneda: 'CO' });
    expect(c.form.controls.moneda.invalid).toBeTrue();
    c.form.patchValue({ moneda: 'cop', ultimos4Digitos: '12' });
    expect(c.form.controls.ultimos4Digitos.invalid).toBeTrue();
    c.form.patchValue({ ultimos4Digitos: '3698,4278' });
    expect(c.form.valid).toBeTrue();
  });

  it('el alta envía solo lo informado, moneda en mayúsculas y el saldo inicial como texto', () => {
    const c = crear();
    c.form.patchValue({ nombre: ' Nequi ', tipoCuenta: 'BILLETERA_DIGITAL', moneda: 'cop', saldoInicial: 250000.75 });
    let guardadas = 0;
    c.guardada.subscribe(() => guardadas++);
    c.enviar();
    const req = esperar('POST', 'cuentas-financieras');
    expect(req.request.body).toEqual({ nombre: 'Nequi', tipoCuenta: 'BILLETERA_DIGITAL', moneda: 'COP', saldoInicial: '250000.75' });
    req.flush(cuenta({ id: 9 }));
    expect(guardadas).toBe(1);
  });

  it('la edición bloquea la moneda y no admite saldo; envía solo lo que cambió', () => {
    const c = crear(cuenta());
    expect(c.esEdicion).toBeTrue();
    expect(c.form.controls.moneda.disabled).toBeTrue();
    c.enviar();
    expect(c.sinCambios).toBeTrue();
    http().expectNone((r) => r.method === 'PATCH');

    c.form.patchValue({ nombre: 'Bancolombia Ahorros', ultimos4Digitos: '3698,4278,1111' });
    c.enviar();
    const req = esperar('PATCH', 'cuentas-financieras/1');
    expect(req.request.body).toEqual({ nombre: 'Bancolombia Ahorros', ultimos4Digitos: '3698,4278,1111' });
    req.flush(cuenta());
  });

  it('muestra el error del servidor', () => {
    const c = crear();
    c.form.patchValue({ nombre: 'X' });
    c.enviar();
    errorHttp(esperar('POST', 'cuentas-financieras'), 400, { message: 'Datos inválidos', errors: { moneda: ['debe tener 3 letras'] } });
    expect(c.errorServidor).toBe('moneda: debe tener 3 letras');
  });
});

describe('ListaCuentasComponent', () => {
  afterEach(() => verificarHttp());

  function iniciar(cuentas: CuentaFinanciera[]) {
    configurarTestBed([ListaCuentasComponent]);
    const fixture = TestBed.createComponent(ListaCuentasComponent);
    fixture.detectChanges();
    responder('cuentas-financieras', cuentas);
    return fixture.componentInstance;
  }

  it('oculta las inactivas salvo que se pidan', () => {
    const c = iniciar([cuenta({ id: 1 }), cuenta({ id: 2, is_active: false })]);
    expect(c.visibles.map((x) => x.id)).toEqual([1]);
    expect(c.inactivas).toBe(1);
    c.mostrarInactivas = true;
    expect(c.visibles.length).toBe(2);
    expect(c.saldos).toEqual([{ moneda: 'COP', saldo: 1000, cuentas: 1 }]);
  });

  it('desactivar usa PATCH { isActive: false } y recarga', () => {
    const c = iniciar([cuenta({ id: 1 })]);
    c.alternarActiva(c.cuentas[0]);
    const req = esperar('PATCH', 'cuentas-financieras/1');
    expect(req.request.body).toEqual({ isActive: false });
    req.flush(cuenta({ is_active: false }));
    responder('cuentas-financieras', []);
  });

  it('reactivar envía isActive: true', () => {
    const c = iniciar([cuenta({ id: 2, is_active: false })]);
    c.alternarActiva(c.cuentas[0]);
    expect(esperar('PATCH', 'cuentas-financieras/2').request.body).toEqual({ isActive: true });
  });

  it('eliminar pide confirmación; un 409 por movimientos se avisa', () => {
    const c = iniciar([cuenta({ id: 1 })]);
    const error = spyOn(TestBed.inject(ToastService), 'error');
    c.pedirBorrado(c.cuentas[0]);
    http().expectNone((r) => r.method === 'DELETE');
    c.confirmarBorrado();
    errorHttp(esperar('DELETE', 'cuentas-financieras/1'), 409, { message: 'La cuenta tiene 3 transacción(es); desactívala' });
    expect(error).toHaveBeenCalledWith('La cuenta tiene 3 transacción(es); desactívala');
    expect(c.confirmandoBorrado).toBeNull();
  });

  it('abrir y cerrar el modal crea y descarta el formulario', () => {
    const c = iniciar([cuenta()]);
    c.editar(c.cuentas[0]);
    expect(c.formularioAbierto).toBeTrue();
    expect(c.cuentaEditando?.id).toBe(1);
    TestBed.inject(ModalService).close();
    expect(c.formularioAbierto).toBeFalse();
    expect(c.cuentaEditando).toBeNull();
  });
});

describe('Categorías', () => {
  afterEach(() => verificarHttp());

  function iniciar(categorias: Categoria[]) {
    configurarTestBed([ListaCategoriasComponent]);
    const fixture = TestBed.createComponent(ListaCategoriasComponent);
    fixture.detectChanges();
    responder('categorias', categorias);
    return fixture.componentInstance;
  }

  it('las del sistema son de solo lectura', () => {
    const c = iniciar([categoria({ id: 1, owner_user_id: null }), categoria({ id: 2 })]);
    expect(c.esDelSistema(c.categorias[0])).toBeTrue();
    expect(c.esDelSistema(c.categorias[1])).toBeFalse();
  });

  it('las sugeridas se crean solo tras confirmar y se omiten las que ya existen', () => {
    const c = iniciar([categoria({ id: 1, nombre: 'alimentación' })]); // mismo nombre, distinta capitalización
    c.pedirSugeridas();
    http().expectNone((r) => r.method === 'POST');
    c.crearSugeridas();
    const posts = http().match((r) => r.method === 'POST' && r.url.endsWith('/categorias'));
    expect(posts.length).toBe(CATEGORIAS_SUGERIDAS.length - 1);
    expect(posts.some((p) => p.request.body.nombre === 'Alimentación')).toBeFalse();
    for (const p of posts) p.flush(categoria({ id: 50 }));
    responder('categorias', []);
  });

  it('si ya tiene todas las sugeridas no crea nada', () => {
    const c = iniciar(CATEGORIAS_SUGERIDAS.map((s, i) => categoria({ id: i + 1, nombre: s.nombre })));
    const info = spyOn(TestBed.inject(ToastService), 'info');
    c.crearSugeridas();
    http().expectNone((r) => r.method === 'POST');
    expect(info).toHaveBeenCalled();
  });

  it('eliminar una en uso muestra el 409 del backend', () => {
    const c = iniciar([categoria({ id: 7 })]);
    const error = spyOn(TestBed.inject(ToastService), 'error');
    c.pedirBorrado(c.categorias[0]);
    c.confirmarBorrado();
    errorHttp(esperar('DELETE', 'categorias/7'), 409, { message: 'La categoría está en uso' });
    expect(error).toHaveBeenCalledWith('La categoría está en uso');
  });

  it('el formulario valida el color y envía solo lo que cambió al editar', () => {
    configurarTestBed([FormularioCategoriaComponent]);
    const fixture = TestBed.createComponent(FormularioCategoriaComponent);
    fixture.componentRef.setInput('categoria', categoria({ id: 7, nombre: 'Transporte', color: '#0071E3' }));
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.enviar();
    expect(c.sinCambios).toBeTrue();
    c.form.patchValue({ color: 'rojo' });
    expect(c.form.controls.color.invalid).toBeTrue();
    c.form.patchValue({ nombre: ' Transporte público ', color: '#0071E3' });
    c.enviar();
    const req = esperar('PATCH', 'categorias/7');
    expect(req.request.body).toEqual({ nombre: 'Transporte público' });
    req.flush(categoria({ id: 7 }));
  });
});
