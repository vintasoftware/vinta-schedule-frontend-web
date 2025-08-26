import { cookies } from 'next/headers';
import { SocialSuccess } from '@/components/authentication/social-success';

export default async function SocialSuccessPage() {
  const cookieStore = await cookies();

  const sessionToken = cookieStore.get('sessionToken')?.value;
  const accessToken = cookieStore.get('accessToken')?.value;
  const refreshToken = cookieStore.get('refreshToken')?.value;

  return (
    <SocialSuccess
      sessionToken={sessionToken}
      accessToken={accessToken}
      refreshToken={refreshToken}
    />
  );
}
