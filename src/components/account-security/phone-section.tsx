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
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { VStack, HStack, Text } from '@/components/layout';

import { useAccountPhone } from '@/hooks/authentication/use-account-phone';
import { useUpdatePhone } from '@/hooks/authentication/use-update-phone';
import { useSensitiveAction } from '@/hooks/authentication/use-sensitive-action';
import { applyAllauthFormErrors } from '@/lib/allauth-form-errors';
import { ReauthenticateDialog } from './reauthenticate-dialog';
import { PhoneVerifyDialog } from './phone-verify-dialog';

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

  const [phoneToVerify, setPhoneToVerify] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const onSubmit = async (values: PhoneFormValues) => {
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
                  <HStack gap={2} align='start' className='max-w-md'>
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
                      disabled={updatePhoneMutation.isPending}
                    >
                      {updatePhoneMutation.isPending
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
