'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
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
import { useProviderInfo } from '@/hooks/authentication/use-provider-info';
import { useProviderSignup } from '@/hooks/authentication/use-provider-signup';
import type { ProviderSignup } from '@/auth-client';
import type { UserReadable } from '@/client/types.gen';
import { useRouter } from 'next/navigation';
import { useAuthenticationFlowControl } from '@/hooks/authentication/use-authentication-flow-control';

const providerSignupSchema = z.object({
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
});

type ProviderSignupSchema = z.infer<typeof providerSignupSchema>;

export default function ProviderSignupPage() {
  const router = useRouter();
  const authenticationFlowControl = useAuthenticationFlowControl(router);
  const { providerInfo, isLoading, isError, error } = useProviderInfo();
  const { providerSignup, providerSignupMutation } = useProviderSignup();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Pre-fill form with provider info if available
  const form = useForm<ProviderSignupSchema>({
    resolver: zodResolver(providerSignupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      username: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (providerInfo && providerInfo.data) {
      const user = (providerInfo.data.user || {}) as unknown as UserReadable;
      // Email: prefer primary verified email from array
      let email = '';
      if (Array.isArray(providerInfo.data.email)) {
        const primary = providerInfo.data.email.find(
          (e) => e.primary && e.verified
        );
        email = primary?.email || providerInfo.data.email[0]?.email || '';
      }
      // Phone: not available in user, leave blank or extract from another source if available
      const phone = user?.phone_number || '';
      form.reset({
        first_name: user?.profile?.first_name || '',
        last_name: user?.profile?.last_name || '',
        email,
        username: user.username || '',
        phone,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerInfo]);

  const onSubmit = async (values: ProviderSignupSchema) => {
    setFormError(null);
    setFormSuccess(null);
    const parsed = providerSignupSchema.safeParse(values);
    if (!parsed.success) {
      const firstError =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ||
        parsed.error.errors[0]?.message ||
        'Invalid input';
      setFormError(firstError);
      return;
    }
    // Remove confirm_password before sending to API
    const signupValues = { ...values };
    // @ts-expect-error confirm_password is not part of ProviderSignup type
    delete signupValues.confirm_password;
    try {
      const response = await providerSignup(signupValues as ProviderSignup);
      authenticationFlowControl(response);
    } catch (err) {
      authenticationFlowControl(err);
      setFormError(err instanceof Error ? err.message : 'Signup failed');
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 p-8'>
      <Card className='w-full max-w-xl p-8'>
        <h1 className='mb-4 text-2xl font-bold'>Complete your signup</h1>
        <p className='text-muted-foreground mb-6 text-sm'>
          Some information was received from your social provider. Please
          complete any missing fields to finish signing up.
        </p>
        {isLoading && <div className='mb-4'>Loading provider info...</div>}
        {isError && (
          <Alert variant='destructive' className='mb-4'>
            <AlertTitle>Provider info error</AlertTitle>
            <AlertDescription>
              {error?.message || 'Could not fetch provider info.'}
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
            {formError && (
              <Alert variant='destructive'>
                <AlertTitle>Signup failed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {formSuccess && (
              <Alert variant='default'>
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{formSuccess}</AlertDescription>
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
    </div>
  );
}
