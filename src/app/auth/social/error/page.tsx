import { Card } from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { AuthLayout } from 'vinta-schedule-design-system/layout/auth-layout';
import { Divider, Text, VStack } from 'vinta-schedule-design-system/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { fetchBrandingForTenant } from '@/lib/branding-server';

export default async function SocialLoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;

  // Resolve tenant branding so the error page also carries reseller branding.
  // Falls back to vinta default on any error.
  const tenantId =
    typeof resolvedParams.tenant_id === 'string'
      ? resolvedParams.tenant_id
      : undefined;
  const branding = await fetchBrandingForTenant(tenantId);

  return (
    <AuthLayout navbar={<AuthNavbar branding={branding} />} variant='single'>
      <Card padding={8}>
        <VStack align='center' gap={6}>
          <Alert variant='destructive'>
            <AlertTitle>
              <Text size='xl' weight='bold'>
                Social Login Failed
              </Text>
            </AlertTitle>
            <AlertDescription>
              We couldn&apos;t log you in using your social account. Please try
              again or use another login method.
            </AlertDescription>
          </Alert>
          <Divider spacing={2} />
          {/* `w-full`: <Button> exposes no width prop (see DS gap in report). */}
          <Button asChild variant='default' fullWidth>
            <a href='/auth/login'>Back to Login</a>
          </Button>
        </VStack>
      </Card>
    </AuthLayout>
  );
}
