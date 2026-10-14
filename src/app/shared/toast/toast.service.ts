import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type TipoToast = 'exito' | 'error' | 'info';

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

/** Avisos efímeros (guardado correcto, errores del servidor…). Se muestran con `<app-toast>` en `app.component`. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguienteId = 1;
  private readonly lista = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this.lista.asObservable();

  exito(mensaje: string, duracionMs = 4000): void {
    this.mostrar('exito', mensaje, duracionMs);
  }

  info(mensaje: string, duracionMs = 4000): void {
    this.mostrar('info', mensaje, duracionMs);
  }

  /** Los errores duran más: hay que alcanzar a leerlos. */
  error(mensaje: string, duracionMs = 8000): void {
    this.mostrar('error', mensaje, duracionMs);
  }

  cerrar(id: number): void {
    this.lista.next(this.lista.value.filter((t) => t.id !== id));
  }

  private mostrar(tipo: TipoToast, mensaje: string, duracionMs: number): void {
    const toast: Toast = { id: this.siguienteId++, tipo, mensaje };
    // máximo 4 a la vez: los más viejos salen primero
    this.lista.next([...this.lista.value, toast].slice(-4));
    if (duracionMs > 0) setTimeout(() => this.cerrar(toast.id), duracionMs);
  }
}
