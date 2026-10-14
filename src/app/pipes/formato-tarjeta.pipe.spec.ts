import { FormatoTarjetaPipe } from './formato-tarjeta.pipe';
import { SharedListasService } from '../services/shared-listas.service';

describe('FormatoTarjetaPipe', () => {
  it('create an instance', () => {
    const service = new SharedListasService();
    const pipe = new FormatoTarjetaPipe(service);
    expect(pipe).toBeTruthy();
  });
});
