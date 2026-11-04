import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { sendServerError } from '../src/server/local-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pawnfall clean source '));
let child;
let output = '';

try {
  for (const name of ['src', 'scripts', 'public', 'drizzle', 'package.json']) {
    fs.cpSync(path.join(root, name), path.join(fixture, name), {
      recursive: true,
      filter: (file) => file !== path.join(root, 'public', 'game.js'),
    });
  }
  assert.equal(fs.existsSync(path.join(fixture, 'public', 'game.js')), false);

  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  child = spawn(process.execPath, ['scripts/dev.mjs'], {
    cwd: fixture,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 15000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}: ${output}`));
    });
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (data) => {
        output += data;
        if (output.includes('Pawnfall: http://localhost:')) {
          clearTimeout(timer);
          resolve();
        }
      });
    }
  });

  const url = `http://127.0.0.1:${port}`;
  assert.equal(fs.existsSync(path.join(fixture, 'public', 'game.js')), true);
  assert.equal((await fetch(url)).status, 200);
  const bundle = await fetch(`${url}/game.js`);
  assert.equal(bundle.status, 200);
  assert.match(await bundle.text(), /Pawnfall browser bundle/);
  const head = await fetch(`${url}/game.js`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');

  fs.unlinkSync(path.join(fixture, 'public', 'style.css'));
  const missing = await fetch(`${url}/style.css`);
  assert.equal(missing.status, 500);
  assert.match(await missing.text(), /Run npm run build/);
  assert.equal((await fetch(url)).status, 200, 'A missing asset must not stop the server');
  assert.doesNotMatch(output, /ERR_HTTP_HEADERS_SENT/);

  let destroyed = false;
  sendServerError(
    {
      headersSent: true,
      destroy() {
        destroyed = true;
      },
      writeHead() {
        assert.fail('Headers must never be sent twice');
      },
    },
    new Error('Request failed after headers'),
  );
  assert.equal(destroyed, true);
  sendServerError({ writableEnded: true }, new Error('Already finished'));
  console.log('Clean-source startup and missing-asset recovery passed.');
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
  fs.rmSync(fixture, { recursive: true, force: true });
}
