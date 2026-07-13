/**
 * Local, structural CSF types — no dependency on any Storybook runtime package.
 *
 * The composer evaluates *.stories.tsx with plain esbuild and does NOT install
 * Storybook (it lives only in devDependencies, which the worker never installs).
 * A value import from `storybook/*`, or even a non-type import of Meta/StoryObj
 * from `@storybook/*`, breaks bundling. These local types are erased at build
 * time (imported as `import type`), so stories bundle cleanly here while still
 * working unchanged in the package's own Storybook (CSF is shape-based).
 *
 * Keep this in sync with the subset of CSF the contract extractor reads:
 * meta.title, meta.component, meta.argTypes, meta.args, meta.parameters.puck.
 */
import type { ComponentType, ReactElement, ReactNode } from 'react';

/** Controls the extractor supports. Anything else → UNSUPPORTED_CONTROL. */
export type ControlType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'radio'
  | 'inline-radio'
  | 'object'
  | 'array';

export interface ArgType {
  control?: ControlType | { type: ControlType; [key: string]: unknown };
  options?: readonly (string | number | boolean)[];
  description?: string;
  name?: string;
  table?: Record<string, unknown>;
}

/**
 * A slot that restricts what may be dropped into it.
 *
 * `allow` lists CONTRACT COMPONENT NAMES — the leaf of another story's
 * `meta.title` (e.g. 'Components/AccordionItem' → 'AccordionItem'), which the
 * platform resolves as a named export. A name with no matching story is
 * silently dropped by the platform, so check:contract cross-checks every entry
 * against the set of real titles.
 *
 * Restrict a slot when its content ONLY works inside that parent — chiefly
 * Radix compounds, whose subcomponents read the root's React context and throw
 * outside it. Leave a slot as a bare string when any component is legal there.
 */
export interface PuckSlot {
  /** The prop name — must be a prop the component renders, typed `ReactNode`. */
  name: string;
  /** Component names the editor may offer inside. Omit for unrestricted. */
  allow?: readonly string[];
}

/**
 * Puck contract parameters. Declare container slot props here (each name must be
 * a prop the component actually renders, typed `ReactNode`). The platform wires
 * Puck's SlotComponent for every declared name.
 *
 * An entry is either a bare name (unrestricted) or a `PuckSlot` (restricted).
 */
export interface PuckParameters {
  slots?: readonly (string | PuckSlot)[];
  [key: string]: unknown;
}

export interface Parameters {
  layout?: 'centered' | 'fullscreen' | 'padded';
  puck?: PuckParameters;
  [key: string]: unknown;
}

/** `_C` mirrors Storybook's `Meta<typeof Component>` call-shape but is unused. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Meta<_C = unknown> {
  title?: string;
  component?: ComponentType<never> | ComponentType<Record<string, unknown>>;
  tags?: readonly string[];
  args?: Record<string, unknown>;
  argTypes?: Record<string, ArgType>;
  parameters?: Parameters;
  decorators?: readonly unknown[];
}

/**
 * `_M` mirrors Storybook's `StoryObj<typeof meta>` call-shape but is unused.
 * `render` args are intentionally loose — a structural CSF shim can't know each
 * component's prop type, and stories spread args straight onto the component.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface StoryObj<_M = unknown> {
  name?: string;
  args?: Record<string, unknown>;
  argTypes?: Record<string, ArgType>;
  parameters?: Parameters;
  /** Storybook-only (e.g. the viewport toolbar); ignored by the extractor. */
  globals?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (args: any) => ReactElement;
}

export type { ReactNode };
