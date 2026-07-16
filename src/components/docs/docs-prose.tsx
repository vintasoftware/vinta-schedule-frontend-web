import * as React from 'react';

import { Box, type BoxProps } from 'vinta-schedule-design-system/layout';
import { cn } from '@/lib/utils/index';

/**
 * Descendant styles for injected markdown HTML — extracted from
 * `PolicyDocumentView` so every docs content page (getting-started, concepts,
 * reference, …) shares one prose styling surface instead of re-inlining it.
 */
const PROSE_CLASSNAME =
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:py-1 [&_p]:py-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:py-1';

type BaseProps = Omit<BoxProps, 'dangerouslySetInnerHTML' | 'children'>;

/**
 * Discriminated union: pass either html or children, not both.
 *
 * If html is provided, it must be pre-sanitized (from rehype-sanitize or
 * equivalent). The caller is responsible for sanitization upstream —
 * dangerouslySetInnerHTML here is only safe because the string already went
 * through that pipeline.
 */
export type DocsProseProps = BaseProps &
  (
    | { html: string; children?: never }
    | { html?: never; children?: React.ReactNode }
  );

/**
 * DocsProse — the prose wrapper for docs content, extracted from
 * `PolicyDocumentView` (`src/components/policy/policy-document-view.tsx`).
 *
 * Accepts either pre-sanitized HTML or React children, but not both.
 * The caller is responsible for sanitizing HTML upstream (via rehype-sanitize
 * or equivalent) — dangerouslySetInnerHTML is only safe because the string
 * already passed through that pipeline.
 */
const DocsProse = React.forwardRef<HTMLElement, DocsProseProps>(
  function DocsProse({ html, children, className, ...props }, ref) {
    if (html != null) {
      return (
        <Box
          ref={ref}
          className={cn(PROSE_CLASSNAME, className)}
          dangerouslySetInnerHTML={{ __html: html }}
          {...props}
        />
      );
    }

    return (
      <Box ref={ref} className={cn(PROSE_CLASSNAME, className)} {...props}>
        {children}
      </Box>
    );
  }
);

export { DocsProse };
