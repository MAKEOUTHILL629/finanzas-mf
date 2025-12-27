import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModalService } from '../../servicios/modal.service';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css'
})
export class ModalComponent implements OnInit, OnDestroy  {

  isOpen = false;
  private subscription: Subscription;

  constructor(private modalService: ModalService) {
    this.subscription = new Subscription();
  }
  ngOnInit(): void {
    this.subscription = this.modalService.modalState$.subscribe(
      modalState => {
        this.isOpen = !!modalState;
      }
    );

  }


  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  closeModal() {
    this.modalService.close();
  }
}
