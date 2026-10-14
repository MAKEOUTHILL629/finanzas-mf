import { Component } from '@angular/core';
import { Toast, ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent {
  readonly iconos = { exito: 'check_circle', error: 'error', info: 'info' } as const;

  constructor(public toastService: ToastService) {}

  trackById(_: number, t: Toast): number {
    return t.id;
  }
}
