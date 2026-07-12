// C syntax colouring for the editor, one line at a time. The state carried between lines says
// whether the line starts inside a /* comment */.
(function (SEE) {
  'use strict';
  const esc = SEE.escapeHtml;
  const KW = new Set(['auto', 'break', 'case', 'const', 'continue', 'default', 'do', 'else', 'enum', 'extern', 'for', 'goto', 'if', 'register',
    'return', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'volatile', 'while']);
  const TYPES = new Set(['char', 'double', 'float', 'int', 'long', 'short', 'signed', 'unsigned', 'void', 'size_t', 'FILE', 'va_list', 'jmp_buf',
    'ptrdiff_t', 'wchar_t', 'time_t', 'clock_t', 'div_t', 'ldiv_t', 'fpos_t', 'sig_atomic_t']);
  const CONSTS = new Set(['NULL', 'EOF', 'stdin', 'stdout', 'stderr', 'EXIT_SUCCESS', 'EXIT_FAILURE', 'RAND_MAX', 'INT_MAX', 'INT_MIN', 'CHAR_BIT',
    'UINT_MAX', 'LONG_MAX', 'LONG_MIN', 'SEEK_SET', 'SEEK_CUR', 'SEEK_END', 'BUFSIZ', 'CLOCKS_PER_SEC', 'HUGE_VAL', 'errno']);

  const span = (cls, t) => '<span class="' + cls + '">' + esc(t) + '</span>';

  /** state: 0 normal, 1 inside a block comment */
  function highlightLine(line, state) {
    let out = '';
    let i = 0;
    const n = line.length;
    if (state === 1) {
      const e = line.indexOf('*/');
      if (e < 0) return span('c-com', line);
      out += span('c-com', line.slice(0, e + 2));
      i = e + 2;
    }
    // a preprocessor line: colour the directive, then the rest normally
    const pm = /^(\s*#\s*\w*)/.exec(line.slice(i));
    if (pm && i === 0) {
      out += span('c-pp', pm[1]);
      i += pm[1].length;
      const inc = /^(\s*)(<[^>]*>|"[^"]*")/.exec(line.slice(i));
      if (/include/.test(pm[1]) && inc) { out += esc(inc[1]) + span('c-str', inc[2]); i += inc[0].length; }
    }
    while (i < n) {
      const c = line[i];
      if (c === '/' && line[i + 1] === '*') {
        const e = line.indexOf('*/', i + 2);
        if (e < 0) { out += span('c-com', line.slice(i)); break; }
        out += span('c-com', line.slice(i, e + 2));
        i = e + 2;
        continue;
      }
      if (c === '/' && line[i + 1] === '/') { out += span('c-com', line.slice(i)); break; }
      if (c === '"' || c === '\'') {
        let j = i + 1;
        while (j < n && line[j] !== c) { if (line[j] === '\\') j++; j++; }
        out += span(c === '"' ? 'c-str' : 'c-chr', line.slice(i, j + 1));
        i = j + 1;
        continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(line[i + 1] || ''))) {
        const m = /^(0[xX][0-9a-fA-F]+|[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)[uUlLfF]*/.exec(line.slice(i));
        const t = m ? m[0] : c;
        out += span('c-num', t);
        i += t.length;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i))[0];
        const after = line.slice(i + m.length);
        if (KW.has(m)) out += span('c-kw', m);
        else if (TYPES.has(m)) out += span('c-type', m);
        else if (CONSTS.has(m) || /^[A-Z][A-Z0-9_]{2,}$/.test(m)) out += span('c-const', m);
        else if (/^\s*\(/.test(after)) out += span('c-fn', m);
        else out += esc(m);
        i += m.length;
        continue;
      }
      if ('{}()[];,'.includes(c)) { out += span('c-punc', c); i++; continue; }
      if ('+-*/%=<>!&|^~?:.'.includes(c)) { out += span('c-op', c); i++; continue; }
      out += esc(c);
      i++;
    }
    return out;
  }

  /** Whether the next line starts inside a comment */
  function depthAfter(line, state) {
    let i = 0, s = state;
    const n = line.length;
    while (i < n) {
      if (s === 1) {
        const e = line.indexOf('*/', i);
        if (e < 0) return 1;
        s = 0; i = e + 2;
        continue;
      }
      const c = line[i];
      if (c === '"' || c === '\'') { let j = i + 1; while (j < n && line[j] !== c) { if (line[j] === '\\') j++; j++; } i = j + 1; continue; }
      if (c === '/' && line[i + 1] === '/') return 0;
      if (c === '/' && line[i + 1] === '*') { s = 1; i += 2; continue; }
      i++;
    }
    return s;
  }

  /** Indent after a line ending with { */
  const indentAfter = (text) => /\{\s*(\/\*.*\*\/\s*)?$/.test(text);

  /** The identifier (with -> . and [ ] chains) under a column, for hover */
  function wordAt(text, col) {
    if (!/[A-Za-z0-9_]/.test(text[col] || '')) return null;
    let s = col, e = col;
    while (s > 0 && /[A-Za-z0-9_]/.test(text[s - 1])) s--;
    while (e < text.length && /[A-Za-z0-9_]/.test(text[e])) e++;
    const word = text.slice(s, e);
    if (/^[0-9]/.test(word)) return null;
    // extend left over member access: p->next->v , a.b
    let start = s;
    for (;;) {
      const m = /([A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])*)\s*(->|\.)\s*$/.exec(text.slice(0, start));
      if (!m) break;
      start -= m[0].length;
    }
    return { word, expr: text.slice(start, e).replace(/\s+/g, ''), start, end: e };
  }

  SEE.CLang = { highlightLine, depthAfter, indentAfter, wordAt, comment: ['/* ', ' */'], KW, TYPES };
})(SEE);
