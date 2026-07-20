import type { ReactNode } from 'react';

import { Box } from 'vinta-schedule-design-system/layout';

export interface DocsContainerProps {
  children: ReactNode;
  /**
   * Content measure. Defaults to 840px — comfortable for docs prose and the
   * reference cards. Pages that need room (e.g. the GraphiQL explorer) pass a
   * larger value; the column padding still keeps it from reaching the edge.
   */
  maxWidth?: number | string;
}

/**
 * Centers docs page content at a readable width inside the full-width content
 * column. The docs layout no longer caps width itself, so each page picks its
 * own measure through this wrapper — most use the default, the explorer goes
 * wide.
 */
export function DocsContainer({
  children,
  maxWidth = 840,
}: DocsContainerProps) {
  return (
    <Box mx='auto' width='full' maxWidth={maxWidth}>
      {children}
    </Box>
  );
}
