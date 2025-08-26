import { getAuthByClientV1Config } from '@/auth-client';
import LoginForm from '@/components/authentication/login-form';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const authCofig = await getAuthByClientV1Config({
    path: {
      client: 'app',
    },
  });

  if (!authCofig || authCofig.data?.status !== 200 || !authCofig.data?.data) {
    redirect('/auth/login');
  }
  const socialProviders = authCofig.data?.data.socialaccount?.providers || [];

  return <LoginForm socialProviders={socialProviders} />;
}
