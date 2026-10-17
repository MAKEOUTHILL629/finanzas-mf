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
import { ComercioHabitual } from '../../modelos/sugerencias';
import { hoyIso } from '../../shared/periodo.helper';
import { configurarTestBed, persona, responderCatalogos, sugerenciasDe, tarjetaItem, verificarHttp } from '../../testing/erp-testing';

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
