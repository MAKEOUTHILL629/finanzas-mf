import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ApiServicesService } from '../../services/api-services.service';
import { ModalService } from '../../services/modal.service';
import { Tarjeta } from '../../modelos/tarjeta';

interface CSVRecord {
  fechaCompra: string;
  concepto: string;
  valor: string;
  cuotas: string;
  tarjeta: string;
  interes: string;
  descripcion: string;
  estado: string;
  resultado?: string;
  isError?: boolean;
  isSuccess?: boolean;
  isEditing?: boolean;
  selected?: boolean;
}

@Component({
  selector: 'app-formulario-csv-compras',
  templateUrl: './formulario-csv-compras.component.html',
  styleUrls: ['./formulario-csv-compras.component.css']
})
export class FormularioCsvComprasComponent implements OnInit, OnDestroy {

  csvRecords: CSVRecord[] = [];
  csvHeaders: string[] = [];
  isProcessing = false;
  showResults = false;
  showUploadSection = true;
  selectedFile: File | null = null;
  tarjetas: Tarjeta[] = [];
  selectAll = false;
  todayISO = '';

  // Estadísticas
  totalRecords = 0;
  successCount = 0;
  errorCount = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiServicesService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.todayISO = this.getTodayISO();
    this.loadTarjetas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTarjetas(): void {
    this.apiService.get<Tarjeta[]>('tarjetas')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.tarjetas = data;
        },
          error: (err) => { void err; }
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.parseCSV(this.selectedFile);
    }
  }

  private parseCSV(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const csvText = e.target.result;
      this.processCSVText(csvText);
    };
    reader.readAsText(file);
  }

  private processCSVText(csvText: string): void {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;

    // Detectar delimitador (coma o punto y coma)
    const delimiter = this.detectDelimiter(lines[0]);

    // Parsear headers
    const headerLine = lines[0];
    this.csvHeaders = this.parseCSVLine(headerLine, delimiter)
      .map(h => h.trim().toLowerCase());

    // Parsear registros
    this.csvRecords = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i], delimiter);
      if (values.length > 0) {
        const rawFecha = this.getValueByHeader('fecha compra', values) || '';
        const rawTarjeta = this.getValueByHeader('tarjeta', values) || '';
        const resolvedTarjeta = this.resolveTarjetaId(rawTarjeta);
        const record: CSVRecord = {
          fechaCompra: this.normalizeDateToISO(rawFecha),
          concepto: this.getValueByHeader('concepto', values) || '',
          valor: this.getValueByHeader('valor', values).replace(/[^0-9]/g, '') || '',
          cuotas: this.getValueByHeader('cuotas', values) || '',
          tarjeta: resolvedTarjeta,
          interes: this.getValueByHeader('interes', values) || '',
          descripcion: this.getValueByHeader('descripcion', values) || '',
          estado: this.getValueByHeader('estado', values) || 'Pendiente',
          isEditing: false,
          selected: false
        };
        // Auto-rellenar interés si la tarjeta fue reconocida y no hay interés
        if (resolvedTarjeta && !record.interes) {
          const tarjeta = this.tarjetas.find(t => String(t.id) === resolvedTarjeta);
          if (tarjeta?.tasaInteresCompra != null) {
            record.interes = String(tarjeta.tasaInteresCompra);
          }
        }
        this.csvRecords.push(record);
      }
    }

    this.totalRecords = this.csvRecords.length;
    this.showResults = false;
    this.showUploadSection = false; // Ocultar sección de carga
  }

  private detectDelimiter(line: string): string {
    const commaCount = (line.match(/,/g) || []).length;
    const semicolonCount = (line.match(/;/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  private getValueByHeader(headerName: string, values: string[]): string {
    const index = this.csvHeaders.indexOf(headerName);
    return index >= 0 && index < values.length ? values[index] : '';
  }

  // ============================================================
  // HELPERS DE FECHA
  // ============================================================

  private getTodayISO(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  private normalizeDateToISO(dateStr: string): string {
    if (!dateStr) return '';
    // Ya es ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // DD/MM/YYYY | DD-MM-YYYY | DD,MM,YYYY
    const match = dateStr.match(/^(\d{1,2})[\/\-,](\d{1,2})[\/\-,](\d{4})$/);
    if (match) {
      const [, d, m, y] = match;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dateStr;
  }

  // ============================================================
  // HELPERS DE VALOR (FORMATO MONEDA)
  // ============================================================

  getValorDisplay(record: CSVRecord): string {
    const raw = record.valor.replace(/[^0-9]/g, '');
    if (!raw) return '';
    return new Intl.NumberFormat('es-CO').format(parseInt(raw, 10));
  }

  onValorInput(record: CSVRecord, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw   = input.value.replace(/[^0-9]/g, '');
    record.valor = raw;
    // Reformatea visualmente en el mismo input
    input.value = raw ? new Intl.NumberFormat('es-CO').format(parseInt(raw, 10)) : '';
  }

  // ============================================================
  // HELPERS DE TARJETA
  // ============================================================

  /** Resuelve un texto (ID o nombre) al ID de tarjeta como string */
  private resolveTarjetaId(value: string): string {
    if (!value) return '';
    // Si ya es un número coincidente con algún ID
    const byId = this.tarjetas.find(t => String(t.id) === value.trim());
    if (byId) return String(byId.id);
    // Por nombre de franquicia (case-insensitive)
    const byName = this.tarjetas.find(
      t => t.franquicia?.toLowerCase() === value.trim().toLowerCase()
    );
    return byName ? String(byName.id) : value;
  }

  onTarjetaChange(record: CSVRecord, tarjetaId: string): void {
    record.tarjeta = tarjetaId;
    const tarjeta = this.tarjetas.find(t => String(t.id) === tarjetaId);
    if (tarjeta?.tasaInteresCompra != null) {
      record.interes = String(tarjeta.tasaInteresCompra);
    } else if (tarjetaId === '') {
      record.interes = '';
    }
  }

  getTarjetaNombre(tarjetaId: string): string {
    const t = this.tarjetas.find(tt => String(tt.id) === tarjetaId);
    return t?.franquicia ?? tarjetaId;
  }

  // ============================================================
  // SELECCIÓN MÚLTIPLE
  // ============================================================

  get selectedCount(): number {
    return this.csvRecords.filter(r => r.selected).length;
  }

  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    this.csvRecords.forEach(r => (r.selected = this.selectAll));
  }

  deleteSelected(): void {
    this.csvRecords = this.csvRecords.filter(r => !r.selected);
    this.totalRecords = this.csvRecords.length;
    this.selectAll = false;
  }

  // ============================================================
  // FORMATO DE MONEDA (para vista de resultado)
  // ============================================================

  formatCurrency(value: string): string {
    const numValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (isNaN(numValue)) return value;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numValue);
  }

  private generateCSVFromRecords(): string {
    // Crear headers
    const headers = ['Fecha Compra', 'Concepto', 'Valor', 'Cuotas', 'Tarjeta', 'Interes', 'Descripcion', 'Estado'];

    // Crear filas desde csvRecords
    const rows = this.csvRecords.map(record => [
      record.fechaCompra,
      record.concepto,
      record.valor.replace(/[^0-9]/g, ''), // asegurar valor sin formato
      record.cuotas,
      record.tarjeta, // ID de tarjeta
      record.interes,
      record.descripcion || '',
      record.estado || 'Pendiente'
    ]);

    // Generar CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escapar comillas y envolver en comillas si contiene comas
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    return csvContent;
  }

  addNewRecord(): void {
    const newRecord: CSVRecord = {
      fechaCompra: this.todayISO,
      concepto: '',
      valor: '',
      cuotas: '1',
      tarjeta: '',
      interes: '',
      descripcion: '',
      estado: 'Pendiente',
      isEditing: false,
      selected: false
    };
    this.csvRecords.push(newRecord);
    this.totalRecords = this.csvRecords.length;
  }

  startFromScratch(): void {
    this.csvRecords = [];
    this.csvHeaders = ['fecha compra', 'concepto', 'valor', 'cuotas', 'tarjeta', 'interes', 'descripcion', 'estado'];
    this.showUploadSection = false;
    this.showResults = false;
    this.totalRecords = 0;
    // Agregar una fila inicial
    this.addNewRecord();
  }

  editCell(record: CSVRecord, field: keyof CSVRecord): void {
    if (this.showResults) return; // No editar después de procesar
    // No necesitamos isEditing aquí, Angular lo maneja con inputs directos
  }

  updateCell(record: CSVRecord, field: keyof CSVRecord, value: string): void {
    (record as any)[field] = value;
  }

  removeRecord(index: number): void {
    if (this.showResults) return;
    this.csvRecords.splice(index, 1);
    this.totalRecords = this.csvRecords.length;
  }

  uploadCSV(): void {
    if (this.csvRecords.length === 0) return;

    this.isProcessing = true;

    // Generar CSV desde los registros editados
    const csvContent = this.generateCSVFromRecords();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], this.selectedFile?.name || 'compras.csv', { type: 'text/csv' });

    const formData = new FormData();
    formData.append('file', file);

    this.apiService.postFile('compras-credito/upload-csv', formData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isProcessing = false)
      )
      .subscribe({
        next: (response: Blob) => {
          this.processResponse(response);
        },
        error: (err) => {
          void err;
          alert('Error al procesar el archivo CSV');
        }
      });
  }

  private processResponse(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const csvText = e.target.result;
      this.parseResponseCSV(csvText);
    };
    reader.readAsText(blob);
  }

  private parseResponseCSV(csvText: string): void {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;

    const delimiter = this.detectDelimiter(lines[0]);

    // Actualizar headers con la columna Resultado
    const headerLine = lines[0];
    this.csvHeaders = this.parseCSVLine(headerLine, delimiter)
      .map(h => h.trim().toLowerCase());

    // Actualizar registros con resultados
    this.csvRecords = [];
    this.successCount = 0;
    this.errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i], delimiter);
      if (values.length > 0) {
        const resultado = this.getValueByHeader('resultado', values) || '';
        const isSuccess = resultado.toLowerCase().includes('éxito');
        const isError = resultado.toLowerCase().includes('error');

        if (isSuccess) this.successCount++;
        if (isError) this.errorCount++;

        const record: CSVRecord = {
          fechaCompra: this.getValueByHeader('fecha compra', values) || '',
          concepto: this.getValueByHeader('concepto', values) || '',
          valor: this.getValueByHeader('valor', values) || '',
          cuotas: this.getValueByHeader('cuotas', values) || '',
          tarjeta: this.getValueByHeader('tarjeta', values) || '',
          interes: this.getValueByHeader('interes', values) || '',
          descripcion: this.getValueByHeader('descripcion', values) || '',
          estado: this.getValueByHeader('estado', values) || '',
          resultado: resultado,
          isSuccess: isSuccess,
          isError: isError
        };
        this.csvRecords.push(record);
      }
    }

    this.showResults = true;

    // Notificar a la tabla principal para refrescar
    if (this.successCount > 0) {
      this.modalService.notifyCompraCreated();
    }
  }

  downloadResults(): void {
    if (!this.showResults || this.csvRecords.length === 0) return;

    // Crear CSV con resultados
    const headers = ['Fecha Compra', 'Concepto', 'Valor', 'Cuotas', 'Tarjeta', 'Interes', 'Descripcion', 'Estado', 'Resultado'];
    const rows = this.csvRecords.map(r => [
      r.fechaCompra,
      r.concepto,
      r.valor,
      r.cuotas,
      r.tarjeta,
      r.interes,
      r.descripcion,
      r.estado,
      r.resultado || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `resultado_compras_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  reset(): void {
    this.csvRecords = [];
    this.csvHeaders = [];
    this.selectedFile = null;
    this.showResults = false;
    this.showUploadSection = true; // Mostrar sección de carga nuevamente
    this.totalRecords = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.selectAll = false;
  }

  closeModal(): void {
    this.reset();
    this.modalService.close();
  }
}
