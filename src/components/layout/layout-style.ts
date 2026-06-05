import type { CSSProperties } from 'react';

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

/** Box style props supported by every primitive. */
export interface BoxStyleProps {
  // padding
  p?: Space;
  px?: Space;
  py?: Space;
  pt?: Space;
  pr?: Space;
  pb?: Space;
  pl?: Space;
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
  borderColor?: ColorToken;
  // sizing
  width?: Size;
  height?: Size;
  minWidth?: Size;
  maxWidth?: Size;
  minHeight?: Size;
  maxHeight?: Size;
  // box behavior
  display?: CSSProperties['display'];
  overflow?: CSSProperties['overflow'];
  position?: CSSProperties['position'];
  // flex item
  grow?: boolean | number;
  shrink?: boolean | number;
  basis?: Size;
  alignSelf?: CSSProperties['alignSelf'];
  // escape hatch
  textAlign?: CSSProperties['textAlign'];
}

const BOX_KEYS: (keyof BoxStyleProps)[] = [
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
  'bg', 'color', 'radius', 'shadow', 'border', 'borderColor',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'display', 'overflow', 'position',
  'grow', 'shrink', 'basis', 'alignSelf', 'textAlign',
];

function flexNum(v: boolean | number | undefined): number | undefined {
  if (v == null) return undefined;
  return v === true ? 1 : v === false ? 0 : v;
}

/** Build a CSSProperties object from box style props. */
export function boxStyle(props: BoxStyleProps): CSSProperties {
  const s: CSSProperties = {};

  // padding
  if (props.p != null) s.padding = spacing(props.p);
  if (props.px != null) {
    s.paddingLeft = spacing(props.px);
    s.paddingRight = spacing(props.px);
  }
  if (props.py != null) {
    s.paddingTop = spacing(props.py);
    s.paddingBottom = spacing(props.py);
  }
  if (props.pt != null) s.paddingTop = spacing(props.pt);
  if (props.pr != null) s.paddingRight = spacing(props.pr);
  if (props.pb != null) s.paddingBottom = spacing(props.pb);
  if (props.pl != null) s.paddingLeft = spacing(props.pl);

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

  // sizing
  if (props.width != null) s.width = size(props.width);
  if (props.height != null) s.height = heightSize(props.height);
  if (props.minWidth != null) s.minWidth = size(props.minWidth);
  if (props.maxWidth != null) s.maxWidth = size(props.maxWidth);
  if (props.minHeight != null) s.minHeight = heightSize(props.minHeight);
  if (props.maxHeight != null) s.maxHeight = heightSize(props.maxHeight);

  // behavior
  if (props.display != null) s.display = props.display;
  if (props.overflow != null) s.overflow = props.overflow;
  if (props.position != null) s.position = props.position;
  if (props.textAlign != null) s.textAlign = props.textAlign;

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
