# Sistema de diseño

Look & feel inspirado en las Human Interface Guidelines de Apple: limpio, sobrio y translúcido, en **Claro** y **Oscuro**,
en escritorio y móvil. Todo sale de **una sola fuente de verdad**.

| Archivo | Qué contiene |
|---|---|
| `tokens.css` | Colores (primitivas → semánticos → alias heredados), tipografía, espaciado, radios, sombras, movimiento. Todo lo que cambia con el tema vive aquí. |
| `base.css` | Tipografía global (`tabular-nums` en todas las cifras), enfoque, barras de desplazamiento, estructura de página (`AppLayout`), listas flotantes de Material. |
| `components.css` | Clases de los componentes base: tarjeta, botón, campo, insignia, tabla, alerta, esqueleto, control segmentado… |

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
| `<app-select catalogo="…">` | Selector de catálogos (personas, tarjetas, cuentas, categorías) con carga, vacío y error. |
| `<table appTable compact stack sticky>` | Tabla; en móvil cada fila se vuelve una tarjeta. |
| `<app-empty-state icon titulo descripcion>` | Estado vacío con la acción para empezar. |
| `<app-modal>` | Diálogo centrado en escritorio y **hoja inferior** en móvil (asa, zona segura, Escape cierra). |
| `<app-theme-toggle variant="segmented\|icon">` | Sistema · Claro · Oscuro, con indicador deslizante. |

## Móvil

Barra de pestañas inferior estilo iOS (`safe-area-inset-bottom`), tarjetas al 100 % de ancho, modales como hoja inferior y
controles táctiles de al menos 44 × 44 px (`pointer: coarse` o ancho ≤ 640 px).
