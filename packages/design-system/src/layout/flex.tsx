import * as React from 'react';
import type { CSSProperties } from 'react';

import { cn } from '../lib/utils';
import {
  boxStyle,
  splitBoxProps,
  splitResponsiveBoxProps,
  resolveSpace,
  type BoxStyleProps,
  type Space,
} from './layout-style';
import {
  responsiveClasses,
  plainValue,
  directionClass,
  alignClass,
  justifyClass,
  spaceClass,
  type Responsive,
} from './responsive';

type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

const ALIGN: Record<Align, CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};

const JUSTIFY: Record<Justify, CSSProperties['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};

export interface FlexProps
  extends BoxStyleProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  as?: React.ElementType;
  /** Accepts a per-breakpoint object: `direction={{ base: 'column', md: 'row' }}`. */
  direction?: Responsive<'row' | 'column' | 'row-reverse' | 'column-reverse'>;
  /** Accepts a per-breakpoint object. */
  align?: Responsive<Align>;
  /** Accepts a per-breakpoint object. */
  justify?: Responsive<Justify>;
  wrap?: boolean | 'reverse';
  /** Accepts a per-breakpoint object: `gap={{ base: 2, md: 4 }}`. */
  gap?: Responsive<Space>;
  rowGap?: Space;
  columnGap?: Space;
  inline?: boolean;
}

/**
 * Flex — flexbox container driven by props. Composes all Box style props plus
 * direction / align / justify / wrap / gap.
 *
 *   <Flex justify="between" align="center" gap={4}>…</Flex>
 */
const Flex = React.forwardRef<HTMLElement, FlexProps>(function Flex(
  {
    as: Comp = 'div',
    className,
    style,
    direction = 'row',
    align,
    justify,
    wrap,
    gap,
    rowGap,
    columnGap,
    inline,
    ...boxProps
  },
  ref
) {
  const { classes: boxClasses, rest: plainBox } =
    splitResponsiveBoxProps(boxProps);
  const { style: resolved, rest } = splitBoxProps(plainBox);

  // A responsive prop resolves to breakpoint CLASSES; a plain one to an inline
  // style. Never both for the same prop — an inline style always beats a class.
  const directionCls = responsiveClasses(direction, directionClass);
  const alignCls = responsiveClasses(align, alignClass);
  const justifyCls = responsiveClasses(justify, justifyClass);
  const gapCls = responsiveClasses(gap, spaceClass('gap'));

  const plainDirection = plainValue(direction);
  const plainAlign = plainValue(align);
  const plainJustify = plainValue(justify);
  const plainGap = plainValue(gap);

  const flexStyle: CSSProperties = {
    display: inline ? 'inline-flex' : 'flex',
    flexDirection: directionCls ? undefined : plainDirection,
    alignItems: plainAlign ? ALIGN[plainAlign] : undefined,
    justifyContent: plainJustify ? JUSTIFY[plainJustify] : undefined,
    flexWrap:
      wrap === true ? 'wrap' : wrap === 'reverse' ? 'wrap-reverse' : undefined,
  };
  // Only assign the gap keys that are actually set. Emitting the `gap`
  // shorthand alongside `undefined` `rowGap`/`columnGap` longhands makes React
  // warn about mixing shorthand + longhand and DROP the shorthand on rerender —
  // which silently zeroed the gap (glued labels next to switches/checkboxes).
  if (!gapCls && plainGap != null) flexStyle.gap = resolveSpace(plainGap);
  if (rowGap != null) flexStyle.rowGap = resolveSpace(rowGap);
  if (columnGap != null) flexStyle.columnGap = resolveSpace(columnGap);
  return (
    <Comp
      ref={ref}
      className={cn(
        boxClasses,
        directionCls,
        alignCls,
        justifyCls,
        gapCls,
        className
      )}
      style={{ ...resolved, ...flexStyle, ...style }}
      {...rest}
    />
  );
});

export type StackProps = Omit<FlexProps, 'direction'>;

/** Vertical flex stack. */
const VStack = React.forwardRef<HTMLElement, StackProps>(
  function VStack(props, ref) {
    return <Flex ref={ref} direction='column' {...props} />;
  }
);

/** Horizontal flex stack (centers items vertically by default). */
const HStack = React.forwardRef<HTMLElement, StackProps>(function HStack(
  { align = 'center', ...props },
  ref
) {
  return <Flex ref={ref} direction='row' align={align} {...props} />;
});

export { Flex, HStack, VStack, boxStyle };
