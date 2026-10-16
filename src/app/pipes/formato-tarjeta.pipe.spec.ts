import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormatoTarjetaPipe } from './formato-tarjeta.pipe';
import { SharedListasService } from '../services/shared-listas.service';
import { responderCatalogos, persona, tarjetaItem } from '../testing/erp-testing';

describe('FormatoTarjetaPipe', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('create an instance', () => {
    const pipe = new FormatoTarjetaPipe(TestBed.inject(SharedListasService));
    expect(pipe).toBeTruthy();
    responderCatalogos();
  });

  it('resuelve el nombre desde el catálogo aunque ninguna otra pantalla haya cargado las listas', () => {
    const pipe = new FormatoTarjetaPipe(TestBed.inject(SharedListasService));
    expect(pipe.transform(2)).toBe('');
    responderCatalogos({ personas: [persona(2, 'Andrés')], tarjetas: [tarjetaItem(4, 'Visa')] });
    expect(pipe.transform(2)).toBe('');
    expect(pipe.transform(4)).toBe('Visa');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
  });
});
