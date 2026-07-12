import type { Meta, StoryObj } from '../story-types';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';
import { Text } from '../layout/text';

/**
 * AccordionContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: accordion body copy only means something inside an AccordionItem.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AccordionContent.
 */
const meta = {
  title: 'Components/AccordionContent',
  component: AccordionContent,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof AccordionContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Accordion type='single' collapsible defaultValue='a'>
      <AccordionItem value='a'>
        <AccordionTrigger>Section</AccordionTrigger>
        <AccordionContent>
          <Text>Body</Text>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
