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

  it('disallows every codeless group scheduling route too — an unauthenticated write surface, even without a code in the URL', () => {
    const result = robots();

    expect(result.rules).toMatchObject({
      userAgent: '*',
      disallow: expect.arrayContaining(['/g', '/g/*', '/o/*/g', '/o/*/g/*']),
    });
  });
});
