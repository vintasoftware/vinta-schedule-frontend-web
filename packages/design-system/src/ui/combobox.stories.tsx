import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { Combobox } from './combobox';

const FRAMEWORKS: Array<{
  value: string;
  label: string;
  description?: string;
}> = [
  { value: 'next', label: 'Next.js', description: 'React framework' },
  { value: 'sveltekit', label: 'SvelteKit', description: 'Svelte framework' },
  { value: 'nuxt', label: 'Nuxt.js', description: 'Vue framework' },
  { value: 'remix', label: 'Remix', description: 'React framework' },
  { value: 'astro', label: 'Astro', description: 'Static site builder' },
];

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  argTypes: {
    options: {
      control: 'object',
      description: 'Selectable options: { value, label, description? }[]',
    },
    placeholder: { control: 'text' },
    searchPlaceholder: { control: 'text' },
    emptyText: { control: 'text', description: 'Shown when nothing matches' },
    multiple: {
      control: 'boolean',
      description: 'Allow selecting more than one option',
    },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    options: FRAMEWORKS,
    placeholder: 'Select a framework…',
    searchPlaceholder: 'Search frameworks…',
    // Combobox is controlled, so `onValueChange` is required. The stories below
    // each own their state, but the arg has to be present to satisfy the type.
    onValueChange: () => {},
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

// Hooks must live in components, not in story `render` functions
// (react-hooks/rules-of-hooks) — hence the named wrappers.
function SingleSelectStory() {
  const [value, setValue] = React.useState('');
  return (
    <div className='w-64'>
      <Combobox
        options={FRAMEWORKS}
        value={value}
        onValueChange={setValue}
        placeholder='Select a framework…'
        searchPlaceholder='Search frameworks…'
      />
    </div>
  );
}

function MultiSelectStory() {
  const [values, setValues] = React.useState<string[]>([]);
  return (
    <div className='w-64'>
      <Combobox
        multiple
        options={FRAMEWORKS}
        value={values}
        onValueChange={setValues}
        placeholder='Select frameworks…'
        searchPlaceholder='Search frameworks…'
      />
    </div>
  );
}

function WithDescriptionsStory() {
  const [value, setValue] = React.useState('');
  return (
    <div className='w-64'>
      <Combobox
        options={FRAMEWORKS}
        value={value}
        onValueChange={setValue}
        placeholder='Select a framework…'
      />
    </div>
  );
}

export const SingleSelect: Story = {
  render: () => <SingleSelectStory />,
};

export const MultiSelect: Story = {
  render: () => <MultiSelectStory />,
};

export const WithDescriptions: Story = {
  render: () => <WithDescriptionsStory />,
};

export const Loading: Story = {
  render: () => (
    <div className='w-64'>
      <Combobox
        options={[]}
        value={[]}
        onValueChange={() => {}}
        multiple
        isLoading
        placeholder='Select members…'
        searchPlaceholder='Search members…'
      />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className='w-64'>
      <Combobox
        options={FRAMEWORKS}
        value='next'
        onValueChange={() => {}}
        disabled
        placeholder='Select a framework…'
      />
    </div>
  ),
};
