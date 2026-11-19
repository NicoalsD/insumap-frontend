import { useEffect, useRef } from 'react';
import { format } from '@/i18n/format';
import { createSpring, SPRING_CRISP } from './spring';

/**
 * A count that rolls to its new value with a critically damped spring: it eases in and out and
 * never overshoots, so it never shows a number that is not the real one on the way. Screen readers
 * get the final value at once; the rolling digits are decoration. Counts only: clinical values
 * (glucose, doses) are never animated.
 */
export function AnimatedNumber({
  value,
  className,
}: {
  readonly value: number;
  readonly className?: string;
}) {
  const visible = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  useEffect(() => {
    const element = visible.current;
    if (!element) return;
    const spring = createSpring(shown.current, SPRING_CRISP, (current) => {
      shown.current = current;
      element.textContent = format('{value}', { value: Math.round(current) });
    });
    spring.to(value);
    return () => {
      spring.stop();
    };
  }, [value]);

  return (
    <span className={className}>
      <span className="visually-hidden">{format('{value}', { value })}</span>
      <span ref={visible} aria-hidden="true" />
    </span>
  );
}
