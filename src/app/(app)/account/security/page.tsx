import { SecurityPage } from '@/components/account-security/security-page';

/**
 * Account security settings. The screen is fully interactive (generated
 * TanStack Query hooks + Bearer auth that only exists client-side), so the
 * server page is just a thin shell.
 */
export default function SecurityRoute() {
  return <SecurityPage />;
}
