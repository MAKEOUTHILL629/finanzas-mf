import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormularioComprasCreditoComponent } from './formulario-compras-credito.component';
import { ApiServicesService } from '../../services/api-services.service';
import { ModalService } from '../../services/modal.service';
import { SharedListasService } from '../../services/shared-listas.service';
import { SelectComponent } from '../../shared/ui/select/select.component';

describe('FormularioComprasCreditoComponent', () => {
  let component: FormularioComprasCreditoComponent;
  let fixture: ComponentFixture<FormularioComprasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        FormsModule,
        MatAutocompleteModule
      ],
      declarations: [FormularioComprasCreditoComponent, SelectComponent],
      providers: [
        ApiServicesService,
        ModalService,
        SharedListasService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormularioComprasCreditoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// ───────────────────────────── valores por defecto inteligentes (plan V2, fase 4) ─────────────────────────────
import { discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ComercioHabitual, DEFAULTS_VACIOS } from '../../modelos/sugerencias';
import { SugerenciasService } from '../../services/sugerencias.service';
import { hoyIso } from '../../shared/periodo.helper';
import { API, configurarTestBed, errorHttp, esperar, http, persona, responderCatalogos, sugerenciasDe, tarjetaItem, verificarHttp } from '../../testing/erp-testing';

describe('FormularioComprasCreditoComponent — valores por defecto inteligentes', () => {
  afterEach(() => verificarHttp());

  const TARJETAS = [
    tarjetaItem(10, 'Mastercard', { etiqueta: 'Mastercard ··9491', tasaInteresCompra: 1.9 }),
    tarjetaItem(11, 'American Express', { etiqueta: 'American Express ··1927', tasaInteresCompra: 1.8895 }),
    tarjetaItem(12, 'Débito', { tipo: 'DEBITO', etiqueta: 'Débito ··7992' }),
  ];
  const PERSONAS = [persona(1, 'Felipe', { esPropia: true }), persona(2, 'Andrés'), persona(4, 'Luis')];
  const comercio = (extra: Partial<ComercioHabitual> = {}): ComercioHabitual => ({
    concepto: 'Youtube Premium', veces: 12, ultimaFecha: '2026-10-01', cuotas: 1, ultimoValor: 27900, tarjetaId: 10, categoriaId: null, cuentaId: null, personaId: 4, ...extra,
  });

  function montar(sugerencias: Parameters<typeof sugerenciasDe> = [{}]) {
    TestBed.resetTestingModule();
    configurarTestBed([FormularioComprasCreditoComponent], [sugerenciasDe(...sugerencias)], [MatAutocompleteModule]);
    const f = TestBed.createComponent(FormularioComprasCreditoComponent);
    f.detectChanges();
    responderCatalogos({ tarjetas: TARJETAS, personas: PERSONAS });
    f.detectChanges();
    return f;
  }

  it('la fecha de la compra es hoy en hora de Colombia', () => {
    const f = montar();
    expect(f.componentInstance.purchaseForm.get('purchaseDate')?.value).toBe(hoyIso());
  });

  it('sin historial arranca como siempre: sin tarjeta elegida y a 1 cuota', () => {
    const c = montar().componentInstance;
    expect(c.purchaseForm.get('cardId')?.value).toBe('');
    expect(c.purchaseForm.get('installments')?.value).toBe(1);
    expect(c.responsableForm.get('personaId')?.value).toBe('');
  });

  it('preselecciona la tarjeta de crédito que más usas y deja ver su tasa; la persona sugerida es la última a la que se le asignó una compra', () => {
    const f = montar([{ tarjetaCreditoId: 11, ultimaPersonaCompraId: 2, personaPropiaId: 1 }]);
    const c = f.componentInstance;
    expect(c.purchaseForm.get('cardId')?.value).toBe(11);
    expect(c.selectedCard?.etiqueta).toBe('American Express ··1927');
    expect(c.purchaseForm.get('interest')?.value).toBe(1.8895); // la tasa de la tarjeta se importa sola
    expect(c.responsableForm.get('personaId')?.value).toBe(2);
    expect(c.showResponsablesSection).toBeFalse(); // la sección sigue plegada: solo queda lista
  });

  it('sin una última persona se propone a quien usa la app', () => {
    const c = montar([{ tarjetaCreditoId: 11, personaPropiaId: 1 }]).componentInstance;
    expect(c.responsableForm.get('personaId')?.value).toBe(1);
  });

  it('nunca ofrece por defecto una tarjeta de débito ni una que ya no existe', () => {
    expect(montar([{ tarjetaCreditoId: 12 }]).componentInstance.purchaseForm.get('cardId')?.value).toBe('');
    expect(montar([{ tarjetaCreditoId: 999 }]).componentInstance.purchaseForm.get('cardId')?.value).toBe('');
  });

  it('no pisa la tarjeta que el usuario ya eligió antes de que llegara la sugerencia', () => {
    TestBed.resetTestingModule();
    configurarTestBed([FormularioComprasCreditoComponent], [sugerenciasDe({ tarjetaCreditoId: 11 })], [MatAutocompleteModule]);
    const f = TestBed.createComponent(FormularioComprasCreditoComponent);
    f.componentInstance.ngOnInit();
    f.componentInstance.purchaseForm.get('cardId')?.setValue(10);
    f.componentInstance.purchaseForm.get('cardId')?.markAsDirty(); // el usuario ya eligió
    responderCatalogos({ tarjetas: TARJETAS, personas: PERSONAS });
    expect(f.componentInstance.purchaseForm.get('cardId')?.value).toBe(10);
  });

  it('un comercio que ya usaste completa valor, cuotas, tarjeta y responsable habituales', fakeAsync(() => {
    const f = montar([{ tarjetaCreditoId: 11, ultimaPersonaCompraId: 2 }, [comercio({ cuotas: 3 })]]);
    const c = f.componentInstance;
    tick(); // carga de comercios
    c.purchaseForm.get('concept')?.setValue('YOUTUBE premium'); // sin importar mayúsculas
    tick(500);
    expect(c.isNewConcept).toBeFalse();
    expect(c.purchaseForm.get('purchaseValue')?.value).toBe('27.900');
    expect(c.purchaseForm.get('installments')?.value).toBe(3);
    expect(c.purchaseForm.get('cardId')?.value).toBe(10); // la habitual de ese comercio, no la general
    expect(c.responsableForm.get('personaId')?.value).toBe(4);
    expect(c.showResponsablesSection).toBeTrue();
  }));

  it('lo que el usuario ya escribió no se pisa y un comercio nuevo se marca como nuevo', fakeAsync(() => {
    const f = montar([{ tarjetaCreditoId: 11 }, [comercio()]]);
    const c = f.componentInstance;
    tick();
    c.purchaseForm.get('purchaseValue')?.setValue('1.000');
    c.purchaseForm.get('purchaseValue')?.markAsDirty();
    c.purchaseForm.get('concept')?.setValue('Youtube Premium');
    tick(500);
    expect(c.purchaseForm.get('purchaseValue')?.value).toBe('1.000'); // el valor lo escribió él

    c.purchaseForm.get('concept')?.setValue('Una tienda nunca vista');
    tick(500);
    expect(c.isNewConcept).toBeTrue();
  }));

  it('el autocompletado ofrece los comercios que ya usaste, más usados primero', fakeAsync(() => {
    const f = montar([{}, [comercio({ concepto: 'Didi Food', veces: 71 }), comercio({ concepto: 'Youtube Premium' })]]);
    tick(500);
    expect(f.componentInstance.concepts).toEqual(['Didi Food', 'Youtube Premium']);
    discardPeriodicTasks();
  }));

  it('el responsable propuesto sigue al valor y a las cuotas de la compra (no se guarda en $0)', () => {
    const f = montar([{ tarjetaCreditoId: 11, personaPropiaId: 1 }]);
    const c = f.componentInstance;
    expect(c.responsableForm.get('personaId')?.value).toBe(1);
    c.purchaseForm.get('installments')?.setValue(6);
    const input = f.nativeElement.querySelector('#purchaseValue') as HTMLInputElement;
    input.value = '120000';
    input.dispatchEvent(new Event('input'));
    expect(c.responsableForm.get('cantidadPago')?.value).toBe(120000); // 100 % de la compra
    expect(c.responsableForm.get('cantidadCuotas')?.value).toBe(6);
    c.addResponsable();
    expect(c.responsables).toEqual([{ persona: 1, porcentajePago: 100, cantidadPago: 120000, cantidadCuotas: 6 }]);
  });

  it('el plástico de una compra retroactiva se elige en un combobox con «Activas» y «Históricas»', () => {
    const f = montar([{ tarjetaCreditoId: 11 }]);
    const c = f.componentInstance;
    c.creditCards = [{ ...TARJETAS[1], ultimos4Activo: '1927', plasticos: [
      { id: 1, ultimos4: '1927', esActivo: true, vigenteDesde: '2024-12-27', vigenteHasta: null },
      { id: 2, ultimos4: '0088', esActivo: false, vigenteDesde: '2024-03-20', vigenteHasta: '2024-06-04' },
    ] }];
    expect(c.opcionesPlastico.map((o) => [o.etiqueta, o.grupo, o.busqueda])).toEqual([
      ['··1927', 'Activas', '1927'],
      ['··0088', 'Históricas / Reemplazadas', '0088'],
    ]);
    expect(c.opcionesPlastico).toBe(c.opcionesPlastico); // misma referencia mientras no cambie la tarjeta
  });
});

// ───────────────────────────── rediseño del formulario (vista previa, descarte, errores visibles) ─────────────────────────────
describe('FormularioComprasCreditoComponent — rediseño', () => {
  afterEach(() => verificarHttp());

  const TARJETAS = [
    tarjetaItem(10, 'Mastercard', { etiqueta: 'Mastercard ··9491', tasaInteresCompra: 1.9 }),
    tarjetaItem(11, 'American Express', { etiqueta: 'American Express ··1927', tasaInteresCompra: 1.8895 }),
  ];
  const PERSONAS = [persona(1, 'Felipe', { esPropia: true }), persona(2, 'Andrés'), persona(4, 'Luis')];
  const comercio = (extra: Partial<ComercioHabitual> = {}): ComercioHabitual => ({
    concepto: 'Youtube Premium', veces: 12, ultimaFecha: '2026-10-01', cuotas: 3, ultimoValor: 27900, tarjetaId: 11, categoriaId: null, cuentaId: null, personaId: 2, ...extra,
  });

  function montar(sugerencias: Parameters<typeof sugerenciasDe> = [{ tarjetaCreditoId: 11, personaPropiaId: 1 }]): ComponentFixture<FormularioComprasCreditoComponent> {
    TestBed.resetTestingModule();
    configurarTestBed([FormularioComprasCreditoComponent], [sugerenciasDe(...sugerencias)], [MatAutocompleteModule]);
    const f = TestBed.createComponent(FormularioComprasCreditoComponent);
    f.detectChanges();
    responderCatalogos({ tarjetas: TARJETAS, personas: PERSONAS });
    f.detectChanges();
    return f;
  }

  /** Una compra válida de 1,2 M a 12 cuotas con la tarjeta 11 (se elige primero la tarjeta: ella importa su tasa, que luego se cambia a 1,9 %). */
  function llenar(c: FormularioComprasCreditoComponent): void {
    c.purchaseForm.get('cardId')?.setValue(11);
    c.purchaseForm.patchValue({ concept: 'Nevera', purchaseValue: '1.200.000', installments: 12, interest: 1.9 });
  }

  const texto = (f: ComponentFixture<unknown>, selector: string): string => (f.nativeElement.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('muestra el título de la tarea', () => {
    expect(texto(montar(), '#compra-titulo')).toBe('Nueva compra a crédito');
  });

  describe('vista previa de la compra', () => {
    it('no aparece mientras falte el valor y se calcula con lo escrito', () => {
      const f = montar();
      const c = f.componentInstance;
      expect(c.resumen).toBeNull();
      expect(f.nativeElement.querySelector('.resumen')).toBeNull();

      llenar(c);
      f.detectChanges();
      expect(c.resumen?.numeroCuotas).toBe(12);
      expect(c.resumen?.interesesTotales).toBe(148_200);
      expect(c.resumen?.total).toBe(1_348_200);
      expect(texto(f, '.resumen__cifra')).toBe('≈ $112,350');
      expect(texto(f, '.resumen__datos')).toContain('≈ $148,200');
      expect(texto(f, '.resumen__datos')).toContain('≈ $1,348,200');
    });

    it('sigue a las cuotas y al interés', () => {
      const f = montar();
      const c = f.componentInstance;
      llenar(c);
      c.elegirCuotas(1);
      expect(c.resumen?.interesesTotales).toBe(0); // con una sola cuota no hay interés
      c.elegirCuotas(3);
      c.purchaseForm.get('interest')?.setValue('0');
      expect(c.resumen?.total).toBe(1_200_000);
    });

    it('usa el día de corte de la tarjeta para la fecha del primer pago', () => {
      const f = montar();
      const c = f.componentInstance;
      c.creditCards = [{ ...TARJETAS.find((t) => t.id === 11)!, diaCorte: 25 }];
      llenar(c);
      c.purchaseForm.get('purchaseDate')?.setValue('2026-10-20'); // 20 ≤ 25: se paga a fin de este mes
      expect(c.resumen?.fechaPrimerPago).toBe('2026-10-31');
      c.purchaseForm.get('purchaseDate')?.setValue('2026-10-28'); // 28 > 25: el mes siguiente
      expect(c.resumen?.fechaPrimerPago).toBe('2026-11-30');
    });
  });

  describe('qué falta y por qué el botón está inactivo', () => {
    it('lo dice con palabras y deshabilita Guardar', () => {
      const f = montar([{}]);
      expect(texto(f, '#compra-falta span')).toBe('Falta indicar el concepto, el valor y la tarjeta.');
      expect((f.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
    });

    it('desaparece con la compra completa y Guardar se habilita', () => {
      const f = montar();
      llenar(f.componentInstance);
      f.detectChanges();
      expect(f.nativeElement.querySelector('#compra-falta')).toBeNull();
      expect((f.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeFalse();
    });

    it('no regaña antes de tocar un campo, y después le dice cómo arreglarlo', () => {
      const f = montar([{}]);
      expect(f.nativeElement.querySelector('#concept-error')).toBeNull();
      f.componentInstance.concept?.markAsTouched();
      f.detectChanges();
      expect(texto(f, '#concept-error')).toBe('Escribe el concepto de la compra.');
      expect(f.nativeElement.querySelector('#concept')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('un plazo frecuente se elige con un toque', () => {
    const f = montar();
    const botones = Array.from(f.nativeElement.querySelectorAll('.atajo')) as HTMLButtonElement[];
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['1', '3', '6', '12', '24', '36']);
    botones.find((b) => b.textContent?.trim() === '12')!.click();
    f.detectChanges();
    expect(f.componentInstance.installments?.value).toBe(12);
    expect(botones.find((b) => b.textContent?.trim() === '12')!.getAttribute('aria-checked')).toBe('true');
    expect(botones.find((b) => b.textContent?.trim() === '1')!.getAttribute('aria-checked')).toBe('false');
  });

  it('los plazos son una sola parada de Tab y se recorren con las flechas', () => {
    const f = montar();
    const c = f.componentInstance;
    const grupo = f.nativeElement.querySelector('.atajos') as HTMLElement;
    const tabulables = (): string[] => Array.from(grupo.querySelectorAll<HTMLElement>('.atajo')).filter((b) => b.tabIndex === 0).map((b) => b.textContent!.trim());
    c.elegirCuotas(6);
    f.detectChanges();
    expect(tabulables()).toEqual(['6']); // solo el elegido recibe el foco con Tab

    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(c.installments?.value).toBe(12);
    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(c.installments?.value).toBe(36);
    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(c.installments?.value).toBe(1); // da la vuelta
    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(c.installments?.value).toBe(36);

    c.installments?.setValue(18); // un plazo que no es de los frecuentes
    f.detectChanges();
    expect(tabulables()).toEqual(['1']); // el grupo sigue siendo alcanzable con Tab
  });

  it('el estado se elige en un control segmentado y con las flechas', () => {
    const f = montar();
    const c = f.componentInstance;
    const grupo = f.nativeElement.querySelector('.estado') as HTMLElement;
    expect(grupo.querySelector('[aria-checked="true"]')?.textContent?.trim()).toBe('Pendiente');
    c.elegirEstado('pagado');
    f.detectChanges();
    expect(grupo.querySelector('[aria-checked="true"]')?.textContent?.trim()).toBe('Pagado');
    expect(c.indiceEstado).toBe(1);
    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(c.status?.value).toBe('cancelado');
    grupo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(c.status?.value).toBe('pendiente'); // da la vuelta
  });

  it('cuando un comercio habitual rellena campos, el formulario dice cuáles', fakeAsync(() => {
    const f = montar([{ tarjetaCreditoId: 11 }, [comercio()]]);
    const c = f.componentInstance;
    tick();
    c.purchaseForm.get('concept')?.setValue('youtube premium');
    tick(500);
    f.detectChanges();
    expect(c.autocompletado).toEqual({ concepto: 'Youtube Premium', campos: ['el valor', 'las cuotas', 'la tarjeta', 'el responsable'] });
    expect(texto(f, '#concept-ayuda')).toContain('Rellenamos el valor, las cuotas, la tarjeta y el responsable con tu última compra en Youtube Premium');

    c.purchaseForm.get('concept')?.setValue('Una tienda nunca vista');
    tick(500);
    f.detectChanges();
    expect(c.autocompletado).toBeNull();
    expect(texto(f, '#concept-ayuda')).toContain('Comercio nuevo');
    discardPeriodicTasks();
  }));

  describe('responsables', () => {
    function conUnResponsable(): { f: ComponentFixture<FormularioComprasCreditoComponent>; c: FormularioComprasCreditoComponent; escribirValor: (v: string) => void } {
      const f = montar();
      const c = f.componentInstance;
      c.purchaseForm.get('installments')?.setValue(6);
      const escribirValor = (v: string): void => {
        const input = f.nativeElement.querySelector('#purchaseValue') as HTMLInputElement;
        input.value = v;
        input.dispatchEvent(new Event('input'));
      };
      escribirValor('120000');
      c.addResponsable();
      return { f, c, escribirValor };
    }

    it('los ya agregados siguen al valor de la compra (no quedan con el monto viejo)', () => {
      const { c, escribirValor } = conUnResponsable();
      expect(c.responsables).toEqual([{ persona: 1, porcentajePago: 100, cantidadPago: 120000, cantidadCuotas: 6 }]);
      escribirValor('200000');
      expect(c.responsables[0].cantidadPago).toBe(200000);
    });

    it('el que paga todas las cuotas sigue pagando todas; ninguno paga más cuotas de las que tiene la compra', () => {
      const { c } = conUnResponsable();
      c.purchaseForm.get('installments')?.setValue(12);
      expect(c.responsables[0].cantidadCuotas).toBe(12);

      c.responsables[0].cantidadCuotas = 4; // este paga solo 4
      c.purchaseForm.get('installments')?.setValue(18);
      expect(c.responsables[0].cantidadCuotas).toBe(4); // conserva las suyas
      c.purchaseForm.get('installments')?.setValue(2);
      expect(c.responsables[0].cantidadCuotas).toBe(2); // ya no cabe: baja a las de la compra
    });

    it('se pinta cada responsable con su porcentaje, su monto y la barra de lo asignado', () => {
      const { f } = conUnResponsable();
      f.detectChanges();
      expect(texto(f, '.resp-nombre')).toBe('Felipe');
      expect(texto(f, '.resp-detalle')).toBe('100 % · $120,000 · 6 cuotas');
      expect(texto(f, '.resp-medidor__texto')).toBe('100 % asignado');
      expect(f.nativeElement.querySelector('.resp-agregar')).toBeNull(); // ya no queda nada por asignar
      expect(f.nativeElement.querySelectorAll('.opcional__linea')[1].textContent).toContain('Felipe 100 %'); // la línea de «Responsables» (la 1.ª es la de «Más detalles»)
    });

    it('quitar a alguien devuelve su porcentaje y vuelve el formulario para agregar', () => {
      const { f, c } = conUnResponsable();
      c.removeResponsable(0);
      f.detectChanges();
      expect(c.porcentajeRestante).toBe(100);
      expect(f.nativeElement.querySelector('.resp-agregar')).not.toBeNull();
    });

    it('avisa que falta pulsar «Agregar» solo cuando la sección está abierta', () => {
      const f = montar();
      const c = f.componentInstance;
      expect(c.responsableForm.get('personaId')?.value).toBe(1); // sugerida
      expect(c.responsablePendiente).toBeNull(); // sección cerrada: es solo una sugerencia
      c.showResponsablesSection = true;
      expect(c.responsablePendiente).toBe('Felipe');
      c.addResponsable();
      expect(c.responsablePendiente).toBeNull();
    });
  });

  describe('casos límite (revisión)', () => {
    it('un comercio habitual sin responsable propio deja al responsable sugerido con el monto del valor autocompletado (no en $0)', fakeAsync(() => {
      const f = montar([{ tarjetaCreditoId: 11, personaPropiaId: 1 }, [comercio({ personaId: null, ultimoValor: 42300, cuotas: 1 })]]);
      const c = f.componentInstance;
      tick();
      c.purchaseForm.get('concept')?.setValue('Youtube Premium');
      tick(500);
      expect(c.responsableForm.get('personaId')?.value).toBe(1); // la sugerida
      expect(c.responsableForm.get('cantidadPago')?.value).toBe(42300);
      discardPeriodicTasks();
    }));

    it('el interés exige al menos un dígito: «.» no vale; «1.», 0 y la tasa de la tarjeta sí', () => {
      const interes = montar().componentInstance.interest!;
      const casos: Array<[string | number, boolean]> = [['.', false], ['', false], ['abc', false], ['1.', true], ['0', true], [0, true], [1.8895, true], ['1.9', true]];
      for (const [valor, valido] of casos) {
        interes.setValue(valor);
        expect(interes.valid).withContext(`interés «${valor}»`).toBe(valido);
      }
    });

    it('el porcentaje que falta no arrastra decimales de coma flotante (100 − 33,3 − 33,3 = 33,4)', () => {
      const c = montar().componentInstance;
      const r = (persona: number): { persona: number; porcentajePago: number; cantidadPago: number; cantidadCuotas: number } => ({ persona, porcentajePago: 33.3, cantidadPago: 0, cantidadCuotas: 1 });
      c.responsables.push(r(1), r(2), r(4));
      c.removeResponsable(2);
      expect(c.porcentajeRestante).toBe(33.4);
    });

    it('un responsable con 0 % no se puede agregar, y borrar el porcentaje borra también el monto', () => {
      const c = montar().componentInstance;
      c.purchaseForm.get('purchaseValue')?.setValue('1.000');
      c.responsableForm.get('porcentajePago')?.setValue(0);
      expect(c.errorDeResponsable('porcentajePago')).toBe('min');
      c.addResponsable();
      expect(c.responsables).toEqual([]);

      c.responsableForm.get('porcentajePago')?.setValue(50);
      expect(c.responsableForm.get('cantidadPago')?.value).toBe(500);
      c.responsableForm.get('porcentajePago')?.setValue(null);
      expect(c.responsableForm.get('cantidadPago')?.value).toBe(''); // sin porcentaje no queda el monto anterior
    });

    it('las cuotas de un responsable no pasan de las de la compra, ni siquiera con la compra a 1 cuota', () => {
      const c = montar().componentInstance;
      c.responsableForm.get('cantidadCuotas')?.setValue(2);
      expect(c.errorDeResponsable('cantidadCuotas')).toBe('max');
      c.responsableForm.get('cantidadCuotas')?.setValue(1);
      expect(c.errorDeResponsable('cantidadCuotas')).toBeNull();
    });

    it('al guardar, la compra siguiente arranca con los valores habituales NUEVOS, no con los de antes', () => {
      const defaults = { ...DEFAULTS_VACIOS, tarjetaCreditoId: 11 as number | null };
      TestBed.resetTestingModule();
      configurarTestBed([FormularioComprasCreditoComponent], [{ provide: SugerenciasService, useValue: { defaults: () => of({ ...defaults }), comercios: () => of([]), invalidar: () => undefined } }], [MatAutocompleteModule]);
      const f = TestBed.createComponent(FormularioComprasCreditoComponent);
      f.detectChanges();
      responderCatalogos({ tarjetas: TARJETAS, personas: PERSONAS });
      f.detectChanges();
      const c = f.componentInstance;
      expect(c.cardId?.value).toBe(11);

      spyOn(TestBed.inject(ModalService), 'close');
      llenar(c);
      c.onSubmit();
      defaults.tarjetaCreditoId = 10; // esta compra cambia lo que más usas
      esperar('POST', 'compras-credito').flush({ id: 1 });
      expect(c.cardId?.value).toBe(10);
    });
  });

  describe('cancelar', () => {
    it('sin nada escrito cierra de inmediato', fakeAsync(() => {
      const f = montar();
      const cerrar = spyOn(TestBed.inject(ModalService), 'close');
      f.componentInstance.cancelar();
      tick();
      expect(cerrar).toHaveBeenCalledTimes(1);
      expect(f.componentInstance.confirmandoDescarte).toBeFalse();
      discardPeriodicTasks();
    }));

    it('con cambios pide confirmar; «Seguir editando» conserva lo escrito y «Descartar» lo borra y cierra', fakeAsync(() => {
      const f = montar();
      const c = f.componentInstance;
      const cerrar = spyOn(TestBed.inject(ModalService), 'close');
      llenar(c);
      c.purchaseForm.get('concept')?.markAsDirty();

      c.cancelar();
      tick();
      f.detectChanges();
      expect(c.confirmandoDescarte).toBeTrue();
      expect(cerrar).not.toHaveBeenCalled();
      expect(texto(f, '.compra__pie')).toContain('¿Descartar esta compra?');
      expect(f.nativeElement.querySelector('button[type="submit"]')).toBeNull(); // no se puede guardar a la vez

      c.seguirEditando();
      expect(c.confirmandoDescarte).toBeFalse();
      expect(c.concept?.value).toBe('Nevera');

      c.cancelar();
      tick();
      c.descartar();
      expect(cerrar).toHaveBeenCalledTimes(1);
      expect(c.concept?.value).toBe('');
      expect(c.hayCambios).toBeFalse();
      expect(c.confirmandoDescarte).toBeFalse();
      discardPeriodicTasks();
    }));

    it('si la hoja se cierra por otro lado, la próxima vez no abre con la confirmación puesta', fakeAsync(() => {
      const f = montar();
      const c = f.componentInstance;
      c.concept?.markAsDirty();
      c.cancelar();
      tick();
      expect(c.confirmandoDescarte).toBeTrue();
      TestBed.inject(ModalService).close();
      expect(c.confirmandoDescarte).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('guardar', () => {
    it('envía la compra, cierra la hoja y avisa a la lista', () => {
      const f = montar();
      const c = f.componentInstance;
      const modal = TestBed.inject(ModalService);
      const cerrar = spyOn(modal, 'close');
      const avisar = spyOn(modal, 'notifyCompraCreated');
      llenar(c);

      c.onSubmit();
      expect(c.isSubmitting).toBeTrue();
      const req = esperar('POST', 'compras-credito');
      expect(req.request.body).toEqual(jasmine.objectContaining({ concepto: 'Nevera', valorCompra: 1_200_000, numeroCuotas: 12, interes: 1.9, tarjeta: 11, estado: 'pendiente' }));
      req.flush({ id: 77 });

      expect(c.isSubmitting).toBeFalse();
      expect(cerrar).toHaveBeenCalled();
      expect(avisar).toHaveBeenCalled();
      expect(c.concept?.value).toBe(''); // el formulario queda limpio para la siguiente
    });

    it('con responsables los guarda ligados a la compra recién creada', () => {
      const f = montar();
      const c = f.componentInstance;
      spyOn(TestBed.inject(ModalService), 'close');
      llenar(c);
      c.responsables.push({ persona: 1, porcentajePago: 60, cantidadPago: 720000, cantidadCuotas: 12 }, { persona: 2, porcentajePago: 40, cantidadPago: 480000, cantidadCuotas: 12 });

      c.onSubmit();
      esperar('POST', 'compras-credito').flush({ id: 77 });
      const reqs = http().match((r) => r.method === 'POST' && r.url === `${API}/compras-credito/responsables`);
      expect(reqs.map((r) => r.request.body)).toEqual([
        { persona: 1, porcentajePago: 60, cantidadPago: 720000, cantidadCuotas: 12, compraCredito: 77 },
        { persona: 2, porcentajePago: 40, cantidadPago: 480000, cantidadCuotas: 12, compraCredito: 77 },
      ]);
      expect(c.isSubmitting).toBeTrue(); // sigue ocupado hasta que terminen todos
      reqs.forEach((r) => r.flush({}));
      expect(c.isSubmitting).toBeFalse();
    });

    it('si el servidor rechaza la compra, lo muestra en el formulario y no la cierra', () => {
      const f = montar();
      const c = f.componentInstance;
      const cerrar = spyOn(TestBed.inject(ModalService), 'close');
      llenar(c);

      c.onSubmit();
      errorHttp(esperar('POST', 'compras-credito'), 400, { message: 'La tarjeta no tiene cupo.' });
      f.detectChanges();

      expect(c.isSubmitting).toBeFalse();
      expect(cerrar).not.toHaveBeenCalled();
      expect(texto(f, '.erp-alert--danger')).toContain('La tarjeta no tiene cupo.');
      expect(c.concept?.value).toBe('Nevera'); // lo escrito se conserva para corregir y reintentar
    });

    it('no envía dos veces mientras guarda', () => {
      const f = montar();
      const c = f.componentInstance;
      spyOn(TestBed.inject(ModalService), 'close');
      llenar(c);
      c.onSubmit();
      c.onSubmit();
      const envios = http().match((r) => r.method === 'POST' && r.url === `${API}/compras-credito`);
      expect(envios.length).toBe(1);
      envios[0].flush({ id: 1 });
    });

    it('si la compra se guardó pero fallan los responsables: lo explica, avisa a la lista y no permite guardarla otra vez', () => {
      const f = montar();
      const c = f.componentInstance;
      const avisar = spyOn(TestBed.inject(ModalService), 'notifyCompraCreated');
      llenar(c);
      c.responsables.push({ persona: 1, porcentajePago: 100, cantidadPago: 1_200_000, cantidadCuotas: 12 });

      c.onSubmit();
      esperar('POST', 'compras-credito').flush({ id: 77 });
      errorHttp(esperar('POST', 'compras-credito/responsables'), 500, null);
      f.detectChanges();

      expect(c.compraGuardada).toBeTrue();
      expect(avisar).toHaveBeenCalledTimes(1);
      expect(texto(f, '.erp-alert--danger')).toContain('La compra se guardó, pero no se pudieron asignar los responsables');
      expect(f.nativeElement.querySelector('button[type="submit"]')).toBeNull();

      c.onSubmit(); // verificarHttp() fallaría si saliera otra petición
      TestBed.inject(ModalService).close(); // al cerrar, queda limpio para la siguiente compra
      expect(c.compraGuardada).toBeFalse();
      expect(c.errorServidor).toBeNull();
      expect(c.concept?.value).toBe('');
    });
  });
});
