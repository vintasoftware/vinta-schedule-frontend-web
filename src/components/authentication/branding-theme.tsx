import type { ReactNode } from 'react';

import type { TenantBranding } from '@/lib/branding-shared';
import { brandingThemeStyle } from '@/lib/branding-theme';

export interface BrandingThemeProps {
  /** Resolved tenant branding. Colors are optional and often empty. */
  branding?: TenantBranding;
  children: ReactNode;
}

/**
 * Repaints the design system's primary tokens with the tenant's colors for
 * everything it wraps.
 *
 * Wrap the whole page shell (navbar included), not just the form — the brand
 * color shows up on buttons, links and focus rings throughout.
 *
 * `display: contents` keeps the wrapper out of the layout entirely: the box
 * generates no frame of its own, so the shell's flex/height rules behave
 * exactly as they do without it, while custom properties still inherit into
 * the subtree.
 *
 * A tenant with no usable colors renders its children untouched — no extra
 * element, no style attribute, byte-for-byte today's markup.
 */
export function BrandingTheme({ branding, children }: BrandingThemeProps) {
  const style = brandingThemeStyle(branding);

  if (!style) {
    return <>{children}</>;
  }

  return (
    <div data-branding-theme style={{ display: 'contents', ...style }}>
      {children}
    </div>
  );
}
