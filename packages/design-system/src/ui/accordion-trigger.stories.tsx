import type { Meta, StoryObj } from '../story-types';

import { Accordion, AccordionItem, AccordionTrigger } from './accordion';

/**
 * AccordionTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an accordion trigger only means something inside an AccordionItem.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose AccordionTrigger.
 */
const meta = {
  title: 'Components/AccordionTrigger',
  component: AccordionTrigger,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Copy' },
  },
  args: { children: 'Section' },
} satisfies Meta<typeof AccordionTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Accordion type='single' collapsible>
      <AccordionItem value='a'>
        <AccordionTrigger>Section</AccordionTrigger>
      </AccordionItem>
    </Accordion>
  ),
};
