import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function ensureBrowserBuild(root) {
  if (fs.existsSync(path.join(root, 'public', 'game.js'))) return;

  console.log('Building the browser game before starting the server…');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'build.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    throw new Error('The browser build failed. Run npm run build to see the build error.', {
      cause: result.error,
    });
  }
}

export function serveLocalAsset(req, res, root, asset) {
  const content = fs.readFileSync(path.join(root, 'public', asset[0]));

  res.writeHead(200, {
    'Content-Type': asset[1] + '; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}

export function sendServerError(res, error) {
  if (res.destroyed || res.writableEnded) return;

  if (res.headersSent) {
    res.destroy();
    return;
  }

  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(
    error.code === 'ENOENT'
      ? 'A game file is missing. Run npm run build, then restart the server.'
      : 'Development server error. Check the terminal for details.',
  );
}
