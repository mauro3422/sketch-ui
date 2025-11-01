import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const root = path.resolve('.');

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  let filePath = path.join(root, urlPath === '/' ? '/index.html' : urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html'
      : ext === '.js' ? 'text/javascript'
      : ext === '.css' ? 'text/css'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const PORT = 4173;

server.listen(PORT, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => {
    const loc = msg.location();
    console.log(`[console.${msg.type()}] ${msg.text()} (${loc.url}:${loc.lineNumber})`);
  });
  page.on('pageerror', err => {
    console.error('[pageerror]', err.message);
  });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await page.waitForTimeout(2000);
  } finally {
    await browser.close();
    server.close();
  }
});
