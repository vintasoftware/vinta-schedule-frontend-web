import * as React from 'react';

import { cn } from '../lib/utils';
import {
  color,
  resolveSpace,
  type ColorToken,
  type Space,
} from '../layout/layout-style';

/**
 * List / ListItem — the DS answer to raw `<ul>` / `<ol>` / `<li>`.
 *
 * The element follows the variant: 'ordered' renders an `<ol>`, everything else
 * an `<ul>` (override with `as` if you need the other element for semantics).
 * Item spacing uses the shared 4px `Space` scale (`gap={2}` → 8px) rather than a
 * bespoke pixel value, and the marker color takes any design-token color.
 */
export type ListVariant = 'bullet' | 'ordered' | 'plain';

const LIST_STYLE: Record<ListVariant, string> = {
  bullet: 'list-disc ps-5',
  ordered: 'list-decimal ps-5',
  plain: 'list-none ps-0',
};

export interface ListProps extends React.HTMLAttributes<
  HTMLUListElement | HTMLOListElement
> {
  /** 'ordered' → `<ol>`; 'bullet' / 'plain' → `<ul>`. */
  variant?: ListVariant;
  /** Force the element regardless of `variant`. */
  as?: 'ul' | 'ol';
  /** Space between items, on the 4px scale. */
  gap?: Space;
  /** Marker (bullet / number) color — any design-token color name. */
  marker?: ColorToken;
  children?: React.ReactNode;
}

const List = React.forwardRef<HTMLUListElement | HTMLOListElement, ListProps>(
  function List(
    { variant = 'bullet', as, gap = 2, marker, className, style, ...props },
    ref
  ) {
    const Comp = as ?? (variant === 'ordered' ? 'ol' : 'ul');

    return (
      <Comp
        ref={ref as React.Ref<never>}
        className={cn(
          'text-sm',
          LIST_STYLE[variant],
          // Item spacing is a between-items margin, NOT a flex/grid gap: making
          // the list a flex container would drop the ::marker off every item.
          '[&>li+li]:mt-[var(--ds-list-gap)]',
          // The marker color can't be set inline either (::marker is a
          // pseudo-element), so it rides in on a custom property.
          marker && 'marker:text-[color:var(--ds-list-marker)]',
          className
        )}
        style={
          {
            '--ds-list-gap': resolveSpace(gap),
            ...(marker ? { '--ds-list-marker': color(marker) } : null),
            ...style,
          } as React.CSSProperties
        }
        {...props}
      />
    );
  }
);
List.displayName = 'List';

export interface ListItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode;
}

/** ListItem — a thin `<li>`; all styling lives on the parent <List>. */
const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
  function ListItem({ className, ...props }, ref) {
    return (
      <li
        ref={ref}
        className={cn('marker:text-inherit', className)}
        {...props}
      />
    );
  }
);
ListItem.displayName = 'ListItem';

export { List, ListItem };
