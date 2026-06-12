import { redirect } from 'next/navigation';

/**
 * The backend generates `/account/password/reset` links; the actual screen
 * lives at `/auth/request-password-reset`.
 */
export default function AccountPasswordResetPage() {
  redirect('/auth/request-password-reset');
}
