import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from './cn';

/** shadcn/ui Tabs (Radix: roving focus, arrow keys, aria wiring). */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-8', className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('inline-flex w-fit flex-wrap gap-1 rounded-[1.75rem] bg-white p-1.5 ring-1 ring-ink-soft/40', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full border-2 border-transparent px-5 text-base font-semibold text-ink-soft transition-colors duration-200 hover:bg-ink/[0.06] hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt data-[state=active]:bg-ink data-[state=active]:text-white [&_svg]:size-4.5',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-cobalt rounded-[2rem]', className)}
      {...props}
    />
  );
}
