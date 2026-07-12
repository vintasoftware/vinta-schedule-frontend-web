import type { Meta, StoryObj } from '../story-types';

import { Tabs, TabsList, TabsTrigger } from './tabs';

/**
 * TabsList — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a tab list only means something inside Tabs.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose TabsList.
 */
const meta = {
  title: 'Components/TabsList',
  component: TabsList,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof TabsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue='a'>
      <TabsList>
        <TabsTrigger value='a'>One</TabsTrigger>
        <TabsTrigger value='b'>Two</TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};
