import { redirect } from 'next/navigation';

/**
 * The backend generates `/account/signup` links; the actual screen lives at
 * `/auth/signup`.
 */
export default function AccountSignupPage() {
  redirect('/auth/signup');
}
