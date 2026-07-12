import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

/**
 * TextLink — the ordinary, app-facing anchor.
 *
 * Like <Button>, it supports `asChild` so a routing library can own the element
 * while the DS owns the styling:
 *
 * ```tsx
 * <TextLink asChild><NextLink href="/bookings">View booking</NextLink></TextLink>
 * ```
 *
 * Not to be confused with `layout/link`'s `<Link>`, which is the composer's
 * prototype-mode navigating primitive (it reads usePrototypeMode() and renders
 * inert in the editor). TextLink knows nothing about prototype mode: it is a
 * plain `<a href>` for real applications.
 */
const textLinkVariants = cva(
  'underline-offset-4 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  {
    variants: {
      variant: {
        default: 'text-primary hover:text-primary/80',
        muted: 'text-muted-foreground hover:text-foreground',
        // Inherits the surrounding text color — for links inside a paragraph.
        inherit: 'text-inherit',
        destructive: 'text-destructive hover:text-destructive/80',
      },
      underline: {
        always: 'underline',
        hover: 'no-underline hover:underline',
        none: 'no-underline',
      },
      size: {
        /** Inherit the surrounding font size (the inline-in-prose default). */
        inherit: '',
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      underline: 'hover',
      size: 'inherit',
    },
  }
);

export interface TextLinkProps
  extends
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof textLinkVariants> {
  /** Render the single child instead of an `<a>` (e.g. wrap `next/link`). */
  asChild?: boolean;
  href?: string;
}

const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(
  function TextLink(
    { className, variant, underline, size, asChild = false, ...props },
    ref
  ) {
    const Comp = asChild ? Slot : 'a';
    return (
      <Comp
        className={cn(
          textLinkVariants({ variant, underline, size, className })
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
TextLink.displayName = 'TextLink';

export { TextLink, textLinkVariants };
