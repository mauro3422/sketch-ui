import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, access } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const projectRoot = resolve(__dirname, '..');

const defaultFile = 'index.html';
const port = Number(process.env.PORT || process.argv[2] || 4173);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function getContentType(filePath) {
  const type = mimeTypes[extname(filePath).toLowerCase()];
  return type || 'application/octet-stream';
}

async function fileExists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch (err) {
    return false;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') {
      pathname = defaultFile;
    } else {
      pathname = pathname.replace(/^\/+/, '');
    }

    let filePath = join(projectRoot, pathname);

    if (!await fileExists(filePath)) {
      filePath = join(projectRoot, pathname, defaultFile);
    }

    let stats = await stat(filePath);

    if (stats.isDirectory()) {
      filePath = join(filePath, defaultFile);
      stats = await stat(filePath);
    }

    const stream = createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    stream.pipe(res);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`static-server listening on http://127.0.0.1:${port}`);
});

const close = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', close);
process.on('SIGTERM', close);
