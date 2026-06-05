---
name: new-composition
description: Scaffold a feature composition — a component assembled from layout primitives + ui atoms under src/components/<feature>/, like a form, card view, navbar, or section. Use when the user says "build a <feature> component", "create a form for X", "add a settings panel/section", "make a <thing> view", or assembles existing atoms into something larger. NOT for design-system atoms (use new-component) or full routes (use new-page).
---

# New Composition

A composition is a feature-level component that assembles layout primitives and
ui atoms into something a page renders. Lives in
[`src/components/<feature>/`](src/components/) (e.g. `authentication`,
`home-page`, or a new feature folder). Examples:
[`login-form.tsx`](../../../src/components/authentication/login-form.tsx),
[`marketing-home.tsx`](../../../src/components/home-page/marketing-home.tsx),
[`page-header.tsx`](../../../src/components/layout/page-header.tsx).

## Before writing

1. Read [DESIGN.md](../../../DESIGN.md) and [AGENTS.md](../../../AGENTS.md).
2. **Inventory what already exists** — don't rebuild atoms:
   - Layout primitives: `@/components/layout` (`Box`, `Stack`, `HStack`,
     `VStack`, `Grid`, `Container`, `Section`, `PageHeader`, `Heading`, `Text`…).
   - ui atoms: `@/components/ui` (`Button`, `Card`, `Input`, `Form`, `Badge`,
     `Alert`, `Dialog`…). If a needed atom is missing, create it first via
     [new-component](../new-component/SKILL.md).
3. Decide **server vs client**: add `'use client'` only if it uses hooks, state,
   or event handlers. Presentational compositions stay server components.
4. Pick the feature folder + file name `kebab-name.tsx`.

## Structure

Assemble from primitives + atoms — no raw layout divs/classes:

```tsx
'use client'; // only if interactive

import { Stack, HStack, Heading, Text } from '@/components/layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface SettingsPanelProps {
  title: string;
  onSave: () => void;
}

export function SettingsPanel({ title, onSave }: SettingsPanelProps) {
  return (
    <Card>
      <Stack gap={4} p={6}>
        <Heading level={2} size='xl'>
          {title}
        </Heading>
        <Text color='muted-foreground'>…</Text>
        <HStack gap={2} justify='end'>
          <Button variant='ghost'>Cancel</Button>
          <Button onClick={onSave}>Save</Button>
        </HStack>
      </Stack>
    </Card>
  );
}
```

### If it has a form

Use react-hook-form + zod with the `Form*` primitives, mirroring
[`login-form.tsx`](../../../src/components/authentication/login-form.tsx):
`useForm({ resolver: zodResolver(schema) })`, `FormField` / `FormItem` /
`FormLabel` / `FormControl` / `FormMessage`. Define the zod schema at module
scope. Surface API errors with `Alert`.

### If it fetches/mutates data

Don't call the generated client directly — use a data hook from
`@/hooks/<domain>/` (create one via [new-hook](../new-hook/SKILL.md) if missing).
Read `isPending` / `error` off the returned mutation/query for UI state.

## Conventions

- Named export (compositions don't default-export, unlike pages). Match the
  neighbor file if it differs (`login-form` default-exports — follow local style).
- Props typed with an exported `*Props` interface.
- Spacing in structural bars/shells: Tailwind classes (DESIGN.md §3); page/content
  composition: primitive `gap`/padding props are fine.
- Responsive via `@container` queries where the component reacts to its own width.
- Icon-only controls: `aria-label`.

## After

1. **Add a colocated story** `kebab-name.stories.tsx` — see
   [add-storybook-story](../add-storybook-story/SKILL.md). Use
   `parameters: { layout: 'fullscreen' }` for full-bleed compositions and a
   mobile-viewport variant for responsive ones.
2. **Test** interactive logic with Vitest + Testing Library (mock `next/navigation`
   and the network like the auth tests).
3. `npm run typecheck` + `npm run lint` + `npm run format` clean; eyeball in
   `npm run storybook`.

## Don't

- Don't reach for raw `<div className="flex …">` — compose primitives.
- Don't call the generated API client from the component — go through a hook.
- Don't hard-code colors.
