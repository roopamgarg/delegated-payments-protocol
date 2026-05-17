/**
 * Capture docs/sandbox-console.png from a running harness.
 * Prereq: npm install playwright && npx playwright install chromium
 * Usage: PORT=3340 node server.mjs & node scripts/capture-sandbox-screenshot.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const port = process.env.PORT ?? '3340';
const base = `http://127.0.0.1:${port}/sandbox/`;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sandbox-console.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`Wrote ${out}`);
