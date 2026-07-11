'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { Organization } from '@/client';
import { useCreateOrganization } from '@/hooks/organizations/use-create-organization';
import { VStack } from '@vinta-schedule/design-system/layout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@vinta-schedule/design-system/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@vinta-schedule/design-system/ui/form';
import { Input } from '@vinta-schedule/design-system/ui/input';
import { Button } from '@vinta-schedule/design-system/ui/button';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@vinta-schedule/design-system/ui/alert';

// ---------------------------------------------------------------------------
// Schema — mirrors the onboarding form (non-empty, max 255 chars)
// ---------------------------------------------------------------------------

const createOrgSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Organization name is required' })
    .max(255, { message: 'Organization name is too long' }),
});

type CreateOrgSchema = z.infer<typeof createOrgSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the newly created organization on successful submit. */
  onCreated?: (org: Organization) => void;
}

// ---------------------------------------------------------------------------
// CreateOrganizationDialog
//
// A controlled Dialog that lets the user create a new organization from the
// org switcher (Phase 5 / UC3). Mirrors the onboarding form's validation and
// UI shape. On success it calls onCreated with the new org so the caller can
// immediately setActive(String(org.id)) and close the dialog.
// ---------------------------------------------------------------------------

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateOrganizationDialogProps) {
  const { createOrganization, createOrganizationMutation } =
    useCreateOrganization();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateOrgSchema>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = async ({ name }: CreateOrgSchema) => {
    setError(null);
    try {
      const newOrg = await createOrganization({ name });
      form.reset();
      onCreated?.(newOrg);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create organization.'
      );
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Set up a new organization. You&apos;ll be its administrator.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <VStack gap={4}>
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
              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => handleOpenChange(false)}
                  disabled={createOrganizationMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type='submit'
                  disabled={createOrganizationMutation.isPending}
                >
                  {createOrganizationMutation.isPending
                    ? 'Creating...'
                    : 'Create organization'}
                </Button>
              </DialogFooter>
            </VStack>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
