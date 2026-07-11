'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Input } from '@vinta-schedule/design-system/ui/input';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Card } from '@vinta-schedule/design-system/ui/card';
import { Checkbox } from '@vinta-schedule/design-system/ui/checkbox';
import { AuthLayout } from '@vinta-schedule/design-system/layout/auth-layout';
import { Heading, Text, HStack } from '@vinta-schedule/design-system/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@vinta-schedule/design-system/ui/alert';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@vinta-schedule/design-system/ui/form';
import { useProviderInfo } from '@/hooks/authentication/use-provider-info';
import { useProviderSignup } from '@/hooks/authentication/use-provider-signup';
import type { ErrorResponse, ProviderSignup } from '@/auth-client';

/**
 * Minimal shape of the pending social-login user as returned by
 * GET /auth/provider/signup. Only the fields we prefill from are described;
 * the response is loosely typed upstream, so we read these defensively.
 */
type PendingSignupUser = {
  profile?: { first_name?: string; last_name?: string } | null;
  phone_number?: string | null;
};
import { useRouter } from 'next/navigation';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { syncSessionTokenFromCookie } from '@/lib/session-token';
import { isAuthenticationResponse } from '@/lib/authentication-response-type-checks';
import type { TenantBranding } from '@/lib/branding-shared';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';

// Required signup fields that Google does not supply minus what it does.
// `phone` must be E.164 (the field the provider never gives us).
const providerSignupSchema = z.object({
  first_name: z.string().min(1, { message: 'First name is required' }),
  last_name: z.string().min(1, { message: 'Last name is required' }),
  email: z.email({ message: 'Invalid email address' }),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, {
    message: 'Enter a phone number in international format, e.g. +14155552671',
  }),
  // Two distinct, always-unchecked opt-ins (Twilio/TCPA require SMS consent
  // to be its own explicit checkbox — never merged, never pre-checked).
  accepted_terms: z.boolean().refine((v) => v === true, {
    message: 'You must agree to the Privacy Policy and Terms of Use.',
  }),
  accepted_sms_consent: z.boolean().refine((v) => v === true, {
    message: 'You must agree to receive SMS messages.',
  }),
});

type ProviderSignupSchema = z.infer<typeof providerSignupSchema>;

// Used to map backend 400 field errors (`fieldError.param`) onto the right
// form field via `form.setError`. Not used for pre-filling — consent fields
// are never pre-filled from the provider, but they can still receive a
// field-level 400 error from the backend, so they belong here too.
const FIELD_NAMES: Array<keyof ProviderSignupSchema> = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'accepted_terms',
  'accepted_sms_consent',
];

function isFieldName(param: string): param is keyof ProviderSignupSchema {
  return (FIELD_NAMES as string[]).includes(param);
}

export interface FinishSignupFormProps {
  /** Resolved tenant branding. Defaults to vinta branding when absent. */
  branding?: TenantBranding;
}

export function FinishSignupForm({
  branding = VINTA_DEFAULT_BRANDING,
}: FinishSignupFormProps) {
  const router = useRouter();
  // Bridge the rotated `sessionToken` cookie (set by the callback route) into
  // localStorage BEFORE the auth hooks read it, so their `X-Session-Token`
  // header carries the freshest token. Runs once during the first render.
  useState(() => syncSessionTokenFromCookie());

  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const { providerInfo, isLoading, isError, error } = useProviderInfo();
  const { providerSignup, providerSignupMutation } = useProviderSignup();
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const form = useForm<ProviderSignupSchema>({
    resolver: zodResolver(providerSignupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      accepted_terms: false,
      accepted_sms_consent: false,
    },
  });

  // Prefill from the pending social login (GET /auth/provider/signup).
  useEffect(() => {
    if (providerInfo && providerInfo.data) {
      const user = (providerInfo.data.user ||
        {}) as unknown as PendingSignupUser;
      let email = '';
      if (Array.isArray(providerInfo.data.email)) {
        const primary = providerInfo.data.email.find(
          (e) => e.primary && e.verified
        );
        email = primary?.email || providerInfo.data.email[0]?.email || '';
      }
      form.reset({
        first_name: user?.profile?.first_name || '',
        last_name: user?.profile?.last_name || '',
        email,
        phone: user?.phone_number || '',
        // Consent is never pre-filled from the provider — always unchecked.
        accepted_terms: false,
        accepted_sms_consent: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerInfo]);

  const onSubmit = async (values: ProviderSignupSchema) => {
    setFormError(null);
    setSessionExpired(false);
    try {
      const response = await providerSignup(values as ProviderSignup);
      // 200 -> AuthenticatedResponse: store tokens, route into the app.
      authenticationFlowControl(response);
    } catch (err) {
      const status = (err as { status?: number })?.status;

      // 409: the pending signup is gone (session lost) -> ask to restart.
      if (status === 409) {
        setSessionExpired(true);
        return;
      }

      // 400: render allauth field errors against their inputs.
      if (status === 400) {
        const errors =
          (err as ErrorResponse).errors ||
          (err as { data?: ErrorResponse }).data?.errors ||
          [];
        let formLevelMessage: string | null = null;
        errors.forEach((fieldError) => {
          if (fieldError.param && isFieldName(fieldError.param)) {
            form.setError(fieldError.param, { message: fieldError.message });
          } else {
            formLevelMessage = fieldError.message;
          }
        });
        setFormError(
          formLevelMessage || 'Please fix the highlighted fields and try again.'
        );
        return;
      }

      // 401 with pending flows: signup was accepted but more steps remain
      // (e.g. `verify_phone` — the new number needs an OTP before login
      // completes). Hand off to flow control, which threads the rotated
      // session token and routes to the right step. No error to show.
      if (isAuthenticationResponse(err)) {
        authenticationFlowControl(err);
        return;
      }

      // Anything else (e.g. 410 invalid session, unexpected) -> flow control.
      authenticationFlowControl(err);
      setFormError(err instanceof Error ? err.message : 'Signup failed');
    }
  };

  if (sessionExpired) {
    return (
      <AuthLayout navbar={<AuthNavbar branding={branding} />} variant='single'>
        <Card className='flex w-full max-w-md flex-col items-center gap-6 p-8'>
          <Alert variant='destructive' className='w-full'>
            <AlertTitle className='text-xl font-bold'>
              Sign-in expired
            </AlertTitle>
            <AlertDescription>
              Your sign-in session expired before you finished creating your
              account. Please start the sign-in again.
            </AlertDescription>
          </Alert>
          <Button asChild variant='default' className='w-full'>
            <a href='/auth/login'>Restart sign-in</a>
          </Button>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      navbar={<AuthNavbar branding={branding} />}
      variant='two-column'
    >
      <Card className='w-full max-w-xl p-8'>
        <BackLink href='/auth/signup' label='Back to signup' />
        <Heading level={1} size='2xl' className='mt-4 mb-4'>
          Finish creating your account
        </Heading>
        <Text as='p' size='sm' color='muted-foreground' className='mb-6'>
          We got some details from your social provider. Add the missing
          information below to finish signing up.
        </Text>
        {isLoading && <div className='mb-4'>Loading provider info...</div>}
        {isError && (
          <Alert variant='destructive' className='mb-4'>
            <AlertTitle>Provider info error</AlertTitle>
            <AlertDescription>
              {(error as { message?: string } | null)?.message ||
                'Could not fetch provider info.'}
            </AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            <FormField
              control={form.control}
              name='first_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      autoComplete='given-name'
                      placeholder='First name'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='last_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      autoComplete='family-name'
                      placeholder='Last name'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      autoComplete='email'
                      placeholder='Email'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type='tel'
                      autoComplete='tel'
                      placeholder='+14155552671'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='accepted_terms'
              render={({ field }) => (
                <FormItem>
                  <HStack gap={2} align='start'>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid='accepted-terms-checkbox'
                      />
                    </FormControl>
                    <FormLabel className='mb-0 leading-snug font-normal'>
                      I agree to the{' '}
                      <Link
                        href='/privacy'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary hover:underline'
                      >
                        Privacy Policy
                      </Link>{' '}
                      and{' '}
                      <Link
                        href='/terms'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary hover:underline'
                      >
                        Terms of Use
                      </Link>
                      .
                    </FormLabel>
                  </HStack>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='accepted_sms_consent'
              render={({ field }) => (
                <FormItem>
                  <HStack gap={2} align='start'>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid='accepted-sms-consent-checkbox'
                      />
                    </FormControl>
                    <FormLabel className='mb-0 leading-snug font-normal'>
                      I agree to receive SMS text messages (e.g. verification
                      codes) at the phone number I provide. Msg &amp; data rates
                      may apply.
                    </FormLabel>
                  </HStack>
                  <FormMessage />
                </FormItem>
              )}
            />
            {formError && (
              <Alert variant='destructive'>
                <AlertTitle>Signup failed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Button
              type='submit'
              className='mt-2 w-full'
              disabled={providerSignupMutation.isPending}
            >
              {providerSignupMutation.isPending ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </Form>
      </Card>
    </AuthLayout>
  );
}
