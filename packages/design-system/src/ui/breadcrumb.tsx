import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '../lib/utils';

/** Glyph rendered between crumbs by a childless `BreadcrumbSeparator`. */
export type BreadcrumbSeparatorVariant = 'chevron' | 'slash' | 'dot';

const SeparatorContext =
  React.createContext<BreadcrumbSeparatorVariant>('chevron');

const SEPARATOR_GLYPH: Record<BreadcrumbSeparatorVariant, React.ReactNode> = {
  chevron: <ChevronRight />,
  slash: <span>/</span>,
  dot: <span>·</span>,
};

export interface BreadcrumbProps extends React.ComponentPropsWithoutRef<'nav'> {
  /**
   * Separator glyph used by every `BreadcrumbSeparator` in the trail that does
   * not pass its own children. Defaults to a chevron.
   */
  separator?: BreadcrumbSeparatorVariant;
}

const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ separator = 'chevron', ...props }, ref) => (
    <SeparatorContext.Provider value={separator}>
      <nav ref={ref} aria-label='breadcrumb' {...props} />
    </SeparatorContext.Provider>
  )
);
Breadcrumb.displayName = 'Breadcrumb';

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<'ol'>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
      className
    )}
    {...props}
  />
));
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('inline-flex items-center gap-1.5', className)}
    {...props}
  />
));
BreadcrumbItem.displayName = 'BreadcrumbItem';

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      ref={ref}
      className={cn('hover:text-foreground transition-colors', className)}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role='link'
    aria-disabled='true'
    aria-current='page'
    className={cn('text-foreground font-normal', className)}
    {...props}
  />
));
BreadcrumbPage.displayName = 'BreadcrumbPage';

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) => {
  const variant = React.useContext(SeparatorContext);

  return (
    <li
      role='presentation'
      aria-hidden='true'
      className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)}
      {...props}
    >
      {children ?? SEPARATOR_GLYPH[variant]}
    </li>
  );
};
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    role='presentation'
    aria-hidden='true'
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className='h-4 w-4' />
    <span className='sr-only'>More</span>
  </span>
);
BreadcrumbEllipsis.displayName = 'BreadcrumbElipssis';

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
