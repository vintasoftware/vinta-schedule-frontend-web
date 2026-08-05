import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any imports from the modules being mocked.
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/partner/branding',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the sdk.gen boundary so brandingUpdate never hits a real network.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    brandingUpdate: vi.fn(),
  };
});

// Mock sonner to prevent missing Toaster context errors in tests.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { brandingUpdate } from '@/client/sdk.gen';
import { toast } from 'sonner';
import { BrandingForm, redirectUrlSchema } from './branding-form';
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

function renderForm(initialBranding?: OrganizationBranding | null) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(<BrandingForm initialBranding={initialBranding ?? null} />, {
      wrapper,
    }),
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

    it('accepts empty redirect_url and omits it from the PUT body', async () => {
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
      expect(callArgs?.body?.redirect_url).toBeUndefined();
      expect(Array.isArray(callArgs?.body?.redirect_url)).toBe(false);
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
      expect(callArgs?.body?.logo_url).toBeUndefined();
      expect(callArgs?.body?.primary_color).toBeUndefined();
      expect(callArgs?.body?.secondary_color).toBeUndefined();
      expect(callArgs?.body?.support_email).toBeUndefined();
      expect(callArgs?.body?.redirect_url).toBeUndefined();
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
