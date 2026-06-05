# AGENTS.md — vinta-schedule-frontend-web

Conventions for agents working in this repo. UI/design rules live in
[DESIGN.md](DESIGN.md) — read it before any visual work. This file covers the
non-visual conventions: stack, commands, structure, and code patterns.

## Stack

- **Next.js 16** (App Router, RSC) + **React 19** + **TypeScript** (strict).
- **Tailwind CSS v4** (tokens in `src/app/globals.css`, no separate config).
- **shadcn/ui** (new-york style) under `src/components/ui/`. Icons: `lucide-react`.
- **TanStack Query v5** for server state.
- **hey-api** generated OpenAPI clients: `src/client/` (app API) and
  `src/auth-client/` (allauth). **Generated — never hand-edit.**
- **react-hook-form** + **zod** (`@hookform/resolvers/zod`) for forms.
- **Vitest** + **Testing Library** for tests. **Storybook** (`@storybook/nextjs-vite`).
- Package manager: **npm** (`package-lock.json`).

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Format check / fix | `npm run format` / `npm run format:fix` |
| Typecheck | `npm run typecheck` |
| Test (all) | `npm run test` |
| Test (scoped) | `npm run test -- <path-or-pattern>` |
| Test (watch) | `npm run test:watch` |
| Storybook | `npm run storybook` |
| Regen API client | `npm run openapi-ts` (app) / `npm run openapi-ts-auth` (auth) |

**Definition of done for any change:** `npm run typecheck`, `npm run lint`,
`npm run test`, and `npm run format` all clean. Add/update a Storybook story for
visual components and a test for logic.

## Structure

```
src/
  app/                  # Next.js App Router — routes, layouts, route handlers
    auth/…              # auth flow pages (login, signup, onboarding, social…)
    layout.tsx          # root layout: fonts, providers, auth bootstrap
    globals.css         # design tokens (oklch) + Tailwind theme
  components/
    ui/                 # shadcn/ui atoms (cva variants) + colocated stories
    layout/             # layout primitives (Box, Flex, Stack, Grid…) + index.ts
    <feature>/          # feature compositions (authentication, home-page, navigation)
  hooks/<domain>/       # data hooks wrapping the generated query client
  lib/                  # auth token storage, fetch interceptors, utils
    utils/index.ts      # `cn()` and shared helpers
  providers/            # app-level React providers
  client/ auth-client/  # GENERATED OpenAPI clients — do not edit
  stories/              # standalone Storybook docs/foundation stories
```

Path alias: **`@/` → `src/`** (e.g. `@/components/ui/button`, `@/lib/utils/index`).

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
      queryClient.invalidateQueries({ queryKey: CURRENT_ORGANIZATION_QUERY_KEY });
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
- Add a short comment explaining the *why* (non-obvious auth/cache behavior).

### Pages (`src/app/**/page.tsx`)

- **Server Component by default.** Fetch with the generated client directly in
  the async component (see `src/app/auth/login/page.tsx`). Degrade gracefully on
  API error — never redirect to the same route (infinite-loop risk).
- Add `'use client'` only when the file needs hooks/state/handlers.
- Keep pages thin: fetch + compose a feature component; put logic/markup in
  `src/components/<feature>/`.
- Dynamic segments: `[param]` folders; route handlers are `route.tsx`.

### Components

- **Layout primitives** (`src/components/layout/`): token-prop driven, built on
  `Box`, `forwardRef`, re-exported from `index.ts`. No raw utility classes for
  layout — that's the whole point.
- **UI atoms** (`src/components/ui/`): shadcn/ui, variants via `cva`, merge
  classes with `cn()`. Prefer `npx shadcn@latest add <name>` for stock components.
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
