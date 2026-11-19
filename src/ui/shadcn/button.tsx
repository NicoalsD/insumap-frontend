import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { cn } from './cn';

/** shadcn/ui button variants, painted with the landing palette (`landing.css` theme). */
const buttonVariants = cva(
  // border-2 border-transparent keeps a visible outline in Windows high contrast (forced colors).
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-transparent font-semibold no-underline transition-[background-color,border-color,color,box-shadow,translate] duration-200 ease-out touch-manipulation select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-cobalt disabled:pointer-events-none disabled:opacity-60 aria-busy:cursor-progress motion-safe:active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-cobalt text-white shadow-[0_10px_24px_-12px_rgb(31_75_255/0.7)] hover:bg-cobalt-deep',
        outline: 'border-ink-soft bg-white text-ink hover:border-ink hover:bg-lilac-50',
        ghost: 'text-ink underline-offset-4 hover:bg-ink/[0.07] hover:underline',
        inverse: 'bg-white text-ink hover:bg-lilac-50',
      },
      size: {
        sm: 'h-11 px-5 text-[0.9375rem]',
        default: 'h-12 px-6 text-base',
        lg: 'h-14 px-7 text-lg',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ComponentPropsWithRef<'button'>, VariantProps<typeof buttonVariants> {
  /** Renders the child element (a link, for example) with the button styles. */
  asChild?: boolean;
}

/** shadcn/ui Button. */
export function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
