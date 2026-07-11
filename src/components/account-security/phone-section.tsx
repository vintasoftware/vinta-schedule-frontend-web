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
} from '@vinta-schedule/design-system/ui/card';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Badge } from '@vinta-schedule/design-system/ui/badge';
import { Input } from '@vinta-schedule/design-system/ui/input';
import { Skeleton } from '@vinta-schedule/design-system/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@vinta-schedule/design-system/ui/form';
import { VStack, HStack, Text } from '@vinta-schedule/design-system/layout';

import { useAccountPhone } from '@/hooks/authentication/use-account-phone';
import { useUpdatePhone } from '@/hooks/authentication/use-update-phone';
import { useSensitiveAction } from '@/hooks/authentication/use-sensitive-action';
import { useCreateConsent } from '@/hooks/consents/use-create-consent';
import { applyAllauthFormErrors } from '@/lib/allauth-form-errors';
import { ReauthenticateDialog } from './reauthenticate-dialog';
import { PhoneVerifyDialog } from './phone-verify-dialog';

const CONSENT_FAILURE_MESSAGE =
  "We couldn't record your SMS consent, so a verification code can't be sent right now. Please try again later.";

const phoneSchema = z.object({
  phone: z
    .string()
    .min(1, 'Enter a phone number.')
    .regex(/^\+?[0-9\s().-]{7,20}$/, 'Enter a valid phone number.'),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;

/** Add or change the account phone number; verified via SMS OTP. */
export function PhoneSection() {
  const { phone, isLoading, isError } = useAccountPhone();
  const { updatePhone, updatePhoneMutation } = useUpdatePhone();
  const { runSensitive, reauthenticationRequest } = useSensitiveAction();
  const { createConsent, createConsentMutation } = useCreateConsent();

  const [phoneToVerify, setPhoneToVerify] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const onSubmit = async (values: PhoneFormValues) => {
    // Consent is phone-keyed: record `sms_consent` for the new phone before
    // requesting a verification code for it (anti-enumeration — the backend
    // silently drops SMS to numbers without recorded consent).
    //
    // This happens before the sensitive-action/reauth step below, so the
    // consent may be recorded even if the user then cancels reauth — that's
    // harmless, since it's just an acknowledgement, and a reauth retry only
    // re-runs updatePhone, not createConsent.
    try {
      await createConsent({
        document_type: 'sms_consent',
        phone_number: values.phone,
      });
    } catch {
      toast.error(CONSENT_FAILURE_MESSAGE);
      return;
    }

    try {
      const result = await runSensitive(() => updatePhone(values.phone));
      if (result === undefined) return;
      toast.success(`Verification code sent to ${values.phone}.`);
      form.reset();
      setIsEditing(false);
      setPhoneToVerify(values.phone);
    } catch (error) {
      applyAllauthFormErrors(error, {
        setError: form.setError,
        fields: ['phone'],
      });
    }
  };

  const isSubmitPending =
    createConsentMutation.isPending || updatePhoneMutation.isPending;

  const showForm = isEditing || (!isLoading && !isError && !phone);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phone number</CardTitle>
        <CardDescription>
          A verified phone number can be used to log in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className='h-10 w-full' />
        ) : isError ? (
          <Text size='sm' color='destructive'>
            Could not load your phone number.
          </Text>
        ) : (
          <VStack gap={4}>
            {phone && !isEditing && (
              <HStack justify='between' align='center' gap={4}>
                <HStack align='center' gap={2}>
                  <Text size='sm'>{phone.phone}</Text>
                  {phone.verified ? (
                    <Badge variant='secondary'>Verified</Badge>
                  ) : (
                    <Badge variant='outline'>Unverified</Badge>
                  )}
                </HStack>
                <HStack align='center' gap={1}>
                  {!phone.verified && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPhoneToVerify(phone.phone)}
                    >
                      Verify
                    </Button>
                  )}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setIsEditing(true)}
                  >
                    Change
                  </Button>
                </HStack>
              </HStack>
            )}

            {showForm && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <VStack gap={2} className='max-w-md'>
                    <Text size='xs' color='muted-foreground'>
                      By adding or changing your phone number you agree to
                      receive SMS verification codes at that number. Msg &amp;
                      data rates may apply.
                    </Text>
                    <HStack gap={2} align='start'>
                      <FormField
                        control={form.control}
                        name='phone'
                        render={({ field }) => (
                          <FormItem className='flex-1'>
                            <FormLabel className='sr-only'>
                              Phone number
                            </FormLabel>
                            <FormControl>
                              <Input
                                type='tel'
                                placeholder='+1 555 555 5555'
                                autoComplete='tel'
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type='submit'
                        disabled={
                          isSubmitPending || form.formState.isSubmitting
                        }
                      >
                        {isSubmitPending
                          ? 'Sending code…'
                          : phone
                            ? 'Change'
                            : 'Add phone'}
                      </Button>
                      {phone && (
                        <Button
                          type='button'
                          variant='ghost'
                          onClick={() => {
                            setIsEditing(false);
                            form.reset();
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                </form>
              </Form>
            )}
          </VStack>
        )}
      </CardContent>

      <PhoneVerifyDialog
        phone={phoneToVerify}
        onOpenChange={(open) => {
          if (!open) setPhoneToVerify(null);
        }}
      />

      <ReauthenticateDialog request={reauthenticationRequest} />
    </Card>
  );
}
