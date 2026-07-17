import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import {
  rehypeRewriteConceptLinks,
  classifyConceptLink,
} from './rewrite-links';

// Matches the real backend manifest (`GET /public-api-docs/`) at the time of
// writing: availability, calendar-bundles, calendar-groups, calendars,
// events, recurrence.
const CONCEPT_SLUGS = [
  'availability',
  'calendar-bundles',
  'calendar-groups',
  'calendars',
  'events',
  'recurrence',
];

async function renderWithLinkRewrite(markdown: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeRewriteConceptLinks, { conceptSlugs: CONCEPT_SLUGS })
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

describe('rehypeRewriteConceptLinks', () => {
  it('neutralizes a link to a backend source file (no href, not a link)', async () => {
    // Real shape from calendar-groups.md's "Source:" line.
    const html = await renderWithLinkRewrite(
      'Source: [calendar_integration/models.py](../../calendar_integration/models.py).'
    );
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<a');
    expect(html).toContain('calendar_integration/models.py');
  });

  it('neutralizes a relative link to a repo doc that is not a ported concept (e.g. glossary)', async () => {
    const html = await renderWithLinkRewrite(
      'See the [glossary](../glossary.md) for definitions.'
    );
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<a');
    expect(html).toContain('glossary');
  });

  it('rewrites a concept cross-link to /docs/concepts/<slug>', async () => {
    const html = await renderWithLinkRewrite(
      'Compared to a [bundle](calendar-bundles.md): bundles fix the membership.'
    );
    expect(html).toContain('href="/docs/concepts/calendar-bundles"');
  });

  it('rewrites a concept cross-link with a leading ./', async () => {
    const html = await renderWithLinkRewrite('See [Events](./events.md).');
    expect(html).toContain('href="/docs/concepts/events"');
  });

  it('rewrites a concept cross-link and preserves its anchor fragment', async () => {
    const html = await renderWithLinkRewrite(
      'See [recurrence.md](recurrence.md#bulk-modifications-and-splits).'
    );
    expect(html).toContain(
      'href="/docs/concepts/recurrence#bulk-modifications-and-splits"'
    );
  });

  it('leaves a same-page anchor link untouched', async () => {
    const html = await renderWithLinkRewrite('[Jump to section](#section)');
    expect(html).toContain('href="#section"');
  });

  it('leaves an external https link untouched', async () => {
    const html = await renderWithLinkRewrite(
      '[Vinta](https://www.vinta.com.br)'
    );
    expect(html).toContain('href="https://www.vinta.com.br"');
  });

  it('leaves an already site-relative /docs link untouched', async () => {
    const html = await renderWithLinkRewrite(
      '[Getting started](/docs/getting-started)'
    );
    expect(html).toContain('href="/docs/getting-started"');
  });
});

describe('classifyConceptLink', () => {
  const slugs = new Set(CONCEPT_SLUGS);

  it('classifies a backend source path as neutralize', () => {
    expect(
      classifyConceptLink('../../calendar_integration/models.py', slugs)
    ).toEqual({ type: 'neutralize' });
  });

  it('classifies a known concept slug .md link as rewrite', () => {
    expect(classifyConceptLink('calendar-bundles.md', slugs)).toEqual({
      type: 'rewrite',
      href: '/docs/concepts/calendar-bundles',
    });
  });

  it('classifies a .md link whose basename is not a known slug as neutralize', () => {
    expect(classifyConceptLink('../glossary.md', slugs)).toEqual({
      type: 'neutralize',
    });
  });

  it('classifies a pure anchor as leave', () => {
    expect(classifyConceptLink('#section', slugs)).toEqual({ type: 'leave' });
  });

  it('classifies an external URL as leave', () => {
    expect(classifyConceptLink('https://example.com', slugs)).toEqual({
      type: 'leave',
    });
  });
});
