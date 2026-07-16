# AGENTS.md — vinta-schedule-frontend-web

Conventions for agents working in this repo. UI/design rules live in
[DESIGN.md](DESIGN.md) — read it before any visual work. This file covers the
non-visual conventions: stack, commands, structure, and code patterns.

## Stack

- **Next.js 16** (App Router, RSC) + **React 19** + **TypeScript** (strict).
- **Tailwind CSS v4** (tokens in
  `packages/design-system/src/styles/tokens.css`, no separate config).
- **Design system**: workspace package `vinta-schedule-design-system`
  (`packages/design-system/`) — shadcn/ui atoms (new-york style), layout
  primitives, tokens, and its own Storybook. Icons: `lucide-react`.
- **TanStack Query v5** for server state.
- **hey-api** generated OpenAPI clients: `src/client/` (app API) and
  `src/auth-client/` (allauth). **Generated — never hand-edit.**
- **react-hook-form** + **zod** (`@hookform/resolvers/zod`) for forms.
- **Vitest** + **Testing Library** for tests. Two **Storybooks**: app feature
  stories (`@storybook/nextjs-vite`, root `.storybook/`) and design-system
  stories (`@storybook/react-vite`, `packages/design-system/.storybook/`).
- Package manager: **pnpm workspaces** (`pnpm-lock.yaml`, root app +
  `packages/*`).

## Commands

| Task               | Command                                                         |
| ------------------ | --------------------------------------------------------------- |
| Dev server         | `pnpm run dev`                                                  |
| Build              | `pnpm run build`                                                |
| Lint               | `pnpm run lint`                                                 |
| Format check / fix | `pnpm run format` / `pnpm run format:fix`                       |
| Typecheck          | `pnpm run typecheck`                                            |
| Test (all)         | `pnpm run test`                                                 |
| Test (scoped)      | `pnpm vitest run <path-or-pattern>`                             |
| Test (watch)       | `pnpm run test:watch`                                           |
| Storybook (app)    | `pnpm run storybook`                                            |
| Storybook (DS)     | `pnpm run storybook:ds`                                         |
| Regen API client   | `pnpm run openapi-ts` (app) / `pnpm run openapi-ts-auth` (auth) |

**Definition of done for any change:** `pnpm run typecheck`, `pnpm run lint`,
`pnpm run test`, and `pnpm run format` all clean. Add/update a Storybook story for
visual components and a test for logic.

## Structure

```
packages/design-system/ # vinta-schedule-design-system workspace package
  src/
    ui/                 # shadcn/ui atoms (cva variants) + colocated stories
    layout/             # layout primitives (Box, Flex, Stack, Grid…) + index.ts
    lib/utils.ts        # `cn()`
    styles/tokens.css   # design tokens (oklch) + Tailwind theme mapping
    stories/            # foundations story
  .storybook/           # design-system Storybook (react-vite)
src/
  app/                  # Next.js App Router — routes, layouts, route handlers
    auth/…              # auth flow pages (login, signup, onboarding, social…)
    layout.tsx          # root layout: fonts, providers, auth bootstrap
    globals.css         # thin: tailwind + imports package tokens + @source
  components/
    <feature>/          # feature compositions (authentication, home-page, navigation)
  hooks/<domain>/       # data hooks wrapping the generated query client
  lib/                  # auth token storage, fetch interceptors, utils
    utils/index.ts      # shared helpers; re-exports `cn()` from the package
  providers/            # app-level React providers
  client/ auth-client/  # GENERATED OpenAPI clients — do not edit
  stories/              # app-level Storybook stories (page layouts)
.storybook/             # app Storybook (nextjs-vite) — feature stories
```

Path alias: **`@/` → `src/`** (e.g. `@/lib/utils/index`). Design-system imports
use the package specifier: `vinta-schedule-design-system/ui/button`,
`vinta-schedule-design-system/layout`. Inside the package, imports are
relative.

## Patterns

### Data hooks (`src/hooks/<domain>/`)

A hook is a thin wrapper over a generated TanStack Query operation. It spreads
the generated `*Mutation()` / `*Options()` factory, adds cache invalidation, and
returns both an ergonomic async fn and the raw mutation/query object.

```ts
import type { OrganizationWritable } from '@/client';
import { organizationsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const createOrganizationMutation = useMutation({
    ...organizationsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
      });
    },
  });
  const createOrganization = async (body: OrganizationWritable) =>
    createOrganizationMutation.mutateAsync({ body });
  return { createOrganization, createOrganizationMutation };
}
```

- One hook per file, `use-kebab-name.ts`, named export `useCamelName`.
- Import types from `@/client` / `@/auth-client`; operation factories from the
  `@tanstack/react-query.gen` barrel.
- Export a `*_QUERY_KEY` const from query hooks so mutations can invalidate it.
- Add a short comment explaining the _why_ (non-obvious auth/cache behavior).

### Pages (`src/app/**/page.tsx`)

- **Server Component by default.** Fetch with the generated client directly in
  the async component (see `src/app/auth/login/page.tsx`). Degrade gracefully on
  API error — never redirect to the same route (infinite-loop risk).
- Add `'use client'` only when the file needs hooks/state/handlers.
- Keep pages thin: fetch + compose a feature component; put logic/markup in
  `src/components/<feature>/`.
- Dynamic segments: `[param]` folders; route handlers are `route.tsx`.

### Components

- **Layout primitives** (`packages/design-system/src/layout/`): token-prop
  driven, built on `Box`, `forwardRef`, re-exported from `index.ts`. No raw
  utility classes for layout — that's the whole point.
- **UI atoms** (`packages/design-system/src/ui/`): shadcn/ui, variants via
  `cva`, merge classes with `cn()`. Prefer `npx shadcn@latest add <name>` (run
  inside `packages/design-system/`) for stock components, then convert the
  generated `@/…` imports to relative ones.
- **Compositions** (`src/components/<feature>/`): assemble primitives + ui into a
  feature. `'use client'` when interactive; forms use rhf + zod.
- All visual components get a colocated `*.stories.tsx`.

### Tests

- Vitest + Testing Library, jsdom env, globals on (no imports of `describe`/`it`
  needed but existing tests import them explicitly — match the neighbor file).
- Colocate as `*.test.ts(x)` next to the unit. Mock `next/navigation` and
  network (`fetch` / generated client) as in
  `src/app/auth/social/finish-signup/page.test.tsx`.
- `vitest.setup.ts` clears `localStorage` + cookies between tests.

## Hard rules

- **Never edit `src/client/` or `src/auth-client/`** — regenerate instead.
- **No raw hex/rgb, no hand-rolled layout classes** — tokens + primitives (DESIGN.md).
- **Never `git add -A`** — repo root has untracked `.env*`, generated
  `schema*.yml`, and regenerated client output. Stage explicit paths.
- **No `Co-Authored-By` AI trailers** in commits.
- Icon-only controls need `aria-label`.
