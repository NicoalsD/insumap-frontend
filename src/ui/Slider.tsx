import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  createSpring,
  prefersReducedMotion,
  rubberBand,
  SPRING_BOUNCY,
  SPRING_CRISP,
  type Spring,
} from './motion/spring';
import './Slider.css';

export interface SliderMark {
  readonly value: number;
  readonly label: string;
}

export interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  /** Every change, while dragging too: the screen follows at once (Doherty threshold). */
  readonly onChange: (value: number) => void;
  /** Read by screen readers and shown in the bubble, with its unit ("14 días", "Frente"). */
  readonly valueText: (value: number) => string;
  /** Labelled stops under the track; a click travels there. */
  readonly marks?: readonly SliderMark[];
  /** `lg` is the patient's size: a 48 px target and a bigger thumb (Fitts's law). */
  readonly size?: 'md' | 'lg';
  /** CSS background of the track (for example the glucose bands). Default: cobalt up to the thumb. */
  readonly track?: string | undefined;
  /** A value that must stand out (Von Restorff), drawn in sun on its mark. */
  readonly highlight?: number | undefined;
  /** Where the fill starts: `min` by default; the centre value for a two-sided slider (a turn). */
  readonly origin?: number | undefined;
  readonly hideLabel?: boolean;
  readonly showValue?: boolean;
  readonly disabled?: boolean;
  readonly describedBy?: string | undefined;
  readonly className?: string | undefined;
}

const PAGE_FRACTION = 0.1;
const STRETCH_PER_SPEED = 0.09;
const MAX_STRETCH = 0.32;
const TILT_PER_SPEED = 7;
const MAX_TILT_DEG = 14;
const IDLE_MS = 90;
const MS_PER_SECOND = 1000;
/** Precision of the CSS variables the springs write. */
const CSS_DECIMALS = 4;
const HALF = 0.5;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * A slider in place of a row of options (Hick's law: one control, one gesture). It is a real
 * `role="slider"`: arrows, Page Up and Down, Home and End move it, and screen readers hear the value
 * with its unit.
 *
 * The motion follows the product's motion rules:
 * - The thumb travels from where it is to where you clicked (origin awareness), with a small
 *   follow-through.
 * - It squashes along its travel and keeps its volume (squash and stretch, solid drawing).
 * - It resists past the ends (rubber banding).
 * - The value bubble trails it, tilting with the speed (secondary action, arcs).
 *
 * Every motion is a spring, so a new input bends it instead of restarting it. With reduced motion
 * everything lands at once.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueText,
  marks,
  size = 'md',
  track,
  highlight,
  origin,
  hideLabel = false,
  showValue = false,
  disabled = false,
  describedBy,
  className,
}: SliderProps) {
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const springs = useRef<{ position: Spring; bubble: Spring; stretch: Spring } | null>(null);
  const drag = useRef<{ lastX: number; lastTime: number; idle: number } | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const span = max - min || 1;
  const fraction = (input: number) => (input - min) / span;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Springs write CSS variables straight to the element: no React render per frame.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const write = (name: string, amount: number) => {
      root.style.setProperty(name, amount.toFixed(CSS_DECIMALS));
    };
    const start = fraction(valueRef.current);
    const stretch = createSpring(0, SPRING_BOUNCY, (amount) => {
      const grow = 1 + clamp(Math.abs(amount), 0, MAX_STRETCH);
      write('--sx', grow);
      write('--sy', 1 / grow);
    });
    const position = createSpring(start, SPRING_BOUNCY, (amount, velocity) => {
      write('--pos', amount);
      if (!drag.current) stretch.to(velocity * STRETCH_PER_SPEED);
      bubble.to(amount);
    });
    const bubble = createSpring(start, SPRING_CRISP, (amount, velocity) => {
      write('--bubble', amount);
      write('--tilt', clamp(-velocity * TILT_PER_SPEED, -MAX_TILT_DEG, MAX_TILT_DEG));
    });
    position.set(start);
    bubble.set(start);
    springs.current = { position, bubble, stretch };
    return () => {
      position.stop();
      bubble.stop();
      stretch.stop();
      springs.current = null;
    };
    // The springs live as long as the element; value changes retarget them below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once per mount, retargeted by the next effect
  }, []);

  // A new value from outside (keys, marks, the parent): travel there from the current position.
  useEffect(() => {
    valueRef.current = value;
    if (drag.current) return;
    springs.current?.position.to(fraction(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fraction` only depends on min and max, listed
  }, [value, min, max]);

  const snap = (raw: number) => {
    const stepped = Math.round((raw - min) / step) * step + min;
    // Fixes 0.1 + 0.2 style drift for decimal steps.
    const decimals = (String(step).split('.')[1] ?? '').length;
    return clamp(Number(stepped.toFixed(decimals)), min, max);
  };

  const emit = (next: number) => {
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChangeRef.current(next);
  };

  /** Pointer x to a fraction of the rail, where 0 and 1 are the thumb's centre at each end. */
  const fractionAt = (clientX: number): { raw: number; usable: number } => {
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!rail) return { raw: 0, usable: 1 };
    const rect = rail.getBoundingClientRect();
    const knob = thumb?.offsetWidth ?? 0;
    const usable = Math.max(1, rect.width - knob);
    return { raw: (clientX - rect.left - knob * HALF) / usable, usable };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    rail.setPointerCapture(event.pointerId);
    thumbRef.current?.focus({ preventScroll: true });
    drag.current = { lastX: event.clientX, lastTime: event.timeStamp, idle: 0 };
    setDragging(true);
    const { raw } = fractionAt(event.clientX);
    const next = snap(min + clamp(raw, 0, 1) * span);
    // A press away from the thumb: the thumb travels there (origin awareness), then follows the finger.
    springs.current?.position.to(clamp(raw, 0, 1));
    emit(next);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const motion = springs.current;
    if (!state || !motion) return;
    const { raw, usable } = fractionAt(event.clientX);
    // Past an end the thumb resists (rubber banding); inside it follows the pointer exactly.
    const over =
      raw < 0
        ? -rubberBand(-raw * usable, usable) / usable
        : raw > 1
          ? 1 + rubberBand((raw - 1) * usable, usable) / usable
          : raw;
    motion.position.set(over);
    motion.bubble.to(over);
    const seconds = Math.max(1, event.timeStamp - state.lastTime) / MS_PER_SECOND;
    const speed = (event.clientX - state.lastX) / usable / seconds;
    state.lastX = event.clientX;
    state.lastTime = event.timeStamp;
    motion.stretch.to(speed * STRETCH_PER_SPEED);
    window.clearTimeout(state.idle);
    state.idle = window.setTimeout(() => {
      motion.stretch.to(0);
    }, IDLE_MS);
    emit(snap(min + clamp(raw, 0, 1) * span));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    window.clearTimeout(state.idle);
    drag.current = null;
    setDragging(false);
    const rail = railRef.current;
    if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    // Release: spring back inside and settle on the step (follow-through).
    springs.current?.stretch.to(0);
    springs.current?.position.to(fraction(valueRef.current));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const page = Math.max(step, snap(min + span * PAGE_FRACTION) - min);
    const moves: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + page,
      PageDown: value - page,
      Home: min,
      End: max,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    emit(snap(next));
  };

  const pct = (input: number) => clamp(fraction(input), 0, 1);
  const style = { '--track': track, '--origin': pct(origin ?? min) } as CSSProperties;
  const text = valueText(value);
  return (
    <div
      ref={rootRef}
      className={['ui-slider', className].filter(Boolean).join(' ')}
      data-size={size}
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      data-custom-track={track ? '' : undefined}
      data-reduced={prefersReducedMotion() || undefined}
      style={style}
    >
      <div className="ui-slider__head">
        <span id={labelId} className={hideLabel ? 'visually-hidden' : 'ui-slider__label'}>
          {label}
        </span>
        {showValue ? (
          <span className="ui-slider__value" aria-hidden="true">
            {text}
          </span>
        ) : null}
      </div>
      <div
        ref={railRef}
        className="ui-slider__rail"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="ui-slider__track" aria-hidden="true">
          <div className="ui-slider__fill" />
        </div>
        <div
          ref={thumbRef}
          className="ui-slider__thumb"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={text}
          aria-orientation="horizontal"
          aria-disabled={disabled || undefined}
          aria-describedby={describedBy}
          onKeyDown={onKeyDown}
        >
          <span className="ui-slider__knob" />
        </div>
        <span className="ui-slider__bubble" aria-hidden="true">
          {text}
        </span>
      </div>
      {marks && marks.length > 0 ? (
        <div className="ui-slider__marks" aria-hidden="true">
          {marks.map((mark) => (
            <button
              key={mark.value}
              type="button"
              tabIndex={-1}
              className="ui-slider__mark"
              data-active={mark.value === value || undefined}
              data-highlight={mark.value === highlight || undefined}
              style={{ '--at': pct(mark.value) } as CSSProperties}
              disabled={disabled}
              onClick={() => {
                emit(mark.value);
              }}
            >
              {mark.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface ChoiceSliderOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
  /** Spoken value when it differs from the label (for example with a unit). */
  readonly text?: string;
}

export interface ChoiceSliderProps<T extends string | number> extends Omit<
  SliderProps,
  'value' | 'min' | 'max' | 'step' | 'onChange' | 'valueText' | 'marks' | 'highlight'
> {
  readonly options: readonly ChoiceSliderOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly highlight?: T | undefined;
  readonly origin?: undefined;
}

/** A slider over a short ordered list (time windows, spots): each stop is a labelled mark. */
export function ChoiceSlider<T extends string | number>({
  options,
  value,
  onChange,
  highlight,
  ...rest
}: ChoiceSliderProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const highlightIndex =
    highlight === undefined ? undefined : options.findIndex((option) => option.value === highlight);
  return (
    <Slider
      {...rest}
      value={index}
      min={0}
      max={Math.max(1, options.length - 1)}
      step={1}
      highlight={highlightIndex}
      marks={options.map((option, position) => ({ value: position, label: option.label }))}
      valueText={(position) => {
        const option = options[position];
        return option ? (option.text ?? option.label) : '';
      }}
      onChange={(position) => {
        const option = options[position];
        if (option) onChange(option.value);
      }}
    />
  );
}
