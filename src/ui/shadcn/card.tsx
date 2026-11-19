import type { ComponentPropsWithRef } from 'react';
import { cn } from './cn';

/** shadcn/ui Card. */
export function Card({ className, ...props }: ComponentPropsWithRef<'article'>) {
  return (
    <article
      data-slot="card"
      className={cn(
        'flex flex-col gap-2 rounded-[1.5rem] bg-white p-6 text-ink shadow-[0_18px_40px_-24px_rgb(20_22_58/0.35)]',
        className,
      )}
      {...props}
    />
  );
}

/** shadcn/ui CardTitle. `as` keeps the document outline right where the card sits. */
export function CardTitle({ className, as: Heading = 'h3', ...props }: ComponentPropsWithRef<'h3'> & { as?: 'h2' | 'h3' }) {
  return <Heading data-slot="card-title" className={cn('font-display text-xl font-semibold', className)} {...props} />;
}

/** shadcn/ui CardDescription. */
export function CardDescription({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return <p data-slot="card-description" className={cn('text-[1.0625rem] leading-normal text-ink-soft', className)} {...props} />;
}
