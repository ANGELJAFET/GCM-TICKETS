/**
 * Registro único (side-effect de importar este módulo) de los componentes de
 * Chart.js usados por los gráficos del panel admin (doughnut, bar y pie
 * comparten Arc/Bar/escalas). Debe importarse una vez antes de renderizar
 * cualquier gráfico (ver `ChartsSection.tsx`).
 */
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
