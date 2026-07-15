import type { Meta, StoryObj } from '@storybook/react-vite';

import { Container } from './container';

const meta = {
  title: 'Layout/Container',
  component: Container,
  tags: ['autodocs'],
  argTypes: {
    width: { control: 'inline-radio', options: ['contained', 'prose', 'full'] },
    py: { control: 'select', options: [0, 2, 4, 6, 8, 12, 16] },
    bg: {
      control: 'select',
      options: ['background', 'card', 'muted', 'accent'],
    },
  },
  args: { width: 'contained' },
  parameters: { layout: 'fullscreen' },
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
