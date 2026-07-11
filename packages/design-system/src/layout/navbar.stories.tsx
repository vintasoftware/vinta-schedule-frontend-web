import type { Meta, StoryObj } from '../story-types';

import { Navbar } from './navbar';
import { Link } from './link';
import { Button } from '../ui/button';

const meta = {
  title: 'Composition/Navbar',
  component: Navbar,
  tags: ['autodocs'],
  // Three real ReactNode props → three slots (§3). `width` is the only editable
  // scalar; `className`/`style` stay unexposed (§6).
  argTypes: {
    width: { control: 'inline-radio', options: ['contained', 'full'] },
  },
  args: { width: 'contained' },
  parameters: {
    layout: 'fullscreen',
    puck: { slots: ['brand', 'links', 'actions'] },
  },
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Nav links use the DS `Link` primitive, which is inert here (no
// PrototypeModeProvider ⇒ editor mode) — exactly how it renders on the
// composer canvas.
const Links = () => (
  <>
    {[
      { label: 'Product', to: '/product' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Docs', to: '/docs' },
    ].map((l) => (
      <Link
        key={l.label}
        linkTo={l.to}
        className='text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-3 py-2 text-sm font-medium no-underline hover:no-underline'
      >
        {l.label}
      </Link>
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
