import { redirect } from 'next/navigation';

/**
 * The backend generates `/reset-password/[key]` links; the actual screen
 * lives at `/auth/reset-password/[key]`.
 */
export default async function ResetPasswordByKeyPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  redirect(`/auth/reset-password/${encodeURIComponent(key)}`);
}
