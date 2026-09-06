import * as React from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import { withThemeByClassName } from '@storybook/addon-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sb } from 'storybook/test';
import { DM_Sans, Geist_Mono } from 'next/font/google';

// Stories that stub a data hook need it mocked at the module boundary — an ESM
// namespace can't be spied on in the browser. `spy: true` keeps the real
// implementation, so only stories that call `.mockReturnValue()` see a stub.
sb.mock(import('../src/hooks/availability/use-blocked-times.ts'), {
  spy: true,
});
// AppointmentTypeQuotaRules' duplicate-period-error story needs the create mutation to
// reject with a fixed body without any real network layer to fail against
// (this repo's stories have no interactions addon-driven network mocking) —
// mocking the whole hook lets that story drive the rejection directly.
sb.mock(
  import('../src/hooks/appointment-types/use-appointment-type-scoped-quota.ts'),
  {
    spy: true,
  }
);
// MintBookingLinkDialog resolves the active org's slug for the branded URL —
// mocked so its story gets a deterministic slug instead of a real (failing)
// `/organizations/current` fetch.
sb.mock(import('../src/hooks/organizations/use-current-organization.ts'), {
  spy: true,
});
// PublicBookingFlow's stories drive the read states (loading / loaded /
// opaque link-invalid / generic load error) directly through this hook's
// return value, same rationale as `useAppointmentTypeScopedQuota` above — there is no
// real `/public/booking/*` backend behind Storybook.
sb.mock(import('../src/hooks/booking-codes/use-public-bookable-slots.ts'), {
  spy: true,
});
// PublicAppointmentTypeBookingFlow's stories drive the same kind of read states, plus
// the imperative per-range availability fetch — same rationale as above.
sb.mock(import('../src/hooks/booking-codes/use-public-group-booking.ts'), {
  spy: true,
});
// CodelessAppointmentTypeBookingFlow's stories (unknown-slug / not-public states) drive
// the same kind of read states through this hook's return value — same
// rationale as `usePublicAppointmentTypeBookableSlots` above.
sb.mock(import('../src/hooks/booking-codes/use-codeless-group-booking.ts'), {
  spy: true,
});
// RescheduleFlow's and CancelFlow's terminal-write-error stories drive the
// write hooks directly (there is no real `/public/booking/*` backend behind
// Storybook, so a rejected mutation has to be stubbed) — same rationale as
// the read hooks above.
sb.mock(import('../src/hooks/booking-codes/use-public-reschedule.ts'), {
  spy: true,
});
sb.mock(import('../src/hooks/booking-codes/use-public-cancel.ts'), {
  spy: true,
});

import { patchFocus } from './patch-focus';
import '../src/app/globals.css';

// Retries would leave stories stuck in a loading state for seconds whenever a
// hook's request fails (there is no API behind Storybook).
const createStoryQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Device frames for the built-in viewport toolbar (Storybook 9/10 core).
// Stories opt in per-story via `globals: { viewport: { value: 'mobile' } }`.
const VIEWPORTS = {
  mobile: { name: 'Mobile · 375', styles: { width: '375px', height: '812px' } },
  mobileL: {
    name: 'Mobile L · 430',
    styles: { width: '430px', height: '932px' },
  },
  tablet: {
    name: 'Tablet · 768',
    styles: { width: '768px', height: '1024px' },
  },
  laptop: {
    name: 'Laptop · 1024',
    styles: { width: '1024px', height: '768px' },
  },
  desktop: {
    name: 'Desktop · 1440',
    styles: { width: '1440px', height: '900px' },
  },
};

// Same families as the app shell (app/layout.tsx) so Storybook renders 1:1.
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '500', '600'],
});

const preview: Preview = {
  // Runs after the core annotations' loaders, i.e. after `storybook/test` has
  // installed the focus accessor this guards against. See ./patch-focus.ts.
  loaders: [() => patchFocus()],
  parameters: {
    controls: {
      matchers: {
        // No `color` matcher: our token props (`color`, `background`) are unions
        // of token names, not CSS colors, and a color-picker control on them
        // renders broken ("Control of type color only supports string").
        date: /Date$/i,
      },
    },
    // Components reaching for `useRouter`/`usePathname` from `next/navigation`
    // need the App Router context; without this the framework only mocks the
    // Pages router and they throw "invariant expected app router to be mounted".
    nextjs: { appDirectory: true },
    backgrounds: { disable: true },
    a11y: { test: 'todo' },
    viewport: { options: VIEWPORTS },
    options: {
      storySort: {
        order: ['Foundations', 'Components', '*'],
      },
    },
  },
  initialGlobals: {
    viewport: { value: undefined, isRotated: false },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
    // Anything rendering a data hook needs a QueryClient. A fresh client per
    // story keeps cache from leaking between them; stories that need seeded data
    // still wrap themselves in their own provider.
    (Story) => (
      <QueryClientProvider client={createStoryQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
    (Story, context) => {
      const fullscreen = context.parameters.layout === 'fullscreen';
      return (
        <div
          className={`${dmSans.variable} ${geistMono.variable} bg-background text-foreground font-sans`}
          style={
            fullscreen
              ? { minHeight: '100%' }
              : { minHeight: '100%', padding: '2rem' }
          }
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
