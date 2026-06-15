import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { MyMembership } from '@/client';
import { OrgSwitcher } from './org-switcher';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALPHA: MyMembership = {
  organization: { id: 1, name: 'Alpha Corp' },
  role: 'admin',
};

const BETA: MyMembership = {
  organization: { id: 2, name: 'Beta Ltd' },
  role: 'member',
};

const GAMMA: MyMembership = {
  organization: { id: 3, name: 'Gamma Inc' },
  role: 'admin',
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Organizations/OrgSwitcher',
  component: OrgSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className='bg-sidebar w-64 rounded-md p-3'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrgSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;
// Use plain StoryObj (no meta arg constraint) for stories with custom render
// that don't need the meta args — avoids TS "missing required args" error.
type FreeStory = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Two orgs — Alpha Corp is active (has a check). Beta Ltd is listed below. */
export const TwoOrgsFirstActive: Story = {
  args: {
    memberships: [ALPHA, BETA],
    activeOrgId: '1',
    onSelect: (id) => console.log('onSelect', id),
  },
};

/** Two orgs — Beta Ltd is active. */
export const TwoOrgsSecondActive: Story = {
  args: {
    memberships: [ALPHA, BETA],
    activeOrgId: '2',
    onSelect: (id) => console.log('onSelect', id),
  },
};

/** Three orgs — with onCreateOrg wired ("+New organization" is enabled). */
export const ThreeOrgsWithCreateAction: Story = {
  args: {
    memberships: [ALPHA, BETA, GAMMA],
    activeOrgId: '1',
    onSelect: (id) => console.log('onSelect', id),
    onCreateOrg: () => console.log('onCreateOrg'),
  },
};

/** No onCreateOrg — the "+New organization" item is disabled (Phase 5 will wire it). */
export const WithoutCreateOrg: Story = {
  args: {
    memberships: [ALPHA, BETA],
    activeOrgId: '1',
    onSelect: (id) => console.log('onSelect', id),
  },
};

/** Interactive: state is tracked so selecting an org updates the trigger. */
export const Interactive: FreeStory = {
  render: function Render() {
    const [activeOrgId, setActiveOrgId] = React.useState('1');
    return (
      <div className='bg-sidebar w-64 rounded-md p-3'>
        <OrgSwitcher
          memberships={[ALPHA, BETA, GAMMA]}
          activeOrgId={activeOrgId}
          onSelect={setActiveOrgId}
          onCreateOrg={() => alert('Create org — wired in Phase 5')}
        />
      </div>
    );
  },
};
