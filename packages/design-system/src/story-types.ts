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
 * Puck contract parameters. Declare container slot props here (each name must be
 * a prop the component actually renders, typed `ReactNode`). The platform wires
 * Puck's SlotComponent for every declared name.
 */
export interface PuckParameters {
  slots?: readonly string[];
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
