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

/** Tailwind's default viewport breakpoints. `base` is the unprefixed value. */
export type ViewportBreakpoint = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Container-query breakpoints. These react to the width of an ANCESTOR, not the
 * viewport — which is what the app shell actually needs: collapsing the sidebar
 * makes the content area wider, and the page body should reflow off that, not
 * off the window. The shell marks the containers (`@container/content` etc.).
 */
export type ContainerName = 'app' | 'content' | 'nav' | 'topbar' | 'pageheader';
export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
export type ContainerBreakpoint = `@${ContainerSize}/${ContainerName}`;

export type Breakpoint = 'base' | ViewportBreakpoint | ContainerBreakpoint;

const VIEWPORT: Breakpoint[] = ['sm', 'md', 'lg', 'xl'];
const CONTAINER_NAMES: ContainerName[] = [
  'app',
  'content',
  'nav',
  'topbar',
  'pageheader',
];
const CONTAINER_SIZES: ContainerSize[] = [
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
];

const CONTAINER: Breakpoint[] = CONTAINER_NAMES.flatMap((name) =>
  CONTAINER_SIZES.map((size) => `@${size}/${name}` as ContainerBreakpoint)
);

// `base` first so the unprefixed value is emitted before any override.
const BREAKPOINTS: Breakpoint[] = ['base', ...VIEWPORT, ...CONTAINER];

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

/**
 * The breakpoint key IS the Tailwind variant prefix, so viewport and container
 * breakpoints share one code path:
 *   `md`          + `grid-cols-2` → `md:grid-cols-2`
 *   `@xl/content` + `grid-cols-3` → `@xl/content:grid-cols-3`
 * `base` stays unprefixed.
 */
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

/* ------------------------- per-breakpoint siblings ------------------------ */
/**
 * A `Responsive<T>` object is ergonomic in code, but a nested object is awkward
 * anywhere props have to be flat scalars — serialized config, generated forms,
 * or tooling that only understands primitive values.
 *
 * So every responsive prop also accepts flat per-breakpoint siblings —
 * `columns` + `columnsMd` + `columnsLg` — each a plain scalar on the same token
 * scale. The component folds them back into one `Responsive<T>`, so both forms
 * behave identically; code normally keeps the object form.
 *
 * Container breakpoints are deliberately NOT exposed as viewport-style siblings:
 * they key off the app shell's named containers (`@container/content`), so they
 * need a container to resolve against and take the explicit `container` + `*Cq*`
 * form described below instead.
 */
export const VIEWPORT_SUFFIXES = ['Sm', 'Md', 'Lg', 'Xl'] as const;
export type ViewportSuffix = (typeof VIEWPORT_SUFFIXES)[number];

const SUFFIX_TO_BREAKPOINT: Record<ViewportSuffix, ViewportBreakpoint> = {
  Sm: 'sm',
  Md: 'md',
  Lg: 'lg',
  Xl: 'xl',
};

export type Siblings<T> = Partial<Record<ViewportSuffix, T>>;

/* ------------------------ container-query siblings ------------------------ */
/**
 * Container breakpoints are a 5-container x 6-size grid; exposing every pair as
 * a sibling would mean ~30 props PER responsive prop. Instead a component picks
 * ONE container to respond to (`container='content'`) and then sets size-suffixed
 * siblings against it:
 *
 *   <Grid container='content' columns={1} columnsCqXl={2} columnsCq4xl={3} />
 *   →  grid-cols-1  @xl/content:grid-cols-2  @4xl/content:grid-cols-3
 *
 * That is 6 siblings per prop instead of 30, and it is how the props are used in
 * practice — one element reacts to one meaningful ancestor.
 *
 * The code-level object form still addresses any container directly:
 *   columns={{ base: 1, '@xl/content': 2, '@3xl/topbar': 4 }}
 */
export const CONTAINER_SUFFIXES = [
  'CqMd',
  'CqLg',
  'CqXl',
  'Cq2xl',
  'Cq3xl',
  'Cq4xl',
] as const;
export type ContainerSuffix = (typeof CONTAINER_SUFFIXES)[number];

const CQ_SUFFIX_TO_SIZE: Record<ContainerSuffix, ContainerSize> = {
  CqMd: 'md',
  CqLg: 'lg',
  CqXl: 'xl',
  Cq2xl: '2xl',
  Cq3xl: '3xl',
  Cq4xl: '4xl',
};

export type ContainerSiblings<T> = Partial<Record<ContainerSuffix, T>>;

/**
 * Fold `<prop>Cq*` siblings into the base value, resolved against `container`.
 *
 * A container-query class is inert unless some ancestor is marked
 * `@container/<name>` — so when `container` is omitted the siblings are ignored
 * rather than emitted as classes that would silently never match.
 */
export function foldContainerSiblings<T>(
  base: Responsive<T> | undefined,
  container: ContainerName | undefined,
  siblings: ContainerSiblings<T>
): Responsive<T> | undefined {
  const set = CONTAINER_SUFFIXES.filter((s) => siblings[s] != null);
  if (set.length === 0 || !container) return base;

  const out: Partial<Record<Breakpoint, T>> = isResponsive(base)
    ? { ...base }
    : {};
  // A scalar base becomes the `base` breakpoint, so it stops emitting an inline
  // style that would beat the container-query classes.
  if (!isResponsive(base) && base != null) out.base = base as T;
  for (const s of set) {
    const key = `@${CQ_SUFFIX_TO_SIZE[s]}/${container}` as ContainerBreakpoint;
    out[key] = siblings[s] as T;
  }
  return out;
}

/** Marks an element as a named container: `@container/content`. */
export function containerClass(name: ContainerName | undefined) {
  return name ? `@container/${name}` : undefined;
}

/**
 * Fold `<prop>Sm|Md|Lg|Xl` siblings into the base value.
 *
 * Returns `base` untouched when no sibling is set, so a plain scalar keeps the
 * inline-style fast path and does not gain a stray class.
 */
export function foldSiblings<T>(
  base: Responsive<T> | undefined,
  siblings: Siblings<T>
): Responsive<T> | undefined {
  const set = VIEWPORT_SUFFIXES.filter((s) => siblings[s] != null);
  if (set.length === 0) return base;

  const out: Partial<Record<Breakpoint, T>> = isResponsive(base)
    ? { ...base }
    : {};
  // A scalar base becomes the `base` breakpoint once any sibling exists.
  if (!isResponsive(base) && base != null) out.base = base as T;
  for (const s of set) out[SUFFIX_TO_BREAKPOINT[s]] = siblings[s] as T;
  return out;
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

/** GridItem column span — `<GridItem span={{ base: 1, '@4xl/content': 2 }} />`. */
export const spanClass = (v: number): string => `col-span-${v}`;

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
