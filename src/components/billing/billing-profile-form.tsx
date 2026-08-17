'use client';

/**
 * BillingProfileForm — create / edit the organization's billing profile
 * (tax document + payer identity + billing address; Phase 6). This is the payer
 * identity a charge is billed against (supports Use-case 3 / objective 2).
 *
 * CREATE vs UPDATE is decided by whether a profile already exists: the read
 * (`useBillingProfile`) answers `404` for a brand-new org, which surfaces as an
 * absent profile → the form starts empty and POSTs on submit. When a profile
 * exists it prefills and PATCHes (partial update — see use-update-billing-profile).
 *
 * 409-ON-CREATE is handled gracefully: another admin may have created the profile
 * between this form's read and its submit. The API answers `409`; we narrow it to
 * a genuine profile-already-exists conflict (a 403 admin-gate, a 429 throttle, or
 * a 5xx that also carries a `detail` must NOT take this branch — they fall through
 * to the error toast), surface "a billing profile already exists", and refetch.
 * The refetch resolves the now-existing profile and flips the form into the update
 * path — this REPLACES the user's unsaved edits with the existing server profile,
 * so the alert tells them to review the loaded values and re-save.
 *
 * ROLE GATING is defense-in-depth: billing-profile writes are org-admin only
 * server-side (reads are open to any member). A non-admin sees a READ-ONLY view
 * of the profile values with no inputs and no submit; the server `403` on the
 * write endpoints is the real backstop.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import {
  Center,
  Flex,
  Grid,
  Stack,
  Text,
  VStack,
  FormLayout,
} from 'vinta-schedule-design-system/layout';

import type {
  BillingProfile,
  BillingProfileWritable,
  BillingAddressWritable,
  BillingProfileDocumentTypeEnum,
} from '@/client';
import { useBillingProfile } from '@/hooks/billing/use-billing-profile';
import { useCreateBillingProfile } from '@/hooks/billing/use-create-billing-profile';
import { useUpdateBillingProfile } from '@/hooks/billing/use-update-billing-profile';
import { useRole } from '@/components/navigation/role-gate';
import {
  readBillingConflict,
  type BillingConflictBody,
} from '@/lib/utils/api-errors';

// ---------------------------------------------------------------------------
// Zod schema — maps 1:1 to `BillingProfileWritable`.
//   Required: contact_first_name, contact_email (valid email), document_type,
//             document_number, and the address's street_name / street_number /
//             city / state / country / zip_code.
//   Optional: contact_last_name, contact_phone, and the address's neighborhood /
//             address_line_2.
// Every field is edited as a string. On CREATE, optional empties are dropped at
// the API boundary (see `toWritable`) so an empty phone is omitted; on UPDATE a
// cleared optional is sent as "" so the clear round-trips through the PATCH.
// ---------------------------------------------------------------------------

const billingProfileSchema = z.object({
  contact_first_name: z.string().min(1, 'Enter a first name.'),
  contact_last_name: z.string().optional(),
  contact_email: z
    .string()
    .min(1, 'Enter an email.')
    .email('Enter a valid email address.'),
  contact_phone: z.string().optional(),
  document_type: z.string().min(1, 'Enter a document type.'),
  document_number: z.string().min(1, 'Enter a document number.'),
  billing_address: z.object({
    street_name: z.string().min(1, 'Enter a street.'),
    street_number: z.string().min(1, 'Enter a street number.'),
    neighborhood: z.string().optional(),
    address_line_2: z.string().optional(),
    city: z.string().min(1, 'Enter a city.'),
    state: z.string().min(1, 'Enter a state or region.'),
    country: z.string().min(1, 'Enter a country.'),
    zip_code: z.string().min(1, 'Enter a postal code.'),
  }),
});

type BillingProfileSchema = z.infer<typeof billingProfileSchema>;

const EMPTY_VALUES: BillingProfileSchema = {
  contact_first_name: '',
  contact_last_name: '',
  contact_email: '',
  contact_phone: '',
  document_type: '',
  document_number: '',
  billing_address: {
    street_name: '',
    street_number: '',
    neighborhood: '',
    address_line_2: '',
    city: '',
    state: '',
    country: '',
    zip_code: '',
  },
};

function profileToFormValues(profile: BillingProfile): BillingProfileSchema {
  const address = profile.billing_address;
  return {
    contact_first_name: profile.contact_first_name,
    contact_last_name: profile.contact_last_name ?? '',
    contact_email: profile.contact_email,
    contact_phone: profile.contact_phone ?? '',
    document_type: profile.document_type,
    document_number: profile.document_number,
    billing_address: {
      street_name: address.street_name,
      street_number: address.street_number,
      neighborhood: address.neighborhood ?? '',
      address_line_2: address.address_line_2 ?? '',
      city: address.city,
      state: address.state,
      country: address.country,
      zip_code: address.zip_code,
    },
  };
}

/**
 * Trims form values to the API shape. On CREATE, optional fields left blank are
 * omitted (a fresh profile just has no value). On UPDATE, a cleared optional is
 * sent as "" instead of being omitted — an omitted key would leave the old
 * server value in place, so the clear would silently not persist through the
 * PATCH. The writable type accepts "" for these (they're `string` optionals).
 */
function toWritable(
  values: BillingProfileSchema,
  mode: 'create' | 'update'
): BillingProfileWritable {
  // On UPDATE always send the optional (incl. "") so a clear round-trips; on
  // CREATE only send it when non-empty.
  const keepOptional = (value: string | undefined) =>
    mode === 'update' || Boolean(value);
  const address: BillingAddressWritable = {
    street_name: values.billing_address.street_name,
    street_number: values.billing_address.street_number,
    city: values.billing_address.city,
    state: values.billing_address.state,
    country: values.billing_address.country,
    zip_code: values.billing_address.zip_code,
    ...(keepOptional(values.billing_address.neighborhood)
      ? { neighborhood: values.billing_address.neighborhood }
      : {}),
    ...(keepOptional(values.billing_address.address_line_2)
      ? { address_line_2: values.billing_address.address_line_2 }
      : {}),
  };
  return {
    contact_first_name: values.contact_first_name,
    contact_email: values.contact_email,
    document_type: values.document_type as BillingProfileDocumentTypeEnum,
    document_number: values.document_number,
    billing_address: address,
    ...(keepOptional(values.contact_last_name)
      ? { contact_last_name: values.contact_last_name }
      : {}),
    ...(keepOptional(values.contact_phone)
      ? { contact_phone: values.contact_phone }
      : {}),
  };
}

/**
 * Narrows a create-path rejection to a genuine profile-already-exists 409.
 * `readBillingConflict` matches ANY `{ detail }` body, so a `billing-write` 429
 * throttle, the 403 admin-gate backstop, and a 5xx-with-detail would otherwise
 * be misread as "already exists" + refetch. Mirroring how
 * `isPaymentTokenRequiredError` narrows on its message, we only take the
 * conflict branch when the `detail` asserts the profile already exists;
 * everything else falls through to the generic error toast.
 */
function readProfileExistsConflict(error: unknown): BillingConflictBody | null {
  const conflict = readBillingConflict(error);
  if (conflict === null) {
    return null;
  }
  return conflict.detail.toLowerCase().includes('already exists')
    ? conflict
    : null;
}

// ---------------------------------------------------------------------------
// Read-only view (non-admin members)
// ---------------------------------------------------------------------------

function ReadOnlyRow({ label, value }: { label: string; value?: string }) {
  return (
    <VStack gap={1} align='start'>
      <Text size='sm' color='muted-foreground'>
        {label}
      </Text>
      <Text>{value ? value : '—'}</Text>
    </VStack>
  );
}

function ReadOnlyProfile({ profile }: { profile: BillingProfile | null }) {
  if (profile === null) {
    return (
      <Card data-testid='billing-profile-readonly'>
        <CardHeader>
          <CardTitle>Billing profile</CardTitle>
          <CardDescription>
            No billing profile has been set up yet. Ask an organization admin to
            add one.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const address = profile.billing_address;
  const name = [profile.contact_first_name, profile.contact_last_name]
    .filter(Boolean)
    .join(' ');

  return (
    <Card data-testid='billing-profile-readonly'>
      <CardHeader>
        <CardTitle>Billing profile</CardTitle>
        <CardDescription>
          The tax and payer identity charges are billed against. Only an
          organization admin can change it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={5}>
          <Grid columns={{ base: 1, '@md/content': 2 }} gap={4}>
            <ReadOnlyRow label='Contact name' value={name} />
            <ReadOnlyRow label='Contact email' value={profile.contact_email} />
            <ReadOnlyRow label='Contact phone' value={profile.contact_phone} />
            <ReadOnlyRow label='Document type' value={profile.document_type} />
            <ReadOnlyRow
              label='Document number'
              value={profile.document_number}
            />
          </Grid>
          <Grid columns={{ base: 1, '@md/content': 2 }} gap={4}>
            <ReadOnlyRow label='Street' value={address.street_name} />
            <ReadOnlyRow label='Number' value={address.street_number} />
            <ReadOnlyRow label='Neighborhood' value={address.neighborhood} />
            <ReadOnlyRow
              label='Address line 2'
              value={address.address_line_2}
            />
            <ReadOnlyRow label='City' value={address.city} />
            <ReadOnlyRow label='State / region' value={address.state} />
            <ReadOnlyRow label='Country' value={address.country} />
            <ReadOnlyRow label='Postal code' value={address.zip_code} />
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// BillingProfileForm
// ---------------------------------------------------------------------------

export function BillingProfileForm() {
  const { billingProfile, isLoading, billingProfileQuery } =
    useBillingProfile();
  const role = useRole();
  const { createBillingProfile, createBillingProfileMutation } =
    useCreateBillingProfile();
  const { updateBillingProfile, updateBillingProfileMutation } =
    useUpdateBillingProfile();

  const [alreadyExists, setAlreadyExists] = React.useState<string | null>(null);

  const form = useForm<BillingProfileSchema>({
    resolver: zodResolver(billingProfileSchema),
    defaultValues: EMPTY_VALUES,
  });

  // Prefill (or clear) whenever the resolved profile changes — including after a
  // 409-on-create refetch flips an empty form into the update path.
  React.useEffect(() => {
    form.reset(
      billingProfile ? profileToFormValues(billingProfile) : EMPTY_VALUES
    );
  }, [billingProfile, form]);

  // Absent profile (a fresh org's 404) ⇒ create; an existing profile ⇒ update.
  const isUpdate = billingProfile !== null;
  const isPending =
    createBillingProfileMutation.isPending ||
    updateBillingProfileMutation.isPending;

  const onSubmit = async (values: BillingProfileSchema) => {
    const body = toWritable(values, isUpdate ? 'update' : 'create');
    setAlreadyExists(null);
    try {
      if (isUpdate) {
        await updateBillingProfile(body);
        toast.success('Billing profile updated');
      } else {
        await createBillingProfile(body);
        toast.success('Billing profile created');
      }
    } catch (err) {
      // A genuine 409 on create means another admin created the profile
      // meanwhile. Surface it calmly and refetch — the refetch resolves the
      // existing profile and flips this form into the update path, REPLACING the
      // user's unsaved edits with the server values (the alert tells them to
      // review and re-save). A 403/429/5xx that also carries a `detail` is NOT a
      // conflict and falls through to the error toast below.
      const conflict = !isUpdate ? readProfileExistsConflict(err) : null;
      if (conflict) {
        setAlreadyExists(
          conflict.detail || 'A billing profile already exists.'
        );
        void billingProfileQuery.refetch();
        return;
      }
      toast.error(
        isUpdate
          ? 'Failed to update billing profile'
          : 'Failed to create billing profile',
        {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        }
      );
    }
  };

  // Wait for the role signal before deciding the gate — a null (still-loading)
  // role must not flash the read-only view over an admin's editable form.
  if (isLoading || role === null) {
    return (
      <Center grow>
        <Text color='muted-foreground'>Loading…</Text>
      </Center>
    );
  }

  if (role !== 'admin') {
    return <ReadOnlyProfile profile={billingProfile} />;
  }

  return (
    <Card data-testid='billing-profile-form'>
      <CardHeader>
        <CardTitle>
          {isUpdate ? 'Billing profile' : 'Set up your billing profile'}
        </CardTitle>
        <CardDescription>
          The tax document and payer identity charges are billed against.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={6}>
          {alreadyExists !== null && (
            <Alert data-testid='billing-profile-exists'>
              <AlertTitle>A billing profile already exists</AlertTitle>
              <AlertDescription>
                {alreadyExists} We&apos;ve loaded it below — review and save
                your changes.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <FormLayout
              onSubmit={form.handleSubmit(onSubmit)}
              gap={6}
              noValidate
            >
              <Stack gap={4}>
                <Text weight='semibold' size='sm'>
                  Payer contact
                </Text>
                <Grid columns={{ base: 1, '@md/content': 2 }} gap={4}>
                  <FormField
                    control={form.control}
                    name='contact_first_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='contact_last_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='contact_email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type='email' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='contact_phone'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input type='tel' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Grid>
              </Stack>

              <Stack gap={4}>
                <Text weight='semibold' size='sm'>
                  Tax document
                </Text>
                <Grid columns={{ base: 1, '@md/content': 2 }} gap={4}>
                  <FormField
                    control={form.control}
                    name='document_type'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document type</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='document_number'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Grid>
              </Stack>

              <Stack gap={4}>
                <Text weight='semibold' size='sm'>
                  Billing address
                </Text>
                <Grid columns={{ base: 1, '@md/content': 2 }} gap={4}>
                  <FormField
                    control={form.control}
                    name='billing_address.street_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_address.street_number'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_address.neighborhood'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Neighborhood (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_address.address_line_2'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address line 2 (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_address.city'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_address.state'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State / region</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_address.country'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='billing_address.zip_code'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal code</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Grid>
              </Stack>

              <Flex>
                <Button
                  type='submit'
                  disabled={isPending}
                  data-testid='billing-profile-submit'
                >
                  {isPending
                    ? 'Saving…'
                    : isUpdate
                      ? 'Save changes'
                      : 'Create profile'}
                </Button>
              </Flex>
            </FormLayout>
          </Form>
        </Stack>
      </CardContent>
    </Card>
  );
}
