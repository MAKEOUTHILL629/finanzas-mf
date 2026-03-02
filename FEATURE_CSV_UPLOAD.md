# Funcionalidad de Carga Masiva de Compras por CSV

## Descripción
Sistema de carga masiva de compras a crédito mediante archivos CSV, con interfaz visual para editar datos antes del envío y visualización de resultados.

## Componentes Creados

### 1. FormularioCsvComprasComponent
**Ubicación:** `src/app/compras-credito/formulario-csv-compras/`

**Archivos:**
- `formulario-csv-compras.component.ts` - Lógica del componente
- `formulario-csv-compras.component.html` - Template HTML
- `formulario-csv-compras.component.css` - Estilos Liquid Trust
- `formulario-csv-compras.component.spec.ts` - Tests unitarios

**Funcionalidades:**
- Carga de archivos CSV mediante drag & drop o selección
- Parser inteligente que detecta delimitadores (`,` o `;`)
- Soporte para múltiples formatos de CSV:
  - Internacional (comas)
  - Europeo (punto y coma)
  - Mixto con diferentes formatos de fecha
- Tabla editable con doble clic en celdas
- Validación de datos antes del envío
- Envío al endpoint `/api/compras-credito/upload-csv`
- Procesamiento de respuesta CSV con resultados
- Visualización de estadísticas (éxitos/errores)
- Descarga de archivo de resultados
- Notificación automática a tabla principal

## Formato CSV Soportado

### Cabeceras (case-insensitive)
```
Fecha Compra,Concepto,Valor,Cuotas,Tarjeta,Interes,Descripcion,Estado
```

### Formatos de Fecha Soportados
- `DD/MM/YYYY` (15/01/2025)
- `DD-MM-YYYY` (15-01-2025)
- `YYYY-MM-DD` (2025-01-15)
- `DD,MM,YYYY` (15,01,2025)

### Delimitadores Soportados
- Coma (`,`)
- Punto y coma (`;`)

### Ejemplo de CSV Válido
```csv
Fecha Compra,Concepto,Valor,Cuotas,Tarjeta,Interes,Descripcion,Estado
2024-01-15,Computador portátil,1500000,12,1,2.5,Compra de equipo de trabajo,Pendiente
2024-02-20,Celular Samsung,800000,6,Visa,3.0,Teléfono móvil,
,Televisor LG,2000000,18,2,2.8,TV 55 pulgadas,Pendiente
```

## Respuesta del Endpoint

El endpoint devuelve un CSV con columna adicional "Resultado":

```csv
Fecha Compra,Concepto,Valor,Cuotas,Tarjeta,Interes,Descripcion,Estado,Resultado
2024-01-15,Computador portátil,1500000,12,1,2.5,Compra de equipo de trabajo,Pendiente,Éxito: Compra creada con ID 123
2024-02-20,Celular Samsung,800000,6,Visa,3.0,Teléfono móvil,,Éxito: Compra creada con ID 124
,Televisor LG,2000000,18,999,2.8,TV 55 pulgadas,Pendiente,Error: Tarjeta '999' no encontrada
```

## Integración

### 1. Servicio API (api-services.service.ts)
Se agregó el método `postFile`:
```typescript
postFile(endpoint: string, formData: FormData): Observable<Blob> {
  return this.http.post(`${this.apiUrl}/${endpoint}`, formData, {
    responseType: 'blob'
  });
}
```

### 2. Modal Service (modal.service.ts)
Ya soportaba múltiples modales por ID. Se utiliza `csv-upload-form`.

### 3. Modal Component (modal.component.ts)
Actualizado para soportar `@Input() modalId`:
```typescript
@Input() modalId: string = 'compra-credito-form';
```

### 4. Tabla Component (tabla-compras-credito)
- Nuevo método `openCSVUploadForm()` para abrir modal
- Nuevo FAB button con clase `fab-gold`
- Segundo modal con ID `csv-upload-form`

### 5. App Module (app.module.ts)
Declarado `FormularioCsvComprasComponent` en el módulo.

## Diseño Liquid Trust

### Características Implementadas
✅ Glass morphism con `backdrop-filter: blur(25px) saturate(180%)`
✅ Grid de 8 puntos para espaciado
✅ Border radius según STYLE_APP.txt
✅ Transiciones cubic-bezier(0.4, 0, 0.2, 1)
✅ Tipografía financiera con tabular-nums
✅ Colores semánticos (verde=éxito, rojo=error, azul=info, dorado=premium)
✅ Sticky header con blur en tabla
✅ Scrollbar personalizado
✅ Responsive design (mobile/desktop)
✅ Animaciones suaves
✅ FAB button dorado para función premium

### Elementos de Diseño

#### Zona de Carga
- Drag & drop con borde dashed animado
- Gradiente sutil de fondo
- Ícono de nube animado al hover
- Feedback visual al cargar archivo

#### Tabla de Datos
- Header sticky con blur
- Filas con hover effect
- Celdas editables con doble clic
- Badges de estado con gradientes
- Resultado con iconos y colores semánticos

#### Badges de Estadísticas
- Total: Azul (`brand-blue`)
- Éxito: Verde (`green-success`)
- Error: Rojo (`red-danger`)
- Con iconos Material Icons

#### Botones
- Primario: Azul con sombra glow
- Secundario: Transparente con borde
- Success: Verde para descarga
- FAB Gold: Dorado metalizado

## Flujo de Usuario

1. **Apertura del Modal**
   - Usuario hace clic en FAB dorado "Carga Masiva CSV"
   - Modal se abre con animación slideUp

2. **Carga del Archivo**
   - Usuario arrastra CSV o hace clic para seleccionar
   - Sistema detecta delimitador automáticamente
   - Parser procesa líneas y crea registros

3. **Visualización de Datos**
   - Tabla muestra todos los registros parseados
   - Usuario puede hacer doble clic en celdas para editar
   - Puede eliminar registros con botón de acción
   - Estadística muestra total de registros

4. **Envío al Servidor**
   - Usuario hace clic en "Procesar N Compras"
   - FormData se envía al endpoint
   - Spinner indica procesamiento

5. **Resultados**
   - CSV de respuesta se parsea automáticamente
   - Tabla se actualiza con columna "Resultado"
   - Filas se colorean (verde=éxito, rojo=error)
   - Estadísticas muestran éxitos y errores
   - Tabla principal se refresca automáticamente

6. **Descarga**
   - Usuario puede descargar CSV con resultados
   - Archivo incluye todas las columnas + Resultado

## Testing

### Casos de Prueba
- [ ] Carga de archivo CSV válido
- [ ] Detección de delimitador (coma vs punto y coma)
- [ ] Parsing de diferentes formatos de fecha
- [ ] Edición de celdas con doble clic
- [ ] Eliminación de registros
- [ ] Envío al endpoint
- [ ] Procesamiento de respuesta exitosa
- [ ] Manejo de errores en respuesta
- [ ] Descarga de archivo de resultados
- [ ] Notificación a tabla principal
- [ ] Responsive en móvil

## Mejoras Futuras

1. **Validación en Tiempo Real**
   - Validar formato de fecha mientras se edita
   - Validar que tarjeta existe
   - Validar rangos numéricos

2. **Arrastrar y Soltar Mejorado**
   - Zona de drop más grande
   - Feedback visual durante drag

3. **Plantilla de CSV**
   - Botón para descargar CSV de ejemplo
   - Incluir instrucciones en el archivo

4. **Filtros en Resultados**
   - Filtrar solo errores
   - Filtrar solo éxitos

5. **Historial de Cargas**
   - Guardar historial de cargas
   - Ver estadísticas agregadas

6. **Validación de Duplicados**
   - Detectar compras duplicadas antes de enviar
   - Mostrar advertencia

## Notas Técnicas

- Parser CSV robusto que maneja comillas y caracteres especiales
- Detección automática de delimitadores por frecuencia
- Manejo de campos vacíos con valores por defecto
- Memoria eficiente con Subject pattern y takeUntil
- TypeScript estricto con interfaces tipadas
- Responsive con breakpoints de STYLE_APP.txt
- Accesibilidad con aria-labels y roles ARIA
