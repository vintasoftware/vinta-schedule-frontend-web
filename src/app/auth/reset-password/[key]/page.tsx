'use client';

import { useRouter } from 'next/navigation';
import { useResetPassword } from '@/hooks/authentication/use-reset-password';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Heading } from '@/components/layout';
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
      <Card className='w-full max-w-sm space-y-6 p-8'>
        <BackLink href='/auth/login' label='Back to login' />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
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
            {/* Hidden token field */}
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
            <Button
              type='submit'
              className='w-full'
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending
                ? 'Resetting...'
                : 'Set Password'}
            </Button>
          </form>
        </Form>
      </Card>
    </AuthLayout>
  );
}
