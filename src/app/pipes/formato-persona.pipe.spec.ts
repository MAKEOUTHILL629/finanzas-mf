import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormatoPersonaPipe } from './formato-persona.pipe';
import { SharedListasService } from '../services/shared-listas.service';
import { responderCatalogos, persona, tarjetaItem } from '../testing/erp-testing';

describe('FormatoPersonaPipe', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('create an instance', () => {
    const pipe = new FormatoPersonaPipe(TestBed.inject(SharedListasService));
    expect(pipe).toBeTruthy();
    responderCatalogos();
  });

  it('resuelve el nombre desde el catálogo aunque ninguna otra pantalla haya cargado las listas', () => {
    const pipe = new FormatoPersonaPipe(TestBed.inject(SharedListasService));
    expect(pipe.transform(2)).toBe('');
    responderCatalogos({ personas: [persona(2, 'Andrés')], tarjetas: [tarjetaItem(4, 'Visa')] });
    expect(pipe.transform(2)).toBe('Andrés');
    expect(pipe.transform(4)).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
  });
});
