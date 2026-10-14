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
