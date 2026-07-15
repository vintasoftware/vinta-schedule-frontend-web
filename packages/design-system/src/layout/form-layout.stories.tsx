import type { Meta, StoryObj } from '@storybook/react-vite';

import { FormLayout } from './form-layout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const meta = {
  title: 'Layout/FormLayout',
  component: FormLayout,
  tags: ['autodocs'],
  argTypes: {
    gap: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12] },
    noValidate: { control: 'boolean' },
    method: { control: 'inline-radio', options: ['get', 'post'] },
    action: { control: 'text' },
    id: { control: 'text' },
  },
  args: { gap: 4, noValidate: false },
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
