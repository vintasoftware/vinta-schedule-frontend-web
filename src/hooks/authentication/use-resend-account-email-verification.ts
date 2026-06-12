import { putAuthByClientV1AccountEmailMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

/**
 * Re-send the verification code for an unverified address on the account
 * (`PUT /account/email`) — distinct from the signup-flow resend, which lives
 * at `/auth/email/verify/resend`.
 */
export function useResendAccountEmailVerification() {
  const resendAccountEmailVerificationMutation = useMutation({
    ...putAuthByClientV1AccountEmailMutation(),
    retry: false,
  });

  const resendAccountEmailVerification = async (email: string) =>
    resendAccountEmailVerificationMutation.mutateAsync({
      path: { client: 'app' },
      body: { email },
    });

  return {
    resendAccountEmailVerification,
    resendAccountEmailVerificationMutation,
  };
}
