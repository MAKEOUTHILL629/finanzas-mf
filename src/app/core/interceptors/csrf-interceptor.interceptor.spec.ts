import { TestBed } from '@angular/core/testing';
import { CsrfInterceptor } from './csrf-interceptor.interceptor';

describe('CsrfInterceptor', () => {
  let interceptor: CsrfInterceptor;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CsrfInterceptor]
    });
    interceptor = TestBed.inject(CsrfInterceptor);
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });
});
