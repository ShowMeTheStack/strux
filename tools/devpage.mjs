// The page served as /dev.html while working: the same shell as index.html, but every source file is
// its own <script>, read fresh from src/, so a mistake in one topic file does not take the others down.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');
export function sourceFiles() {
  const manifest = JSON.parse(src('manifest.json'));
  const expand = (list) => list.flatMap((f) => {
    if (f.includes('*')) {
      const d = f.slice(0, f.lastIndexOf('/'));
      const re = new RegExp('^' + f.slice(f.lastIndexOf('/') + 1).replace(/\./g, '\\.').replace('*', '.*') + '$');
      return existsSync(join(root, 'src', d)) ? readdirSync(join(root, 'src', d)).filter((x) => re.test(x) && !list.includes(d + '/' + x)).sort().map((x) => d + '/' + x) : [];
    }
    return existsSync(join(root, 'src', f)) ? [f] : [];
  });
  return { js: [...new Set([...expand(manifest.core), ...expand(manifest.stage), ...expand(manifest.topics), ...expand(manifest.app)])], css: expand(manifest.css) };
}
export function devPage() {
  const { js, css } = sourceFiles();
  let html = src('shell.html');
  html = html.replace('/*@@CSS@@*/', () => css.map((f) => src(f)).join('\n'));
  const author = existsSync(join(root, 'assets', 'author.png')) ? readFileSync(join(root, 'assets', 'author.png')).toString('base64') : '';
  html = html.replace(/@@AUTHOR_PNG@@/g, author).replace(/@@VERSION@@/g, 'dev');
  // the inline script block becomes a list of script tags; the boot code after the marker stays
  html = html.replace('//@@JS@@', () => '</script>\n' + js.map((f) => `<script src="src/${f}"></script>`).join('\n') + '\n<script>');
  return html;
}
