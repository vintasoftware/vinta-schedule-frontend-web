'use client';

import { useCallback, useState } from 'react';

export interface ReauthenticationRequest {
  /** Pending flow ids offered by the backend (`reauthenticate`, `mfa_reauthenticate`). */
  flows: string[];
  /** Re-run the original action after a successful reauthentication. */
  retry: () => Promise<void>;
  /** Resolve the original call with `undefined` (user dismissed the dialog). */
  cancel: () => void;
}

function getReauthFlows(error: unknown): string[] | null {
  const body = error as {
    status?: number;
    data?: { flows?: Array<{ id: string; is_pending?: boolean }> };
  } | null;
  if (body?.status !== 401 || !Array.isArray(body.data?.flows)) {
    return null;
  }
  const ids = body.data.flows
    .filter((flow) => flow.is_pending)
    .map((flow) => flow.id);
  return ids.includes('reauthenticate') || ids.includes('mfa_reauthenticate')
    ? ids
    : null;
}

/**
 * Wrap sensitive allauth mutations: when the backend answers 401 with a
 * pending `reauthenticate` / `mfa_reauthenticate` flow, hold the action,
 * surface a reauthentication request (rendered by `ReauthenticateDialog`),
 * and retry the original action once the user re-confirms their identity.
 * Other errors propagate unchanged. Resolves `undefined` when dismissed.
 */
export function useSensitiveAction() {
  const [reauthenticationRequest, setReauthenticationRequest] =
    useState<ReauthenticationRequest | null>(null);

  const runSensitive = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await action();
      } catch (error) {
        const flows = getReauthFlows(error);
        if (!flows) throw error;

        return new Promise<T | undefined>((resolve, reject) => {
          setReauthenticationRequest({
            flows,
            retry: async () => {
              setReauthenticationRequest(null);
              try {
                resolve(await action());
              } catch (retryError) {
                reject(retryError as Error);
              }
            },
            cancel: () => {
              setReauthenticationRequest(null);
              resolve(undefined);
            },
          });
        });
      }
    },
    []
  );

  return { runSensitive, reauthenticationRequest };
}
