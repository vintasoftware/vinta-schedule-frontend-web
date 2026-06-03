import { getAuthByClientV1Config } from '@/auth-client';
import LoginForm from '@/components/authentication/login-form';

export default async function LoginPage() {
  // Fetch the auth config to discover available social providers. If the
  // backend is unreachable or returns an error, degrade gracefully and render
  // the form without social login — never redirect back to this same page
  // (that causes an infinite redirect loop).
  const authConfig = await getAuthByClientV1Config({
    path: {
      client: 'app',
    },
  });

  const socialProviders =
    authConfig.data?.status === 200
      ? (authConfig.data.data.socialaccount?.providers ?? [])
      : [];

  return <LoginForm socialProviders={socialProviders} />;
}
