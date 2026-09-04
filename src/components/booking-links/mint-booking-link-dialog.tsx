'use client';

/**
 * MintBookingLinkDialog — mint a shareable scheduling link for a calendar or
 * calendar group, show it exactly once, and offer to revoke it.
 *
 * Two-phase dialog, mirroring `NewTokenDialog`
 * (@/components/api-tokens/new-token-dialog.tsx), the repo's other one-time
 * plaintext-credential mint flow:
 *   Phase 1 (form view): optional expiry, and — for a calendar target only —
 *     an advisory duration. A group target shows no duration control; the
 *     group's own server-pinned duration applies instead (see the plan's
 *     "Group duration comes from the server" guiding decision).
 *   Phase 2 (reveal view): the built URL, a copy button, an explicit
 *     "cannot be shown again" notice, and a revoke action — all while the
 *     dialog still holds the minted id. A third state (revoked) replaces the
 *     URL with a plain "this link no longer works" notice once revoke
 *     succeeds.
 *
 * SECURITY invariants (this is the phase's single most important file):
 *   - The plaintext `code` returned by `createBookingCode` is used ONLY to
 *     build `mintedLink.url` (via `buildBookingLinkUrl`) in local component
 *     state. It is never assigned to any other variable, never logged, never
 *     written to `localStorage` / `sessionStorage`, and never survives past
 *     this dialog closing.
 *   - `createBookingCodeMutation.data` retains the full
 *     `BookingCodeCreateResult` (including plaintext `code`) in TanStack
 *     Query's mutation cache even after this component's local state is
 *     cleared — visible via React Query Devtools for as long as the
 *     mutation's `gcTime` keeps it. The close effect below calls `.reset()`
 *     on both mutations to drop that copy, exactly as `NewTokenDialog` does
 *     for its credential.
 *   - Minting is a UI affordance gated by `canMintBookingLinkForCalendar` /
 *     `canMintBookingLinkForGroup` at the call site (the row action), never
 *     re-derived here — this component trusts its caller decided it should
 *     be reachable, and the server re-checks the real rule regardless.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Copy, CheckCheck, TriangleAlert, Ban } from 'lucide-react';
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormRootMessage,
} from 'vinta-schedule-design-system/ui/form';
import { Alert, AlertDescription } from 'vinta-schedule-design-system/ui/alert';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  VStack,
  HStack,
  Text,
  FormLayout,
} from 'vinta-schedule-design-system/layout';
import type { BookingCodeCreate } from '@/client';
import { useCreateBookingCode } from '@/hooks/booking-codes/use-create-booking-code';
import { useRevokeBookingCode } from '@/hooks/booking-codes/use-revoke-booking-code';
import { useCurrentOrganization } from '@/hooks/organizations/use-current-organization';
import { buildBookingLinkUrl } from '@/lib/booking-links/build-url';
import type { MintedBookingLink } from '@/lib/booking-links/types';
import { handleMutationError } from '@/lib/utils/form-errors';
// Reused rather than re-implemented: the {value, unit} number+select field and
// its "0 means unconstrained" convention already exist for booking-policy rule
// fields, and a single-calendar link's duration is advisory in exactly the
// same "0 = don't send a constraint" sense (see the plan's "Single-calendar
// duration is advisory" guiding decision).
import {
  DurationFormField,
  durationFieldSchema,
  ZERO_DURATION,
} from '@/components/booking-policies/rule-fields';
import { durationToSeconds } from '@/components/booking-policies/duration';

export type MintBookingLinkTarget =
  | { kind: 'calendar'; id: number; name: string }
  | { kind: 'group'; id: number; name: string };

export interface MintBookingLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MintBookingLinkTarget;
}

// ---------------------------------------------------------------------------
// Zod schema — expiry is a plain <input type="datetime-local"> value (or ''
// for "never expires"); duration is only read for a calendar target.
// ---------------------------------------------------------------------------

const mintFormSchema = z.object({
  expiresAt: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
      message: 'Enter a valid date and time',
    })
    .refine((value) => value === '' || Date.parse(value) > Date.now(), {
      message: 'Expiration must be in the future',
    }),
  duration: durationFieldSchema,
});

type MintFormValues = z.infer<typeof mintFormSchema>;

const DEFAULT_VALUES: MintFormValues = {
  expiresAt: '',
  duration: { ...ZERO_DURATION },
};

export function MintBookingLinkDialog({
  open,
  onOpenChange,
  target,
}: MintBookingLinkDialogProps) {
  const { createBookingCode, createBookingCodeMutation } =
    useCreateBookingCode();
  const { revokeBookingCode, revokeBookingCodeMutation } =
    useRevokeBookingCode();
  // Used only to resolve the active org's slug for the branded URL
  // (`buildBookingLinkUrl`'s `slug` param) — never sent to the mint call
  // itself, which is org-scoped by the shared authenticated client already.
  const { organization } = useCurrentOrganization();
  const rawSlug = organization?.slug;
  const slug = typeof rawSlug === 'string' ? rawSlug : undefined;

  const form = useForm<MintFormValues>({
    resolver: zodResolver(mintFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // ---------------------------------------------------------------------------
  // SECURITY: one-time plaintext link — local state only. Cleared on close.
  // Never logged. Never cached beyond this component. Never persisted.
  // ---------------------------------------------------------------------------
  const [mintedLink, setMintedLink] = React.useState<MintedBookingLink | null>(
    null
  );
  const [isRevoked, setIsRevoked] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Reset all local + mutation state when the dialog closes. See the
  // file-level SECURITY comment for why both mutations are explicitly
  // `.reset()` — `.reset` (not the mutation object) is the effect dependency
  // because it keeps a stable identity across renders, unlike the mutation
  // object itself (see NewTokenDialog for the identical reasoning and the
  // re-render-loop regression it guards against).
  const resetCreateMutation = createBookingCodeMutation.reset;
  const resetRevokeMutation = revokeBookingCodeMutation.reset;
  React.useEffect(() => {
    if (!open) {
      form.reset(DEFAULT_VALUES);
      setMintedLink(null);
      setIsRevoked(false);
      setCopied(false);
      resetCreateMutation();
      resetRevokeMutation();
    }
  }, [open, form, resetCreateMutation, resetRevokeMutation]);

  const isPending = createBookingCodeMutation.isPending;
  const isRevokePending = revokeBookingCodeMutation.isPending;
  const isRevealView = mintedLink !== null;

  const targetLabel = target.kind === 'calendar' ? 'calendar' : 'group';

  const onSubmit = async (values: MintFormValues) => {
    const expiresAt =
      values.expiresAt !== ''
        ? new Date(values.expiresAt).toISOString()
        : undefined;
    const durationSeconds =
      target.kind === 'calendar' ? durationToSeconds(values.duration) : 0;

    const body: BookingCodeCreate =
      target.kind === 'calendar'
        ? { purpose: 'book', calendar: target.id, expires_at: expiresAt }
        : { purpose: 'book', calendar_group: target.id, expires_at: expiresAt };

    try {
      const result = await createBookingCode(body);
      const url = buildBookingLinkUrl({
        code: result.code,
        purpose: result.purpose,
        slug,
        scope:
          target.kind === 'calendar'
            ? {
                kind: 'calendar',
                durationSeconds:
                  durationSeconds > 0 ? durationSeconds : undefined,
              }
            : { kind: 'group' },
      });
      // The ONLY place `result.code` is read. From here on, only `url`
      // (which embeds it) is retained, in local state that is cleared on
      // close.
      setMintedLink({
        id: result.id,
        purpose: result.purpose,
        url,
        expiresAt: result.expires_at,
        durationSeconds:
          target.kind === 'calendar' && durationSeconds > 0
            ? durationSeconds
            : null,
      });
    } catch (err) {
      handleMutationError(err, { title: 'Failed to generate link', form });
    }
  };

  const handleCopy = async () => {
    if (!mintedLink) return;
    try {
      await navigator.clipboard.writeText(mintedLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link to clipboard.');
    }
  };

  const handleRevoke = async () => {
    if (!mintedLink) return;
    try {
      await revokeBookingCode(mintedLink.id);
      setIsRevoked(true);
      toast.success('Link revoked', {
        description: 'The link no longer works for anyone holding it.',
      });
    } catch (err) {
      handleMutationError(err, { title: 'Failed to revoke link' });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {isRevealView ? (
          <>
            <DialogHeader>
              <DialogTitle>Scheduling link created</DialogTitle>
            </DialogHeader>

            <VStack gap={4}>
              {isRevoked ? (
                <Alert variant='destructive' data-testid='revoked-notice'>
                  <Icon icon={Ban} size='sm' />
                  <AlertDescription>
                    This link has been revoked. It no longer works for anyone
                    holding it.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant='warning' data-testid='one-time-reveal-notice'>
                  <Icon icon={TriangleAlert} size='sm' />
                  <AlertDescription>
                    Copy this link now — it cannot be shown again once this
                    dialog closes.
                  </AlertDescription>
                </Alert>
              )}

              <VStack gap={1}>
                <Text size='sm' color='muted-foreground'>
                  Scheduling link
                </Text>
                <HStack gap={2}>
                  <Input
                    readOnly
                    disabled={isRevoked}
                    value={mintedLink.url}
                    className='font-mono text-sm'
                    data-testid='booking-link-url-input'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    disabled={isRevoked}
                    onClick={handleCopy}
                    aria-label='Copy scheduling link to clipboard'
                    data-testid='copy-booking-link-button'
                  >
                    {copied ? <CheckCheck /> : <Copy />}
                  </Button>
                </HStack>
                {mintedLink.expiresAt ? (
                  <Text size='sm' color='muted-foreground'>
                    Expires {new Date(mintedLink.expiresAt).toLocaleString()}
                  </Text>
                ) : (
                  <Text size='sm' color='muted-foreground'>
                    This link does not expire.
                  </Text>
                )}
              </VStack>
            </VStack>

            <DialogFooter>
              {!isRevoked && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleRevoke}
                  disabled={isRevokePending}
                  className='text-destructive hover:text-destructive'
                  data-testid='revoke-booking-link-button'
                >
                  {isRevokePending ? 'Revoking…' : 'Revoke link'}
                </Button>
              )}
              <Button
                type='button'
                onClick={handleClose}
                data-testid='done-button'
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New scheduling link</DialogTitle>
              <DialogDescription>
                Generate a shareable booking link for the {targetLabel}{' '}
                <Text as='span' weight='medium'>
                  {target.name}
                </Text>
                . The link can be copied and revoked once, but never shown again
                after this dialog closes.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <FormRootMessage />
              <FormLayout
                onSubmit={form.handleSubmit(onSubmit)}
                gap={4}
                noValidate
              >
                <FormField
                  control={form.control}
                  name='expiresAt'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expires (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type='datetime-local'
                          {...field}
                          data-testid='expires-at-input'
                        />
                      </FormControl>
                      <FormDescription>
                        Leave blank for a link with no expiration.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {target.kind === 'calendar' ? (
                  <FormField
                    control={form.control}
                    name='duration'
                    render={({ field }) => (
                      <DurationFormField
                        field={field}
                        label='Booking duration'
                        description='Advisory only — anyone holding the link can change it in the URL. Set to 0 for no suggested length. To enforce a duration server-side, wrap this calendar in a one-slot group and set the group duration instead.'
                      />
                    )}
                  />
                ) : (
                  <Text size='sm' color='muted-foreground'>
                    This group&apos;s own duration applies to every booking made
                    through this link — there is no per-link duration for a
                    group target.
                  </Text>
                )}

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
                    data-testid='create-booking-link-submit'
                  >
                    {isPending ? 'Generating…' : 'Generate link'}
                  </Button>
                </DialogFooter>
              </FormLayout>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
