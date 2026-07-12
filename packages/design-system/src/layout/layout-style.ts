import type { CSSProperties } from 'react';

import {
  isResponsive,
  plainValue,
  responsiveClasses,
  spaceClass,
  displayClass,
  textAlignClass,
  type Responsive,
  type Display,
  type TextAlign,
} from './responsive';

/**
 * Shared style-prop vocabulary for the layout primitives. Values resolve to the
 * design-system tokens (spacing scale, radius, shadow, color CSS vars) so the
 * primitives can be composed purely through props — no Tailwind classes needed.
 */

/* 4px spacing scale (matches the DS --space-* tokens). */
export type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

const SPACE_REM: Record<Space, string> = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
};

export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const RADIUS: Record<Radius, string> = {
  none: '0',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: '9999px',
};

export type Shadow = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SHADOW: Record<Shadow, string> = {
  none: 'none',
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
};

/**
 * A design-token color name (e.g. 'primary', 'muted-foreground', 'vinta-600',
 * 'border'). Resolves to `var(--<name>)`. Any raw CSS color string also works.
 */
export type ColorToken =
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'popover'
  | 'popover-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'success'
  | 'warning'
  | 'border'
  | 'input'
  | 'ring'
  | `vinta-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950}`
  | `teal-${100 | 300 | 500 | 600 | 700}`
  | (string & {});

export type Size = number | string;

function size(v: Size | undefined): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return `${v}px`;
  if (v === 'full') return '100%';
  if (v === 'screen') return '100vw';
  if (v === 'min') return 'min-content';
  if (v === 'max') return 'max-content';
  if (v === 'fit') return 'fit-content';
  return v;
}

function heightSize(v: Size | undefined): string | undefined {
  if (v === 'screen') return '100vh';
  return size(v);
}

function spacing(v: Space | 'auto' | undefined): string | undefined {
  if (v == null) return undefined;
  if (v === 'auto') return 'auto';
  return SPACE_REM[v];
}

export function color(c: ColorToken | undefined): string | undefined {
  if (c == null) return undefined;
  // Raw CSS values (hex, rgb, var(), currentColor, transparent) pass through.
  if (
    c.startsWith('#') ||
    c.startsWith('var(') ||
    c.startsWith('rgb') ||
    c.startsWith('hsl') ||
    c.startsWith('oklch') ||
    c === 'transparent' ||
    c === 'currentColor' ||
    c === 'inherit'
  ) {
    return c;
  }
  return `var(--${c})`;
}

/**
 * Box style props supported by every primitive.
 *
 * Padding, `display` and `textAlign` additionally accept a per-breakpoint
 * object (`p={{ base: 4, md: 6 }}`, `display={{ base: 'hidden', md: 'flex' }}`).
 * Those resolve to Tailwind breakpoint classes rather than inline styles — see
 * splitResponsiveBoxProps below and ./responsive.
 */
export interface BoxStyleProps {
  // padding
  p?: Responsive<Space>;
  px?: Responsive<Space>;
  py?: Responsive<Space>;
  pt?: Responsive<Space>;
  pr?: Responsive<Space>;
  pb?: Responsive<Space>;
  pl?: Responsive<Space>;
  // margin
  m?: Space | 'auto';
  mx?: Space | 'auto';
  my?: Space | 'auto';
  mt?: Space | 'auto';
  mr?: Space | 'auto';
  mb?: Space | 'auto';
  ml?: Space | 'auto';
  // color / surface
  bg?: ColorToken;
  color?: ColorToken;
  radius?: Radius;
  shadow?: Shadow;
  border?: boolean | number;
  /**
   * Per-side borders — the `border-b` / `border-r` / `divide-y` idiom, which is
   * everywhere in app chrome (sidebars, table rows, section rules) and has no
   * expression via the all-or-nothing `border` prop. Each takes `true` (1px) or
   * an explicit width. All sides use `borderColor` (default the `border` token).
   */
  borderTop?: boolean | number;
  borderRight?: boolean | number;
  borderBottom?: boolean | number;
  borderLeft?: boolean | number;
  borderColor?: ColorToken;
  // sizing
  width?: Size;
  height?: Size;
  minWidth?: Size;
  maxWidth?: Size;
  minHeight?: Size;
  maxHeight?: Size;
  // box behavior
  display?: Responsive<Display> | CSSProperties['display'];
  overflow?: CSSProperties['overflow'];
  position?: CSSProperties['position'];
  // Inset + stacking — needed by sticky bars and absolutely-positioned badges.
  top?: Size;
  right?: Size;
  bottom?: Size;
  left?: Size;
  zIndex?: number;
  // flex item
  grow?: boolean | number;
  shrink?: boolean | number;
  basis?: Size;
  alignSelf?: CSSProperties['alignSelf'];
  // escape hatch
  textAlign?: Responsive<TextAlign> | CSSProperties['textAlign'];
}

/** Box props that accept a per-breakpoint object. */
const RESPONSIVE_KEYS = [
  'p',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'display',
  'textAlign',
] as const;

/**
 * Pull the responsive (per-breakpoint) box props out of a props object and
 * turn them into Tailwind breakpoint classes.
 *
 * The consumed keys are DELETED from `rest` so they can never also reach the
 * inline-style path — an inline style would beat the breakpoint class and the
 * responsive value would silently do nothing. Plain values are left untouched
 * for boxStyle() to handle.
 */
export function splitResponsiveBoxProps<T extends BoxStyleProps>(
  props: T
): { classes: string | undefined; rest: T } {
  const classes: string[] = [];
  const rest = { ...props } as Record<string, unknown>;

  for (const key of RESPONSIVE_KEYS) {
    const value = rest[key];
    if (!isResponsive(value)) continue;

    const cls =
      key === 'display'
        ? responsiveClasses(value as Responsive<Display>, displayClass)
        : key === 'textAlign'
          ? responsiveClasses(value as Responsive<TextAlign>, textAlignClass)
          : responsiveClasses(value as Responsive<Space>, spaceClass(key));

    if (cls) classes.push(cls);
    delete rest[key];
  }

  return {
    classes: classes.length ? classes.join(' ') : undefined,
    rest: rest as T,
  };
}

const BOX_KEYS: (keyof BoxStyleProps)[] = [
  'p',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
  'bg',
  'color',
  'radius',
  'shadow',
  'border',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'borderColor',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'display',
  'overflow',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'grow',
  'shrink',
  'basis',
  'alignSelf',
  'textAlign',
];

function flexNum(v: boolean | number | undefined): number | undefined {
  if (v == null) return undefined;
  return v === true ? 1 : v === false ? 0 : v;
}

/** Build a CSSProperties object from box style props. */
export function boxStyle(props: BoxStyleProps): CSSProperties {
  const s: CSSProperties = {};

  // Responsive values are consumed as classes by splitResponsiveBoxProps and
  // never reach here; plainValue() drops any that slip through so a
  // per-breakpoint object can't be stringified into an inline style.
  const p = plainValue(props.p);
  const px = plainValue(props.px);
  const py = plainValue(props.py);
  const pt = plainValue(props.pt);
  const pr = plainValue(props.pr);
  const pb = plainValue(props.pb);
  const pl = plainValue(props.pl);

  // padding
  if (p != null) s.padding = spacing(p);
  if (px != null) {
    s.paddingLeft = spacing(px);
    s.paddingRight = spacing(px);
  }
  if (py != null) {
    s.paddingTop = spacing(py);
    s.paddingBottom = spacing(py);
  }
  if (pt != null) s.paddingTop = spacing(pt);
  if (pr != null) s.paddingRight = spacing(pr);
  if (pb != null) s.paddingBottom = spacing(pb);
  if (pl != null) s.paddingLeft = spacing(pl);

  // margin
  if (props.m != null) s.margin = spacing(props.m);
  if (props.mx != null) {
    s.marginLeft = spacing(props.mx);
    s.marginRight = spacing(props.mx);
  }
  if (props.my != null) {
    s.marginTop = spacing(props.my);
    s.marginBottom = spacing(props.my);
  }
  if (props.mt != null) s.marginTop = spacing(props.mt);
  if (props.mr != null) s.marginRight = spacing(props.mr);
  if (props.mb != null) s.marginBottom = spacing(props.mb);
  if (props.ml != null) s.marginLeft = spacing(props.ml);

  // surface
  if (props.bg != null) s.backgroundColor = color(props.bg);
  if (props.color != null) s.color = color(props.color);
  if (props.radius != null) s.borderRadius = RADIUS[props.radius];
  if (props.shadow != null) s.boxShadow = SHADOW[props.shadow];
  if (props.border) {
    const w = props.border === true ? 1 : props.border;
    s.borderWidth = `${w}px`;
    s.borderStyle = 'solid';
    s.borderColor = color(props.borderColor ?? 'border');
  } else if (props.borderColor != null) {
    s.borderColor = color(props.borderColor);
  }

  // Per-side borders. Each sets its own width/style/color so it works whether or
  // not the all-sides `border` prop is also present.
  const sideColor = color(props.borderColor ?? 'border');
  const sideWidth = (v: boolean | number) => `${v === true ? 1 : v}px`;
  if (props.borderTop) {
    s.borderTopWidth = sideWidth(props.borderTop);
    s.borderTopStyle = 'solid';
    s.borderTopColor = sideColor;
  }
  if (props.borderRight) {
    s.borderRightWidth = sideWidth(props.borderRight);
    s.borderRightStyle = 'solid';
    s.borderRightColor = sideColor;
  }
  if (props.borderBottom) {
    s.borderBottomWidth = sideWidth(props.borderBottom);
    s.borderBottomStyle = 'solid';
    s.borderBottomColor = sideColor;
  }
  if (props.borderLeft) {
    s.borderLeftWidth = sideWidth(props.borderLeft);
    s.borderLeftStyle = 'solid';
    s.borderLeftColor = sideColor;
  }

  // sizing
  if (props.width != null) s.width = size(props.width);
  if (props.height != null) s.height = heightSize(props.height);
  if (props.minWidth != null) s.minWidth = size(props.minWidth);
  if (props.maxWidth != null) s.maxWidth = size(props.maxWidth);
  if (props.minHeight != null) s.minHeight = heightSize(props.minHeight);
  if (props.maxHeight != null) s.maxHeight = heightSize(props.maxHeight);

  // behavior
  const display = plainValue(props.display) as CSSProperties['display'];
  const textAlign = plainValue(props.textAlign) as CSSProperties['textAlign'];
  if (display != null) s.display = display;
  if (props.overflow != null) s.overflow = props.overflow;
  if (props.position != null) s.position = props.position;
  if (textAlign != null) s.textAlign = textAlign;

  // inset + stacking
  if (props.top != null) s.top = size(props.top);
  if (props.right != null) s.right = size(props.right);
  if (props.bottom != null) s.bottom = size(props.bottom);
  if (props.left != null) s.left = size(props.left);
  if (props.zIndex != null) s.zIndex = props.zIndex;

  // flex item
  if (props.grow != null) s.flexGrow = flexNum(props.grow);
  if (props.shrink != null) s.flexShrink = flexNum(props.shrink);
  if (props.basis != null) s.flexBasis = size(props.basis);
  if (props.alignSelf != null) s.alignSelf = props.alignSelf;

  return s;
}

/** Split box style props out of a mixed props object. */
export function splitBoxProps<T extends BoxStyleProps>(
  props: T
): { style: CSSProperties; rest: Omit<T, keyof BoxStyleProps> } {
  const style = boxStyle(props);
  const rest = { ...props } as Record<string, unknown>;
  for (const k of BOX_KEYS) delete rest[k as string];
  return { style, rest: rest as Omit<T, keyof BoxStyleProps> };
}

export { spacing as resolveSpace, size as resolveSize };
