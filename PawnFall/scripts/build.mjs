import fs from 'node:fs';
import { validateAssets } from './validate-assets.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function bundle(entry) {
  const modules = new Map();

  function add(filename) {
    const file = path.resolve(root, filename);
    if (modules.has(file)) return modules.get(file).id;
    const record = { id: modules.size, code: '' };
    modules.set(file, record);
    let code = fs.readFileSync(file, 'utf8'),
      exports = [];
    code = code.replace(
      /^import\s+([\s\S]+?)\s+from\s+['"](.+?)['"];?\s*$/gm,
      (_, binding, dep) => {
        if (!dep.startsWith('.')) throw Error('Only local dependencies are allowed: ' + dep);
        const id = add(path.resolve(path.dirname(file), dep));
        if (binding.startsWith('* as ')) return `const ${binding.slice(5)}=__require(${id});`;
        const names = binding.replace(/\s+as\s+/g, ':');
        return `const ${names}=__require(${id});`;
      },
    );
    code = code.replace(/export\s*\{([^}]+)\};\s*$/g, (_, list) => {
      for (const item of list.split(',')) {
        let m = item.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        if (m) exports.push(m[2] ? `${m[2]}:${m[1]}` : m[1]);
        else if (item.trim()) throw Error('Unsupported export');
      }
      return '';
    });
    code = code.replace(
      /\bexport\s+(async\s+)?(const|let|class|function)\s+(\w+)/g,
      (_, async, kind, name) => {
        exports.push(name);
        return `${async || ''}${kind} ${name}`;
      },
    );
    record.code = code + `\nreturn {${exports.join(',')}};`;
    return record.id;
  }
  const id = add(entry);
  return `const __modules={${[...modules.values()].map((m) => `${m.id}:function(__require){\n${m.code}\n}`).join(',\n')}};const __cache={};function __require(id){if(!__cache[id])__cache[id]=__modules[id](__require);return __cache[id]}\n__require(${id});`;
}
validateAssets(
  fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'),
  fs.readFileSync(path.join(root, 'public/style.css'), 'utf8'),
);
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.mkdirSync(path.join(root, 'dist/server'), { recursive: true });
const browser = `/* Pawnfall browser bundle */\n(()=>{'use strict';\n${bundle('src/client/main.mjs')}\n})();`;
new Function(browser);
fs.writeFileSync(path.join(root, 'public/game.js'), browser);
const assets = {};
for (const [url, file, type] of [
  ['/', 'index.html', 'text/html; charset=utf-8'],
  ['/index.html', 'index.html', 'text/html; charset=utf-8'],
  ['/style.css', 'style.css', 'text/css; charset=utf-8'],
  ['/game.js', 'game.js', 'text/javascript; charset=utf-8'],
  ['/vendor/THREE-LICENSE.txt', 'vendor/THREE-LICENSE.txt', 'text/plain; charset=utf-8'],
])
  assets[url] = { body: fs.readFileSync(path.join(root, 'public', file), 'utf8'), type };
let server = bundle('src/server/api.mjs');
const match = server.match(/__require\((\d+)\);$/);
server = server.replace(/__require\(\d+\);$/, '');
const worker = `${server}\nconst {api}=__require(${match[1]});const assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/')){if(request.method==='POST'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403});return api(request,env)}const asset=assets[url.pathname];if(!asset)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':url.pathname==='/game.js'?'public,max-age=0,must-revalidate':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}})}};`;
fs.writeFileSync(path.join(root, 'dist/server/index.js'), worker);
console.log(`Built browser (${browser.length} bytes) and Worker (${worker.length} bytes).`);
