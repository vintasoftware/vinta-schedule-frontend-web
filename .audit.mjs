import { chromium } from '@playwright/test';
const base = process.argv[2];
const idx = await (await fetch(`${base}/index.json`)).json();
const entries = Object.values(idx.entries);
const b = await chromium.launch();
const page = await b.newPage();
const problems = [];
for (const e of entries) {
  const errs = [];
  page.removeAllListeners('pageerror'); page.removeAllListeners('console');
  page.on('pageerror', x => errs.push('CRASH: ' + x.message.split('\n')[0].slice(0,150)));
  page.on('console', m => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text().split('\n')[0];
    if (/Illegal invocation|Warning:|Received |non-boolean|Failed|Cannot |is not a|unique "key"|validateDOMNesting|Addon controls|in a <|cannot appear/i.test(t)) errs.push(t.slice(0,150));
  });
  const isDocs = e.type === 'docs';
  await page.goto(`${base}/iframe.html?viewMode=${isDocs?'docs':'story'}&id=${e.id}`, {waitUntil:'networkidle'}).catch(()=>{});
  await page.waitForTimeout(600);
  const r = await page.evaluate((isDocs) => {
    const root = document.querySelector(isDocs ? '#storybook-docs' : '#storybook-root');
    const disp = document.querySelector('#error-message');
    const shown = disp && disp.offsetParent !== null ? disp.textContent.slice(0,140) : '';
    return { nodes: root ? root.querySelectorAll('*').length : -1, shown };
  }, isDocs);
  const uniq = [...new Set(errs)];
  if (r.nodes < 2 || uniq.length || r.shown) problems.push({ id: e.id, type: e.type, ...r, errs: uniq.slice(0,2) });
}
console.log(`checked ${entries.length}; ${problems.length} with issues\n`);
for (const p of problems) console.log(`${p.nodes < 2 ? 'BLANK' : 'WARN '} ${p.id} [${p.type}] nodes=${p.nodes}${p.shown?' ERRDISPLAY:'+p.shown:''}\n${p.errs.map(e=>'       '+e).join('\n')}`);
await b.close();
