import { describe, it, expect } from 'vitest';
import { renderMarkdownToSafeHtml } from './render-markdown';

describe('renderMarkdownToSafeHtml', () => {
  it('renders a heading', async () => {
    const html = await renderMarkdownToSafeHtml('# Privacy Policy');
    expect(html).toContain('<h1>Privacy Policy</h1>');
  });

  it('renders a link with href preserved', async () => {
    const html = await renderMarkdownToSafeHtml(
      '[Terms of Use](https://example.com/terms)'
    );
    expect(html).toContain('<a href="https://example.com/terms">');
    expect(html).toContain('Terms of Use</a>');
  });

  it('renders an unordered list', async () => {
    const html = await renderMarkdownToSafeHtml('- One\n- Two\n- Three');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>One</li>');
    expect(html).toContain('<li>Two</li>');
    expect(html).toContain('<li>Three</li>');
  });

  it('renders an ordered list', async () => {
    const html = await renderMarkdownToSafeHtml('1. First\n2. Second');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
    expect(html).toContain('<li>Second</li>');
  });

  it('renders a GFM table', async () => {
    const html = await renderMarkdownToSafeHtml(
      '| a | b |\n| - | - |\n| 1 | 2 |'
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<td>2</td>');
  });

  it('renders GFM strikethrough', async () => {
    const html = await renderMarkdownToSafeHtml('~~x~~');
    expect(html).toContain('<del>x</del>');
  });

  // -------------------------------------------------------------------------
  // Security-critical: sanitization proof. These assertions are strict —
  // any weakening of the schema to allow raw HTML/script/event-handler
  // payloads through is a regression that must fail this test.
  //
  // Note: the raw-HTML cases below (`<script>`, `<img onerror>`, `<a
  // href="javascript:...">` written as literal HTML, `<style>`, `<iframe>`)
  // are dropped upstream by `remark-rehype`, which defaults
  // `allowDangerousHtml` to `false` — these prove that upstream drop, not
  // `rehype-sanitize` itself. The `javascript:` markdown-image case further
  // below exercises `rehype-sanitize`'s own URL-scheme allow-list directly,
  // since markdown image/link syntax *does* reach the sanitizer.
  // -------------------------------------------------------------------------

  it('strips <script> tags entirely — no executable script element remains', async () => {
    const html = await renderMarkdownToSafeHtml(
      'Hello<script>alert("xss")</script>World'
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
  });

  it('strips inline event-handler attributes (onerror) from raw HTML img tags', async () => {
    const html = await renderMarkdownToSafeHtml(
      '<img src="x" onerror="alert(1)" />'
    );
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  it('strips javascript: URLs from links', async () => {
    const html = await renderMarkdownToSafeHtml(
      '[Click me](javascript:alert(1))'
    );
    expect(html).not.toContain('javascript:');
  });

  it('strips javascript: URLs from raw HTML anchor tags', async () => {
    const html = await renderMarkdownToSafeHtml(
      '<a href="javascript:alert(1)">Click</a>'
    );
    expect(html).not.toContain('javascript:');
  });

  it('strips <style> tags and inline event handlers on arbitrary elements', async () => {
    const html = await renderMarkdownToSafeHtml(
      '<div onclick="alert(1)"><style>body{background:red}</style>Text</div>'
    );
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<style');
  });

  it('strips <iframe> tags', async () => {
    const html = await renderMarkdownToSafeHtml(
      '<iframe src="https://evil.example.com"></iframe>'
    );
    expect(html).not.toContain('<iframe');
  });

  it('strips javascript: src from a markdown image via rehype-sanitize (not the upstream HTML drop)', async () => {
    const html = await renderMarkdownToSafeHtml('![x](javascript:alert(1))');
    expect(html).toContain('<img');
    expect(html).not.toContain('javascript:');
  });
});
