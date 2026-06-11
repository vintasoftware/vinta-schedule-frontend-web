/**
 * useUrlState tests.
 *
 * Covers:
 * - Reads the current param, falling back to defaultValue when absent
 * - setValue writes the param via router.replace
 * - setValue(defaultValue) / setValue(null) removes the param
 * - Other existing params are preserved
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const replace = vi.fn();
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/availability',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { useUrlState } from './use-url-state';

describe('useUrlState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = '';
  });

  it('returns the default value when the param is absent', () => {
    const { result } = renderHook(() => useUrlState('tab', 'mine'));
    expect(result.current[0]).toBe('mine');
  });

  it('returns the param value when present', () => {
    currentSearch = 'tab=blocked';
    const { result } = renderHook(() => useUrlState('tab', 'mine'));
    expect(result.current[0]).toBe('blocked');
  });

  it('writes a non-default value via router.replace', () => {
    const { result } = renderHook(() => useUrlState('tab', 'mine'));
    act(() => result.current[1]('blocked'));
    expect(replace).toHaveBeenCalledWith('/availability?tab=blocked');
  });

  it('removes the param when set back to the default value', () => {
    currentSearch = 'tab=blocked';
    const { result } = renderHook(() => useUrlState('tab', 'mine'));
    act(() => result.current[1]('mine'));
    expect(replace).toHaveBeenCalledWith('/availability');
  });

  it('removes the param when set to null', () => {
    currentSearch = 'tab=blocked';
    const { result } = renderHook(() => useUrlState('tab', 'mine'));
    act(() => result.current[1](null));
    expect(replace).toHaveBeenCalledWith('/availability');
  });

  it('preserves other existing params', () => {
    currentSearch = 'week=2';
    const { result } = renderHook(() => useUrlState('tab', 'mine'));
    act(() => result.current[1]('blocked'));
    expect(replace).toHaveBeenCalledWith('/availability?week=2&tab=blocked');
  });
});
