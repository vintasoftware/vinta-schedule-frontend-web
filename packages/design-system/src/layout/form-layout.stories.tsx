import type { Meta, StoryObj } from '../story-types';

import { FormLayout } from './form-layout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const meta = {
  title: 'Layout/FormLayout',
  component: FormLayout,
  tags: ['autodocs'],
  // Container: `children` is the composed content and is declared as a SLOT
  // (§3), never an argType — a name may not be both (SLOT_ARGTYPE_COLLISION).
  // The curated scalars are the real, forwarded form props: `gap` (the DS
  // token scale that replaces `space-y-*`) plus the standard form attributes.
  // `className`/`style` stay unexposed (§6).
  argTypes: {
    gap: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12] },
    noValidate: { control: 'boolean' },
    method: { control: 'inline-radio', options: ['get', 'post'] },
    action: { control: 'text' },
    id: { control: 'text' },
  },
  args: { gap: 4, noValidate: false },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof FormLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <FormLayout {...args} onSubmit={(e) => e.preventDefault()}>
      <div>
        <Label htmlFor='fl-email'>Email</Label>
        <Input id='fl-email' type='email' placeholder='you@example.com' />
      </div>
      <div>
        <Label htmlFor='fl-password'>Password</Label>
        <Input id='fl-password' type='password' />
      </div>
      <Button type='submit'>Sign in</Button>
    </FormLayout>
  ),
};

/** The `gap` prop is the token-scale replacement for `space-y-6`. */
export const LooseSpacing: Story = {
  args: { gap: 8 },
  render: (args) => (
    <FormLayout {...args} onSubmit={(e) => e.preventDefault()}>
      <div>
        <Label htmlFor='fl-name'>Full name</Label>
        <Input id='fl-name' placeholder='Ada Lovelace' />
      </div>
      <div>
        <Label htmlFor='fl-org'>Organization</Label>
        <Input id='fl-org' placeholder='Vinta' />
      </div>
      <Button type='submit'>Continue</Button>
    </FormLayout>
  ),
};
