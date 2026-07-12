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
  DialogDescription,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Textarea } from 'vinta-schedule-design-system/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'vinta-schedule-design-system/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { FormLayout } from 'vinta-schedule-design-system/layout';
import type { EventTypeEnum } from '@/client';
import {
  useCreateWebhookConfiguration,
  useUpdateWebhookConfiguration,
  type WebhookConfiguration,
} from '@/hooks/webhooks/use-webhook-configurations';
import { WEBHOOK_EVENT_TYPES } from './event-types';

// ---------------------------------------------------------------------------
// Zod schema. `headers` is entered as free-form JSON text and validated to be
// a JSON object of string values (custom headers sent with each delivery).
// ---------------------------------------------------------------------------

const EVENT_TYPE_VALUES = WEBHOOK_EVENT_TYPES.map((t) => t.value) as [
  EventTypeEnum,
  ...EventTypeEnum[],
];

const webhookSchema = z.object({
  event_type: z.enum(EVENT_TYPE_VALUES, {
    message: 'Select an event type',
  }),
  url: z
    .string()
    .trim()
    .min(1, { message: 'URL is required' })
    .url({ message: 'Enter a valid URL' }),
  headers: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          const parsed = JSON.parse(val);
          return (
            typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
          );
        } catch {
          return false;
        }
      },
      { message: 'Headers must be a valid JSON object' }
    ),
});

type WebhookSchema = z.infer<typeof webhookSchema>;

// ---------------------------------------------------------------------------
// WebhookDialog — create or edit a webhook configuration.
//
// When `configuration` is provided the dialog edits it (PATCH); otherwise it
// creates a new one. Form state resets whenever the dialog closes or the
// target configuration changes.
// ---------------------------------------------------------------------------

interface WebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing configuration to edit; omit for create mode. */
  configuration?: WebhookConfiguration | null;
}

function headersToText(headers: unknown): string {
  if (!headers || typeof headers !== 'object') return '';
  try {
    return JSON.stringify(headers, null, 2);
  } catch {
    return '';
  }
}

export function WebhookDialog({
  open,
  onOpenChange,
  configuration,
}: WebhookDialogProps) {
  const isEdit = Boolean(configuration);

  const { createWebhookConfiguration, createMutation } =
    useCreateWebhookConfiguration();
  const { updateWebhookConfiguration, updateMutation } =
    useUpdateWebhookConfiguration();

  const form = useForm<WebhookSchema>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      event_type: undefined,
      url: '',
      headers: '',
    },
  });

  // Reset the form to the target configuration whenever the dialog opens or the
  // configuration changes; clear it when the dialog closes.
  React.useEffect(() => {
    if (open) {
      form.reset({
        event_type: configuration?.event_type ?? undefined,
        url: configuration?.url ?? '',
        headers: headersToText(configuration?.headers),
      });
    } else {
      form.reset({ event_type: undefined, url: '', headers: '' });
    }
  }, [open, configuration, form]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: WebhookSchema) => {
    const headers = values.headers
      ? (JSON.parse(values.headers) as Record<string, unknown>)
      : undefined;

    try {
      if (isEdit && configuration) {
        await updateWebhookConfiguration(configuration.id, {
          event_type: values.event_type,
          url: values.url,
          headers,
        });
        toast.success('Webhook updated');
      } else {
        await createWebhookConfiguration({
          event_type: values.event_type,
          url: values.url,
          headers,
        });
        toast.success('Webhook created');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        isEdit ? 'Failed to update webhook' : 'Failed to create webhook',
        {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit webhook' : 'New webhook'}</DialogTitle>
          <DialogDescription>
            Webhooks deliver an HTTP POST to your URL when the selected event
            occurs.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <FormLayout onSubmit={form.handleSubmit(onSubmit)} gap={4} noValidate>
            <FormField
              control={form.control}
              name='event_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid='webhook-event-type'>
                        <SelectValue placeholder='Select an event' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WEBHOOK_EVENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payload URL</FormLabel>
                  <FormControl>
                    <Input
                      type='url'
                      placeholder='https://example.com/webhook'
                      autoComplete='off'
                      data-testid='webhook-url'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='headers'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom headers (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='{ "Authorization": "Bearer …" }'
                      // shadcn Textarea has no family/size props.
                      className='font-mono text-sm'
                      rows={4}
                      data-testid='webhook-headers'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A JSON object of headers sent with each delivery.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isPending}
                data-testid='webhook-submit'
              >
                {isPending
                  ? isEdit
                    ? 'Saving…'
                    : 'Creating…'
                  : isEdit
                    ? 'Save changes'
                    : 'Create webhook'}
              </Button>
            </DialogFooter>
          </FormLayout>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
