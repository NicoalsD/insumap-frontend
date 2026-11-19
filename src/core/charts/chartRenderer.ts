import { ChartRenderer } from './ChartRenderStrategy';
import { GlucoseRulerStrategy } from './GlucoseRulerStrategy';
import { TimeInRangesBandStrategy } from './TimeInRangesBandStrategy';

/** App-wide renderer with the built-in strategies registered. */
export const chartRenderer = new ChartRenderer()
  .register(new TimeInRangesBandStrategy())
  .register(new GlucoseRulerStrategy());
