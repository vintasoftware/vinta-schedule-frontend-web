import type { Meta, StoryObj } from '../story-types';

import { Tabs, TabsList, TabsTrigger } from './tabs';

/**
 * TabsTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a tab trigger only means something inside a TabsList.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose TabsTrigger.
 */
const meta = {
  title: 'Components/TabsTrigger',
  component: TabsTrigger,
  tags: ['!dev'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Must match the TabsContent value it reveals',
    },
    children: { control: 'text', description: 'Copy' },
  },
  args: { value: 'a', children: 'One' },
} satisfies Meta<typeof TabsTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue='a'>
      <TabsList>
        <TabsTrigger value='a'>One</TabsTrigger>
      </TabsList>
    </Tabs>
  ),
};
