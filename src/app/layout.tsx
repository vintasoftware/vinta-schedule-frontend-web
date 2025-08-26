import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { APIClientAuthInitializationProvider } from '@/providers/api-client-auth-initialization-provider';

import { configureClientAuthentication } from '@/lib/authentication-fetch-interceptors';
import { ServerTokenStorageStrategy } from '@/lib/token-storage-strategy.server';

// Configure authentication for server-side rendering
configureClientAuthentication(new ServerTokenStorageStrategy());

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vinta Schedule',
  description: 'An open source tool to schedule and sync events',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={inter.className}>
        <APIClientAuthInitializationProvider>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange={false}
            storageKey='vinta-schedule-theme'
          >
            {children}
          </ThemeProvider>
        </APIClientAuthInitializationProvider>
      </body>
    </html>
  );
}
