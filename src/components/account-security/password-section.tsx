'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { VStack } from '@/components/layout';

import { useAuthUser } from '@/hooks/authentication/use-auth-user';
import { useChangePassword } from '@/hooks/authentication/use-change-password';
import { useSensitiveAction } from '@/hooks/authentication/use-sensitive-action';
import { applyAllauthFormErrors } from '@/lib/allauth-form-errors';
import { ReauthenticateDialog } from './reauthenticate-dialog';

const passwordSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string().min(1, 'Enter a new password.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

/**
 * Set (social signup, no password yet) or change the account password —
 * which one is decided by `has_usable_password` on the allauth user.
 */
export function PasswordSection() {
  const { user, isLoading } = useAuthUser();
  const { changePassword, changePasswordMutation } = useChangePassword();
  const { runSensitive, reauthenticationRequest } = useSensitiveAction();

  const hasPassword = user?.has_usable_password ?? true;
  const title = hasPassword ? 'Change password' : 'Set password';

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    try {
      const result = await runSensitive(() =>
        changePassword({
          ...(hasPassword ? { current_password: values.currentPassword } : {}),
          new_password: values.newPassword,
        })
      );
      if (result === undefined) return; // reauthentication dismissed
      toast.success(
        hasPassword
          ? 'Password changed.'
          : 'Password set. You can now log in with it.'
      );
      form.reset();
    } catch (error) {
      applyAllauthFormErrors(error, {
        setError: form.setError,
        paramMap: {
          current_password: 'currentPassword',
          new_password: 'newPassword',
        },
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {hasPassword
            ? 'Use a strong password you do not use anywhere else.'
            : 'Your account was created with a social login and has no password yet. Set one to also log in with email and password.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <VStack gap={4} className='max-w-sm'>
              {hasPassword && (
                <FormField
                  control={form.control}
                  name='currentPassword'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current password</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          autoComplete='current-password'
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name='newPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        autoComplete='new-password'
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        autoComplete='new-password'
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type='submit'
                className='self-start'
                disabled={changePasswordMutation.isPending || isLoading}
              >
                {changePasswordMutation.isPending ? 'Saving…' : title}
              </Button>
            </VStack>
          </form>
        </Form>
      </CardContent>
      <ReauthenticateDialog request={reauthenticationRequest} />
    </Card>
  );
}
