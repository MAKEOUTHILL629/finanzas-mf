# Sistema de diseño

Look & feel inspirado en las Human Interface Guidelines de Apple: limpio, sobrio y translúcido, en **Claro** y **Oscuro**,
en escritorio y móvil. Todo sale de **una sola fuente de verdad**.

| Archivo | Qué contiene |
|---|---|
| `tokens.css` | Colores (primitivas → semánticos → alias heredados), tipografía, espaciado, radios, sombras, movimiento. Todo lo que cambia con el tema vive aquí. |
| `base.css` | Tipografía global (`tabular-nums` en todas las cifras), enfoque, barras de desplazamiento, estructura de página (`AppLayout`), listas flotantes de Material. |
| `components.css` | Clases de los componentes base: tarjeta, botón, campo, insignia, tabla, alerta, esqueleto, control segmentado… |
| `motion.css` | Entrada escalonada (*fade-up*) de rejillas y del Bento, transición de página. |

## Reglas

1. **Ninguna pantalla define colores, radios ni sombras propios.** Se usa `var(--token)`. Si falta un token, se agrega en `tokens.css`.
2. El tema lo fija `data-theme="light|dark"` en `<html>`. Un script de `index.html` lo resuelve **antes del primer cuadro**
   (preferencia guardada o, si no hay, la del sistema), así no hay destello. `ThemeService` lo mantiene y lo guarda.
3. Los gráficos (Chart.js) no entienden `var(--x)`: sus colores se leen con `token('--chart-1')` de `shared/design-tokens.ts`.

## Paleta

| | Claro | Oscuro |
|---|---|---|
| Fondo | `#F5F5F7` | `#000000` / `#09090B` |
| Superficie | `#FFFFFF` | `#1C1C1E` / `#2C2C2E` (elevada) |
| Borde | `rgba(0,0,0,.06)` | `rgba(255,255,255,.08)` |
| Texto | `#1D1D1F` · secundario `#86868B` | `#F5F5F7` · secundario `#A1A1A6` |
| Azul / Verde / Rojo / Naranja | `#007AFF` `#34C759` `#FF3B30` `#FF9500` | `#0A84FF` `#30D158` `#FF453A` `#FF9F0A` |

Tipografía: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", …`. Radios 16–20 px. Vidrio: `blur(20px) saturate(180%)`.

## Componentes base (`src/app/shared/ui/`)

| Componente | Uso |
|---|---|
| `<app-layout>` | Estructura de la aplicación: navegación (barra lateral · riel · panel · barra inferior en móvil), contenedor central de máx. 1280 px y avisos. |
| `<app-page-header titulo subtitulo>` | Cabecera de página con las acciones proyectadas a la derecha. |
| `<app-card variant padding interactive titulo>` | Tarjeta de vidrio. |
| `<button appButton="primary\|secondary\|ghost\|danger" size="sm\|lg" icon block loading>` | Botón (también en `<a>`). Objetivo táctil de 44 px. |
| `<app-badge tone icon solid>` | Insignia de estado. |
| `<app-field label for hint error required>` + `appInput` | Campo de formulario; `appInput` estiliza `input`, `select` y `textarea` nativos. |
| `<app-searchable-select [opciones] formControlName>` | **Combobox buscable** (estilo Spotlight): buscador al abrir (nombre, detalle y datos extra como `*1927`, sin tildes), grupos con encabezados (`grupo`), teclado `↑ ↓ Enter Esc`, botón de limpiar y, en pantallas angostas, hoja inferior. La lista se lleva a `<body>` (un diálogo con `transform` la recortaría). `[abrirAlMostrar]` para editores en línea de una celda. |
| `<app-select catalogo="…">` | Selector de catálogos (personas, tarjetas, cuentas, categorías) sobre el combobox: carga, vacío y error con «Reintentar». Tarjetas y cuentas: «Activas» / «Históricas / Reemplazadas»; personas: `[frecuentes]` (las más usadas primero, **todas** las demás debajo). |
| `<app-select-producto formControlName ultimos4 instrumento>` | Selector único de **tarjetas de crédito, de débito y cuentas** (grupos); entrega `t:ID` / `c:ID` y elige solo el producto de los últimos 4 dígitos dados. |
| `<app-campo-editable etiqueta tipo valor (guardar)>` | **Campo que se edita en el sitio** (estilo Ajustes de iOS): «Etiqueta ··· valor»; al tocarlo se vuelve un control (`texto`, `textarea`, `moneda` con miles, `fecha`, `entero`, `decimal` o `seleccion` buscable) y al terminar emite `(guardar)`. Resalta lo que falta (`faltante`), muestra el valor nuevo mientras guarda (`guardando`) y el motivo si falla (`error`); Escape cancela. |
| `<table appTable compact stack sticky>` | Tabla; en móvil cada fila se vuelve una tarjeta. |
| `<app-empty-state icon titulo descripcion>` | Estado vacío con la acción para empezar. |
| `<app-modal ancho="amplio">` | Diálogo centrado en escritorio (`amplio`: hasta 1120 px, p. ej. dos columnas) y **hoja inferior** en móvil (asa, zona segura, Escape cierra). |
| `<app-theme-toggle variant="segmented\|icon">` | Sistema · Claro · Oscuro, con indicador deslizante. |
| `<app-logo size alt>` | Logo oficial (`public/brand/logo.svg`). Íconos de la app, favicon, manifest y *splash* salen del mismo archivo (`public/brand/`). |
| `appTooltip="texto"` | Globo de ayuda (un único `TooltipService`). Todo botón de solo ícono (`appButton icon`) lo muestra solo, con su `aria-label`; los demás aceptan `appTooltip`. Escape lo cierra. |
| `<app-apple-table [columnas] [filas] clave …>` | **Tabla de datos estándar** (ver abajo). |
| `<app-filter-bar [segmentos] [filtros] [estado] (estadoChange)>` | Buscador + estados rápidos con contador + chips de filtro (selección simple/múltiple con buscador y grupos, rango de fechas, número, interruptor). El estado es un objeto serializable; el filtrado lo hace una función pura de la pantalla. |
| `<app-acciones [principal] [secundarias] (accion)>` | **Acciones de cabecera unificadas**: escritorio = botones (la principal destacada); móvil = un único botón flotante con la principal y las demás en «Más acciones». Todas con globo de ayuda. `ListaAcciones` memoriza listas que cambian con el estado de la pantalla. |

### Tabla de datos (`<app-apple-table>`)

- Columnas declarativas (`ColumnaTabla`: `id`, `titulo`, `valor`, `formato`, `prioridad` 1–3, `anchoMin`, `truncar`, `comparar`…); celdas propias con
  `<ng-template appCelda="id" let-fila>`, acciones por fila con `appAccionesFila` y fila de totales al pie con `[pie]`.
- **Ordenar** por cualquier columna (números por magnitud, fechas por tiempo, texto sin tildes), **paginación** con contador y tamaño de página,
  **columnas visibles** elegibles y recordadas por tabla (`almacenamiento`), modo servidor (`[servidor] [total] (paginaChange)`).
- **Sin scroll horizontal**: si la tabla no cabe se ocultan primero las columnas de prioridad 3 y luego las de 2 (se comprueba con el ancho real
  pintado); en pantallas < 640 px cada fila es una **tarjeta** con las columnas de prioridad 1 (`columnaTitulo` elige el título) y «Ver más».
- Un clic en la fila emite `(filaClick)`; los enlaces y botones de dentro hacen lo suyo y no la abren. `filaClase` marca filas (`apt-fila--tenue`, `apt-fila--activa`).
- `DatosUiModule` (en `shared/`) agrupa tabla, barra de filtros y acciones: lo importan los módulos con listas (no el paquete inicial).

## Móvil

Barra de pestañas inferior estilo iOS (`safe-area-inset-bottom`), tarjetas al 100 % de ancho, modales como hoja inferior y
controles táctiles de al menos 44 × 44 px (`pointer: coarse` o ancho ≤ 640 px).

## Movimiento y rendimiento

- **Entradas escalonadas**: las hijas de `.erp-grid` y los `.bento-item` suben y aparecen una tras otra (`motion.css`).
- **Resortes** (`shared/motion.ts`): `EXPANDIR` (acordeones de desglose), hoja inferior y diálogo del modal, indicador deslizante del selector de
  tema y de la barra inferior del móvil. Todos respetan `prefers-reduced-motion` (CSS en `base.css`; `duracion()` para las de Angular).
- **`<app-contador [valor]>`**: cifra con conteo animado (fuera de la zona de Angular; el lector de pantalla lee siempre el valor final).
- **`<app-skeleton>`** y `.erp-skeleton`: esqueleto con la geometría del contenido (CLS ≈ 0); el brillo se mueve con `transform`.
- **Carga**: cada pantalla es un módulo de carga diferida (`app-routing.module.ts`); el resto se precarga en tiempo ocioso salvo con
  «ahorro de datos» o conexión 2G/3G (`PrecargaInteligente`). Chart.js, Angular Material y los formularios pesados viajan solo con la
  pantalla que los usa. Las lecturas idénticas simultáneas comparten una petición (`deduplicarGetInterceptor`) y los catálogos usan
  *stale-while-revalidate* (`CatalogosService`).
