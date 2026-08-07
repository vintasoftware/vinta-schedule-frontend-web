import { Suspense } from 'react';
import SignupForm from '@/components/authentication/signup-form';

/**
 * Generic (unbranded) signup. The branded counterpart lives at
 * `/o/{slug}/auth/signup` and renders the same form with tenant identity,
 * colors, and a locked organization name.
 *
 * The Suspense boundary is required: SignupForm reads `useSearchParams`.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
