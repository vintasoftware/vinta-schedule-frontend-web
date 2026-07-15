import * as React from 'react';

import { cn } from '../lib/utils';
import { resolveSize, type Radius, type Size } from '../layout/layout-style';

/**
 * Image — a styled `<img>`.
 *
 * Deliberately framework-agnostic: the design system must not depend on Next, so
 * this renders a raw `<img>` and never imports `next/image`. An app that wants
 * the Next loader can still drop `<NextImage>` in directly — this is the DS
 * building block for the ordinary case.
 *
 * `alt` is REQUIRED (a11y); pass `alt=""` for decorative images.
 */
export type ImageFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

const RADIUS_CLASS: Record<Radius, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

const FIT_CLASS: Record<ImageFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
  none: 'object-none',
  'scale-down': 'object-scale-down',
};

export interface ImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'width' | 'height' | 'alt'
> {
  src: string;
  /** Required for a11y — use `alt=""` for purely decorative images. */
  alt: string;
  /** Corner radius, on the DS radius token scale. */
  radius?: Radius;
  /** objectFit for the rendered image. */
  fit?: ImageFit;
  /** Number → px; string passes through ('full', '50%', '12rem', …). */
  width?: Size;
  height?: Size;
}

const Image = React.forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
    alt,
    radius = 'none',
    fit = 'cover',
    width,
    height,
    className,
    style,
    ...props
  },
  ref
) {
  return (
    // The design system is framework-agnostic — it must not depend on Next, so
    // it cannot import next/image. Apps that need optimization can compose their
    // own loader around this primitive.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={cn(
        'block max-w-full',
        RADIUS_CLASS[radius],
        FIT_CLASS[fit],
        className
      )}
      style={{
        width: resolveSize(width),
        height: resolveSize(height),
        ...style,
      }}
      {...props}
    />
  );
});
Image.displayName = 'Image';

export { Image };
