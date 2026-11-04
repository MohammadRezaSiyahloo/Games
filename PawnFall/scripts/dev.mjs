// Local HTTP server with SQLite storage and a live LAN simulation.
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { api } from '../src/server/api.mjs';
import { LanRealtime } from '../src/server/lan-realtime.mjs';
import {
  ensureBrowserBuild,
  serveLocalAsset,
  sendServerError,
} from '../src/server/local-assets.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
ensureBrowserBuild(root);

const dataDir = process.env.PAWNFALL_DATA_DIR || path.join(root, 'outputs');
fs.mkdirSync(dataDir, { recursive: true });
const sqlite = new DatabaseSync(path.join(dataDir, 'local.sqlite'));
sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for (const file of fs
  .readdirSync(path.join(root, 'drizzle'))
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  if (sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(file)) continue;
  sqlite.exec(fs.readFileSync(path.join(root, 'drizzle', file), 'utf8'));
  sqlite.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(file);
}
const DB = {
  prepare(sql) {
    return {
      bind(...args) {
        const stmt = sqlite.prepare(sql);
        return {
          async first() {
            return stmt.get(...args) || null;
          },
          async run() {
            const r = stmt.run(...args);
            return { meta: { changes: Number(r.changes) } };
          },
        };
      },
    };
  },
};
const realtime = new LanRealtime(sqlite);
process.once('SIGTERM', () => {
  realtime.close();
  process.exit(0);
});
process.once('SIGINT', () => {
  realtime.close();
  process.exit(0);
});
const assets = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/game.js': ['game.js', 'text/javascript'],
  '/style.css': ['style.css', 'text/css'],
  '/vendor/THREE-LICENSE.txt': ['vendor/THREE-LICENSE.txt', 'text/plain'],
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const chunks = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > 16000) {
            res.writeHead(413);
            res.end();
            return;
          }
          chunks.push(c);
        }
        const bytes = Buffer.concat(chunks);
        if (url.pathname === '/api/room' || url.pathname === '/api/stream') {
          const data = bytes.length ? JSON.parse(bytes.toString('utf8')) : {};
          if (url.pathname === '/api/stream') {
            if (realtime.stream(req.headers['x-game-token'], data, res)) return;
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Stream not ready.' }));
            return;
          }
          const result = realtime.input(req.headers['x-game-token'], data);
          if (result) {
            res.writeHead(result.status, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            });
            res.end(JSON.stringify(result.body));
            return;
          }
        }
        const request = new Request('http://localhost' + req.url, {
          method: req.method,
          headers: req.headers,
          ...(req.method === 'POST' ? { body: bytes } : {}),
        });
        const response = await api(request, { DB });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
        return;
      }
      const asset = assets[url.pathname];
      if (!asset) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      serveLocalAsset(req, res, root, asset);
    } catch (e) {
      console.error(e);
      sendServerError(res, e);
    }
  })
  .listen(Number(process.env.PORT) || 8000, process.env.HOST || '0.0.0.0', () => {
    const port = Number(process.env.PORT) || 8000;
    console.log('Pawnfall: http://localhost:' + port);
    if (!process.env.HOST || process.env.HOST === '0.0.0.0') {
      console.log('Listening on all network interfaces (0.0.0.0).');
      try {
        for (const entries of Object.values(networkInterfaces()))
          for (const address of entries || [])
            if (address.family === 'IPv4' && !address.internal)
              console.log('LAN: http://' + address.address + ':' + port);
      } catch {
        console.log(
          'LAN: use http://<your-computer-IPv4>:' + port + ' (find it with ipconfig on Windows).',
        );
      }
    }
    console.log('Keep this terminal open while playing.');
  });
