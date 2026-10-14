# FinanzasMf

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.0.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Backend (NestJS) en local

El frontend consume la API NestJS (`finanzas/backend-nestjs`, puerto 9000):

1. Levanta el backend: `cd ../finanzas/backend-nestjs && npm run start:dev` (necesita su `.env`, ver `.env.example`).
2. Levanta Angular con `npm start`: `proxy.conf.json` reenvía `/api/*` a `http://localhost:9000/api` (mismo origen, sin CORS).
   Los entornos usan `apiUrl: '/api'` (development/prod, detrás de proxy o CloudFront) y `http://localhost:9000/api` (`npm run build:docker`).
3. Servicios del módulo ERP (`src/app/services/`): `cuentas-financieras`, `transacciones`, `notificaciones-correo` (bandeja y
   `conciliarNotificacion`), `recurrentes`, `obligaciones-mes`, `ledger-deudas` y `analytics-flujo-caja`; sus tipos están en
   `src/app/modelos/erp.ts` (los endpoints ERP devuelven filas en `snake_case`; los cuerpos de las peticiones van en `camelCase`).
4. Las fechas de calendario llegan como epoch-ms a las 00:00 UTC: usa `formatDateOnly()` / el pipe `formatoFecha`
   (`shared/date-only.helper.ts`) y no `formatDate(..., 'en-US')` a secas, que mostraría el día anterior en UTC-5.

## Pantallas del ERP

Todas cuelgan de `AppRoutingModule` (guard de sesión) y del menú lateral (`shared/menu`, por secciones). Cada una tiene estados
de carga, vacío y error con reintento.

| Ruta | Qué hace |
|---|---|
| `/prestamos`, `/prestamos/:id` | Totales, filtros, detalle con aprobaciones (aprobar/rechazar), edición por diferencias, marcar como pagado y anular |
| `/cortes-cobro` | Cortes de cobro: activo, futuros y pasados, con estadísticas por corte |
| `/obligaciones`, `/obligaciones/:id` | Obligaciones del mes (resumen, días, aportes y cruces) |
| `/extractos` | Extracto por tarjeta y periodo; **Pagar extracto** (cuenta + fecha, `sp_pagar_extracto_tarjeta`) |
| `/tarjetas` | Edición de día de corte, límite de pago, cupo, tasas y descripción (últimos 4) |
| `/cuentas`, `/categorias` | Cuentas financieras (saldo solo lectura: lo mueve la BD) y categorías, con sugeridas opcionales |
| `/transacciones` | Libro diario por periodo, alta, edición y anulación |
| `/correos` | Bandeja de correos del banco por estado y **conciliación** (confirmar, descartar, cuotas, responsables) |
| `/flujo-caja` | Flujo de caja libre estimado del mes con dona y barras (ng2-charts) |
| `/estado-cuenta`, `/cruces-deuda` | Lo que cada persona debe por mes, extracto por persona, abonos y cruces de deuda |
| `/aportes-carro` | Cuota del carro por mes (acordeón), aportes diarios con desglose por método, cruces de cuentas con terceros, saldo a favor (trasladar al mes siguiente o cruzar contra el estado de cuenta) y configuración de la cuota mensual |
| `/liquidacion` | Liquidación de fin de mes por persona: tarjetas, préstamos, recurrentes, cruces, cuota del carro y abonos; registrar pago, cruzar cuenta y aplicar saldo a favor |
| `/recurrentes-persona` | Cargos o descuentos mensuales por persona, de por vida o por X meses (progreso k/X), pausar/reactivar |

Convenciones:

- **Dinero** solo con el pipe `moneda` (`$1,234.56`, negativos entre paréntesis) y números tabulares; nunca `number` con operaciones
  financieras en el cliente más allá de sumas de presentación.
- **Fechas** de calendario: `formatoFecha` (largo) y `fechaCorta` (`15 oct 2026`, para tablas) leen epoch-ms / ISO medianoche en UTC.
- **Estilos**: tokens del sistema de diseño en `src/styles.css` y clases globales `erp-*` (páginas, tarjetas, tablas apilables en móvil,
  formularios, alertas, skeletons) en `src/styles-erp.css`. Tablas anchas: `erp-table--compact`, y `erp-table--sticky` fija la primera columna.
- **Formularios** reactivos con `inject(FormBuilder)`; los modales usan `ModalService` + `<app-modal>` y destruyen el formulario al cerrar.
- **Pruebas** (`ng test`, Edge headless: `CHROME_BIN=msedge`): `src/app/testing/erp-testing.ts` ofrece los helpers de `HttpTestingController`
  y el módulo de pruebas; `render-smoke.spec.ts` monta todas las pantallas nuevas. La lógica de cada pantalla vive en funciones puras con su spec.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Docker local (con reconstrucción automática)

`../finanzas/docker-compose.local.yml` construye esta imagen (`Dockerfile`, con `nginx.local.conf`: sirve la SPA y reenvía `/api`
a la API NestJS) y la API, y con `docker compose -f docker-compose.local.yml watch` (ejecutado desde `../finanzas`) las reconstruye al guardar cambios.
Frontend en http://localhost:8085. Detalles en `finanzas/backend-nestjs/README.md` ("Docker local con reconstrucción automática").
