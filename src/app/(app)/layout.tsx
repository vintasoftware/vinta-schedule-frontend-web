import { AppLayoutClient } from '@/components/navigation/app-layout-client';

/**
 * AppLayout — thin server layout for the (app) route group.
 *
 * All auth / org-query / redirect / role-context logic lives in the
 * AppLayoutClient Client Component. This file stays a Server Component so
 * Next.js can stream the shell without blocking on client JS.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
