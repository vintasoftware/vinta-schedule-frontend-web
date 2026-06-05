import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DataTable } from './data-table';
import type { DataTableColumn, DataTableQuery } from './types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Person {
  id: number;
  name: string;
  email: string;
}

const FIXTURE_DATA: Person[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
];

const COLUMNS: DataTableColumn<Person>[] = [
  {
    accessorKey: 'name',
    id: 'name',
    header: 'Name',
    enableSorting: true,
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: 'email',
    id: 'email',
    header: 'Email',
    enableSorting: false,
    cell: ({ row }) => row.original.email,
  },
];

const DEFAULT_QUERY: DataTableQuery = {
  page: 1,
  pageSize: 20,
  ordering: null,
  search: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTable(
  overrides: Partial<{
    data: Person[];
    query: DataTableQuery;
    totalCount: number;
    isLoading: boolean;
    emptyState: React.ReactNode;
    onQueryChange: (q: DataTableQuery) => void;
  }> = {}
) {
  const onQueryChange = overrides.onQueryChange ?? vi.fn();
  return render(
    <DataTable<Person>
      data={overrides.data ?? FIXTURE_DATA}
      columns={COLUMNS}
      query={overrides.query ?? DEFAULT_QUERY}
      onQueryChange={onQueryChange}
      totalCount={overrides.totalCount ?? FIXTURE_DATA.length}
      isLoading={overrides.isLoading ?? false}
      emptyState={overrides.emptyState}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataTable', () => {
  it('renders rows from data', () => {
    renderTable();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    renderTable();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  describe('loading state', () => {
    it('renders skeleton rows when isLoading is true', () => {
      renderTable({ isLoading: true, data: [], skeletonRows: 3 } as Parameters<
        typeof renderTable
      >[0]);
      // Skeleton rows are aria-hidden; find the wrappers via the container
      const skeletons = document.querySelectorAll('[aria-hidden]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render data rows while loading', () => {
      renderTable({ isLoading: true, data: FIXTURE_DATA });
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders default empty message when data is empty', () => {
      renderTable({ data: [], totalCount: 0 });
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });

    it('renders a custom emptyState slot', () => {
      renderTable({
        data: [],
        totalCount: 0,
        emptyState: <span>Nothing here</span>,
      });
      expect(screen.getByText('Nothing here')).toBeInTheDocument();
    });
  });

  describe('sort header', () => {
    it('calls onQueryChange with ordering when a sortable header is clicked', () => {
      const onQueryChange = vi.fn();
      renderTable({ onQueryChange });

      // "Name" column has enableSorting: true
      const nameHeader = screen.getByText('Name').closest('th');
      expect(nameHeader).toBeTruthy();
      fireEvent.click(nameHeader!);

      expect(onQueryChange).toHaveBeenCalledOnce();
      const call = onQueryChange.mock.calls[0][0] as DataTableQuery;
      // First click → ascending (no prefix)
      expect(call.ordering).toBe('name');
      // Should reset page to 1
      expect(call.page).toBe(1);
    });

    it('toggles to descending ordering on second click', () => {
      const onQueryChange = vi.fn();
      // Start with ascending ordering already set
      renderTable({
        onQueryChange,
        query: { ...DEFAULT_QUERY, ordering: 'name' },
      });

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);

      const call = onQueryChange.mock.calls[0][0] as DataTableQuery;
      expect(call.ordering).toBe('-name');
    });

    it('clears ordering on third click (cycle back through asc → desc → clear)', () => {
      const onQueryChange = vi.fn();
      renderTable({
        onQueryChange,
        query: { ...DEFAULT_QUERY, ordering: '-name' },
      });

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);

      const call = onQueryChange.mock.calls[0][0] as DataTableQuery;
      // TanStack cycles desc → unsorted (null ordering)
      expect(call.ordering).toBeNull();
    });

    it('non-sortable column header does NOT call onQueryChange', () => {
      const onQueryChange = vi.fn();
      renderTable({ onQueryChange });

      const emailHeader = screen.getByText('Email').closest('th');
      fireEvent.click(emailHeader!);

      expect(onQueryChange).not.toHaveBeenCalled();
    });
  });

  describe('search input', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onQueryChange after the debounce delay', async () => {
      const onQueryChange = vi.fn();
      renderTable({ onQueryChange });

      const input = screen.getByRole('textbox', { name: /search/i });
      fireEvent.change(input, { target: { value: 'alice' } });

      // Not called yet (debouncing)
      expect(onQueryChange).not.toHaveBeenCalled();

      // Advance past debounce delay (default 300 ms)
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(onQueryChange).toHaveBeenCalledOnce();
      const call = onQueryChange.mock.calls[0][0] as DataTableQuery;
      expect(call.search).toBe('alice');
      expect(call.page).toBe(1);
    });

    it('does not call onQueryChange before the debounce delay', () => {
      const onQueryChange = vi.fn();
      renderTable({ onQueryChange });

      const input = screen.getByRole('textbox', { name: /search/i });
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'al' } });
      fireEvent.change(input, { target: { value: 'ali' } });

      vi.advanceTimersByTime(100);
      expect(onQueryChange).not.toHaveBeenCalled();
    });

    it('debounces rapid keystrokes to a single onQueryChange call', async () => {
      const onQueryChange = vi.fn();
      renderTable({ onQueryChange });

      const input = screen.getByRole('textbox', { name: /search/i });
      // Type quickly
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'al' } });
      fireEvent.change(input, { target: { value: 'ali' } });
      fireEvent.change(input, { target: { value: 'alic' } });
      fireEvent.change(input, { target: { value: 'alice' } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Only one call with the final value
      expect(onQueryChange).toHaveBeenCalledOnce();
      const call = onQueryChange.mock.calls[0][0] as DataTableQuery;
      expect(call.search).toBe('alice');
    });

    it('passes null when search is cleared', () => {
      const onQueryChange = vi.fn();
      renderTable({
        onQueryChange,
        query: { ...DEFAULT_QUERY, search: 'alice' },
      });

      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearBtn);

      // Clear button fires immediately (no debounce) — check synchronously
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: null, page: 1 })
      );
    });
  });

  describe('pagination', () => {
    it('shows the item count summary', () => {
      renderTable({
        data: FIXTURE_DATA,
        query: { ...DEFAULT_QUERY, page: 1, pageSize: 3 },
        totalCount: 10,
      });
      expect(screen.getByText('Showing 1–3 of 10')).toBeInTheDocument();
    });

    it('shows "No results" when totalCount is 0', () => {
      renderTable({ data: [], totalCount: 0 });
      expect(screen.getByText('No results')).toBeInTheDocument();
    });
  });
});
