// C89 lexer: source text -> preprocessing tokens, each remembering its file, line and column.
// Comments become whitespace, backslash-newline is spliced, and trigraphs are replaced.
(function (SEE) {
  'use strict';

  const PUNCT = [
    '%:%:', '...', '<<=', '>>=',
    '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '*=', '/=', '%=', '+=', '-=', '&=', '^=', '|=', '##',
    '<:', ':>', '<%', '%>', '%:',
    '[', ']', '(', ')', '{', '}', '.', '&', '*', '+', '-', '~', '!', '/', '%', '<', '>', '^', '|', '?', ':', ';', '=', ',', '#',
  ];
  const DIGRAPH = { '<:': '[', ':>': ']', '<%': '{', '%>': '}', '%:': '#', '%:%:': '##' };
  const TRIGRAPH = { '=': '#', '(': '[', '/': '\\', ')': ']', "'": '^', '<': '{', '!': '|', '>': '}', '-': '~' };

  class CError extends Error {
    /** kind: 'error' | 'warning'; pos: {file, line, col} */
    constructor(msg, pos, kind) {
      super(msg);
      this.pos = pos || null;
      this.kind = kind || 'error';
    }
  }
  SEE.CError = CError;

  /**
   * Turn source text into tokens.
   * Token: {k: 'id'|'num'|'char'|'str'|'p'|'other'|'nl', v, file, line, col, ws, bol, wide}
   *   ws: whitespace before the token; bol: first token on its line; 'nl' tokens mark line ends.
   */
  function lex(text, file, opts) {
    opts = opts || {};
    const warnings = opts.warnings || [];
    // trigraphs, then line splices; keep a map from spliced offsets back to real lines
    if (/\?\?[=(/)'<!>-]/.test(text)) {
      text = text.replace(/\?\?([=(/)'<!>-])/g, (m, c, off) => {
        warnings.push(new CError('trigraph ??' + c + ' converted to ' + TRIGRAPH[c], posAt(text, off, file), 'warning'));
        return TRIGRAPH[c] + '\u0000\u0000';   // keep column positions stable
      }).replace(/\u0000/g, '');
    }
    const out = [];
    const n = text.length;
    let i = 0, line = 1, col = 1;
    let ws = false, bol = true;
    const adv = (k) => {
      for (let j = 0; j < k; j++) {
        if (text[i] === '\n') { line++; col = 1; } else col++;
        i++;
      }
    };
    /** Skip any backslash-newline pairs at i (line splices) */
    const splice = () => { while (text[i] === '\\' && (text[i + 1] === '\n' || (text[i + 1] === '\r' && text[i + 2] === '\n'))) adv(text[i + 1] === '\r' ? 3 : 2); };
    const peek = (k) => {
      // character k positions ahead, looking through splices
      let j = i, c = 0;
      for (;;) {
        while (text[j] === '\\' && (text[j + 1] === '\n' || (text[j + 1] === '\r' && text[j + 2] === '\n'))) j += text[j + 1] === '\r' ? 3 : 2;
        if (c === k) return text[j];
        j++; c++;
      }
    };
    const take = () => { splice(); const c = text[i]; adv(1); return c; };
    const tok = (k, v, l0, c0, extra) => {
      const t = { k, v, file, line: l0, col: c0, ws, bol };
      if (extra) Object.assign(t, extra);
      out.push(t);
      ws = false; bol = false;
      return t;
    };
    while (i < n) {
      splice();
      if (i >= n) break;
      const c = text[i];
      if (c === '\n') { tok('nl', '\n', line, col); adv(1); bol = true; ws = false; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { adv(1); ws = true; continue; }
      if (c === '/' && peek(1) === '*') {
        const l0 = line, c0 = col;
        take(); take();
        let closed = false;
        while (i < n) {
          if (take() === '*' && peek(0) === '/') { take(); closed = true; break; }
        }
        if (!closed) throw new CError('unterminated comment', { file, line: l0, col: c0 });
        ws = true;
        continue;
      }
      if (c === '/' && peek(1) === '/') {
        // not C89, but everybody writes them; accept with a warning once per file
        if (!opts.cpp && !opts.warnedSlashSlash) { warnings.push(new CError('// comments are not part of C89 (they came with C99)', { file, line, col }, 'warning')); opts.warnedSlashSlash = true; }
        while (i < n && text[i] !== '\n') { splice(); if (text[i] === '\n') break; adv(1); }
        ws = true;
        continue;
      }
      const l0 = line, c0 = col;
      // identifiers (and L'x' / L"x")
      if (/[A-Za-z_]/.test(c)) {
        if (c === 'L' && (peek(1) === '\'' || peek(1) === '"')) {
          take();
          const q = peek(0);
          const s = quoted(q);
          tok(q === '"' ? 'str' : 'char', s, l0, c0, { wide: true });
          continue;
        }
        let s = '';
        while (i < n) { splice(); const d = text[i]; if (!/[A-Za-z0-9_]/.test(d)) break; s += d; adv(1); }
        tok('id', s, l0, c0);
        continue;
      }
      // pp-numbers: digit or .digit, then [0-9A-Za-z_.] and e+ e- E+ E-
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(peek(1) || ''))) {
        let s = take();
        for (;;) {
          splice();
          const d = text[i];
          if (d === undefined) break;
          if ((d === '+' || d === '-') && /[eE]/.test(s[s.length - 1])) { s += d; adv(1); continue; }
          if (/[0-9A-Za-z_.]/.test(d)) { s += d; adv(1); continue; }
          break;
        }
        tok('num', s, l0, c0);
        continue;
      }
      if (c === '"' || c === '\'') {
        const s = quoted(c);
        tok(c === '"' ? 'str' : 'char', s, l0, c0);
        continue;
      }
      // punctuators, longest first
      let p = null;
      for (const cand of PUNCT) {
        let ok = true;
        for (let k = 0; k < cand.length; k++) if (peek(k) !== cand[k]) { ok = false; break; }
        if (ok) { p = cand; break; }
      }
      if (p) {
        for (let k = 0; k < p.length; k++) take();
        tok('p', DIGRAPH[p] || p, l0, c0);
        continue;
      }
      take();
      tok('other', c, l0, c0);
    }
    if (out.length && out[out.length - 1].k !== 'nl') out.push({ k: 'nl', v: '\n', file, line, col, ws: false, bol: false });
    return out;

    /** Read a quoted literal; returns its raw body (escapes still in place) */
    function quoted(q) {
      const l0 = line, c0 = col;
      take();
      let s = '';
      for (;;) {
        splice();
        const d = text[i];
        if (d === undefined || d === '\n') throw new CError(q === '"' ? 'missing terminating " character' : "missing terminating ' character", { file, line: l0, col: c0 });
        adv(1);
        if (d === q) break;
        if (d === '\\') { splice(); s += '\\' + text[i]; adv(1); continue; }
        s += d;
      }
      return s;
    }
  }

  function posAt(text, off, file) {
    const before = text.slice(0, off);
    const line = before.split('\n').length;
    return { file, line, col: off - before.lastIndexOf('\n') };
  }

  /** Decode the escapes in the body of a character or string literal into char codes */
  function decodeEscapes(body, pos, warnings) {
    const out = [];
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c !== '\\') {
        const code = body.codePointAt(i);
        if (code < 128) out.push(code);
        else { for (const b of new TextEncoder().encode(String.fromCodePoint(code))) out.push(b); if (code > 0xffff) i++; }   // UTF-8, as a C compiler reading a UTF-8 file stores it
        continue;
      }
      const d = body[++i];
      switch (d) {
        case 'n': out.push(10); break;
        case 't': out.push(9); break;
        case 'r': out.push(13); break;
        case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': {
          let v = 0, k = 0;
          while (k < 3 && /[0-7]/.test(body[i])) { v = v * 8 + (body.charCodeAt(i) - 48); i++; k++; }
          i--;
          out.push(v & 255);
          break;
        }
        case 'x': {
          let v = 0, k = 0;
          i++;
          while (/[0-9a-fA-F]/.test(body[i] || '')) { v = v * 16 + parseInt(body[i], 16); i++; k++; }
          i--;
          if (!k) throw new CError('\\x used with no following hex digits', pos);
          if (v > 255 && warnings) warnings.push(new CError('hex escape sequence out of range', pos, 'warning'));
          out.push(v & 255);
          break;
        }
        case 'a': out.push(7); break;
        case 'b': out.push(8); break;
        case 'f': out.push(12); break;
        case 'v': out.push(11); break;
        case '\\': out.push(92); break;
        case '\'': out.push(39); break;
        case '"': out.push(34); break;
        case '?': out.push(63); break;
        default:
          if (warnings) warnings.push(new CError('unknown escape sequence \\' + d, pos, 'warning'));
          out.push(d.charCodeAt(0));
      }
    }
    return out;
  }

  SEE.Lexer = { lex, decodeEscapes, PUNCT };
})(SEE);
