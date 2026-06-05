# Vinta Schedule — Design & Layout Guide

Rules for building UI in this app. Source of truth for the design system is the
**Vinta Schedule Design System** (tokens mirrored into `src/app/globals.css`).
Follow these conventions for every component, page, and Storybook story.

---

## 1. Tokens, not magic values

- Colors, radius, shadow, spacing, and type live as CSS variables in
  [`src/app/globals.css`](src/app/globals.css): three layers — primitive scales
  (`--vinta-*`, `--slate-*`, `--teal-*`), semantic shadcn tokens
  (`--background`, `--primary`, `--border`, …), and type/radius/shadow.
- Colors are `oklch`. Light/dark handled by the `.dark` class overrides.
- Never hard-code hex/rgb in components. Use a token: a Tailwind utility
  (`bg-primary`, `text-muted-foreground`, `border-border`) or a primitive prop
  (`bg='card'`, `color='muted-foreground'`).
- Tokens are exposed to Tailwind via `@theme inline`. Brand/accent utilities
  like `bg-vinta-600`, `text-teal-700` exist; the full `--vinta-*` and
  `--teal-*` ramps are mapped.

## 2. Compose layout with primitives, not raw divs + classes

Layout primitives live in [`src/components/layout/`](src/components/layout/) and
are driven by **props that resolve to tokens** — the goal is composing UI "like
legos" without writing layout classes.

- Primitives: `Box`, `Flex`, `HStack`, `VStack`, `Stack`, `Grid`, `GridItem`,
  `Center`, `Container`, `Section`, `Divider`, `Spacer`, `Text`, `Heading`.
- Spacing props use the 4px scale `Space = 0|1|2|3|4|5|6|8|10|12|16|20|24`
  (see [`layout-style.ts`](src/components/layout/layout-style.ts)). E.g.
  `<HStack gap={4} px={6} py={3}>`, `<Box radius='lg' shadow='md' bg='card'>`.
- Prefer `<VStack gap={4}>` over `<div className="flex flex-col gap-4">`.
- `className` is an escape hatch for things the props don't cover (one-off
  borders, text sizing, responsive variants). Don't rebuild layout in classes.

## 3. Spacing in compositions → className, not inline-style gap

Inline `style` gap on the primitives has rendering quirks in our Storybook
environment. In the **composition** components (navbar, sidebar, topbar, shell)
use Tailwind spacing classes (`gap-2.5`, `px-5`, `mt-3`) for the structural
spacing instead of relying on a primitive's inline `gap` prop. Primitives are
fine for page/content composition; bars and brand rows use classes.

## 4. Responsive — container queries over viewport

**Default to Tailwind container queries (`@container`) when a component should
react to its own container width, not the viewport.** Viewport breakpoints
(`sm:`, `md:`, `lg:`) are only for things that are genuinely viewport-bound.

- Mark a container with `@container/<name>`; query it with `@<size>/<name>:`.
- Named containers in use: `@container/app` (shell), `@container/content` (page
  body), `@container/topbar`, `@container/nav`, `@container/pageheader`,
  `@container/authcard`.
- Why: e.g. the dashboard grid keys off `@container/content`, so collapsing the
  sidebar widens the body → more columns. A viewport breakpoint can't see that.

Tailwind v4 container sizes (built-in, no plugin):

| name | width | name | width | name | width |
| ---- | ----- | ---- | ----- | ---- | ----- |
| @3xs | 256   | @sm  | 384   | @3xl | 768   |
| @2xs | 288   | @md  | 448   | @4xl | 896   |
| @xs  | 320   | @lg  | 512   | @5xl | 1024  |
|      |       | @xl  | 576   | @6xl | 1152  |
|      |       | @2xl | 672   | @7xl | 1280  |

## 5. Composition responsive behavior (current contracts)

- **AppShell** (`@container/app`): sidebar docks left above **@4xl (896px)**;
  below, it collapses into a left `Sheet` drawer. Hamburger is injected into the
  topbar's `leading` slot (or a thin mobile bar when there's no topbar). Page
  body is `@container/content`.
- **AppTopbar** (`@container/topbar`): below **@3xl** the search field becomes an
  icon button that opens a full-width search overlay (autofocused, `X`/Escape
  closes); a consumer action should collapse to an icon button too. The sync
  badge stays visible but drops its text label below **@xl** (icon only).
- **Navbar** (`@container/nav`): links dock inline above **@3xl**, actions above
  **@md**; below, they collapse into a hamburger `Sheet` menu.
- **AppSidebar**: brand row and nav use class-based spacing; non-first nav groups
  get extra top margin (`mt-3`) above their section label.
- **PageHeader** (`@container/pageheader`): title/actions row goes from stacked
  to side-by-side at `@lg`.
- **AuthLayout**: `single` (448px) / `two-column` (768px). Two-column card splits
  via `@container/authcard` at `@xl`.

## 6. Tailwind v4 gotchas

- Only **literal** class strings are generated. `bg-vinta-${n}` will NOT emit —
  list the classes literally (e.g. in foundation/swatch stories).
- `@import 'tailwindcss';` + `@theme inline { … }`. PostCSS config uses the
  object form for the Vite/Storybook builder.

## 7. Components & icons

- UI components are shadcn/ui (new-york) under
  [`src/components/ui/`](src/components/ui/). Icons are `lucide-react`.
- `Button` sizes: `xs | sm | default | lg | xl | icon`. Use `size='icon'` for
  square icon buttons; pass `aria-label` when icon-only.
- `Badge` variants include soft `info | success | warning | danger | teal` and a
  `BadgeDot`. `SchedulingChip` has `status='booked|available|tentative|conflict'`.

## 8. Storybook

- Stories: `*.stories.tsx` colocated with components. Framework is
  `@storybook/nextjs-vite`.
- Full-bleed layouts/compositions: `parameters: { layout: 'fullscreen' }`.
- Theme switch via `withThemeByClassName` (light/dark) in
  [`.storybook/preview.tsx`](.storybook/preview.tsx).
- **Viewports** are configured in `preview.tsx`
  (`parameters.viewport.options`): Mobile 375 / Mobile L 430 / Tablet 768 /
  Laptop 1024 / Desktop 1440. A story can default to one with
  `globals: { viewport: { value: 'mobile' } }`.
- When a component requires props, type the story as `StoryObj` (not
  `StoryObj<typeof meta>`) to avoid required-arg errors, or supply `args`.

## 9. Checklist before finishing UI work

- [ ] No raw hex/rgb — tokens only.
- [ ] Layout via primitives + props; `className` only for escape hatches.
- [ ] Responsive via `@container` where the element reacts to its container.
- [ ] Icon-only controls have `aria-label`.
- [ ] Story added/updated, with a mobile viewport variant for responsive UI.
- [ ] `npx tsc --noEmit` and `npx eslint <files>` clean.
