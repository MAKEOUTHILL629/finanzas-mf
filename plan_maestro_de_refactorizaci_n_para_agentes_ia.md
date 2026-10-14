# PLAN MAESTRO DE OPTIMIZACIÓN, ESTRUCTURACIÓN Y UNIFICACIÓN (`finanzas-mf`)
**Diseñado específicamente para ejecución controlada mediante Agentes de IA de Modelos Pequeños (Small LLMs)**

---

## 1. PROPÓSITO Y FILOSOFÍA DE CONTENCIÓN

Este documento define el plan de ingeniería para optimizar, limpiar, modularizar y estandarizar el comportamiento de la aplicación **finanzas-mf** sin alterar su esencia visual, sus reglas de negocio financieras, sus endpoints de API ni su flujo de usuario.

Dado que este plan será ejecutado por **agentes de IA con modelos pequeños** (contexto limitado y propensos a sobre-editar si no tienen fronteras claras), el trabajo se divide en **9 Micro-Misiones secuenciales y atómicas**. Cada misión incluye:
1. **Prompt de Sistema Aislado:** Instrucciones listas para copiar y pegar al agente.
2. **Lista Blanca (Whitelist):** Únicos archivos que el agente tiene permiso de leer y modificar.
3. **Lista Negra (Blacklist):** Archivos y acciones terminantemente prohibidos.
4. **Contrato Técnico Exacto:** Comportamiento esperado para que el modelo no improvise.
5. **Comando de Verificación Obligatorio:** Validación determinista mediante compilación antes de dar por terminada la tarea.

---

## 2. REGLAS GLOBALES INQUEBRANTABLES (GUARDRAILS PARA TODOS LOS AGENTES)

> **COPIAR ESTE BLOQUE EN EL SYSTEM PROMPT DE CADA AGENTE ANTES DE SU MISIÓN:**
>
> ```text
> Eres un Agente de Refactorización Quirúrgica operando sobre un proyecto Angular existente llamado "finanzas-mf".
> Tu único objetivo es ejecutar la misión asignada respetando estas 8 leyes absolutas:
>
> 1. CONSERVACIÓN DEL COMPORTAMIENTO (100%): Está PROHIBIDO alterar cálculos financieros, cuotas, saldos, fórmulas de préstamos, lógica de balances mensuales o parseo de archivos CSV.
> 2. CONTRATOS DE API INTACTOS: Está PROHIBIDO cambiar URLs de endpoints, métodos HTTP, cabeceras de autenticación/CSRF o nombres de propiedades en los modelos de datos enviados/recibidos del backend.
> 3. CERO DEPENDENCIAS EXTERNAS: Está PROHIBIDO modificar `package.json` o instalar librerías de terceros (no Tailwind, no Angular Material, no NgRx, no Lodash).
> 4. SANDBOX DE ARCHIVOS ESTRICTO: Solo puedes modificar o eliminar los archivos listados en la sección [ARCHIVOS PERMITIDOS PARA MODIFICAR] de tu misión. Tocar cualquier otro archivo se considera fallo crítico.
> 5. LECTURA PREVIA OBLIGATORIA: Nunca escribas ni reemplaces código a ciegas. Lee primero el archivo completo para conservar todos los `@Input()`, `@Output()`, propiedades públicas y métodos invocados por su template `.html`.
> 6. PRESERVACIÓN DE ESTÉTICA Y TEMPLATES: No cambies la estructura visual ni elimines clases CSS existentes que definan el diseño de `STYLE_APP.txt` y `src/styles.css`.
> 7. PROHIBICIÓN DE PLACEHOLDERS: Nunca escribas comentarios tipo `// ... resto del código aquí` o `// TODO`. Todo archivo modificado debe quedar completo y funcional.
> 8. VALIDACIÓN DETERMINISTA: Al terminar tus cambios, debes ejecutar `npx ng build --configuration development`. Si aparece un solo error de compilación, debes corregirlo dentro de tu alcance o revertir con `git checkout -- .`.
> ```

---

## 3. DIAGNÓSTICO ARQUITECTÓNICO DEL REPOSITORIO ACTUAL

### 3.1 Archivos Residuales e Inconsistencias Detectadas
* **Archivo basura `.bak`:** `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.html.bak`.
* **Entorno duplicado con error tipográfico:** `src/environments/enviroment.dev.ts` coexiste con `src/environments/environment.development.ts`, `environment.docker.ts`, `environment.prod.ts` y `environment.ts`.
* **Carpetas de servicios duplicadas por idioma:**
  * `src/app/services/` contiene: `auth-service.service.ts`, `shared-listas.service.ts`, `theme.service.ts`.
  * `src/app/servicios/` contiene: `api-services.service.ts`, `compras-credito.service.ts`, `modal.service.ts`.
* **Carpetas de interceptores divididas:**
  * `src/app/core/interceptors/` contiene: `auth.interceptor.ts`, `http-error.interceptor.ts`.
  * `src/app/interceptor/` contiene: `csrf-interceptor.interceptor.ts` y su `.spec.ts`.
* **Nomenclatura mixta en modelos:** `src/app/modelos/Authenticate.ts` (PascalCase) frente al resto en `kebab-case` (`compras-credito.ts`, `pagos.ts`, `persona.ts`, `prestamos.ts`, `tarjeta.ts`).

### 3.2 Problemas de Estado, Comportamiento y Rendimiento a Resolver
1. **Estado del Tema (Dark / Light / Sistema Operativo):** El estado del tema debe ser gobernado al 100% por `ThemeService` (`src/app/services/theme.service.ts`). Si el usuario tiene una preferencia guardada en `localStorage`, se respeta; si no existe, la aplicación debe extraer automáticamente el tema del escritorio/sistema operativo (`window.matchMedia('(prefers-color-scheme: dark)')`) y reaccionar en vivo si el sistema operativo cambia, aplicando el estado desde el arranque en `AppComponent`.
2. **Comportamiento Fragmentado en Tablas, Filtros y Campos de Búsqueda:** Las vistas de `compras-credito`, `pagos-mensuales` y `prestamos` repiten lógica manual para filtrar por texto, persona, tarjeta, mes/año y estado. Se requiere un motor único en `src/app/shared/` para que cualquier filtro, búsqueda insensible a mayúsculas/acentos y persistencia de estado funcione exactamente igual en todas las pantallas.
3. **Complejidad $O(n)$ en Pipes de Tablas:** `FormatoPersonaPipe` y `FormatoTarjetaPipe` (`src/app/pipes/`) se evalúan en cada fila renderizada. Deben respaldarse con diccionarios indexados `Map` de complejidad $O(1)$ en `SharedListasService`.
4. **Fugas de Memoria y Código Muerto:** Suscripciones RxJS sin cerrar en cambios de vista, `console.log` de depuración y reglas CSS repetidas o huérfanas.

---

## 4. MAPA DE ESTRUCTURA OBJETIVO DEL PROYECTO

```text
src/
├── environments/
│   ├── environment.ts
│   ├── environment.development.ts
│   ├── environment.docker.ts
│   └── environment.prod.ts
├── styles.css
└── app/
    ├── app-routing.module.ts
    ├── app.module.ts
    ├── app.component.*
    ├── core/
    │   ├── guards/
    │   │   └── auth.guard.ts
    │   └── interceptors/
    │       ├── auth.interceptor.ts
    │       ├── csrf-interceptor.interceptor.ts       <-- Consolidado aquí
    │       ├── csrf-interceptor.interceptor.spec.ts  <-- Consolidado aquí
    │       └── http-error.interceptor.ts
    ├── services/                                     <-- Única carpeta de servicios
    │   ├── api-services.service.ts                   <-- Movido desde /servicios
    │   ├── auth-service.service.ts
    │   ├── compras-credito.service.ts                <-- Movido desde /servicios
    │   ├── modal.service.ts                          <-- Movido desde /servicios
    │   ├── shared-listas.service.ts                  <-- Optimizado con Map O(1)
    │   └── theme.service.ts                          <-- Fuente única Dark/Light/OS
    ├── modelos/
    │   ├── Authenticate.ts
    │   ├── compras-credito.ts
    │   ├── pagos.ts
    │   ├── persona.ts
    │   ├── prestamos.ts
    │   └── tarjeta.ts
    ├── pipes/
    │   ├── formato-fecha.pipe.*
    │   ├── formato-persona.pipe.*
    │   └── formato-tarjeta.pipe.*
    ├── shared/
    │   ├── utils.ts                                  <-- Helpers puros unificados
    │   ├── table-filter.helper.ts                    <-- Nuevo gestor unificado de filtros/tablas
    │   ├── menu/
    │   │   └── menu.component.*
    │   └── modal/
    │       └── modal.component.*
    ├── login/
    │   └── login.component.*
    ├── compras-credito/
    │   ├── balance-mes/
    │   ├── detalle-compras-credito/
    │   ├── formulario-compras-credito/
    │   ├── formulario-csv-compras/
    │   ├── pagos-mes-tarjetas/                       <-- Sin archivo .bak
    │   ├── pagos-mes-tarjetas-detalle/
    │   ├── responsable-credito/
    │   └── tabla-compras-credito/
    ├── pagos-mensuales/
    │   ├── pago-persona-mes/
    │   └── pago-persona-mes-detalle/
    └── prestamos/
        ├── formulario-prestamos/
        └── tabla-prestamos/
```

---

## 5. MICRO-MISIONES DETALLADAS POR AGENTE

---

### 🤖 AGENTE 01: Limpieza de Archivos Residuales y Normalización de Entornos

#### Prompt de la Misión
> Ejecuta la limpieza de archivos residuales y la normalización de archivos de entorno en `src/environments/` siguiendo estrictamente tu alcance permitido.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `angular.json`
* `src/environments/enviroment.dev.ts`
* `src/environments/environment.development.ts`
* `src/environments/environment.docker.ts`
* `src/environments/environment.prod.ts`
* `src/environments/environment.ts`

#### Alcance Permitido (Whitelist)
* **Eliminar:** `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.html.bak`
* **Eliminar:** `src/environments/enviroment.dev.ts`
* **Modificar (solo si referencia a `enviroment.dev.ts`):** `angular.json`

#### Archivos y Acciones Prohibidas (Blacklist)
* Prohibido tocar cualquier archivo `.ts`, `.html` o `.css` dentro de `src/app/` (excepto borrar el `.bak`).
* Prohibido cambiar las URLs o puertos configurados en los archivos de `environment`.

#### Especificación Paso a Paso
1. Elimina el archivo `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.html.bak`.
2. Inspecciona `angular.json` en las secciones `configurations` de `build` y `serve`.
3. Verifica si `src/environments/enviroment.dev.ts` (con error tipográfico) está referenciado en `angular.json`:
   * Si **NO** está referenciado, elimínalo directamente.
   * Si **SÍ** está referenciado, copia su contenido exacto dentro de `src/environments/environment.development.ts` (si difiere), actualiza la ruta en `angular.json` a `src/environments/environment.development.ts` y elimina `src/environments/enviroment.dev.ts`.
4. Verifica que todos los archivos en `src/environments/` exporten el objeto `environment` con exactamente las mismas propiedades (misma interfaz implícita) para evitar errores de compilación cruzada entre `development`, `docker` y `production`.

#### Definición de Hecho (DoD) y Verificación
* Ejecutar: `npx ng build --configuration development` y `npx ng build --configuration production`.
* Ambos comandos deben finalizar con código `0`.

---

### 🤖 AGENTE 02: Consolidación Arquitectónica de `services` e `interceptors`

#### Prompt de la Misión
> Consolida los servicios de `src/app/servicios/` dentro de `src/app/services/` y el interceptor de `src/app/interceptor/` dentro de `src/app/core/interceptors/`, actualizando únicamente las rutas de `import` en los archivos afectados sin alterar ninguna línea de lógica.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `src/app/app.module.ts`
* `src/app/interceptor/csrf-interceptor.interceptor.ts`
* `src/app/servicios/api-services.service.ts`
* `src/app/servicios/compras-credito.service.ts`
* `src/app/servicios/modal.service.ts`

#### Alcance Permitido (Whitelist)
* **Mover archivos:**
  * `src/app/interceptor/csrf-interceptor.interceptor.ts` $\rightarrow$ `src/app/core/interceptors/csrf-interceptor.interceptor.ts`
  * `src/app/interceptor/csrf-interceptor.interceptor.spec.ts` $\rightarrow$ `src/app/core/interceptors/csrf-interceptor.interceptor.spec.ts`
  * `src/app/servicios/api-services.service.ts` $\rightarrow$ `src/app/services/api-services.service.ts`
  * `src/app/servicios/compras-credito.service.ts` $\rightarrow$ `src/app/services/compras-credito.service.ts`
  * `src/app/servicios/modal.service.ts` $\rightarrow$ `src/app/services/modal.service.ts`
* **Modificar (SOLO líneas `import { ... } from '...'`):**
  * `src/app/app.module.ts`
  * Archivos `.ts` y `.spec.ts` en `src/app/**` que importen `api-services.service`, `compras-credito.service`, `modal.service` o `csrf-interceptor.interceptor`.

#### Archivos y Acciones Prohibidas (Blacklist)
* **PROHIBIDO** cambiar el nombre de las clases (`ApiServicesService`, `ComprasCreditoService`, `ModalService`, `CsrfInterceptorInterceptor`).
* **PROHIBIDO** modificar métodos, propiedades o constructores dentro de cualquier archivo `.ts`.
* **PROHIBIDO** tocar archivos `.html` o `.css`.

#### Especificación Paso a Paso
1. Mueve los archivos indicados a sus carpetas destino (`src/app/core/interceptors/` y `src/app/services/`).
2. Elimina los directorios vacíos `src/app/interceptor/` y `src/app/servicios/`.
3. Busca en todo `src/app/` las cadenas `servicios/` e `interceptor/csrf-interceptor` y actualiza las rutas relativas de importación para que apunten a `services/` y `core/interceptors/csrf-interceptor.interceptor`.
4. Revisa las importaciones internas dentro de los propios archivos movidos (por ejemplo, referencias a `../modelos/...` o `../../environments/environment`) y ajústalas si su profundidad de carpeta cambió (`csrf-interceptor` pasa de nivel 2 a nivel 3 en `core/interceptors/`).

#### Definición de Hecho (DoD) y Verificación
* Las carpetas `src/app/servicios/` y `src/app/interceptor/` no existen.
* Ejecutar: `npx ng build --configuration development` $\rightarrow$ `0` errores.

---

### 🤖 AGENTE 03: Unificación del Estado del Tema (Dark / Light / Desktop OS)

#### Prompt de la Misión
> Centraliza la gestión del tema visual en `ThemeService` para que sea la única fuente de verdad de toda la aplicación, soportando persistencia en `localStorage`, extracción automática del tema del escritorio/sistema operativo cuando no hay preferencia manual, escucha en tiempo real del sistema operativo y aplicación inmediata desde el arranque de la aplicación.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `src/app/services/theme.service.ts`
* `src/app/app.component.ts`
* `src/app/app.component.html`
* `src/app/shared/menu/menu.component.ts`
* `src/app/shared/menu/menu.component.html`
* `src/app/login/login.component.ts`
* `src/styles.css`
* `STYLE_APP.txt`

#### Alcance Permitido (Whitelist)
* `src/app/services/theme.service.ts`
* `src/app/app.component.ts`
* `src/app/shared/menu/menu.component.ts`
* `src/app/shared/menu/menu.component.html` (solo si requiere enlazar al estado del servicio)
* `src/app/login/login.component.ts` (solo si manipula tema manualmente)

#### Archivos y Acciones Prohibidas (Blacklist)
* Prohibido cambiar la paleta de colores definida en `src/styles.css` o `STYLE_APP.txt`.
* Prohibido eliminar métodos públicos de `ThemeService` que ya sean llamados por otros componentes (deben mantenerse por retrocompatibilidad delegando a la nueva lógica).

#### Especificación Técnica y Contrato de Código
1. **Identificación del Selector CSS Actual:** Lee `src/styles.css` y `src/app/services/theme.service.ts` para identificar exactamente qué clase o atributo activa el modo oscuro en el proyecto actual (por ejemplo `dark-theme`, `dark-mode`, `dark` en `document.body` o `data-theme="dark"` en `document.documentElement`). **Usa exactamente ese mismo selector** para no romper ningún estilo existente.
2. **Refactorización de `ThemeService` (`src/app/services/theme.service.ts`):**
   * Debe gestionar dos conceptos claros:
     1. ¿Cuál es el tema activo efectivo (`isDarkMode$: Observable<boolean>` / `isDarkMode(): boolean`)?
     2. ¿El origen del tema es una preferencia guardada por el usuario en `localStorage` o proviene del sistema operativo (`window.matchMedia('(prefers-color-scheme: dark)')`)?
   * **Regla de Inicialización:**
     * Al instanciar el servicio (o llamar a `initTheme()`), leer la clave de `localStorage` que ya utilice el servicio (ej. `'theme'` o `'darkMode'`).
     * Si existe un valor explícito guardado en `localStorage`, aplicar ese estado.
     * Si **NO** existe valor en `localStorage`, consultar `window.matchMedia('(prefers-color-scheme: dark)').matches` y aplicar el estado del escritorio sin escribir todavía en `localStorage` (para seguir respetando cambios automáticos del sistema operativo).
   * **Listener del Sistema Operativo en Tiempo Real:**
     * Suscribirse a `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => ...)`. Si el usuario no ha fijado manualmente un tema en `localStorage`, actualizar el tema de la aplicación instantáneamente cuando el escritorio cambie entre claro y oscuro.
   * **Cambio Manual (`toggleTheme()` / `setDarkMode(isDark: boolean)`):**
     * Cuando el usuario pulsa el botón de tema en el menú, invertir el estado actual, guardar explícitamente la preferencia en `localStorage` y aplicar la clase/atributo en el DOM (`document.body` y `document.documentElement`).
   * **Sincronización entre Pestañas:**
     * Escuchar `window.addEventListener('storage', ...)` para que si el usuario tiene dos pestañas abiertas de la aplicación y cambia a Dark Mode en una, la otra cambie automáticamente.
3. **Inicialización Global en `AppComponent` (`src/app/app.component.ts`):**
   * Inyectar `ThemeService` en el `constructor` o `ngOnInit` de `AppComponent` para que el tema se aplique desde el milisegundo cero en cualquier ruta (incluyendo `/login`), sin depender de que `<app-menu>` esté montado.
4. **Limpieza en `MenuComponent` (`src/app/shared/menu/menu.component.ts`):**
   * Asegurar que `MenuComponent` lea el estado de `ThemeService` y llame al método del servicio al alternar el tema, eliminando lecturas directas duplicadas a `localStorage` o `document.body` dentro del componente.

#### Definición de Hecho (DoD) y Verificación
* Si se borra `localStorage`, la app adopta automáticamente el modo oscuro o claro del escritorio.
* Si se cambia el tema en el menú, persiste al recargar (`F5`) tanto en `/login` como en las vistas internas.
* Ejecutar: `npx ng build --configuration development` $\rightarrow$ `0` errores.

---

### 🤖 AGENTE 04: Optimización de Catálogos en Memoria y Pipes con Complejidad $O(1)$

#### Prompt de la Misión
> Optimiza `SharedListasService` y los pipes `FormatoPersonaPipe`, `FormatoTarjetaPipe` y `FormatoFechaPipe` implementando indexación en memoria mediante `Map` de complejidad $O(1)$ y evitando recálculos innecesarios en las tablas, conservando el 100% de las firmas públicas y formatos de salida actuales.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `src/app/services/shared-listas.service.ts`
* `src/app/pipes/formato-persona.pipe.ts`
* `src/app/pipes/formato-tarjeta.pipe.ts`
* `src/app/pipes/formato-fecha.pipe.ts`
* `src/app/modelos/persona.ts`
* `src/app/modelos/tarjeta.ts`

#### Alcance Permitido (Whitelist)
* `src/app/services/shared-listas.service.ts`
* `src/app/pipes/formato-persona.pipe.ts`
* `src/app/pipes/formato-tarjeta.pipe.ts`
* `src/app/pipes/formato-fecha.pipe.ts`
* Archivos `.spec.ts` en `src/app/pipes/` (solo si requieren ajuste por inyección)

#### Archivos y Acciones Prohibidas (Blacklist)
* Prohibido cambiar el nombre de los pipes en `@Pipe({ name: '...' })`.
* Prohibido cambiar el texto devuelto por `transform(...)` para cualquier entrada válida o inválida.

#### Especificación Paso a Paso
1. En `src/app/services/shared-listas.service.ts`:
   * Conserva todas las propiedades y `BehaviorSubject` / `Observable` actuales para no romper ningún componente suscrito.
   * Añade mapas privados indexados por ID (`private personasMap = new Map<string | number, Persona>()` y `private tarjetasMap = new Map<string | number, Tarjeta>()`).
   * Cada vez que se actualice la lista de personas o tarjetas en el servicio, reconstruye inmediatamente el `Map` correspondiente (indexando tanto por clave numérica como por `String(id)` para evitar fallos por coerción `1` vs `'1'`).
   * Expón métodos de consulta instantánea $O(1)$: `findPersonaFast(id: string | number | null | undefined): Persona | undefined` y `findTarjetaFast(id: string | number | null | undefined): Tarjeta | undefined`.
2. En `src/app/pipes/formato-persona.pipe.ts` y `src/app/pipes/formato-tarjeta.pipe.ts`:
   * Si el pipe recibe el arreglo de catálogo por parámetro o lo consulta del servicio, optimiza la búsqueda para que use acceso directo $O(1)$ o cachee un `WeakMap` del arreglo recibido en lugar de ejecutar `.find()` linealmente por cada celda en cada ciclo de detección de cambios.
3. En `src/app/pipes/formato-fecha.pipe.ts`:
   * Asegura que maneje valores nulos/indefinidos de forma segura y evite instanciar expresiones regulares o parseadores pesados repetidamente si el valor de entrada es idéntico.

#### Definición de Hecho (DoD) y Verificación
* El formato de fechas, nombres de personas y nombres de tarjetas en todas las tablas es 100% idéntico al original.
* Ejecutar: `npx ng build --configuration development` $\rightarrow$ `0` errores.

---

### 🤖 AGENTE 05: Creación del Motor Unificado de Búsqueda, Filtros y Estado de Tablas (`src/app/shared/`)

#### Prompt de la Misión
> Crea las utilidades centralizadas de normalización de búsqueda, filtrado multicriterio, ordenamiento y persistencia de estado de filtros en `src/app/shared/utils.ts` y `src/app/shared/table-filter.helper.ts`, de modo que todas las tablas y barras de filtros de la aplicación compartan una única lógica estandarizada.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `src/app/shared/utils.ts`
* `src/app/compras-credito/tabla-compras-credito/tabla-compras-credito.component.ts`
* `src/app/compras-credito/detalle-compras-credito/detalle-compras-credito.component.ts`
* `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.ts`
* `src/app/pagos-mensuales/pago-persona-mes/pago-persona-mes.component.ts`
* `src/app/prestamos/tabla-prestamos/tabla-prestamos.component.ts`

#### Alcance Permitido (Whitelist)
* **Modificar:** `src/app/shared/utils.ts`
* **Crear:** `src/app/shared/table-filter.helper.ts`

#### Archivos y Acciones Prohibidas (Blacklist)
* Prohibido eliminar cualquier función que ya exista actualmente en `src/app/shared/utils.ts`.
* Prohibido modificar los componentes de negocio en esta fase (eso corresponde a los Agentes 06 y 07).

#### Especificación Técnica y Contrato de Código
1. **Conservar todo el contenido actual de `src/app/shared/utils.ts`** y agregar las siguientes funciones puras y tipadas:
   * `normalizeSearchText(value: unknown): string`:
     * Si `value === null || value === undefined`, devuelve `''`.
     * Convierte a `String(value)`, aplica `.trim().toLowerCase()`, y elimina tildes/diacríticos mediante `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`.
   * `matchesSearchFields(query: string | null | undefined, fields: unknown[]): boolean`:
     * Si la búsqueda normalizada está vacía (`''`), devuelve `true`.
     * Permite búsqueda por términos múltiples separados por espacio (ej. `"amazon 50000"` coincide si todos los tokens del query están presentes en alguno de los campos del registro).
   * `matchesExactFilter(itemValue: unknown, filterValue: unknown, allTokens: string[] = ['TODOS', 'TODAS', 'ALL', '', '-1', '0']): boolean`:
     * Unifica el comportamiento de los `<select>` de filtros (por persona, por tarjeta, por mes, por año, por estado). Si el filtro está vacío, es `null`, `undefined` o coincide con el valor comodín de "todos" que use el componente, devuelve `true`; de lo contrario compara de forma segura `String(itemValue).trim() === String(filterValue).trim()`.
2. **Crear `src/app/shared/table-filter.helper.ts`:**
   * Implementar una utilidad reutilizable `FilterStateStorage` que permita guardar y recuperar el estado de los filtros de cada pantalla en `sessionStorage` de forma segura (con `try/catch` por si el navegador bloquea storage):
     * `saveState<T extends Record<string, any>>(viewKey: string, state: T): void`
     * `loadState<T extends Record<string, any>>(viewKey: string, defaultState: T): T`
     * `clearState(viewKey: string): void`
   * Implementar un helper de sumatorias seguras `sumByField<T>(items: T[], selector: (item: T) => number | string | null | undefined): number` que evite errores de punto flotante o `NaN` al recalcular totales de tablas filtradas.

#### Definición de Hecho (DoD) y Verificación
* `src/app/shared/utils.ts` conserva sus funciones originales y exporta las nuevas funciones de normalización y filtrado.
* `src/app/shared/table-filter.helper.ts` existe, no usa tipos `any` inseguros y compila sin errores.
* Ejecutar: `npx ng build --configuration development` $\rightarrow$ `0` errores.

---

### 🤖 AGENTE 06: Unificación de Filtros, Tablas y Limpieza en el Módulo `compras-credito`

#### Prompt de la Misión
> Estandariza el comportamiento de búsqueda, filtros, recálculo de totales y gestión de suscripciones en los componentes de visualización de `src/app/compras-credito/` utilizando las utilidades de `src/app/shared/utils.ts` y `src/app/shared/table-filter.helper.ts`, sin alterar los templates `.html` ni la lógica de negocio financiera.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `src/app/shared/utils.ts`
* `src/app/shared/table-filter.helper.ts`
* `src/app/compras-credito/tabla-compras-credito/tabla-compras-credito.component.ts` y `.html`
* `src/app/compras-credito/detalle-compras-credito/detalle-compras-credito.component.ts` y `.html`
* `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.ts` y `.html`
* `src/app/compras-credito/pagos-mes-tarjetas-detalle/pagos-mes-tarjetas-detalle.component.ts` y `.html`
* `src/app/compras-credito/responsable-credito/responsable-credito.component.ts` y `.html`
* `src/app/compras-credito/balance-mes/balance-mes.component.ts` y `.html`

#### Alcance Permitido (Whitelist)
* `src/app/compras-credito/tabla-compras-credito/tabla-compras-credito.component.ts`
* `src/app/compras-credito/detalle-compras-credito/detalle-compras-credito.component.ts`
* `src/app/compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component.ts`
* `src/app/compras-credito/pagos-mes-tarjetas-detalle/pagos-mes-tarjetas-detalle.component.ts`
* `src/app/compras-credito/responsable-credito/responsable-credito.component.ts`
* `src/app/compras-credito/balance-mes/balance-mes.component.ts`

#### Archivos y Acciones Prohibidas (Blacklist)
* **PROHIBIDO** modificar `formulario-compras-credito.component.*` y `formulario-csv-compras.component.*` (la lógica de creación, edición y carga masiva de CSV no se toca).
* **PROHIBIDO** cambiar nombres de variables o métodos enlazados en los archivos `.html`.

#### Especificación Paso a Paso
1. **Unificación de Búsqueda en Campos de Texto:**
   * En todos los componentes de `compras-credito` que tengan barra de búsqueda o filtro por descripción/comercio/persona/tarjeta, reemplaza los `.toLowerCase().includes(...)` manuales por `normalizeSearchText` y `matchesSearchFields` de `src/app/shared/utils.ts`. Así, el usuario podrá buscar con o sin tildes, con espacios al inicio/final o combinando palabras en cualquier tabla de compras a crédito.
2. **Consistencia en Selectores de Filtro (Mes, Año, Tarjeta, Responsable):**
   * Garantiza que al cambiar un filtro o limpiar filtros, la lista filtrada y los totales mostrados en pantalla se actualicen de manera determinista e inmediata.
3. **Limpieza de Código y Fugas de Memoria:**
   * Elimina `console.log()` de depuración, imports no utilizados y variables privadas huérfanas.
   * Si existen suscripciones de larga duración (`BehaviorSubject` / `Observable` de servicios compartidos o eventos de modal) dentro de `ngOnInit`, asegúrate de que se limpien correctamente implementando `OnDestroy` (`Subject<void>` con `takeUntil(this.destroy$)` o `Subscription.unsubscribe()`).

#### Definición de Hecho (DoD) y Verificación
* Todas las tablas de `compras-credito` filtran texto ignorando tildes, mayúsculas y espacios sobrantes.
* Ninguna variable usada por los templates `.html` fue renombrada ni eliminada.
* Ejecutar: `npx ng build --configuration development` $\rightarrow$ `0` errores.

---

### 🤖 AGENTE 07: Unificación de Filtros, Tablas y Limpieza en `pagos-mensuales` y `prestamos`

#### Prompt de la Misión
> Estandariza el comportamiento de búsqueda, filtros y gestión de memoria en los componentes de `src/app/pagos-mensuales/` y `src/app/prestamos/` usando `src/app/shared/utils.ts` y `src/app/shared/table-filter.helper.ts`, manteniendo intactos sus templates `.html` y sus cálculos.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `src/app/shared/utils.ts`
* `src/app/shared/table-filter.helper.ts`
* `src/app/pagos-mensuales/pago-persona-mes/pago-persona-mes.component.ts` y `.html`
* `src/app/pagos-mensuales/pago-persona-mes-detalle/pago-persona-mes-detalle.component.ts` y `.html`
* `src/app/prestamos/tabla-prestamos/tabla-prestamos.component.ts` y `.html`
* `src/app/prestamos/formulario-prestamos/formulario-prestamos.component.ts` y `.html`

#### Alcance Permitido (Whitelist)
* `src/app/pagos-mensuales/pago-persona-mes/pago-persona-mes.component.ts`
* `src/app/pagos-mensuales/pago-persona-mes-detalle/pago-persona-mes-detalle.component.ts`
* `src/app/prestamos/tabla-prestamos/tabla-prestamos.component.ts`
* `src/app/prestamos/formulario-prestamos/formulario-prestamos.component.ts`

#### Archivos y Acciones Prohibidas (Blacklist)
* Prohibido alterar la lógica de creación o abono de préstamos.
* Prohibido cambiar las fórmulas de cálculo de deuda por persona o por mes.
* Prohibido modificar archivos fuera de `src/app/pagos-mensuales/` y `src/app/prestamos/`.

#### Especificación Paso a Paso
1. Reemplaza las comparaciones manuales de cadenas en los filtros de `pago-persona-mes`, `pago-persona-mes-detalle` y `tabla-prestamos` por `normalizeSearchText` y `matchesSearchFields` de `src/app/shared/utils.ts`.
2. Asegura que cuando una búsqueda o combinación de filtros no arroje resultados, el estado vacío y los totales en `$0` se comporten de forma idéntica a `tabla-compras-credito`.
3. Elimina `console.log()` de depuración, código comentado muerto e imports sin usar.
4. Garantiza la desuscripción en `ngOnDestroy` de cualquier suscripción a servicios compartidos (`SharedListasService`, `ModalService`, etc.).

#### Definición de Hecho (DoD) y Verificación
* Las búsquedas y filtros en `pagos-mensuales` y `prestamos` tienen exactamente el mismo comportamiento que en `compras-credito`.
* Ejecutar: `npx ng build --configuration development` $\rightarrow$ `0` errores.

---

### 🤖 AGENTE 08: Modularización Interna y Organización de `AppModule`

#### Prompt de la Misión
> Organiza y estructura `src/app/app.module.ts` y `src/app/app-routing.module.ts` agrupando limpiamente las importaciones, declaraciones y proveedores por dominio (`Core`, `Shared`, `ComprasCredito`, `PagosMensuales`, `Prestamos`) o mediante módulos de dominio sin cambiar ninguna ruta URL ni ningún selector de componente.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `src/app/app.module.ts`
* `src/app/app-routing.module.ts`
* `src/app/core/guards/auth.guard.ts`
* `src/app/core/interceptors/auth.interceptor.ts`
* `src/app/core/interceptors/csrf-interceptor.interceptor.ts`
* `src/app/core/interceptors/http-error.interceptor.ts`

#### Alcance Permitido (Whitelist)
* `src/app/app.module.ts`
* `src/app/app-routing.module.ts`
* Opcional (solo si facilita la organización sin romper tests): crear `src/app/shared/shared.module.ts` o `src/app/core/core.module.ts`.

#### Archivos y Acciones Prohibidas (Blacklist)
* **PROHIBIDO** cambiar los `path` de las rutas en `app-routing.module.ts` (todas las URLs deben seguir siendo exactamente las mismas).
* **PROHIBIDO** alterar el orden de ejecución de los `HTTP_INTERCEPTORS`.

#### Especificación Paso a Paso
1. Limpia los imports duplicados o desordenados en `src/app/app.module.ts` tras el movimiento de carpetas de la Fase 2.
2. Estructura las declaraciones y proveedores en bloques claramente documentados (`CORE_PROVIDERS`, `SHARED_DECLARATIONS`, `COMPRAS_CREDITO_DECLARATIONS`, `PAGOS_MENSUALES_DECLARATIONS`, `PRESTAMOS_DECLARATIONS`) o en submódulos cohesivos que exporten sus componentes y pipes necesarios.
3. Verifica en `src/app/app-routing.module.ts` que todas las rutas protegidas utilicen consistentemente `AuthGuard` y que las redirecciones por defecto (`''` y `'**'`) conserven su comportamiento actual.

#### Definición de Hecho (DoD) y Verificación
* `app.module.ts` y `app-routing.module.ts` están limpios, estructurados por dominio y sin imports huérfanos.
* Ejecutar: `npx ng build --configuration production` $\rightarrow$ `0` errores.

---

### 🤖 AGENTE 09: Estandarización de Estilos CSS (Dark/Light), Limpieza de CSS Muerto y Documentación

#### Prompt de la Misión
> Audita `src/styles.css` y las hojas de estilo de los componentes para eliminar selectores vacíos o código CSS comentado, asegurar que todos los controles de búsqueda, filtros, tablas y modales respondan de forma uniforme al estado de tema (`ThemeService`), y actualiza `ARQUITECTURA_APLICACION.md`.

#### Contexto de Entrada (Archivos que el Agente DEBE leer primero)
* `STYLE_APP.txt`
* `src/styles.css`
* `ARQUITECTURA_APLICACION.md`
* Hojas de estilo `.css` dentro de `src/app/**/*.css`

#### Alcance Permitido (Whitelist)
* `src/styles.css`
* Archivos `.css` dentro de `src/app/**/*.css`
* `ARQUITECTURA_APLICACION.md`

#### Archivos y Acciones Prohibidas (Blacklist)
* **PROHIBIDO** tocar archivos `.ts` o `.html`.
* **PROHIBIDO** cambiar las dimensiones estructurales (`width`, `max-width`, `grid-template-columns`, `padding`, `margin`, `border-radius`) que definen el layout actual de la aplicación.
* **PROHIBIDO** cambiar los colores corporativos/base definidos en `STYLE_APP.txt`.

#### Especificación Paso a Paso
1. Lee `STYLE_APP.txt` y `src/styles.css` para verificar las variables CSS globales (`:root` y el selector de tema oscuro).
2. En los archivos `.css` de los componentes (`tabla-compras-credito`, `detalle-compras-credito`, `pagos-mes-tarjetas`, `pagos-mes-tarjetas-detalle`, `responsable-credito`, `balance-mes`, `pago-persona-mes`, `pago-persona-mes-detalle`, `tabla-prestamos`, `formulario-*`, `modal`, `menu`):
   * Elimina bloques de código CSS comentado y selectores vacíos.
   * Si algún input de búsqueda, `<select>` de filtro o fila de tabla tiene colores estáticos (hardcoded como `#ffffff` o `#000000`) que impiden que se vea bien cuando `ThemeService` activa el modo oscuro, vincúlalo a la variable CSS global correspondiente de `src/styles.css` con fallback al color original (ej. `var(--bg-surface, #ffffff)`).
3. Actualiza `ARQUITECTURA_APLICACION.md` para documentar:
   * La estructura de directorios unificada (`src/app/core/`, `src/app/services/`, `src/app/shared/`).
   * El funcionamiento de `ThemeService` (preferencia en `localStorage` + detección automática de Desktop OS `prefers-color-scheme`).
   * El flujo unificado de filtrado y búsqueda (`src/app/shared/utils.ts` y `table-filter.helper.ts`).
   * La optimización $O(1)$ en `SharedListasService` y pipes.

#### Definición de Hecho (DoD) y Verificación
* Los estilos compilan dentro de los presupuestos (budgets) de `angular.json`.
* Ejecutar: `npx ng build --configuration production` $\rightarrow$ `0` errores y `0` advertencias de budget excedido.

---

## 6. PROTOCOLO DE EJECUCIÓN PARA EL ORQUESTADOR HUMANO O SCRIPT

Para asegurar que ningún agente pequeño introduzca regresiones, aplica este flujo en cada una de las 9 fases:

```bash
# 1. Antes de iniciar un Agente, asegurar que el árbol de git está limpio:
git status

# 2. Pasar al Agente ÚNICAMENTE:
#    - El bloque de la Sección 2 (REGLAS GLOBALES INQUEBRANTABLES)
#    - El bloque de su Misión específica (ej. AGENTE 03)

# 3. Al terminar el Agente, verificar qué archivos tocó (Auditoría de Sandbox):
git status -s

# 4. Ejecutar compilación de validación:
npx ng build --configuration development

# 5. Si todo es correcto, crear punto de control antes del siguiente Agente:
git add .
git commit -m "refactor(fase-X): completada mision del agente 0X"
```

---

## 7. MATRIZ RESUMEN DE IMPACTO Y GARANTÍA DE CONSERVACIÓN

| Aspecto de la Aplicación | Estado Antes | Estado Después del Plan | ¿Cambia Lógica de Negocio? |
| :--- | :--- | :--- | :---: |
| **Archivos Residuales y Entornos** | `.html.bak` presente y `enviroment.dev.ts` con typo | Repositorio limpio y entornos alineados con `angular.json` | **NO** |
| **Estructura de Servicios e Interceptores** | Divididos en `/services` vs `/servicios` e `/interceptor` vs `/core/interceptors` | Consolidados en `src/app/services/` y `src/app/core/interceptors/` | **NO** |
| **Modo Oscuro / Claro (Dark Mode)** | Estado disperso o manual | Gobernado 100% por `ThemeService`: lee `localStorage` o extrae automáticamente del Desktop OS en tiempo real | **NO** |
| **Filtros, Búsqueda y Tablas** | Lógica repetida en cada componente | Motor unificado en `src/app/shared/utils.ts` y `table-filter.helper.ts` (insensible a tildes/mayúsculas) | **NO** |
| **Rendimiento de Tablas (Pipes)** | Búsqueda lineal $O(n)$ por celda renderizada | Búsqueda indexada con `Map` en complejidad $O(1)$ | **NO** |
| **Suscripciones y Memoria** | Suscripciones abiertas y `console.log` dispersos | Limpieza determinista en `ngOnDestroy` y código depurado | **NO** |