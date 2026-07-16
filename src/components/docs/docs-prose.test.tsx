/**
 * DocsProse — the prose wrapper for docs content with optional HTML injection.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocsProse } from './docs-prose';

describe('DocsProse', () => {
  it('renders children when provided', () => {
    const { container } = render(
      <DocsProse>
        <p>Test paragraph</p>
      </DocsProse>
    );

    expect(screen.getByText('Test paragraph')).toBeInTheDocument();
    expect(container.querySelector('p')).toBeInTheDocument();
  });

  it('injects pre-sanitized HTML when provided', () => {
    const { container } = render(<DocsProse html='<p>Injected HTML</p>' />);

    expect(screen.getByText('Injected HTML')).toBeInTheDocument();
    const box = container.firstChild as HTMLElement;
    expect(box.innerHTML).toBe('<p>Injected HTML</p>');
  });

  it('applies prose descendant classes for children content', () => {
    const { container } = render(
      <DocsProse>
        <h1>Heading</h1>
        <p>Paragraph</p>
        <ul>
          <li>List item</li>
        </ul>
      </DocsProse>
    );

    const box = container.firstChild as HTMLElement;
    expect(box.className).toMatch(/\[&_h1\]/);
    expect(box.className).toMatch(/\[&_p\]/);
    expect(box.className).toMatch(/\[&_ul\]/);
  });

  it('applies prose descendant classes for injected HTML content', () => {
    const { container } = render(
      <DocsProse html='<h2>Heading</h2><p>Paragraph</p>' />
    );

    const box = container.firstChild as HTMLElement;
    expect(box.className).toMatch(/\[&_h2\]/);
    expect(box.className).toMatch(/\[&_p\]/);
  });

  it('preserves additional className prop with prose classes', () => {
    const { container } = render(
      <DocsProse className='custom-class'>Content</DocsProse>
    );

    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('custom-class');
    expect(box.className).toMatch(/\[&_p\]/);
  });
});
