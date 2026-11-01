/**
 * Renders public/og.jpg (1200×630): the share card, with live figures read
 * from the running portal. Needs `npm run dev` on :5132 and Google Chrome.
 *   node scripts/build-og.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: chrome, args: process.env.CHROME_ARGS ? [process.env.CHROME_ARGS] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(process.env.PORTAL_URL || 'http://localhost:5132/', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('.cmp-amount');
const f = await page.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent?.trim() ?? '';
  const widths = [...document.querySelectorAll('.cmp-track')].map((tr) => [...tr.querySelectorAll('.seg')].map((s) => parseFloat(s.style.width) || 0));
  const amounts = [...document.querySelectorAll('.cmp-amount')].map((e) => e.textContent.trim());
  return { n: t('.kpi-value'), nep: amounts[0], house: amounts[1], widths, hoN: document.querySelectorAll('.kpi-value')[3]?.textContent.trim(), hoPhp: t('.kpi-pop .kpi-sub').split(' ')[0] };
});
const cfg = (await import(resolve(root, 'portal.config.ts'))).default;
let html = readFileSync(resolve(root, 'scripts/og/card.html'), 'utf8');
const fill = {
  PHOTO: `file://${resolve(root, 'src/assets/taal-dusk.webp')}`,
  CITY: cfg.name, SHORT: cfg.shortName ?? cfg.name, N: f.n, NEP: f.nep, HOUSE: f.house,
  NEP_BOTH: f.widths[0]?.[0] ?? 0, NEP_ONLY: f.widths[0]?.[1] ?? 0,
  H_BOTH: f.widths[1]?.[0] ?? 0, H_ONLY: f.widths[1]?.[1] ?? 0,
  HO_N: f.hoN, HO_PHP: f.hoPhp,
};
for (const [k, v] of Object.entries(fill)) html = html.replaceAll(`{{${k}}}`, String(v));
const tmp = resolve(root, 'scripts/og/.card.render.html');
writeFileSync(tmp, html);
const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await card.goto(`file://${tmp}`, { waitUntil: 'networkidle' });
await card.waitForTimeout(500);
await card.screenshot({ path: resolve(root, 'public/og.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
console.log('Wrote public/og.jpg', f);
