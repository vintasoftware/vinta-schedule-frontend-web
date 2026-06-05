'use client';

import { useRequestPasswordReset } from '@/hooks/authentication/use-request-password-reset';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Text, Heading } from '@/components/layout';
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
import Link from 'next/link';
import { useState } from 'react';

const requestPasswordResetSchema = z.object({
  login: z
    .email({ message: 'Invalid email address' })
    .min(1, { message: 'Email is required' }),
});

type RequestPasswordResetSchema = z.infer<typeof requestPasswordResetSchema>;

export default function RequestPasswordResetPage() {
  const { requestPasswordReset, requestPasswordResetMutation } =
    useRequestPasswordReset();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RequestPasswordResetSchema>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { login: '' },
  });

  const onSubmit = async (values: RequestPasswordResetSchema) => {
    setError(null);
    setSuccess(null);
    try {
      await requestPasswordReset({ email: values.login });
      setSuccess('If the account exists, a password reset link has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Card className='w-full max-w-sm space-y-6 p-8'>
        <BackLink href='/auth/login' label='Back to login' />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <Heading level={1} size='2xl' align='center'>
              Reset Password
            </Heading>
            <FormField
              control={form.control}
              name='login'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type='text' placeholder='Email' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <Alert variant='destructive'>
                <AlertTitle>Request failed</AlertTitle>
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
              disabled={requestPasswordResetMutation.isPending}
            >
              {requestPasswordResetMutation.isPending
                ? 'Sending...'
                : 'Send Reset Link'}
            </Button>
            <Text as='div' size='sm' align='center' className='mt-2'>
              <Link href='/auth/login' className='text-primary hover:underline'>
                Back to Login
              </Link>
            </Text>
          </form>
        </Form>
      </Card>
    </AuthLayout>
  );
}
