import type { Meta, StoryObj } from '../story-types';

import { List, ListItem } from './list';

const meta = {
  title: 'Components/List',
  component: List,
  tags: ['autodocs'],
  // Container: `children` composes <ListItem>s, so it is a SLOT (§5) and must
  // NOT also appear in argTypes. The curated scalars below are the list's own
  // vocabulary — `gap` is the shared 4px Space scale, `marker` a token color.
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['bullet', 'ordered', 'plain'],
    },
    gap: { control: 'select', options: [0, 1, 2, 3, 4, 6] },
    marker: {
      control: 'select',
      options: ['foreground', 'muted-foreground', 'primary', 'vinta-600'],
    },
  },
  args: { variant: 'bullet', gap: 2 },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem>Connect your Google Calendar</ListItem>
      <ListItem>Pick the calendars to sync</ListItem>
      <ListItem>Share your booking link</ListItem>
    </List>
  ),
};

export const Ordered: Story = {
  render: () => (
    <List variant='ordered' gap={2}>
      <ListItem>Verify your phone number</ListItem>
      <ListItem>Set your availability</ListItem>
      <ListItem>Invite your team</ListItem>
    </List>
  ),
};

export const Plain: Story = {
  name: 'Plain (no markers)',
  render: () => (
    <List variant='plain' gap={3}>
      <ListItem>Mon — 09:00 to 17:00</ListItem>
      <ListItem>Tue — 09:00 to 17:00</ListItem>
      <ListItem>Wed — Unavailable</ListItem>
    </List>
  ),
};

export const ColoredMarkers: Story = {
  render: () => (
    <List marker='vinta-600' gap={2}>
      <ListItem>Unlimited event types</ListItem>
      <ListItem>Team scheduling</ListItem>
      <ListItem>Calendar conflict detection</ListItem>
    </List>
  ),
};
