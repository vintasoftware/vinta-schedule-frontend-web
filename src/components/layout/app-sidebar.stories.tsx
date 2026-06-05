import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppSidebar } from './app-sidebar';

const meta = {
  title: 'Composition/AppSidebar',
  component: AppSidebar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [active, setActive] = React.useState('calendar');
    return (
      <div className='h-screen'>
        <AppSidebar activeId={active} onNavigate={setActive} />
      </div>
    );
  },
};
