import * as React from 'react';
import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils/index';
import {
  splitBoxProps,
  resolveSpace,
  type BoxStyleProps,
  type Space,
} from './layout-style';

type Align = 'start' | 'center' | 'end' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'stretch';

const ALIGN: Record<Align, CSSProperties['alignItems']> = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'stretch',
};

export interface GridProps
  extends BoxStyleProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  as?: React.ElementType;
  /** Number of equal columns, or a raw grid-template-columns string. */
  columns?: number | string;
  rows?: number | string;
  gap?: Space;
  rowGap?: Space;
  columnGap?: Space;
  align?: Align;
  justify?: Justify;
  inline?: boolean;
}

function template(value: number | string | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return `repeat(${value}, minmax(0, 1fr))`;
  return value;
}

/**
 * Grid — CSS grid container. Defaults to the design system's 12-column grid;
 * pass `columns` for any count (or a template string). Compose with <GridItem>.
 *
 *   <Grid columns={3} gap={4}>…</Grid>
 */
const Grid = React.forwardRef<HTMLElement, GridProps>(function Grid(
  {
    as: Comp = 'div',
    className,
    style,
    columns = 12,
    rows,
    gap = 6,
    rowGap,
    columnGap,
    align,
    justify,
    inline,
    ...boxProps
  },
  ref
) {
  const { style: resolved, rest } = splitBoxProps(boxProps);
  const gridStyle: CSSProperties = {
    display: inline ? 'inline-grid' : 'grid',
    gridTemplateColumns: template(columns),
    gridTemplateRows: template(rows),
    alignItems: align ? ALIGN[align] : undefined,
    justifyItems: justify ? ALIGN[justify] : undefined,
  };
  // Never emit the `gap` shorthand together with `undefined` `rowGap`/`columnGap`
  // longhands — React drops the shorthand on rerender, zeroing the gap.
  if (gap != null) gridStyle.gap = resolveSpace(gap);
  if (rowGap != null) gridStyle.rowGap = resolveSpace(rowGap);
  if (columnGap != null) gridStyle.columnGap = resolveSpace(columnGap);
  return (
    <Comp
      ref={ref}
      className={cn(className)}
      style={{ ...resolved, ...gridStyle, ...style }}
      {...rest}
    />
  );
});

export interface GridItemProps
  extends BoxStyleProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  as?: React.ElementType;
  /** Columns to span. */
  span?: number;
  /** Rows to span. */
  rowSpan?: number;
  colStart?: number;
  colEnd?: number;
}

const GridItem = React.forwardRef<HTMLElement, GridItemProps>(function GridItem(
  {
    as: Comp = 'div',
    className,
    style,
    span,
    rowSpan,
    colStart,
    colEnd,
    ...boxProps
  },
  ref
) {
  const { style: resolved, rest } = splitBoxProps(boxProps);
  const itemStyle: CSSProperties = {
    gridColumn:
      colStart != null || colEnd != null
        ? `${colStart ?? 'auto'} / ${colEnd ?? (span != null ? `span ${span}` : 'auto')}`
        : span != null
          ? `span ${span} / span ${span}`
          : undefined,
    gridRow: rowSpan != null ? `span ${rowSpan} / span ${rowSpan}` : undefined,
  };
  return (
    <Comp
      ref={ref}
      className={cn(className)}
      style={{ ...resolved, ...itemStyle, ...style }}
      {...rest}
    />
  );
});

export { Grid, GridItem };
