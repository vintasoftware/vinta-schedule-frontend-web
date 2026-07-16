---
name: add-storybook-story
description: Add or update a colocated Storybook story (*.stories.tsx) for a component, following this repo's @storybook/nextjs-vite conventions (meta/StoryObj, viewports, themes, fullscreen). Use when the user says "add a story", "put X in Storybook", "document this component in Storybook", "add a Storybook example", or after creating/changing a visual component. NOT for non-visual logic.
---

# Add Storybook Story

Create a colocated `*.stories.tsx` next to the component, matching this repo's
`@storybook/nextjs-vite` setup. Reference stories:
[`box.stories.tsx`](../../../src/components/layout/box.stories.tsx),
[`page-header.stories.tsx`](../../../src/components/layout/page-header.stories.tsx),
[`app-sidebar.stories.tsx`](../../../src/components/layout/app-sidebar.stories.tsx).
See [DESIGN.md](../../../DESIGN.md) §8 (Storybook) for the rules.

## Steps

1. **Create `<component>.stories.tsx`** colocated with the component file.
2. **Meta block** — `satisfies Meta<typeof Component>`, `title: 'Group/Name'`
   (groups in use: `Layout/`, `UI/`, `Components/`…), `tags: ['autodocs']`,
   default `args`, and `argTypes` controls for the key props:

   ```tsx
   import type { Meta, StoryObj } from '@storybook/nextjs-vite';
   import { Thing } from './thing';

   const meta = {
     title: 'UI/Thing',
     component: Thing,
     tags: ['autodocs'],
     args: { variant: 'default', children: 'Thing' },
     argTypes: {
       variant: { control: 'select', options: ['default', 'info', 'success'] },
     },
   } satisfies Meta<typeof Thing>;

   export default meta;
   type Story = StoryObj<typeof meta>;
   ```

3. **Stories** — a `Playground` (empty `{}` uses meta args) plus a gallery story
   that `render`s all variants/states side by side:

   ```tsx
   export const Playground: Story = {};

   export const Variants: Story = {
     render: () => (
       <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
         <Thing variant='default'>default</Thing>
         <Thing variant='info'>info</Thing>
         <Thing variant='success'>success</Thing>
       </div>
     ),
   };
   ```

## Repo-specific conventions (DESIGN.md §8)

- **Full-bleed** layouts/compositions (shells, bars, pages):
  `parameters: { layout: 'fullscreen' }` on the story or meta.
- **Required props**: if the component needs props and you don't supply meta
  `args`, type the story as `StoryObj` (not `StoryObj<typeof meta>`) to avoid
  required-arg type errors — or just supply `args`.
- **Viewports** (configured in [.storybook/preview.tsx](../../../.storybook/preview.tsx)):
  Mobile 375 / Mobile L 430 / Tablet 768 / Laptop 1024 / Desktop 1440. For
  responsive components, add a variant pinned to a small viewport:

  ```tsx
  export const Mobile: Story = {
    globals: { viewport: { value: 'mobile' } },
  };
  ```

- **Themes**: light/dark are wired via `withThemeByClassName` globally — no
  per-story setup needed; just toggle in the toolbar.
- **Tailwind v4 literal-class rule**: only literal class strings get generated.
  `bg-vinta-${n}` won't emit — list classes literally in swatch/foundation stories.

## Verify

- `npm run storybook` and confirm the story renders in light + dark and at the
  mobile viewport (for responsive components).
- `npm run typecheck` + `npm run lint` clean.
- `npm run build-storybook` if you want to confirm a production build passes.

## Don't

- Don't hard-code colors in stories — use tokens / token-bound props.
- Don't forget `layout: 'fullscreen'` for bars/shells/pages (they look broken centered).
- Don't skip the mobile-viewport variant for anything responsive.
