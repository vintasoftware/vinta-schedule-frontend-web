import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils/index';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:size-3 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        // Solid
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        // Soft tints — scheduling / status palette
        info: 'border-transparent bg-vinta-50 text-vinta-700',
        success: 'border-transparent bg-green-100 text-success',
        warning: 'border-transparent bg-amber-100 text-warning',
        danger: 'border-transparent bg-red-100 text-destructive',
        teal: 'border-transparent bg-teal-100 text-teal-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Small leading status dot — pair with a soft Badge variant. */
function BadgeDot({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('size-1.5 shrink-0 rounded-full bg-current', className)}
      {...props}
    />
  );
}

export { Badge, BadgeDot, badgeVariants };
