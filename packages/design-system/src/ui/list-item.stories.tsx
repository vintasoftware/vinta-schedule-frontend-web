import type { Meta, StoryObj } from '../story-types';

import { List, ListItem } from './list';

/**
 * ListItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a bare <li> is meaningless alone (its behaviour is documented in the List story).
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose ListItem.
 */
const meta = {
  title: 'Components/ListItem',
  component: ListItem,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: { id: 'item-1' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof ListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <List>
      <ListItem>A list item</ListItem>
    </List>
  ),
};
