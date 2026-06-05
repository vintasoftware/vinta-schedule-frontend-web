---
name: new-page
description: Scaffold a new Next.js App Router page (route) in this repo following its server-first conventions. Use when the user says "create a page", "add a route", "new screen at /x", "make a /settings page", or asks to add any URL-addressable view under src/app/. NOT for non-route components (use new-composition) or design-system atoms (use new-component).
---

# New Page

Create a route under [`src/app/`](src/app/) that matches this repo's conventions:
server-first, thin pages, data fetched with the generated client, markup pushed
into a feature composition.

## Before writing

1. Read [AGENTS.md](../../../AGENTS.md) (Pages section) and [DESIGN.md](../../../DESIGN.md).
2. Decide the route path → folder under `src/app/`. Dynamic segment = `[param]`
   folder. Confirm the path with the user if ambiguous.
3. Decide **server vs client**:
   - Default **Server Component** — needs to fetch data, no hooks/state/handlers.
   - `'use client'` only if the page itself uses hooks, state, or event handlers.
     Prefer keeping the page a server component and pushing interactivity into a
     `'use client'` composition in `src/components/<feature>/`.

## Steps

1. **Create `src/app/<route>/page.tsx`.** Default export, `PascalCase` name
   ending in `Page`. Keep it thin: fetch + compose.

   Server page that fetches (mirror [`src/app/auth/login/page.tsx`](../../../src/app/auth/login/page.tsx)):

   ```tsx
   import { someOperation } from '@/client';
   import { SettingsView } from '@/components/settings/settings-view';

   export default async function SettingsPage() {
     // Fetch with the generated client. Degrade gracefully on error —
     // never redirect back to this same route (infinite-loop risk).
     const res = await someOperation({ path: { /* … */ } });
     const data = res.data?.status === 200 ? res.data.data : null;

     return <SettingsView data={data} />;
   }
   ```

   Static/simple page:

   ```tsx
   import { PageHeader } from '@/components/layout';

   export default function AboutPage() {
     return <PageHeader title='About' description='…' />;
   }
   ```

2. **Auth gating.** If the page requires onboarding/auth, wrap with the existing
   gate as the home page does — see [`src/app/page.tsx`](../../../src/app/page.tsx)
   (`OnboardingGate`). Don't invent new gating; reuse what exists.

3. **Layout & markup.** Use layout primitives (`PageHeader`, `Stack`, `Container`,
   `Section`) from `@/components/layout`. No raw layout classes. If the view is
   non-trivial or interactive, create the markup as a composition (see
   [new-composition](../new-composition/SKILL.md)) and render it from the page.

4. **Metadata** (optional): export `const metadata: Metadata = { title, description }`
   for static pages, or `generateMetadata` for dynamic ones.

5. **Route handlers** (API/OAuth callbacks) go in `route.tsx`, not `page.tsx` —
   see [`src/app/auth/social/[provider]/callback/route.tsx`](../../../src/app/auth/social/[provider]/callback/route.tsx).

## Verify

- `npm run typecheck` and `npm run lint` clean.
- Visit the route via `npm run dev` (or `/run` the app) and confirm it renders.
- Add a test if the page has branching logic (mirror
  [`page.test.tsx`](../../../src/app/auth/social/finish-signup/page.test.tsx)).

## Don't

- Don't put fetch logic or heavy JSX inline in a big page — extract a composition.
- Don't add `'use client'` just to fetch; server components fetch directly.
- Don't redirect a page back to its own route on API failure.
