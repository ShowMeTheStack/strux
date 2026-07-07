// Load the engine and the topics into this Node process (the same files the page uses, in order).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function files() {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'));
  const expand = (list) => list.flatMap((f) => {
    if (f.includes('*')) {
      const d = f.slice(0, f.lastIndexOf('/'));
      const re = new RegExp('^' + f.slice(f.lastIndexOf('/') + 1).replace(/\./g, '\\.').replace('*', '.*') + '$');
      const dir = path.join(root, 'src', d);
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => re.test(x) && !list.includes(d + '/' + x)).sort().map((x) => d + '/' + x) : [];
    }
    return fs.existsSync(path.join(root, 'src', f)) ? [f] : [];
  });
  return [...new Set([...expand(m.core), ...expand(m.stage), ...expand(m.topics), 'app/highlight.js'])];
}
export function load() {
  for (const f of files()) {
    try { vm.runInThisContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), { filename: f }); }
    catch (e) { if (!f.startsWith('topics/') && !/kit-/.test(f)) throw e; console.log('LOAD FAIL ' + f + ': ' + String(e.stack).split('\n').slice(0, 3).join(' ')); process.exitCode = 1; }
  }
  return globalThis.SEE;
}
