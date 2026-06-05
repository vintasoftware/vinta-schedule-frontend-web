import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Container } from './container';

const meta = {
  title: 'Layout/Container',
  component: Container,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    width: { control: 'inline-radio', options: ['contained', 'prose', 'full'] },
  },
  args: { width: 'contained' },
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

const Demo = () => (
  <div className='border-primary/40 bg-accent/40 text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
    Container content
  </div>
);

export const Contained: Story = {
  args: { width: 'contained' },
  render: (args) => (
    <div className='bg-muted/40 py-8'>
      <Container {...args}>
        <Demo />
      </Container>
    </div>
  ),
};

export const Prose: Story = { ...Contained, args: { width: 'prose' } };
export const Full: Story = { ...Contained, args: { width: 'full' } };
