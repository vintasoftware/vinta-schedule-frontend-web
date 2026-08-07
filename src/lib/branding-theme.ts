/**
 * Turns resolved tenant branding into the CSS custom properties that repaint
 * the design system's primary surfaces.
 *
 * The tokens live in `vinta-schedule-design-system/styles/tokens.css`, which
 * declares them on `:root` (and again on `.dark`). Custom properties inherit,
 * so redeclaring them on any ancestor of the page content wins for that
 * subtree without touching the rest of the app — see `BrandingTheme`.
 *
 * Both spellings of each token are set on purpose. Layout primitives resolve
 * token props to `var(--primary)` (see `layout-style.ts`'s `color()`), while
 * Tailwind utilities like `bg-primary` resolve through the `@theme inline`
 * mapping. Writing both covers either consumer.
 *
 * Color mapping mirrors the admin-side `BrandingPreview`, which is what the
 * org admin sees while picking the values:
 *   primaryColor   → the brand surface  (`--primary`, plus the focus `--ring`)
 *   secondaryColor → text/icons on that surface (`--primary-foreground`)
 */
import type { CSSProperties } from 'react';

import type { TenantBranding } from '@/lib/branding-shared';

/**
 * The backend validates stored colors as #RRGGBB / #RRGGBBAA, but these values
 * arrive over an unauthenticated public GraphQL query and get interpolated
 * into a style attribute. Re-check the shape here so anything unexpected falls
 * back to the vinta token instead of emitting a broken declaration.
 */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function hexColor(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && HEX_COLOR_PATTERN.test(trimmed) ? trimmed : undefined;
}

/**
 * Build the style object for a branded subtree, or `undefined` when the tenant
 * configured no usable color (the common case — colors are optional, and an
 * unresolved tenant carries empty strings).
 *
 * Each color is applied independently: an org that set only a primary color
 * keeps the token foreground, which stays legible on most brand surfaces.
 */
export function brandingThemeStyle(
  branding: TenantBranding | undefined
): CSSProperties | undefined {
  const surface = hexColor(branding?.primaryColor);
  const onSurface = hexColor(branding?.secondaryColor);

  if (!surface && !onSurface) {
    return undefined;
  }

  const style: Record<string, string> = {};

  if (surface) {
    style['--primary'] = surface;
    style['--color-primary'] = surface;
    // Focus rings on branded pages track the brand, not the vinta blue.
    style['--ring'] = surface;
    style['--color-ring'] = surface;
  }

  if (onSurface) {
    style['--primary-foreground'] = onSurface;
    style['--color-primary-foreground'] = onSurface;
  }

  return style as CSSProperties;
}
