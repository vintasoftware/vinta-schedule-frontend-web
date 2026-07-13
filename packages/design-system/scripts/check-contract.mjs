/**
 * Local proxy for the composer's contract gate.
 *
 * The real gate is `extractPackageContract()` from ds-loader, which is private
 * and will never be published — so this script mirrors its rules (extract.ts /
 * bundle.ts line refs inline below) using the same mechanics the platform uses:
 *
 * To run the REAL gate instead, `npm pack` this package and feed the .tgz path
 * to extractPackageContract() — install.ts:47-59 accepts an absolute tarball
 * path, so no registry publish is needed for local iteration.
 *
 *   1. Bundle each story with plain esbuild, React (and prototype-mode) marked
 *      external and NO Storybook runtime installed. This is the check that
 *      catches value imports from `storybook/test` and other runtime deps.
 *   2. Actually evaluate the bundled module and inspect the real `meta` object
 *      (not a regex): argTypes, controls, slots, title/export alignment.
 *
 * Stories still importing from `@storybook/*` are reported as NOT YET CONVERTED
 * rather than failures, so this doubles as a migration progress meter.
 *
 * Run: pnpm --filter vinta-schedule-design-system check:contract
 */
import { build } from 'esbuild';
import { readdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Controls the extractor accepts, mirroring ds-loader extract.ts:202-239.
 * Anything else is UNSUPPORTED_CONTROL. Note `color`/`date` map lossily to
 * text, `range` to number, and `multi-select` collapses to a single-value
 * select — all accepted, just lossy.
 */
const SUPPORTED_CONTROLS = new Set([
  'text',
  'string',
  'textarea',
  'color',
  'date',
  'number',
  'range',
  'boolean',
  'bool',
  'select',
  'multi-select',
  'radio',
  'inline-radio',
  'object',
  'array',
]);

/** Controls needing `options` to produce a usable field. */
const NEEDS_OPTIONS = new Set([
  'select',
  'multi-select',
  'radio',
  'inline-radio',
]);

/** Never editable — §6. */
const FORBIDDEN_ARGTYPES = new Set(['className', 'style']);

/**
 * Externals, mirroring bundle.ts:45-60 — the 5 React specifiers plus the
 * platform-owned prototype-mode module. Everything else is inlined.
 */
const EXTERNALS = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'vinta-ui-composer-prototype-mode',
];

/** Resolve prototype-mode's COMPILED entry (its exports map points at .tsx). */
const PROTOTYPE_MODE_DIST = await (async () => {
  try {
    const src = import.meta.resolve('vinta-ui-composer-prototype-mode');
    const dist = src.replace(/\/src\/index\.tsx$/, '/dist/index.js');
    return dist === src ? null : fileURLToPath(dist);
  } catch {
    return null;
  }
})();

/**
 * Extract a component's cva variant groups → their keys, e.g.
 *   { variant: ['default','destructive','warning','success'], size: [...] }
 * Returns {} when the file has no cva block. Brace-depth scan rather than a
 * regex, so nested option objects don't confuse it.
 */
async function readCvaVariants(componentFile) {
  let src;
  try {
    src = await readFile(componentFile, 'utf8');
  } catch {
    return {};
  }
  const start = src.indexOf('variants: {');
  if (start === -1) return {};

  // Walk from the opening brace of `variants: {` to its matching close.
  let i = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  if (end === -1) return {};
  const body = src.slice(i + 1, end);

  // Top-level keys of `variants` are the groups; their own top-level keys are
  // the options.
  const groups = {};
  depth = 0;
  let groupName = null;
  let groupStart = 0;
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    if (ch === '{') {
      if (depth === 0) {
        const before = body.slice(0, j);
        const m = before.match(/([A-Za-z0-9_$]+)\s*:\s*$/);
        groupName = m ? m[1] : null;
        groupStart = j + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && groupName) {
        const inner = body.slice(groupStart, j);
        // option keys at this level only
        const keys = [];
        let d = 0;
        for (const line of inner.split('\n')) {
          const trimmed = line.trim();
          if (d === 0) {
            const km = trimmed.match(/^['"]?([A-Za-z0-9_$-]+)['"]?\s*:/);
            if (km) keys.push(km[1]);
          }
          d += (line.match(/\{/g) || []).length;
          d -= (line.match(/\}/g) || []).length;
        }
        if (keys.length) groups[groupName] = keys;
        groupName = null;
      }
    }
  }
  return groups;
}

async function findStories(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findStories(full)));
    else if (entry.name.endsWith('.stories.tsx')) out.push(full);
  }
  return out;
}

/**
 * A slot entry is either a bare name (unrestricted) or `{ name, allow[] }`.
 * Returns the slot NAMES; pushes a hard error for any malformed entry.
 *
 * Malformed `allow` is worse than an error here: the platform IGNORES it and
 * quietly serves an unrestricted slot, so a typo'd restriction looks like it
 * works while offering the user the very components it was meant to forbid.
 */
function slotNames(slots, rel, errors) {
  if (!Array.isArray(slots)) return [];
  const names = [];
  for (const entry of slots) {
    if (typeof entry === 'string') {
      names.push(entry);
      continue;
    }
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') {
      errors.push(
        `${rel}: slot entry ${JSON.stringify(entry)} is neither a string nor { name, allow } — the platform would ignore it`
      );
      continue;
    }
    names.push(entry.name);

    if (entry.allow === undefined) continue; // unrestricted by design
    if (!Array.isArray(entry.allow) || entry.allow.length === 0) {
      errors.push(
        `${rel}: slot '${entry.name}' has a malformed allow (${JSON.stringify(entry.allow)}) — the platform would silently drop the restriction`
      );
      continue;
    }
    for (const a of entry.allow) {
      if (typeof a !== 'string' || !a) {
        errors.push(
          `${rel}: slot '${entry.name}' allow entry ${JSON.stringify(a)} is not a component name`
        );
      }
    }
  }
  return names;
}

const errors = [];
const converted = [];
const legacy = [];

/** Every contract component name (the leaf of meta.title) seen this run. */
const contractNames = new Set();
/** allow-list references, checked against contractNames once all are known. */
const allowRefs = [];

const stories = (await findStories(join(ROOT, 'src'))).sort();
// Emit inside the package: the bundles keep `react` external, so Node must be
// able to resolve it from the package's own node_modules (pnpm isolates them,
// so a /tmp scratch dir would fail to resolve).
const tmp = await mkdtemp(join(ROOT, 'node_modules', '.ds-contract-'));

for (const file of stories) {
  const rel = file.slice(ROOT.length + 1);
  const source = await readFile(file, 'utf8');

  // Not yet converted — still on the Storybook types. Skip, don't fail.
  if (
    /from\s+['"]@storybook\//.test(source) ||
    /from\s+['"]storybook\//.test(source)
  ) {
    legacy.push(rel);
    continue;
  }
  converted.push(rel);

  // 1. Bundle exactly like the platform: plain esbuild, React external.
  const outfile = join(tmp, basename(file).replace(/\.tsx$/, '.mjs'));
  try {
    await build({
      entryPoints: [file],
      outfile,
      bundle: true,
      // Mirrors ds-loader bundle.ts:91 — platform 'browser', esm, automatic
      // jsx, es2022, and NO explicit `conditions` override (esbuild's
      // browser-platform defaults apply). Browser conditions are what make
      // lucide-react resolve to its ESM build; under platform:'node' it would
      // resolve to dist/cjs and its `require("react")` would become a
      // __require shim that throws once react is external.
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      jsx: 'automatic',
      external: EXTERNALS,
      logLevel: 'silent',
    });
  } catch (e) {
    errors.push(
      `${rel}: does not bundle under plain esbuild → ${e.message.split('\n')[0]}`
    );
    continue;
  }

  // 2. Evaluate the bundle and read the REAL meta object.
  //
  // prototype-mode stays EXTERNAL above (correct — the platform shims it to the
  // host's copy). But its published `exports` map points at raw `src/index.tsx`,
  // which Node cannot import. It also ships a compiled `dist/index.js`, so we
  // repoint the external specifier at that for evaluation — the same "shim to a
  // compiled copy" the host performs. Remove once prototype-mode's exports map
  // points at dist.
  if (PROTOTYPE_MODE_DIST) {
    const bundled = await readFile(outfile, 'utf8');
    await writeFile(
      outfile,
      bundled.replaceAll(
        '"vinta-ui-composer-prototype-mode"',
        JSON.stringify(PROTOTYPE_MODE_DIST)
      )
    );
  }

  let meta;
  try {
    meta = (await import(pathToFileURL(outfile).href)).default;
  } catch (e) {
    errors.push(
      `${rel}: bundle fails to evaluate → ${e.message.split('\n')[0]}`
    );
    continue;
  }

  if (!meta || typeof meta !== 'object') {
    errors.push(`${rel}: no default-exported meta`);
    continue;
  }

  const argTypes = meta.argTypes ?? {};
  const rawSlots = meta.parameters?.puck?.slots ?? [];
  const slots = slotNames(rawSlots, rel, errors);
  const names = Object.keys(argTypes);

  if (meta.title) contractNames.add(meta.title.split('/').pop().trim());
  for (const entry of rawSlots) {
    if (entry && typeof entry === 'object' && Array.isArray(entry.allow)) {
      for (const a of entry.allow) {
        if (typeof a === 'string' && a)
          allowRefs.push({ rel, slot: entry.name, name: a });
      }
    }
  }

  // STALENESS — the contract can be well-formed but WRONG. When a component's
  // cva gains a variant (Alert's `warning`/`success`, Button's `fullWidth`) the
  // story's `options` list silently keeps advertising the old set, so the new
  // variant is invisible to the composer. Cross-check the sibling component's
  // cva variant keys against the story's curated options.
  const componentFile = file.replace(/\.stories\.tsx$/, '.tsx');
  const cvaVariants = await readCvaVariants(componentFile);
  for (const [group, keys] of Object.entries(cvaVariants)) {
    const declared = argTypes[group]?.options;
    if (!Array.isArray(declared)) continue; // not curated as an enum — fine
    const missing = keys.filter((k) => !declared.map(String).includes(k));
    if (missing.length) {
      errors.push(
        `${rel}: argTypes.${group}.options is STALE — component defines ${missing.map((m) => `'${m}'`).join(', ')} but the story does not offer it`
      );
    }
    const bogus = declared
      .map(String)
      .filter((d) => !keys.includes(d) && d !== 'true' && d !== 'false');
    if (bogus.length) {
      errors.push(
        `${rel}: argTypes.${group}.options offers ${bogus.map((b) => `'${b}'`).join(', ')}, which the component's cva does not define`
      );
    }
  }

  // §1 — extract.ts:271-276. The emptiness check counts argTypes KEYS and runs
  // BEFORE slots are read (extractSlots is not called until :288). So slots do
  // NOT satisfy it: every component needs >= 1 argTypes key, period.
  if (names.length === 0) {
    errors.push(
      `${rel}: zero argTypes keys → AUTO_INFERRED_ARGTYPES_ONLY (slots do not satisfy this)`
    );
  }

  // extract.ts:290 — an argTypes key that is also a slot name is a hard error.
  for (const n of names) {
    if (slots.includes(n)) {
      errors.push(
        `${rel}: '${n}' is both an argType and a slot → SLOT_ARGTYPE_COLLISION`
      );
    }
  }

  // §6 — className/style must never be editable.
  for (const n of names) {
    if (FORBIDDEN_ARGTYPES.has(n))
      errors.push(`${rel}: argTypes.${n} must not be exposed (§6)`);
  }

  for (const [n, cfg] of Object.entries(argTypes)) {
    // extract.ts:282-284 — `control: false` / `{ disable: true }` still counts
    // toward the emptiness check but is dropped from editable fields. Legal.
    const disabled = cfg?.control === false || cfg?.control?.disable === true;
    if (disabled) continue;

    const control =
      typeof cfg?.control === 'string' ? cfg.control : cfg?.control?.type;

    // No control but options present → select (curated shorthand).
    if (!control) {
      if (!Array.isArray(cfg?.options)) {
        errors.push(
          `${rel}: argTypes.${n} has neither a control nor options[]`
        );
      }
      continue;
    }
    if (!SUPPORTED_CONTROLS.has(control)) {
      errors.push(
        `${rel}: argTypes.${n} control '${control}' is UNSUPPORTED_CONTROL`
      );
    } else if (NEEDS_OPTIONS.has(control) && !Array.isArray(cfg?.options)) {
      errors.push(
        `${rel}: argTypes.${n} control '${control}' requires options[]`
      );
    }
  }

  // §7 — resolved name is the LEAF of meta.title, looked up as a NAMED export.
  // Default exports are unresolvable (export * barreling drops them).
  if (!meta.title) {
    errors.push(`${rel}: meta.title is required (component name is its leaf)`);
  } else {
    const leaf = meta.title.split('/').pop().trim();

    // Collect named-import bindings, tolerating multi-line `import { … }` lists.
    const bound = new Set();
    for (const m of source.matchAll(
      /import\s*(?:type\s*)?\{([\s\S]*?)\}\s*from/g
    )) {
      for (const part of m[1].split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          .trim();
        if (name) bound.add(name);
      }
    }
    // …or defined locally in the story file.
    for (const m of source.matchAll(
      /(?:function|const|class)\s+([A-Za-z0-9_$]+)/g
    )) {
      bound.add(m[1]);
    }
    if (!bound.has(leaf)) {
      errors.push(
        `${rel}: title leaf '${leaf}' is not a named export in scope (§7)`
      );
    }
    if (/import\s+[A-Za-z0-9_$]+\s+from/.test(source)) {
      errors.push(
        `${rel}: default import detected — default exports are unresolvable (§7)`
      );
    }

    // forwardRef components expose displayName; plain functions expose .name.
    const actual = meta.component?.displayName ?? meta.component?.name;
    if (actual && actual !== leaf) {
      errors.push(`${rel}: title leaf '${leaf}' != component '${actual}' (§7)`);
    }
  }
}

// Every allow entry must name a real contract component. The platform resolves
// these to render functions BY NAME and silently drops the ones it cannot find,
// so a typo ('AccordionItems') yields a slot that offers nothing, with no error
// anywhere. Deferred to here because it needs every story's title first.
for (const { rel, slot, name } of allowRefs) {
  if (!contractNames.has(name)) {
    const near = [...contractNames]
      .filter((c) => c.toLowerCase().startsWith(name.slice(0, 4).toLowerCase()))
      .slice(0, 3);
    errors.push(
      `${rel}: slot '${slot}' allows '${name}', which is not a contract component name` +
        (near.length
          ? ` — did you mean ${near.map((n) => `'${n}'`).join(' / ')}?`
          : '')
    );
  }
}

await rm(tmp, { recursive: true, force: true });

console.log(
  `\nContract proxy check — ${converted.length} converted, ${legacy.length} not yet converted\n`
);
for (const f of converted) console.log(`  ✓ bundled+evaluated  ${f}`);
if (legacy.length) {
  console.log(
    `\n  ${legacy.length} still on Storybook types (not yet Puck-ready):`
  );
  for (const f of legacy.slice(0, 5)) console.log(`    · ${f}`);
  if (legacy.length > 5) console.log(`    · … and ${legacy.length - 5} more`);
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} contract violation(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}
console.log('\n✓ No contract violations in converted stories.\n');
