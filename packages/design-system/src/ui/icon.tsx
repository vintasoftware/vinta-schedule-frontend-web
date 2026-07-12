import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/utils';
import { color, type ColorToken } from '../layout/layout-style';
import { ICONS, type IconName } from './icon-registry';

/**
 * Icon size scale. Mirrors the sizes the app actually hand-writes with Tailwind
 * (`size-3`, `size-4`, `size-5`, `size-6`, `size-8`) — `sm` (16px, i.e. `size-4`)
 * is by far the most common and is the default.
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const ICON_PX: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export interface IconProps extends Omit<
  React.SVGAttributes<SVGSVGElement>,
  'color'
> {
  /**
   * The lucide icon component, e.g. `icon={Calendar}`. The ergonomic form in
   * code, and it wins over `name` when both are given.
   *
   * NOT serializable, so it can never be a composer control — a visual editor
   * must use `name` instead.
   */
  icon?: LucideIcon;
  /**
   * Registry key, e.g. `name='calendar-plus'` (see ./icon-registry). A string,
   * so a designer can actually pick an icon in the composer. Ignored when `icon`
   * is supplied.
   */
  name?: IconName;
  /** Token size. Defaults to `sm` (16px). */
  size?: IconSize;
  /** Design-token color (resolves to `var(--<token>)`); inherits when omitted. */
  color?: ColorToken;
  /** Spin the glyph (loading affordance). */
  spin?: boolean;
  /**
   * Accessible name. When set the icon is exposed as `role="img"`; when omitted
   * the icon is decorative and hidden from assistive tech (`aria-hidden`).
   */
  label?: string;
}

/**
 * Icon — the single way to render a lucide glyph. Replaces hand-written
 * `size-4 / h-4 w-4 / shrink-0 / animate-spin` utility classes: sizing, color
 * and the spin affordance all come from tokens.
 *
 * The lucide stroke is `currentColor`, so `color` is applied as the inline text
 * color and cascades into the glyph. `shrink-0` is always on — an icon must
 * never be squashed by a flex sibling, which is why the app repeats it.
 */
const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
  {
    icon,
    name,
    size = 'sm',
    color: tone,
    spin,
    label,
    className,
    style,
    ...props
  },
  ref
) {
  // `icon` (code) wins; `name` (composer) is the serializable fallback.
  const Glyph = icon ?? (name ? ICONS[name] : undefined);

  // An unknown/absent name must not crash a composer-authored page — a missing
  // glyph should be a hole in the layout, not a white screen.
  if (!Glyph) return null;

  // Named a11y props are spread BEFORE `...props` so a caller (e.g. Spinner,
  // which needs role="status") can still override them.
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);

  return (
    <Glyph
      ref={ref}
      size={ICON_PX[size]}
      className={cn('shrink-0', spin && 'animate-spin', className)}
      style={{ color: color(tone), ...style }}
      {...a11y}
      {...props}
    />
  );
});

export { Icon, ICON_PX };
