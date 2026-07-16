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
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Switch } from 'vinta-schedule-design-system/ui/switch';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from 'vinta-schedule-design-system/ui/form';
import { Box, FormLayout, HStack } from 'vinta-schedule-design-system/layout';
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
      <FormLayout gap={6} onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name='should_sync_rooms'
          render={({ field }) => (
            <FormItem>
              <HStack
                gap={4}
                align='center'
                justify='between'
                p={4}
                radius='lg'
                border
                borderColor='border'
              >
                <Box grow>
                  {/* className: shadcn <FormLabel> (Radix Label) exposes no
                      size/weight props, and the field must stay a real
                      <label htmlFor> for the Switch wiring. */}
                  <FormLabel className='text-base font-semibold'>
                    Sync rooms
                  </FormLabel>
                  <FormDescription>
                    Enable synchronization of room resources from your calendar
                    provider
                  </FormDescription>
                </Box>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                    aria-label='Enable rooms sync'
                  />
                </FormControl>
              </HStack>
            </FormItem>
          )}
        />

        <Button type='submit' disabled={isPending}>
          {isPending ? 'Saving...' : 'Save settings'}
        </Button>
      </FormLayout>
    </Form>
  );
}
