import { Suspense } from 'react';

import { Center } from '@vinta-schedule/design-system/layout/center';
import { ProviderConnectCallback } from '@/components/account-security/provider-connect-callback';

/**
 * OAuth callback landing page — the backend points social providers (connect
 * flow) and social-login error redirects at this exact route.
 * `useSearchParams` requires the Suspense boundary.
 */
export default function ProviderCallbackPage() {
  return (
    <Center minHeight='screen'>
      <Suspense fallback={null}>
        <ProviderConnectCallback />
      </Suspense>
    </Center>
  );
}
