'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Stack } from '@/components/layout/stack';

import { PasswordSection } from './password-section';
import { SocialAccountsSection } from './social-accounts-section';
import { MfaSection } from './mfa-section';
import { EmailsSection } from './emails-section';
import { PhoneSection } from './phone-section';

/** Account security settings: password, social accounts, MFA, email, phone. */
export function SecurityPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Account security'
        description='Manage how you log in and keep your account safe.'
      />
      <PasswordSection />
      <SocialAccountsSection />
      <MfaSection />
      <EmailsSection />
      <PhoneSection />
    </Stack>
  );
}
