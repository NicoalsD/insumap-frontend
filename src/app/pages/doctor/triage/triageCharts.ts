import { ChartRenderer } from '@/core/charts/ChartRenderStrategy';
import { AgpBandStrategy } from './agp/AgpBandStrategy';

/** Chart strategies owned by the triage screens. The shared renderer in `core` stays untouched. */
export const triageCharts = new ChartRenderer().register(new AgpBandStrategy());
