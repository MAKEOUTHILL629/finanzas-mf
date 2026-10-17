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
| `/tarjetas` | Edición de día de corte, límite de pago, cupo, tasas y **últimos 4 dígitos** (varios si se reexpidió: `1927,9587`) |
| `/cuentas`, `/categorias` | Cuentas financieras (saldo solo lectura: lo mueve la BD; una puede ser la **principal**, la que recibe los avisos sin número) y categorías, con sugeridas opcionales |
| `/transacciones` | Libro diario por periodo, alta, edición y anulación |
| `/correos` | Bandeja de correos del banco por estado y **conciliación**; arriba, las **cuentas y tarjetas detectadas** (últimos 4 dígitos con sugerencias para asignarlas de una vez) y **Reprocesar pendientes** (simula primero, aplica en segundo plano). Cada correo muestra si se registró solo, se enlazó a lo que ya tenías o es un aviso repetido, y se puede **deshacer** |
| `/flujo-caja` | Flujo de caja libre estimado del mes con dona y barras (ng2-charts) |
| `/` (Inicio) | **Resumen ejecutivo** en una sola llamada (`GET /api/dashboard/summary`): saludo y frase del día, liquidez y patrimonio, flujo del mes (ingresos vs. gastos propios), tarjetas (mi parte vs. terceros, cupo usado, próximo vencimiento), lo que te deben las personas con los principales deudores, próximos pagos, actividad reciente y pendientes por atender; acciones rápidas (nueva compra, registrar pago, movimiento) |
| `/personas` | **Personas**: por cada persona, «Total a pagar este mes» y «Deuda total pendiente» sumando las cuotas de tus tarjetas que le tocan (según su porcentaje y cuántas cuotas le corresponden), préstamos, recurrentes, gastos repartidos y cruces; desglose interactivo por tarjeta y compra (cuota k de N, qué cuotas quedaron saldadas con sus abonos, qué queda por pagar) y botón para abonar |
| `/estado-cuenta`, `/cruces-deuda` | Lo que cada persona debe por mes, extracto por persona, abonos y cruces de deuda |
| `/aportes-carro` | Cuota del carro por mes (acordeón), aportes diarios con desglose por método, cruces de cuentas con terceros, saldo a favor (trasladar al mes siguiente o cruzar contra el estado de cuenta) y configuración de la cuota mensual |
| `/liquidacion` | Liquidación de fin de mes por persona: tarjetas (con número de cuota, % y valor de la compra), préstamos, recurrentes, **gastos repartidos**, cruces, cuota del carro y abonos; registrar pago, cruzar cuenta, aplicar saldo a favor y **compartir el cobro** con un enlace |
| `/cobros` | **Cobros a personas**: repartir un gasto (luz, mercado, fiesta; a partes iguales, por % o por monto), pagos que las personas reportan con comprobante (aprobar/rechazar), ingresos ya recibidos por aplicar y enlaces compartidos |
| `/p/:token` | **Página pública** (sin sesión ni menú) que abre la persona a la que se le cobra: su saldo, el detalle de cada cobro y un formulario para avisar el pago con su comprobante |
| `/recurrentes-persona` | Cargos o descuentos mensuales por persona, de por vida o por X meses (progreso k/X), pausar/reactivar |

Convenciones:

- **Dinero** solo con el pipe `moneda` (`$1,234.56`, negativos entre paréntesis) y números tabulares; nunca `number` con operaciones
  financieras en el cliente más allá de sumas de presentación.
- **Fechas** de calendario: `formatoFecha` (largo) y `fechaCorta` (`15 oct 2026`, para tablas) leen epoch-ms / ISO medianoche en UTC.
- **Estilos**: tokens del sistema de diseño en `src/design-system/tokens.css` y clases globales `erp-*` (páginas, tarjetas, tablas apilables en móvil,
  formularios, alertas, skeletons) en `src/design-system/components.css` (ver `src/design-system/README.md`). Tablas anchas: `erp-table--compact`, y `erp-table--sticky` fija la primera columna.
- **Formularios** reactivos con `inject(FormBuilder)`; los modales usan `ModalService` + `<app-modal>` y destruyen el formulario al cerrar.
- **Pruebas** (`ng test`, Edge headless: `CHROME_BIN=msedge`): `src/app/testing/erp-testing.ts` ofrece los helpers de `HttpTestingController`
  y el módulo de pruebas; `render-smoke.spec.ts` monta todas las pantallas nuevas. La lógica de cada pantalla vive en funciones puras con su spec.

## Detalle de compra y unificación de deuda (plan V2, fase 5)

- **Detalle como «inspector»** (`compras-credito/detalle-compras-credito`): arriba un resumen (valor en COP, insignia **Pagada / En curso / Refinanciada**, fecha, tarjeta y plástico) y, debajo, tarjetas
  tipo bento con los datos. El aviso **«Faltan X datos por completar»** (`datosFaltantesDeCompra`: tarjeta, plástico, descripción, responsables, interés, TRM sin confirmar) lleva al primer dato que falta
  y resalta los campos vacíos con «Agregar…». Cada dato se edita **en el sitio** con `<app-campo-editable>` (`shared/ui/campo-editable`: texto, dinero con formato, fecha, número o selector buscable;
  Enter/salir guarda, Escape cancela): cada cambio es un `PATCH /api/compras-credito/:id` inmediato con solo ese campo — la página no se recarga ni pierde el lugar; si el servidor lo rechaza vuelve el
  valor anterior y se explica. Valor, fecha, cuotas, interés y tarjeta recalculan las cuotas y vuelven a leer la tabla. El avance muestra «Cuota X de Y», el saldo de capital pendiente, la cuota mensual
  y los totales (`progresoDeCuotas`). Los responsables se guardan con su barra «Guardar responsables».
- **Refinanciamiento**: una compra absorbida muestra «Unificada en Refinanciamiento #N» (enlace a la maestra), no deja cambiar sus finanzas y sus cuotas absorbidas se ven atenuadas; la maestra lista las
  compras que unificó (con el capital que se llevó cada una) y, si la creó el asistente, ofrece **Deshacer unificación**. Las compras de la lista con estado `REFINANCIADA` o el legado «Ajuste Interes» van en el
  segmento «Refinanciadas».
- **Asistente «Simular / Unificar deuda»** (`compras-credito/unificar-deuda`, acción de la cabecera de Compras a crédito): 1) elegir la tarjeta (arranca con la habitual) y las compras con cuotas pendientes
  (saldo de capital, cuota y responsables de cada una); 2) simular con lo que dijo el asesor: **número de cuotas**, **tasa mensual (M.V.) o efectiva anual (E.A.)** —se muestra su equivalente— y la **cuota**, que se
  calcula sola con la fórmula francesa (`shared/amortizacion-francesa.helper.ts`, espejo del backend) y se puede escribir a mano si el banco da otra (entonces se usa la **tasa real** que implica); la simulación
  oficial (`POST /api/refinanciamientos/simular`) compara lo que pagas hoy con lo que pagarías (diferencia mensual y total) y trae la tabla de cuotas; 3) confirmar: una sola operación atómica en el servidor y
  se abre el detalle de la deuda nueva. La lógica pura (totales, pedido, lectura de diferencias) está en `unificar-deuda.helper.ts`.

## Enlace de cobro compartido (plan V2, fase 6)

- **¿Dónde puedes pagar?** (`cobros/metodos-pago-publico`, la usa también la vista previa del propietario): en el enlace público (`/p/:token`) cada medio de pago activo del propietario es una
  tarjeta estilo Apple Wallet (Nequi, Daviplata, cuenta, llave Bre-B…) con el número legible (`numeroLegible`), titular, documento e indicaciones, y un botón **«Copiar número»** que confirma con
  **«¡Copiado!»** (copia el número limpio, sin espacios ni +57: `textoACopiar`). El QR, si existe, se muestra bajo demanda. Solo aparece si la persona todavía debe algo.
- **Observaciones de la persona**: cada cobro del detalle (y el total) tiene **«Observar» / «No reconozco este total»**; abre un formulario con **comentario obligatorio** (y, opcional, cuánto cree que
  debe). Las observaciones y la respuesta del propietario salen en «Mis observaciones»; un rubro con observación abierta dice «Observación enviada». Un **pago rechazado** se muestra como una alerta
  clara arriba, con el comentario del propietario (`reporteRechazadoReciente`), hasta que la persona envíe otro aviso. **Abono parcial**: al escribir menos de lo que debe se avisa cuánto quedaría
  (`analisisMonto`), con «Pagar todo»; el aviso queda marcado «Abono parcial».
- **Administración** (`/cobros`, todo lo nuevo vive en pestañas): **Observaciones** (`observaciones-cobro`, con contador) — cada una se **mantiene** (con explicación obligatoria), se **ajusta** (monto nuevo
  del rubro), se **excluye** o se **descuenta**, y mientras se escribe se ve «Ahora debe → Pasaría a deber» (`descuentoDeAccion`, espejo del servidor); al confirmar, el enlace de la persona se recalcula en el acto
  y el ajuste se puede **deshacer**. **Enlaces compartidos**: botón «Descuento» (`descuento-enlace`: descuento directo con motivo y lista de ajustes vigentes) e insignia de observaciones abiertas.
  **Medios de pago** (`metodos-pago`): agregar/editar con validación por tipo (`errorDeNumeroMetodo`), QR (`prepararQr`), mostrar/ocultar con un interruptor, ordenar, eliminar y vista previa de cómo lo ve la persona.
  **Pagos reportados** marca el abono parcial («quedaría pendiente $X»).

## Correos inteligentes y cobros a personas

- **Productos detectados** (`correos/productos-detectados`): los correos traen solo los últimos 4 dígitos. El panel los agrupa, propone a cuál de tus cuentas o tarjetas pertenece cada uno
  (las tarjetas, por las compras que ya tienes con igual fecha y monto) y permite aceptar todo o asignar a mano. `Reprocesar pendientes` (`correos/reprocesar-correos`) primero **simula**
  —cuántas compras se enlazan, cuántas se crean con tus valores habituales, cuántos avisos repetidos— y solo escribe al confirmar; la fecha de corte evita registrar historial viejo.
- **Conciliar viendo el correo** (`correos/conciliar-correo`, plan V2 fase 3): diálogo ancho con el correo a la izquierda (`visor-correo`: remitente, fecha, asunto y cuerpo limpio —sin enlaces de
  imágenes— con **montos, fechas, comercio y `*XXXX` resaltados**) y el formulario a la derecha; en pantallas angostas son dos pestañas. Tocar un resaltado —o un atajo «Usar lo que dice el correo» /
  «Rellenar todo»— lo copia al campo que corresponde (concepto, monto, fecha, tarjeta/cuenta, notas). Las funciones puras viven en `visor-correo.helpers.ts` (`parsearMonto` entiende `COP35.625,00` y `USD0,99`).
  El **selector único** `<app-select-producto>` (`shared/ui/select-producto`) agrupa tarjetas de crédito, de débito y cuentas, y elige solo el producto por los últimos 4 del correo mirando también
  los plásticos anteriores (`productoPorUltimos4`); una tarjeta de débito se manda como `tarjetaId` y el servidor registra el movimiento en su cuenta. Un aviso en dólares sin tasa pide la **TRM**;
  `fecha` corrige el día. Los cuerpos de `PATCH conciliar` y `POST asignar` pasan por `depurarCuerpo` (sin `""`/`null`, ids como número) y los errores del servidor nombran el campo (`TRM: …`).
- **Formularios inteligentes y selectores buscables** (plan V2 fase 4): todos los selectores de personas, cuentas, tarjetas y categorías (`<app-select>`) y el de producto de los correos son el combobox buscable `<app-searchable-select>`
  (`shared/ui/searchable-select`; `searchable-select.helpers.ts` tiene la búsqueda pura: sin tildes, `*1927`, todas las palabras, grupos). `SugerenciasService` (`services/sugerencias.service.ts`, 5 min en memoria, **nunca falla**: sin
  respuesta el formulario arranca como siempre) trae `GET /api/sugerencias/formularios` y `/comercios`, y con eso: la compra a crédito arranca con la tarjeta que más usas, 1 cuota, la persona de la última compra y, al escribir un
  comercio que ya usaste, su valor, cuotas, tarjeta y responsable habituales; la transacción, con tu cuenta/tarjeta habitual y categoría y cuenta del comercio (lista `datalist`). «Hoy» y la hora son las de **Colombia**
  (`hoyIso`, `aDatetimeLocal` → `America/Bogota`) aunque el navegador esté en otro huso. **Aportes del carro**: el selector de persona ofrece a TODAS (antes solo al responsable y a ti); como el servidor solo admite un tercero
  como «Cruce de cuentas», al elegirlo el método pasa solo a cruce con un aviso (`metodoTrasCambiarPersona`), y las personas que más aportan van primero. Lo que sigue con `<select>` nativo: listas fijas (método, estado, tipo) y la
  importación CSV (cientos de filas).
- **Cobros** (`cobros/`): `FormularioCobroComponent` calcula en vivo cuánto le toca a cada uno (misma aritmética en centavos que el backend, en `cobros.constants.ts`);
  `CompartirCobroComponent` genera el enlace (copiar o WhatsApp) y `AprobarReporteComponent` registra el pago reportado: enlazando el ingreso que ya llegó por correo, creándolo en una cuenta o solo anotándolo.
- **Página pública** (`cobros/cobro-publico`): `app-menu` no se muestra en `/p/…` aunque haya sesión (`MenuStateService.rutaPublica$`). Las fotos del comprobante se reducen en el navegador
  (`shared/archivo.helper.ts`, JPEG ≤ 1600 px) antes de enviarse; los PDF se envían tal cual si pesan menos de 2.2 MB. Los mensajes de error no revelan si un enlace existió.

## Navegación (menú)

El mapa de secciones vive en **`src/app/shared/menu/menu.config.ts`**: para añadir una pantalla basta con agregar un ítem a su grupo
(o un grupo nuevo); el menú, la búsqueda, los favoritos, la barra inferior del móvil y la sección activa se derivan de ahí.
Una prueba verifica que cada enlace del menú existe en el enrutador.

| Dispositivo | Qué se ve |
|---|---|
| Escritorio (≥ 1024 px) | Barra lateral con **buscador** (`Ctrl/⌘ + K`), **favoritos** y **grupos que se despliegan de uno en uno** (el de la sección actual), así nunca hace falta scroll. El botón `«` la **contrae** a una barra de íconos; cada grupo abre un menú emergente. La preferencia se recuerda. |
| Tablet (768–1023 px) | Barra superior con la sección actual y un **panel deslizable** (se cierra con Esc, tocando fuera, deslizando o al navegar). |
| Móvil (< 768 px) | Lo mismo + barra inferior con los **4 favoritos** y «Más» (abre el panel con todo). |
| Sin sesión | Sin menú: solo el cambio de tema. |

- **Favoritos:** la estrella de cada sección la fija (máximo 4, son también los de la barra inferior); la `×` de una ficha la quita.
- **Búsqueda:** ignora tildes y mayúsculas, exige todas las palabras y ordena por relevancia (`↑ ↓` recorren, `Enter` abre, `Esc` limpia).
- El estado (ancho, barra contraída, panel abierto, favoritos) está en `MenuStateService`; el layout de la página lo lee de ahí (`layout-sidebar | layout-rail | layout-drawer | layout-movil | layout-invitado`).

## Listas, filtros y acciones (plan V2)

Todas las pantallas de listas comparten la misma anatomía (ver `src/design-system/README.md`):
`<app-page-header>` + `<app-acciones>` (botón flotante en móvil) → resumen → `<app-filter-bar>` (buscador, estados rápidos y chips) → `<app-apple-table>`.
Convertidas hasta ahora: Compras a crédito, Transacciones, Préstamos, Estado de cuenta, Cruces de deuda y Recurrentes por persona; las demás
cabeceras ya usan `<app-acciones>`. Quedan con `appTable` (ya responsivo con `stack`) las sub-tablas de detalle: desglose de aportes del carro,
compras de una persona, aportes por día de una obligación y muestras de reproceso de correos; el historial de tarjeta se rehace en la fase 2.
Los filtros son funciones puras por pantalla (`compras-filtros.ts`, `transacciones-filtros.ts`, `filtrarPrestamos`, `filtrarRecurrentesConBarra`) con sus pruebas.
**Tarjetas y línea de tiempo (fase 2):** `/tarjetas` agrupa tarjetas de crédito y de débito (una cuenta puede tener varias), con **todos** sus plásticos y su estado
(Activa · Reemplazada · Histórica); «Nueva tarjeta» crea una tarjeta o renueva un plástico y «Plásticos» agrega uno nuevo o uno anterior sin tocar el historial.
`/linea-tiempo` muestra cuándo se usó cada tarjeta (por plástico) y cada cuenta, con sus movimientos. Las tarjetas de débito no se ofrecen en los formularios de
compras a crédito, extractos ni pagos (`<app-select catalogo="tarjetas" [incluirDebito]>` las incluye solo cuando hace falta).
Marca: el logo (`public/brand/logo.svg`) genera favicon, íconos PWA, `manifest.webmanifest`, *splash* de arranque y `<app-logo>`.

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

## Rendimiento de carga

- **Carga diferida por pantalla**: `app-routing.module.ts` solo trae el armazón (menú, avisos) y el inicio de sesión; cada sección es un módulo
  (`*.module.ts` junto a sus componentes) que exporta sus rutas y se descarga al entrar. Paquete inicial: **659 kB** (157 kB comprimido), antes **1,93 MB** (378 kB).
- **Precarga inteligente**: pasados 1,5 s se traen en segundo plano los demás módulos, salvo con «ahorro de datos» o conexión 2G/3G (`PrecargaInteligente`).
- **Librerías pesadas aparte**: Chart.js (solo las piezas usadas) viaja con Flujo de caja y el detalle de una compra; Angular Material solo con los formularios de compras.
- **Peticiones**: las lecturas idénticas simultáneas comparten una sola (`deduplicarGetInterceptor`); los catálogos y el resumen del inicio usan
  *stale-while-revalidate* (se pintan al instante lo ya visto y se actualizan por detrás; se olvidan al cambiar de sesión).
- **Esqueletos** con la geometría del contenido (`<app-skeleton>`) en vez de spinners: sin saltos de diseño al llegar los datos.
- **Presupuestos de build** (`angular.json`): inicial 800 kB (aviso) / 1,5 MB (error); cualquier paquete 400 kB / 800 kB; estilos de componente 40 kB / 80 kB.
- **Servidor**: `nginx.conf` comprime (gzip) y cachea los paquetes con hash un año (`immutable`); `index.html` nunca se cachea. En Vercel, `vercel.json` hace lo mismo.
