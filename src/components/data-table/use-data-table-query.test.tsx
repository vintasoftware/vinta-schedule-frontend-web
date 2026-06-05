import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataTableQuery } from './use-data-table-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const push = vi.fn();
const replace = vi.fn();

// Mutable URL state — shared across all mock calls in a single test.
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/test',
  useSearchParams: () => mockSearchParams,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderQueryHook(options?: Parameters<typeof useDataTableQuery>[0]) {
  return renderHook(() => useDataTableQuery(options));
}

// ---------------------------------------------------------------------------
// Tests — no prefix (default backward-compatible behavior)
// ---------------------------------------------------------------------------

describe('useDataTableQuery (no prefix)', () => {
  it('reads page from ?page param', () => {
    mockSearchParams = new URLSearchParams('page=3');
    const { result } = renderQueryHook();
    expect(result.current.query.page).toBe(3);
  });

  it('reads pageSize from ?page_size param', () => {
    mockSearchParams = new URLSearchParams('page_size=50');
    const { result } = renderQueryHook();
    expect(result.current.query.pageSize).toBe(50);
  });

  it('reads ordering from ?ordering param', () => {
    mockSearchParams = new URLSearchParams('ordering=-email');
    const { result } = renderQueryHook();
    expect(result.current.query.ordering).toBe('-email');
  });

  it('reads search from ?search param', () => {
    mockSearchParams = new URLSearchParams('search=alice');
    const { result } = renderQueryHook();
    expect(result.current.query.search).toBe('alice');
  });

  it('defaults to page 1 when ?page is absent', () => {
    mockSearchParams = new URLSearchParams();
    const { result } = renderQueryHook();
    expect(result.current.query.page).toBe(1);
  });

  it('defaults to pageSize 20 when ?page_size is absent', () => {
    mockSearchParams = new URLSearchParams();
    const { result } = renderQueryHook();
    expect(result.current.query.pageSize).toBe(20);
  });

  it('setPage calls router.push with ?page=N', () => {
    mockSearchParams = new URLSearchParams();
    push.mockClear();
    const { result } = renderQueryHook();
    act(() => {
      result.current.setPage(5);
    });
    expect(push).toHaveBeenCalledWith('/test?page=5');
  });

  it('setSearch calls router.push with ?search=value&page=1', () => {
    mockSearchParams = new URLSearchParams('page=3');
    push.mockClear();
    const { result } = renderQueryHook();
    act(() => {
      result.current.setSearch('bob');
    });
    expect(push).toHaveBeenCalledWith(expect.stringContaining('search=bob'));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('page=1'));
  });
});

// ---------------------------------------------------------------------------
// Tests — with prefix (namespaced URL keys)
// ---------------------------------------------------------------------------

describe('useDataTableQuery (prefix="inv")', () => {
  it('reads page from ?inv_page param', () => {
    mockSearchParams = new URLSearchParams('inv_page=2');
    const { result } = renderQueryHook({ prefix: 'inv' });
    expect(result.current.query.page).toBe(2);
  });

  it('does NOT read the unprefixed ?page param', () => {
    // Unprefixed page=7 must not contaminate the prefixed table.
    mockSearchParams = new URLSearchParams('page=7');
    const { result } = renderQueryHook({ prefix: 'inv' });
    expect(result.current.query.page).toBe(1); // default
  });

  it('reads pageSize from ?inv_page_size param', () => {
    mockSearchParams = new URLSearchParams('inv_page_size=50');
    const { result } = renderQueryHook({ prefix: 'inv' });
    expect(result.current.query.pageSize).toBe(50);
  });

  it('reads ordering from ?inv_ordering param', () => {
    mockSearchParams = new URLSearchParams('inv_ordering=-email');
    const { result } = renderQueryHook({ prefix: 'inv' });
    expect(result.current.query.ordering).toBe('-email');
  });

  it('reads search from ?inv_search param', () => {
    mockSearchParams = new URLSearchParams('inv_search=carol');
    const { result } = renderQueryHook({ prefix: 'inv' });
    expect(result.current.query.search).toBe('carol');
  });

  it('setPage calls router.push with ?inv_page=N', () => {
    mockSearchParams = new URLSearchParams();
    push.mockClear();
    const { result } = renderQueryHook({ prefix: 'inv' });
    act(() => {
      result.current.setPage(3);
    });
    expect(push).toHaveBeenCalledWith('/test?inv_page=3');
  });

  it('setSearch calls router.push with ?inv_search=value and resets inv_page to 1', () => {
    mockSearchParams = new URLSearchParams('inv_page=4');
    push.mockClear();
    const { result } = renderQueryHook({ prefix: 'inv' });
    act(() => {
      result.current.setSearch('dave');
    });
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining('inv_search=dave')
    );
    expect(push).toHaveBeenCalledWith(expect.stringContaining('inv_page=1'));
  });

  it('prefixed and unprefixed tables do not contaminate each other', () => {
    // Both tables share the same URL; prefixed keys must remain independent.
    mockSearchParams = new URLSearchParams('page=5&inv_page=2');

    const { result: teamResult } = renderHook(() => useDataTableQuery());
    const { result: invResult } = renderHook(() =>
      useDataTableQuery({ prefix: 'inv' })
    );

    expect(teamResult.current.query.page).toBe(5);
    expect(invResult.current.query.page).toBe(2);
  });
});
