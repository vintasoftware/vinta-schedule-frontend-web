import type { Meta, StoryObj } from '../story-types';
import { PrototypeModeProvider } from 'vinta-ui-composer-prototype-mode';

import { Link } from './link';

const meta = {
  title: 'Layout/Link',
  component: Link,
  tags: ['autodocs'],
  // Leaf: the label is editable text, the target is a plain string the platform
  // resolves. `className`/`style` are never exposed (§6).
  argTypes: {
    children: { control: 'text', description: 'Link label' },
    linkTo: {
      control: 'text',
      description: 'Target screen the platform resolves',
    },
  },
  args: { children: 'View booking', linkTo: '/bookings' },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default — no provider, so the context falls back to editor mode: INERT.
 * This is what the composer canvas renders while you're editing.
 */
export const EditorInert: Story = {};

/** Viewer mode with a host `navigate` — the only state that actually routes. */
export const ViewerNavigating: Story = {
  render: (args) => (
    <PrototypeModeProvider
      mode='viewer'
      navigate={(to) => window.alert(`navigate → ${to}`)}
    >
      <Link {...args} />
    </PrototypeModeProvider>
  ),
};

/** Viewer mode, but the target is unreachable (archived/unpublished) → INERT. */
export const ViewerUnreachable: Story = {
  render: (args) => (
    <PrototypeModeProvider
      mode='viewer'
      navigate={(to) => window.alert(`navigate → ${to}`)}
      canNavigate={() => false}
    >
      <Link {...args} />
    </PrototypeModeProvider>
  ),
};
