---
name: new-component
description: Scaffold a new atom — either a shadcn/ui component (cva variants, src/components/ui/) or a layout primitive (token-prop driven, src/components/layout/). Use when the user says "create an atom", "new UI component", "add a Button/Badge-like component", "add a layout primitive", or "create a reusable <thing> component". NOT for feature views composed of other components (use new-composition) or full routes (use new-page).
---

# New Component (atom)

Two kinds of atom live in this repo. Pick the right one first.

| You want… | Kind | Location |
|-----------|------|----------|
| A styled control with **variants** (button/badge/alert-like) | shadcn/ui atom | `src/components/ui/` |
| A **layout/spacing/typography** building block driven by token props | layout primitive | `src/components/layout/` |
| A stock shadcn component (dialog, select, table…) | install, don't write | `npx shadcn@latest add <name>` |

Always read [DESIGN.md](../../../DESIGN.md) and [AGENTS.md](../../../AGENTS.md) first.
**No raw hex/rgb — tokens only.**

## A. shadcn/ui atom (`src/components/ui/`)

For a new variant-bearing control. First check whether shadcn already ships it:
`npx shadcn@latest add <name>` (style is new-york, configured in
[components.json](../../../components.json)). Only hand-write when it's bespoke.

Mirror [`badge.tsx`](../../../src/components/ui/badge.tsx): `cva` for variants,
`cn()` to merge, export the component + its `*Variants` + a `*Props` interface.

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/index';

const thingVariants = cva('base classes here', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      // soft tints follow the badge palette: info/success/warning/danger/teal
    },
    size: { sm: '…', default: '…', lg: '…' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export interface ThingProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof thingVariants> {}

function Thing({ className, variant, size, ...props }: ThingProps) {
  return <div className={cn(thingVariants({ variant, size }), className)} {...props} />;
}

export { Thing, thingVariants };
```

- Use semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`),
  not literal colors.
- Icon-only controls: require `aria-label`. Icons from `lucide-react`.
- Reuse the existing variant vocabulary where it fits (Button sizes
  `xs|sm|default|lg|xl|icon`; Badge soft tints) instead of inventing parallel names.

## B. Layout primitive (`src/components/layout/`)

For a token-prop building block. Built on `Box`, `forwardRef`, token props from
[`layout-style.ts`](../../../src/components/layout/layout-style.ts). Mirror
[`box.tsx`](../../../src/components/layout/box.tsx) /
[`page-header.tsx`](../../../src/components/layout/page-header.tsx):

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils/index';
import { Box, type BoxProps } from './box';

export interface ThingProps extends BoxProps {
  /** describe the one extra prop this primitive adds */
  emphasis?: boolean;
}

const Thing = React.forwardRef<HTMLElement, ThingProps>(function Thing(
  { className, emphasis, ...props },
  ref
) {
  return <Box ref={ref} className={cn(emphasis && '…', className)} {...props} />;
});

export { Thing, type ThingProps };
```

Then **export it from [`index.ts`](../../../src/components/layout/index.ts)** (and
its `*Props` type) so consumers import from `@/components/layout`.

- Spacing props use the 4px scale `Space = 0|1|2|3|4|5|6|8|10|12|16|20|24`.
- `className` is an escape hatch only — don't rebuild layout in classes.

## After either kind

1. **Add a colocated story** `thing.stories.tsx` — see
   [add-storybook-story](../add-storybook-story/SKILL.md). A `Playground` plus a
   variant/states gallery.
2. `npm run typecheck` + `npm run lint` + `npm run format` clean.
3. Run `npm run storybook` to eyeball it; add a mobile-viewport variant if responsive.

## Don't

- Don't hand-write a stock shadcn component — install it.
- Don't hard-code colors or rebuild layout with utility classes.
- Don't forget the `index.ts` re-export for layout primitives.
