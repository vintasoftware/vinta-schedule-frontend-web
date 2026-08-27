'use client';

/**
 * GroupQuotaRules — the group-scoped quota rules for one calendar in one
 * slot (Phase 5). A rule caps how many live bookings the calendar may take
 * through this group slot per day, week, or month; the model enforces one
 * rule per `(calendar, slot, period)`, so a calendar may hold a daily AND a
 * weekly rule at once (see the handoff doc, section 3).
 *
 * Structurally the plainest of the three group-scoped concepts: no
 * recurrence, no time range, no `orphaned_bookings` (a quota rule caps
 * *future* bookings and can never invalidate one already confirmed — see
 * use-group-scoped-quota.ts's doc comment), so this file owns both the row
 * list and the add/edit form itself rather than splitting them the way
 * GroupBlockList/GroupBlockForm do.
 *
 * TWO DISTINCT ERROR SHAPES matter here, both handled inline in the form so
 * the admin's in-progress edit stays on screen to fix and retry:
 *  - `non_field_errors` (400) — the one-rule-per-period uniqueness
 *    constraint. `readNonFieldError` reads the server's own message; this
 *    component surfaces that message VERBATIM rather than inventing its own
 *    copy for it (spec: "surfaced on the form", not a toast-and-forget).
 *  - the shared over-limit body (402) — quota writes are NOT metered
 *    (creating a rule never counts against a plan limit), but a RESTRICTED
 *    billing organization still rejects with the same 402 shape every other
 *    group-scoped write uses. `readOverLimitError`/`OverLimitAlert` are
 *    reused unchanged, same as group-block-form.tsx's over-limit handling.
 *
 * No consumption indicator anywhere in this file, by design (spec's
 * Non-goals + handoff doc): no endpoint reports how much of a rule's cap is
 * currently used, and inferring one client-side would be wrong in ways an
 * admin could not detect.
 */

import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from 'vinta-schedule-design-system/ui/dialog';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import {
  FormLayout,
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { useGroupScopedQuota } from '@/hooks/calendar-groups/use-group-scoped-quota';
import {
  getApiErrorMessage,
  readNonFieldError,
  readOverLimitError,
} from '@/lib/utils/api-errors';
import { useCanEditCalendar } from './group-permissions-provider';
import { OverLimitAlert } from './over-limit-alert';
import type { GroupScopedQuotaRule, PeriodEnum } from '@/client';

import { handleMutationError } from '@/lib/utils/form-errors';

const PERIOD_LABELS: Record<PeriodEnum, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const quotaRuleFormSchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  // `min(1)` is enforced client-side so an obviously invalid cap (0 or
  // negative) never reaches the server -- the API's own floor is the same
  // value, but the admin should see the rejection instantly, not round-trip
  // a request to learn it.
  cap: z.number().int().min(1, { message: 'Cap must be at least 1' }),
});

type QuotaRuleFormValues = z.infer<typeof quotaRuleFormSchema>;

function ruleToFormValues(rule: GroupScopedQuotaRule): QuotaRuleFormValues {
  return { period: rule.period, cap: rule.cap };
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

interface GroupQuotaRuleFormProps {
  groupId: number;
  slotId: number;
  calendarId: number;
  /** Existing rule to edit; omit (or pass undefined) for create mode. */
  rule?: GroupScopedQuotaRule;
  onSaved?: () => void;
  onCancel?: () => void;
}

function GroupQuotaRuleForm({
  groupId,
  slotId,
  calendarId,
  rule,
  onSaved,
  onCancel,
}: GroupQuotaRuleFormProps) {
  const isEdit = rule !== undefined;

  const { createQuotaRule, updateQuotaRule } = useGroupScopedQuota({
    groupId,
    slotId,
    calendarId,
    // The list this hook would otherwise fetch is already loaded by the
    // caller (GroupQuotaRules uses the same hook, same query key, so
    // TanStack Query dedupes it) -- this form only needs the mutation
    // functions, not a second read of the list.
    enabled: false,
  });

  const form = useForm<QuotaRuleFormValues>({
    resolver: zodResolver(quotaRuleFormSchema),
    defaultValues: rule ? ruleToFormValues(rule) : { period: 'week', cap: 1 },
  });

  const [isSaving, setIsSaving] = React.useState(false);
  // The uniqueness-constraint message, verbatim from the API's
  // non_field_errors -- see the module doc comment on why this is not
  // reworded here.
  const [formError, setFormError] = React.useState<string | null>(null);
  const [overLimitError, setOverLimitError] = React.useState<ReturnType<
    typeof readOverLimitError
  > | null>(null);

  async function onSubmit(values: QuotaRuleFormValues) {
    setIsSaving(true);
    setFormError(null);
    setOverLimitError(null);
    try {
      if (isEdit && rule) {
        await updateQuotaRule({
          groupId,
          slotId,
          ruleId: rule.id,
          body: { period: values.period, cap: values.cap },
        });
        toast.success('Quota rule updated');
      } else {
        await createQuotaRule({
          groupId,
          slotId,
          body: {
            calendar: calendarId,
            period: values.period,
            cap: values.cap,
          },
        });
        toast.success('Quota rule created');
      }
      onSaved?.();
    } catch (err) {
      const nonFieldMessage = readNonFieldError(err);
      const overLimit = readOverLimitError(err);
      if (nonFieldMessage) {
        // Rendered inline, form stays open -- the one-rule-per-period
        // constraint (spec's form-level message requirement).
        setFormError(nonFieldMessage);
      } else if (overLimit) {
        setOverLimitError(overLimit);
      } else {
        toast.error(
          isEdit
            ? 'Failed to update quota rule'
            : 'Failed to create quota rule',
          {
            description: getApiErrorMessage(err, 'Unknown error'),
          }
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <FormLayout gap={4} onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField
          control={form.control}
          name='period'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Period</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isSaving}
              >
                <FormControl>
                  <SelectTrigger data-testid='quota-period-select'>
                    <SelectValue placeholder='Select a period' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='day'>Day</SelectItem>
                  <SelectItem value='week'>Week</SelectItem>
                  <SelectItem value='month'>Month</SelectItem>
                </SelectContent>
              </Select>
              {/* Load-bearing copy, not a nicety -- the backend measures
                  day/week/month boundaries in UTC, not this calendar's local
                  timezone (a documented v1 simplification). An admin who
                  assumes a local-midnight reset reads the real boundary as a
                  bug without this. */}
              <FormDescription>
                Day, week, and month boundaries are measured in UTC, not this
                calendar&apos;s local timezone.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='cap'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cap</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={1}
                  {...field}
                  disabled={isSaving}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormDescription>
                Maximum live bookings this calendar may take through this group
                slot within one period.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {formError && (
          <Alert variant='destructive' data-testid='quota-form-error'>
            <AlertTitle>Couldn&apos;t save this rule</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {overLimitError && <OverLimitAlert error={overLimitError} />}

        <HStack gap={3} justify='end'>
          {onCancel && (
            <Button
              type='button'
              variant='outline'
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
          <Button
            type='submit'
            disabled={isSaving}
            data-testid='quota-rule-submit'
          >
            {isSaving
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Add rule'}
          </Button>
        </HStack>
      </FormLayout>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface QuotaRuleRowProps {
  rule: GroupScopedQuotaRule;
  readOnly: boolean;
  isDeleting: boolean;
  onEdit: (rule: GroupScopedQuotaRule) => void;
  onDelete: (id: number) => void;
}

function QuotaRuleRow({
  rule,
  readOnly,
  isDeleting,
  onEdit,
  onDelete,
}: QuotaRuleRowProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <HStack
      gap={3}
      justify='between'
      align='center'
      p={3}
      border
      radius='md'
      data-testid={`quota-rule-${rule.id}`}
    >
      <Text size='sm' weight='medium'>
        {rule.cap} booking{rule.cap === 1 ? '' : 's'} per{' '}
        {PERIOD_LABELS[rule.period].toLowerCase()}
      </Text>
      {!readOnly && (
        <HStack gap={1}>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => onEdit(rule)}
            aria-label={`Edit quota rule ${rule.id}`}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => setConfirmOpen(true)}
            disabled={isDeleting}
            aria-label={`Delete quota rule ${rule.id}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </HStack>
      )}

      {!readOnly && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete quota rule</AlertDialogTitle>
              <AlertDialogDescription>
                {/* Confirm on every delete: removing a quota rule uncaps the
                    calendar for every future period immediately, affecting
                    all future bookings (same reasoning as group-block-list's
                    recurring-block confirmation). */}
                This removes the {PERIOD_LABELS[rule.period].toLowerCase()} cap
                of {rule.cap} for this calendar in this slot. This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(rule.id);
                  setConfirmOpen(false);
                }}
                disabled={isDeleting}
                // shadcn internal: AlertDialogAction hardcodes buttonVariants()
                // and exposes no `variant` prop, so the destructive surface
                // can only be set through className (see group-block-list.tsx).
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                Delete rule
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface GroupQuotaRulesProps {
  groupId: number;
  slotId: number;
  calendarId: number;
}

export function GroupQuotaRules({
  groupId,
  slotId,
  calendarId,
}: GroupQuotaRulesProps) {
  // Read-only-ness comes from the shared GroupPermissionsProvider context
  // (mounted by the group detail page) -- the same predicate every roster
  // row/editor in this feature consumes.
  const readOnly = !useCanEditCalendar(calendarId);

  const { rules, isLoading, isTruncated, deleteQuotaRule } =
    useGroupScopedQuota({ groupId, slotId, calendarId });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] =
    React.useState<GroupScopedQuotaRule | null>(null);
  const [pendingIds, setPendingIds] = React.useState<Set<number>>(new Set());

  const openCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };
  const openEdit = (rule: GroupScopedQuotaRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleSaved = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleDelete = React.useCallback(
    async (id: number) => {
      setPendingIds((prev) => new Set(prev).add(id));
      try {
        const result = await deleteQuotaRule({ groupId, slotId, ruleId: id });
        if (result.status === 'row_gone') {
          toast.info('This entry no longer exists', {
            description: 'It may have already been removed.',
          });
        }
      } catch (err) {
        handleMutationError(err, { title: 'Failed to delete quota rule' });
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [deleteQuotaRule, groupId, slotId]
  );

  if (isLoading) {
    return (
      <Stack gap={2} aria-label='Loading quota rules'>
        <Skeleton height={24} width='full' radius='md' />
      </Stack>
    );
  }

  return (
    <VStack gap={3} data-testid='group-quota-rules'>
      <HStack justify='between' align='center'>
        <Text size='sm' weight='medium' color='foreground'>
          Quota rules
        </Text>
        {!readOnly && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={openCreate}
          >
            Add rule
          </Button>
        )}
      </HStack>

      {isTruncated && (
        <Text size='xs' color='warning'>
          This calendar has more quota rules in this slot than can be loaded at
          once -- some rows may not be shown below.
        </Text>
      )}

      {rules.length === 0 ? (
        <Text size='sm' color='muted-foreground'>
          No quota rules configured.
        </Text>
      ) : (
        <Stack gap={2}>
          {rules.map((rule) => (
            <QuotaRuleRow
              key={rule.id}
              rule={rule}
              readOnly={readOnly}
              isDeleting={pendingIds.has(rule.id)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}

      {!readOnly && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit quota rule' : 'Add quota rule'}
              </DialogTitle>
              <DialogDescription>
                Caps bookings made through this group slot only -- base
                availability and every other group are unaffected.
              </DialogDescription>
            </DialogHeader>
            {/* Conditionally mounted (not just visually hidden) so switching
                between "create" and editing rule A vs rule B always gives
                GroupQuotaRuleForm a fresh mount -- same convention as
                group-block-list.tsx's GroupBlockForm mount. */}
            {dialogOpen && (
              <GroupQuotaRuleForm
                key={editingRule?.id ?? 'create'}
                groupId={groupId}
                slotId={slotId}
                calendarId={calendarId}
                rule={editingRule ?? undefined}
                onSaved={handleSaved}
                onCancel={() => setDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </VStack>
  );
}
