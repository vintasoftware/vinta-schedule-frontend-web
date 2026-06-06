'use client';

/**
 * ServiceAccountCard — CRUD surface for the org-level Google Calendar service account.
 *
 * States:
 *  - Loading: skeleton placeholder.
 *  - Not configured: empty state + "Configure" button that opens the form dialog.
 *  - Configured: shows email, audience, "Configured" badge, created/modified dates.
 *    Offers "Rotate credentials" (open form, pre-fills only non-secret fields) and
 *    "Remove" (AlertDialog confirmation).
 *
 * SECURITY invariants:
 *  - Credentials (private_key, private_key_id, public_key) are NEVER pre-populated
 *    in the form (the read model never returns them anyway).
 *  - Form state is cleared entirely when the dialog closes.
 *  - No console.log / console.error with credential values — never log the form body.
 *  - Credentials are held only in react-hook-form local state; never in query cache.
 *
 * Optional: "Paste service-account JSON" textarea to best-effort populate
 * email ← client_email, private_key ← private_key, private_key_id ← private_key_id
 * from a pasted Google service-account JSON. audience and public_key require manual entry.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Settings, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { VStack, HStack, Text, Box } from '@/components/layout';
import {
  useServiceAccount,
  useUpsertServiceAccount,
  useDeleteServiceAccount,
} from '@/hooks/service-accounts/use-service-account';

// ---------------------------------------------------------------------------
// Zod schema — all fields required for create; rotate uses the same schema
// because PATCH with all fields is equivalent to a full re-configure.
// ---------------------------------------------------------------------------

const serviceAccountSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Must be a valid email address' }),
  audience: z.string().trim().min(1, { message: 'Audience is required' }),
  public_key: z.string().trim().min(1, { message: 'Public key is required' }),
  private_key_id: z
    .string()
    .trim()
    .min(1, { message: 'Private key ID is required' }),
  private_key: z.string().trim().min(1, { message: 'Private key is required' }),
});

type ServiceAccountSchema = z.infer<typeof serviceAccountSchema>;

// ---------------------------------------------------------------------------
// ServiceAccountFormDialog
// ---------------------------------------------------------------------------

interface ServiceAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingId?: number;
  isRotating: boolean;
}

function ServiceAccountFormDialog({
  open,
  onOpenChange,
  existingId,
  isRotating,
}: ServiceAccountFormDialogProps) {
  const { saveServiceAccount, isPending } = useUpsertServiceAccount();

  const form = useForm<ServiceAccountSchema>({
    resolver: zodResolver(serviceAccountSchema),
    defaultValues: {
      email: '',
      audience: '',
      public_key: '',
      private_key_id: '',
      private_key: '',
    },
  });

  // ---------------------------------------------------------------------------
  // Optional: paste Google service-account JSON for convenience.
  // Best-effort: maps client_email→email, private_key→private_key,
  // private_key_id→private_key_id. audience and public_key require manual entry.
  // The textarea is cleared on close (see below effect).
  // ---------------------------------------------------------------------------
  const [pasteJson, setPasteJson] = React.useState('');

  // SECURITY: clear all form state (including credentials) when the dialog closes.
  // This ensures pasted private keys don't linger in memory after the dialog is dismissed.
  React.useEffect(() => {
    if (!open) {
      form.reset();
      setPasteJson('');
    }
  }, [open, form]);

  const handlePasteJson = (raw: string) => {
    setPasteJson(raw);
    if (!raw.trim()) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.client_email === 'string' && parsed.client_email) {
        form.setValue('email', parsed.client_email, { shouldValidate: false });
      }
      if (typeof parsed.private_key === 'string' && parsed.private_key) {
        form.setValue('private_key', parsed.private_key, {
          shouldValidate: false,
        });
      }
      if (typeof parsed.private_key_id === 'string' && parsed.private_key_id) {
        form.setValue('private_key_id', parsed.private_key_id, {
          shouldValidate: false,
        });
      }
    } catch {
      // Not valid JSON — ignore silently; user can still fill fields manually.
    }
  };

  const onSubmit = async (values: ServiceAccountSchema) => {
    try {
      await saveServiceAccount(values, existingId);
      toast.success(
        isRotating
          ? 'Service account credentials rotated'
          : 'Service account configured'
      );
      onOpenChange(false);
    } catch (err) {
      // SECURITY: never log the values/credentials here.
      toast.error(
        isRotating
          ? 'Failed to rotate service account credentials'
          : 'Failed to configure service account',
        {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        }
      );
    }
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRotating
              ? 'Rotate service account credentials'
              : 'Configure service account'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
            noValidate
          >
            {/* Convenience paste — optional */}
            <VStack gap={1}>
              <Text size='sm' color='muted-foreground'>
                Paste Google service-account JSON (optional — fills email,
                private key fields)
              </Text>
              <Textarea
                placeholder='Paste JSON here…'
                value={pasteJson}
                onChange={(e) => handlePasteJson(e.target.value)}
                rows={3}
                className='font-mono text-xs'
                data-testid='paste-json-textarea'
              />
            </VStack>

            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service account email</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='my-service-account@project.iam.gserviceaccount.com'
                      autoComplete='off'
                      {...field}
                      data-testid='service-account-email'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='audience'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audience</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='https://example.com'
                      autoComplete='off'
                      {...field}
                      data-testid='service-account-audience'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='public_key'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Public key</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='-----BEGIN CERTIFICATE-----'
                      autoComplete='off'
                      rows={3}
                      className='font-mono text-xs'
                      {...field}
                      data-testid='service-account-public-key'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='private_key_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private key ID</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      autoComplete='off'
                      {...field}
                      data-testid='service-account-private-key-id'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='private_key'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private key</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='-----BEGIN RSA PRIVATE KEY-----'
                      autoComplete='off'
                      rows={4}
                      className='font-mono text-xs'
                      {...field}
                      data-testid='service-account-private-key'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isPending}
                data-testid='save-service-account-submit'
              >
                {isPending
                  ? 'Saving…'
                  : isRotating
                    ? 'Rotate credentials'
                    : 'Configure'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ServiceAccountCard
// ---------------------------------------------------------------------------

export function ServiceAccountCard() {
  const { serviceAccount, isConfigured, isLoading } = useServiceAccount();
  const { deleteServiceAccount, deleteMutation } = useDeleteServiceAccount();

  const [formOpen, setFormOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const handleDeleteConfirm = async () => {
    if (!serviceAccount) return;
    try {
      await deleteServiceAccount(serviceAccount.id);
      toast.success('Service account removed');
      setDeleteDialogOpen(false);
    } catch (err) {
      toast.error('Failed to remove service account', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  if (isLoading) {
    return (
      <Box className='border-border rounded-lg border p-6'>
        <Text color='muted-foreground' size='sm'>
          Loading service account…
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box className='border-border rounded-lg border p-6'>
        <VStack gap={4}>
          <HStack gap={2} align='center'>
            <Settings
              className='text-muted-foreground h-5 w-5'
              aria-hidden='true'
            />
            <Text weight='semibold'>Service Account</Text>
          </HStack>

          {isConfigured && serviceAccount ? (
            <VStack gap={3}>
              <HStack gap={2} align='center'>
                <Badge variant='success'>Configured</Badge>
              </HStack>

              <VStack gap={1}>
                <Text size='sm' color='muted-foreground'>
                  Email
                </Text>
                <Text size='sm' weight='medium'>
                  {serviceAccount.email}
                </Text>
              </VStack>

              <VStack gap={1}>
                <Text size='sm' color='muted-foreground'>
                  Audience
                </Text>
                <Text size='sm' weight='medium'>
                  {serviceAccount.audience}
                </Text>
              </VStack>

              <HStack gap={4}>
                <VStack gap={1}>
                  <Text size='sm' color='muted-foreground'>
                    Created
                  </Text>
                  <Text size='sm'>
                    {new Date(serviceAccount.created).toLocaleDateString()}
                  </Text>
                </VStack>
                <VStack gap={1}>
                  <Text size='sm' color='muted-foreground'>
                    Last modified
                  </Text>
                  <Text size='sm'>
                    {new Date(serviceAccount.modified).toLocaleDateString()}
                  </Text>
                </VStack>
              </HStack>

              <HStack gap={2}>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setFormOpen(true)}
                  disabled={deleteMutation.isPending}
                  data-testid='rotate-service-account-button'
                >
                  Rotate credentials
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  aria-label='Remove service account'
                  data-testid='remove-service-account-button'
                >
                  <Trash2 className='mr-1 h-4 w-4' aria-hidden='true' />
                  Remove
                </Button>
              </HStack>
            </VStack>
          ) : (
            <VStack gap={3}>
              <Text color='muted-foreground' size='sm'>
                No service account configured. Configure one to enable rooms
                sync with Google Calendar.
              </Text>
              <Button
                type='button'
                variant='default'
                onClick={() => setFormOpen(true)}
                data-testid='configure-service-account-button'
              >
                Configure
              </Button>
            </VStack>
          )}
        </VStack>
      </Box>

      <ServiceAccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        existingId={
          isConfigured && serviceAccount ? serviceAccount.id : undefined
        }
        isRotating={isConfigured}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove service account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the service account{' '}
              {serviceAccount && (
                <span className='font-medium'>{serviceAccount.email}</span>
              )}
              ? Rooms sync will stop working until a new service account is
              configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              data-testid='confirm-remove-service-account'
            >
              {deleteMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
