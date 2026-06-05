import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Navbar } from './navbar';
import { Button } from '@/components/ui/button';

const meta = {
  title: 'Composition/Navbar',
  component: Navbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const Links = () => (
  <>
    {['Product', 'Pricing', 'Docs'].map((l) => (
      <a
        key={l}
        href='#'
        className='rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
      >
        {l}
      </a>
    ))}
  </>
);

const NavbarDemo = () => (
  <Navbar
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
  render: () => <NavbarDemo />,
};

// Below @3xl links + actions collapse into a hamburger drawer.
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
  render: () => <NavbarDemo />,
};
