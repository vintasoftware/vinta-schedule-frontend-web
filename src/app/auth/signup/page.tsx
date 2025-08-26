'use client';

import { useRouter } from 'next/navigation';
import { useSignUp } from '@/hooks/authentication/use-sign-up';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useState } from 'react';
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

const signupSchema = z
  .object({
    first_name: z.string().min(1, { message: 'First name is required' }),
    last_name: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().email({ message: 'Invalid email address' }),
    username: z
      .string()
      .min(3, { message: 'Username must be at least 3 characters' }),
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

type SignupSchema = z.infer<typeof signupSchema>;

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

export default function SignupPage() {
  const router = useRouter();

  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const { signUp, signUpMutation } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { providerLogin, providerLoginMutation } = useProviderLogin();

  // Social providers from config
  const { authConfig, isLoading: isAuthConfigLoading } = useAuthConfig();
  const socialProviders = authConfig?.data.socialaccount?.providers ?? [];

  const form = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      username: '',
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
        parsed.error.errors[0]?.message ||
        'Invalid input';
      setError(firstError);
      return;
    }
    // Remove confirm_password before sending to API
    const signupValues = { ...values };
    if ('confirm_password' in signupValues) {
      // @ts-expect-error confirm_password is not part of Signup type
      delete signupValues.confirm_password;
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
    <div className='flex min-h-screen items-center justify-center bg-gray-50 p-8'>
      <Card className='flex w-full max-w-3xl flex-col overflow-hidden p-0 md:flex-row'>
        {/* Left column: Info and Social */}
        <div className='flex flex-1 flex-col justify-center gap-8 border-b p-8 md:border-r md:border-b-0'>
          <div className='flex flex-col gap-4'>
            <h1 className='text-3xl font-bold tracking-tight'>
              Create your account
            </h1>
            <p className='text-muted-foreground text-sm'>
              Sign up to access all features and start your journey.
            </p>
          </div>
          {/* Social signup buttons */}
          <div>
            {isAuthConfigLoading ? (
              <div className='mt-4 flex flex-col gap-2'>
                <Button disabled className='w-full animate-pulse opacity-70'>
                  Loading social providers...
                </Button>
                <Button
                  disabled
                  className='w-full animate-pulse opacity-70'
                ></Button>
              </div>
            ) : socialProviders.length > 0 ? (
              <div className='mt-4 flex flex-col gap-2'>
                {isAuthConfigLoading ? (
                  <div className='mt-4 flex flex-col gap-2'>
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
                  </div>
                ) : socialProviders.length > 0 ? (
                  <div className='mt-4 flex flex-col gap-2'>
                    {socialProviders.map((provider) => (
                      <Button
                        key={provider.id}
                        onClick={async () => {
                          const { redirect_url: redirectUrl } =
                            await providerLogin({
                              provider: provider.id,
                              callbackUrl: `http://localhost:3000/auth/social/${provider.id}/callback`,
                              process: 'login',
                            });
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
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {/* Right column: Form */}
        <div className='flex flex-1 flex-col justify-center p-8'>
          {/* Only show the separator if there are social providers */}
          {!isAuthConfigLoading && socialProviders.length > 0 && (
            <div className='mb-8 flex items-center sm:hidden'>
              <div className='flex-grow border-t border-gray-200' />
              <span className='mx-2 text-xs text-gray-400'>or</span>
              <div className='flex-grow border-t border-gray-200' />
            </div>
          )}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-col gap-4'
            >
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        autoComplete='username'
                        placeholder='Username'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
        </div>
      </Card>
    </div>
  );
}
