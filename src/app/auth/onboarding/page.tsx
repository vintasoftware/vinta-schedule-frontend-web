'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Stack, Heading, Text } from '@/components/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { useCreateOrganization } from '@/hooks/organizations/use-create-organization';
import { useActiveOrganization } from '@/hooks/organizations/use-active-organization';

const onboardingSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Organization name is required' })
    .max(255, { message: 'Organization name is too long' }),
});

type OnboardingSchema = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { createOrganization, createOrganizationMutation } =
    useCreateOrganization();
  // setActive primes X-Organization-Id before navigating into the app shell so
  // the first tenant request carries the header (Phase 6 — UC4a).
  const { setActive } = useActiveOrganization();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OnboardingSchema>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = async ({ name }: OnboardingSchema) => {
    setError(null);
    try {
      const newOrg = await createOrganization({ name });
      // Prime X-Organization-Id before entering the app so the first tenant
      // request carries the header (UC4a). setActive calls
      // queryClient.invalidateQueries() (unfiltered), which is a cheap blanket
      // invalidation — harmless here because no tenant queries have fired yet,
      // but it is not side-effect-free.
      setActive(String(newOrg.id));
      // Now an ADMIN of a fresh org — back to the app.
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create organization.'
      );
    }
  };

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Card className='flex w-full max-w-md flex-col gap-8 p-8'>
        <Stack gap={4}>
          <Heading level={1} size='3xl'>
            Create your organization
          </Heading>
          <Text size='sm' color='muted-foreground'>
            Set up an organization to get started. You&apos;ll be its
            administrator.
          </Text>
        </Stack>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            <FormField
              control={form.control}
              name='name'
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
            {error && (
              <Alert variant='destructive'>
                <AlertTitle>Could not create organization</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type='submit'
              className='mt-2 w-full'
              disabled={createOrganizationMutation.isPending}
            >
              {createOrganizationMutation.isPending
                ? 'Creating...'
                : 'Create organization'}
            </Button>
          </form>
        </Form>
        <Text as='div' size='sm' align='center' color='muted-foreground'>
          Have an invitation?{' '}
          <a
            href='/auth/accept-invite'
            className='text-primary hover:underline'
          >
            Accept an invite instead
          </a>
        </Text>
      </Card>
    </AuthLayout>
  );
}
