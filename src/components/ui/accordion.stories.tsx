import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

const meta = {
  title: 'Components/Accordion',
  component: Accordion,
  tags: ['autodocs'],
} satisfies Meta<typeof Accordion>;

export default meta;
// Accordion requires `type` on its root, so type stories loosely (render-only).
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Accordion type='single' collapsible className='w-96'>
      <AccordionItem value='1'>
        <AccordionTrigger>How does calendar sync work?</AccordionTrigger>
        <AccordionContent>
          We poll your connected calendars every few minutes and reconcile
          changes both ways.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='2'>
        <AccordionTrigger>Is my data private?</AccordionTrigger>
        <AccordionContent>
          Event details stay encrypted and are never shared with third parties.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='3'>
        <AccordionTrigger>Can I cancel anytime?</AccordionTrigger>
        <AccordionContent>Yes — no contracts, cancel whenever.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
