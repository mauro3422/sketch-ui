import { chromium } from 'playwright';
import path from 'path';
import { pathToFileURL } from 'url';

const baseDir = path.resolve('.');
const fileUrl = pathToFileURL(path.join(baseDir, 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    const location = msg.location();
    console.log(`[console.${msg.type()}] ${msg.text()} (${location.url}:${location.lineNumber})`);
  });

  page.on('pageerror', err => {
    console.error('[pageerror]', err.message);
    console.error(err.stack);
  });

  await page.goto(fileUrl);
  // small interactions to ensure canvas scripts run
  await page.waitForTimeout(2000);
  await browser.close();
})().catch(err => {
  console.error('playwright-runner-error', err);
  process.exit(1);
});
