import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiServicesService } from '../../servicios/api-services.service';
import { BalanceTarjeta, months } from '../../modelos/compras-credito';
import { Subject, takeUntil, finalize } from 'rxjs';

@Component({
  selector: 'app-balance-mes',
  templateUrl: './balance-mes.component.html',
  styleUrls: ['./balance-mes.component.css']
})
export class BalanceMesComponent implements OnInit, OnDestroy {
  balances: BalanceTarjeta[] = [];
  isLoading = false;
  selectedMonth: number;
  selectedYear: number;
  months = months;
  totalBalance = 0;

  private destroy$ = new Subject<void>();

  constructor(private apiService: ApiServicesService) {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1; // getMonth() retorna 0-11
    this.selectedYear = now.getFullYear();
  }

  ngOnInit(): void {
    this.loadBalance();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadBalance(): void {
    this.isLoading = true;
    this.apiService.get<BalanceTarjeta[]>(
      `tarjetas/balance?mes=${this.selectedMonth}&year=${this.selectedYear}`
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoading = false)
    )
    .subscribe({
      next: (data) => {
        this.balances = data;
        this.calculateTotalBalance();
      },
      error: (err) => {
        console.error('Error cargando balance:', err);
        this.balances = [];
        this.totalBalance = 0;
      }
    });
  }

  calculateTotalBalance(): void {
    this.totalBalance = this.balances.reduce(
      (sum, balance) => sum + (balance.total_saldo_restante || 0),
      0
    );
  }

  onMonthChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedMonth = parseInt(value, 10);
    this.loadBalance();
  }

  onYearChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.selectedYear = parseInt(value, 10);
    this.loadBalance();
  }

  getMonthName(monthNumber: number): string {
    return months[monthNumber - 1] || '';
  }

  isCurrentMonth(): boolean {
    const now = new Date();
    return this.selectedMonth === now.getMonth() + 1 &&
           this.selectedYear === now.getFullYear();
  }
}
