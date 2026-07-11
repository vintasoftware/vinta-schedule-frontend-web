'use client';

/**
 * ExternalEventUpdatePolicyForm — rhf + zod form for the organization's
 * external-event update policy.
 *
 * The policy controls how the app reacts to inbound edits / deletions of
 * synced events made directly in an external provider (e.g. Google Calendar):
 *  - allow          → apply the change directly.
 *  - change_request → route it to the approval workflow on /change-requests.
 *  - forbidden      → auto-undo the change on the provider.
 *
 * Flow:
 *  1. Pre-populate from the current organization's external_event_update_policy.
 *  2. Pick an option; on save, PATCH the organization.
 *  3. On success / error: toast.
 *
 * The save button is disabled while the mutation is pending and while the
 * selection is unchanged.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  RadioGroup,
  RadioGroupItem,
} from 'vinta-schedule-design-system/ui/radio-group';
import { Label } from 'vinta-schedule-design-system/ui/label';
import {
  Form,
  FormField,
  FormItem,
  FormControl,
} from 'vinta-schedule-design-system/ui/form';
import { VStack } from 'vinta-schedule-design-system/layout';
import { useExternalEventUpdatePolicy } from '@/hooks/sync/use-external-event-update-policy';
import type { ExternalEventUpdatePolicyEnum } from '@/client';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const POLICY_OPTIONS: {
  value: ExternalEventUpdatePolicyEnum;
  label: string;
  description: string;
}[] = [
  {
    value: 'allow',
    label: 'Allow direct updates',
    description:
      'Apply edits and deletions made in the external provider directly to the synced event.',
  },
  {
    value: 'change_request',
    label: 'Create change requests',
    description:
      'Route edits and deletions into an approval workflow. Pending requests appear on the Change requests screen for review.',
  },
  {
    value: 'forbidden',
    label: 'Forbid updates',
    description:
      'Automatically undo edits and deletions on the external provider, keeping the synced event unchanged.',
  },
];

// ---------------------------------------------------------------------------
// Zod schema
//
// The values are cast to a non-empty tuple of ExternalEventUpdatePolicyEnum so
// z.enum infers the literal union (an inline string array widens to `{}` under
// zod v4) — same pattern as the webhook event-type form.
// ---------------------------------------------------------------------------

const POLICY_VALUES = POLICY_OPTIONS.map((o) => o.value) as [
  ExternalEventUpdatePolicyEnum,
  ...ExternalEventUpdatePolicyEnum[],
];

const formSchema = z.object({
  external_event_update_policy: z.enum(POLICY_VALUES),
});

type FormSchema = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// ExternalEventUpdatePolicyForm
// ---------------------------------------------------------------------------

export function ExternalEventUpdatePolicyForm() {
  const { policy, saveExternalEventUpdatePolicy, savePolicyMutation } =
    useExternalEventUpdatePolicy();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      external_event_update_policy: policy,
    },
  });

  // Keep the form in sync when the org reloads after a save (or first load).
  React.useEffect(() => {
    form.reset({ external_event_update_policy: policy });
  }, [policy, form]);

  const onSubmit = async (data: FormSchema) => {
    try {
      await saveExternalEventUpdatePolicy(data.external_event_update_policy);
      toast.success('External event update policy saved');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save settings';
      toast.error(message);
    }
  };

  const isPending = savePolicyMutation.isPending;
  // isDirty compares against the reset default (the saved policy), so the Save
  // button stays disabled until the selection actually changes.
  const isUnchanged = !form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <VStack gap={6}>
          <FormField
            control={form.control}
            name='external_event_update_policy'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className='grid gap-3'
                    aria-label='External event update policy'
                  >
                    {POLICY_OPTIONS.map((opt) => (
                      <Label
                        key={opt.value}
                        htmlFor={`policy-${opt.value}`}
                        className='border-border has-[:checked]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-4 leading-snug'
                      >
                        <RadioGroupItem
                          value={opt.value}
                          id={`policy-${opt.value}`}
                          disabled={isPending}
                          className='mt-0.5'
                        />
                        <span className='block'>
                          <span className='font-medium'>{opt.label}</span>
                          <span className='text-muted-foreground mt-0.5 block text-sm font-normal'>
                            {opt.description}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />

          <Button type='submit' disabled={isPending || isUnchanged}>
            {isPending ? 'Saving...' : 'Save settings'}
          </Button>
        </VStack>
      </form>
    </Form>
  );
}
