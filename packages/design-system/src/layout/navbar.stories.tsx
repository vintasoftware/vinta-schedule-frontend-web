import type { Meta, StoryObj } from '@storybook/react-vite';

import { Navbar } from './navbar';
import { TextLink } from '../ui/text-link';
import { Button } from '../ui/button';

const meta = {
  title: 'Composition/Navbar',
  component: Navbar,
  tags: ['autodocs'],
  argTypes: {
    width: { control: 'inline-radio', options: ['contained', 'full'] },
  },
  args: { width: 'contained' },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const Links = () => (
  <>
    {[
      { label: 'Product', to: '/product' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Docs', to: '/docs' },
    ].map((l) => (
      <TextLink
        key={l.label}
        href={l.to}
        variant='muted'
        underline='none'
        className='hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm font-medium'
      >
        {l.label}
      </TextLink>
    ))}
  </>
);

const NavbarDemo = (args: Partial<Parameters<typeof Navbar>[0]>) => (
  <Navbar
    {...args}
    links={<Links />}
    actions={
      <>
        <Button variant='ghost' size='sm'>
          Log in
        </Button>
        <Button size='sm'>Sign up</Button>
      </>
    }
  />
);

export const Default: Story = {
  render: (args) => <NavbarDemo {...args} />,
};

// Below @3xl links + actions collapse into a hamburger drawer.
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
  render: (args) => <NavbarDemo {...args} />,
};
