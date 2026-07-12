'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'vinta-schedule-design-system/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import {
  Box,
  VStack,
  HStack,
  Text,
  FormLayout,
  VisuallyHidden,
} from 'vinta-schedule-design-system/layout';

import { useAccountEmails } from '@/hooks/authentication/use-account-emails';
import { useAddEmail } from '@/hooks/authentication/use-add-email';
import { useRemoveEmail } from '@/hooks/authentication/use-remove-email';
import { useSetPrimaryEmail } from '@/hooks/authentication/use-set-primary-email';
import { useResendAccountEmailVerification } from '@/hooks/authentication/use-resend-account-email-verification';
import { useSensitiveAction } from '@/hooks/authentication/use-sensitive-action';
import { applyAllauthFormErrors } from '@/lib/allauth-form-errors';
import { ReauthenticateDialog } from './reauthenticate-dialog';
import { EmailVerifyDialog } from './email-verify-dialog';

const addEmailSchema = z.object({
  email: z.email('Enter a valid email address.'),
});

type AddEmailFormValues = z.infer<typeof addEmailSchema>;

/** Manage account emails: add, verify (code), set primary, remove. */
export function EmailsSection() {
  const { emails, isLoading, isError } = useAccountEmails();
  const { addEmail, addEmailMutation } = useAddEmail();
  const { removeEmail, removeEmailMutation } = useRemoveEmail();
  const { setPrimaryEmail, setPrimaryEmailMutation } = useSetPrimaryEmail();
  const { resendAccountEmailVerification } =
    useResendAccountEmailVerification();
  const { runSensitive, reauthenticationRequest } = useSensitiveAction();

  const [emailToVerify, setEmailToVerify] = useState<string | null>(null);
  const [emailToRemove, setEmailToRemove] = useState<string | null>(null);

  const form = useForm<AddEmailFormValues>({
    resolver: zodResolver(addEmailSchema),
    defaultValues: { email: '' },
  });

  const onAddEmail = async (values: AddEmailFormValues) => {
    try {
      const result = await runSensitive(() => addEmail(values.email));
      if (result === undefined) return;
      form.reset();
      toast.success(`Verification code sent to ${values.email}.`);
      setEmailToVerify(values.email);
    } catch (error) {
      applyAllauthFormErrors(error, {
        setError: form.setError,
        fields: ['email'],
      });
    }
  };

  const handleResend = async (email: string) => {
    try {
      await resendAccountEmailVerification(email);
      toast.success(`Verification code sent to ${email}.`);
      setEmailToVerify(email);
    } catch {
      toast.error('Could not send the verification code.');
    }
  };

  const handleSetPrimary = async (email: string) => {
    try {
      const result = await runSensitive(() => setPrimaryEmail(email));
      if (result === undefined) return;
      toast.success(`${email} is now your primary email.`);
    } catch (error) {
      applyAllauthFormErrors(error);
    }
  };

  const handleRemove = async (email: string) => {
    setEmailToRemove(null);
    try {
      const result = await runSensitive(() => removeEmail(email));
      if (result === undefined) return;
      toast.success(`${email} removed.`);
    } catch (error) {
      applyAllauthFormErrors(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email addresses</CardTitle>
        <CardDescription>
          Any verified address can be made primary; the primary address receives
          account notifications and can be used to log in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <VStack gap={3}>
            <Skeleton height={40} width='full' />
            <Skeleton height={40} width='full' />
          </VStack>
        ) : isError ? (
          <Text size='sm' color='destructive'>
            Could not load your email addresses.
          </Text>
        ) : (
          <VStack gap={4}>
            <VStack gap={3}>
              {emails.map((emailAddress) => (
                <HStack
                  key={emailAddress.email}
                  justify='between'
                  align='center'
                  gap={4}
                  wrap
                >
                  <HStack align='center' gap={2} minWidth={0}>
                    <Text size='sm' truncate>
                      {emailAddress.email}
                    </Text>
                    {emailAddress.primary && <Badge>Primary</Badge>}
                    {emailAddress.verified ? (
                      <Badge variant='secondary'>Verified</Badge>
                    ) : (
                      <Badge variant='outline'>Unverified</Badge>
                    )}
                  </HStack>
                  <HStack align='center' gap={1}>
                    {!emailAddress.verified && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleResend(emailAddress.email)}
                      >
                        Verify
                      </Button>
                    )}
                    {emailAddress.verified && !emailAddress.primary && (
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={setPrimaryEmailMutation.isPending}
                        onClick={() => handleSetPrimary(emailAddress.email)}
                      >
                        Make primary
                      </Button>
                    )}
                    {!emailAddress.primary && (
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={removeEmailMutation.isPending}
                        onClick={() => setEmailToRemove(emailAddress.email)}
                      >
                        Remove
                      </Button>
                    )}
                  </HStack>
                </HStack>
              ))}
            </VStack>

            <Form {...form}>
              <FormLayout onSubmit={form.handleSubmit(onAddEmail)}>
                <HStack gap={2} align='start' maxWidth={448}>
                  <Box grow shrink basis={0} minWidth={0}>
                    <FormField
                      control={form.control}
                      name='email'
                      render={({ field }) => (
                        <FormItem>
                          <VisuallyHidden as={FormLabel}>
                            New email address
                          </VisuallyHidden>
                          <FormControl>
                            <Input
                              type='email'
                              placeholder='new-address@example.com'
                              autoComplete='email'
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </Box>
                  <Button type='submit' disabled={addEmailMutation.isPending}>
                    {addEmailMutation.isPending ? 'Adding…' : 'Add email'}
                  </Button>
                </HStack>
              </FormLayout>
            </Form>
          </VStack>
        )}
      </CardContent>

      <EmailVerifyDialog
        email={emailToVerify}
        onOpenChange={(open) => {
          if (!open) setEmailToVerify(null);
        }}
      />

      <AlertDialog
        open={Boolean(emailToRemove)}
        onOpenChange={(open) => {
          if (!open) setEmailToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {emailToRemove}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to log in with this address.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (emailToRemove) handleRemove(emailToRemove);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReauthenticateDialog request={reauthenticationRequest} />
    </Card>
  );
}
