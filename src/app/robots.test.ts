import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots', () => {
  it('disallows every public booking route — a booking code is a live credential', () => {
    const result = robots();

    expect(result.rules).toMatchObject({
      userAgent: '*',
      disallow: expect.arrayContaining([
        '/book',
        '/book/*',
        '/o/*/book',
        '/o/*/book/*',
      ]),
    });
  });
});
