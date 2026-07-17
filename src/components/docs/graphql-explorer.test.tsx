/**
 * GraphqlExplorer — the embedded GraphiQL console.
 *
 * `graphiql` and `@graphiql/toolkit` are mocked so the test never mounts the
 * real widget (Monaco editor doesn't run in jsdom) and never hits the
 * network. The mocks capture exactly what the component would hand to the
 * real APIs: the fetcher options `createGraphiQLFetcher` is called with, and
 * the props passed to `<GraphiQL>` (including the `storage` object) — enough
 * to prove the Authorization header wiring and the no-localStorage guarantee
 * without needing the real dependency to render.
 */
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GraphqlExplorer } from './graphql-explorer';

const createGraphiQLFetcherMock = vi.fn<
  (options: CapturedFetcherOptions) => ReturnType<typeof vi.fn>
>(() => vi.fn());

vi.mock('@graphiql/toolkit', () => ({
  createGraphiQLFetcher: (options: CapturedFetcherOptions) =>
    createGraphiQLFetcherMock(options),
}));

const graphiQLMock = vi.fn<(props: CapturedGraphiQLProps) => ReactNode>(() => (
  <div data-testid='graphiql-mock' />
));

vi.mock('graphiql', () => ({
  GraphiQL: (props: CapturedGraphiQLProps) => graphiQLMock(props),
}));

vi.mock('graphiql/style.css', () => ({}));

interface CapturedFetcherOptions {
  url: string;
  headers?: Record<string, string>;
}

function latestFetcherOptions(): CapturedFetcherOptions {
  const call = createGraphiQLFetcherMock.mock.calls.at(-1);
  if (!call) throw new Error('createGraphiQLFetcher was never called');
  return call[0] as CapturedFetcherOptions;
}

interface CapturedGraphiQLProps {
  storage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  isHeadersEditorEnabled?: boolean;
  shouldPersistHeaders?: boolean;
}

async function latestGraphiQLProps(): Promise<CapturedGraphiQLProps> {
  await waitFor(() => expect(graphiQLMock).toHaveBeenCalled());
  const call = graphiQLMock.mock.calls.at(-1);
  if (!call) throw new Error('GraphiQL was never rendered');
  return call[0] as CapturedGraphiQLProps;
}

describe('GraphqlExplorer', () => {
  beforeEach(() => {
    createGraphiQLFetcherMock.mockClear();
    graphiQLMock.mockClear();
    localStorage.clear();
  });

  it('renders the credential input and a clear-token control', async () => {
    render(<GraphqlExplorer apiBaseUrl='http://localhost:8000' />);

    expect(
      screen.getByLabelText('Authorization credential')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear token' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('graphiql-mock')).toBeInTheDocument()
    );
  });

  it('sends no Authorization header before a credential is pasted', async () => {
    render(<GraphqlExplorer apiBaseUrl='http://localhost:8000' />);

    await waitFor(() => expect(createGraphiQLFetcherMock).toHaveBeenCalled());
    const options = latestFetcherOptions();
    expect(options.url).toBe('http://localhost:8000/graphql/');
    expect(options.headers).toEqual({});
  });

  it('wires the pasted credential into the fetcher Authorization header', async () => {
    const user = userEvent.setup();
    render(<GraphqlExplorer apiBaseUrl='http://localhost:8000' />);

    const input = screen.getByLabelText('Authorization credential');
    await user.type(input, '42:sk_live_abc123');

    await waitFor(() =>
      expect(latestFetcherOptions().headers).toEqual({
        Authorization: 'Bearer 42:sk_live_abc123',
      })
    );
  });

  it('clears the credential and the Authorization header on "Clear token"', async () => {
    const user = userEvent.setup();
    render(<GraphqlExplorer apiBaseUrl='http://localhost:8000' />);

    const input = screen.getByLabelText(
      'Authorization credential'
    ) as HTMLInputElement;
    await user.type(input, '42:sk_live_abc123');
    await waitFor(() =>
      expect(latestFetcherOptions().headers).toEqual({
        Authorization: 'Bearer 42:sk_live_abc123',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Clear token' }));

    expect(input.value).toBe('');
    await waitFor(() => expect(latestFetcherOptions().headers).toEqual({}));
  });

  it('never writes the pasted credential to localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    render(<GraphqlExplorer apiBaseUrl='http://localhost:8000' />);

    const input = screen.getByLabelText('Authorization credential');
    await user.type(input, '42:sk_live_abc123');
    await waitFor(() =>
      expect(latestFetcherOptions().headers).toEqual({
        Authorization: 'Bearer 42:sk_live_abc123',
      })
    );

    // Nothing the component did while the credential was live touched real
    // localStorage at all.
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);

    setItemSpy.mockRestore();
  });

  it('gives GraphiQL an in-memory storage that never reaches real localStorage', async () => {
    render(<GraphqlExplorer apiBaseUrl='http://localhost:8000' />);

    const props = await latestGraphiQLProps();
    expect(props.storage).toBeDefined();
    expect(props.isHeadersEditorEnabled).toBe(false);
    expect(props.shouldPersistHeaders).toBe(false);

    // Simulate GraphiQL persisting its own state (query/variables/tabs) —
    // this is the mechanism that would leak the header if a real
    // localStorage-backed Storage were passed instead.
    props.storage?.setItem('graphiql:query', 'query { me { id } }');

    expect(props.storage?.getItem('graphiql:query')).toBe(
      'query { me { id } }'
    );
    expect(localStorage.getItem('graphiql:query')).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
