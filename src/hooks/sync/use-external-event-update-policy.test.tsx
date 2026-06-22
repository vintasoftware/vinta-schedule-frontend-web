import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useExternalEventUpdatePolicy,
  DEFAULT_EXTERNAL_EVENT_UPDATE_POLICY,
} from './use-external-event-update-policy';
import * as currentOrgModule from '@/hooks/organizations/use-current-organization';
import * as tanstackModule from '@/client/@tanstack/react-query.gen';

// Partial mocks cast to the real return/param types so `tsc` + eslint are happy
// without restating the full generated shapes.
type CurrentOrgReturn = ReturnType<
  typeof currentOrgModule.useCurrentOrganization
>;
type PartialUpdateMutation =
  typeof tanstackModule.organizationsPartialUpdateMutation;

function mockOrg(orgFields: Record<string, unknown> | null) {
  vi.spyOn(currentOrgModule, 'useCurrentOrganization').mockReturnValue({
    isOnboarded: orgFields !== null,
    organization: orgFields,
    membership: orgFields ? { organization: orgFields } : null,
  } as unknown as CurrentOrgReturn);
}

// The hook spreads organizationsPartialUpdateMutation() (which supplies the
// mutationFn) into useMutation, so we mock the mutationFn and assert on the
// variables it receives.
function mockMutation() {
  const mutationFn = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(
    tanstackModule,
    'organizationsPartialUpdateMutation'
  ).mockImplementation(
    vi.fn().mockReturnValue({ mutationFn }) as unknown as PartialUpdateMutation
  );
  return mutationFn;
}

function renderPolicyHook() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useExternalEventUpdatePolicy(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useExternalEventUpdatePolicy', () => {
  it('reads the policy from the current organization', () => {
    mockOrg({
      id: 123,
      name: 'Test Org',
      external_event_update_policy: 'allow',
    });
    mockMutation();

    const { result } = renderPolicyHook();

    expect(result.current.policy).toBe('allow');
    expect(result.current.organizationId).toBe(123);
    expect(result.current.isReady).toBe(true);
  });

  it('falls back to the default when the org has no policy set', () => {
    mockOrg({ id: 123, name: 'Test Org' });
    mockMutation();

    const { result } = renderPolicyHook();

    expect(result.current.policy).toBe(DEFAULT_EXTERNAL_EVENT_UPDATE_POLICY);
  });

  it('coerces an unexpected policy value to the default', () => {
    mockOrg({
      id: 123,
      name: 'Test Org',
      external_event_update_policy: 'bogus',
    });
    mockMutation();

    const { result } = renderPolicyHook();

    expect(result.current.policy).toBe(DEFAULT_EXTERNAL_EVENT_UPDATE_POLICY);
  });

  it('PATCHes the organization with the chosen policy', async () => {
    mockOrg({
      id: 123,
      name: 'Test Org',
      external_event_update_policy: 'allow',
    });
    const mutationFn = mockMutation();

    const { result } = renderPolicyHook();

    await result.current.saveExternalEventUpdatePolicy('forbidden');

    // useMutation passes a context object as the 2nd arg; assert on the vars.
    expect(mutationFn.mock.calls[0][0]).toEqual({
      path: { id: '123' },
      body: { external_event_update_policy: 'forbidden' },
    });
  });

  it('throws when the organization is not loaded', async () => {
    mockOrg(null);
    mockMutation();

    const { result } = renderPolicyHook();

    expect(result.current.isReady).toBe(false);
    await expect(
      result.current.saveExternalEventUpdatePolicy('allow')
    ).rejects.toThrow('Organization not loaded');
  });
});
