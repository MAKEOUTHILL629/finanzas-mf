import { TestBed } from '@angular/core/testing';
import { ItemPlasticoCatalogo } from '../../modelos/catalogos';
import { NotificacionCorreo } from '../../modelos/erp';
import { categoriaItem, configurarTestBed, cuentaItem, esperar, http, persona, responderCatalogos, tarjetaItem, verificarHttp } from '../../testing/erp-testing';
import { ConciliarCorreoComponent } from '../conciliar-correo/conciliar-correo.component';
import { FormularioConciliarComponent } from '../formulario-conciliar/formulario-conciliar.component';
import { VisorCorreoComponent } from './visor-correo.component';
import { descripcionDelCuerpo, limpiarCuerpo, parsearFecha, parsearMonto, segmentarCuerpo } from './visor-correo.helpers';

/** Un aviso real de Bancolombia (así llega `cuerpo_extraido`: con enlaces de imágenes y publicidad al final). */
const AVISO =
  'Bancolombia: Compraste COP35.625,00 en DL*DIDI FOOD CO, el 15/10/2026 a las 20:47. Esta compra esta asociada a T.Cred *1927. Si tienes dudas, encuentranos aqui: 018000931987. Siempre contigo. icon1 [https://bancolombia-email-wsuite.s3.amazonaws.com/templates/62e8/img/Icono_celular_diaadia.png] Controla tu dinero y gestiona tus gastos. Usa Día a Día en la app Bancolombia. DESCUBRIR MÁS [https://www.bancolombia.com/centro-de-ayuda/canales/app-bancolombia/administrar-finanzas?x=1]';

function correo(extra: Partial<NotificacionCorreo> = {}): NotificacionCorreo {
  return {
    id: 9, owner_user_id: 1, external_message_id: '<a@b>', remitente: 'Bancolombia (Gmail)', asunto: 'Alertas y Notificaciones', fecha_correo: '2026-10-16T01:47:00.000Z',
    cuerpo_extraido: AVISO, estado_procesamiento: 'PENDIENTE', transaccion_generada_id: null, compra_credito_generada_id: null, created_at: null,
    datos_parseados: { monto: '35625', moneda: 'COP', comercio: 'DL*DIDI FOOD CO', ultimos_4: '1927', instrumento: 'TC', ruta: 'COMPRA_TC', tipo: 'Compra' },
    ...extra,
  };
}

describe('visor-correo.helpers', () => {
  describe('parsearMonto (formato colombiano)', () => {
    it('lee miles con punto y decimales con coma, con o sin código de moneda', () => {
      expect(parsearMonto('COP35.625,00')).toBe(35625);
      expect(parsearMonto('USD0,99')).toBe(0.99);
      expect(parsearMonto('$50.000')).toBe(50000);
      expect(parsearMonto('$1.234.567,89')).toBe(1234567.89);
      expect(parsearMonto('$ 4.100,5')).toBe(4100.5);
      expect(parsearMonto('$1.234.567')).toBe(1234567);
    });

    it('un único separador con 1–2 decimales es decimal; con 3 dígitos es de miles', () => {
      expect(parsearMonto('$49.99')).toBe(49.99);
      expect(parsearMonto('USD0.5')).toBe(0.5);
      expect(parsearMonto('$0.500')).toBe(0.5);
      expect(parsearMonto('$1,234')).toBe(1234);
      expect(parsearMonto('$35625')).toBe(35625);
    });

    it('sin un número positivo → null', () => {
      for (const t of ['', 'abc', '$', '$0', '0,00']) expect(parsearMonto(t)).toBeNull();
    });
  });

  describe('parsearFecha', () => {
    it('acepta día/mes/año, año-mes-día y fecha escrita, y rechaza las inexistentes', () => {
      expect(parsearFecha('15/10/2026')).toBe('2026-10-15');
      expect(parsearFecha('5-3-2026')).toBe('2026-03-05');
      expect(parsearFecha('2026-10-15')).toBe('2026-10-15');
      expect(parsearFecha('15 de octubre de 2026')).toBe('2026-10-15');
      expect(parsearFecha('1 de Marzo de 2025')).toBe('2025-03-01');
      for (const mala of ['31/02/2026', '2026-13-01', '15/15/2026', 'ayer', '15 de abril', '']) expect(parsearFecha(mala)).toBeNull();
    });
  });

  describe('limpiarCuerpo / descripcionDelCuerpo', () => {
    it('quita enlaces e íconos y separa el aviso del pie de página', () => {
      const c = limpiarCuerpo(AVISO);
      expect(c.principal).toBe('Bancolombia: Compraste COP35.625,00 en DL*DIDI FOOD CO, el 15/10/2026 a las 20:47. Esta compra esta asociada a T.Cred *1927.');
      expect(c.resto).toContain('Si tienes dudas');
      expect(c.resto).toContain('DESCUBRIR MÁS');
      expect(c.resto + c.principal).not.toMatch(/https?:|icon1|\[/);
      expect(c.recortado).toBeFalse();
    });

    it('marca el cuerpo recortado por el límite del sync y tolera vacío o nulo', () => {
      expect(limpiarCuerpo('a'.repeat(1500)).recortado).toBeTrue();
      expect(limpiarCuerpo(null)).toEqual({ principal: '', resto: '', recortado: false });
      expect(limpiarCuerpo('Solo el pie. Si tienes dudas, llámanos.').resto).toBe(''); // si el aviso ES el pie, se muestra completo
    });

    it('la descripción son las primeras frases del aviso (los puntos de los montos no la cortan)', () => {
      expect(descripcionDelCuerpo(AVISO)).toBe('Bancolombia: Compraste COP35.625,00 en DL*DIDI FOOD CO, el 15/10/2026 a las 20:47. Esta compra esta asociada a T.Cred *1927.');
      expect(descripcionDelCuerpo(null)).toBe('');
      expect(descripcionDelCuerpo('A'.repeat(400)).length).toBeLessThanOrEqual(255);
    });
  });

  describe('segmentarCuerpo', () => {
    const principal = limpiarCuerpo(AVISO).principal;

    it('marca el monto, el comercio, la fecha y los últimos 4 con su valor ya interpretado', () => {
      const marcas = segmentarCuerpo(principal, 'DL*DIDI FOOD CO').filter((s) => s.token).map((s) => [s.token?.tipo, s.token?.valor, s.texto]);
      expect(marcas).toEqual([
        ['monto', 35625, 'COP35.625,00'],
        ['comercio', 'DL*DIDI FOOD CO', 'DL*DIDI FOOD CO'],
        ['fecha', '2026-10-15', '15/10/2026'],
        ['ultimos4', '1927', '*1927'],
      ]);
    });

    it('los trozos juntos reconstruyen el texto original (no se pierde ni se repite nada)', () => {
      expect(segmentarCuerpo(principal, 'DL*DIDI FOOD CO').map((s) => s.texto).join('')).toBe(principal);
      expect(segmentarCuerpo('', 'x')).toEqual([]);
      expect(segmentarCuerpo('Sin nada que marcar').map((s) => s.token)).toEqual([null]);
    });

    it('un comercio con asterisco no se parte ni se confunde con los dígitos; sin comercio solo se marca lo demás', () => {
      const sinComercio = segmentarCuerpo(principal).filter((s) => s.token).map((s) => s.token?.tipo);
      expect(sinComercio).toEqual(['monto', 'fecha', 'ultimos4']);
      const conAsterisco = segmentarCuerpo('Compra en TIENDA*1234 hoy', 'TIENDA*1234').filter((s) => s.token);
      expect(conAsterisco.map((s) => [s.token?.tipo, s.texto])).toEqual([['comercio', 'TIENDA*1234']]);
    });

    it('reconoce montos con símbolo $, varias terminaciones y el comercio repetido sin distinguir mayúsculas', () => {
      const m = segmentarCuerpo('Pagaste $50.000 en exito y EXITO con la terminada en 7992', 'Exito').filter((s) => s.token);
      expect(m.map((s) => [s.token?.tipo, s.token?.valor])).toEqual([['monto', 50000], ['comercio', 'exito'], ['comercio', 'EXITO'], ['ultimos4', '7992']]);
    });

    it('ignora montos y fechas imposibles', () => {
      expect(segmentarCuerpo('Total $0 el 31/02/2026').filter((s) => s.token)).toEqual([]);
    });
  });
});

describe('VisorCorreoComponent', () => {
  function crear(n: NotificacionCorreo) {
    TestBed.resetTestingModule();
    configurarTestBed([VisorCorreoComponent]);
    const f = TestBed.createComponent(VisorCorreoComponent);
    f.componentRef.setInput('notificacion', n);
    f.detectChanges();
    return f;
  }

  it('muestra remitente, asunto y fecha, con el aviso resaltado y el pie plegado', () => {
    const f = crear(correo());
    const t = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('Bancolombia');
    expect(t).not.toContain('(Gmail)');
    expect(t).toContain('Alertas y Notificaciones');
    expect(t).toMatch(/1[56]\/10\/2026 \d{2}:47/); // la hora depende del huso del navegador
    const botones = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button.marca')).map((b) => b.textContent?.trim());
    expect(botones).toEqual(['COP35.625,00', 'DL*DIDI FOOD CO', '15/10/2026', '*1927']);
    expect((f.nativeElement as HTMLElement).querySelector('details')?.textContent).toContain('Si tienes dudas');
    expect(f.componentInstance.inicial).toBe('B');
  });

  it('tocar un resaltado lo emite ya interpretado y queda marcado como usado', () => {
    const f = crear(correo());
    const usados: unknown[] = [];
    f.componentInstance.usar.subscribe((t) => usados.push(t));
    const botones = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button.marca')) as HTMLButtonElement[];
    botones[0].click();
    botones[3].click();
    f.detectChanges();
    expect(usados).toEqual([
      jasmine.objectContaining({ tipo: 'monto', valor: 35625 }),
      jasmine.objectContaining({ tipo: 'ultimos4', valor: '1927' }),
    ]);
    expect(botones[3].classList).toContain('marca--usada');
    expect(botones[0].classList).toContain('marca--usada'); // los que ya se usaron siguen marcados
    expect(botones[1].classList).not.toContain('marca--usada');
  });

  it('sin cuerpo guardado lo explica y muestra lo que sí se leyó; con cuerpo recortado lo avisa', () => {
    const vacio = crear(correo({ cuerpo_extraido: null }));
    const t = (vacio.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('no guardó su contenido');
    expect(t).toContain('DL*DIDI FOOD CO');
    expect((vacio.nativeElement as HTMLElement).querySelectorAll('button.marca').length).toBe(0);

    const largo = crear(correo({ cuerpo_extraido: 'Compraste $1.000. '.padEnd(1500, 'x') }));
    expect((largo.nativeElement as HTMLElement).textContent).toContain('recortado');
  });

  it('el remitente sin nombre cae a «Banco»', () => {
    expect(crear(correo({ remitente: null })).componentInstance.remitente).toBe('Banco');
  });
});

describe('ConciliarCorreoComponent (visor + formulario)', () => {
  afterEach(() => verificarHttp());

  const plastico = (id: number, ultimos4: string): ItemPlasticoCatalogo => ({ id, ultimos4, esActivo: true, vigenteDesde: null, vigenteHasta: null });

  async function crear(n: NotificacionCorreo) {
    TestBed.resetTestingModule();
    configurarTestBed([ConciliarCorreoComponent, VisorCorreoComponent, FormularioConciliarComponent]);
    const f = TestBed.createComponent(ConciliarCorreoComponent);
    f.componentRef.setInput('notificacion', n);
    f.detectChanges();
    responderCatalogos({
      tarjetas: [tarjetaItem(11, 'American Express', { etiqueta: 'American Express ··1927', ultimos4Activo: '1927', plasticos: [plastico(1, '1927')] })],
      cuentas: [cuentaItem(2, 'Ahorros', { ultimos4: '3698' })],
      categorias: [categoriaItem(4, 'Mercado')],
      personas: [persona(2, 'Andrés')],
    });
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  it('muestra el correo y el formulario a la vez, con la tarjeta elegida por los dígitos del correo', async () => {
    const f = await crear(correo());
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('app-visor-correo')).not.toBeNull();
    expect(el.querySelector('app-formulario-conciliar')).not.toBeNull();
    expect(el.querySelectorAll('#titulo-conciliar').length).toBe(1); // un solo título: el del contenedor
    expect(f.componentInstance.formulario?.form.controls.producto.value).toBe('t:11');
  });

  it('tocar un resaltado del correo llena el formulario y lo anuncia junto al correo', async () => {
    const f = await crear(correo({ datos_parseados: { monto: '35625', moneda: 'COP', comercio: 'DL*DIDI FOOD CO', ultimos_4: '9999', instrumento: 'TC', ruta: 'COMPRA_TC' } }));
    const el = f.nativeElement as HTMLElement;
    const form = f.componentInstance.formulario!.form;
    expect(form.controls.producto.value).toBeNull();
    const marca = (texto: string) => Array.from(el.querySelectorAll('button.marca')).find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;

    marca('*1927').click();
    f.detectChanges();
    expect(form.controls.producto.value).toBe('t:11');
    expect(f.componentInstance.aviso).toContain('1927');
    expect(el.querySelector('.conciliar-aviso')?.textContent).toContain('1927');

    marca('15/10/2026').click();
    marca('DL*DIDI FOOD CO').click();
    marca('COP35.625,00').click();
    expect(form.controls.fecha.value).toBe('2026-10-15');
    expect(form.controls.concepto.value).toBe('DL*DIDI FOOD CO');
    expect(form.controls.monto.value).toBe(35625);

    f.componentInstance.formulario!.enviar();
    const req = esperar('PATCH', 'notificaciones-correo/9/conciliar');
    expect(req.request.body).toEqual({ accion: 'CONFIRMAR', concepto: 'DL*DIDI FOOD CO', tarjetaId: 11 });
    req.flush({ notificacion: correo(), transaccion: null, compra: null, prestamoId: null, responsablesCreados: 0 });
  });

  it('en pantallas angostas son dos pestañas que se alternan sin perder lo escrito', async () => {
    const f = await crear(correo());
    const el = f.nativeElement as HTMLElement;
    const paneles = () => ['panel-correo', 'panel-formulario'].map((id) => el.querySelector('#' + id)?.classList.contains('conciliar-panel--oculto'));
    expect(f.componentInstance.pestana).toBe('correo');
    expect(paneles()).toEqual([false, true]);
    (el.querySelector('#tab-formulario') as HTMLButtonElement).click();
    f.detectChanges();
    expect(paneles()).toEqual([true, false]);
    expect(el.querySelector('#tab-formulario')?.getAttribute('aria-selected')).toBe('true');
    f.componentInstance.formulario!.form.patchValue({ notas: 'mis notas' });
    (el.querySelector('#tab-correo') as HTMLButtonElement).click();
    f.detectChanges();
    expect(paneles()).toEqual([false, true]);
    expect(f.componentInstance.formulario!.form.controls.notas.value).toBe('mis notas');
  });

  it('confirmar y cancelar suben al contenedor', async () => {
    const f = await crear(correo());
    const eventos: string[] = [];
    f.componentInstance.cancelar.subscribe(() => eventos.push('cancelar'));
    f.componentInstance.conciliada.subscribe(() => eventos.push('conciliada'));
    f.componentInstance.formulario!.cancelar.emit();
    f.componentInstance.formulario!.enviar();
    esperar('PATCH', 'notificaciones-correo/9/conciliar').flush({ notificacion: correo(), transaccion: null, compra: null, prestamoId: null, responsablesCreados: 0 });
    expect(eventos).toEqual(['cancelar', 'conciliada']);
    http().verify();
  });
});
