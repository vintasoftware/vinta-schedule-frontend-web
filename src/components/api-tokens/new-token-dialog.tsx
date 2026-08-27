'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Copy, CheckCheck, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Checkbox } from 'vinta-schedule-design-system/ui/checkbox';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { Alert, AlertDescription } from 'vinta-schedule-design-system/ui/alert';
import { Label } from 'vinta-schedule-design-system/ui/label';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  VStack,
  HStack,
  Text,
  FormLayout,
} from 'vinta-schedule-design-system/layout';
import type { AvailableResourcesEnum } from '@/client';
import { useCreatePublicApiToken } from '@/hooks/api-tokens/use-public-api-tokens';
import { usePublicApiScopes } from '@/hooks/api-tokens/use-public-api-scopes';

// ---------------------------------------------------------------------------
// Zod schema
//
// The set of selectable scopes comes from `GET /public-api-docs/scopes/` at
// runtime, so it cannot be a `z.enum` over a compile-time list — this file used
// to carry one, and it had drifted to 17 of the backend's 50+ resources, making
// every scope added since un-grantable from this dialog.
//
// `z.custom` keeps the inferred type as `AvailableResourcesEnum` (the generated
// client types the catalog's `value` as exactly that) while leaving the
// membership check where it now belongs: the checkboxes can only ever produce
// values the API just handed us, and the API validates the list again on POST.
// ---------------------------------------------------------------------------

const newTokenSchema = z.object({
  integration_name: z
    .string()
    .trim()
    .min(1, { message: 'Token name is required' }),
  available_resources: z
    .array(
      z.custom<AvailableResourcesEnum>((value) => typeof value === 'string')
    )
    .min(1, { message: 'At least one scope must be selected' }),
});

type NewTokenSchema = z.infer<typeof newTokenSchema>;

// ---------------------------------------------------------------------------
// NewTokenDialog
//
// Two-phase dialog:
//   Phase 1 (form view): collect integration_name + scope selection.
//   Phase 2 (credential view): show the one-time API credential with copy +
//     warning. The credential is held ONLY in local state; it is cleared from
//     memory when the dialog closes (onOpenChange false triggers reset).
//
// The credential is `${system_user_id}:${token}` — the two halves the
// `Authorization: Bearer <system_user_id>:<token>` header needs, composed
// into one string at display time. The backend never needs them apart (the
// middleware splits on the first `:` itself), so the UI never shows them
// apart either.
//
// SECURITY invariants enforced here:
//   - The credential is composed into `onceCredential` local state immediately
//     after a successful create and displayed in the credential view.
//   - `onceCredential` is cleared to '' when the dialog closes (onOpenChange false).
//   - The mutation state (createPublicApiTokenMutation.data) is also reset on close
//     to drop the retained SystemUserTokenResponse from the QueryClient's in-memory cache.
//   - Without this reset, the full credential (id:token) would remain readable from
//     the mutation's data property via React DevTools, even after the dialog closes.
//   - The credential is never logged (no console.log calls).
//   - The credential is never persisted to localStorage or sessionStorage.
// ---------------------------------------------------------------------------

interface NewTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTokenDialog({ open, onOpenChange }: NewTokenDialogProps) {
  const { createPublicApiToken, createPublicApiTokenMutation } =
    useCreatePublicApiToken();
  const {
    scopes,
    isLoading: isLoadingScopes,
    isError: isScopesError,
  } = usePublicApiScopes();

  const form = useForm<NewTokenSchema>({
    resolver: zodResolver(newTokenSchema),
    defaultValues: {
      integration_name: '',
      available_resources: [],
    },
  });

  // ---------------------------------------------------------------------------
  // SECURITY: one-time plaintext credential — local state only.
  // Cleared when dialog closes (see the useEffect below).
  // Never logged. Never cached. Never persisted.
  // ---------------------------------------------------------------------------
  const [onceCredential, setOnceCredential] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // Reset all local state when the dialog closes.
  //
  // The dependency array uses `createPublicApiTokenMutation.reset` rather
  // than the mutation object itself. TanStack Query returns a new mutation
  // object on every render, but `reset` is bound once when the mutation
  // observer is created and keeps the same identity for the component's
  // lifetime. Depending on the whole object would re-run this effect on
  // every render (because `reset()` itself changes mutation state, which
  // triggers a re-render, which produces a new object), looping forever.
  const resetMutation = createPublicApiTokenMutation.reset;
  React.useEffect(() => {
    if (!open) {
      form.reset();
      // Clear the one-time credential from memory when the dialog closes.
      setOnceCredential('');
      setCopied(false);
      // Reset the mutation state to drop the retained credential data from the
      // query cache. Without this, createPublicApiTokenMutation.data would
      // retain the full SystemUserTokenResponse (including id and token) in
      // memory even though the local onceCredential state is cleared, making it
      // accessible via React DevTools as long as the component is mounted.
      resetMutation();
    }
  }, [open, form, resetMutation]);

  const isPending = createPublicApiTokenMutation.isPending;
  const isCredentialView = onceCredential !== '';
  // Nothing can be granted until the catalog is in hand: with no scopes
  // rendered there is no valid selection to make, and submitting would only
  // earn a 400 for an empty `available_resources`.
  const canSubmit = !isPending && scopes.length > 0;

  // -------------------------------------------------------------------------
  // onSubmit — create the token; compose and capture the credential in local
  // state only.
  // -------------------------------------------------------------------------

  const onSubmit = async (values: NewTokenSchema) => {
    try {
      const result = await createPublicApiToken({
        integration_name: values.integration_name,
        available_resources: values.available_resources,
      });
      // Compose the one-time credential (`<system_user_id>:<token>`) — this
      // is the exact string that goes after `Bearer ` in the Authorization
      // header. Capture it in local state only.
      // This is the ONLY place in the application where `result.token` is held.
      // It will be cleared when the dialog closes.
      setOnceCredential(`${result.id}:${result.token}`);
    } catch (err) {
      toast.error('Failed to create API token', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  // -------------------------------------------------------------------------
  // handleCopy — copy the credential to the clipboard.
  // Never logs the credential.
  // -------------------------------------------------------------------------

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(onceCredential);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy credential to clipboard.');
    }
  };

  // -------------------------------------------------------------------------
  // handleClose — clear the credential and close the dialog.
  // -------------------------------------------------------------------------

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {isCredentialView ? (
          // -----------------------------------------------------------------
          // Credential view: show the composed `<system_user_id>:<token>`
          // credential once, with copy + warning. The credential is in
          // `onceCredential` local state only; cleared on close.
          // -----------------------------------------------------------------
          <>
            <DialogHeader>
              <DialogTitle>API token created</DialogTitle>
            </DialogHeader>

            <VStack gap={4}>
              <Alert variant='warning'>
                <Icon icon={TriangleAlert} size='sm' />
                <AlertDescription>
                  Copy this credential now. You will not be able to see it again
                  after closing this dialog.
                </AlertDescription>
              </Alert>

              <VStack gap={1}>
                <Text size='sm' color='muted-foreground'>
                  API credential
                </Text>
                <Text size='sm' color='muted-foreground'>
                  Paste this whole string after{' '}
                  <Text as='span' family='mono'>
                    Bearer
                  </Text>{' '}
                  in the Authorization header.
                </Text>
                <HStack gap={2}>
                  {/* Input (shadcn) has no font-family prop. */}
                  <Input
                    readOnly
                    value={onceCredential}
                    className='font-mono text-sm'
                    data-testid='token-credential-input'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={handleCopy}
                    aria-label='Copy credential to clipboard'
                    data-testid='copy-token-button'
                  >
                    {copied ? <CheckCheck /> : <Copy />}
                  </Button>
                </HStack>
              </VStack>
            </VStack>

            <DialogFooter>
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
          // -----------------------------------------------------------------
          // Form view: collect name and scopes.
          // -----------------------------------------------------------------
          <>
            <DialogHeader>
              <DialogTitle>New API token</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <FormLayout
                onSubmit={form.handleSubmit(onSubmit)}
                gap={4}
                noValidate
              >
                <FormField
                  control={form.control}
                  name='integration_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token name</FormLabel>
                      <FormControl>
                        <Input
                          type='text'
                          placeholder='My integration'
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='available_resources'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scopes</FormLabel>
                      {isLoadingScopes ? (
                        <Text
                          size='sm'
                          color='muted-foreground'
                          data-testid='scopes-loading'
                        >
                          Loading scopes…
                        </Text>
                      ) : isScopesError ? (
                        <Alert variant='destructive' data-testid='scopes-error'>
                          <Icon icon={TriangleAlert} size='sm' />
                          <AlertDescription>
                            Could not load the available scopes. Close the
                            dialog and try again.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <VStack gap={2} maxHeight={240} overflow='auto'>
                          {scopes.map(({ value, label }) => {
                            const checked = field.value.includes(value);
                            return (
                              <HStack key={value} gap={2} align='center'>
                                <Checkbox
                                  id={`scope-${value}`}
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    if (val) {
                                      field.onChange([...field.value, value]);
                                    } else {
                                      field.onChange(
                                        field.value.filter((v) => v !== value)
                                      );
                                    }
                                  }}
                                  data-testid={`scope-checkbox-${value}`}
                                />
                                {/* Label (shadcn) has no cursor prop. */}
                                <Label
                                  htmlFor={`scope-${value}`}
                                  className='cursor-pointer'
                                >
                                  {label}
                                </Label>
                                {/* The machine value is what goes in the token
                                    and what the GraphQL API checks, so it stays
                                    visible next to the human-readable label. */}
                                <Text
                                  size='sm'
                                  family='mono'
                                  color='muted-foreground'
                                >
                                  {value}
                                </Text>
                              </HStack>
                            );
                          })}
                        </VStack>
                      )}
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
                    disabled={!canSubmit}
                    data-testid='create-token-submit'
                  >
                    {isPending ? 'Creating…' : 'Create token'}
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
