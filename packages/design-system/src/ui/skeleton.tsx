import * as React from 'react';

import { cn } from '../lib/utils';
import {
  boxStyle,
  resolveSize,
  type Radius,
  type Size,
} from '../layout/layout-style';

export type SkeletonShape = 'rect' | 'circle' | 'text';

/** Default height for a `text` skeleton — one line of body text. */
const TEXT_LINE_HEIGHT = '1em';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number → px, or any CSS length ('100%', '12rem', '3/4' is NOT supported). */
  width?: Size;
  /** Number → px, or any CSS length. Defaults to one line for `shape='text'`. */
  height?: Size;
  /** Corner radius on the DS token scale. `shape='circle'` forces `full`. */
  radius?: Radius;
  /**
   * `rect` (default) — a plain block.
   * `circle` — full radius + a forced 1:1 aspect ratio (avatars).
   * `text` — defaults to one line of text height.
   */
  shape?: SkeletonShape;
}

/**
 * Skeleton — loading placeholder.
 *
 * With NO props it renders exactly as it always has (bare styled div), so the
 * existing `className`-driven usages are untouched. `width` / `height` /
 * `radius` / `shape` are real, forwarded props: they resolve through the same
 * layout-style token vocabulary as the layout primitives, and an inline style
 * is only emitted for the props actually passed.
 */
function Skeleton({
  className,
  style,
  width,
  height,
  radius,
  shape = 'rect',
  ...props
}: SkeletonProps) {
  const resolvedRadius: Radius | undefined =
    shape === 'circle' ? 'full' : radius;
  const resolvedHeight: Size | undefined =
    height ?? (shape === 'text' ? TEXT_LINE_HEIGHT : undefined);

  const sized: React.CSSProperties = {};
  // Reuse the shared token resolvers rather than duplicating the radius map.
  if (resolvedRadius != null) {
    sized.borderRadius = boxStyle({ radius: resolvedRadius }).borderRadius;
  }
  if (width != null) sized.width = resolveSize(width);
  if (resolvedHeight != null) sized.height = resolveSize(resolvedHeight);
  if (shape === 'circle') sized.aspectRatio = '1 / 1';

  const merged = { ...sized, ...style };

  return (
    <div
      className={cn('bg-primary/10 animate-pulse rounded-md', className)}
      // Stay style-attribute-free when no sizing prop is set, so the default
      // render is byte-for-byte what it was before these props existed.
      style={Object.keys(merged).length > 0 ? merged : undefined}
      {...props}
    />
  );
}

export { Skeleton };
