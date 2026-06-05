'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { VStack, Text } from '@/components/layout';
import { useCreateInvitation } from '@/hooks/invitations/use-create-invitation';
import { useResendInvitation } from '@/hooks/invitations/use-resend-invitation';
import { invitationsList } from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const inviteMemberSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Invalid email address' }),
});

type InviteMemberSchema = z.infer<typeof inviteMemberSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExistingInvite {
  id: number;
  email: string;
}

// ---------------------------------------------------------------------------
// InviteMemberDialog
//
// Dialog that lets an admin invite a new org member by email.
//
// Duplicate detection (idempotency):
//   Before calling invitationsCreate, the form queries invitationsList with the
//   submitted email + is_accepted:false. The API email param is a partial match,
//   so we also do an exact-match filter on the client side (case-insensitive).
//   If a pending invite for that email already exists, we surface the existing
//   invite and offer a Resend action (invitationsResendCreate on the existing
//   invite's id) instead of creating a second one.
//
// Submit-button debounce:
//   The submit button is disabled while any mutation or check is pending
//   (isPending flag), preventing double-submit.
// ---------------------------------------------------------------------------

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const { createInvitation, createInvitationMutation } = useCreateInvitation();
  const { resendInvitation, resendInvitationMutation } = useResendInvitation();

  // Tracks an existing pending invite for the submitted email (duplicate path).
  const [existingInvite, setExistingInvite] =
    React.useState<ExistingInvite | null>(null);
  // Tracks whether the duplicate-check fetch is in progress.
  const [isChecking, setIsChecking] = React.useState(false);

  const form = useForm<InviteMemberSchema>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '' },
  });

  // Reset dialog state when it opens/closes.
  React.useEffect(() => {
    if (!open) {
      form.reset();
      setExistingInvite(null);
      setIsChecking(false);
    }
  }, [open, form]);

  const isPending =
    isChecking ||
    createInvitationMutation.isPending ||
    resendInvitationMutation.isPending;

  // -------------------------------------------------------------------------
  // onSubmit — check for duplicates before creating.
  // -------------------------------------------------------------------------

  const onSubmit = async (values: InviteMemberSchema) => {
    const emailLower = values.email.toLowerCase();

    // 1. Check for an existing pending invitation with an exact email match.
    setIsChecking(true);
    let foundExisting: ExistingInvite | null = null;
    try {
      const { data } = await invitationsList({
        query: {
          email: values.email,
          is_accepted: false,
          limit: 20,
        },
      });
      const results = data?.results ?? [];
      // The API email filter is a partial match — do exact comparison client-side.
      const exactMatch = results.find(
        (inv) => inv.email.toLowerCase() === emailLower
      );
      if (exactMatch) {
        foundExisting = { id: exactMatch.id, email: exactMatch.email };
      }
    } catch {
      // If the check fails, fall through and let create handle the error.
    } finally {
      setIsChecking(false);
    }

    if (foundExisting) {
      // 2a. Duplicate detected — surface the existing invite, do NOT create.
      setExistingInvite(foundExisting);
      return;
    }

    // 2b. No duplicate — create the invitation.
    try {
      await createInvitation({ email: values.email });
      toast.success('Invitation sent', {
        description: `An invitation was sent to ${values.email}.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to send invitation', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  // -------------------------------------------------------------------------
  // onResend — resend the existing pending invite and close.
  // -------------------------------------------------------------------------

  const onResend = async () => {
    if (!existingInvite) return;
    try {
      await resendInvitation(existingInvite.id);
      toast.success('Invitation resent', {
        description: `The invitation to ${existingInvite.email} was resent.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to resend invitation', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      autoComplete='email'
                      placeholder='colleague@example.com'
                      {...field}
                      // Clear the duplicate notice when the user edits the email.
                      onChange={(e) => {
                        field.onChange(e);
                        if (existingInvite) setExistingInvite(null);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {existingInvite && (
              <VStack gap={2}>
                <Alert>
                  <AlertDescription>
                    This email already has a pending invitation.
                  </AlertDescription>
                </Alert>
                <Text size='sm' color='muted-foreground'>
                  Would you like to resend the existing invitation instead?
                </Text>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={onResend}
                  disabled={resendInvitationMutation.isPending}
                >
                  {resendInvitationMutation.isPending
                    ? 'Resending…'
                    : 'Resend invitation'}
                </Button>
              </VStack>
            )}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending || !!existingInvite}>
                {isChecking || createInvitationMutation.isPending
                  ? 'Sending…'
                  : 'Send invitation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
