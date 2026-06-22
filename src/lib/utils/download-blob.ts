/**
 * Browser file-download helpers.
 *
 * The generated API client returns binary/text payloads as `Blob`s. To save one
 * to disk we create a temporary object URL, click a synthetic anchor, then
 * revoke the URL on the next tick so the download has a chance to start.
 *
 * These helpers are browser-only (they touch `document`/`URL`); guard callers
 * accordingly or only invoke them from event handlers in client components.
 */

/**
 * Trigger a browser "save as" download for the given Blob.
 *
 * @param blob - The file contents to download.
 * @param filename - The suggested filename (including extension).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    // Append to the DOM so the click is dispatched reliably in all browsers.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke after a tick so the navigation/download has been initiated.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Turn an arbitrary string into a filesystem-friendly slug.
 *
 * Lowercases, strips characters that are awkward in filenames, and collapses
 * runs of separators into a single hyphen. Falls back to `fallback` when the
 * input slugs down to an empty string.
 *
 * @param value - The source string (e.g. an event title).
 * @param fallback - Used when `value` produces an empty slug. Defaults to `'download'`.
 */
export function slugifyFilename(value: string, fallback = 'download'): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
  return slug || fallback;
}
