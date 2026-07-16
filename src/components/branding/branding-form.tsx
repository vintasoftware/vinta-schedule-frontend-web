'use client';

import * as React from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Box,
  Flex,
  Stack,
  HStack,
  VStack,
  Heading,
  Text,
  FormLayout,
} from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Card } from 'vinta-schedule-design-system/ui/card';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from 'vinta-schedule-design-system/ui/form';
import { useUpdateBranding } from '@/hooks/branding/use-update-branding';
import type { OrganizationBranding } from '@/client';
import { BrandingPreview } from './branding-preview';

// ---------------------------------------------------------------------------
// Zod schema — mirrors the OrganizationBranding serializer's validation rules.
// ---------------------------------------------------------------------------

const hexColorSchema = z
  .string()
  .regex(
    /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/,
    'Must be a hex color: #RRGGBB or #RRGGBBAA'
  );

export const brandingSchema = z.object({
  app_name: z.string().trim().min(1, { message: 'App name is required' }),
  logo_url: z
    .string()
    .trim()
    .url({ message: 'Must be a valid URL' })
    .or(z.literal(''))
    .optional(),
  primary_color: hexColorSchema.or(z.literal('')).optional(),
  secondary_color: hexColorSchema.or(z.literal('')).optional(),
  support_email: z
    .string()
    .trim()
    .email({ message: 'Must be a valid email address' })
    .or(z.literal(''))
    .optional(),
  return_url_allowlist: z
    .array(
      z.object({
        value: z
          .string()
          .trim()
          .url({ message: 'Each entry must be a valid URL' }),
      })
    )
    .optional(),
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

// ---------------------------------------------------------------------------
// Helpers — convert between the flat OrganizationBranding type and the form's
// return_url_allowlist shape (array of { value } objects for useFieldArray).
// ---------------------------------------------------------------------------

function toFormValues(
  branding: OrganizationBranding | null
): BrandingFormValues {
  return {
    app_name: branding?.app_name ?? '',
    logo_url: branding?.logo_url ?? '',
    primary_color: branding?.primary_color ?? '',
    secondary_color: branding?.secondary_color ?? '',
    support_email: branding?.support_email ?? '',
    return_url_allowlist: (branding?.return_url_allowlist ?? []).map((url) => ({
      value: url,
    })),
  };
}

function toPayload(values: BrandingFormValues): OrganizationBranding {
  return {
    app_name: values.app_name,
    logo_url: values.logo_url || undefined,
    primary_color: values.primary_color || undefined,
    secondary_color: values.secondary_color || undefined,
    support_email: values.support_email || undefined,
    return_url_allowlist: (values.return_url_allowlist ?? [])
      .map((e) => e.value)
      .filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// BrandingFormProps
// ---------------------------------------------------------------------------

export interface BrandingFormProps {
  /**
   * Initial branding values to prefill. Pass null for the "not yet configured"
   * (first-write) state — the form renders with empty defaults.
   */
  initialBranding?: OrganizationBranding | null;
}

// ---------------------------------------------------------------------------
// BrandingForm
// ---------------------------------------------------------------------------

export function BrandingForm({ initialBranding = null }: BrandingFormProps) {
  const { updateBranding, updateBrandingMutation } = useUpdateBranding();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: toFormValues(initialBranding),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'return_url_allowlist',
  });

  // Live-preview values — watch individual fields so the preview updates as the
  // user types (no submit needed to see how it looks). useWatch avoids the
  // React Compiler "incompatible library" warning triggered by form.watch().
  const watchedAppName = useWatch({ control: form.control, name: 'app_name' });
  const watchedLogoUrl = useWatch({ control: form.control, name: 'logo_url' });
  const watchedPrimaryColor = useWatch({
    control: form.control,
    name: 'primary_color',
  });
  const watchedSecondaryColor = useWatch({
    control: form.control,
    name: 'secondary_color',
  });

  const onSubmit = async (values: BrandingFormValues) => {
    setSubmitError(null);
    try {
      await updateBranding(toPayload(values));
      toast.success('Branding saved', {
        description: 'Your branding settings have been updated.',
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save branding settings.'
      );
    }
  };

  return (
    // TODO(ds-gap): the `@3xl:` container-query breakpoints have no prop form —
    // Responsive<T> only covers the viewport breakpoints (base/sm/md/lg/xl).
    <HStack gap={8} align='start' className='flex-col @3xl:flex-row'>
      {/* ------------------------------------------------------------------ */}
      {/* Left column — form                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Stack gap={6} grow shrink basis={0} minWidth={0}>
        <Form {...form}>
          <FormLayout onSubmit={form.handleSubmit(onSubmit)} gap={6} noValidate>
            {/* App Name */}
            <FormField
              control={form.control}
              name='app_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App name</FormLabel>
                  <FormControl>
                    <Input type='text' placeholder='MyScheduler' {...field} />
                  </FormControl>
                  <FormDescription>
                    The name displayed in authentication pages and emails.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Logo URL */}
            <FormField
              control={form.control}
              name='logo_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input
                      type='url'
                      placeholder='https://example.com/logo.png'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Publicly accessible URL for your logo image.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Colors */}
            <Flex
              gap={4}
              align='center'
              direction={{ base: 'column', sm: 'row' }}
            >
              <Box grow shrink basis={0} minWidth={0}>
                <FormField
                  control={form.control}
                  name='primary_color'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary color</FormLabel>
                      <FormControl>
                        <Input type='text' placeholder='#1B4DFF' {...field} />
                      </FormControl>
                      <FormDescription>#RRGGBB or #RRGGBBAA</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Box>
              <Box grow shrink basis={0} minWidth={0}>
                <FormField
                  control={form.control}
                  name='secondary_color'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary color</FormLabel>
                      <FormControl>
                        <Input type='text' placeholder='#0D1F6B' {...field} />
                      </FormControl>
                      <FormDescription>#RRGGBB or #RRGGBBAA</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Box>
            </Flex>

            {/* Support Email */}
            <FormField
              control={form.control}
              name='support_email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Support email</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='support@example.com'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    From/reply-to address on branded transactional emails.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Return URL Allowlist */}
            <VStack gap={3}>
              <Stack gap={1}>
                <Text size='sm' leading='none' weight='medium'>
                  Return URL allowlist
                </Text>
                <Text size='sm' color='muted-foreground'>
                  Allowed redirect URLs after OAuth flows.
                </Text>
              </Stack>
              {fields.map((field, index) => (
                <HStack key={field.id} gap={2} align='start'>
                  <Box grow shrink basis={0} minWidth={0}>
                    <FormField
                      control={form.control}
                      name={`return_url_allowlist.${index}.value`}
                      render={({ field: inputField }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type='url'
                              placeholder='https://example.com/auth/callback'
                              {...inputField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </Box>
                  <Box shrink={0}>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label='Remove URL'
                      onClick={() => remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </Box>
                </HStack>
              ))}
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => append({ value: '' })}
              >
                <Plus />
                Add URL
              </Button>
            </VStack>

            {submitError && (
              <Alert variant='destructive'>
                <AlertTitle>Save failed</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <HStack justify='end'>
              <Button type='submit' disabled={updateBrandingMutation.isPending}>
                {updateBrandingMutation.isPending ? 'Saving…' : 'Save branding'}
              </Button>
            </HStack>
          </FormLayout>
        </Form>
      </Stack>

      {/* ------------------------------------------------------------------ */}
      {/* Right column — live preview                                         */}
      {/* ------------------------------------------------------------------ */}
      {/* TODO(ds-gap): `@3xl:` container-query width/shrink have no prop form.
          `w-full` must stay a class too — an inline `width` style would beat the
          `@3xl:w-80` class. */}
      <Stack gap={3} className='w-full @3xl:w-80 @3xl:shrink-0'>
        <Heading level={3} size='sm'>
          Live preview
        </Heading>
        {/* Card (shadcn) has no overflow prop; it clips the preview's corners. */}
        <Card padding={0} className='overflow-hidden'>
          <BrandingPreview
            appName={watchedAppName || 'Your App'}
            logoUrl={watchedLogoUrl || undefined}
            primaryColor={watchedPrimaryColor || undefined}
            secondaryColor={watchedSecondaryColor || undefined}
          />
        </Card>
        <Text size='xs' color='muted-foreground'>
          Preview of how your branding appears on the sign-in interstitial.
        </Text>
      </Stack>
    </HStack>
  );
}
