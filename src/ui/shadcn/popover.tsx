import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from './cn';

const POPOVER_OFFSET_PX = 8;

/** shadcn/ui Popover (Radix): opens on click, tap and keyboard, closes with Escape. */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ className, sideOffset = POPOVER_OFFSET_PX, children, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-80 rounded-2xl bg-ink px-4 py-3 text-[0.9375rem] leading-snug text-white shadow-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt',
          className,
        )}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow className="fill-ink" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
