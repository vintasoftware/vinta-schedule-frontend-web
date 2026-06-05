import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventsView } from './events-view';

const meta: Meta<typeof EventsView> = {
  title: 'components/Events/EventsView',
  component: EventsView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient();
      return (
        <QueryClientProvider client={queryClient}>
          <div className='p-6'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof EventsView>;

/**
 * Default (populated) state — shows the events view in agenda/list mode.
 * The API call goes to the live backend when running Storybook against a dev server.
 */
export const Default: Story = {};

/**
 * Calendar-scoped — filtered to a specific calendar id (Phase 15 pattern).
 * Passes calendarId=1 to the hook to demonstrate the filter prop.
 */
export const CalendarScoped: Story = {
  args: {
    calendarId: 1,
  },
};
