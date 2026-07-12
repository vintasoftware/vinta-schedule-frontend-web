'use client';

/**
 * ServiceAccountCard — CRUD surface for the org-level Google Calendar service account.
 *
 * States:
 *  - Loading: skeleton placeholder.
 *  - Not configured: empty state + "Set up" button that opens the setup wizard.
 *  - Configured: shows email, admin_email, "Configured" badge, created/modified dates.
 *    Offers "Rotate credentials" (opens the wizard directly on the form step) and
 *    "Remove" (AlertDialog confirmation).
 *
 * The configure flow is delegated to ServiceAccountWizard, which walks the
 * operator through creating the Google service account + permissions before
 * showing the form. SECURITY invariants live with the form in that component.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Settings, Trash2 } from 'lucide-react';
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
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { VStack, HStack, Text, Box } from 'vinta-schedule-design-system/layout';
import {
  useServiceAccount,
  useDeleteServiceAccount,
} from '@/hooks/service-accounts/use-service-account';
import { ServiceAccountWizard } from './service-account-wizard';

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
      <Box p={6} radius='lg' border borderColor='border'>
        <Text color='muted-foreground' size='sm'>
          Loading service account…
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box p={6} radius='lg' border borderColor='border'>
        <VStack gap={4}>
          <HStack gap={2} align='center'>
            <Icon icon={Settings} size='md' color='muted-foreground' />
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
                  Admin email
                </Text>
                <Text size='sm' weight='medium'>
                  {serviceAccount.admin_email}
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
                  <Trash2 aria-hidden='true' />
                  Remove
                </Button>
              </HStack>
            </VStack>
          ) : (
            <VStack gap={3}>
              <Text color='muted-foreground' size='sm'>
                No service account configured. Set one up to enable rooms sync
                with Google Calendar.
              </Text>
              <Button
                type='button'
                variant='default'
                onClick={() => setFormOpen(true)}
                data-testid='configure-service-account-button'
              >
                Set up service account
              </Button>
            </VStack>
          )}
        </VStack>
      </Box>

      <ServiceAccountWizard
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
                <Text weight='medium'>{serviceAccount.email}</Text>
              )}
              ? Rooms sync will stop working until a new service account is
              configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* className: AlertDialogAction hardcodes the default button variant
                and exposes no `variant` prop, so the destructive surface (and
                its :hover alpha tint) can only be applied as classes. */}
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
