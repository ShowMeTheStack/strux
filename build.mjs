// Build: inline the CSS and all the JavaScript (in manifest order) into one self-contained index.html.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');
const manifest = JSON.parse(src('manifest.json'));
let version = '0.1.0';
try { version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version; } catch (e) { /* none yet */ }
// "dir/x-*.js" and "dir/*.js" pull in matching files of a folder in name order; missing files are skipped
const expand = (list) => list.flatMap((f) => {
  if (f.includes('*')) {
    const d = f.slice(0, f.lastIndexOf('/'));
    const re = new RegExp('^' + f.slice(f.lastIndexOf('/') + 1).replace(/\./g, '\\.').replace('*', '.*') + '$');
    return existsSync(join(root, 'src', d)) ? readdirSync(join(root, 'src', d)).filter((x) => re.test(x) && !list.includes(d + '/' + x)).sort().map((x) => d + '/' + x) : [];
  }
  return existsSync(join(root, 'src', f)) ? [f] : [];
});
const files = [...new Set([...expand(manifest.core), ...expand(manifest.stage), ...expand(manifest.topics), ...expand(manifest.app)])];
const js = files.map((f) => `// ==== ${f} ====\n${src(f)}`).join('\n').replace(/<\/script/gi, '<\\/script');
const css = expand(manifest.css).map((f) => src(f)).join('\n');
let html = src('shell.html');
html = html.replace('/*@@CSS@@*/', () => css);
html = html.replace('//@@JS@@', () => js);
if (existsSync(join(root, 'assets', 'author.png'))) html = html.replace(/@@AUTHOR_PNG@@/g, () => readFileSync(join(root, 'assets', 'author.png')).toString('base64'));
html = html.replace(/@@VERSION@@/g, version);
writeFileSync(join(root, 'index.html'), html);
console.log(`index.html: ${(html.length / 1024).toFixed(1)} KB`);
