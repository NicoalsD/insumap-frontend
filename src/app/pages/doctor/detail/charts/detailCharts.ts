import { ChartRenderer } from '@/core/charts/ChartRenderStrategy';
import { PatientAgpStrategy } from './PatientAgpStrategy';

/**
 * Chart strategies of the patient detail. The shared renderer in `core` stays untouched; the
 * detail screen registers its own strategies here, so a new chart is one more `register`.
 *
 * Pattern: P19 Strategy
 */
export const detailCharts = new ChartRenderer().register(new PatientAgpStrategy());
