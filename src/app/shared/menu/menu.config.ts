/**
 * Mapa de navegación de la aplicación. Para añadir una sección basta con agregar un ítem a su grupo (o un grupo
 * nuevo): el menú, la búsqueda, los favoritos, la barra inferior del móvil y la sección activa se derivan de aquí.
 */
export interface ItemMenu {
  /** Identificador estable (se guarda en los favoritos): no cambiarlo al renombrar la etiqueta. */
  id: string;
  etiqueta: string;
  /** Versión corta para la barra inferior del móvil (cabe en ~70 px); por defecto se usa la etiqueta. */
  corta?: string;
  /** Nombre de un ícono de Material Icons. */
  icono: string;
  ruta: string;
  /** Palabras que el buscador también reconoce (sin importar tildes ni mayúsculas). */
  palabras?: string;
  /** Rutas de detalle o subpantallas que mantienen resaltado este ítem (p. ej. `/prestamos/7` ya cae por prefijo). */
  relacionadas?: string[];
}

export interface GrupoMenu {
  id: string;
  titulo: string;
  icono: string;
  items: ItemMenu[];
}

export const GRUPOS_MENU: GrupoMenu[] = [
  {
    id: 'cobros',
    titulo: 'Compras y cobros',
    icono: 'shopping_bag',
    items: [
      { id: 'compras-credito', etiqueta: 'Compras crédito', corta: 'Compras', icono: 'credit_card', ruta: '/compras-credito', palabras: 'compras tarjeta cuotas credito', relacionadas: ['/compra-credito-detalle'] },
      { id: 'prestamos', etiqueta: 'Préstamos', icono: 'account_balance_wallet', ruta: '/prestamos', palabras: 'prestamos cobrar deuda aprobaciones' },
      { id: 'pagos-mes', etiqueta: 'Pagos del mes', icono: 'calendar_today', ruta: '/pagos-mes', palabras: 'pagos mes tarjetas cuotas' },
      { id: 'pagos-persona', etiqueta: 'Pagos por persona', corta: 'Por persona', icono: 'people', ruta: '/pagos-mes-personas', palabras: 'pagos persona quien debe', relacionadas: ['/pagos-mes-personas-detalle'] },
      { id: 'cortes-cobro', etiqueta: 'Cortes de cobro', corta: 'Cortes', icono: 'event_repeat', ruta: '/cortes-cobro', palabras: 'cortes cobro corte' },
    ],
  },
  {
    id: 'pagos',
    titulo: 'Pagos',
    icono: 'payments',
    items: [
      { id: 'tarjetas', etiqueta: 'Tarjetas', icono: 'style', ruta: '/tarjetas', palabras: 'tarjetas franquicia cupo tasas dia corte' },
      { id: 'extractos', etiqueta: 'Extractos', icono: 'receipt_long', ruta: '/extractos', palabras: 'extracto pagar tarjeta' },
      { id: 'obligaciones', etiqueta: 'Obligaciones', icono: 'home_work', ruta: '/obligaciones', palabras: 'obligaciones carro casa metas mensuales' },
      { id: 'aportes-carro', etiqueta: 'Aportes del carro', corta: 'Carro', icono: 'directions_car', ruta: '/aportes-carro', palabras: 'carro cuota aportes cruces saldo favor papa' },
    ],
  },
  {
    id: 'dinero',
    titulo: 'Dinero',
    icono: 'account_balance',
    items: [
      { id: 'cuentas', etiqueta: 'Cuentas', icono: 'account_balance', ruta: '/cuentas', palabras: 'cuentas bancos saldo nequi efectivo' },
      { id: 'categorias', etiqueta: 'Categorías', icono: 'category', ruta: '/categorias', palabras: 'categorias gastos ingresos clasificar' },
      { id: 'transacciones', etiqueta: 'Transacciones', corta: 'Movimientos', icono: 'swap_horiz', ruta: '/transacciones', palabras: 'transacciones movimientos ingresos egresos libro diario' },
      { id: 'correos', etiqueta: 'Correos', icono: 'mark_email_unread', ruta: '/correos', palabras: 'correos bancolombia notificaciones conciliar' },
    ],
  },
  {
    id: 'analisis',
    titulo: 'Análisis',
    icono: 'insights',
    items: [
      { id: 'flujo-caja', etiqueta: 'Flujo de caja', corta: 'Flujo', icono: 'query_stats', ruta: '/flujo-caja', palabras: 'flujo caja libre desembolso' },
      { id: 'estado-cuenta', etiqueta: 'Estado de cuenta', corta: 'Estado', icono: 'groups', ruta: '/estado-cuenta', palabras: 'estado cuenta deudas persona cruces abonos', relacionadas: ['/cruces-deuda'] },
      { id: 'liquidacion', etiqueta: 'Liquidación', icono: 'fact_check', ruta: '/liquidacion', palabras: 'liquidacion fin de mes cuanto deben' },
      { id: 'recurrentes-persona', etiqueta: 'Recurrentes por persona', corta: 'Recurrentes', icono: 'autorenew', ruta: '/recurrentes-persona', palabras: 'recurrentes cargos mensuales vitalicio plazo' },
    ],
  },
];

/** Accesos fijados la primera vez (también son los de la barra inferior del móvil). */
export const FAVORITOS_POR_DEFECTO = ['compras-credito', 'prestamos', 'transacciones', 'liquidacion'];

/** La barra inferior del móvil tiene 4 huecos + «Más». */
export const MAX_FAVORITOS = 4;
