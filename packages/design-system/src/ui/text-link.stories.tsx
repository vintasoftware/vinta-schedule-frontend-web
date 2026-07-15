import type { Meta, StoryObj } from '@storybook/react-vite';

import { TextLink } from './text-link';

const meta = {
  title: 'Components/TextLink',
  component: TextLink,
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text', description: 'Link label' },
    href: { control: 'text' },
    variant: {
      control: 'select',
      options: ['default', 'muted', 'inherit', 'destructive'],
    },
    underline: {
      control: 'inline-radio',
      options: ['always', 'hover', 'none'],
    },
    size: {
      control: 'select',
      options: ['inherit', 'sm', 'md', 'lg'],
    },
  },
  args: {
    children: 'View booking',
    href: '#',
    variant: 'default',
    underline: 'hover',
    size: 'md',
  },
} satisfies Meta<typeof TextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4 text-sm'>
      <TextLink href='#'>Default</TextLink>
      <TextLink href='#' variant='muted'>
        Muted
      </TextLink>
      <TextLink href='#' variant='destructive'>
        Cancel booking
      </TextLink>
    </div>
  ),
};

export const Underline: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4 text-sm'>
      <TextLink href='#' underline='always'>
        Always underlined
      </TextLink>
      <TextLink href='#' underline='hover'>
        Underline on hover
      </TextLink>
      <TextLink href='#' underline='none'>
        Never underlined
      </TextLink>
    </div>
  ),
};

export const InProse: Story = {
  name: 'Inline in prose',
  render: () => (
    <p className='text-muted-foreground max-w-md text-sm'>
      We texted a code to your phone. Didn&apos;t get it?{' '}
      <TextLink href='#' variant='inherit' underline='always'>
        Resend the code
      </TextLink>{' '}
      or{' '}
      <TextLink href='#' variant='inherit' underline='always'>
        use a different number
      </TextLink>
      .
    </p>
  ),
};

export const AsChild: Story = {
  name: 'asChild (compose with a router link)',
  // In the schedule app this child would be `next/link`; the DS stays
  // framework-agnostic, so the story composes a plain anchor.
  render: () => (
    <TextLink asChild underline='always'>
      <a href='/bookings' data-testid='router-link'>
        Go to bookings
      </a>
    </TextLink>
  ),
};
