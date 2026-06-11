'use client';

/**
 * RoomsSyncSettingsForm — rhf + zod form for configuring rooms sync.
 *
 * Fields:
 *  - shouldSyncRooms (boolean) — toggle to enable/disable rooms sync
 *
 * Flow:
 *  1. Pre-populate from the current organization's should_sync_rooms field.
 *  2. Toggle the switch; on save, call saveRoomsSyncConfig.
 *  3. On success: toast + form state updates.
 *  4. On error: toast with the error message.
 *
 * The save button is disabled while the mutation is pending.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from '@/components/ui/form';
import { VStack } from '@/components/layout';
import { useRoomsSyncConfig } from '@/hooks/sync/use-rooms-sync-config';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const roomsSyncSettingsFormSchema = z.object({
  should_sync_rooms: z.boolean().default(false),
});

type RoomsSyncSettingsFormSchema = z.infer<typeof roomsSyncSettingsFormSchema>;

// ---------------------------------------------------------------------------
// RoomsSyncSettingsForm
// ---------------------------------------------------------------------------

export function RoomsSyncSettingsForm() {
  const { shouldSyncRooms, saveRoomsSyncConfig, saveConfigMutation } =
    useRoomsSyncConfig();

  const form = useForm({
    resolver: zodResolver(roomsSyncSettingsFormSchema),
    defaultValues: {
      should_sync_rooms: Boolean(shouldSyncRooms),
    },
  });

  // Update form when shouldSyncRooms changes (org reloads after save)
  React.useEffect(() => {
    form.reset({
      should_sync_rooms: Boolean(shouldSyncRooms),
    });
  }, [shouldSyncRooms, form]);

  const onSubmit = async (data: RoomsSyncSettingsFormSchema) => {
    try {
      await saveRoomsSyncConfig({
        should_sync_rooms: data.should_sync_rooms,
      });
      toast.success('Rooms sync settings saved');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save settings';
      toast.error(message);
    }
  };

  const isPending = saveConfigMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <VStack gap={6}>
          <FormField
            control={form.control}
            name='should_sync_rooms'
            render={({ field }) => (
              <FormItem className='border-border flex items-center justify-between gap-4 rounded-lg border p-4'>
                <div className='flex-1'>
                  <FormLabel className='text-base font-semibold'>
                    Sync rooms
                  </FormLabel>
                  <FormDescription>
                    Enable synchronization of room resources from your calendar
                    provider
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                    aria-label='Enable rooms sync'
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type='submit' disabled={isPending}>
            {isPending ? 'Saving...' : 'Save settings'}
          </Button>
        </VStack>
      </form>
    </Form>
  );
}
