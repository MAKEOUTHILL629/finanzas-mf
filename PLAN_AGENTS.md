# PLAN MAESTRO DE REFACTORIZACIÓN Y OPTIMIZACIÓN (`finanzas-mf`)
**Objetivo:** Optimizar, limpiar, estructurar y unificar el comportamiento visual y funcional de la aplicación Angular conservando el **100% de la lógica de negocio, contratos de API, cálculos financieros y esencia visual**.

---

## 🚨 REGLAS GLOBALES INQUEBRANTABLES PARA TODOS LOS AGENTES (SYSTEM PROMPT)

> **INSTRUCCIÓN CRÍTICA PARA EL AGENTE:** Eres un agente de refactorización quirúrgica con alcance estrictamente limitado.
> 1. **PROHIBIDO** modificar fórmulas financieras, cálculos de cuotas, intereses, balances, amortizaciones o parseo de CSV.
> 2. **PROHIBIDO** cambiar URLs de endpoints HTTP, nombres de propiedades en payloads JSON o interfaces de respuesta del backend.
> 3. **PROHIBIDO** instalar nuevas librerías en `package.json` (no agregues Angular Material, Tailwind, NgRx ni paquetes externos).
> 4. **PROHIBIDO** modificar archivos fuera de la lista `ARCHIVOS PERMITIDOS` de tu tarea asignada.
> 5. **PROHIBIDO** eliminar métodos públicos o `@Input()` / `@Output()` utilizados en los templates `.html` sin actualizar su referencia exacta en el mismo paso.
> 6. **OBLIGATORIO:** Antes de editar cualquier archivo, debes leer su contenido completo. Tras aplicar tu cambio, debes ejecutar `npx ng build --configuration development` para verificar que hay **0 errores de compilación**. Si el build falla, revierte o corrige dentro de tu alcance antes de finalizar.

---

## FASE 1: Agente 01 — Limpieza de Archivos Basura y Normalización de Entornos

### 🎯 Objetivo
Eliminar archivos de respaldo residuales (`.bak`) y limpiar archivos de entorno huérfanos sin afectar la compilación ni el despliegue en Docker o producción.

### 📂 Alcance Estricto (Sandbox)
* **Archivos a Leer:**
  - `angular.json`
  - `src/environments/enviroment.dev.ts`
  - `src/environments/environment.development.ts`
  - `src/environments/environment.docker.ts`
  - `src/environments/environment.prod.ts`
  - `src/environments/environment.ts`
* **Archivos Permitidos para Eliminar/Modificar:**
  - Eliminar: `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.html.bak`
  - Eliminar: `src/environments/enviroment.dev.ts` *(SOLO tras verificar que no está referenciado en `angular.json` ni en ningún `import` dentro de `src/`)*.
  - Modificar (solo si existiera referencia a `enviroment.dev.ts`): `angular.json`.
* **Archivos Prohibidos:** Cualquier archivo `.ts`, `.html` o `.css` dentro de `src/app/`.

### 📋 Instrucciones Paso a Paso para el Agente 01
1. Elimina el archivo `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.html.bak`.
2. Busca en todo el directorio `src/` y en `angular.json` el texto `enviroment.dev`.
3. Compara el contenido de `src/environments/enviroment.dev.ts` con `src/environments/environment.development.ts`. Si `environment.development.ts` es el estándar usado o si `enviroment.dev.ts` no se usa, elimina `src/environments/enviroment.dev.ts`. Si `angular.json` apuntaba al archivo con typo, apúntalo a `src/environments/environment.development.ts` conservando exactamente las mismas variables.
4. Ejecuta `npx ng build` para validar que las configuraciones de compilación funcionan sin errores.

### ✅ Criterio de Aceptación
- No existen archivos `.bak` en el proyecto.
- No existe `enviroment.dev.ts` con typo.
- `npx ng build` finaliza con código de salida `0`.

---

## FASE 2: Agente 02 — Unificación de Directorios (`core`, `services`, `interceptors`)

### 🎯 Objetivo
Eliminar la duplicidad de carpetas (`src/app/interceptor/` vs `src/app/core/interceptors/` y `src/app/services/` vs `src/app/servicios/`) consolidando una estructura limpia y actualizando únicamente las rutas de `import` sin tocar ni una sola línea de lógica interna.

### 📂 Alcance Estricto (Sandbox)
* **Archivos a Mover:**
  - `src/app/interceptor/csrf-interceptor.interceptor.ts` ➔ `src/app/core/interceptors/csrf-interceptor.interceptor.ts`
  - `src/app/interceptor/csrf-interceptor.interceptor.spec.ts` ➔ `src/app/core/interceptors/csrf-interceptor.interceptor.spec.ts`
  - `src/app/servicios/api-services.service.ts` ➔ `src/app/services/api-services.service.ts`
  - `src/app/servicios/compras-credito.service.ts` ➔ `src/app/services/compras-credito.service.ts`
  - `src/app/servicios/modal.service.ts` ➔ `src/app/services/modal.service.ts`
* **Archivos Permitidos para Modificar:**
  - Únicamente las líneas `import { ... } from '...'` en los archivos `.ts` dentro de `src/app/` que importen los 4 archivos movidos.
* **Prohibición Estricta:** Prohibido cambiar nombres de clases, métodos, variables o lógica dentro de los servicios o componentes.

### 📋 Instrucciones Paso a Paso para el Agente 02
1. Mueve `csrf-interceptor.interceptor.ts` y su `.spec.ts` a `src/app/core/interceptors/` y elimina la carpeta vacía `src/app/interceptor/`.
2. Mueve `api-services.service.ts`, `compras-credito.service.ts` y `modal.service.ts` desde `src/app/servicios/` hacia `src/app/services/` y elimina la carpeta vacía `src/app/servicios/`.
3. Crea un archivo barril opcional `src/app/services/index.ts` y `src/app/core/interceptors/index.ts` o actualiza directamente todas las rutas relativas en `src/app/**/*.ts` que apuntaban a `../servicios/...` o `./interceptor/...`.
4. Ejecuta `npx ng build` y verifica que todos los imports resuelven correctamente.

### ✅ Criterio de Aceptación
- Las carpetas `src/app/interceptor/` y `src/app/servicios/` ya no existen.
- Todos los interceptores viven en `src/app/core/interceptors/`.
- Todos los servicios viven en `src/app/services/`.
- `npx ng build` compila con `0` errores.

---

## FASE 3: Agente 03 — Gestión Centralizada de Tema (Dark / Light / Desktop OS)

### 🎯 Objetivo
Hacer que `ThemeService` sea la única fuente de verdad del tema de la aplicación: debe leer la preferencia guardada por el usuario en `localStorage`, o en su defecto extraer automáticamente el tema oscuro/claro del sistema operativo (desktop), escuchar cambios del OS en tiempo real y aplicar el estado de forma global.

### 📂 Alcance Estricto (Sandbox)
* **Archivos a Leer y Modificar:**
  - `src/app/services/theme.service.ts`
  - `src/app/app.component.ts`
  - `src/app/shared/menu/menu.component.ts`
  - `src/app/shared/menu/menu.component.html`
  - `src/styles.css`
* **Archivos Prohibidos:** Componentes de negocio (`compras-credito`, `pagos-mensuales`, `prestamos`, `login`).

### 📋 Instrucciones Paso a Paso para el Agente 03
1. Lee `src/app/services/theme.service.ts`, `src/styles.css` y `src/app/shared/menu/menu.component.ts` para identificar qué clase CSS o atributo HTML usa actualmente la aplicación para el modo oscuro (ej. `body.dark-theme`, `body.dark-mode` o `[data-theme="dark"]`). **Debes conservar exactamente el mismo nombre de clase/atributo que ya usan los estilos CSS actuales.**
2. Refactoriza `src/app/services/theme.service.ts` para que cumpla este contrato (manteniendo los nombres de métodos públicos actuales que ya consuma `MenuComponent` para no romper compilación):
   - Clave de persistencia en `localStorage`: `'finanzas_theme_preference'` (o la clave actual si ya existe una).
   - Al inicializar el servicio:
     - Si existe valor válido en `localStorage` (`'dark'` | `'light'`), úsalo.
     - Si NO existe valor en `localStorage`, consulta `window.matchMedia('(prefers-color-scheme: dark)').matches` para adoptar el estado del escritorio.
   - Agrega un listener a `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` que actualice automáticamente el tema de la app **solo si el usuario no ha forzado manualmente un tema en `localStorage`** (o agrega método `resetToSystemTheme()`).
   - Expón el estado actual mediante `BehaviorSubject<boolean>` (y/o `Signal` si aplica) y sincroniza la clase/atributo tanto en `document.documentElement` como en `document.body`.
3. En `src/app/app.component.ts`, asegúrate de que `ThemeService` se inyecte y aplique el tema inmediatamente en el arranque para evitar parpadeos al recargar o entrar por `/login`.
4. En `src/app/shared/menu/menu.component.ts`, elimina cualquier manipulación directa de `document.body.classList` o `localStorage` para el tema y delega el 100% de la lectura y cambio de estado a `ThemeService`.

### ✅ Criterio de Aceptación
- Si `localStorage` está limpio, la aplicación inicia en Dark o Light según la configuración del sistema operativo.
- Si el usuario cambia el tema desde el menú, se guarda en `localStorage` y persiste al recargar (`F5`) en cualquier ruta.
- Ningún componente manipula clases de tema directamente en el DOM fuera de `ThemeService`.

---

## FASE 4: Agente 04 — Optimización de Catálogos en Memoria y Pipes (`O(1)`)

### 🎯 Objetivo
Optimizar `SharedListasService` y los pipes `FormatoPersonaPipe`, `FormatoTarjetaPipe` y `FormatoFechaPipe` para evitar búsquedas lineales repetitivas y llamadas HTTP duplicadas al renderizar tablas grandes.

### 📂 Alcance Estricto (Sandbox)
* **Archivos a Leer y Modificar:**
  - `src/app/services/shared-listas.service.ts`
  - `src/app/pipes/formato-persona.pipe.ts`
  - `src/app/pipes/formato-tarjeta.pipe.ts`
  - `src/app/pipes/formato-fecha.pipe.ts`
* **Archivos Prohibidos:** Componentes y servicios HTTP de transacciones.

### 📋 Instrucciones Paso a Paso para el Agente 04
1. Lee `src/app/services/shared-listas.service.ts`. Mantén todos los métodos y propiedades públicas existentes, pero agrega:
   - Diccionarios internos `Map<string | number, Persona>` y `Map<string | number, Tarjeta>` que se actualicen automáticamente cada vez que se cargan o actualizan las listas de personas y tarjetas.
   - Métodos síncronos rápidos `getNombrePersonaById(id)` y `getNombreTarjetaById(id)` con complejidad $O(1)$ usando `.get(id)`.
2. Revisa `src/app/pipes/formato-persona.pipe.ts` y `src/app/pipes/formato-tarjeta.pipe.ts`:
   - Usa la búsqueda indexada $O(1)$ de `SharedListasService` en lugar de recorrer arreglos con `.find()` en cada celda de la tabla.
   - Asegúrate de que el formato de salida (texto devuelto cuando encuentra o no encuentra el registro) sea **idéntico** al actual.
3. Revisa `src/app/pipes/formato-fecha.pipe.ts`:
   - Asegúrate de que tenga `@Pipe({ name: '...', pure: true })` y maneja entradas nulas o vacías de forma segura sin lanzar excepciones.

### ✅ Criterio de Aceptación
- Los pipes devuelven exactamente el mismo texto formateado que antes.
- Las búsquedas de nombres de personas y tarjetas se resuelven en $O(1)$ mediante `Map`.
- `npx ng test --watch=false` y `npx ng build` pasan sin errores.

---

## FASE 5: Agente 05 — Creación del Motor Unificado de Filtros y Búsqueda (`Shared`)

### 🎯 Objetivo
Crear una utilidad/clase reactiva reutilizable y estilos estandarizados para que todas las tablas, buscadores, selectores de filtro (mes, año, tarjeta, persona, estado) y ordenamientos funcionen exactamente igual en toda la aplicación.

### 📂 Alcance Estricto (Sandbox)
* **Archivos a Leer (para extraer patrones actuales):**
  - `src/app/compras-credito/tabla-compras-credito/tabla-compras-credito.component.ts`
  - `src/app/prestamos/tabla-prestamos/tabla-prestamos.component.ts`
  - `src/app/pagos-mensuales/pago-persona-mes/pago-persona-mes.component.ts`
  - `src/app/shared/utils.ts`
  - `src/styles.css`
* **Archivos Permitidos para Crear/Modificar:**
  - Modificar: `src/app/shared/utils.ts`
  - Crear: `src/app/shared/table-filter.helper.ts`
  - Modificar: `src/styles.css` (solo agregar clases utilitarias unificadas si faltan, sin borrar estilos actuales).
* **Archivos Prohibidos:** No modifiques aún los componentes de negocio (eso lo harán los Agentes 06 y 07).

### 📋 Instrucciones Paso a Paso para el Agente 05
1. Analiza cómo filtran y buscan actualmente `tabla-compras-credito.component.ts`, `tabla-prestamos.component.ts` y `pago-persona-mes.component.ts`.
2. En `src/app/shared/utils.ts`, agrega funciones puras y reutilizables:
   - `normalizeSearchText(text: string | null | undefined): string`: convierte a minúsculas, elimina espacios extremos (`trim()`) y remueve tildes/diacríticos (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`) para que buscar `"credito"` encuentre `"Crédito"`.
   - `matchesSearchQuery<T>(item: T, query: string, fieldsExtractor: (item: T) => (string | number | null | undefined)[]): boolean`: evalúa de forma uniforme si un registro coincide con el texto buscado.
3. Crea `src/app/shared/table-filter.helper.ts`:
   - Una clase genérica ligera `TableStateHelper<T>` o funciones de filtrado componibles que permitan:
     - Filtrar por texto libre normalizado.
     - Filtrar por criterios exactos (persona, tarjeta, mes/año, estado pagado/pendiente) ignorando valores `'TODOS'`, `''`, `null` o `undefined`.
     - Persistir opcionalmente el estado de los filtros en `sessionStorage` por clave de vista (ej. `'filtros_compras_credito'`, `'filtros_prestamos'`) para que al cambiar de pestaña y volver, el usuario no pierda el filtro o mes seleccionado, e incluya un método `clearFilters()`.
4. En `src/styles.css`, consolida las variables CSS de controles de filtro (`.shared-filter-bar`, `.shared-search-input`, `.shared-table-container`) respetando las variables del tema claro y oscuro de `STYLE_APP.txt` y `src/styles.css`.

### ✅ Criterio de Aceptación
- Existen `normalizeSearchText`, `matchesSearchQuery` en `src/app/shared/utils.ts` y `src/app/shared/table-filter.helper.ts`.
- Código 100% tipado en TypeScript estricto (sin `any` injustificados).
- `npx ng build` compila sin errores.

---

## FASE 6: Agente 06 — Estandarización de Comportamiento en `compras-credito`

### 🎯 Objetivo
Conectar las tablas y vistas de `src/app/compras-credito/` a las utilidades unificadas de `src/app/shared/utils.ts` y `table-filter.helper.ts`, limpiando código duplicado o muerto dentro de los componentes sin alterar sus templates ni sus reglas de negocio.

### 📂 Alcance Estricto (Sandbox)
* **Archivos Permitidos para Leer y Modificar:**
  - `src/app/compras-credito/tabla-compras-credito/tabla-compras-credito.component.ts`
  - `src/app/compras-credito/detalle-compras-credito/detalle-compras-credito.component.ts`
  - `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.ts`
  - `src/app/compras-credito/pagos-mes-tarjetas-detalle/pagos-mes-tarjetas-detalle.component.ts`
  - `src/app/compras-credito/responsable-credito/responsable-credito.component.ts`
  - `src/app/compras-credito/balance-mes/balance-mes.component.ts`
* **Archivos Prohibidos:**
  - `formulario-compras-credito.component.*` y `formulario-csv-compras.component.*` (no tocar la lógica de creación ni carga CSV).
  - Archivos fuera de `src/app/compras-credito/`.

### 📋 Instrucciones Paso a Paso para el Agente 06
1. En cada uno de los componentes listados, reemplaza las funciones manuales repetidas de normalización de cadenas y búsqueda en tablas por `normalizeSearchText` y `matchesSearchQuery` de `src/app/shared/utils.ts`.
2. Elimina variables privadas no utilizadas, `console.log()` de depuración y suscripciones RxJS que queden abiertas (agregando `takeUntilDestroyed` o limpieza en `ngOnDestroy` donde existan `.subscribe()`).
3. Verifica que todos los nombres de propiedades y métodos invocados desde los archivos `.html` correspondientes permanezcan intactos.
4. Ejecuta `npx ng build` para confirmar que no se rompió ningún enlace con los templates.

### ✅ Criterio de Aceptación
- Búsqueda insensible a mayúsculas, tildes y espacios laterales unificada en todas las vistas de `compras-credito`.
- Cero fugas de memoria por suscripciones abiertas y cero `console.log` de depuración.
- El comportamiento funcional de balances, detalles y tablas es idéntico al original.

---

## FASE 7: Agente 07 — Estandarización de Comportamiento en `pagos-mensuales` y `prestamos`

### 🎯 Objetivo
Aplicar el mismo estándar de búsqueda, filtrado, limpieza de suscripciones y eliminación de código muerto en los módulos `pagos-mensuales` y `prestamos`.

### 📂 Alcance Estricto (Sandbox)
* **Archivos Permitidos para Leer y Modificar:**
  - `src/app/pagos-mensuales/pago-persona-mes/pago-persona-mes.component.ts`
  - `src/app/pagos-mensuales/pago-persona-mes-detalle/pago-persona-mes-detalle.component.ts`
  - `src/app/prestamos/tabla-prestamos/tabla-prestamos.component.ts`
  - `src/app/prestamos/formulario-prestamos/formulario-prestamos.component.ts`
* **Archivos Prohibidos:** Cualquier archivo fuera de `src/app/pagos-mensuales/` y `src/app/prestamos/`.

### 📋 Instrucciones Paso a Paso para el Agente 07
1. Integra `normalizeSearchText` y `matchesSearchQuery` de `src/app/shared/utils.ts` en los filtros de `pago-persona-mes`, `pago-persona-mes-detalle` y `tabla-prestamos`.
2. Limpia variables muertas, imports no usados y `console.log()` en los 4 componentes.
3. Asegura la desuscripción limpia en `ngOnDestroy` para evitar ejecuciones duplicadas al navegar entre vistas.
4. Ejecuta `npx ng build`.

### ✅ Criterio de Aceptación
- El filtrado en `pagos-mensuales` y `prestamos` se comporta exactamente igual que en `compras-credito`.
- Cero errores de compilación en `npx ng build`.

---

## FASE 8: Agente 08 — Limpieza de CSS Duplicado y Auditoría Final de Build

### 🎯 Objetivo
Eliminar reglas CSS muertas o duplicadas en los componentes individuales delegando las variables de color al sistema de temas en `src/styles.css`, y actualizar `ARQUITECTURA_APLICACION.md` con la nueva estructura limpia.

### 📂 Alcance Estricto (Sandbox)
* **Archivos Permitidos para Leer y Modificar:**
  - `src/styles.css`
  - Archivos `.css` de los componentes en `src/app/**/*.css`
  - `ARQUITECTURA_APLICACION.md`
* **Archivos Prohibidos:** Archivos `.ts` y `.html`.

### 📋 Instrucciones Paso a Paso para el Agente 08
1. Revisa los archivos `.css` de cada componente e identifica selectores vacíos o bloques comentados antiguos y elimínalos.
2. Verifica que los colores de fondo, bordes, tablas y textos en los `.css` de componentes utilicen las variables CSS globales definidas en `src/styles.css` (para que respondan instantáneamente al cambio Dark/Light de `ThemeService`) sin alterar medidas (`padding`, `margin`, `grid`, `flex`, `border-radius`).
3. Actualiza `ARQUITECTURA_APLICACION.md` reflejando la consolidación de `src/app/services/`, `src/app/core/interceptors/`, el motor de tema centralizado en `ThemeService` y las utilidades compartidas de filtrado en `src/app/shared/`.
4. Ejecuta `npx ng build --configuration production` para validar que los budgets de estilos en `angular.json` se cumplen con holgura.

### ✅ Criterio de Aceptación
- Reducción del tamaño de los bundles CSS por componente.
- `npx ng build --configuration production` exitoso sin exceder budgets.
- Documentación de arquitectura sincronizada con el estado real del repositorio.
