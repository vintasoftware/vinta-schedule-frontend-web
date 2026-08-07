import { describe, it, expect } from 'vitest';
import {
  classifyBrandingWriteForbiddenError,
  extractApiErrorDetail,
  parseBrandingWriteForbidden,
} from './branding-write-errors';

const HAS_PARENT_DETAIL =
  'This organization has a parent organization and cannot manage its own branding. Branding for organizations inside a hierarchy is controlled by the reseller organization above them.';

const NOT_ENTITLED_DETAIL =
  "This organization's plan does not include white-label branding.";

const NO_SLUG_DETAIL =
  'Pick a public slug for this organization before configuring branding.';

describe('parseBrandingWriteForbidden', () => {
  it('maps has-parent detail via substring', () => {
    expect(parseBrandingWriteForbidden(HAS_PARENT_DETAIL)).toBe('has_parent');
  });

  it('maps not-entitled detail via substring', () => {
    expect(parseBrandingWriteForbidden(NOT_ENTITLED_DETAIL)).toBe(
      'not_entitled'
    );
  });

  it('maps no-slug detail via substring', () => {
    expect(parseBrandingWriteForbidden(NO_SLUG_DETAIL)).toBe('no_slug');
  });

  it('returns unknown for unrelated detail', () => {
    expect(parseBrandingWriteForbidden('Permission denied.')).toBe('unknown');
  });

  it('prefers has-parent when multiple substrings could match', () => {
    expect(
      parseBrandingWriteForbidden(
        'This organization has a parent and lacks white-label branding.'
      )
    ).toBe('has_parent');
  });
});

describe('extractApiErrorDetail', () => {
  it('reads detail from a DRF error body', () => {
    expect(extractApiErrorDetail({ detail: NO_SLUG_DETAIL })).toBe(
      NO_SLUG_DETAIL
    );
  });

  it('reads plain strings and Error messages', () => {
    expect(extractApiErrorDetail('network down')).toBe('network down');
    expect(extractApiErrorDetail(new Error('boom'))).toBe('boom');
  });

  it('returns null for unsupported shapes', () => {
    expect(extractApiErrorDetail(null)).toBeNull();
    expect(extractApiErrorDetail({ slug: ['bad'] })).toBeNull();
  });
});

describe('classifyBrandingWriteForbiddenError', () => {
  it('classifies a thrown DRF 403 body', () => {
    expect(
      classifyBrandingWriteForbiddenError({ detail: NOT_ENTITLED_DETAIL })
    ).toBe('not_entitled');
  });

  it('returns null for unknown errors', () => {
    expect(
      classifyBrandingWriteForbiddenError({ detail: 'Something else.' })
    ).toBeNull();
    expect(
      classifyBrandingWriteForbiddenError(new Error('network'))
    ).toBeNull();
  });
});
