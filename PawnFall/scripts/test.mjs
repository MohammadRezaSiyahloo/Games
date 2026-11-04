import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs
  .readdirSync(path.join(root, 'tests'))
  .filter((name) => name.endsWith('.mjs'))
  .sort();

for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(root, 'tests', file)], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Failed: ${file}`);
    process.exit(result.status || 1);
  }
}

console.log(`Passed ${files.length} test programs.`);
