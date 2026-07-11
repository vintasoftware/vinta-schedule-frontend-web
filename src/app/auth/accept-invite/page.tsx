'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Suspense, useState } from 'react';
import { Input } from '@vinta-schedule/design-system/ui/input';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Card } from '@vinta-schedule/design-system/ui/card';
import { AuthLayout } from '@vinta-schedule/design-system/layout/auth-layout';
import { Stack, Heading, Text } from '@vinta-schedule/design-system/layout';
import { AuthNavbar } from '@/components/authentication/auth-navbar';
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
import {
  useAcceptInvitation,
  getAcceptInvitationErrorMessage,
  isAlreadyMemberError,
} from '@/hooks/organizations/use-accept-invitation';

const acceptInviteSchema = z.object({
  token: z.string().min(1, { message: 'Invitation token is required' }),
});

type AcceptInviteSchema = z.infer<typeof acceptInviteSchema>;

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { acceptInvitation, acceptInvitationMutation } = useAcceptInvitation();
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  const form = useForm<AcceptInviteSchema>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  });

  const onSubmit = async ({ token }: AcceptInviteSchema) => {
    setError(null);
    setAlreadyMember(false);
    try {
      await acceptInvitation({ token });
      router.replace('/');
    } catch (err) {
      // 400 { error: "User is already a member of this organization." } — the
      // invite was for an org the user already belongs to (same-org duplicate).
      // A user CAN join additional orgs; only re-accepting the same org is blocked.
      if (isAlreadyMemberError(err)) {
        setAlreadyMember(true);
        return;
      }
      setError(getAcceptInvitationErrorMessage(err));
    }
  };

  return (
    <AuthLayout navbar={<AuthNavbar />} variant='single'>
      <Card className='flex w-full max-w-md flex-col gap-8 p-8'>
        <Stack gap={4}>
          <Heading level={1} size='3xl'>
            Accept invitation
          </Heading>
          <Text size='sm' color='muted-foreground'>
            Enter your invitation token to join the organization.
          </Text>
        </Stack>
        {alreadyMember ? (
          <Alert variant='destructive'>
            <AlertTitle>
              You&apos;re already a member of this organization
            </AlertTitle>
            <AlertDescription>
              You already belong to this organization, so the invite cannot be
              accepted again. Your memberships are unchanged.{' '}
              <Link href='/' className='underline'>
                Go to the app
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-col gap-4'
            >
              <FormField
                control={form.control}
                name='token'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invitation token</FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        placeholder='Paste your invitation token'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && (
                <Alert variant='destructive'>
                  <AlertTitle>Could not accept invitation</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type='submit'
                className='mt-2 w-full'
                disabled={acceptInvitationMutation.isPending}
              >
                {acceptInvitationMutation.isPending
                  ? 'Accepting...'
                  : 'Accept invitation'}
              </Button>
            </form>
          </Form>
        )}
        <Text as='div' size='sm' align='center' color='muted-foreground'>
          No invitation?{' '}
          <a href='/auth/onboarding' className='text-primary hover:underline'>
            Create your own organization
          </a>
        </Text>
      </Card>
    </AuthLayout>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteContent />
    </Suspense>
  );
}
