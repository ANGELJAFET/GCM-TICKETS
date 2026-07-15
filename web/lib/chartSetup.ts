import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

// Registro único de los componentes de Chart.js usados por los gráficos del
// panel admin (doughnut, bar, pie comparten Arc/Bar/escalas).
Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
