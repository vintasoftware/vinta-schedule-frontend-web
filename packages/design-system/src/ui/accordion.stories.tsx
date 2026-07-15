import type { Meta, StoryObj } from '@storybook/react-vite';

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
  argTypes: {
    type: {
      control: 'inline-radio',
      options: ['single', 'multiple'],
      description: 'One item open at a time, or many',
    },
    collapsible: {
      control: 'boolean',
      description: 'Allow closing the open item (type="single" only)',
    },
    defaultValue: {
      control: 'text',
      description: 'Value of the item expanded on first render',
    },
    disabled: { control: 'boolean' },
    orientation: {
      control: 'inline-radio',
      options: ['vertical', 'horizontal'],
    },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
  args: { type: 'single' },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: 'single', collapsible: true },
  render: (args) => (
    <Accordion {...args} className='w-96'>
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
        <AccordionContent>
          Yes — no contracts, cancel whenever.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Multiple: Story = {
  // `collapsible` is a type="single" prop, so it is set on Default rather than
  // on the meta — inheriting it here would pass it straight through to the DOM.
  args: { type: 'multiple' },
  render: (args) => (
    <Accordion {...args} className='w-96'>
      <AccordionItem value='1'>
        <AccordionTrigger>Working hours</AccordionTrigger>
        <AccordionContent>Mon–Fri, 9:00 AM – 5:00 PM.</AccordionContent>
      </AccordionItem>
      <AccordionItem value='2'>
        <AccordionTrigger>Buffer time</AccordionTrigger>
        <AccordionContent>10 minutes between appointments.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
