import { ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import { provideCharts } from 'ng2-charts';

/**
 * Solo lo que las gráficas de la aplicación usan (dona, barras y línea), en vez de `withDefaultRegisterables()` que trae todo
 * Chart.js. Se provee en las RUTAS que dibujan gráficas, así la librería viaja en el paquete de esas pantallas y no en el inicial.
 */
export const PROVEEDOR_GRAFICAS = provideCharts({
  registerables: [ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip],
});
