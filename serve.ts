// ARUNIKA — Island Hop Flight: local dev server.
//
// Serves game/ at http://localhost:8080 so the game can be played and
// screenshotted in a desktop browser. Standard library only; it serves
// files under game/ and nothing else.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'game');
const port = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
  const file = resolve(root, rel);
  if (!file.startsWith(root + '/') && file !== root) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`ARUNIKA dev server: http://localhost:${port}/ (serving game/)`);
});
