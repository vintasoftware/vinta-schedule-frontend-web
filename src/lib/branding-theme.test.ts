import { describe, it, expect } from 'vitest';

import { brandingThemeStyle } from '@/lib/branding-theme';
import { VINTA_DEFAULT_BRANDING } from '@/lib/branding-shared';
import type { TenantBranding } from '@/lib/branding-shared';

function branding(overrides: Partial<TenantBranding> = {}): TenantBranding {
  return {
    appName: 'Acme Scheduling',
    logoUrl: 'https://api.example.com/branding/logo/acme/',
    primaryColor: '',
    secondaryColor: '',
    ...overrides,
  };
}

describe('brandingThemeStyle', () => {
  it('maps the primary color to the brand surface and the focus ring', () => {
    expect(brandingThemeStyle(branding({ primaryColor: '#1A73E8' }))).toEqual({
      '--primary': '#1A73E8',
      '--color-primary': '#1A73E8',
      '--ring': '#1A73E8',
      '--color-ring': '#1A73E8',
    });
  });

  it('maps the secondary color to text on the brand surface', () => {
    expect(brandingThemeStyle(branding({ secondaryColor: '#FFFFFF' }))).toEqual(
      {
        '--primary-foreground': '#FFFFFF',
        '--color-primary-foreground': '#FFFFFF',
      }
    );
  });

  it('sets both tokens when both colors are configured', () => {
    expect(
      brandingThemeStyle(
        branding({ primaryColor: '#1A73E8', secondaryColor: '#FBBC04FF' })
      )
    ).toEqual({
      '--primary': '#1A73E8',
      '--color-primary': '#1A73E8',
      '--ring': '#1A73E8',
      '--color-ring': '#1A73E8',
      '--primary-foreground': '#FBBC04FF',
      '--color-primary-foreground': '#FBBC04FF',
    });
  });

  it('accepts the short hex forms', () => {
    expect(
      brandingThemeStyle(branding({ primaryColor: '#f0a' }))?.[
        '--primary' as keyof ReturnType<typeof brandingThemeStyle>
      ]
    ).toBe('#f0a');
    expect(
      brandingThemeStyle(branding({ primaryColor: '#f0af' }))?.[
        '--primary' as keyof ReturnType<typeof brandingThemeStyle>
      ]
    ).toBe('#f0af');
  });

  it('trims surrounding whitespace', () => {
    expect(
      brandingThemeStyle(branding({ primaryColor: '  #1A73E8  ' }))
    ).toEqual({
      '--primary': '#1A73E8',
      '--color-primary': '#1A73E8',
      '--ring': '#1A73E8',
      '--color-ring': '#1A73E8',
    });
  });

  it('returns undefined for the unresolved-tenant default (empty colors)', () => {
    expect(brandingThemeStyle(VINTA_DEFAULT_BRANDING)).toBeUndefined();
  });

  it('returns undefined when no branding was resolved at all', () => {
    expect(brandingThemeStyle(undefined)).toBeUndefined();
  });

  it.each([
    ['a bare color name', 'rebeccapurple'],
    ['a functional color', 'rgb(26 115 232)'],
    ['a missing hash', '1A73E8'],
    ['the wrong digit count', '#1A73E'],
    ['a non-hex digit', '#GGGGGG'],
    ['a CSS injection attempt', '#fff; background: url(evil)'],
  ])('drops %s rather than emitting it', (_label, value) => {
    expect(
      brandingThemeStyle(branding({ primaryColor: value }))
    ).toBeUndefined();
  });

  it('keeps the valid color when only one of the two is malformed', () => {
    expect(
      brandingThemeStyle(
        branding({ primaryColor: '#1A73E8', secondaryColor: 'white' })
      )
    ).toEqual({
      '--primary': '#1A73E8',
      '--color-primary': '#1A73E8',
      '--ring': '#1A73E8',
      '--color-ring': '#1A73E8',
    });
  });
});
