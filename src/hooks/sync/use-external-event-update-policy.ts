import type {
  PatchedOrganizationWritable,
  ExternalEventUpdatePolicyEnum,
} from '@/client';
import { organizationsPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CURRENT_ORGANIZATION_QUERY_KEY,
  useCurrentOrganization,
} from '@/hooks/organizations/use-current-organization';

// ---------------------------------------------------------------------------
// useExternalEventUpdatePolicy
//
// Reads the current organization's external_event_update_policy and provides a
// mutation to update it via PATCH /organizations/{id}/ (the same endpoint the
// rooms-sync config uses — there is no dedicated settings endpoint).
//
// The policy controls how the app responds to inbound edits / deletions of
// synced events coming from external providers (e.g. Google Calendar):
//  - allow          → apply inbound edits directly.
//  - change_request → route edits / deletions into the approval workflow
//                     (surfaced on the /change-requests screen). This is the
//                     backend default.
//  - forbidden      → auto-undo inbound edits / deletions on the provider.
//
// The org id is derived from the current organization; on success we
// invalidate the current-organization query so the org reloads with the new
// value.
// ---------------------------------------------------------------------------

export const DEFAULT_EXTERNAL_EVENT_UPDATE_POLICY: ExternalEventUpdatePolicyEnum =
  'change_request';

const POLICY_VALUES: ExternalEventUpdatePolicyEnum[] = [
  'allow',
  'change_request',
  'forbidden',
];

// CurrentMembership.organization is generated as an opaque
// `{ [key: string]: unknown }` (the injected OrganizationSerializer isn't
// introspectable by drf-spectacular), so the field reads as `unknown`. Coerce
// it to a known policy at runtime, falling back to the backend default.
function coercePolicy(value: unknown): ExternalEventUpdatePolicyEnum {
  return POLICY_VALUES.includes(value as ExternalEventUpdatePolicyEnum)
    ? (value as ExternalEventUpdatePolicyEnum)
    : DEFAULT_EXTERNAL_EVENT_UPDATE_POLICY;
}

export function useExternalEventUpdatePolicy() {
  const queryClient = useQueryClient();
  const { organization, isOnboarded } = useCurrentOrganization();

  const savePolicyMutation = useMutation({
    ...organizationsPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
      });
    },
  });

  const saveExternalEventUpdatePolicy = async (
    policy: ExternalEventUpdatePolicyEnum
  ) => {
    if (!organization?.id) {
      throw new Error('Organization not loaded');
    }

    const body: PatchedOrganizationWritable = {
      external_event_update_policy: policy,
    };

    return savePolicyMutation.mutateAsync({
      path: { id: String(organization.id) },
      body,
    });
  };

  return {
    // Current value from the org (coerced from the opaque org type; falls back
    // to the backend default).
    policy: coercePolicy(organization?.external_event_update_policy),
    organizationId: organization?.id,

    // Mutation control: async fn + raw mutation.
    saveExternalEventUpdatePolicy,
    savePolicyMutation,

    // Ready flag: whether the org is loaded.
    isReady: isOnboarded && organization !== null,
  };
}
