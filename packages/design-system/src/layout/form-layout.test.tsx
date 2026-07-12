import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FormLayout } from './form-layout';

describe('FormLayout', () => {
  it('renders a real <form> element', () => {
    const { container } = render(
      <FormLayout>
        <input name='a' />
      </FormLayout>
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('FORM');
  });

  it('stacks children vertically with the gap token (default 4 → 1rem)', () => {
    const { container } = render(
      <FormLayout>
        <span>a</span>
      </FormLayout>
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.display).toBe('flex');
    expect(el.style.flexDirection).toBe('column');
    expect(el.style.gap).toBe('1rem');
  });

  it('maps the gap prop onto the token scale', () => {
    const { container } = render(
      <FormLayout gap={6}>
        <span>a</span>
      </FormLayout>
    );
    expect((container.firstElementChild as HTMLElement).style.gap).toBe(
      '1.5rem'
    );
  });

  it('fires onSubmit when the form is submitted', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const user = userEvent.setup();

    render(
      <FormLayout onSubmit={onSubmit}>
        <button type='submit'>Save</button>
      </FormLayout>
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('forwards standard form attributes and the ref', () => {
    const ref = createRef<HTMLFormElement>();
    render(
      <FormLayout
        ref={ref}
        id='signup'
        action='/signup'
        method='post'
        noValidate
      >
        <span>a</span>
      </FormLayout>
    );

    const el = ref.current as HTMLFormElement;
    expect(el).toBeInstanceOf(HTMLFormElement);
    expect(el.id).toBe('signup');
    expect(el.getAttribute('action')).toBe('/signup');
    expect(el.getAttribute('method')).toBe('post');
    expect(el.noValidate).toBe(true);
  });
});
