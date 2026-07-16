import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { ServiceAccountWizard } from './service-account-wizard';

const meta = {
  component: ServiceAccountWizard,
  title: 'Sync / Service Account Wizard',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ServiceAccountWizard>;

export default meta;
type Story = StoryObj;

function WizardHarness({ isRotating }: { isRotating: boolean }) {
  const [open, setOpen] = React.useState(true);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <div className='p-6'>
        <Button onClick={() => setOpen(true)}>Open wizard</Button>
        <ServiceAccountWizard
          open={open}
          onOpenChange={setOpen}
          isRotating={isRotating}
          existingId={isRotating ? 1 : undefined}
        />
      </div>
    </QueryClientProvider>
  );
}

/**
 * Full setup flow — starts on the first instruction step and walks the operator
 * through creating the Google service account, enabling APIs, granting
 * domain-wide delegation, and downloading a key before showing the form.
 */
export const Setup: Story = {
  render: () => <WizardHarness isRotating={false} />,
};

/**
 * Rotate flow — opens directly on the form step, since the Google-side setup
 * was already done when the account was first configured.
 */
export const Rotate: Story = {
  render: () => <WizardHarness isRotating={true} />,
};
