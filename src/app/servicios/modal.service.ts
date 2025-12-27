import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {

  private modalState = new BehaviorSubject<string | null>(null);

  modalState$ = this.modalState.asObservable();

  open(modalId: string) {
    this.modalState.next(modalId);
  }

  close() {
    this.modalState.next(null);
  }
}
