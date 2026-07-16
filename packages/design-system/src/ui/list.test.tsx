import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { List, ListItem } from './list';

describe('List', () => {
  it('renders a <ul> by default', () => {
    render(
      <List>
        <ListItem>One</ListItem>
        <ListItem>Two</ListItem>
      </List>
    );
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders an <ol> for the ordered variant', () => {
    render(
      <List variant='ordered'>
        <ListItem>Step one</ListItem>
      </List>
    );
    expect(screen.getByRole('list').tagName).toBe('OL');
  });

  it('lets `as` override the element the variant would pick', () => {
    render(
      <List variant='plain' as='ol'>
        <ListItem>Item</ListItem>
      </List>
    );
    expect(screen.getByRole('list').tagName).toBe('OL');
  });

  it('resolves `gap` through the Space scale, not raw pixels', () => {
    render(
      <List gap={4}>
        <ListItem>One</ListItem>
      </List>
    );
    // Space 4 → 1rem (see layout-style SPACE_REM).
    expect(
      screen.getByRole('list').style.getPropertyValue('--ds-list-gap')
    ).toBe('1rem');
  });

  it('resolves `marker` to a design-token CSS var', () => {
    render(
      <List marker='primary'>
        <ListItem>One</ListItem>
      </List>
    );
    expect(
      screen.getByRole('list').style.getPropertyValue('--ds-list-marker')
    ).toBe('var(--primary)');
  });
});
