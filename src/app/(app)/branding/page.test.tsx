import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/branding',
}));

vi.mock('@/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client')>();
  return {
    ...original,
    organizationsCurrentRetrieve: vi.fn(),
  };
});

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    brandingRetrieve: vi.fn(),
  };
});

vi.mock('@/components/branding/branding-form', () => ({
  BrandingForm: () => <div data-testid='branding-form'>Branding form</div>,
}));

import { organizationsCurrentRetrieve } from '@/client';
import { brandingRetrieve } from '@/client/sdk.gen';
import type { CurrentMembership, OrganizationBranding } from '@/client';
import BrandingPage from './page';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<BrandingPage />, { wrapper });
}

// An "admin" (manage_members) holds the full capability set; a plain member
// holds none.
const ADMIN_PERMISSIONS = [
  'organizations.manage_members',
  'organizations.manage_organization',
  'organizations.manage_branding',
  'payments.manage_billing',
];
const MEMBER_PERMISSIONS: string[] = [];

const INELIGIBLE_MEMBERSHIP: CurrentMembership = {
  permissions: ADMIN_PERMISSIONS,
  can_manage_branding: false,
  organization: { id: 1, name: 'Test Org' },
};

const ELIGIBLE_MEMBERSHIP: CurrentMembership = {
  permissions: ADMIN_PERMISSIONS,
  can_manage_branding: true,
  organization: { id: 1, name: 'Test Org' },
};

const MEMBER_WITH_BRANDING_MEMBERSHIP: CurrentMembership = {
  permissions: MEMBER_PERMISSIONS,
  can_manage_branding: true,
  organization: { id: 1, name: 'Test Org' },
};

const SAMPLE_BRANDING: OrganizationBranding = {
  app_name: 'My App',
  logo_url: '',
  primary_color: '#000000',
  redirect_url: 'https://example.com',
};

function mockOrgSuccess(membership: CurrentMembership) {
  vi.mocked(organizationsCurrentRetrieve).mockResolvedValue({
    data: membership,
    response: jsonResponse(200, membership),
    error: undefined,
  } as unknown as Awaited<ReturnType<typeof organizationsCurrentRetrieve>>);
}

function mockBrandingOk(branding: OrganizationBranding = SAMPLE_BRANDING) {
  vi.mocked(brandingRetrieve).mockResolvedValue({
    data: branding,
    response: jsonResponse(200, branding),
    error: undefined,
  } as unknown as Awaited<ReturnType<typeof brandingRetrieve>>);
}

describe('BrandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects away and does not render the form when can_manage_branding is false', async () => {
    mockOrgSuccess(INELIGIBLE_MEMBERSHIP);
    const { container } = renderPage();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });

    expect(screen.queryByTestId('branding-form')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
    expect(brandingRetrieve).not.toHaveBeenCalled();
  });

  it('redirects away and does not render the form for a member with can_manage_branding true', async () => {
    mockOrgSuccess(MEMBER_WITH_BRANDING_MEMBERSHIP);
    const { container } = renderPage();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });

    expect(screen.queryByTestId('branding-form')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
    expect(brandingRetrieve).not.toHaveBeenCalled();
  });

  it('renders the branding form when can_manage_branding is true', async () => {
    mockOrgSuccess(ELIGIBLE_MEMBERSHIP);
    mockBrandingOk();
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('branding-form')).toBeInTheDocument();
    });

    expect(replace).not.toHaveBeenCalled();
  });
});
