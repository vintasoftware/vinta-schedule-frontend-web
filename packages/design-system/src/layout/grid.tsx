import * as React from 'react';
import type { CSSProperties } from 'react';

import { cn } from '../lib/utils';
import {
  splitBoxProps,
  splitResponsiveBoxProps,
  resolveSpace,
  type BoxStyleProps,
  type Space,
} from './layout-style';
import {
  responsiveClasses,
  plainValue,
  isResponsive,
  columnsClass,
  spanClass,
  spaceClass,
  foldSiblings,
  foldContainerSiblings,
  type Responsive,
} from './responsive';

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
  /**
   * Number of equal columns, or a raw grid-template-columns string. Accepts a
   * per-breakpoint object: `columns={{ base: 1, md: 2, lg: 3 }}`.
   */
  columns?: Responsive<number> | string;
  rows?: number | string;
  /** Accepts a per-breakpoint object: `gap={{ base: 4, md: 6 }}`. */
  gap?: Responsive<Space>;
  rowGap?: Space;
  columnGap?: Space;
  align?: Align;
  justify?: Justify;
  inline?: boolean;

  /* Flat per-breakpoint siblings (see ./responsive). */
  columnsSm?: number;
  columnsMd?: number;
  columnsLg?: number;
  columnsXl?: number;
  gapSm?: Space;
  gapMd?: Space;
  gapLg?: Space;
  gapXl?: Space;

  /* Container-query siblings, resolved against `container` (BoxStyleProps). */
  columnsCqMd?: number;
  columnsCqLg?: number;
  columnsCqXl?: number;
  columnsCq2xl?: number;
  columnsCq3xl?: number;
  columnsCq4xl?: number;
  gapCqMd?: Space;
  gapCqLg?: Space;
  gapCqXl?: Space;
  gapCq2xl?: Space;
  gapCq3xl?: Space;
  gapCq4xl?: Space;
}

function template(value: number | string | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return `repeat(${value}, minmax(0, 1fr))`;
  return value;
}

/**
 * Grid — CSS grid container. Defaults to the design system's 12-column grid;
 * pass `columns` for any count (or a template string). Compose with `<GridItem>`.
 *
 * ```tsx
 * <Grid columns={3} gap={4}>…</Grid>
 * ```
 */
const Grid = React.forwardRef<HTMLElement, GridProps>(function Grid(
  {
    as: Comp = 'div',
    className,
    style,
    columns: columnsProp = 12,
    rows,
    gap: gapProp = 6,
    rowGap,
    columnGap,
    align,
    justify,
    inline,
    columnsSm,
    columnsMd,
    columnsLg,
    columnsXl,
    gapSm,
    gapMd,
    gapLg,
    gapXl,
    columnsCqMd,
    columnsCqLg,
    columnsCqXl,
    columnsCq2xl,
    columnsCq3xl,
    columnsCq4xl,
    gapCqMd,
    gapCqLg,
    gapCqXl,
    gapCq2xl,
    gapCq3xl,
    gapCq4xl,
    ...boxProps
  },
  ref
) {
  const container = boxProps.container;
  // Fold the flat per-breakpoint siblings into one Responsive value. A raw
  // grid-template string has no per-breakpoint form, so it passes through.
  let columns =
    typeof columnsProp === 'string'
      ? columnsProp
      : foldSiblings(columnsProp, {
          Sm: columnsSm,
          Md: columnsMd,
          Lg: columnsLg,
          Xl: columnsXl,
        });
  let gap = foldSiblings(gapProp, {
    Sm: gapSm,
    Md: gapMd,
    Lg: gapLg,
    Xl: gapXl,
  });

  if (typeof columns !== 'string') {
    columns = foldContainerSiblings(columns, container, {
      CqMd: columnsCqMd,
      CqLg: columnsCqLg,
      CqXl: columnsCqXl,
      Cq2xl: columnsCq2xl,
      Cq3xl: columnsCq3xl,
      Cq4xl: columnsCq4xl,
    });
  }
  gap = foldContainerSiblings(gap, container, {
    CqMd: gapCqMd,
    CqLg: gapCqLg,
    CqXl: gapCqXl,
    Cq2xl: gapCq2xl,
    Cq3xl: gapCq3xl,
    Cq4xl: gapCq4xl,
  });
  // A responsive `display` is emitted as classes; Grid would otherwise always
  // write display:grid inline, which beats them and kills the breakpoint.
  const responsiveDisplay = isResponsive(boxProps.display);
  const { classes: boxClasses, rest: plainBox } =
    splitResponsiveBoxProps(boxProps);
  const { style: resolved, rest } = splitBoxProps(plainBox);

  // A responsive prop resolves to breakpoint CLASSES; a plain one to an inline
  // style. Never both for the same prop — an inline style always beats a class.
  const columnsCls =
    typeof columns === 'string'
      ? undefined
      : responsiveClasses(columns, columnsClass);
  const gapCls = responsiveClasses(gap, spaceClass('gap'));

  const plainColumns =
    typeof columns === 'string' ? columns : plainValue(columns);
  const plainGap = plainValue(gap);

  const gridStyle: CSSProperties = {
    display: responsiveDisplay ? undefined : inline ? 'inline-grid' : 'grid',
    gridTemplateColumns: columnsCls ? undefined : template(plainColumns),
    gridTemplateRows: template(rows),
    alignItems: align ? ALIGN[align] : undefined,
    justifyItems: justify ? ALIGN[justify] : undefined,
  };
  // Never emit the `gap` shorthand together with `undefined` `rowGap`/`columnGap`
  // longhands — React drops the shorthand on rerender, zeroing the gap.
  if (!gapCls && plainGap != null) gridStyle.gap = resolveSpace(plainGap);
  if (rowGap != null) gridStyle.rowGap = resolveSpace(rowGap);
  if (columnGap != null) gridStyle.columnGap = resolveSpace(columnGap);
  return (
    <Comp
      ref={ref}
      className={cn(boxClasses, columnsCls, gapCls, className)}
      style={{ ...resolved, ...gridStyle, ...style }}
      {...rest}
    />
  );
});

export interface GridItemProps
  extends BoxStyleProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  as?: React.ElementType;
  /**
   * Columns to span. Accepts a per-breakpoint object, including container
   * queries: `span={{ base: 1, '@4xl/content': 2 }}`.
   */
  span?: Responsive<number>;
  /* Flat per-breakpoint siblings (see ./responsive). */
  spanSm?: number;
  spanMd?: number;
  spanLg?: number;
  spanXl?: number;
  spanCqMd?: number;
  spanCqLg?: number;
  spanCqXl?: number;
  spanCq2xl?: number;
  spanCq3xl?: number;
  spanCq4xl?: number;
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
    span: spanProp,
    rowSpan,
    colStart,
    colEnd,
    spanSm,
    spanMd,
    spanLg,
    spanXl,
    spanCqMd,
    spanCqLg,
    spanCqXl,
    spanCq2xl,
    spanCq3xl,
    spanCq4xl,
    ...boxProps
  },
  ref
) {
  const container = boxProps.container;
  let span = foldSiblings(spanProp, {
    Sm: spanSm,
    Md: spanMd,
    Lg: spanLg,
    Xl: spanXl,
  });
  span = foldContainerSiblings(span, container, {
    CqMd: spanCqMd,
    CqLg: spanCqLg,
    CqXl: spanCqXl,
    Cq2xl: spanCq2xl,
    Cq3xl: spanCq3xl,
    Cq4xl: spanCq4xl,
  });
  const { classes: itemClasses, rest: plainItem } =
    splitResponsiveBoxProps(boxProps);
  const { style: resolved, rest } = splitBoxProps(plainItem);

  // A responsive span resolves to col-span-* classes; a plain one to an inline
  // gridColumn. Never both — the inline style would beat the classes.
  const spanCls = responsiveClasses(span, spanClass);
  const plainSpan = plainValue(span);

  const itemStyle: CSSProperties = {
    gridColumn: spanCls
      ? undefined
      : colStart != null || colEnd != null
        ? `${colStart ?? 'auto'} / ${colEnd ?? (plainSpan != null ? `span ${plainSpan}` : 'auto')}`
        : plainSpan != null
          ? `span ${plainSpan} / span ${plainSpan}`
          : undefined,
    gridRow: rowSpan != null ? `span ${rowSpan} / span ${rowSpan}` : undefined,
  };
  return (
    <Comp
      ref={ref}
      className={cn(itemClasses, spanCls, className)}
      style={{ ...resolved, ...itemStyle, ...style }}
      {...rest}
    />
  );
});

export { Grid, GridItem };
