'use client';

import { useRouter } from 'next/navigation';
import { useLogin } from '@/hooks/authentication/use-login';
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
import { useState } from 'react';
import type { Provider } from '@/auth-client';
import { useProviderLogin } from '@/hooks/authentication/use-provider-login';
import { SocialProviderIcon } from './social-provider-icon';

// Shared Zod schema for login: login can be email or phone (email-only account
// model — usernames are not supported).
const loginFieldSchema = z
  .string()
  .min(1, { message: 'Login is required' })
  .superRefine((val, ctx) => {
    // If only numbers, spaces, or phone symbols, must be a valid phone
    if (/^[\d\s()+-]+$/.test(val)) {
      // Accepts numbers, spaces, +, (, ) and -
      // Basic phone validation: at least 8 digits
      const digits = val.replace(/\D/g, '');
      if (digits.length < 8) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid phone number',
        });
      }
      return;
    }
    // Otherwise, must be a valid email
    if (!z.email().safeParse(val).success) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid email address',
      });
    }
  });

export const loginSchema = z.object({
  login: loginFieldSchema,
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginSchema = z.infer<typeof loginSchema>;

type LoginFormProps = {
  socialProviders: Provider[];
};

export default function LoginForm({ socialProviders }: LoginFormProps) {
  const router = useRouter();
  const { login, loginMutation } = useLogin();
  const [error, setError] = useState<string | null>(null);

  const { providerLogin, providerLoginMutation } = useProviderLogin();

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginSchema) => {
    setError(null);
    // Server-side validation (redundant but ensures trust)
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      // Set first error found
      const firstError =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ||
        'Invalid input';
      setError(firstError);
      return;
    }
    try {
      // Map login field to correct key for API (email/phone)
      type LoginPayload = { password: string } & (
        | { email: string; phone?: never }
        | { phone: string; email?: never }
      );
      let loginPayload: LoginPayload;
      if (/^[\d\s()+-]+$/.test(values.login)) {
        loginPayload = { phone: values.login, password: values.password };
      } else {
        loginPayload = { email: values.login, password: values.password };
      }
      await login(loginPayload);
      // Get tokens from localStorage (set by useLogin)
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      // Set cookies in the browser (client-side only)
      const cookieOptions = 'path=/; Secure; SameSite=Lax';
      if (accessToken)
        document.cookie = `accessToken=${accessToken}; ${cookieOptions}`;
      if (refreshToken)
        document.cookie = `refreshToken=${refreshToken}; ${cookieOptions}`;
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
              Welcome back
            </Heading>
            <Text size='sm' color='muted-foreground'>
              Sign in to your account
            </Text>
          </Stack>
          {/* Social login buttons */}
          <Box>
            {socialProviders.length > 0 ? (
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
                      loginMutation.isPending || providerLoginMutation.isPending
                    }
                    className='w-full'
                  >
                    <SocialProviderIcon provider={provider} />
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
          {socialProviders.length > 0 && (
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
              <FormField
                control={form.control}
                name='login'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email or Phone</FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        autoComplete='username'
                        placeholder='Email or phone'
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
                        autoComplete='current-password'
                        placeholder='••••••••'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && (
                <Alert variant='destructive'>
                  <AlertTitle>Login failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type='submit'
                className='w-full'
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Logging in...' : 'Login'}
              </Button>
              <Text as='div' size='sm' align='center' className='mt-2'>
                <a
                  href='/auth/request-password-reset'
                  className='text-primary hover:underline'
                >
                  Forgot your password?
                </a>
              </Text>
            </form>
          </Form>
        </VStack>
      </Card>
    </AuthLayout>
  );
}
