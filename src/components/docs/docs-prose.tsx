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

export interface DocsProseProps extends Omit<
  BoxProps,
  'dangerouslySetInnerHTML'
> {
  /**
   * Pre-sanitized HTML to inject (e.g. the output of `renderMarkdownToSafeHtml`
   * or the docs-specific pipeline landing in Phase 1). Takes precedence over
   * `children` when both are supplied — never pass both.
   */
  html?: string;
}

/**
 * DocsProse — the prose wrapper for docs content, extracted from
 * `PolicyDocumentView` (`src/components/policy/policy-document-view.tsx`).
 *
 * Phase 0 has no real markdown content yet, so this only needs to exist and
 * render its `children` correctly. Later phases pass `html` from the docs
 * markdown pipeline — the caller is responsible for sanitizing it first
 * (mirrors the policy view: `dangerouslySetInnerHTML` here is only ever safe
 * because the string already went through `rehype-sanitize` upstream).
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
