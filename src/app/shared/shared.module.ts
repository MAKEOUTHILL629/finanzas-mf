import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FormatoFechaCortaPipe } from '../pipes/formato-fecha-corta.pipe';
import { FormatoFechaPipe } from '../pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '../pipes/formato-moneda.pipe';
import { FormatoPersonaPipe } from '../pipes/formato-persona.pipe';
import { FormatoTarjetaPipe } from '../pipes/formato-tarjeta.pipe';
import { ModalComponent } from './modal/modal.component';
import { BadgeComponent } from './ui/badge/badge.component';
import { ButtonComponent } from './ui/button/button.component';
import { CardComponent } from './ui/card/card.component';
import { ContadorComponent } from './ui/contador/contador.component';
import { EmptyStateComponent } from './ui/empty-state/empty-state.component';
import { FieldComponent, InputDirective } from './ui/field/field.component';
import { LogoComponent } from './ui/logo/logo.component';
import { PageHeaderComponent } from './ui/page-header/page-header.component';
import { SelectComponent } from './ui/select/select.component';
import { SelectProductoComponent } from './ui/select-producto/select-producto.component';
import { SkeletonComponent } from './ui/skeleton/skeleton.component';
import { TableDirective } from './ui/table/table.directive';
import { ThemeToggleComponent } from './ui/theme-toggle/theme-toggle.component';
import { TooltipDirective } from './ui/tooltip/tooltip.directive';

/** Biblioteca de componentes base del sistema de diseño (`shared/ui`): las pantallas solo usan estos. */
const UI = [
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ContadorComponent,
  EmptyStateComponent,
  FieldComponent,
  InputDirective,
  LogoComponent,
  ModalComponent,
  PageHeaderComponent,
  SelectComponent,
  SelectProductoComponent,
  SkeletonComponent,
  TableDirective,
  ThemeToggleComponent,
];

const PIPES = [FormatoFechaPipe, FormatoFechaCortaPipe, FormatoMonedaPipe, FormatoPersonaPipe, FormatoTarjetaPipe];

/**
 * Lo que comparte toda la aplicación: componentes del sistema de diseño, pipes de formato y los módulos de Angular que casi
 * todas las pantallas usan (formularios y enrutamiento). Angular Material solo lo usan los formularios de compras: va en ese módulo. Cada módulo de funcionalidad (carga diferida) lo importa;
 * lo propio de cada pantalla —y librerías pesadas como las gráficas— queda en su propio paquete.
 */
@NgModule({
  declarations: [...UI, ...PIPES],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, TooltipDirective],
  exports: [...UI, ...PIPES, CommonModule, FormsModule, ReactiveFormsModule, RouterModule, TooltipDirective],
})
export class SharedModule {}
