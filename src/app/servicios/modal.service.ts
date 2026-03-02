import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {

  private modalState = new BehaviorSubject<string | null>(null);
  private compraCreated = new Subject<void>();

  modalState$ = this.modalState.asObservable();
  compraCreated$ = this.compraCreated.asObservable();

  open(modalId: string) {
    this.modalState.next(modalId);
  }

  close() {
    this.modalState.next(null);
  }

  notifyCompraCreated() {
    this.compraCreated.next();
  }
}
