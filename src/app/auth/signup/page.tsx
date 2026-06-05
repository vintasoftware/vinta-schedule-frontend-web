'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSignUp } from '@/hooks/authentication/use-sign-up';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Box, Stack, HStack, VStack, Heading, Text } from '@/components/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Suspense, useMemo, useState } from 'react';
import type { Provider, Signup } from '@/auth-client';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { useAuthConfig } from '@/hooks/authentication/use-auth-config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGoogle,
  faFacebook,
  faApple,
} from '@fortawesome/free-brands-svg-icons';
import { User } from 'lucide-react';
import { useProviderLogin } from '@/hooks/authentication/use-provider-login';

const passwordStrengthRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

// `organization_name` is optional in the API (invited users skip it), but for
// self-service signup we require it from the user — see `isInvited` below.
const makeSignupSchema = (isInvited: boolean) =>
  z
    .object({
      first_name: z.string().min(1, { message: 'First name is required' }),
      last_name: z.string().min(1, { message: 'Last name is required' }),
      email: z.email({ message: 'Invalid email address' }),
      organization_name: isInvited
        ? z.string().optional()
        : z
            .string()
            .min(1, { message: 'Organization name is required' })
            .max(255, { message: 'Organization name is too long' }),
      phone: z
        .string()
        .min(8, { message: 'Phone number must be at least 8 digits' })
        .regex(/^[\d\s()+-]+$/, { message: 'Invalid phone number' }),
      password: z
        .string()
        .min(8, { message: 'Password must be at least 8 characters' })
        .regex(passwordStrengthRegex, {
          message:
            'Password must contain uppercase, lowercase, number, and special character',
        }),
      confirm_password: z.string(),
    })
    .refine((data) => data.password === data.confirm_password, {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    });

type SignupSchema = z.infer<ReturnType<typeof makeSignupSchema>>;

function ProviderIcon({ provider }: { provider: Provider }) {
  switch (provider.id) {
    case 'google':
      return <FontAwesomeIcon icon={faGoogle} className='mr-2' />;
    case 'facebook':
      return <FontAwesomeIcon icon={faFacebook} className='mr-2' />;
    case 'apple':
      return <FontAwesomeIcon icon={faApple} className='mr-2' />;
    default:
      return <User />;
  }
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Invite-link signup: the user's email was invited to an org. The backend
  // auto-joins the inviting org at email verification and ignores any submitted
  // organization name (invite wins), so we hide the org-name field here.
  const inviteToken = searchParams.get('invite');
  const invitedEmail = searchParams.get('email') ?? '';
  const isInvited = Boolean(inviteToken);

  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const { signUp, signUpMutation } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { providerLogin, providerLoginMutation } = useProviderLogin();

  // Social providers from config
  const { authConfig, isLoading: isAuthConfigLoading } = useAuthConfig();
  const socialProviders = authConfig?.data.socialaccount?.providers ?? [];

  const signupSchema = useMemo(() => makeSignupSchema(isInvited), [isInvited]);

  const form = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: invitedEmail,
      organization_name: '',
      phone: '',
      password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (values: SignupSchema) => {
    setError(null);
    setSuccess(null);
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      const firstError =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ||
        parsed.error.issues[0]?.message ||
        'Invalid input';
      setError(firstError);
      return;
    }
    // Strip client-only fields before sending to the API.
    const signupValues = { ...values };
    if ('confirm_password' in signupValues) {
      // @ts-expect-error confirm_password is not part of Signup type
      delete signupValues.confirm_password;
    }
    // Invited users don't pick an org — the invite decides it.
    if (isInvited || !signupValues.organization_name) {
      delete signupValues.organization_name;
    }
    try {
      const response = await signUp(signupValues as Signup);
      authenticationFlowControl(response);
    } catch (err) {
      authenticationFlowControl(err);
      setError(err instanceof Error ? err.message : 'Signup failed');
    }
  };

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='two-column'>
      <Card className='flex w-full max-w-3xl flex-col overflow-hidden p-0 md:flex-row'>
        {/* Left column: Info and Social */}
        <VStack
          grow={1}
          justify='center'
          gap={8}
          p={8}
          className='border-b md:border-r md:border-b-0'
        >
          <BackLink href='/' label='Back to home' />
          <Stack gap={4}>
            <Heading level={1} size='3xl'>
              Create your account
            </Heading>
            <Text size='sm' color='muted-foreground'>
              {isInvited
                ? "You've been invited to join an organization. Sign up to accept."
                : 'Sign up to access all features and start your journey.'}
            </Text>
          </Stack>
          {/* Social signup buttons */}
          <Box>
            {isAuthConfigLoading ? (
              <VStack gap={2} mt={4}>
                <Button disabled className='w-full animate-pulse opacity-70'>
                  Loading social providers...
                </Button>
                <Button
                  disabled
                  className='w-full animate-pulse opacity-70'
                ></Button>
              </VStack>
            ) : socialProviders.length > 0 ? (
              <VStack gap={2} mt={4}>
                {socialProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    onClick={async () => {
                      const { redirect_url: redirectUrl } = await providerLogin(
                        {
                          provider: provider.id,
                          callbackUrl: `http://localhost:3000/auth/social/${provider.id}/callback`,
                          process: 'login',
                        }
                      );
                      window.location.href = redirectUrl;
                    }}
                    disabled={
                      signUpMutation.isPending ||
                      providerLoginMutation.isPending
                    }
                    className='w-full'
                  >
                    <ProviderIcon provider={provider} />
                    Sign in with {provider.name}
                  </Button>
                ))}
              </VStack>
            ) : null}
          </Box>
        </VStack>
        {/* Right column: Form */}
        <VStack grow={1} justify='center' p={8}>
          {/* Only show the separator if there are social providers */}
          {!isAuthConfigLoading && socialProviders.length > 0 && (
            <HStack align='center' mb={8} className='sm:hidden'>
              <Box grow={1} className='border-border border-t' />
              <Text size='xs' color='muted-foreground' className='mx-2'>
                or
              </Text>
              <Box grow={1} className='border-border border-t' />
            </HStack>
          )}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-col gap-4'
            >
              <Box className='grid gap-4 sm:grid-cols-2'>
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
              </Box>
              {!isInvited && (
                <FormField
                  control={form.control}
                  name='organization_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input
                          type='text'
                          autoComplete='organization'
                          placeholder='Your organization'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                        readOnly={isInvited && Boolean(invitedEmail)}
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
                        type='text'
                        autoComplete='tel'
                        placeholder='Phone'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Box className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          autoComplete='new-password'
                          placeholder='••••••••'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='confirm_password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          autoComplete='new-password'
                          placeholder='Repeat password'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Box>
              {error && (
                <Alert variant='destructive'>
                  <AlertTitle>Signup failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert variant='default'>
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
              <Button
                type='submit'
                className='mt-2 w-full'
                disabled={signUpMutation.isPending}
              >
                {signUpMutation.isPending ? 'Signing up...' : 'Sign Up'}
              </Button>
            </form>
          </Form>
        </VStack>
      </Card>
    </AuthLayout>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageContent />
    </Suspense>
  );
}
