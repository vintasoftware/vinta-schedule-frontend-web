import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocsSidebar } from './docs-sidebar';

const meta = {
  title: 'Docs/DocsSidebar',
  component: DocsSidebar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocsSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className='h-screen w-64'>
      <DocsSidebar />
    </div>
  ),
};

export const Mobile: Story = {
  ...Default,
  globals: { viewport: { value: 'mobile' } },
};
