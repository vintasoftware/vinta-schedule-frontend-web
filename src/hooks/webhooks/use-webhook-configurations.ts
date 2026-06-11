/**
 * Webhook configuration data hooks.
 *
 * Wraps the generated TanStack Query operations for /webhook-configurations/:
 *   - useWebhookConfigurations — paginated list.
 *   - useCreateWebhookConfiguration — create.
 *   - useUpdateWebhookConfiguration — partial update (PATCH).
 *   - useDeleteWebhookConfiguration — delete.
 *
 * The list query key is exported as WEBHOOK_CONFIGURATIONS_QUERY_KEY so the
 * mutations can invalidate it (prefix match covers every paginated variant).
 */

import {
  webhookConfigurationsListOptions,
  webhookConfigurationsListQueryKey,
  webhookConfigurationsCreateMutation,
  webhookConfigurationsPartialUpdateMutation,
  webhookConfigurationsDestroyMutation,
} from '@/client/@tanstack/react-query.gen';
import type {
  WebhookConfiguration,
  WebhookConfigurationWritable,
  PatchedWebhookConfigurationWritable,
} from '@/client';
import type { DataTableQuery } from '@/components/data-table/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type {
  WebhookConfiguration,
  WebhookConfigurationWritable,
  PatchedWebhookConfigurationWritable,
};

export const WEBHOOK_CONFIGURATIONS_QUERY_KEY =
  webhookConfigurationsListQueryKey();

interface UseWebhookConfigurationsOptions {
  query?: DataTableQuery;
}

/**
 * useWebhookConfigurations — fetch the paginated list of webhook configs.
 */
export function useWebhookConfigurations(
  options?: UseWebhookConfigurationsOptions
) {
  const query = options?.query;

  const limit = query ? query.pageSize : undefined;
  const offset = query ? (query.page - 1) * query.pageSize : undefined;

  const configurationsQuery = useQuery(
    webhookConfigurationsListOptions({ query: { limit, offset } })
  );

  const configurations: WebhookConfiguration[] =
    configurationsQuery.data?.results ?? [];

  return {
    configurations,
    totalCount: configurationsQuery.data?.count ?? 0,
    isLoading: configurationsQuery.isLoading,
    isError: configurationsQuery.isError,
    error: configurationsQuery.error,
    configurationsQuery,
  };
}

/**
 * useCreateWebhookConfiguration — create a webhook configuration.
 */
export function useCreateWebhookConfiguration() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    ...webhookConfigurationsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: WEBHOOK_CONFIGURATIONS_QUERY_KEY,
      });
    },
  });

  const createWebhookConfiguration = async (
    body: WebhookConfigurationWritable
  ): Promise<WebhookConfiguration> => createMutation.mutateAsync({ body });

  return { createWebhookConfiguration, createMutation };
}

/**
 * useUpdateWebhookConfiguration — partially update a webhook configuration.
 */
export function useUpdateWebhookConfiguration() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    ...webhookConfigurationsPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: WEBHOOK_CONFIGURATIONS_QUERY_KEY,
      });
    },
  });

  const updateWebhookConfiguration = async (
    id: number,
    body: PatchedWebhookConfigurationWritable
  ): Promise<WebhookConfiguration> =>
    updateMutation.mutateAsync({ path: { id: String(id) }, body });

  return { updateWebhookConfiguration, updateMutation };
}

/**
 * useDeleteWebhookConfiguration — delete a webhook configuration.
 */
export function useDeleteWebhookConfiguration() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    ...webhookConfigurationsDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: WEBHOOK_CONFIGURATIONS_QUERY_KEY,
      });
    },
  });

  const deleteWebhookConfiguration = async (id: number): Promise<void> => {
    await deleteMutation.mutateAsync({ path: { id: String(id) } });
  };

  return { deleteWebhookConfiguration, deleteMutation };
}
