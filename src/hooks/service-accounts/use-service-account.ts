import type {
  ServiceAccountRead,
  ServiceAccountWriteWritable,
  PatchedServiceAccountWriteWritable,
} from '@/client';
import {
  serviceAccountsListOptions,
  serviceAccountsCreateMutation,
  serviceAccountsPartialUpdateMutation,
  serviceAccountsDestroyMutation,
} from '@/client/@tanstack/react-query.gen';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// SERVICE_ACCOUNT_QUERY_KEY
//
// Used by all mutations to invalidate the list after create/patch/delete.
// ---------------------------------------------------------------------------

export const SERVICE_ACCOUNT_QUERY_KEY = ['serviceAccountsList'] as const;

// ---------------------------------------------------------------------------
// useServiceAccount
//
// Fetches GET /service-accounts/ with limit=1. Per the API contract, each
// org has at most one org-level service account. Returns the first result
// or null if none exists.
//
// Security: The read model (ServiceAccountRead) never contains secrets
// (private_key, private_key_id, public_key). Only email, audience,
// configured, created, modified are returned.
// ---------------------------------------------------------------------------

export function useServiceAccount() {
  const query = useQuery({
    ...serviceAccountsListOptions({ query: { limit: 1 } }),
  });

  const serviceAccount: ServiceAccountRead | null =
    query.data?.results?.[0] ?? null;

  return {
    serviceAccount,
    isConfigured: serviceAccount?.configured ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    query,
  };
}

// ---------------------------------------------------------------------------
// useUpsertServiceAccount
//
// Create-or-patch:
//   - No existing id → POST /service-accounts/ (create).
//   - Existing id passed → PATCH /service-accounts/{id}/ (rotate/update).
//
// SECURITY: credentials (private_key, public_key, private_key_id) are
// write-only and are never returned in responses (per ServiceAccountRead).
// They must never be placed in the query cache, localStorage, or global state.
// The form that calls this hook must clear credential fields on close.
//
// Invalidates SERVICE_ACCOUNT_QUERY_KEY on success.
// ---------------------------------------------------------------------------

export function useUpsertServiceAccount() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    ...serviceAccountsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICE_ACCOUNT_QUERY_KEY });
    },
  });

  const patchMutation = useMutation({
    ...serviceAccountsPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICE_ACCOUNT_QUERY_KEY });
    },
  });

  const saveServiceAccount = async (
    values: ServiceAccountWriteWritable,
    existingId?: number
  ) => {
    if (existingId !== undefined) {
      // Rotate: PATCH the existing account with fresh credentials.
      const patch: PatchedServiceAccountWriteWritable = {
        email: values.email,
        audience: values.audience,
        public_key: values.public_key,
        private_key_id: values.private_key_id,
        private_key: values.private_key,
      };
      return patchMutation.mutateAsync({
        path: { id: String(existingId) },
        body: patch,
      });
    }

    // Create: POST new account.
    return createMutation.mutateAsync({ body: values });
  };

  const isPending = createMutation.isPending || patchMutation.isPending;

  return { saveServiceAccount, createMutation, patchMutation, isPending };
}

// ---------------------------------------------------------------------------
// useDeleteServiceAccount
//
// Wraps DELETE /service-accounts/{id}/. Invalidates SERVICE_ACCOUNT_QUERY_KEY
// on success so the list refetches and shows empty state.
// ---------------------------------------------------------------------------

export function useDeleteServiceAccount() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    ...serviceAccountsDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SERVICE_ACCOUNT_QUERY_KEY });
    },
  });

  const deleteServiceAccount = async (id: number) =>
    deleteMutation.mutateAsync({ path: { id: String(id) } });

  return { deleteServiceAccount, deleteMutation };
}
