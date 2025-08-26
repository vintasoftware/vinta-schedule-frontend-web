'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureClientAuthentication } from '@/lib/authentication-fetch-interceptors';
import { ClientTokenStorageStrategy } from '@/lib/token-storage-strategy.client';

const queryClient = new QueryClient();

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
