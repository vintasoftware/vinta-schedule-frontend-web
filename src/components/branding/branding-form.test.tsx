import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any imports from the modules being mocked.
// ---------------------------------------------------------------------------

const { mockUpdateOrganizationSlug, mockUploadBrandingLogo } = vi.hoisted(
  () => ({
    mockUpdateOrganizationSlug: vi.fn(),
    mockUploadBrandingLogo: vi.fn(),
  })
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/partner/branding',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the sdk.gen boundary so brandingUpdate/brandingPartialUpdate never hit
// a real network.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    brandingUpdate: vi.fn(),
    brandingPartialUpdate: vi.fn(),
  };
});

// Mock sonner to prevent missing Toaster context errors in tests.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/organizations/use-update-organization-slug', () => ({
  useUpdateOrganizationSlug: () => ({
    updateOrganizationSlug: mockUpdateOrganizationSlug,
    updateOrganizationSlugMutation: { isPending: false },
  }),
}));

vi.mock('@/hooks/branding/use-upload-branding-logo', () => ({
  useUploadBrandingLogo: () => ({
    uploadBrandingLogo: mockUploadBrandingLogo,
  }),
  UploadValidationError: class UploadValidationError extends Error {},
}));

import { brandingUpdate, brandingPartialUpdate } from '@/client/sdk.gen';
import { toast } from 'sonner';
import {
  BrandingForm,
  redirectUrlSchema,
  slugSchema,
  extractSlugFieldError,
} from './branding-form';
import type { OrganizationBranding } from '@/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderForm(
  initialBranding?: OrganizationBranding | null,
  initialSlug?: string | null
) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(
      <BrandingForm
        initialBranding={initialBranding ?? null}
        initialSlug={initialSlug ?? null}
      />,
      {
        wrapper,
      }
    ),
    queryClient,
  };
}

function makeBrandingResponse(
  branding: OrganizationBranding
): Awaited<ReturnType<typeof brandingUpdate>> {
  return {
    data: branding,
    response: new Response(JSON.stringify(branding), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof brandingUpdate>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrandingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateOrganizationSlug.mockResolvedValue({ id: 1, slug: 'acme' });
    mockUploadBrandingLogo.mockResolvedValue(
      'uploads/branding_logos/new-logo.png'
    );
  });

  // -------------------------------------------------------------------------
  // Validation — slug (schema unit + form integration)
  // -------------------------------------------------------------------------

  describe('slug validation', () => {
    const slugLabel = /public slug/i;

    describe('slugSchema', () => {
      it('accepts empty string (unset slug)', () => {
        expect(slugSchema.safeParse('').success).toBe(true);
      });

      it('accepts a valid lowercase slug', () => {
        expect(slugSchema.safeParse('acme-corp').success).toBe(true);
      });

      it('lowercases input on transform', () => {
        const result = slugSchema.safeParse('Acme-Corp');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('acme-corp');
        }
      });

      it('rejects non-ASCII characters (confusables)', () => {
        expect(slugSchema.safeParse('acmé').success).toBe(false);
      });

      it('rejects slugs shorter than 3 characters', () => {
        expect(slugSchema.safeParse('ab').success).toBe(false);
      });

      it('rejects slugs longer than 63 characters', () => {
        expect(slugSchema.safeParse('a'.repeat(64)).success).toBe(false);
      });

      it('rejects leading hyphens', () => {
        expect(slugSchema.safeParse('-acme').success).toBe(false);
      });

      it('rejects trailing hyphens', () => {
        expect(slugSchema.safeParse('acme-').success).toBe(false);
      });

      it('rejects consecutive hyphens', () => {
        expect(slugSchema.safeParse('acme--corp').success).toBe(false);
      });

      it('rejects purely numeric slugs', () => {
        expect(slugSchema.safeParse('12345').success).toBe(false);
      });
    });

    describe('extractSlugFieldError', () => {
      it('returns the first slug message from a DRF 400 body', () => {
        expect(
          extractSlugFieldError({
            slug: ["An organization with the slug 'acme' already exists."],
          })
        ).toBe("An organization with the slug 'acme' already exists.");
      });

      it('returns null for non-field errors', () => {
        expect(extractSlugFieldError(new Error('network'))).toBeNull();
      });
    });

    it('rejects a purely numeric slug via the form', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(screen.getByLabelText(slugLabel), '12345');

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/must not be purely numeric/i)
        ).toBeInTheDocument();
      });

      expect(mockUpdateOrganizationSlug).not.toHaveBeenCalled();
      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });

    it('maps slug 400 field errors onto the slug input', async () => {
      const user = userEvent.setup();
      mockUpdateOrganizationSlug.mockRejectedValue({
        slug: ["An organization with the slug 'acme' already exists."],
      });

      renderForm(null, null);

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(screen.getByLabelText(slugLabel), 'acme');
      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/organization with the slug 'acme' already exists/i)
        ).toBeInTheDocument();
      });

      expect(mockUpdateOrganizationSlug).toHaveBeenCalledWith('acme');
      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Submit — slug PATCH then branding PUT
  // -------------------------------------------------------------------------

  describe('submit — slug sequencing', () => {
    const slugLabel = /public slug/i;

    it('PATCHes org then PUTs branding when slug changed', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'TestApp' })
      );

      renderForm(null, null);

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(screen.getByLabelText(slugLabel), 'acme');
      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(mockUpdateOrganizationSlug).toHaveBeenCalledWith('acme');
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      expect(
        mockUpdateOrganizationSlug.mock.invocationCallOrder[0]
      ).toBeLessThan(vi.mocked(brandingUpdate).mock.invocationCallOrder[0]!);
    });

    it('skips org PATCH when slug is unchanged', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'TestApp' })
      );

      renderForm({ app_name: 'Old Name' }, 'acme');

      await user.clear(screen.getByLabelText(/app name/i));
      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      expect(mockUpdateOrganizationSlug).not.toHaveBeenCalled();
    });

    it('shows a warning when changing an existing slug', async () => {
      const user = userEvent.setup();
      renderForm(null, 'old-slug');

      expect(screen.queryByText(/changing your slug/i)).not.toBeInTheDocument();

      const slugInput = screen.getByLabelText(/public slug/i);
      await user.clear(slugInput);
      await user.type(slugInput, 'new-slug');

      await waitFor(() => {
        expect(screen.getByText(/changing your slug/i)).toBeInTheDocument();
        expect(
          screen.getByText(/orphans any previously shared branded login/i)
        ).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Validation — color format
  // -------------------------------------------------------------------------

  describe('color field validation', () => {
    it('rejects a primary_color that is not a valid hex code', async () => {
      const user = userEvent.setup();
      renderForm();

      // Fill app_name (required) so we reach color validation on submit.
      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(screen.getByLabelText(/primary color/i), 'red');

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(screen.getByText(/must be a hex color/i)).toBeInTheDocument();
      });

      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });

    it('accepts a valid 6-digit hex primary_color', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'TestApp', primary_color: '#FF0000' })
      );

      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(screen.getByLabelText(/primary color/i), '#FF0000');

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      expect(
        screen.queryByText(/must be a hex color/i)
      ).not.toBeInTheDocument();
    });

    it('accepts a valid 8-digit hex primary_color (with alpha)', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({
          app_name: 'TestApp',
          primary_color: '#FF0000AA',
        })
      );

      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(screen.getByLabelText(/primary color/i), '#FF0000AA');

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });
    });

    it('rejects a secondary_color with an invalid format', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(screen.getByLabelText(/secondary color/i), 'not-a-color');

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(
          screen.getAllByText(/must be a hex color/i).length
        ).toBeGreaterThanOrEqual(1);
      });

      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Validation — redirect_url (schema unit + form integration)
  // -------------------------------------------------------------------------

  describe('redirect_url validation', () => {
    const redirectUrlLabel = /post-login redirect url/i;

    describe('redirectUrlSchema', () => {
      it('accepts empty string (clears configured destination)', () => {
        expect(redirectUrlSchema.safeParse('').success).toBe(true);
      });

      it('accepts a valid HTTPS URL without a trailing slash on the path', () => {
        expect(
          redirectUrlSchema.safeParse('https://app.example.com/post-login')
            .success
        ).toBe(true);
      });

      it('accepts bare root URLs with or without a trailing slash', () => {
        expect(redirectUrlSchema.safeParse('https://example.com').success).toBe(
          true
        );
        expect(
          redirectUrlSchema.safeParse('https://example.com/').success
        ).toBe(true);
      });

      it('rejects http:// scheme', () => {
        const result = redirectUrlSchema.safeParse(
          'http://example.com/callback'
        );
        expect(result.success).toBe(false);
      });

      it('rejects wildcard characters', () => {
        const result = redirectUrlSchema.safeParse('https://example.com/*');
        expect(result.success).toBe(false);
      });

      it('rejects a non-root path ending in /', () => {
        const result = redirectUrlSchema.safeParse(
          'https://example.com/callback/'
        );
        expect(result.success).toBe(false);
      });

      it('rejects control characters', () => {
        const result = redirectUrlSchema.safeParse(
          'https://example.com/call\tback'
        );
        expect(result.success).toBe(false);
      });

      it('rejects hostless https://', () => {
        const result = redirectUrlSchema.safeParse('https://');
        expect(result.success).toBe(false);
      });

      it('rejects scheme-confusion https:evil.com', () => {
        const result = redirectUrlSchema.safeParse('https:evil.com');
        expect(result.success).toBe(false);
      });
    });

    it('rejects http:// via the form', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(
        screen.getByLabelText(redirectUrlLabel),
        'http://example.com/callback'
      );

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/must be a valid https url/i)
        ).toBeInTheDocument();
      });

      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });

    it('rejects wildcard characters via the form', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(
        screen.getByLabelText(redirectUrlLabel),
        'https://example.com/*'
      );

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/must not contain wildcard characters/i)
        ).toBeInTheDocument();
      });

      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });

    it('rejects a non-root path ending in / via the form', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(
        screen.getByLabelText(redirectUrlLabel),
        'https://example.com/callback/'
      );

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/url path must not end with a trailing slash/i)
        ).toBeInTheDocument();
      });

      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });

    it('rejects control characters via the form', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      const redirectInput = screen.getByLabelText(redirectUrlLabel);
      fireEvent.change(redirectInput, {
        target: { value: 'https://example.com/call\tback' },
      });

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/must not contain control characters/i)
        ).toBeInTheDocument();
      });

      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });

    it('accepts empty redirect_url and sends empty string in the PUT body to clear', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'TestApp' })
      );

      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      expect(callArgs?.body?.redirect_url).toBe('');
      expect(Array.isArray(callArgs?.body?.redirect_url)).toBe(false);
    });

    it('clears a prefilled redirect_url when the input is emptied and saved', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'TestApp' })
      );

      renderForm({
        app_name: 'TestApp',
        redirect_url: 'https://example.com/dashboard',
      });

      const redirectInput = screen.getByLabelText(redirectUrlLabel);
      await user.clear(redirectInput);

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      expect(callArgs?.body?.redirect_url).toBe('');
    });

    it('accepts a valid redirect_url and sends it as a string in the PUT body', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({
          app_name: 'TestApp',
          redirect_url: 'https://example.com/dashboard',
        })
      );

      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.type(
        screen.getByLabelText(redirectUrlLabel),
        'https://example.com/dashboard'
      );

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      expect(callArgs?.body?.redirect_url).toBe(
        'https://example.com/dashboard'
      );
      expect(typeof callArgs?.body?.redirect_url).toBe('string');
      expect(Array.isArray(callArgs?.body?.redirect_url)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Validation — app_name required
  // -------------------------------------------------------------------------

  describe('app_name required', () => {
    it('does not submit when app_name is empty', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(screen.getByText(/app name is required/i)).toBeInTheDocument();
      });

      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Logo upload
  // -------------------------------------------------------------------------

  describe('logo upload', () => {
    it('submits the uploaded object key as logo_url in the PUT body', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'TestApp' })
      );

      renderForm(null, 'acme');

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');

      const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', {
        type: 'image/png',
      });
      await user.upload(screen.getByLabelText(/upload logo/i), file);

      await waitFor(() => {
        expect(mockUploadBrandingLogo).toHaveBeenCalledWith(
          file,
          expect.any(Function)
        );
      });

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      expect(callArgs?.body?.logo_url).toBe(
        'uploads/branding_logos/new-logo.png'
      );
    });

    it('PATCHes an empty logo_url immediately when Clear logo is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingPartialUpdate).mockResolvedValue(
        makeBrandingResponse({
          app_name: 'TestApp',
        }) as unknown as Awaited<ReturnType<typeof brandingPartialUpdate>>
      );

      renderForm(
        {
          app_name: 'TestApp',
          logo_url: 'https://api.example.com/branding/logo/acme/',
        },
        'acme'
      );

      await user.click(screen.getByRole('button', { name: /clear logo/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingPartialUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingPartialUpdate).mock.calls[0][0];
      expect(callArgs?.body?.logo_url).toBe('');
      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();
    });

    it('does not PATCH when clearing before branding is configured (defers to the create PUT)', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'TestApp' })
      );

      renderForm(null, 'acme');

      await user.type(screen.getByLabelText(/app name/i), 'TestApp');

      const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', {
        type: 'image/png',
      });
      await user.upload(screen.getByLabelText(/upload logo/i), file);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /clear logo/i })
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clear logo/i }));
      expect(vi.mocked(brandingPartialUpdate)).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      expect(callArgs?.body?.logo_url).toBe('');
    });

    it('persists logo_url via PATCH immediately after upload when branding already exists', async () => {
      const user = userEvent.setup();
      const deliveryUrl = 'https://api.example.com/branding/logo/acme/';
      vi.mocked(brandingPartialUpdate).mockResolvedValue(
        makeBrandingResponse({
          app_name: 'TestApp',
          logo_url: deliveryUrl,
        }) as unknown as Awaited<ReturnType<typeof brandingPartialUpdate>>
      );

      renderForm({ app_name: 'TestApp', logo_url: deliveryUrl }, 'acme');

      const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', {
        type: 'image/png',
      });
      await user.upload(screen.getByLabelText(/upload logo/i), file);

      await waitFor(() => {
        expect(vi.mocked(brandingPartialUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingPartialUpdate).mock.calls[0][0];
      expect(callArgs?.body?.logo_url).toBe(
        'uploads/branding_logos/new-logo.png'
      );
      expect(vi.mocked(brandingUpdate)).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(
          screen.getByAltText(/organization logo preview/i)
        ).toHaveAttribute('src', deliveryUrl);
      });
    });

    it('does not PATCH immediately when branding is not yet configured', async () => {
      const user = userEvent.setup();

      renderForm(null, 'acme');

      const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', {
        type: 'image/png',
      });
      await user.upload(screen.getByLabelText(/upload logo/i), file);

      await waitFor(() => {
        expect(mockUploadBrandingLogo).toHaveBeenCalled();
      });

      expect(vi.mocked(brandingPartialUpdate)).not.toHaveBeenCalled();
    });

    it('shows the server delivery-route logo_url as preview without parsing it', () => {
      const deliveryUrl = 'https://api.example.com/branding/logo/acme/';

      renderForm(
        {
          app_name: 'TestApp',
          logo_url: deliveryUrl,
        },
        'acme'
      );

      expect(screen.getByAltText(/organization logo preview/i)).toHaveAttribute(
        'src',
        deliveryUrl
      );
    });
  });

  // -------------------------------------------------------------------------
  // Submit — payload shape
  // -------------------------------------------------------------------------

  describe('submit — payload shape', () => {
    it('calls brandingUpdate with the correct payload on valid submit', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({
          app_name: 'MyScheduler',
          primary_color: '#1B4DFF',
          support_email: 'help@example.com',
        })
      );

      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'MyScheduler');
      await user.type(screen.getByLabelText(/primary color/i), '#1B4DFF');
      await user.type(
        screen.getByLabelText(/support email/i),
        'help@example.com'
      );

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      expect(callArgs?.body).toMatchObject({
        app_name: 'MyScheduler',
        primary_color: '#1B4DFF',
        support_email: 'help@example.com',
      });

      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Branding saved',
        expect.any(Object)
      );
    });

    it('omits empty optional fields from the payload', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({ app_name: 'App' })
      );

      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'App');
      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      // Optional fields with empty strings are stripped from the payload (mapped
      // to undefined in toPayload so JSON.stringify omits them entirely).
      // redirect_url is the exception — empty string clears the configured destination.
      expect(callArgs?.body?.logo_url).toBeUndefined();
      expect(callArgs?.body?.primary_color).toBeUndefined();
      expect(callArgs?.body?.secondary_color).toBeUndefined();
      expect(callArgs?.body?.support_email).toBeUndefined();
      expect(callArgs?.body?.redirect_url).toBe('');
    });

    it('includes redirect_url in the payload when set', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockResolvedValue(
        makeBrandingResponse({
          app_name: 'App',
          redirect_url: 'https://example.com/dashboard',
        })
      );

      renderForm();

      await user.type(screen.getByLabelText(/app name/i), 'App');
      await user.type(
        screen.getByLabelText(/post-login redirect url/i),
        'https://example.com/dashboard'
      );

      await user.click(screen.getByRole('button', { name: /save branding/i }));

      await waitFor(() => {
        expect(vi.mocked(brandingUpdate)).toHaveBeenCalledOnce();
      });

      const callArgs = vi.mocked(brandingUpdate).mock.calls[0][0];
      expect(callArgs?.body?.redirect_url).toBe(
        'https://example.com/dashboard'
      );
    });

    it('prefills the form when initialBranding is provided', async () => {
      const initialBranding: OrganizationBranding = {
        app_name: 'Prefilled App',
        primary_color: '#AABBCC',
        support_email: 'pre@example.com',
      };

      renderForm(initialBranding);

      expect(screen.getByDisplayValue('Prefilled App')).toBeInTheDocument();
      expect(screen.getByDisplayValue('#AABBCC')).toBeInTheDocument();
      expect(screen.getByDisplayValue('pre@example.com')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Write 403 — distinguishable refusal reasons
  // -------------------------------------------------------------------------

  describe('write 403 — distinguishable refusal reasons', () => {
    const HAS_PARENT_DETAIL =
      'This organization has a parent organization and cannot manage its own branding. Branding for organizations inside a hierarchy is controlled by the reseller organization above them.';

    const NOT_ENTITLED_DETAIL =
      "This organization's plan does not include white-label branding.";

    const NO_SLUG_DETAIL =
      'Pick a public slug for this organization before configuring branding.';

    async function submitMinimalForm(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText(/app name/i), 'TestApp');
      await user.click(screen.getByRole('button', { name: /save branding/i }));
    }

    it('shows permanent unavailable state for has-parent 403', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockRejectedValue({
        detail: HAS_PARENT_DETAIL,
      });

      renderForm({ app_name: 'TestApp' }, 'acme');
      await submitMinimalForm(user);

      await waitFor(() => {
        expect(screen.getByText(/branding not available/i)).toBeInTheDocument();
        expect(
          screen.getByText(
            /part of a hierarchy and cannot manage its own branding/i
          )
        ).toBeInTheDocument();
      });

      expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/plan upgrade required/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/public slug required/i)
      ).not.toBeInTheDocument();
    });

    it('shows plan upgrade copy for not-entitled 403', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockRejectedValue({
        detail: NOT_ENTITLED_DETAIL,
      });

      renderForm({ app_name: 'TestApp' }, 'acme');
      await submitMinimalForm(user);

      await waitFor(() => {
        expect(screen.getByText(/plan upgrade required/i)).toBeInTheDocument();
        expect(
          screen.getByText(/does not include white-label branding/i)
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/branding not available/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/public slug required/i)
      ).not.toBeInTheDocument();
    });

    it('focuses slug field and shows inline prompt for no-slug 403', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockRejectedValue({ detail: NO_SLUG_DETAIL });

      renderForm({ app_name: 'TestApp' }, 'acme');
      await submitMinimalForm(user);

      await waitFor(() => {
        expect(screen.getByText(/public slug required/i)).toBeInTheDocument();
        expect(
          screen.getByText(
            /pick a public slug before saving branding settings/i
          )
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/public slug/i)).toHaveFocus();
      });
      expect(
        screen.queryByText(/branding not available/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/plan upgrade required/i)
      ).not.toBeInTheDocument();
    });

    it('falls back to generic save error for unknown 403 detail', async () => {
      const user = userEvent.setup();
      vi.mocked(brandingUpdate).mockRejectedValue({
        detail: 'Permission denied.',
      });

      renderForm({ app_name: 'TestApp' }, 'acme');
      await submitMinimalForm(user);

      await waitFor(() => {
        expect(screen.getByText(/save failed/i)).toBeInTheDocument();
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Live preview — updates as the user types
  // -------------------------------------------------------------------------

  describe('live preview', () => {
    it('reflects the app name in the preview as the user types', async () => {
      const user = userEvent.setup();
      renderForm();

      const appNameInput = screen.getByLabelText(/app name/i);
      await user.type(appNameInput, 'LiveApp');

      // The preview should show the new app name.
      // There are multiple elements with "LiveApp" text (header + body).
      await waitFor(() => {
        const matches = screen.getAllByText(/LiveApp/);
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('shows a placeholder app name in the preview when the field is empty', () => {
      renderForm();

      // When empty, the preview shows the fallback text (may appear multiple
      // times in the preview card: header strip + body).
      const matches = screen.getAllByText(/your app/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
