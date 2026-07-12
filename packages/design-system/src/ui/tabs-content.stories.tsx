import type { Meta, StoryObj } from '../story-types';

import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import { Text } from '../layout/text';

/**
 * TabsContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a tab panel only means something inside Tabs.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose TabsContent.
 */
const meta = {
  title: 'Components/TabsContent',
  component: TabsContent,
  tags: ['!dev'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Must match the TabsTrigger value that reveals it',
    },
  },
  args: { value: 'a' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof TabsContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue='a'>
      <TabsList>
        <TabsTrigger value='a'>One</TabsTrigger>
      </TabsList>
      <TabsContent value='a'>
        <Text>Panel body</Text>
      </TabsContent>
    </Tabs>
  ),
};
