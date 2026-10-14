import { FormatoPersonaPipe } from './formato-persona.pipe';
import { SharedListasService } from '../services/shared-listas.service';

describe('FormatoPersonaPipe', () => {
  it('create an instance', () => {
    const service = new SharedListasService();
    const pipe = new FormatoPersonaPipe(service);
    expect(pipe).toBeTruthy();
  });
});
