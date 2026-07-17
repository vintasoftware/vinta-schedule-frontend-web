import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import {
  renderDocMarkdownToSafeHtml,
  docsSanitizeSchema,
} from './render-doc-markdown';

describe('renderDocMarkdownToSafeHtml', () => {
  describe('syntax highlighting', () => {
    it('adds className to code spans in fenced code blocks', async () => {
      const markdown = `
\`\`\`javascript
const greeting = "hello";
\`\`\`
      `;
      const html = await renderDocMarkdownToSafeHtml(markdown);
      // rehype-highlight wraps tokens in <span class="hljs-...">
      // Just verify that highlighting markup is present (className on spans)
      expect(html).toContain('class="hljs');
    });

    it('highlights GraphQL code blocks', async () => {
      const markdown = `
\`\`\`graphql
query {
  calendarGroupBookableSlots(groupId: 42) {
    startTime
    endTime
  }
}
\`\`\`
      `;
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).toContain('class="hljs');
    });

    it('highlights curl/bash code blocks', async () => {
      const markdown = `
\`\`\`bash
curl -X POST \\
  -H "Authorization: Bearer user_id:token" \\
  https://api.example.com/graphql
\`\`\`
      `;
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).toContain('class="hljs');
    });

    it('keeps the fenced code block language on <code> as a real class, not an empty one', async () => {
      const markdown = '```javascript\nconst greeting = "hello";\n```';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).toContain('<code class="hljs language-javascript">');
    });
  });

  describe('sanitization', () => {
    // -----------------------------------------------------------------------
    // Security-critical: sanitization proof. Every test in this block must
    // exercise an input that actually reaches `rehype-sanitize` in the tree,
    // and must be able to fail if the schema were loosened or the sanitize
    // step were removed.
    //
    // `remark-rehype` drops raw HTML (script tags, event handler attributes,
    // raw `<a href="javascript:...">`) *before* the sanitizer ever runs — a
    // test built from raw HTML in markdown source proves the parser's drop,
    // not the sanitizer, and would pass even if the schema allowed anything.
    // `javascript:` in markdown *link syntax* is different: `remark-rehype`
    // turns it into a real hast `<a>` node with an `href` property, so the
    // sanitizer's `protocols` allow-list is what strips it — that is a
    // genuine regression test.
    //
    // For payloads that have no markdown-syntax equivalent (`<script>`, an
    // `onClick` handler, a raw `<a>` node) we build the hast tree directly
    // and run it through the exact schema `renderDocMarkdownToSafeHtml`
    // uses (`docsSanitizeSchema`), skipping markdown parsing entirely. This
    // is also the shape a future `rehype-raw` addition (Phase 3's
    // "semi-trusted" backend content) would produce, so it is the payload
    // shape that actually matters for this schema.
    // -----------------------------------------------------------------------

    it('strips javascript: URLs even after highlighting', async () => {
      const markdown =
        '[click me](javascript:alert("XSS")) — a dangerous link should be stripped';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      // The link href should not contain javascript:
      expect(html).not.toContain('javascript:');
      // The text should still be there
      expect(html).toContain('click me');
    });

    it('removes a <script> element that reaches the tree', async () => {
      const tree = {
        type: 'root' as const,
        children: [
          {
            type: 'element' as const,
            tagName: 'script',
            properties: {},
            children: [{ type: 'text' as const, value: 'alert("xss")' }],
          },
        ],
      };
      const processor = unified()
        .use(rehypeSanitize, docsSanitizeSchema)
        .use(rehypeStringify);
      const html = processor.stringify(await processor.run(tree));
      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert');
    });

    it('removes an onClick event handler attribute that reaches the tree', async () => {
      const tree = {
        type: 'root' as const,
        children: [
          {
            type: 'element' as const,
            tagName: 'div',
            properties: { onClick: 'alert(1)' },
            children: [{ type: 'text' as const, value: 'Danger zone' }],
          },
        ],
      };
      const processor = unified()
        .use(rehypeSanitize, docsSanitizeSchema)
        .use(rehypeStringify);
      const html = processor.stringify(await processor.run(tree));
      expect(html).not.toContain('onclick');
      expect(html).not.toContain('alert');
      expect(html).toContain('Danger zone');
    });

    it('removes an href="javascript:" attribute on an anchor element that reaches the tree', async () => {
      const tree = {
        type: 'root' as const,
        children: [
          {
            type: 'element' as const,
            tagName: 'a',
            properties: { href: 'javascript:void(0)' },
            children: [{ type: 'text' as const, value: 'dangerous' }],
          },
        ],
      };
      const processor = unified()
        .use(rehypeSanitize, docsSanitizeSchema)
        .use(rehypeStringify);
      const html = processor.stringify(await processor.run(tree));
      expect(html).not.toContain('javascript:');
      expect(html).toContain('dangerous');
    });
  });

  describe('concept-link rewriting', () => {
    it('rewrites a concept cross-link when conceptSlugs is passed', async () => {
      const markdown = 'See [Calendar Bundles](calendar-bundles.md) for more.';
      const html = await renderDocMarkdownToSafeHtml(markdown, {
        conceptSlugs: ['calendar-bundles', 'calendar-groups'],
      });
      expect(html).toContain('href="/docs/concepts/calendar-bundles"');
    });

    it('neutralizes a backend source link and still sanitizes/highlights the rest of the doc', async () => {
      const markdown = `# Calendar Groups

Source: [calendar_integration/models.py](../../calendar_integration/models.py).

\`\`\`javascript
const x = 1;
\`\`\`
`;
      const html = await renderDocMarkdownToSafeHtml(markdown, {
        conceptSlugs: ['calendar-groups'],
      });
      expect(html).not.toContain('href="../../calendar_integration/models.py"');
      expect(html).toContain('calendar_integration/models.py');
      expect(html).toContain('class="hljs'); // highlighting still runs after the rewrite pass
    });

    it('is a no-op when conceptSlugs is omitted (e.g. the getting-started guide)', async () => {
      const markdown = '[API tokens](/api-tokens)';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).toContain('href="/api-tokens"');
    });

    it('still strips javascript: URLs when concept-link rewriting is active', async () => {
      const markdown =
        '[click me](javascript:alert("XSS")) — a dangerous link should be stripped';
      const html = await renderDocMarkdownToSafeHtml(markdown, {
        conceptSlugs: ['calendar-groups'],
      });
      expect(html).not.toContain('javascript:');
      expect(html).toContain('click me');
    });
  });

  describe('content preservation', () => {
    it('preserves markdown formatting with highlighting', async () => {
      const markdown = `# Getting Started

Here's code:

\`\`\`javascript
const x = 42;
\`\`\`

List:
- Item one
- Item two`;
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).toContain('<h1');
      expect(html).toContain('Getting Started');
      expect(html).toContain('<ul');
      expect(html).toContain('Item one');
      expect(html).toContain('class="hljs'); // Code is highlighted
    });

    it('preserves links that are not javascript:', async () => {
      const markdown =
        '[Safe link](/docs/reference) and [external](https://example.com)';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).toContain('/docs/reference');
      expect(html).toContain('https://example.com');
      expect(html).toContain('<a');
    });
  });
});
