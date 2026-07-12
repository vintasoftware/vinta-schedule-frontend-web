import type { Space } from './layout-style';

/**
 * Responsive prop support for the layout primitives.
 *
 * Without this, every breakpoint forces an escape to `className`
 * (`hidden md:flex`, `grid-cols-1 md:grid-cols-2`) — which defeats the point of
 * composing from props. A prop typed `Responsive<T>` takes either a plain value
 * or a per-breakpoint object:
 *
 *   <Grid columns={{ base: 1, md: 2, lg: 3 }} gap={{ base: 4, md: 6 }} />
 *   <Flex direction={{ base: 'column', md: 'row' }} />
 *   <Box display={{ base: 'hidden', md: 'flex' }} />
 *
 * Plain values still resolve to inline styles (see layout-style.ts). Responsive
 * values resolve to Tailwind breakpoint CLASSES instead — the two must never be
 * emitted for the same prop, because an inline style would always beat a class.
 * The class names are built at runtime, so they are safelisted in
 * styles/responsive-safelist.css.
 */

/** Tailwind's default breakpoints. `base` is the unprefixed, mobile-first value. */
export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl';

const BREAKPOINTS: Breakpoint[] = ['base', 'sm', 'md', 'lg', 'xl'];

export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

/** A responsive value is the object form; a plain value is anything else. */
export function isResponsive<T>(
  value: Responsive<T> | undefined
): value is Partial<Record<Breakpoint, T>> {
  return (
    typeof value === 'object' &&
    value !== null &&
    BREAKPOINTS.some((bp) => bp in (value as object))
  );
}

/** `md` + `grid-cols-2` → `md:grid-cols-2`; `base` stays unprefixed. */
function prefix(bp: Breakpoint, className: string): string {
  return bp === 'base' ? className : `${bp}:${className}`;
}

/**
 * Expand a responsive value into breakpoint classes via a per-value class
 * builder. Returns undefined for a plain (non-responsive) value so the caller
 * can fall back to the inline-style path.
 */
export function responsiveClasses<T>(
  value: Responsive<T> | undefined,
  toClass: (v: T) => string | undefined
): string | undefined {
  if (!isResponsive(value)) return undefined;
  const out: string[] = [];
  for (const bp of BREAKPOINTS) {
    const v = value[bp];
    if (v == null) continue;
    const cls = toClass(v);
    if (cls) out.push(prefix(bp, cls));
  }
  return out.length ? out.join(' ') : undefined;
}

/** The plain value of a responsive prop, for the inline-style path. */
export function plainValue<T>(value: Responsive<T> | undefined): T | undefined {
  return isResponsive(value) ? undefined : (value as T | undefined);
}

/* ---------------------------- class builders ----------------------------- */
/* Each maps one prop value to its Tailwind class. Kept as functions (not literal
   maps) because responsive-safelist.css guarantees the classes exist. */

export const spaceClass =
  (prop: 'p' | 'px' | 'py' | 'pt' | 'pr' | 'pb' | 'pl' | 'gap') =>
  (v: Space): string =>
    `${prop}-${v}`;

export const gapAxisClass =
  (axis: 'x' | 'y') =>
  (v: Space): string =>
    `gap-${axis}-${v}`;

export type Display = 'hidden' | 'block' | 'flex' | 'inline-flex' | 'grid';
export const displayClass = (v: Display): string => v;

export type Direction = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export const directionClass = (v: Direction): string =>
  `flex-${v.replace('column', 'col')}`;

export const columnsClass = (v: number): string => `grid-cols-${v}`;

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export const alignClass = (v: Align): string => `items-${v}`;

export type Justify =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly';
export const justifyClass = (v: Justify): string => `justify-${v}`;

export type TextAlign = 'left' | 'center' | 'right';
export const textAlignClass = (v: TextAlign): string => `text-${v}`;
