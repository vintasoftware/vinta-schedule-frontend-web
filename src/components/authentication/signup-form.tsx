'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSignUp } from '@/hooks/authentication/use-sign-up';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Card } from 'vinta-schedule-design-system/ui/card';
import { Checkbox } from 'vinta-schedule-design-system/ui/checkbox';
import { AuthLayout } from 'vinta-schedule-design-system/layout/auth-layout';
import {
  Box,
  Flex,
  FormLayout,
  Grid,
  Stack,
  HStack,
  VStack,
  Heading,
  Text,
} from 'vinta-schedule-design-system/layout';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';
import { BrandingTheme } from '@/components/authentication/branding-theme';
import { SocialProviderIcon } from '@/components/authentication/social-provider-icon';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo, useState } from 'react';
import type { ErrorResponse, Signup } from '@/auth-client';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';
import { isAuthenticationResponse } from '@/lib/authentication-response-type-checks';
import { useAuthConfig } from '@/hooks/authentication/use-auth-config';
import { useProviderLogin } from '@/hooks/authentication/use-provider-login';
import type { TenantBranding } from '@/lib/branding-shared';

import { getApiErrorMessage } from '@/lib/utils/api-errors';
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
      // E.164, matching allauth's own `^\+[1-9]\d{5,14}$` server-side rule.
      // A looser client rule (spaces, parens, dashes) only defers the
      // rejection to the server after the user has filled the whole form.
      phone: z.string().regex(/^\+[1-9]\d{5,14}$/, {
        message:
          'Enter a phone number in international format, e.g. +14155552671',
      }),
      password: z
        .string()
        .min(8, { message: 'Password must be at least 8 characters' })
        .regex(passwordStrengthRegex, {
          message:
            'Password must contain uppercase, lowercase, number, and special character',
        }),
      confirm_password: z.string(),
      // Two distinct, always-unchecked opt-ins (Twilio/TCPA require SMS
      // consent to be its own explicit checkbox — never merged, never
      // pre-checked).
      accepted_terms: z.boolean().refine((v) => v === true, {
        message: 'You must agree to the Privacy Policy and Terms of Use.',
      }),
      accepted_sms_consent: z.boolean().refine((v) => v === true, {
        message: 'You must agree to receive SMS messages.',
      }),
    })
    .refine((data) => data.password === data.confirm_password, {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    });

type SignupSchema = z.infer<ReturnType<typeof makeSignupSchema>>;

// Maps a backend 400's `param` onto the matching form field. `confirm_password`
// is deliberately absent — it is client-only and the API never names it.
const FIELD_NAMES: Array<keyof SignupSchema> = [
  'first_name',
  'last_name',
  'email',
  'organization_name',
  'phone',
  'password',
  'accepted_terms',
  'accepted_sms_consent',
];

function isFieldName(param: string): param is keyof SignupSchema {
  return (FIELD_NAMES as string[]).includes(param);
}

export interface SignupFormProps {
  /**
   * Resolved tenant branding for the slug-scoped signup route. When omitted,
   * the page renders the vinta default (generic `/auth/signup`).
   */
  branding?: TenantBranding;
  /** Public org slug when rendered from `/o/{slug}/auth/signup`. */
  slug?: string;
  /**
   * Organization name fixed by the branded signup link. When set, the
   * organization field is pre-filled with it and locked — the visitor follows
   * a link that already decided which organization they are signing up for.
   *
   * Ignored on the invite path, which hides the field outright (the invite
   * decides the org server-side).
   */
  lockedOrganizationName?: string;
}

export default function SignupForm({
  branding,
  slug,
  lockedOrganizationName,
}: SignupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Invite-link signup: the user's email was invited to an org. The backend
  // auto-joins the inviting org at email verification and ignores any submitted
  // organization name (invite wins), so we hide the org-name field here.
  const inviteToken = searchParams.get('invite');
  const invitedEmail = searchParams.get('email') ?? '';
  const isInvited = Boolean(inviteToken);

  // The invite path wins: it removes the field entirely, so there is nothing
  // to lock.
  const lockedOrgName = isInvited ? undefined : lockedOrganizationName;

  // The invitation was issued to one specific address, and the backend matches
  // the pending invitation on it — letting the visitor edit it here silently
  // turns "accept this invite" into "create an unrelated account". Locked the
  // same way the branded link locks the organization.
  const lockedEmail = isInvited && invitedEmail ? invitedEmail : undefined;

  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const { signUp, signUpMutation } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
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
      organization_name: lockedOrgName ?? '',
      phone: '',
      password: '',
      confirm_password: '',
      accepted_terms: false,
      accepted_sms_consent: false,
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
      const status = (err as { status?: number })?.status;

      // 400: allauth rejected a field (a phone that isn't E.164, an email
      // already taken, …). Render it against the input that caused it and
      // stop here — handing a 400 to flow control falls through its
      // unhandled-response branch, which clears the session and pushes the
      // visitor to the social-signup error page, losing the whole form.
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
        setError(
          formLevelMessage || 'Please fix the highlighted fields and try again.'
        );
        return;
      }

      // 401 with pending flows: signup was accepted but more steps remain
      // (verify_email). Flow control threads the session token and routes to
      // the right step — there is no error to show.
      if (isAuthenticationResponse(err)) {
        authenticationFlowControl(err);
        return;
      }

      // Anything else (410 invalid session, unexpected) -> flow control.
      authenticationFlowControl(err);
      setError(getApiErrorMessage(err, 'Signup failed'));
    }
  };

  return (
    <BrandingTheme branding={branding}>
      <AuthLayout
        navbar={<AuthNavbar branding={branding} slug={slug} />}
        variant='two-column'
      >
        <Card>
          <Flex
            direction={{ base: 'column', md: 'row' }}
            overflow='hidden'
            radius='xl'
          >
            {/* Left column: Info and Social */}
            <VStack
              grow={1}
              justify='center'
              gap={8}
              p={8}
              // TODO(ds-gap): per-side borders (borderBottom/borderRight) are not
              // responsive — the "rule below on mobile, rule to the right on md"
              // split cannot be expressed with the DS box props today.
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
                    : lockedOrgName
                      ? `Sign up to get started with ${lockedOrgName}.`
                      : 'Sign up to access all features and start your journey.'}
                </Text>
              </Stack>
              {/* Social signup buttons */}
              <Box>
                {isAuthConfigLoading ? (
                  <VStack gap={2} mt={4}>
                    {/* `w-full`: <Button> exposes no width prop. The pulse/alpha
                      skeleton treatment is an animation — inexpressible as a
                      token prop. */}
                    <Button
                      disabled
                      className='w-full animate-pulse opacity-70'
                    >
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
                          setSocialError(null);
                          try {
                            const { redirect_url: redirectUrl } =
                              await providerLogin({
                                provider: provider.id,
                                callbackUrl: `${window.location.origin}/auth/social/${provider.id}/callback`,
                                process: 'login',
                              });
                            window.location.href = redirectUrl;
                          } catch (err) {
                            setSocialError(
                              getApiErrorMessage(
                                err,
                                'Could not start social sign-in. Please try again.'
                              )
                            );
                          }
                        }}
                        disabled={
                          signUpMutation.isPending ||
                          providerLoginMutation.isPending
                        }
                        // `w-full`: <Button> exposes no width prop.
                        className='w-full'
                      >
                        <SocialProviderIcon provider={provider} />
                        Sign in with {provider.name}
                      </Button>
                    ))}
                    {socialError && (
                      <Alert variant='destructive'>
                        <AlertTitle>Social sign-in failed</AlertTitle>
                        <AlertDescription>{socialError}</AlertDescription>
                      </Alert>
                    )}
                  </VStack>
                ) : null}
              </Box>
            </VStack>
            {/* Right column: Form */}
            <VStack grow={1} justify='center' p={8}>
              {/* Only show the separator if there are social providers */}
              {!isAuthConfigLoading && socialProviders.length > 0 && (
                <HStack
                  align='center'
                  mb={8}
                  display={{ base: 'flex', sm: 'hidden' }}
                >
                  <Box grow={1} borderTop />
                  <Text size='xs' color='muted-foreground' mx={2}>
                    or
                  </Text>
                  <Box grow={1} borderTop />
                </HStack>
              )}
              <Form {...form}>
                <FormLayout gap={4} onSubmit={form.handleSubmit(onSubmit)}>
                  <Grid gap={4} columns={{ base: 1, sm: 2 }}>
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
                  </Grid>
                  {!isInvited && (
                    <FormField
                      control={form.control}
                      name='organization_name'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name</FormLabel>
                          <FormControl>
                            {/*
                             * `disabled` only greys out the control — the value
                             * still submits, because react-hook-form holds it in
                             * form state rather than reading the DOM node.
                             */}
                            <Input
                              type='text'
                              autoComplete='organization'
                              placeholder='Your organization'
                              disabled={Boolean(lockedOrgName)}
                              data-testid='organization-name-input'
                              {...field}
                            />
                          </FormControl>
                          {lockedOrgName && (
                            <FormDescription>
                              Set by your sign-up link.
                            </FormDescription>
                          )}
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
                          {/*
                           * `disabled` only greys out the control — the value
                           * still submits, because react-hook-form holds it in
                           * form state rather than reading the DOM node.
                           */}
                          <Input
                            type='email'
                            autoComplete='email'
                            placeholder='Email'
                            disabled={Boolean(lockedEmail)}
                            data-testid='email-input'
                            {...field}
                          />
                        </FormControl>
                        {lockedEmail && (
                          <FormDescription>
                            Set by your invitation.
                          </FormDescription>
                        )}
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
                        <FormDescription>
                          Include the country code, digits only.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Grid gap={4} columns={{ base: 1, sm: 2 }}>
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
                  </Grid>
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
                          {/* FormLabel is shadcn's <Label>: it exposes no weight /
                          leading / margin props, so the checkbox-row typography
                          override stays a class. */}
                          <FormLabel className='mb-0 leading-snug font-normal'>
                            I agree to the{' '}
                            <TextLink asChild>
                              <Link
                                href='/privacy'
                                target='_blank'
                                rel='noopener noreferrer'
                              >
                                Privacy Policy
                              </Link>
                            </TextLink>{' '}
                            and{' '}
                            <TextLink asChild>
                              <Link
                                href='/terms'
                                target='_blank'
                                rel='noopener noreferrer'
                              >
                                Terms of Use
                              </Link>
                            </TextLink>
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
                          {/* FormLabel is shadcn's <Label>: no weight / leading /
                          margin props. */}
                          <FormLabel className='mb-0 leading-snug font-normal'>
                            I agree to receive SMS text messages (e.g.
                            verification codes) at the phone number I provide.
                            Msg &amp; data rates may apply.
                          </FormLabel>
                        </HStack>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  {/* `mt-2 w-full`: <Button> exposes no margin/width props. */}
                  <Button
                    type='submit'
                    className='mt-2 w-full'
                    disabled={signUpMutation.isPending}
                  >
                    {signUpMutation.isPending ? 'Signing up...' : 'Sign Up'}
                  </Button>
                </FormLayout>
              </Form>
            </VStack>
          </Flex>
        </Card>
      </AuthLayout>
    </BrandingTheme>
  );
}
