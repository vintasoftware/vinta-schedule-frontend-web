'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@/lib/configure-api-clients';
import { configureClientAuthentication } from '@/lib/authentication-fetch-interceptors';
import { ClientTokenStorageStrategy } from '@/lib/token-storage-strategy.client';
import { makeQueryClient } from '@/components/query-client-provider';

// Browser-scoped singleton — mirrors the pattern in query-client-provider.tsx.
// SSR paths never reach this 'use client' module, so `undefined` initial value
// is fine; the first render in the browser creates the recovery-wired client.
let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined =
  undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a fresh client (this code path should not be reached
    // in practice because this file is 'use client', but guard anyway).
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

const queryClient = getQueryClient();

export function APIClientAuthInitializationProvider({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    configureClientAuthentication(new ClientTokenStorageStrategy()); // runs once on client mount
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
