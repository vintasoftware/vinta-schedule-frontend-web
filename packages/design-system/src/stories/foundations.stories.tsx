import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Visual reference for the Vinta Schedule design tokens that every component
 * reads from. Source of truth: `Vinta Schedule Design System/colors_and_type.css`.
 */
const meta: Meta = {
  title: 'Foundations/Overview',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

const Swatch = ({ name, className }: { name: string; className: string }) => (
  <div className='flex flex-col gap-2'>
    <div className={`h-16 w-full rounded-lg border ${className}`} />
    <span className='text-muted-foreground font-mono text-xs'>{name}</span>
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className='space-y-4'>
    <h2 className='text-2xl font-semibold tracking-tight'>{title}</h2>
    {children}
  </section>
);

// Literal class strings — Tailwind only generates utilities it can see verbatim.
const SEMANTIC = [
  { name: 'background', className: 'bg-background' },
  { name: 'foreground', className: 'bg-foreground' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'secondary', className: 'bg-secondary' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'card', className: 'bg-card' },
  { name: 'destructive', className: 'bg-destructive' },
  { name: 'success', className: 'bg-success' },
  { name: 'warning', className: 'bg-warning' },
  { name: 'border', className: 'bg-border' },
  { name: 'ring', className: 'bg-ring' },
];

const VINTA = [
  { name: 'vinta-50', className: 'bg-vinta-50' },
  { name: 'vinta-100', className: 'bg-vinta-100' },
  { name: 'vinta-200', className: 'bg-vinta-200' },
  { name: 'vinta-300', className: 'bg-vinta-300' },
  { name: 'vinta-400', className: 'bg-vinta-400' },
  { name: 'vinta-500', className: 'bg-vinta-500' },
  { name: 'vinta-600', className: 'bg-vinta-600' },
  { name: 'vinta-700', className: 'bg-vinta-700' },
  { name: 'vinta-800', className: 'bg-vinta-800' },
  { name: 'vinta-900', className: 'bg-vinta-900' },
  { name: 'vinta-950', className: 'bg-vinta-950' },
];

const TEAL = [
  { name: 'teal-100', className: 'bg-teal-100' },
  { name: 'teal-300', className: 'bg-teal-300' },
  { name: 'teal-500', className: 'bg-teal-500' },
  { name: 'teal-600', className: 'bg-teal-600' },
  { name: 'teal-700', className: 'bg-teal-700' },
];

export const Colors: Story = {
  render: () => (
    <div className='space-y-10 p-8'>
      <Section title='Semantic'>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6'>
          {SEMANTIC.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Section>
      <Section title='Vinta blue — brand ramp'>
        <div className='grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-11'>
          {VINTA.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Section>
      <Section title='Teal — scheduling / availability'>
        <div className='grid grid-cols-3 gap-4 sm:grid-cols-5'>
          {TEAL.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Section>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className='space-y-6 p-8'>
      <h1 className='text-5xl font-bold tracking-tight'>Display / 5xl bold</h1>
      <h2 className='text-4xl font-semibold tracking-tight'>Heading 1 / 4xl</h2>
      <h3 className='text-2xl font-semibold tracking-tight'>Heading 2 / 2xl</h3>
      <h4 className='text-xl font-semibold'>Heading 3 / xl</h4>
      <p className='text-muted-foreground text-lg'>
        Lead — reassuring, healthcare-aware copy in DM Sans.
      </p>
      <p className='text-base'>
        Body — the quick brown fox books an appointment at 9:00 AM.
      </p>
      <p className='text-muted-foreground text-sm'>Small / caption text.</p>
      <p className='font-mono text-sm'>Geist Mono — 09:00–09:30 · ID a1b2c3</p>
    </div>
  ),
};

const SHADOWS = [
  { name: 'shadow-xs', className: 'shadow-xs' },
  { name: 'shadow-sm', className: 'shadow-sm' },
  { name: 'shadow-md', className: 'shadow-md' },
  { name: 'shadow-lg', className: 'shadow-lg' },
  { name: 'shadow-xl', className: 'shadow-xl' },
];

export const Elevation: Story = {
  render: () => (
    <div className='grid grid-cols-2 gap-8 p-12 sm:grid-cols-5'>
      {SHADOWS.map((s) => (
        <div key={s.name} className='flex flex-col items-center gap-2'>
          <div className={`bg-card h-20 w-20 rounded-xl ${s.className}`} />
          <span className='text-muted-foreground font-mono text-xs'>
            {s.name}
          </span>
        </div>
      ))}
    </div>
  ),
};

const RADII = [
  { name: 'rounded-sm', className: 'rounded-sm' },
  { name: 'rounded-md', className: 'rounded-md' },
  { name: 'rounded-lg', className: 'rounded-lg' },
  { name: 'rounded-xl', className: 'rounded-xl' },
  { name: 'rounded-2xl', className: 'rounded-2xl' },
  { name: 'rounded-full', className: 'rounded-full' },
];

export const Radius: Story = {
  render: () => (
    <div className='flex flex-wrap gap-8 p-12'>
      {RADII.map((r) => (
        <div key={r.name} className='flex flex-col items-center gap-2'>
          <div className={`bg-primary h-20 w-20 ${r.className}`} />
          <span className='text-muted-foreground font-mono text-xs'>
            {r.name}
          </span>
        </div>
      ))}
    </div>
  ),
};

// Strict 4px base grid — every gap/pad/margin snaps to a token.
const SPACING = [
  { token: 'space-1', px: '4px', className: 'w-1' },
  { token: 'space-2', px: '8px', className: 'w-2' },
  { token: 'space-3', px: '12px', className: 'w-3' },
  { token: 'space-4', px: '16px', className: 'w-4' },
  { token: 'space-6', px: '24px', className: 'w-6' },
  { token: 'space-8', px: '32px', className: 'w-8' },
  { token: 'space-12', px: '48px', className: 'w-12' },
  { token: 'space-16', px: '64px', className: 'w-16' },
  { token: 'space-24', px: '96px', className: 'w-24' },
];

export const Spacing: Story = {
  render: () => (
    <div className='space-y-2 p-8'>
      <p className='text-muted-foreground mb-4 text-sm'>
        Strict 4px base grid. Every margin, pad &amp; gap snaps to a token.
      </p>
      {SPACING.map((s) => (
        <div key={s.token} className='flex items-center gap-4'>
          <span className='text-muted-foreground w-20 flex-none font-mono text-xs'>
            {s.token}
          </span>
          <div className={`bg-vinta-600 h-3.5 rounded-sm ${s.className}`} />
          <span className='font-mono text-xs'>{s.px}</span>
        </div>
      ))}
    </div>
  ),
};

export const Grid: Story = {
  render: () => (
    <div className='space-y-3 p-8'>
      <p className='text-muted-foreground text-sm'>
        12-column grid · 1200px max · 24px gutters · 32px margins.
      </p>
      <div className='border-border rounded-lg border p-2'>
        <div className='grid grid-cols-12 gap-6'>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className='border-vinta-200 bg-vinta-50 h-24 rounded-sm border-x'
            />
          ))}
        </div>
      </div>
    </div>
  ),
};
