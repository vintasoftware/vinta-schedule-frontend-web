import type { Meta } from '@storybook/react-vite';
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

const meta: Meta = {
  title: 'Components/Combobox',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;

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

export const SingleSelect = {
  render: () => <SingleSelectStory />,
};

export const MultiSelect = {
  render: () => <MultiSelectStory />,
};

export const WithDescriptions = {
  render: () => <WithDescriptionsStory />,
};

export const Loading = {
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

export const Disabled = {
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
