import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef } from 'react';
import { cn } from './cn';

const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'bg-cobalt/10 text-cobalt-deep',
        simulated: 'bg-sun-100 text-sun-900 ring-1 ring-sun-600/40',
        pending: 'bg-lilac-100 text-ink',
        outline: 'text-ink ring-1 ring-ink/20',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends ComponentPropsWithRef<'span'>, VariantProps<typeof badgeVariants> {}

/** shadcn/ui Badge. */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
