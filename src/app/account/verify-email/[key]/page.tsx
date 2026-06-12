import { Center } from '@/components/layout/center';
import { VerifyEmailByKey } from '@/components/account-security/verify-email-by-key';

/**
 * Target of the verification links the backend emails out — the route shape
 * (`/account/verify-email/[key]`) is dictated by the backend configuration.
 */
export default async function VerifyEmailByKeyPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return (
    <Center minHeight='screen'>
      <VerifyEmailByKey verificationKey={decodeURIComponent(key)} />
    </Center>
  );
}
