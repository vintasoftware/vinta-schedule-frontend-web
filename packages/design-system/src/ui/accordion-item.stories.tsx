import type { Meta, StoryObj } from '../story-types';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';

/**
 * AccordionItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an accordion section only means something inside an Accordion.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AccordionItem.
 */
const meta = {
  title: 'Components/AccordionItem',
  component: AccordionItem,
  tags: ['!dev'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Unique id for this section',
    },
    disabled: { control: 'boolean' },
  },
  args: { value: 'a' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof AccordionItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Accordion type='single' collapsible>
      <AccordionItem value='a'>
        <AccordionTrigger>Section</AccordionTrigger>
        <AccordionContent>Body</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
