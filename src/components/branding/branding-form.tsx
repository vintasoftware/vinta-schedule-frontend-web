'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';

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
import { Image } from 'vinta-schedule-design-system/ui/image';
import { Progress } from 'vinta-schedule-design-system/ui/progress';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
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
import {
  useUploadBrandingLogo,
  UploadValidationError,
} from '@/hooks/branding/use-upload-branding-logo';
import { useUpdateOrganizationSlug } from '@/hooks/organizations/use-update-organization-slug';
import type { OrganizationBranding } from '@/client';
import {
  classifyBrandingWriteForbiddenError,
  extractApiErrorDetail,
  type BrandingWriteForbiddenReason,
} from '@/lib/branding-write-errors';
import { BrandingPreview } from './branding-preview';

// ---------------------------------------------------------------------------
// Zod schema — mirrors the OrganizationBranding serializer's validation rules.
// redirect_url checks match organizations.redirect_url_validation (handoff order).
// ---------------------------------------------------------------------------

const hexColorSchema = z
  .string()
  .regex(
    /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/,
    'Must be a hex color: #RRGGBB or #RRGGBBAA'
  );

/** Mirrors the five server redirect_url rules; empty string clears. */
export const redirectUrlSchema = z
  .string()
  .superRefine((raw, ctx) => {
    // 1. No control characters (CR, LF, tab) — checked before trim.
    if (/[\r\n\t]/.test(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must not contain control characters',
      });
      return;
    }

    const val = raw.trim();
    if (val === '') return;

    // 2. HTTPS only (also rejects scheme-confusion values like https:evil.com).
    if (!/^https:\/\//i.test(val)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a valid HTTPS URL',
      });
      return;
    }

    // 3. No wildcard character.
    if (val.includes('*')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must not contain wildcard characters',
      });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(val);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a valid HTTPS URL',
      });
      return;
    }

    // 4. No path-prefix pattern — non-root paths must not end with /.
    const { pathname } = parsed;
    if (pathname !== '/' && pathname.endsWith('/')) {
      ctx.addIssue({
        code: 'custom',
        message: 'URL path must not end with a trailing slash',
      });
      return;
    }

    // 5. Well-formed URL with a host.
    if (!parsed.hostname) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must include a valid host',
      });
    }
  })
  .transform((raw) => raw.trim());

/** Mirrors server slug format rules; reserved words and uniqueness come from 400. */
export const slugSchema = z
  .string()
  .transform((raw) => raw.trim().toLowerCase())
  .superRefine((val, ctx) => {
    if (val === '') return;

    // Confusables — non-ASCII characters are rejected outright.
    if (/[^\x00-\x7F]/.test(val)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must use ASCII letters, numbers, and hyphens only',
      });
      return;
    }

    if (val.length < 3 || val.length > 63) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be between 3 and 63 characters',
      });
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val)) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Must be lowercase letters, numbers, and single hyphens only (no leading, trailing, or consecutive hyphens)',
      });
      return;
    }

    if (/^\d+$/.test(val)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must not be purely numeric',
      });
    }
  });

export const brandingSchema = z.object({
  slug: slugSchema.optional(),
  app_name: z.string().trim().min(1, { message: 'App name is required' }),
  primary_color: hexColorSchema.or(z.literal('')).optional(),
  secondary_color: hexColorSchema.or(z.literal('')).optional(),
  support_email: z
    .string()
    .trim()
    .email({ message: 'Must be a valid email address' })
    .or(z.literal(''))
    .optional(),
  redirect_url: redirectUrlSchema.optional(),
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

function normalizeSlug(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Map DRF `{ slug: ["…"] }` field errors onto the slug input. */
export function extractSlugFieldError(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;

  const slug = (err as Record<string, unknown>).slug;
  if (Array.isArray(slug) && typeof slug[0] === 'string') {
    return slug[0];
  }

  return null;
}

function toFormValues(
  branding: OrganizationBranding | null,
  initialSlug?: string | null
): BrandingFormValues {
  return {
    slug: initialSlug ?? '',
    app_name: branding?.app_name ?? '',
    primary_color: branding?.primary_color ?? '',
    secondary_color: branding?.secondary_color ?? '',
    support_email: branding?.support_email ?? '',
    redirect_url: branding?.redirect_url ?? '',
  };
}

function toPayload(
  values: BrandingFormValues,
  pendingLogoKey: string | null
): OrganizationBranding {
  const payload: OrganizationBranding = {
    app_name: values.app_name,
    primary_color: values.primary_color || undefined,
    secondary_color: values.secondary_color || undefined,
    support_email: values.support_email || undefined,
    redirect_url: values.redirect_url ?? '',
  };

  if (pendingLogoKey !== null) {
    payload.logo_url = pendingLogoKey;
  }

  return payload;
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
  /** Current organization slug from membership.organization.slug. */
  initialSlug?: string | null;
}

// ---------------------------------------------------------------------------
// BrandingForm
// ---------------------------------------------------------------------------

const NO_SLUG_FIELD_MESSAGE =
  'Pick a public slug before saving branding settings.';

export function BrandingForm({
  initialBranding = null,
  initialSlug = null,
}: BrandingFormProps) {
  const { updateBranding, updateBrandingMutation } = useUpdateBranding();
  const { uploadBrandingLogo } = useUploadBrandingLogo();
  const { updateOrganizationSlug, updateOrganizationSlugMutation } =
    useUpdateOrganizationSlug();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const localPreviewUrlRef = React.useRef<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<
    string | undefined
  >(initialBranding?.logo_url ?? undefined);
  /** null = unchanged; "" = cleared; non-empty string = newly uploaded object key. */
  const [pendingLogoKey, setPendingLogoKey] = React.useState<string | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(
    null
  );
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [writeForbiddenReason, setWriteForbiddenReason] =
    React.useState<BrandingWriteForbiddenReason | null>(null);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: toFormValues(initialBranding, initialSlug),
  });

  // Live-preview values — watch individual fields so the preview updates as the
  // user types (no submit needed to see how it looks). useWatch avoids the
  // React Compiler "incompatible library" warning triggered by form.watch().
  const watchedAppName = useWatch({ control: form.control, name: 'app_name' });
  const watchedPrimaryColor = useWatch({
    control: form.control,
    name: 'primary_color',
  });
  const watchedSecondaryColor = useWatch({
    control: form.control,
    name: 'secondary_color',
  });
  const watchedSlug = useWatch({ control: form.control, name: 'slug' });

  const showSlugChangeWarning =
    Boolean(initialSlug) &&
    normalizeSlug(watchedSlug) !== normalizeSlug(initialSlug);

  const isSaving =
    updateBrandingMutation.isPending ||
    updateOrganizationSlugMutation.isPending;

  React.useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
      }
    };
  }, []);

  const revokeLocalPreview = React.useCallback(() => {
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = null;
    }
  }, []);

  const onLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    revokeLocalPreview();
    const localUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = localUrl;
    setLogoPreviewUrl(localUrl);
    setUploadProgress(0);
    setIsUploadingLogo(true);

    try {
      const objectKey = await uploadBrandingLogo(file, (pct) =>
        setUploadProgress(pct)
      );
      setPendingLogoKey(objectKey);
    } catch (err) {
      revokeLocalPreview();
      setLogoPreviewUrl(initialBranding?.logo_url ?? undefined);
      setPendingLogoKey(null);
      if (err instanceof UploadValidationError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to upload logo — please try again');
      }
    } finally {
      setUploadProgress(null);
      setIsUploadingLogo(false);
    }
  };

  const onClearLogo = () => {
    revokeLocalPreview();
    setLogoPreviewUrl(undefined);
    setPendingLogoKey('');
  };

  const focusSlugField = React.useCallback(() => {
    void form.setFocus('slug');
    requestAnimationFrame(() => {
      const slugInput =
        document.querySelector<HTMLInputElement>('input[name="slug"]');
      slugInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [form]);

  const onSubmit = async (values: BrandingFormValues) => {
    setSubmitError(null);
    setWriteForbiddenReason(null);
    const normalizedSlug = normalizeSlug(values.slug);
    const slugNeedsPatch = normalizedSlug !== normalizeSlug(initialSlug);

    try {
      if (slugNeedsPatch) {
        try {
          await updateOrganizationSlug(
            normalizedSlug === '' ? null : normalizedSlug
          );
        } catch (err) {
          const slugError = extractSlugFieldError(err);
          if (slugError) {
            form.setError('slug', { message: slugError });
            return;
          }
          throw err;
        }
      }

      await updateBranding(toPayload(values, pendingLogoKey));
      toast.success('Branding saved', {
        description: 'Your branding settings have been updated.',
      });
      if (pendingLogoKey !== null && pendingLogoKey !== '') {
        setPendingLogoKey(null);
      }
    } catch (err) {
      const forbiddenReason = classifyBrandingWriteForbiddenError(err);
      if (forbiddenReason === 'has_parent') {
        setWriteForbiddenReason('has_parent');
        return;
      }
      if (forbiddenReason === 'not_entitled') {
        setWriteForbiddenReason('not_entitled');
        return;
      }
      if (forbiddenReason === 'no_slug') {
        form.setError('slug', { message: NO_SLUG_FIELD_MESSAGE });
        setWriteForbiddenReason('no_slug');
        focusSlugField();
        return;
      }

      const detail = extractApiErrorDetail(err);
      setSubmitError(detail ?? 'Failed to save branding settings.');
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
            {/* Public slug — org-level; PATCHed before branding PUT when changed */}
            <FormField
              control={form.control}
              name='slug'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Public slug</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      placeholder='acme'
                      autoComplete='off'
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    URL-safe identifier for your branded sign-in page
                    (/auth/login/&lt;slug&gt;). Required before branding can be
                    saved. Reserved words and uniqueness are validated on save.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {writeForbiddenReason === 'no_slug' && (
              <Alert>
                <AlertTitle>Public slug required</AlertTitle>
                <AlertDescription>
                  Pick a public slug above before saving branding settings. The
                  slug powers your branded sign-in page at
                  /auth/login/&lt;slug&gt;.
                </AlertDescription>
              </Alert>
            )}

            {showSlugChangeWarning && (
              <Alert>
                <AlertTitle>Changing your slug</AlertTitle>
                <AlertDescription>
                  Updating the slug orphans any previously shared branded login
                  URLs. Old links will show the default Vinta identity instead.
                </AlertDescription>
              </Alert>
            )}

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

            {/* Logo upload — submit object key; read logo_url is display-only */}
            <VStack gap={3} align='start'>
              <Text as='label' size='sm' weight='medium'>
                Logo
              </Text>
              {logoPreviewUrl ? (
                <Box
                  px={3}
                  py={2}
                  radius='md'
                  border
                  borderColor='border'
                  bg='muted'
                >
                  <Image
                    src={logoPreviewUrl}
                    alt='Organization logo preview'
                    height={40}
                    fit='contain'
                  />
                </Box>
              ) : (
                <Box
                  width={120}
                  height={40}
                  radius='md'
                  border
                  borderColor='border'
                  bg='muted'
                />
              )}
              <HStack gap={2} align='center'>
                <Input
                  ref={fileInputRef}
                  type='file'
                  accept='image/png,image/jpeg,image/webp'
                  className='hidden'
                  aria-label='Upload logo'
                  onChange={onLogoFileChange}
                />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={isUploadingLogo || isSaving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingLogo ? (
                    <>
                      <Spinner label='' />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload />
                      {logoPreviewUrl ? 'Replace logo' : 'Upload logo'}
                    </>
                  )}
                </Button>
                {logoPreviewUrl && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    disabled={isUploadingLogo || isSaving}
                    aria-label='Clear logo'
                    onClick={onClearLogo}
                  >
                    <X />
                    Clear logo
                  </Button>
                )}
              </HStack>
              {uploadProgress !== null ? (
                <Progress value={uploadProgress} className='h-1.5 w-48' />
              ) : (
                <Text size='xs' color='muted-foreground'>
                  PNG, JPEG, or WebP · max 5 MB. SVG is not allowed.
                </Text>
              )}
            </VStack>

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

            {/* Post-login redirect URL — single server-resolved destination */}
            <FormField
              control={form.control}
              name='redirect_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Post-login redirect URL</FormLabel>
                  <FormControl>
                    <Input
                      type='url'
                      placeholder='https://app.example.com/dashboard'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Concrete HTTPS URL where users land after signing in.
                    Wildcards and path-prefix patterns are not allowed. Leave
                    empty to clear.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {writeForbiddenReason === 'has_parent' && (
              <Alert>
                <AlertTitle>Branding not available</AlertTitle>
                <AlertDescription>
                  This organization is part of a hierarchy and cannot manage its
                  own branding. Branding for organizations inside a hierarchy is
                  controlled by the reseller organization above them.
                </AlertDescription>
              </Alert>
            )}

            {writeForbiddenReason === 'not_entitled' && (
              <Alert>
                <AlertTitle>Plan upgrade required</AlertTitle>
                <AlertDescription>
                  This organization&apos;s plan does not include white-label
                  branding. Contact your administrator to upgrade your plan.
                </AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant='destructive'>
                <AlertTitle>Save failed</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <HStack justify='end'>
              <Button type='submit' disabled={isSaving || isUploadingLogo}>
                {isSaving ? 'Saving…' : 'Save branding'}
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
            logoUrl={logoPreviewUrl}
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
