'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { createGraphiQLFetcher, type Fetcher } from '@graphiql/toolkit';
import type { GraphiQLProps } from 'graphiql';
// GraphiQL touches `window`/Monaco worker APIs at module scope, so it must
// never render on the server. `next/dynamic(..., { ssr: false })` scopes the
// whole widget (and its ~2500-line CSS bundle) to this one client boundary —
// no other route pays for it, and the docs shell can still prerender the
// credential form around it.
import 'graphiql/style.css';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
import {
  Box,
  Flex,
  HStack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';

const GraphiQL = dynamic(
  async () => {
    // GraphiQL 5 renders with the Monaco editor, which needs its web workers
    // registered on `globalThis.MonacoEnvironment` before the editor mounts —
    // without it Monaco throws "You must define MonacoEnvironment.getWorker".
    // GraphiQL ships that registration for webpack/Turbopack (Next.js);
    // importing it here, inside the client-only dynamic loader and before the
    // widget itself, sets the workers up while keeping it all off the server.
    await import('graphiql/setup-workers/webpack');
    const mod = await import('graphiql');
    return mod.GraphiQL;
  },
  {
    ssr: false,
    loading: () => (
      <Flex
        height={700}
        border
        radius='lg'
        p={4}
        align='center'
        justify='center'
      >
        <Text color='muted-foreground'>Loading explorer…</Text>
      </Flex>
    ),
  }
);

// ---------------------------------------------------------------------------
// Storage: GraphiQL persists query/variable/header/tab state to `localStorage`
// by default. The pasted credential must never reach it, and — as
// defense-in-depth, since GraphiQL's own headers editor is disabled below but
// the storage prop covers ALL of GraphiQL's state, not just headers — nothing
// this widget does should touch the real browser localStorage at all. This
// factory returns an object satisfying `@graphiql/toolkit`'s `Storage`
// interface, backed by an in-memory `Map` that lives only as long as the
// component instance. `window.localStorage` is never referenced.
//
// This redirection is verified (see graphql-explorer.test.tsx) against
// `graphiql@5.2.4` / `@graphiql/react@0.37.7`'s actual internals — a future
// GraphiQL version bump could add a new default plugin with its own storage
// path that bypasses the `storage` prop here, so re-verify the no-localStorage
// guarantee whenever `graphiql` is upgraded.
// ---------------------------------------------------------------------------
function createInMemoryStorage(): NonNullable<GraphiQLProps['storage']> {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
  };
}

export interface GraphqlExplorerProps {
  /** Base URL of the backend API, e.g. `http://localhost:8000`. */
  apiBaseUrl: string;
}

/**
 * Embedded GraphiQL console for `/docs/explorer`.
 *
 * The pasted `<system_user_id>:<token>` credential lives ONLY in this
 * component's React state (`credential`) — it is never written to
 * `localStorage`/`sessionStorage`, never logged, and is wired into outgoing
 * requests solely through the `fetcher`'s `Authorization` header, recreated
 * via `useMemo` whenever the credential changes. GraphiQL's built-in headers
 * editor is disabled (`isHeadersEditorEnabled={false}`) so there is exactly
 * one place a reader can type a credential, and GraphiQL's own persisted
 * state (query text, variables, tabs, theme) is redirected to an in-memory
 * `storage` implementation so none of it — including any header a reader
 * might otherwise have typed into GraphiQL's own editor — ever reaches real
 * browser storage.
 */
export function GraphqlExplorer({ apiBaseUrl }: GraphqlExplorerProps) {
  const [credential, setCredential] = React.useState('');
  const graphqlUrl = `${apiBaseUrl.replace(/\/$/, '')}/graphql/`;

  const fetcher = React.useMemo<Fetcher>(
    () =>
      createGraphiQLFetcher({
        url: graphqlUrl,
        headers: credential.trim()
          ? { Authorization: `Bearer ${credential.trim()}` }
          : {},
        // `createGraphiQLFetcher` falls back to `window.fetch` when `fetch`
        // isn't passed explicitly, and throws if `window` is undefined. This
        // component builds the fetcher during Next's server render pass too
        // (only the inner `<GraphiQL>` widget is client-only) — passing the
        // global `fetch` explicitly keeps construction SSR-safe. The fetcher
        // is still never invoked outside the browser: it's only handed to
        // the dynamically-imported, client-only `<GraphiQL>` below.
        fetch: globalThis.fetch,
      }),
    [graphqlUrl, credential]
  );

  // Stable across the component's lifetime — passing a new object on every
  // render would make GraphiQL treat every keystroke as a fresh session.
  // `useState`'s lazy initializer (not `useRef(...).current`) is the
  // render-safe way to create this once — the eslint react-hooks rule flags
  // reading `ref.current` during render as an impurity.
  const [storage] = React.useState(createInMemoryStorage);

  const handleClear = () => setCredential('');

  return (
    <VStack gap={4} align='stretch'>
      {/* The credential field + note stay at the page reading measure so they
          line up with the copy above; only the editor below runs full width. */}
      <Box mx='auto' width='full' maxWidth={840}>
        <VStack gap={2}>
          <Label htmlFor='graphql-explorer-credential'>
            Authorization credential
          </Label>
          <HStack gap={2}>
            <Input
              id='graphql-explorer-credential'
              type='password'
              autoComplete='new-password'
              data-lpignore='true'
              data-1password-ignore='true'
              placeholder='<system_user_id>:<token>'
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className='font-mono'
              data-testid='explorer-credential-input'
            />
            <Button
              type='button'
              variant='outline'
              onClick={handleClear}
              disabled={!credential}
              data-testid='explorer-clear-token-button'
            >
              <X aria-hidden='true' />
              Clear token
            </Button>
          </HStack>
          <Text size='sm' color='muted-foreground'>
            Sent as{' '}
            <Text as='span' family='mono'>
              Authorization: Bearer {'<value>'}
            </Text>{' '}
            on every request below. Session-only — kept in memory for this tab
            and never written to local or session storage. Reload the page or
            use Clear token to remove it.
          </Text>
        </VStack>
      </Box>

      <Box
        mx='auto'
        width='full'
        maxWidth={1400}
        height={700}
        border
        radius='lg'
        overflow='hidden'
      >
        <GraphiQL
          fetcher={fetcher}
          storage={storage}
          isHeadersEditorEnabled={false}
          defaultEditorToolsVisibility={false}
          shouldPersistHeaders={false}
        />
      </Box>
    </VStack>
  );
}
