'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VStack, Text } from '@/components/layout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';

// ---------------------------------------------------------------------------
// Static story render — avoids tanstack-query / SDK dependency in Storybook.
// Shows the two key states: default (empty form) and duplicate-warning.
// ---------------------------------------------------------------------------

function DialogDefault() {
  const form = useForm({ defaultValues: { email: '' } });
  const [open, setOpen] = React.useState(true);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className='flex flex-col gap-4'>
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
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type='submit'>Send invitation</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DialogDuplicateWarning() {
  const form = useForm({
    defaultValues: { email: 'alice@acme.com' },
  });
  const [open, setOpen] = React.useState(true);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className='flex flex-col gap-4'>
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duplicate warning state */}
              <VStack gap={2}>
                <Alert>
                  <AlertDescription>
                    This email already has a pending invitation.
                  </AlertDescription>
                </Alert>
                <Text size='sm' color='muted-foreground'>
                  Would you like to resend the existing invitation instead?
                </Text>
                <Button type='button' variant='outline' size='sm'>
                  Resend invitation
                </Button>
              </VStack>

              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled>
                  Send invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Invitations/InviteMemberDialog',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default — empty form ready to accept an email address. */
export const Default: Story = {
  render: () => <DialogDefault />,
};

/** DuplicateWarning — shows the inline notice + Resend button when an existing pending invite is detected. */
export const DuplicateWarning: Story = {
  render: () => <DialogDuplicateWarning />,
};
