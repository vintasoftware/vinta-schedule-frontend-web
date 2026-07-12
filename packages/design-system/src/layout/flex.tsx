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
  isResponsive,
  directionClass,
  alignClass,
  justifyClass,
  spaceClass,
  foldSiblings,
  foldContainerSiblings,
  type Responsive,
} from './responsive';

export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
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
  direction?: Responsive<FlexDirection>;
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

  /* Composer-editable per-breakpoint siblings — flat scalars so they curate as
     token dropdowns in Puck. Folded into the base prop below. */
  directionSm?: FlexDirection;
  directionMd?: FlexDirection;
  directionLg?: FlexDirection;
  directionXl?: FlexDirection;
  alignSm?: Align;
  alignMd?: Align;
  alignLg?: Align;
  alignXl?: Align;
  justifySm?: Justify;
  justifyMd?: Justify;
  justifyLg?: Justify;
  justifyXl?: Justify;
  gapSm?: Space;
  gapMd?: Space;
  gapLg?: Space;
  gapXl?: Space;

  /* Container-query siblings, resolved against `container` (BoxStyleProps). */
  directionCqMd?: FlexDirection;
  directionCqLg?: FlexDirection;
  directionCqXl?: FlexDirection;
  directionCq2xl?: FlexDirection;
  directionCq3xl?: FlexDirection;
  directionCq4xl?: FlexDirection;
  alignCqMd?: Align;
  alignCqLg?: Align;
  alignCqXl?: Align;
  alignCq2xl?: Align;
  alignCq3xl?: Align;
  alignCq4xl?: Align;
  justifyCqMd?: Justify;
  justifyCqLg?: Justify;
  justifyCqXl?: Justify;
  justifyCq2xl?: Justify;
  justifyCq3xl?: Justify;
  justifyCq4xl?: Justify;
  gapCqMd?: Space;
  gapCqLg?: Space;
  gapCqXl?: Space;
  gapCq2xl?: Space;
  gapCq3xl?: Space;
  gapCq4xl?: Space;
}

/**
 * Flex — flexbox container driven by props. Composes all Box style props plus
 * direction / align / justify / wrap / gap.
 *
 * ```tsx
 * <Flex justify="between" align="center" gap={4}>…</Flex>
 * ```
 */
const Flex = React.forwardRef<HTMLElement, FlexProps>(function Flex(
  {
    as: Comp = 'div',
    className,
    style,
    direction: directionProp = 'row',
    align: alignProp,
    justify: justifyProp,
    wrap,
    gap: gapProp,
    rowGap,
    columnGap,
    inline,
    directionSm,
    directionMd,
    directionLg,
    directionXl,
    alignSm,
    alignMd,
    alignLg,
    alignXl,
    justifySm,
    justifyMd,
    justifyLg,
    justifyXl,
    gapSm,
    gapMd,
    gapLg,
    gapXl,
    directionCqMd,
    directionCqLg,
    directionCqXl,
    directionCq2xl,
    directionCq3xl,
    directionCq4xl,
    alignCqMd,
    alignCqLg,
    alignCqXl,
    alignCq2xl,
    alignCq3xl,
    alignCq4xl,
    justifyCqMd,
    justifyCqLg,
    justifyCqXl,
    justifyCq2xl,
    justifyCq3xl,
    justifyCq4xl,
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
  // `container` lives on BoxStyleProps, so read it without consuming it —
  // splitResponsiveBoxProps still needs it for the box-level Cq siblings.
  const container = boxProps.container;
  // Fold the composer-editable siblings back into one Responsive value.
  let direction = foldSiblings(directionProp, {
    Sm: directionSm,
    Md: directionMd,
    Lg: directionLg,
    Xl: directionXl,
  });
  let align = foldSiblings(alignProp, {
    Sm: alignSm,
    Md: alignMd,
    Lg: alignLg,
    Xl: alignXl,
  });
  let justify = foldSiblings(justifyProp, {
    Sm: justifySm,
    Md: justifyMd,
    Lg: justifyLg,
    Xl: justifyXl,
  });
  let gap = foldSiblings(gapProp, {
    Sm: gapSm,
    Md: gapMd,
    Lg: gapLg,
    Xl: gapXl,
  });
  // A responsive `display` (the `hidden md:flex` idiom) is emitted as classes by
  // splitResponsiveBoxProps. Flex would otherwise ALWAYS write display:flex as
  // an inline style, which beats those classes and silently kills the
  // breakpoint. Detect it and leave `display` to the classes.
  const responsiveDisplay = isResponsive(boxProps.display);
  direction = foldContainerSiblings(direction, container, {
    CqMd: directionCqMd,
    CqLg: directionCqLg,
    CqXl: directionCqXl,
    Cq2xl: directionCq2xl,
    Cq3xl: directionCq3xl,
    Cq4xl: directionCq4xl,
  });
  align = foldContainerSiblings(align, container, {
    CqMd: alignCqMd,
    CqLg: alignCqLg,
    CqXl: alignCqXl,
    Cq2xl: alignCq2xl,
    Cq3xl: alignCq3xl,
    Cq4xl: alignCq4xl,
  });
  justify = foldContainerSiblings(justify, container, {
    CqMd: justifyCqMd,
    CqLg: justifyCqLg,
    CqXl: justifyCqXl,
    Cq2xl: justifyCq2xl,
    Cq3xl: justifyCq3xl,
    Cq4xl: justifyCq4xl,
  });
  gap = foldContainerSiblings(gap, container, {
    CqMd: gapCqMd,
    CqLg: gapCqLg,
    CqXl: gapCqXl,
    Cq2xl: gapCq2xl,
    Cq3xl: gapCq3xl,
    Cq4xl: gapCq4xl,
  });

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
    display: responsiveDisplay ? undefined : inline ? 'inline-flex' : 'flex',
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
