import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';
import { GroupQuotaRules } from './group-quota-rules';
import { GroupPermissionsProvider } from './group-permissions-provider';
// Mocked in .storybook/preview.tsx via `sb.mock(...)`; `mocked()` just types it.
import { useGroupScopedQuota } from '@/hooks/calendar-groups/use-group-scoped-quota';
import type { GroupScopedQuotaRule } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 100;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeRule(
  overrides: Partial<GroupScopedQuotaRule> = {}
): GroupScopedQuotaRule {
  return {
    id: 1,
    calendar_id: CALENDAR_ID,
    group_slot_id: SLOT_ID,
    period: 'week',
    cap: 3,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/CalendarGroups/GroupQuotaRules',
  component: GroupQuotaRules,
  tags: ['autodocs'],
  args: {
    groupId: GROUP_ID,
    slotId: SLOT_ID,
    calendarId: CALENDAR_ID,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <GroupPermissionsProvider
          permissions={['organizations.manage_members']}
          ownedCalendarIds={new Set()}
        >
          <div className='w-full max-w-lg'>
            <Story />
          </div>
        </GroupPermissionsProvider>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof GroupQuotaRules>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const NoRules: Story = {
  decorators: [
    (Story) => {
      mocked(useGroupScopedQuota).mockReturnValue({
        rules: [],
        totalCount: 0,
        isTruncated: false,
        isLoading: false,
        isError: false,
        error: null,
        quotaQuery: {} as unknown as never,
        createQuotaRule: fn(),
        createQuotaRuleMutation: {} as unknown as never,
        updateQuotaRule: fn(),
        updateQuotaRuleMutation: {} as unknown as never,
        deleteQuotaRule: fn(),
        deleteQuotaRuleMutation: {} as unknown as never,
      });
      return <Story />;
    },
  ],
};

// A daily rule and a weekly rule for the same calendar/slot coexist -- the
// uniqueness constraint is per period, not per calendar+slot (handoff doc,
// section 3).
export const OneRule: Story = {
  decorators: [
    (Story) => {
      mocked(useGroupScopedQuota).mockReturnValue({
        rules: [
          makeRule({ id: 1, period: 'day', cap: 1 }),
          makeRule({ id: 2, period: 'week', cap: 3 }),
        ],
        totalCount: 2,
        isTruncated: false,
        isLoading: false,
        isError: false,
        error: null,
        quotaQuery: {} as unknown as never,
        createQuotaRule: fn(),
        createQuotaRuleMutation: {} as unknown as never,
        updateQuotaRule: fn(),
        updateQuotaRuleMutation: {} as unknown as never,
        deleteQuotaRule: fn().mockResolvedValue({ status: 'deleted' }),
        deleteQuotaRuleMutation: {} as unknown as never,
      });
      return <Story />;
    },
  ],
};

// The duplicate-period rejection (400 `non_field_errors`) is covered by the
// vitest test at group-quota-rules.test.tsx (line 143-171), which is the only
// verification that runs in CI. This story renders the initial rule list state
// (the dialog stays closed) -- the interaction coverage belongs in the test.
export const DuplicatePeriodError: Story = {
  decorators: [
    (Story) => {
      mocked(useGroupScopedQuota).mockReturnValue({
        rules: [makeRule({ id: 1, period: 'week', cap: 3 })],
        totalCount: 1,
        isTruncated: false,
        isLoading: false,
        isError: false,
        error: null,
        quotaQuery: {} as unknown as never,
        createQuotaRule: fn().mockRejectedValue({
          non_field_errors: [
            'The fields calendar, group_slot, period must make a unique set.',
          ],
        }),
        createQuotaRuleMutation: {} as unknown as never,
        updateQuotaRule: fn(),
        updateQuotaRuleMutation: {} as unknown as never,
        deleteQuotaRule: fn(),
        deleteQuotaRuleMutation: {} as unknown as never,
      });
      return <Story />;
    },
  ],
};

export const Mobile: Story = {
  ...OneRule,
  globals: { viewport: { value: 'mobile' } },
};
