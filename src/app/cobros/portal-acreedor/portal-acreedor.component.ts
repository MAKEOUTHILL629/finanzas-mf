import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { PortalAcreedor } from '../../modelos/prestamos-pasivos';
import { CobroPublicoService } from '../../services/cobro-publico.service';
import { environment } from '../../../environments/environment';

/** Portal público del acreedor (Fase 6): recibo estilo Apple Pay del préstamo que te prestó. */
@Component({
  selector: 'app-portal-acreedor',
  templateUrl: './portal-acreedor.component.html',
  styleUrl: './portal-acreedor.component.css',
})
export class PortalAcreedorComponent implements OnInit, OnDestroy {
  portal: PortalAcreedor | null = null;
  cargando = true;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private publico: CobroPublicoService) {}

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.publico.getPortalAcreedor(token).pipe(takeUntil(this.destroy$), finalize(() => (this.cargando = false))).subscribe({
      next: (p) => (this.portal = p),
      error: () => (this.error = 'Este enlace no es válido o ya venció. Pídele a quien te lo envió que te comparta uno nuevo.'),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  urlDescarga(ruta: string | null): string | null {
    return ruta ? `${environment.apiUrl}${ruta.replace(/^\/api/, '')}` : null;
  }
}
