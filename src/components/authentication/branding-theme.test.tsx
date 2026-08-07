import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BrandingTheme } from '@/components/authentication/branding-theme';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';

const acmeBranding: TenantBranding = {
  appName: 'Acme Scheduling',
  logoUrl: 'https://api.example.com/branding/logo/acme/',
  primaryColor: '#1A73E8',
  secondaryColor: '#FFFFFF',
};

describe('BrandingTheme', () => {
  it('declares the brand tokens on a wrapper around the page', () => {
    render(
      <BrandingTheme branding={acmeBranding}>
        <p>page</p>
      </BrandingTheme>
    );

    const wrapper = screen.getByText('page').parentElement as HTMLElement;

    expect(wrapper.style.getPropertyValue('--primary')).toBe('#1A73E8');
    expect(wrapper.style.getPropertyValue('--color-primary')).toBe('#1A73E8');
    expect(wrapper.style.getPropertyValue('--ring')).toBe('#1A73E8');
    expect(wrapper.style.getPropertyValue('--primary-foreground')).toBe(
      '#FFFFFF'
    );
    expect(wrapper.style.getPropertyValue('--color-primary-foreground')).toBe(
      '#FFFFFF'
    );
  });

  it('keeps the wrapper out of the layout', () => {
    render(
      <BrandingTheme branding={acmeBranding}>
        <p>page</p>
      </BrandingTheme>
    );

    const wrapper = screen.getByText('page').parentElement as HTMLElement;

    // `display: contents` generates no box, so the shell's flex and height
    // rules apply to the page exactly as they do unbranded.
    expect(wrapper.style.display).toBe('contents');
  });

  it('renders children bare when the tenant configured no colors', () => {
    const { container } = render(
      <BrandingTheme branding={VINTA_DEFAULT_BRANDING}>
        <p>page</p>
      </BrandingTheme>
    );

    expect(container.querySelector('[data-branding-theme]')).toBeNull();
    expect(container.firstElementChild?.tagName).toBe('P');
  });

  it('renders children bare when there is no branding at all', () => {
    const { container } = render(
      <BrandingTheme>
        <p>page</p>
      </BrandingTheme>
    );

    expect(container.querySelector('[data-branding-theme]')).toBeNull();
    expect(container.firstElementChild?.tagName).toBe('P');
  });
});
