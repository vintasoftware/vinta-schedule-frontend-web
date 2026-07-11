import * as React from 'react';
import { usePrototypeMode } from 'vinta-ui-composer-prototype-mode';

import { cn } from '../lib/utils';

/**
 * Link — the navigating primitive for the composer.
 *
 * The design system has no router of its own. This component reads the
 * platform-owned `vinta-ui-composer-prototype-mode` context (a peer dependency
 * kept EXTERNAL at bundle time and shimmed to the host's copy, exactly like
 * `react`) to decide inert-vs-navigating:
 *
 *   · editor mode (the default when no provider is present) → INERT. The
 *     composer canvas must never navigate when you click a link you're editing.
 *   · viewer mode → calls the host-supplied `navigate(linkTo)`.
 *   · viewer mode, but `canNavigate(linkTo)` is false (archived / unpublished /
 *     missing target) → INERT.
 *
 * Inert renders an `<a>` WITHOUT `href`, which is not a link to the
 * accessibility tree and is not focusable — the correct "looks like a link,
 * does nothing" state, rather than a real link we cancel on click.
 *
 * Deliberately NOT re-exported from `./index` — the schedule app must keep
 * using `next/link` for real routing. This primitive exists for prototypes
 * rendered by the composer, and is reachable via the `./layout/link` subpath
 * (which is also how the platform's synthesized barrel discovers it).
 */
export interface LinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  /** Target screen. The platform resolves this; we never route on our own. */
  linkTo: string;
  children?: React.ReactNode;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { linkTo, children, className, onClick, onMouseEnter, onFocus, ...props },
  ref
) {
  const { mode, navigate, prefetch, canNavigate } = usePrototypeMode();

  const reachable = canNavigate ? canNavigate(linkTo) : true;
  const inert = mode !== 'viewer' || !navigate || !reachable;

  const classes = cn(
    'text-primary underline-offset-4 hover:underline',
    inert && 'cursor-default',
    className
  );

  if (inert) {
    return (
      <a ref={ref} className={classes} data-inert='' {...props}>
        {children}
      </a>
    );
  }

  const warm = () => prefetch?.(linkTo);

  return (
    <a
      ref={ref}
      href={linkTo}
      className={classes}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onClick={(e) => {
        onClick?.(e);
        // Let the browser own modified clicks (new tab/window) and anything a
        // consumer already handled; otherwise hand off to the host's router.
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        navigate(linkTo);
      }}
      {...props}
    >
      {children}
    </a>
  );
});

export { Link };
