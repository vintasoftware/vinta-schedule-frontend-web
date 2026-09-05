import { describe, expect, it } from 'vitest';
import { NO_INDEX_METADATA } from './no-index-metadata';

describe('NO_INDEX_METADATA', () => {
  it('refuses indexing and following for public booking routes', () => {
    expect(NO_INDEX_METADATA.robots).toEqual({ index: false, follow: false });
  });
});
