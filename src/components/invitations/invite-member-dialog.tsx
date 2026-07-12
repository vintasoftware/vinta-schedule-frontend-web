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
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Alert, AlertDescription } from 'vinta-schedule-design-system/ui/alert';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { VStack, Text, FormLayout } from 'vinta-schedule-design-system/layout';
import { useCreateInvitation } from '@/hooks/invitations/use-create-invitation';
import { useResendInvitation } from '@/hooks/invitations/use-resend-invitation';
import { invitationsList } from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const inviteMemberSchema = z.object({
  firstName: z.string().trim().min(1, { message: 'First name is required' }),
  lastName: z.string().trim().min(1, { message: 'Last name is required' }),
  // .trim() normalises whitespace before validation so leading/trailing spaces
  // can't cause a false "new" invite when the same address was already invited.
  email: z
    .string()
    .trim()
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
  /**
   * Seed an initial existing-invite state. Intended only for Storybook stories
   * that need to demonstrate the DuplicateWarning UI without triggering a live
   * API call. Do not use in production code.
   */
  _storyInitialExistingInvite?: ExistingInvite | null;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  _storyInitialExistingInvite,
}: InviteMemberDialogProps) {
  const { createInvitation, createInvitationMutation } = useCreateInvitation();
  const { resendInvitation, resendInvitationMutation } = useResendInvitation();

  // Tracks an existing pending invite for the submitted email (duplicate path).
  // `_storyInitialExistingInvite` seeds the initial value for Storybook only.
  const [existingInvite, setExistingInvite] =
    React.useState<ExistingInvite | null>(_storyInitialExistingInvite ?? null);
  // Tracks whether the duplicate-check fetch is in progress.
  const [isChecking, setIsChecking] = React.useState(false);

  const form = useForm<InviteMemberSchema>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { firstName: '', lastName: '', email: '' },
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
    //    Raw SDK call (not a query hook) — we intentionally bypass the TanStack
    //    Query cache to get a fresh, authoritative result immediately before
    //    deciding whether to create or resend. A stale cached result could cause
    //    a duplicate create.
    setIsChecking(true);
    let foundExisting: ExistingInvite | null = null;
    try {
      const { data } = await invitationsList({
        query: {
          email: values.email,
          // Exclude accepted invitations and expired invitations — an expired
          // pending invite must not block a fresh invite (resending an expired
          // one would itself fail with 400 on the API).
          is_accepted: false,
          is_expired: false,
          // Raise the limit to reduce the chance that a superstring partial
          // match from the API pushes the exact address off the first page.
          // The exact-match client-side filter below is the source of truth.
          limit: 50,
        },
      });
      const results = data?.results ?? [];
      // The API email filter is a PARTIAL match — do exact comparison
      // client-side (case-insensitive). This is the authoritative duplicate
      // check; the API query only narrows the candidate set.
      // Residual race: if > 50 invitations partially match the email prefix,
      // the exact address could theoretically be absent from this page. This
      // edge case is considered acceptable for typical org sizes.
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
      await createInvitation({
        email: values.email,
        first_name: values.firstName,
        last_name: values.lastName,
      });
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
      await resendInvitation(existingInvite.id, existingInvite.email);
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
          {/* noValidate: zod (via react-hook-form) owns all validation; the
              browser's native constraint validation must not intercept submit. */}
          <FormLayout onSubmit={form.handleSubmit(onSubmit)} gap={4} noValidate>
            <FormField
              control={form.control}
              name='firstName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      autoComplete='given-name'
                      placeholder='Jane'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='lastName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      autoComplete='family-name'
                      placeholder='Doe'
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
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
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
          </FormLayout>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
