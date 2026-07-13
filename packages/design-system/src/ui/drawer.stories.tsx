import type { Meta, StoryObj } from '../story-types';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';
import { Button } from './button';

const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  // vaul Drawer.Root scalars (drawer.tsx forwards every prop to it, and owns
  // `shouldScaleBackground`). `children` (trigger + content) is composed → slot.
  argTypes: {
    direction: {
      control: 'select',
      options: ['bottom', 'top', 'left', 'right'],
      description:
        'Edge the drawer slides from. DrawerContent is styled for `bottom`; other directions need content classes to match.',
    },
    modal: {
      control: 'boolean',
      description: 'Block interaction with the page behind the drawer',
    },
    dismissible: {
      control: 'boolean',
      description: 'Allow closing by dragging or clicking the overlay',
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Open on first render (uncontrolled)',
    },
    shouldScaleBackground: {
      control: 'boolean',
      description: 'Scale the page behind the drawer while it is open',
    },
  },
  args: {
    direction: 'bottom',
    modal: true,
    dismissible: true,
    defaultOpen: false,
    shouldScaleBackground: true,
  },
  // A drawer's children are its trigger and its overlay content — nothing else.
  parameters: {
    puck: {
      slots: [{ name: 'children', allow: ['DrawerTrigger', 'DrawerContent'] }],
    },
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant='outline'>Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className='mx-auto w-full max-w-sm'>
          <DrawerHeader>
            <DrawerTitle>Confirm time</DrawerTitle>
            <DrawerDescription>Mon, 9:00–9:30 AM</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>Confirm</Button>
            <DrawerClose asChild>
              <Button variant='outline'>Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};
