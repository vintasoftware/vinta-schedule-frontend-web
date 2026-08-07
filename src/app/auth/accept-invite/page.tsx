'use client';

import { Suspense } from 'react';
import AcceptInviteForm from '@/components/authentication/accept-invite-form';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
