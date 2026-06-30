// The C89 preprocessor: #include, #define with # and ##, conditional compilation, #line, #error.
// Macro expansion follows the hide-set rules, so recursive macros stop the way the standard says.
(function (SEE) {
  'use strict';
  const { CError } = SEE;
  const lex = SEE.Lexer.lex;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n, w, c) => String(n).padStart(w, c || '0');

  /**
   * opts: {
   *   read(path) -> text|null       read a file (project or system header)
   *   dirname(path), join(dir, name)
   *   sysdirs: ['/usr/include']     where <...> is searched
   *   defines: {NAME: 'value'}       -D style predefinitions
   *   now: Date
   * }
   * Returns {tokens, warnings, includes: [paths], macros}
   */
  function preprocess(text, file, opts) {
    opts = opts || {};
    const warnings = [];
    const includes = [];
    const macros = new Map();
    const now = opts.now || new Date();
    const date = '"' + MONTHS[now.getMonth()] + ' ' + pad(now.getDate(), 2, ' ') + ' ' + now.getFullYear() + '"';
    const time = '"' + pad(now.getHours(), 2) + ':' + pad(now.getMinutes(), 2) + ':' + pad(now.getSeconds(), 2) + '"';
    const builtins = new Set(['__FILE__', '__LINE__', '__DATE__', '__TIME__', '__STDC__']);
    const define = (name, body) => {
      const toks = lex(String(body), '<built-in>', { cpp: true }).filter((t) => t.k !== 'nl');
      macros.set(name, { name, fn: false, params: null, body: toks, builtin: true });
    };
    define('__STDC__', '1');
    define('__SEE__', '1');
    define('__ILP32__', '1');
    for (const [k, v] of Object.entries(opts.defines || {})) define(k, v === true ? '1' : v);
    if (opts.macros) for (const [k, v] of opts.macros) if (!v.builtin) macros.set(k, v);   // a program's macros, for expressions typed in the debugger

    const out = [];
    const lineOf = new Map();   // file -> line offset from #line
    const depth = { n: 0 };

    run(text, file);
    return { tokens: out, warnings, includes, macros };

    function err(msg, t) { return new CError(msg, t ? { file: t.file, line: t.line, col: t.col } : null); }
    function warn(msg, t) { warnings.push(new CError(msg, t ? { file: t.file, line: t.line, col: t.col } : null, 'warning')); }

    function run(src, fname) {
      if (++depth.n > 64) throw err('#include nested too deeply (is a header including itself?)', null);
      const lexOpts = { warnings, cpp: false };
      const toks = lex(src, fname, lexOpts);
      // split into lines
      const lines = [];
      let cur = [];
      for (const t of toks) {
        if (t.k === 'nl') { lines.push(cur); cur = []; } else cur.push(t);
      }
      if (cur.length) lines.push(cur);
      const cond = [];   // {active, taken, sawElse, tok}
      const active = () => cond.every((c) => c.active);
      let pending = [];   // text-line tokens waiting for expansion (function-like macro args may span lines)
      const flush = () => { if (pending.length) { expandInto(pending, out); pending = []; } };
      for (let li = 0; li < lines.length; li++) {
        const L = lines[li];
        if (!L.length) continue;
        if (L[0].k === 'p' && L[0].v === '#' && L[0].bol !== false && isDirectiveStart(L)) {
          const d = L[1];
          const rest = L.slice(2);
          const name = d ? (d.k === 'id' ? d.v : d.k === 'num' ? '#num' : '?') : '';
          // conditionals are tracked even when skipping
          if (name === 'if' || name === 'ifdef' || name === 'ifndef') {
            if (!active()) { cond.push({ active: false, taken: true, sawElse: false, tok: d }); continue; }
            flush();
            let v;
            if (name === 'if') v = evalIf(rest, d);
            else {
              if (!rest.length || rest[0].k !== 'id') throw err('#' + name + ' needs a macro name', d);
              if (rest.length > 1) warn('extra tokens at end of #' + name + ' directive', rest[1]);
              v = macros.has(rest[0].v) || builtins.has(rest[0].v);
              if (name === 'ifndef') v = !v;
            }
            cond.push({ active: v, taken: v, sawElse: false, tok: d });
            continue;
          }
          if (name === 'elif') {
            const c = cond[cond.length - 1];
            if (!c) throw err('#elif without #if', d);
            if (c.sawElse) throw err('#elif after #else', d);
            const outer = cond.slice(0, -1).every((x) => x.active);
            if (!outer || c.taken) { c.active = false; continue; }
            flush();
            c.active = evalIf(rest, d);
            if (c.active) c.taken = true;
            continue;
          }
          if (name === 'else') {
            const c = cond[cond.length - 1];
            if (!c) throw err('#else without #if', d);
            if (c.sawElse) throw err('#else after #else', d);
            if (rest.length) warn('extra tokens at end of #else directive', rest[0]);
            c.sawElse = true;
            const outer = cond.slice(0, -1).every((x) => x.active);
            c.active = outer && !c.taken;
            if (c.active) c.taken = true;
            continue;
          }
          if (name === 'endif') {
            if (!cond.length) throw err('#endif without #if', d);
            if (rest.length) warn('extra tokens at end of #endif directive', rest[0]);
            cond.pop();
            continue;
          }
          if (!active()) continue;
          flush();
          if (!d) continue;   // the null directive
          switch (name) {
            case 'define': doDefine(rest, d); break;
            case 'undef':
              if (!rest.length || rest[0].k !== 'id') throw err('#undef needs a macro name', d);
              if (builtins.has(rest[0].v)) warn('undefining "' + rest[0].v + '"', rest[0]);
              macros.delete(rest[0].v);
              break;
            case 'include': doInclude(rest, d); break;
            case 'line': {
              const e = expandList(rest);
              if (!e.length || e[0].k !== 'num' || !/^\d+$/.test(e[0].v)) throw err('#line needs a line number', d);
              lineOf.set(fname, { at: d.line, to: parseInt(e[0].v, 10), name: e[1] && e[1].k === 'str' ? e[1].v : null });
              break;
            }
            case 'error':
              throw err('#error ' + rest.map((t, i) => (i && t.ws ? ' ' : '') + spell(t)).join(''), d);
            case 'pragma': break;
            default:
              throw err('invalid preprocessing directive #' + (d.v || ''), d);
          }
          continue;
        }
        if (!active()) continue;
        for (const t of L) pending.push(t);
        // a function-like macro name whose ( is on a later line keeps the line pending
        if (!needsMore(pending)) flush();
        else pending.push({ k: 'nl', v: '\n', file: fname, line: L[L.length - 1].line, col: 0 });
      }
      pending = pending.filter((t) => t.k !== 'nl');
      flush();
      if (cond.length) throw err('unterminated #' + (cond[cond.length - 1].tok.v), cond[cond.length - 1].tok);
      depth.n--;
    }

    function isDirectiveStart(L) { return L[0].bol; }

    /** True when the pending text ends inside a function-like macro call */
    function needsMore(toks) {
      let i = 0;
      const n = toks.length;
      let open = -1;
      for (; i < n; i++) {
        const t = toks[i];
        if (t.k === 'id' && macros.has(t.v) && macros.get(t.v).fn) {
          let j = i + 1;
          while (j < n && toks[j].k === 'nl') j++;
          if (j >= n) return true;   // name at the end: the ( may come next line
          if (toks[j].k === 'p' && toks[j].v === '(') {
            let lvl = 0, k = j;
            for (; k < n; k++) {
              if (toks[k].k !== 'p') continue;
              if (toks[k].v === '(') lvl++;
              else if (toks[k].v === ')') { lvl--; if (!lvl) break; }
            }
            if (k >= n) open = j;
            else i = k;
          }
        }
      }
      return open >= 0;
    }

    function doDefine(rest, d) {
      if (!rest.length || rest[0].k !== 'id') throw err('macro names must be identifiers', rest[0] || d);
      const nameTok = rest[0];
      const name = nameTok.v;
      if (name === 'defined') throw err('"defined" cannot be used as a macro name', nameTok);
      let params = null, fn = false, i = 1;
      let variadic = false;
      if (rest[1] && rest[1].k === 'p' && rest[1].v === '(' && !rest[1].ws) {
        fn = true; params = [];
        i = 2;
        if (rest[i] && rest[i].v === ')') i++;
        else {
          for (;;) {
            const t = rest[i];
            if (!t) throw err('missing ) in macro parameter list', nameTok);
            if (t.k === 'p' && t.v === '...') { variadic = true; warn('variadic macros are not part of C89', t); params.push('__VA_ARGS__'); i++; }
            else if (t.k === 'id') { if (params.includes(t.v)) throw err('duplicate macro parameter "' + t.v + '"', t); params.push(t.v); i++; }
            else throw err('expected parameter name, found "' + spell(t) + '"', t);
            const s = rest[i];
            if (s && s.v === ',') { i++; continue; }
            if (s && s.v === ')') { i++; break; }
            throw err('expected comma in macro parameter list', s || t);
          }
        }
      }
      const body = rest.slice(i);
      if (body.length && body[0].v === '##' && body[0].k === 'p') throw err("'##' cannot appear at either end of a macro expansion", body[0]);
      if (body.length && body[body.length - 1].v === '##' && body[body.length - 1].k === 'p') throw err("'##' cannot appear at either end of a macro expansion", body[body.length - 1]);
      if (fn) for (let k = 0; k < body.length; k++) {
        if (body[k].k === 'p' && body[k].v === '#' && !(body[k + 1] && body[k + 1].k === 'id' && params.includes(body[k + 1].v))) throw err("'#' is not followed by a macro parameter", body[k]);
      }
      const m = { name, fn, params, body, variadic, file: nameTok.file, line: nameTok.line };
      const old = macros.get(name);
      if (old && !old.builtin && !sameMacro(old, m)) warn('"' + name + '" redefined', nameTok);
      if (builtins.has(name)) warn('redefining "' + name + '"', nameTok);
      macros.set(name, m);
    }

    function sameMacro(a, b) {
      if (a.fn !== b.fn) return false;
      if (a.fn && a.params.join(',') !== b.params.join(',')) return false;
      if (a.body.length !== b.body.length) return false;
      for (let i = 0; i < a.body.length; i++) {
        if (a.body[i].v !== b.body[i].v || (i && !!a.body[i].ws !== !!b.body[i].ws)) return false;
      }
      return true;
    }

    function doInclude(rest, d) {
      let toks = rest;
      if (!toks.length) throw err('#include expects "FILENAME" or <FILENAME>', d);
      if (!(toks[0].k === 'str' || (toks[0].k === 'p' && toks[0].v === '<'))) toks = expandList(toks);
      let name, sys;
      if (toks[0] && toks[0].k === 'str') { name = toks[0].v; sys = false; }
      else if (toks[0] && toks[0].v === '<') {
        let j = 1; name = '';
        while (j < toks.length && toks[j].v !== '>') { name += (j > 1 && toks[j].ws ? ' ' : '') + spell(toks[j]); j++; }
        if (j >= toks.length) throw err('missing terminating > character', toks[0]);
        sys = true;
      } else throw err('#include expects "FILENAME" or <FILENAME>', d);
      const found = findInclude(name, sys, d.file);
      if (!found) throw err(name + ': No such file or directory', d);
      if (!includes.includes(found.path)) includes.push(found.path);
      run(found.text, found.path);
    }

    function findInclude(name, sys, from) {
      const tries = [];
      const dir = opts.dirname ? opts.dirname(from) : '';
      if (name.startsWith('/')) tries.push(name);
      else {
        if (!sys) tries.push(opts.join ? opts.join(dir, name) : name);
        for (const s of opts.sysdirs || ['/usr/include']) tries.push((s.endsWith('/') ? s : s + '/') + name);
        if (sys && opts.join) tries.push(opts.join(dir, name));
        for (const s of opts.userdirs || []) tries.push(opts.join ? opts.join(s, name) : s + '/' + name);
      }
      for (const p of tries) {
        const t = opts.read ? opts.read(p) : null;
        if (t !== null && t !== undefined) return { path: p, text: t };
      }
      return null;
    }

    // ---- #if expressions -----------------------------------------------------------------------------
    function evalIf(rest, d) {
      // replace defined X / defined(X) before expansion
      const pre = [];
      for (let i = 0; i < rest.length; i++) {
        const t = rest[i];
        if (t.k === 'id' && t.v === 'defined') {
          let nm, j = i + 1;
          if (rest[j] && rest[j].v === '(') { nm = rest[j + 1]; if (!rest[j + 2] || rest[j + 2].v !== ')') throw err('missing ) after "defined"', t); i = j + 2; }
          else { nm = rest[j]; i = j; }
          if (!nm || nm.k !== 'id') throw err('operator "defined" requires an identifier', t);
          pre.push(Object.assign({}, t, { k: 'num', v: macros.has(nm.v) || builtins.has(nm.v) ? '1' : '0' }));
          continue;
        }
        pre.push(t);
      }
      const toks = expandList(pre).map((t) => (t.k === 'id' ? Object.assign({}, t, { k: 'num', v: '0' }) : t));
      if (!toks.length) throw err('#' + d.v + ' with no expression', d);
      let p = 0;
      const peek = () => toks[p];
      const is = (v) => toks[p] && toks[p].k === 'p' && toks[p].v === v;
      const BIG = (x) => BigInt.asIntN(32, x);
      // values are {v: BigInt, u: unsigned}
      const mk = (v, u) => ({ v: u ? BigInt.asUintN(32, v) : BIG(v), u });
      function primary() {
        const t = toks[p++];
        if (!t) throw err('missing expression in #' + d.v, d);
        if (t.k === 'num') {
          const m = /^(0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)([uUlL]*)$/.exec(t.v);
          if (!m) throw err('invalid integer "' + t.v + '" in #' + d.v, t);
          let v = BigInt(m[1].length > 1 && m[1][0] === '0' && !/[xX]/.test(m[1]) ? '0o' + m[1].slice(1) : m[1]);
          const u = /u/i.test(m[2]) || v > 0x7fffffffn;
          return mk(v, u);
        }
        if (t.k === 'char') {
          const c = SEE.Lexer.decodeEscapes(t.v, t, warnings);
          let v = 0;
          for (const b of c) v = (v << 8) | b;
          return mk(BigInt(c.length === 1 && c[0] > 127 ? c[0] - 256 : v), false);
        }
        if (t.k === 'p' && t.v === '(') {
          const v = cond();
          if (!is(')')) throw err('missing ) in #' + d.v, t);
          p++;
          return v;
        }
        throw err('token "' + spell(t) + '" is not valid in preprocessor expressions', t);
      }
      function unary() {
        if (is('-')) { p++; const a = unary(); return mk(-a.v, a.u); }
        if (is('+')) { p++; return unary(); }
        if (is('~')) { p++; const a = unary(); return mk(~a.v, a.u); }
        if (is('!')) { p++; const a = unary(); return mk(a.v ? 0n : 1n, false); }
        return primary();
      }
      const LV = [['*', '/', '%'], ['+', '-'], ['<<', '>>'], ['<', '>', '<=', '>='], ['==', '!='], ['&'], ['^'], ['|'], ['&&'], ['||']];
      function bin(level) {
        if (level < 0) return unary();
        let a = bin(level - 1);
        for (;;) {
          const t = peek();
          if (!t || t.k !== 'p' || !LV[level].includes(t.v)) return a;
          p++;
          if (t.v === '&&') { const b = bin(level - 1); a = mk(a.v && b.v ? 1n : 0n, false); continue; }
          if (t.v === '||') { const b = bin(level - 1); a = mk(a.v || b.v ? 1n : 0n, false); continue; }
          const b = bin(level - 1);
          const u = a.u || b.u;
          const x = u ? BigInt.asUintN(32, a.v) : a.v, y = u ? BigInt.asUintN(32, b.v) : b.v;
          switch (t.v) {
            case '*': a = mk(x * y, u); break;
            case '/': if (!y) throw err('division by zero in #' + d.v, t); a = mk(x / y, u); break;
            case '%': if (!y) throw err('division by zero in #' + d.v, t); a = mk(x % y, u); break;
            case '+': a = mk(x + y, u); break;
            case '-': a = mk(x - y, u); break;
            case '<<': a = mk(x << (y & 31n), a.u); break;
            case '>>': a = mk((a.u ? BigInt.asUintN(32, a.v) : a.v) >> (y & 31n), a.u); break;
            case '<': a = mk(x < y ? 1n : 0n, false); break;
            case '>': a = mk(x > y ? 1n : 0n, false); break;
            case '<=': a = mk(x <= y ? 1n : 0n, false); break;
            case '>=': a = mk(x >= y ? 1n : 0n, false); break;
            case '==': a = mk(x === y ? 1n : 0n, false); break;
            case '!=': a = mk(x !== y ? 1n : 0n, false); break;
            case '&': a = mk(x & y, u); break;
            case '^': a = mk(x ^ y, u); break;
            case '|': a = mk(x | y, u); break;
          }
        }
      }
      function cond() {
        const c = bin(LV.length - 1);
        if (!is('?')) return c;
        p++;
        const a = cond();
        if (!is(':')) throw err("expected ':' in #" + d.v, peek() || d);
        p++;
        const b = cond();
        return c.v ? a : b;
      }
      const r = cond();
      if (p < toks.length) throw err('missing binary operator before token "' + spell(toks[p]) + '"', toks[p]);
      return r.v !== 0n;
    }

    // ---- macro expansion -------------------------------------------------------------------------------
    function expandList(toks) { const o = []; expandInto(toks.filter((t) => t.k !== 'nl'), o); return o; }

    /** Expand tokens (no newlines except as call separators) into dest */
    function expandInto(input, dest) {
      const ts = input.filter((t) => t.k !== 'nl').map((t) => (t.hide ? t : Object.assign({}, t, { hide: null })));
      const res = expand(ts);
      for (const t of res) dest.push(t);
    }

    function hasHide(t, name) { return t.hide && t.hide.has(name); }
    function addHide(t, set) {
      const h = new Set(t.hide || []);
      for (const x of set) h.add(x);
      return h;
    }

    function expand(ts) {
      const outp = [];
      let i = 0;
      while (i < ts.length) {
        const t = ts[i];
        if (t.k !== 'id' || hasHide(t, t.v)) { outp.push(t); i++; continue; }
        if (builtins.has(t.v) && !(macros.get(t.v) && !macros.get(t.v).builtin)) {
          const v = builtin(t);
          if (v) { outp.push(v); i++; continue; }
        }
        const m = macros.get(t.v);
        if (!m) { outp.push(t); i++; continue; }
        if (!m.fn) {
          const hs = addHide(t, [t.v]);
          const body = subst(m, null, hs, t);
          ts.splice(i, 1, ...body);
          continue;
        }
        // function-like: needs ( next
        if (!(ts[i + 1] && ts[i + 1].k === 'p' && ts[i + 1].v === '(')) { outp.push(t); i++; continue; }
        const r = collectArgs(ts, i + 1, m, t);
        const close = ts[r.end];
        const hs = new Set([...(t.hide ? [...t.hide].filter((x) => close.hide && close.hide.has(x)) : []), t.v]);
        const body = subst(m, r.args, hs, t);
        ts.splice(i, r.end - i + 1, ...body);
      }
      return outp;
    }

    function builtin(t) {
      const at = (k, v) => Object.assign({}, t, { k, v, hide: new Set([t.v]) });
      const lo = lineOf.get(t.file);
      const ln = lo ? lo.to + (t.line - lo.at - 1) : t.line;
      switch (t.v) {
        case '__LINE__': return at('num', String(ln));
        case '__FILE__': return at('str', String(lo && lo.name ? lo.name : t.file).replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
        case '__DATE__': return at('str', date.slice(1, -1));
        case '__TIME__': return at('str', time.slice(1, -1));
        case '__STDC__': return at('num', '1');
      }
      return null;
    }

    function collectArgs(ts, open, m, nameTok) {
      const args = [];
      let cur = [];
      let lvl = 0;
      let i = open + 1;
      for (; i < ts.length; i++) {
        const t = ts[i];
        if (t.k === 'p' && t.v === '(') lvl++;
        else if (t.k === 'p' && t.v === ')') {
          if (!lvl) break;
          lvl--;
        } else if (t.k === 'p' && t.v === ',' && !lvl && !(m.variadic && args.length >= m.params.length - 1)) { args.push(cur); cur = []; continue; }
        cur.push(t);
      }
      if (i >= ts.length) throw err('unterminated argument list invoking macro "' + m.name + '"', nameTok);
      args.push(cur);
      if (m.params.length === 0 && args.length === 1 && !args[0].length) args.length = 0;
      if (args.length !== m.params.length) {
        if (!(m.params.length === 1 && args.length === 0)) {
          throw err('macro "' + m.name + '" ' + (args.length > m.params.length ? 'passed ' + args.length + ' arguments, but takes just ' + m.params.length : 'requires ' + m.params.length + ' arguments, but only ' + args.length + ' given'), nameTok);
        }
        args.push([]);
      }
      return { args, end: i };
    }

    /** Substitute a macro body; expansion position is that of the invocation */
    function subst(m, args, hs, at) {
      const body = m.body;
      const res = [];
      const pidx = (t) => (m.fn && t.k === 'id' ? m.params.indexOf(t.v) : -1);
      const place = (t, ws) => Object.assign({}, t, { file: at.file, line: at.line, col: at.col, ws: ws, from: m.name, bol: false });
      const expandedArg = new Map();
      const getExpanded = (k) => {
        if (!expandedArg.has(k)) expandedArg.set(k, expand(args[k].map((x) => Object.assign({}, x))));
        return expandedArg.get(k);
      };
      for (let i = 0; i < body.length; i++) {
        const t = body[i];
        const ws = i === 0 ? at.ws : t.ws;
        if (m.fn && t.k === 'p' && t.v === '#' && body[i + 1] && pidx(body[i + 1]) >= 0) {
          const a = args[pidx(body[i + 1])];
          res.push(place({ k: 'str', v: stringize(a) }, ws));
          i++;
          continue;
        }
        const nextPaste = body[i + 1] && body[i + 1].k === 'p' && body[i + 1].v === '##';
        const prevPaste = res.pasteNext;
        if (t.k === 'p' && t.v === '##') { res.pasteNext = true; continue; }
        const k = pidx(t);
        let seq;
        if (k >= 0) seq = (nextPaste || prevPaste) ? args[k].map((x) => Object.assign({}, x)) : getExpanded(k);
        else seq = [Object.assign({}, t)];
        seq = seq.map((x, j) => place(x, j === 0 ? ws : x.ws));
        if (prevPaste) {
          res.pasteNext = false;
          if (!seq.length) continue;
          const left = res.pop();
          if (!left) { res.push(...seq); continue; }
          const text = spell(left) + spell(seq[0]);
          const lt = lex(text, at.file, { cpp: true }).filter((x) => x.k !== 'nl');
          if (lt.length !== 1) throw err('pasting "' + spell(left) + '" and "' + spell(seq[0]) + '" does not give a valid preprocessing token', at);
          res.push(place(lt[0], left.ws), ...seq.slice(1));
          continue;
        }
        res.push(...seq);
      }
      delete res.pasteNext;
      for (const t of res) t.hide = addHide(t, hs);
      return res;
    }

    function stringize(a) {
      let s = '';
      a.forEach((t, i) => {
        if (i && t.ws) s += ' ';
        let v = spell(t);
        if (t.k === 'str' || t.k === 'char') v = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        s += v;
      });
      return s;
    }
  }

  /** Source spelling of a token */
  function spell(t) {
    if (t.k === 'str') return (t.wide ? 'L' : '') + '"' + t.v + '"';
    if (t.k === 'char') return (t.wide ? 'L' : '') + "'" + t.v + "'";
    return t.v;
  }

  /** Readable text of a token list, for "show preprocessed output" */
  function render(tokens) {
    let s = '';
    let line = -1, file = null;
    for (const t of tokens) {
      if (t.file !== file) { if (s) s += '\n'; s += '# ' + t.line + ' "' + t.file + '"\n'; file = t.file; line = t.line; }
      else if (t.line !== line) {
        if (t.line > line && t.line - line < 8) s += '\n'.repeat(t.line - line);
        else s += '\n# ' + t.line + ' "' + t.file + '"\n';
        line = t.line;
      } else if (t.ws) s += ' ';
      s += spell(t);
    }
    return s + '\n';
  }

  SEE.Cpp = { preprocess, spell, render };
})(SEE);
