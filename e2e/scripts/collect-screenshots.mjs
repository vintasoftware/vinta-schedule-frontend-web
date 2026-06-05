#!/usr/bin/env node
/**
 * collect-screenshots.mjs
 *
 * Post-run helper: copies every PNG from `test-results/` (Playwright's output
 * directory) into the gitignored `pr-screenshots/` directory at the repo root.
 *
 * Why: `test-results/` is ephemeral and gitignored; `pr-screenshots/` is the
 * durable landing zone for review screenshots that CI can upload as artifacts
 * or that a local reviewer can inspect after a run.
 *
 * Usage (after `npx playwright test`):
 *   node e2e/scripts/collect-screenshots.mjs
 *
 * Or add to package.json scripts:
 *   "test:e2e": "playwright test && node e2e/scripts/collect-screenshots.mjs"
 */

import { readdir, copyFile, mkdir, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SOURCE_DIR = join(REPO_ROOT, 'test-results');
const DEST_DIR = join(REPO_ROOT, 'pr-screenshots');

/**
 * Recursively find all `.png` files under `dir`.
 *
 * @param {string} dir
 * @returns {Promise<string[]>} Absolute paths to PNG files.
 */
async function findPngs(dir) {
  /** @type {string[]} */
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Source directory doesn't exist (no tests ran or all passed without
    // screenshots) — return empty array silently.
    return results;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findPngs(full)));
    } else if (entry.isFile() && entry.name.endsWith('.png')) {
      results.push(full);
    }
  }
  return results;
}

async function run() {
  // Ensure the destination directory exists.
  await mkdir(DEST_DIR, { recursive: true });

  const pngs = await findPngs(SOURCE_DIR);

  if (pngs.length === 0) {
    console.log('[collect-screenshots] No PNG files found in test-results/.');
    return;
  }

  let copied = 0;
  let skipped = 0;

  for (const src of pngs) {
    const name = basename(src);
    const dest = join(DEST_DIR, name);

    // Skip if the destination already has an identical-named file with a
    // newer or equal mtime (avoid redundant copies on re-run).
    try {
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest)]);
      if (destStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        continue;
      }
    } catch {
      // Destination doesn't exist yet — proceed with copy.
    }

    await copyFile(src, dest);
    console.log(`[collect-screenshots] Copied ${name}`);
    copied++;
  }

  console.log(
    `[collect-screenshots] Done — ${copied} copied, ${skipped} skipped. ` +
      `Output: pr-screenshots/`
  );
}

run().catch((err) => {
  console.error('[collect-screenshots] Error:', err);
  process.exit(1);
});
