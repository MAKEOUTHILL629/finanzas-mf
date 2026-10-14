import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Persona } from '../../modelos/persona';
import { ApiServicesService } from '../../services/api-services.service';
import { ComprasCredito, ResponsableCompraCredito } from '../../modelos/compras-credito';

@Component({
  selector: 'app-responsable-credito',
  templateUrl: './responsable-credito.component.html',
  styleUrl: './responsable-credito.component.css'
})
export class ResponsableCreditoComponent implements OnInit , OnChanges{
  @Input() compra: ComprasCredito = { id: 0, concepto: '', valorCompra: 0, fechaCompra: new Date(), numeroCuotas: 0, fechaUltimaCuota: new Date(), pagoMensual: 0, interes: 0, descripcion: '', estado: '', tarjeta: 0 };


  responsables: ResponsableCompraCredito[] = [];
  responsablesOriginales: ResponsableCompraCredito[] = []; // Copia para comparación
  responsableForm: FormGroup;
  personas: Persona[] = [];
  personasDisponibles: Persona[] = [];
  porcentajeRestante: number = 100;
  mostrarModalEliminacion: boolean = false;
  responsableAEliminar: ResponsableCompraCredito | null = null;
  eliminando: boolean = false;

  // Estados de edición inline
  responsableEditando: { [id: number]: ResponsableCompraCredito } = {};
  camposEditandoResp: { [id: number]: { [campo: string]: boolean } } = {};

  // Comunicación con componente padre
  @Output() cambiosResponsables = new EventEmitter<{
    hayUsuarios: boolean;
    cambios: Array<{ responsable: ResponsableCompraCredito; cambiosDetalle: any[] }>;
    responsablesModificados: ResponsableCompraCredito[];
  }>();

  constructor(
    private fb: FormBuilder,
    private apiService: ApiServicesService // Asume que has creado este servicio
  ) {
    this.responsableForm = this.fb.group({
      personaId: ['', Validators.required],
      porcentajePago: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      cantidadPago: ['', [Validators.required, Validators.min(0)]],
      cantidadCuotas: ['', [Validators.required, Validators.min(1), Validators.max(this.compra.numeroCuotas || 1)]]
    });
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['compra'] && changes['compra'].currentValue) {
      this.loadResponsables();
      this.updateFormValidators();
    }

  }

  ngOnInit() {

    this.loadResponsables();
    this.loadPersonas();
    this.responsableForm.get('porcentajePago')?.valueChanges.subscribe(value => this.updateCantidadPago(value));
    this.responsableForm.get('cantidadPago')?.valueChanges.subscribe(value => this.updatePorcentajePago(value));
    this.responsableForm.get('personaId')?.valueChanges.subscribe(value => this.onPersonaSelected(value));
  }


  loadResponsables() {
    this.apiService.get<ResponsableCompraCredito[]>(`compras-credito/${this.compra.id}/responsables`).subscribe(
      responsables => {
        this.responsables = responsables;
        // Guardar copia profunda para comparación
        this.responsablesOriginales = JSON.parse(JSON.stringify(responsables));
        this.calcularPorcentajeRestante();
        this.updatePersonasDisponibles();
        this.notificarCambiosAlPadre();
      },
      error => { void error; }
    );
  }

  updateFormValidators() {
    this.responsableForm.get('cantidadCuotas')?.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(this.compra.numeroCuotas || 1)
    ]);
    this.responsableForm.get('cantidadCuotas')?.updateValueAndValidity();

    this.calcularPorcentajeRestante();
  }

  loadPersonas() {
    // Cargar la lista de personas desde tu servicio
    this.apiService.get<Persona[]>(`personas`).subscribe(
      personas => {
        this.personas = personas;
        this.updatePersonasDisponibles();
      },
      error => { void error; }
    );
  }

  updatePersonasDisponibles() {
    const responsablesIds = new Set(this.responsables.map(r => r.persona));
    this.personasDisponibles = this.personas.filter(p => !responsablesIds.has(p.id));
  }

  calcularPorcentajeRestante() {
    const porcentajeAsignado = this.responsables.reduce((sum, r) => sum + r.porcentajePago, 0);
    this.porcentajeRestante = Math.max(0, 100 - porcentajeAsignado);
    this.responsableForm.get('porcentajePago')?.setValidators([
      Validators.required,
      Validators.min(0),
      Validators.max(this.porcentajeRestante)
    ]);
    this.responsableForm.get('porcentajePago')?.updateValueAndValidity();
  }

  updateCantidadPago(porcentaje: number) {
    if (porcentaje !== null && porcentaje !== undefined) {
      // Limitar el porcentaje al porcentaje restante disponible
      const porcentajeAjustado = Math.min(porcentaje, this.porcentajeRestante);
      const cantidadPago = this.roundToTwoDecimals((porcentajeAjustado / 100) * (this.compra.valorCompra || 0));

      // Si el porcentaje fue ajustado, actualizar el campo de porcentaje también
      if (porcentajeAjustado !== porcentaje) {
        this.responsableForm.get('porcentajePago')?.setValue(porcentajeAjustado, { emitEvent: false });
      }

      this.responsableForm.get('cantidadPago')?.setValue(cantidadPago, { emitEvent: false });
    }
  }

  updatePorcentajePago(cantidad: number) {
    if (cantidad !== null && cantidad !== undefined) {
      // Usar 4 decimales internamente para evitar errores de redondeo
      let porcentajePago = Math.round((cantidad / (this.compra.valorCompra || 0)) * 100 * 10000) / 10000;

      // CRÍTICO: Limitar el porcentaje al porcentaje restante disponible
      // Esto evita que la suma de porcentajes supere el 100%
      if (porcentajePago > this.porcentajeRestante) {
        porcentajePago = this.porcentajeRestante;
        // Ajustar la cantidad al máximo permitido con precisión mejorada
        const cantidadMaxima = Math.round((this.porcentajeRestante / 100) * (this.compra.valorCompra || 0));
        this.responsableForm.get('cantidadPago')?.setValue(cantidadMaxima, { emitEvent: false });
      }

      // Mostrar solo 2 decimales al usuario
      this.responsableForm.get('porcentajePago')?.setValue(this.roundToTwoDecimals(porcentajePago), { emitEvent: false });
    }
  }

  onSubmit() {
    if (this.responsableForm.valid) {
      const newResponsable: ResponsableCompraCredito = {
        ...this.responsableForm.value,
        persona: this.personas.find(p => p.id == this.responsableForm.value.personaId)?.id,
        compraCredito:  this.compra.id
      };

      this.apiService.post<ResponsableCompraCredito>(`compras-credito/responsables`, newResponsable).subscribe(
        response => {
          this.responsables.push(response);
          this.responsables.push(response);
          this.calcularPorcentajeRestante();
          this.updatePersonasDisponibles();
          this.responsableForm.reset();
          this.loadResponsables();
        },
        error => { void error; }
      );
    }
  }

  getPersonaNombre(id: number): string {
    const persona = this.personas.find(p => p.id == id);
    return persona ? persona.nombre : 'N/A';
  }

  onPersonaSelected(personaId: string) {
    if (personaId) {
      // Establecer la cantidad de cuotas al valor de numeroCuotasCompra
      this.responsableForm.get('cantidadCuotas')?.setValue(this.compra.numeroCuotas);

      // Establecer el porcentaje de pago al porcentaje restante
      this.responsableForm.get('porcentajePago')?.setValue(this.porcentajeRestante);

      // Actualizar la cantidad de pago basada en el porcentaje
      this.updateCantidadPago(this.porcentajeRestante);
    }
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  // ==================== EDICIÓN INLINE DE RESPONSABLES ====================

  activarEdicionResponsable(responsable: ResponsableCompraCredito, campo: string): void {
    if (!responsable.id) return;

    // Inicializar objeto de campos editando para este responsable
    if (!this.camposEditandoResp[responsable.id]) {
      this.camposEditandoResp[responsable.id] = {};
    }

    // Inicializar copia de edición si no existe
    if (!this.responsableEditando[responsable.id]) {
      this.responsableEditando[responsable.id] = { ...responsable };
    }

    this.camposEditandoResp[responsable.id][campo] = true;
  }

  guardarEdicionResponsable(responsable: ResponsableCompraCredito, campo: string): void {
    if (!responsable.id) return;

    const valorEditado = this.responsableEditando[responsable.id]?.[campo as keyof ResponsableCompraCredito];

    // Validaciones según el campo
    if (campo === 'porcentajePago' || campo === 'cantidadPago') {
      const porcentajeEditado = campo === 'porcentajePago'
        ? Number(valorEditado)
        : (Number(valorEditado) / (this.compra.valorCompra || 1)) * 100;

      // Calcular porcentaje disponible excluyendo el responsable actual
      const porcentajeOtros = this.responsables
        .filter(r => r.id !== responsable.id)
        .reduce((sum, r) => sum + (r.porcentajePago || 0), 0);

      const porcentajeDisponible = 100 - porcentajeOtros;

      if (porcentajeEditado > porcentajeDisponible) {
        alert(`El porcentaje no puede exceder ${porcentajeDisponible.toFixed(2)}%`);
        delete this.responsableEditando[responsable.id];
        this.camposEditandoResp[responsable.id][campo] = false;
        return;
      }

      // Actualizar valores relacionados
      if (campo === 'porcentajePago') {
        this.responsableEditando[responsable.id].porcentajePago = Number(valorEditado);
        this.responsableEditando[responsable.id].cantidadPago =
          (Number(valorEditado) / 100) * (this.compra.valorCompra || 0);
      } else {
        this.responsableEditando[responsable.id].cantidadPago = Number(valorEditado);
        this.responsableEditando[responsable.id].porcentajePago = porcentajeEditado;
      }
    } else if (campo === 'cantidadCuotas') {
      const cuotas = Number(valorEditado);
      if (cuotas < 1 || cuotas > (this.compra.numeroCuotas || 0)) {
        alert(`Las cuotas deben estar entre 1 y ${this.compra.numeroCuotas}`);
        delete this.responsableEditando[responsable.id];
        this.camposEditandoResp[responsable.id][campo] = false;
        return;
      }
      this.responsableEditando[responsable.id].cantidadCuotas = cuotas;
    } else if (campo === 'persona') {
      const personaId = Number(valorEditado);
      const personaExistente = this.responsables.find(r => r.id !== responsable.id && r.persona === personaId);
      if (personaExistente) {
        alert('Esta persona ya está asignada como responsable');
        delete this.responsableEditando[responsable.id];
        this.camposEditandoResp[responsable.id][campo] = false;
        return;
      }
      this.responsableEditando[responsable.id].persona = personaId;
    }

    // Aplicar cambios al responsable actual
    Object.assign(responsable, this.responsableEditando[responsable.id]);

    // Limpiar estado de edición
    this.camposEditandoResp[responsable.id][campo] = false;

    // Notificar cambios al padre
    this.notificarCambiosAlPadre();
  }

  cancelarEdicionResponsable(responsable: ResponsableCompraCredito, campo: string): void {
    if (!responsable.id) return;

    // Restaurar valor original
    if (this.responsableEditando[responsable.id]) {
      delete this.responsableEditando[responsable.id];
    }

    this.camposEditandoResp[responsable.id][campo] = false;
  }

  obtenerValorEditado(responsable: ResponsableCompraCredito, campo: string): any {
    const id = responsable.id;
    if (id && this.responsableEditando[id]) {
      return this.responsableEditando[id][campo as keyof ResponsableCompraCredito];
    }
    return responsable[campo as keyof ResponsableCompraCredito];
  }

  estaEditando(responsable: ResponsableCompraCredito, campo: string): boolean {
    return responsable.id ? (this.camposEditandoResp[responsable.id]?.[campo] || false) : false;
  }

  detectarCambiosResponsables(): boolean {
    return this.responsables.some((resp, index) => {
      const original = this.responsablesOriginales[index];
      if (!original) return false;

      return resp.persona !== original.persona ||
        resp.porcentajePago !== original.porcentajePago ||
        resp.cantidadPago !== original.cantidadPago ||
        resp.cantidadCuotas !== original.cantidadCuotas;
    });
  }

  obtenerCambiosResponsables(): Array<{ responsable: ResponsableCompraCredito; cambiosDetalle: any[] }> {
    const cambios: Array<{ responsable: ResponsableCompraCredito; cambiosDetalle: any[] }> = [];

    this.responsables.forEach((resp) => {
      const original = this.responsablesOriginales.find(o => o.id === resp.id);
      if (!original) return;

      const cambiosDetalle: any[] = [];

      if (resp.persona !== original.persona) {
        cambiosDetalle.push({
          campo: 'Persona',
          anterior: this.getPersonaNombre(original.persona || 0),
          nuevo: this.getPersonaNombre(resp.persona || 0)
        });
      }

      if (resp.porcentajePago !== original.porcentajePago) {
        cambiosDetalle.push({
          campo: 'Porcentaje',
          anterior: `${original.porcentajePago}%`,
          nuevo: `${resp.porcentajePago}%`
        });
      }

      if (resp.cantidadPago !== original.cantidadPago) {
        cambiosDetalle.push({
          campo: 'Monto',
          anterior: this.formatCurrency(original.cantidadPago),
          nuevo: this.formatCurrency(resp.cantidadPago)
        });
      }

      if (resp.cantidadCuotas !== original.cantidadCuotas) {
        cambiosDetalle.push({
          campo: 'Cuotas',
          anterior: original.cantidadCuotas,
          nuevo: resp.cantidadCuotas
        });
      }

      if (cambiosDetalle.length > 0) {
        cambios.push({ responsable: resp, cambiosDetalle });
      }
    });

    return cambios;
  }

  notificarCambiosAlPadre(): void {
    const hayCambios = this.detectarCambiosResponsables();
    const cambios = hayCambios ? this.obtenerCambiosResponsables() : [];
    const responsablesModificados = hayCambios ? this.responsables.filter(r => {
      const original = this.responsablesOriginales.find(o => o.id === r.id);
      return original && (
        r.persona !== original.persona ||
        r.porcentajePago !== original.porcentajePago ||
        r.cantidadPago !== original.cantidadPago ||
        r.cantidadCuotas !== original.cantidadCuotas
      );
    }) : [];

    this.cambiosResponsables.emit({
      hayUsuarios: hayCambios,
      cambios,
      responsablesModificados
    });
  }

  resetearCambios(): void {
    // Restaurar responsables originales
    this.responsables = JSON.parse(JSON.stringify(this.responsablesOriginales));
    this.responsableEditando = {};
    this.camposEditandoResp = {};
    this.notificarCambiosAlPadre();
  }

  private formatCurrency(value: number | undefined): string {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  confirmarEliminacion(responsable: ResponsableCompraCredito) {
    this.responsableAEliminar = responsable;
    this.mostrarModalEliminacion = true;
  }

  cancelarEliminacion() {
    this.mostrarModalEliminacion = false;
    this.responsableAEliminar = null;
  }

  eliminarResponsable() {
    if (!this.responsableAEliminar?.id) return;

    this.eliminando = true;
    this.apiService.delete(`compras-credito/responsables/${this.responsableAEliminar.id}`).subscribe(
      () => {
        // Recargar lista de responsables
        this.loadResponsables();
        this.cancelarEliminacion();
        this.eliminando = false;
      },
      error => {
        void error;
        this.eliminando = false;
      }
    );
  }

  // Método público para ser llamado desde el padre al actualizar
  actualizarResponsables(responsablesModificados: ResponsableCompraCredito[]): Promise<any> {
    const actualizaciones = responsablesModificados.map(resp =>
      this.apiService.put('compras-credito/responsables', resp).toPromise()
    );

    return Promise.all(actualizaciones)
      .then(() => {
        // Recargar lista después de actualizar
        this.loadResponsables();
      })
      .catch(error => {
        void error;
        throw error;
      });
  }
}
