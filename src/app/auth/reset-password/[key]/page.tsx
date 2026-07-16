'use client';

import { useRouter } from 'next/navigation';
import { useResetPassword } from '@/hooks/authentication/use-reset-password';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Card } from 'vinta-schedule-design-system/ui/card';
import { AuthLayout } from 'vinta-schedule-design-system/layout/auth-layout';
import {
  Box,
  FormLayout,
  VStack,
  Heading,
} from 'vinta-schedule-design-system/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { BackLink } from '@/components/authentication/back-link';
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
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { use, useState } from 'react';

// The token should be passed via query string (?token=...) from the reset link
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
  key: z.string().min(1, { message: 'Reset key is required' }),
});

type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ key?: string }>;
}) {
  const { key } = use(params);
  const router = useRouter();
  const { resetPassword, resetPasswordMutation } = useResetPassword();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      key: key || '',
    },
  });

  const onSubmit = async (values: ResetPasswordSchema) => {
    setError(null);
    setSuccess(null);
    try {
      await resetPassword({ password: values.password, key: values.key });
      setSuccess('Password has been reset. You may now log in.');
      setTimeout(() => {
        router.push('/auth/login');
      }, 10000); // Redirect after 2 seconds
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  };

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Box maxWidth={384} mx='auto'>
        <Card padding={8}>
          <VStack gap={6}>
            <BackLink href='/auth/login' label='Back to login' />
            <Form {...form}>
              <FormLayout gap={6} onSubmit={form.handleSubmit(onSubmit)}>
                <Heading level={1} size='2xl' align='center'>
                  Set New Password
                </Heading>
                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
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
                {/*
                 * Hidden token field — a `type="hidden"` input has no visual
                 * surface, so the styled DS <Input> is not the right primitive
                 * (and the DS has no hidden-field atom). Stays a raw input.
                 */}
                <input type='hidden' {...form.register('key')} />
                {error && (
                  <Alert variant='destructive'>
                    <AlertTitle>Reset failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert variant='default'>
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}
                {/* `w-full`: <Button> exposes no width prop. */}
                <Button
                  type='submit'
                  className='w-full'
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending
                    ? 'Resetting...'
                    : 'Set Password'}
                </Button>
              </FormLayout>
            </Form>
          </VStack>
        </Card>
      </Box>
    </AuthLayout>
  );
}
