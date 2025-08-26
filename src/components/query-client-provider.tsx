'use client';

import React from 'react';
import {
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from '@tanstack/react-query';

// Create a client
let queryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: 1,
          staleTime: 1000 * 60 * 5, // 5 minutes
        },
        mutations: {
          retry: 1,
        },
      },
    });
  } else {
    // Browser: make a new query client if we don't already have one
    if (!queryClient) {
      queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 1000 * 60 * 5, // 5 minutes
          },
          mutations: {
            retry: 1,
          },
        },
      });
    }
    return queryClient;
  }
}

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = getQueryClient();

  return (
    <TanStackQueryClientProvider client={client}>
      {children}
    </TanStackQueryClientProvider>
  );
}
