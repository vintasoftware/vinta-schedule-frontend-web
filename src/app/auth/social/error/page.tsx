import { Card } from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { AuthLayout } from 'vinta-schedule-design-system/layout/auth-layout';
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
      <Card className='flex w-full max-w-md flex-col items-center gap-6 p-8'>
        <Alert variant='destructive' className='w-full'>
          <AlertTitle className='text-xl font-bold'>
            Social Login Failed
          </AlertTitle>
          <AlertDescription>
            We couldn&apos;t log you in using your social account. Please try
            again or use another login method.
          </AlertDescription>
        </Alert>
        <div className='border-border my-2 w-full border-t' />
        <Button asChild variant='default' className='w-full'>
          <a href='/auth/login'>Back to Login</a>
        </Button>
      </Card>
    </AuthLayout>
  );
}
