import { describe, it, expect } from 'vitest';
import { renderDocMarkdownToSafeHtml } from './render-doc-markdown';

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
  });

  describe('sanitization', () => {
    it('strips javascript: URLs even after highlighting', async () => {
      const markdown =
        '[click me](javascript:alert("XSS")) — a dangerous link should be stripped';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      // The link href should not contain javascript:
      expect(html).not.toContain('javascript:');
      // The text should still be there
      expect(html).toContain('click me');
    });

    it('removes script tags', async () => {
      const markdown = 'Some text <script>alert("XSS")</script> more text';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).not.toContain('<script>');
      // rehype-sanitize removes the script tag but preserves text content
      expect(html).toContain('more text');
    });

    it('removes event handler attributes', async () => {
      const markdown =
        '<div onclick="alert(\'XSS\')">Danger zone</div> Safe text';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).not.toContain('onclick');
      expect(html).not.toContain('alert');
    });

    it('removes href="javascript:" even in HTML anchor tags', async () => {
      const markdown =
        'Before <a href="javascript:void(0)">dangerous</a> after';
      const html = await renderDocMarkdownToSafeHtml(markdown);
      expect(html).not.toContain('javascript:');
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
