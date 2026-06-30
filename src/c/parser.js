// C89 parser with semantic analysis: builds a typed tree for one translation unit.
// Messages follow the wording C programmers know from gcc, so they can be looked up.
(function (SEE) {
  'use strict';
  const { CError, Types } = SEE;
  const { T, Q_CONST, Q_VOLATILE } = Types;

  const KEYWORDS = new Set(['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern',
    'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch',
    'typedef', 'union', 'unsigned', 'void', 'volatile', 'while']);
  const TYPE_WORDS = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', 'struct', 'union', 'enum', 'const', 'volatile']);
  const STORAGE = new Set(['typedef', 'extern', 'static', 'auto', 'register']);
  const ASSIGN_OPS = new Set(['=', '*=', '/=', '%=', '+=', '-=', '<<=', '>>=', '&=', '^=', '|=']);
  const BIN_PREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };

  class Scope {
    constructor(parent, kind) { this.parent = parent; this.kind = kind; this.names = new Map(); this.tags = new Map(); }
    find(name) { for (let s = this; s; s = s.parent) { const v = s.names.get(name) || (s.fallback && s.fallback(name)); if (v) return v; } return null; }
    findTag(name) { for (let s = this; s; s = s.parent) { const v = s.tags.get(name) || (s.tagFallback && s.tagFallback(name)); if (v) return v; } return null; }
  }

  /**
   * Parse one translation unit.
   * tokens: from SEE.Cpp.preprocess; unit: {id, file}
   * Returns {globals, functions, strings, warnings, unit}
   */
  function parse(tokens, unit) {
    const toks = tokens.map((t) => (t.k === 'id' && KEYWORDS.has(t.v) ? Object.assign({}, t, { k: 'kw' }) : t));
    let p = 0;
    const warnings = [];
    const file = new Scope(null, 'file');
    const globals = [];         // file-scope objects and functions, by first declaration
    const functions = [];       // definitions
    const strings = [];         // string literals of this unit
    const staticLocals = [];
    let fn = null;              // current function context
    let blockDepth = 0;
    let scope = file;
    const EOF = { k: 'eof', v: '<end of file>', file: unit.file, line: tokens.length ? tokens[tokens.length - 1].line : 1, col: 1 };

    // ---- token helpers ------------------------------------------------------------------------------
    const peek = (k) => toks[p + (k || 0)] || EOF;
    const pos = (t) => { t = t || peek(); return { file: t.file, line: t.line, col: t.col }; };
    const err = (msg, t) => new CError(msg, t && t.file !== undefined ? pos(t) : t || pos());
    const warn = (msg, at) => warnings.push(new CError(msg, at && at.file !== undefined && at.line !== undefined ? { file: at.file, line: at.line, col: at.col } : pos(), 'warning'));
    const is = (v, k) => { const t = peek(k); return (t.k === 'p' || t.k === 'kw') && t.v === v; };
    const accept = (v) => { if (is(v)) { p++; return true; } return false; };
    const spell = (t) => (t.k === 'eof' ? 'end of file' : t.k === 'str' ? '"' + t.v + '"' : t.k === 'char' ? "'" + t.v + "'" : t.v);
    const expect = (v, what) => {
      if (is(v)) return toks[p++];
      const t = peek();
      if (v === ';') {
        const prev = toks[p - 1];
        throw err("expected ';' " + (what || 'before ' + quoteTok(t)), prev ? { file: prev.file, line: prev.line, col: prev.col + String(prev.v).length } : t);
      }
      throw err("expected '" + v + "' " + (what || 'before ' + quoteTok(t)), t);
    };
    const quoteTok = (t) => (t.k === 'eof' ? 'end of input' : "'" + spell(t) + "'");
    const isTypedefName = (t) => { if (t.k !== 'id') return false; const s = scope.find(t.v); return !!(s && s.kind === 'typedef'); };
    const startsType = (k) => { const t = peek(k); return (t.k === 'kw' && (TYPE_WORDS.has(t.v) || STORAGE.has(t.v))) || isTypedefName(t); };
    const startsTypeName = (k) => { const t = peek(k); return (t.k === 'kw' && TYPE_WORDS.has(t.v)) || isTypedefName(t); };

    if (unit.expression) return expressionOnly(unit.expression);

    // ---- top level ----------------------------------------------------------------------------------
    while (peek().k !== 'eof') {
      if (accept(';')) { warn('ISO C does not allow extra ";" outside of a function', toks[p - 1]); continue; }
      externalDeclaration();
    }
    // tentative definitions become definitions with zero value
    for (const g of globals) {
      if (g.kind === 'var' && !g.defined && g.tentative) {
        if (g.type.k === 'array' && g.type.n === null) { warn("array '" + g.name + "' assumed to have one element", g.pos); g.type = Types.array(g.type.of, 1); }
        if (!Types.isComplete(g.type)) throw err("storage size of '" + g.name + "' isn't known", g.pos);
        g.defined = true; g.init = null; g.bss = true;
      }
    }
    for (const g of globals) {
      if (g.kind === 'func' && g.linkage === 'internal' && !g.defined && g.used) warn("'" + g.name + "' used but never defined", g.pos);
      if (g.kind === 'func' && g.linkage === 'internal' && g.defined && !g.used && g.name !== 'main') warn("'" + g.name + "' defined but not used", g.pos);
    }
    const typedefs = new Map(), enumConsts = [];
    for (const [k, v] of file.names) {
      if (v.kind === 'typedef') typedefs.set(k, v.type);
      if (v.kind === 'enumconst') enumConsts.push(v);
    }
    return { unit, globals: globals.concat(staticLocals), functions, strings, warnings, tags: file.tags, typedefs, enumConsts };

    /** Parse just one expression, with names supplied by the debugger */
    function expressionOnly(x) {
      file.fallback = (name) => {
        const r = x.lookup(name);
        if (r) return r;
        const t = x.typedefs && x.typedefs(name);
        return t ? { kind: 'typedef', name, type: t } : null;
      };
      file.tagFallback = (name) => (x.tags ? x.tags(name) : null);
      fn = { name: '<debugger>', frame: 0, maxFrame: 0, locals: [], labels: new Map(), gotos: [], params: [], retType: T.int, switches: [], ctl: [], temps: 0, pos: pos() };
      const e = expr();
      if (peek().k !== 'eof') throw err('unexpected ' + quoteTok(peek()) + ' after the expression', peek());
      return e;
    }

    function externalDeclaration() {
      const start = peek();
      const spec = declSpecs(true);
      if (accept(';')) { declareTagOnly(spec, start); return; }
      let first = true;
      for (;;) {
        const d = declarator(false);
        if (!d.name) throw err('expected identifier or ( before ' + quoteTok(peek()), peek());
        let type = d.build(spec.type);
        // function definition?
        if (first && type.k === 'func' && (is('{') || (startsType() && d.knr))) {
          functionDefinition(spec, d, type);
          return;
        }
        first = false;
        const sym = declareGlobal(spec, d, type);
        if (accept('=')) {
          if (spec.storage === 'typedef') throw err("typedef '" + d.name + "' is initialized", d.pos);
          if (type.k === 'func') throw err("function '" + d.name + "' is initialized like a variable", d.pos);
          if (spec.storage === 'extern') warn("'" + d.name + "' initialized and declared 'extern'", d.pos);
          const init = initializer();
          if (sym.defined && sym.init !== undefined && sym.hasInit) throw err("redefinition of '" + d.name + "'", d.pos);
          sym.type = completeArrayFromInit(sym.type, init);
          sym.init = flattenInit(sym.type, init, true, d.name);
          sym.hasInit = true;
          sym.defined = true;
          sym.tentative = false;
          sym.defPos = d.pos;
          if (!Types.isComplete(sym.type)) throw err("storage size of '" + d.name + "' isn't known", d.pos);
        }
        if (accept(',')) continue;
        expect(';', 'after declaration');
        return;
      }
    }

    function declareTagOnly(spec, at) {
      if (!spec.tagDecl && spec.type.k !== 'enum') warn('useless type name in empty declaration', at);
      if (spec.storage && spec.storage !== 'typedef') warn("useless storage class specifier in empty declaration", at);
    }

    function declareGlobal(spec, d, type) {
      const name = d.name;
      if (spec.storage === 'typedef') {
        const old = file.names.get(name);
        if (old && (old.kind !== 'typedef' || !Types.compatible(old.type, type))) throw err("conflicting types for '" + name + "'", d.pos);
        if (old) warn("redefinition of typedef '" + name + "'", d.pos);
        file.names.set(name, { kind: 'typedef', name, type, pos: d.pos });
        return { kind: 'typedef' };
      }
      if (spec.storage === 'auto' || spec.storage === 'register') throw err("file-scope declaration of '" + name + "' specifies '" + spec.storage + "'", d.pos);
      const isFn = type.k === 'func';
      const linkage = spec.storage === 'static' ? 'internal' : 'external';
      let sym = file.names.get(name);
      if (sym) {
        if (sym.kind === 'typedef' || sym.kind === 'enumconst') throw err("'" + name + "' redeclared as different kind of symbol", d.pos);
        if ((sym.kind === 'func') !== isFn) throw err("'" + name + "' redeclared as different kind of symbol", d.pos);
        if (!Types.compatible(sym.type, type)) throw err("conflicting types for '" + name + "'" + note(sym), d.pos);
        sym.type = Types.composite(sym.type, type);
        if (isFn && d.params && !sym.defined) sym.paramNames = d.params;
        if (linkage === 'internal' && sym.linkage === 'external' && !sym.implicit) throw err("static declaration of '" + name + "' follows non-static declaration", d.pos);
        if (spec.storage !== 'extern' && spec.storage !== 'static' && sym.linkage === 'internal' && !isFn) throw err("non-static declaration of '" + name + "' follows static declaration", d.pos);
        if (sym.implicit) { sym.implicit = false; if (linkage === 'internal') sym.linkage = 'internal'; }
      } else {
        sym = { kind: isFn ? 'func' : 'var', name, type, linkage, storage: 'global', defined: false, pos: d.pos, unit: unit.id, paramNames: d.params };
        file.names.set(name, sym);
        globals.push(sym);
      }
      if (!isFn && spec.storage !== 'extern') {
        sym.tentative = !sym.hasInit;
        if (!sym.hasInit && spec.storage !== 'extern') sym.tentative = true;
      }
      if (!isFn && spec.storage === 'extern') sym.isExtern = true;
      return sym;
    }
    function note(sym) { return sym.pos ? ' (previous declaration at line ' + sym.pos.line + ')' : ''; }

    // ---- declaration specifiers ---------------------------------------------------------------------
    function declSpecs(allowStorage) {
      let storage = null, q = 0;
      const words = [];
      let type = null, tagDecl = false;
      const at = peek();
      for (;;) {
        const t = peek();
        if (t.k === 'kw' && STORAGE.has(t.v)) {
          if (!allowStorage) throw err("storage class specified for " + (allowStorage === false ? 'type name' : 'parameter'), t);
          if (storage) throw err('multiple storage classes in declaration specifiers', t);
          storage = t.v; p++; continue;
        }
        if (t.k === 'kw' && (t.v === 'const' || t.v === 'volatile')) {
          const b = t.v === 'const' ? Q_CONST : Q_VOLATILE;
          if (q & b) warn("duplicate '" + t.v + "'", t);
          q |= b; p++; continue;
        }
        if (t.k === 'kw' && (t.v === 'struct' || t.v === 'union')) {
          if (type || words.length) throw err('two or more data types in declaration specifiers', t);
          p++; const r = structSpec(t.v); type = r.type; tagDecl = r.decl; continue;
        }
        if (t.k === 'kw' && t.v === 'enum') {
          if (type || words.length) throw err('two or more data types in declaration specifiers', t);
          p++; const r = enumSpec(); type = r.type; tagDecl = r.decl; continue;
        }
        if (t.k === 'kw' && ['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned'].includes(t.v)) {
          if (type) throw err('two or more data types in declaration specifiers', t);
          words.push(t); p++; continue;
        }
        if (t.k === 'id' && !type && !words.length && isTypedefName(t)) {
          // a typedef name is a type only when no other type was given
          const s = scope.find(t.v);
          type = s.type; p++; continue;
        }
        break;
      }
      if (!type) {
        if (!words.length) {
          if (!storage && !q) throw err('expected declaration specifiers before ' + quoteTok(peek()), peek());
          warn("type defaults to 'int' in declaration", at);
          type = T.int;
        } else type = basicFromWords(words);
      }
      return { storage, type: Types.qual(type, q), tagDecl, pos: pos(at) };
    }

    function basicFromWords(words) {
      const c = {};
      for (const w of words) c[w.v] = (c[w.v] || 0) + 1;
      const at = words[0];
      const key = Object.keys(c).sort().map((k) => k + (c[k] > 1 ? c[k] : '')).join(' ');
      const MAP = {
        'void': 'void', 'char': 'char', 'char signed': 'schar', 'char unsigned': 'uchar',
        'short': 'short', 'short signed': 'short', 'int short': 'short', 'int short signed': 'short',
        'short unsigned': 'ushort', 'int short unsigned': 'ushort',
        'int': 'int', 'signed': 'int', 'int signed': 'int', 'unsigned': 'uint', 'int unsigned': 'uint',
        'long': 'long', 'long signed': 'long', 'int long': 'long', 'int long signed': 'long',
        'long unsigned': 'ulong', 'int long unsigned': 'ulong',
        'float': 'float', 'double': 'double', 'double long': 'ldouble',
      };
      if (c.long > 1) throw err("'long long' is not part of C89", words[0]);
      const k = MAP[key];
      if (!k) throw err('invalid combination of type specifiers: ' + words.map((w) => w.v).join(' '), at);
      return T[k];
    }

    function structSpec(kind) {
      const at = toks[p - 1];
      let tag = null;
      if (peek().k === 'id') tag = toks[p++].v;
      if (!tag && !is('{')) throw err("expected '{' or a tag name after '" + kind + "'", peek());
      if (is('{')) {
        // definition: a new type in this scope unless an incomplete one of the same tag is here
        let t = tag ? scope.tags.get(tag) : null;
        if (t && t.k !== kind) throw err("'" + tag + "' defined as wrong kind of tag", at);
        if (t && t.complete) throw err('redefinition of \'' + kind + ' ' + tag + "'", at);
        if (!t) { t = Types.newTag(kind, tag); if (tag) scope.tags.set(tag, t); }
        t.pos = pos(at);
        p++;
        const members = [];
        const names = new Set();
        while (!accept('}')) {
          if (peek().k === 'eof') throw err("expected '}' at end of input", peek());
          const sp = declSpecs(null);
          if (accept(';')) { warn('declaration does not declare anything', toks[p - 1]); continue; }
          for (;;) {
            let d = { name: null, build: (b) => b, pos: pos() };
            if (!is(':')) d = declarator(false);
            let mt = d.build(sp.type);
            let bits;
            if (accept(':')) {
              const e = condExpr();
              bits = intConst(e, 'bit-field width');
              if (!Types.isInt(mt) || !['int', 'uint', 'enum'].includes(Types.unqual(mt).k)) {
                if (Types.isInt(mt)) warn("bit-field '" + (d.name || '') + "' type is not int, unsigned int or signed int", d.pos);
                else throw err("bit-field '" + (d.name || '') + "' has invalid type", d.pos);
              }
              if (bits < 0) throw err("negative width in bit-field '" + (d.name || '') + "'", d.pos);
              if (bits > 32) throw err("width of '" + (d.name || '') + "' exceeds its type", d.pos);
              if (bits === 0 && d.name) throw err("zero width for bit-field '" + d.name + "'", d.pos);
            }
            if (mt.k === 'func') throw err("field '" + d.name + "' declared as a function", d.pos);
            if (!Types.isComplete(mt)) {
              if (mt.k === 'array' && mt.n === null) throw err("flexible array member '" + d.name + "' is not part of C89", d.pos);
              throw err("field '" + d.name + "' has incomplete type", d.pos);
            }
            if (d.name) {
              if (names.has(d.name)) throw err("duplicate member '" + d.name + "'", d.pos);
              names.add(d.name);
            }
            if (d.name || bits !== undefined) members.push({ name: d.name, type: mt, bits, pos: d.pos });
            if (accept(',')) continue;
            expect(';', 'at end of member declaration');
            break;
          }
        }
        if (!members.length) warn(kind + ' has no members', at);
        Types.layout(t, members);
        return { type: t, decl: true };
      }
      // reference
      let t = scope.findTag(tag);
      if (t && t.k !== kind) throw err("'" + tag + "' defined as wrong kind of tag", at);
      // "struct x;" alone declares a new incomplete type in this scope
      if (is(';') && (!t || !scope.tags.has(tag))) {
        t = Types.newTag(kind, tag); scope.tags.set(tag, t); t.pos = pos(at);
        return { type: t, decl: true };
      }
      if (!t) { t = Types.newTag(kind, tag); file.tags.set(tag, t); t.pos = pos(at); }
      return { type: t, decl: false };
    }

    function enumSpec() {
      const at = toks[p - 1];
      let tag = null;
      if (peek().k === 'id') tag = toks[p++].v;
      if (is('{')) {
        let t = tag ? scope.tags.get(tag) : null;
        if (t && (t.k !== 'enum' || t.complete)) throw err(t.k !== 'enum' ? "'" + tag + "' defined as wrong kind of tag" : "redeclaration of 'enum " + tag + "'", at);
        if (!t) { t = Types.newTag('enum', tag); if (tag) scope.tags.set(tag, t); }
        p++;
        let v = 0;
        t.consts = [];
        while (!accept('}')) {
          const nt = peek();
          if (nt.k !== 'id') throw err('expected identifier before ' + quoteTok(nt), nt);
          p++;
          if (accept('=')) v = intConst(condExpr(), 'enumerator value');
          if (v > 2147483647 || v < -2147483648) throw err("enumerator value for '" + nt.v + "' is not an integer constant that fits in int", nt);
          const old = scope.names.get(nt.v);
          if (old) throw err("redeclaration of '" + nt.v + "'", nt);
          scope.names.set(nt.v, { kind: 'enumconst', name: nt.v, value: v, type: T.int, pos: pos(nt), enumType: t });
          t.consts.push([nt.v, v]);
          v++;
          if (!accept(',')) { expect('}', 'at end of enumerator list'); break; }
          if (is('}')) warn('comma at end of enumerator list is not part of C89', toks[p - 1]);
        }
        t.complete = true; t.size = 4; t.align = 4;
        return { type: t, decl: true };
      }
      if (!tag) throw err("expected '{' after 'enum'", peek());
      let t = scope.findTag(tag);
      if (t && t.k !== 'enum') throw err("'" + tag + "' defined as wrong kind of tag", at);
      if (!t) { warn("ISO C forbids forward references to 'enum' types", at); t = Types.newTag('enum', tag); file.tags.set(tag, t); }
      return { type: t, decl: false };
    }

    // ---- declarators --------------------------------------------------------------------------------
    /** Returns {name, pos, build(base) -> type, params (names, for a function declarator), knr} */
    function declarator(abstract) {
      const ptrs = [];
      while (is('*')) {
        p++;
        let q = 0;
        while (is('const') || is('volatile')) { q |= is('const') ? Q_CONST : Q_VOLATILE; p++; }
        ptrs.push(q);
      }
      let inner = null, name = null, npos = pos();
      if (is('(') && (!abstract ? !startsTypeName(1) && !is(')', 1) || peek(1).k === 'id' && !isTypedefName(peek(1)) : (is('*', 1) || is('(', 1) || is('[', 1)))) {
        // ( declarator )  vs  function parameters of an abstract declarator
        if (abstract || peek(1).k === 'id' || is('*', 1) || is('(', 1)) {
          p++;
          inner = declarator(abstract);
          expect(')');
          name = inner.name; npos = inner.pos;
        }
      } else if (peek().k === 'id' && !abstract) {
        name = peek().v; npos = pos(); p++;
      } else if (peek().k === 'id' && abstract && !isTypedefName(peek())) {
        throw err('unexpected identifier ' + quoteTok(peek()) + ' in type name', peek());
      } else if (!abstract) {
        // name may be missing in parameter declarations; caller decides
      }
      const suffixes = [];
      let params = null, knr = false;
      for (;;) {
        if (is('[')) {
          const at = peek();
          p++;
          let n = null;
          if (!is(']')) {
            const e = condExpr();
            n = intConst(e, 'array size');
            if (n < 0) throw err("size of array" + (name ? " '" + name + "'" : '') + ' is negative', at);
            if (n === 0) warn('ISO C forbids zero-size array' + (name ? " '" + name + "'" : ''), at);
          }
          expect(']');
          suffixes.push({ k: 'array', n, at });
          continue;
        }
        if (is('(')) {
          const at = peek();
          p++;
          const r = paramList();
          suffixes.push({ k: 'func', r, at });
          if (!params && !inner) { params = r.names; knr = r.knr; }
          else if (!params && inner && !inner.params) { params = r.names; knr = r.knr; }
          continue;
        }
        break;
      }
      if (inner && inner.params) { params = inner.params; knr = inner.knr; }
      const build = (base) => {
        let t = base;
        for (const q of ptrs) t = Types.ptr(t, q);
        for (let i = suffixes.length - 1; i >= 0; i--) {
          const s = suffixes[i];
          if (s.k === 'array') {
            if (t.k === 'func') throw err("declaration of '" + (name || 'type name') + "' as array of functions", s.at);
            if (t.k === 'void') throw err("declaration of '" + (name || 'type name') + "' as array of voids", s.at);
            if (!Types.isComplete(t) && t.k !== 'array') throw err("array type has incomplete element type", s.at);
            if (t.k === 'array' && t.n === null) throw err("array type has incomplete element type", s.at);
            t = Types.array(t, s.n);
          } else {
            if (t.k === 'func') throw err("'" + (name || 'type name') + "' declared as function returning a function", s.at);
            if (t.k === 'array') throw err("'" + (name || 'type name') + "' declared as function returning an array", s.at);
            t = Types.func(t, s.r.params, s.r.variadic, s.r.proto);
          }
        }
        return inner ? inner.build(t) : t;
      };
      // a function declarator directly applied to the name gives the parameter names; (name) in brackets counts too
      const plain = !inner || inner.simple;
      const direct = plain && suffixes.length && suffixes[0].k === 'func';
      if (direct && inner && inner.simple) { params = suffixes[0].r.names; knr = suffixes[0].r.knr; }
      return { name, pos: npos, build, params: direct || (inner && inner.params) ? params : null, knr, paramInfo: direct ? suffixes[0].r : inner ? inner.paramInfo : null, simple: !ptrs.length && !suffixes.length && (!inner || inner.simple) };
    }

    /** ( parameter-type-list ) or ( identifier-list ) for K&R */
    function paramList() {
      if (accept(')')) return { params: [], names: [], proto: false, variadic: false, knr: false };
      if (is('void') && is(')', 1)) { p += 2; return { params: [], names: [], proto: true, variadic: false }; }
      if (peek().k === 'id' && !isTypedefName(peek())) {
        // K&R identifier list
        const names = [];
        for (;;) {
          const t = peek();
          if (t.k !== 'id') throw err('expected identifier before ' + quoteTok(t), t);
          names.push({ name: t.v, pos: pos(t) });
          p++;
          if (accept(',')) continue;
          expect(')');
          break;
        }
        return { params: [], names, proto: false, variadic: false, knr: true };
      }
      const params = [], names = [];
      let variadic = false;
      const saved = scope;
      scope = new Scope(scope, 'proto');
      try {
        for (;;) {
          if (accept('...')) { variadic = true; expect(')'); break; }
          const sp = declSpecs(undefined);
          if (sp.storage && sp.storage !== 'register') throw err("storage class specified for parameter", sp.pos);
          const d = declarator(false);
          let t = d.build(sp.type);
          if (t.k === 'void') {
            if (d.name || params.length || !is(')')) throw err("'void' must be the only parameter", sp.pos);
          }
          t = Types.adjustParam(t);
          params.push({ name: d.name, type: t, pos: d.pos, register: sp.storage === 'register' });
          names.push({ name: d.name, pos: d.pos, type: t, register: sp.storage === 'register' });
          if (d.name) {
            if (scope.names.has(d.name)) throw err("redefinition of parameter '" + d.name + "'", d.pos);
            scope.names.set(d.name, { kind: 'var', name: d.name, type: t });
          }
          if (accept(',')) { if (is(')')) throw err("expected declaration specifiers before ')'", peek()); continue; }
          expect(')');
          break;
        }
      } finally { scope = saved; }
      if (variadic && !params.length) throw err("ISO C requires a named argument before '...'", peek(-1));
      return { params, names, proto: true, variadic };
    }

    function typeName() {
      const sp = declSpecs(false);
      const d = declarator(true);
      return d.build(sp.type);
    }

    // ---- function definitions -----------------------------------------------------------------------
    function functionDefinition(spec, d, type) {
      if (spec.storage === 'typedef') throw err('function definition declared \'typedef\'', d.pos);
      if (spec.storage === 'auto' || spec.storage === 'register') throw err("invalid storage class for function '" + d.name + "'", d.pos);
      let params = d.paramInfo ? d.paramInfo.names : [];
      if (d.knr) {
        // old-style parameter declarations between ) and {
        const declared = new Map();
        while (!is('{')) {
          const sp = declSpecs(undefined);
          for (;;) {
            const pd = declarator(false);
            const pname = pd.name;
            const idx = params.findIndex((x) => x.name === pname);
            if (idx < 0) throw err("declaration for parameter '" + pname + "' but no such parameter", pd.pos);
            if (declared.has(pname)) throw err("redefinition of parameter '" + pname + "'", pd.pos);
            let t = Types.adjustParam(pd.build(sp.type));
            declared.set(pname, t);
            if (accept(',')) continue;
            expect(';');
            break;
          }
        }
        params = params.map((x) => {
          let t = declared.get(x.name);
          if (!t) { t = T.int; warn("type of '" + x.name + "' defaults to 'int'", x.pos); }
          // arguments arrive promoted; float parameters of old-style functions are passed as double
          const passed = t.k === 'float' ? T.double : t;
          return { name: x.name, pos: x.pos, type: passed };
        });
        type = Types.func(type.ret, params.map((x) => ({ name: x.name, type: x.type })), false, false);
      }
      if (type.ret.k === 'array' || type.ret.k === 'func') throw err("function '" + d.name + "' returns an array or function", d.pos);
      if (Types.isSU(type.ret) && !Types.isComplete(type.ret)) throw err('return type is an incomplete type', d.pos);
      const sym = declareGlobal(spec, d, type);
      if (sym.defined) throw err("redefinition of '" + d.name + "'" + note({ pos: sym.defPos }), d.pos);
      sym.defined = true;
      sym.defPos = d.pos;
      if (!d.knr) sym.type = type;
      if (d.name === 'main') {
        if (Types.unqual(type.ret).k !== 'int') warn("return type of 'main' is not 'int'", d.pos);
      }
      fn = {
        sym, name: d.name, type: sym.type, frame: 0, maxFrame: 0, locals: [], labels: new Map(), gotos: [], params: [],
        retType: type.ret, pos: d.pos, unit: unit.id, file: d.pos.file, switches: [], ctl: [], temps: 0,
      };
      scope = new Scope(file, 'func');
      // parameters live above the frame pointer: return address at FP+4, first argument at FP+8
      let off = 8;
      if (Types.isSU(type.ret)) { fn.hiddenRet = { off: 8 }; off += 4; }
      for (const x of params) {
        if (!x.name) throw err('parameter name omitted', x.pos || d.pos);
        if (x.type.k === 'void') continue;
        if (!Types.isComplete(x.type)) throw err("parameter '" + x.name + "' has incomplete type", x.pos);
        const size = Types.sizeof(x.type);
        const v = { kind: 'var', name: x.name, type: x.type, storage: 'param', off, pos: x.pos, register: x.register };
        off += (size + 3) & ~3;
        scope.names.set(x.name, v);
        fn.params.push(v);
      }
      fn.argBytes = off - 8;
      const body = compound(true);
      for (const g of fn.gotos) {
        if (!fn.labels.has(g.label)) throw err("label '" + g.label + "' used but not defined", g.pos);
        fn.labels.get(g.label).used = true;
      }
      for (const [name, l] of fn.labels) if (!l.used) warn("label '" + name + "' defined but not used", l.pos);
      const ret = Types.unqual(type.ret);
      if (ret.k !== 'void' && d.name !== 'main' && canFallThrough(body)) { fn.mayFallOff = true; warn("control reaches end of non-void function '" + d.name + "'", body.endPos); }
      functions.push({
        sym, name: d.name, type: sym.type, body, params: fn.params, locals: fn.locals, frameSize: (fn.maxFrame + 3) & ~3,
        hiddenRet: fn.hiddenRet, pos: d.pos, endPos: body.endPos, unit: unit.id, mayFallOff: fn.mayFallOff, labels: fn.labels, isStatic: sym.linkage === 'internal',
      });
      scope = file;
      fn = null;
    }

    function canFallThrough(s) {
      if (!s) return true;
      switch (s.k) {
        case 'return': return false;
        case 'block': return !s.items.length || canFallThrough(s.items[s.items.length - 1]);
        case 'if': return !s.else || canFallThrough(s.then) || canFallThrough(s.else);
        case 'expr': return !(s.e.k === 'call' && s.e.f.k === 'decay' && s.e.f.e.k === 'var' && ['exit', 'abort', 'longjmp'].includes(s.e.f.e.sym.name));
        case 'while': case 'for': return !(s.cond === null || (s.cond && s.cond.k === 'num' && s.cond.v)) || hasBreak(s.body);
        case 'do': return !(s.cond.k === 'num' && s.cond.v) || hasBreak(s.body);
        case 'goto': return false;
        case 'label': case 'case': case 'default': return canFallThrough(s.body);
        case 'switch': return !s.def || hasBreak(s.body) || canFallThrough(s.body);
        default: return true;
      }
    }
    function hasBreak(s) {
      if (!s || typeof s !== 'object') return false;
      if (s.k === 'break') return true;
      if (s.k === 'while' || s.k === 'for' || s.k === 'do' || s.k === 'switch') return false;
      for (const v of Object.values(s)) {
        if (Array.isArray(v)) { if (v.some((x) => x && x.k && hasBreak(x))) return true; }
        else if (v && v.k && typeof v === 'object' && v !== s && hasBreak(v)) return true;
      }
      return false;
    }

    // ---- statements --------------------------------------------------------------------------------
    function compound(isFnBody) {
      const open = expect('{');
      const saved = scope;
      if (!isFnBody) scope = new Scope(scope, 'block');
      const savedFrame = fn.frame;
      blockDepth++;
      const items = [];
      const decls = [];
      let sawStmt = false;
      while (!is('}')) {
        if (peek().k === 'eof') throw err("expected '}' at end of input", peek());
        if (startsType() && !(peek().k === 'id' && is(':', 1))) {
          if (sawStmt) warn('ISO C90 forbids mixed declarations and code', peek());
          const r = localDeclaration();
          for (const v of r.vars) decls.push(v);
          for (const s of r.stmts) items.push(s);
          continue;
        }
        sawStmt = true;
        items.push(statement());
      }
      const close = toks[p++];
      blockDepth--;
      for (const v of decls) if (!v.used && v.storage !== 'extern' && !v.isStaticLocal) warn("unused variable '" + v.name + "'", v.pos);
      scope = saved;
      void savedFrame;   // block variables keep their own slots (no sharing between sibling blocks), so every variable has one address
      return { k: 'block', items, decls, pos: pos(open), endPos: pos(close), line: open.line };
    }

    function localDeclaration() {
      const start = peek();
      const spec = declSpecs(true);
      const vars = [], stmts = [];
      if (accept(';')) { declareTagOnly(spec, start); return { vars, stmts }; }
      for (;;) {
        const d = declarator(false);
        if (!d.name) throw err('expected identifier or ( before ' + quoteTok(peek()), peek());
        const type = d.build(spec.type);
        const old = scope.names.get(d.name);
        if (spec.storage === 'typedef') {
          if (old) throw err("redefinition of '" + d.name + "'", d.pos);
          scope.names.set(d.name, { kind: 'typedef', name: d.name, type, pos: d.pos });
          if (accept(',')) continue;
          expect(';');
          break;
        }
        if (type.k === 'func' || spec.storage === 'extern') {
          // block-scope declaration of something defined elsewhere
          if (spec.storage === 'static' && type.k === 'func') throw err("invalid storage class for function '" + d.name + "'", d.pos);
          if (old && old.kind !== 'func' && old.kind !== 'var') throw err("'" + d.name + "' redeclared as different kind of symbol", d.pos);
          let g = file.names.get(d.name);
          if (g && !Types.compatible(g.type, type)) throw err("conflicting types for '" + d.name + "'", d.pos);
          if (!g) {
            g = { kind: type.k === 'func' ? 'func' : 'var', name: d.name, type, linkage: 'external', storage: 'global', defined: false, pos: d.pos, unit: unit.id, hiddenFromFile: true };
            globals.push(g);
          }
          scope.names.set(d.name, g);
          if (is('=')) throw err("'" + d.name + "' has both 'extern' and initializer", d.pos);
          vars.push(Object.assign({}, { name: d.name, storage: 'extern', pos: d.pos, used: true }));
          if (accept(',')) continue;
          expect(';');
          break;
        }
        if (old) throw err((old.kind === 'var' && old.storage === 'param' ? "'" + d.name + "' redeclared as different kind of symbol" : "redeclaration of '" + d.name + "'") + note(old), d.pos);
        if (type.k === 'void') throw err("variable or field '" + d.name + "' declared void", d.pos);
        if (spec.storage === 'static') {
          // lives in the data segment, named after its function
          const g = { kind: 'var', name: d.name, type, linkage: 'none', storage: 'global', isStaticLocal: true, label: fn.name + '.' + d.name + (staticLocals.some((x) => x.label === fn.name + '.' + d.name) ? '.' + staticLocals.length : ''), defined: true, pos: d.pos, unit: unit.id, fn: fn.name, used: false };
          scope.names.set(d.name, g);
          if (accept('=')) {
            const init = initializer();
            g.type = completeArrayFromInit(g.type, init);
            g.init = flattenInit(g.type, init, true, d.name);
          } else g.init = null;
          if (!Types.isComplete(g.type)) throw err("storage size of '" + d.name + "' isn't known", d.pos);
          staticLocals.push(g);
          vars.push(g);
          if (accept(',')) continue;
          expect(';');
          break;
        }
        const v = { kind: 'var', name: d.name, type, storage: spec.storage === 'register' ? 'register' : 'auto', pos: d.pos, used: false, fnName: fn.name };
        let initTree = null;
        scope.names.set(d.name, v);   // the name is in scope inside its own initializer
        if (accept('=')) {
          initTree = initializer();
          v.type = completeArrayFromInit(v.type, initTree);
        }
        if (!Types.isComplete(v.type)) throw err("storage size of '" + d.name + "' isn't known", d.pos);
        allocLocal(v);
        vars.push(v);
        fn.locals.push(v);
        if (initTree) {
          const entries = flattenInit(v.type, initTree, false, d.name);
          stmts.push({ k: 'init', v, entries, pos: d.pos, line: d.pos.line, whole: !(initTree.k === 'list') && !Types.isAggregate(v.type) });
        } else stmts.push({ k: 'decl', v, pos: d.pos, line: d.pos.line });
        if (accept(',')) continue;
        expect(';');
        break;
      }
      return { vars, stmts };
    }

    function allocLocal(v) {
      const size = Math.max(Types.sizeof(v.type), 1);
      const align = Math.max(Types.alignof(v.type), v.type.k === 'array' || Types.isSU(v.type) ? 4 : 1);
      // arrays get a guard gap below them, so running off the end is caught instead of silently hitting a neighbour
      if (v.type.k === 'array') fn.frame += 4;
      fn.frame = ((fn.frame + size + align - 1) & ~(align - 1));
      v.off = -fn.frame;
      if (v.type.k === 'array') { v.guard = true; fn.frame += 4; }   // and a gap below it, for index -1
      fn.maxFrame = Math.max(fn.maxFrame, fn.frame);
    }
    function allocTemp(type) {
      const size = Types.sizeof(type);
      const align = Math.max(Types.alignof(type), 4);
      fn.frame = ((fn.frame + size + align - 1) & ~(align - 1));
      const off = -fn.frame;
      fn.maxFrame = Math.max(fn.maxFrame, fn.frame);
      const t = { kind: 'var', name: '(temporary ' + (++fn.temps) + ')', type, storage: 'auto', off, temp: true };
      fn.locals.push(t);
      return t;
    }

    function statement() {
      const t = peek();
      const at = pos(t);
      const line = t.line;
      if (t.k === 'id' && is(':', 1)) {
        p += 2;
        const name = t.v;
        if (fn.labels.has(name)) throw err("duplicate label '" + name + "'", t);
        const l = { name, pos: at, used: false };
        fn.labels.set(name, l);
        if (is('}')) throw err('label at end of compound statement', peek());
        return { k: 'label', name, label: l, body: statement(), pos: at, line };
      }
      if (t.k === 'p' && t.v === '{') return compound(false);
      if (t.k === 'p' && t.v === ';') { p++; return { k: 'empty', pos: at, line }; }
      if (t.k === 'kw') {
        switch (t.v) {
          case 'if': {
            p++;
            expect('(');
            const c = condition(expr());
            expect(')');
            const then = statement();
            if (then.k === 'empty' && !is('else')) warn("suggest braces around empty body in an 'if' statement", at);
            let els = null;
            if (accept('else')) els = statement();
            return { k: 'if', cond: c, then, else: els, pos: at, line };
          }
          case 'while': {
            p++;
            expect('(');
            const c = condition(expr());
            expect(')');
            fn.ctl.push('loop');
            const body = statement();
            fn.ctl.pop();
            return { k: 'while', cond: c, body, pos: at, line };
          }
          case 'do': {
            p++;
            fn.ctl.push('loop');
            const body = statement();
            fn.ctl.pop();
            const wt = peek();
            expect('while', "before " + quoteTok(peek()) + " (a do needs its while)");
            expect('(');
            const c = condition(expr());
            expect(')');
            expect(';', 'after do-while statement');
            return { k: 'do', cond: c, body, pos: at, line, condLine: wt.line };
          }
          case 'for': {
            p++;
            expect('(');
            if (startsType()) throw err("'for' loop initial declarations are only allowed in C99", peek());
            const init = is(';') ? null : expr();
            expect(';');
            const cond = is(';') ? null : condition(expr());
            expect(';');
            const step = is(')') ? null : expr();
            expect(')');
            fn.ctl.push('loop');
            const body = statement();
            fn.ctl.pop();
            if (init) used(init);
            if (step) used(step);
            return { k: 'for', init, cond, step, body, pos: at, line };
          }
          case 'switch': {
            p++;
            expect('(');
            let c = rvalue(expr());
            expect(')');
            if (!Types.isInt(c.t)) throw err('switch quantity not an integer', at);
            c = convert(c, Types.promote(c.t));
            const sw = { k: 'switch', e: c, cases: [], def: null, pos: at, line, t: c.t };
            fn.switches.push(sw);
            fn.ctl.push('switch');
            sw.body = statement();
            fn.ctl.pop();
            fn.switches.pop();
            return sw;
          }
          case 'case': {
            p++;
            const sw = fn.switches[fn.switches.length - 1];
            const e = condExpr();
            if (!sw) throw err('case label not within a switch statement', at);
            let v = intConst(e, 'case label');
            v = castValue(v, sw.t);
            expect(':');
            if (sw.cases.some((c) => c.v === v)) throw err('duplicate case value', at);
            const c = { v, pos: at };
            sw.cases.push(c);
            if (is('}')) throw err('label at end of compound statement', peek());
            return { k: 'case', c, body: statement(), pos: at, line };
          }
          case 'default': {
            p++;
            expect(':');
            const sw = fn.switches[fn.switches.length - 1];
            if (!sw) throw err("'default' label not within a switch statement", at);
            if (sw.def) throw err('multiple default labels in one switch', at);
            sw.def = { pos: at };
            if (is('}')) throw err('label at end of compound statement', peek());
            return { k: 'default', d: sw.def, body: statement(), pos: at, line };
          }
          case 'break':
            p++; expect(';', "after 'break'");
            if (!fn.ctl.length) throw err('break statement not within loop or switch', at);
            return { k: 'break', pos: at, line };
          case 'continue': {
            p++; expect(';', "after 'continue'");
            if (!fn.ctl.includes('loop')) throw err('continue statement not within a loop', at);
            return { k: 'continue', pos: at, line };
          }
          case 'goto': {
            p++;
            const lt = peek();
            if (lt.k !== 'id') throw err('expected identifier before ' + quoteTok(lt), lt);
            p++;
            expect(';');
            const g = { k: 'goto', label: lt.v, pos: at, line };
            fn.gotos.push(g);
            return g;
          }
          case 'return': {
            p++;
            const ret = Types.unqual(fn.retType);
            if (accept(';')) {
              if (ret.k !== 'void') warn("'return' with no value, in function returning non-void", at);
              return { k: 'return', e: null, pos: at, line };
            }
            let e = expr();
            expect(';', 'after return value');
            if (ret.k === 'void') {
              if (Types.unqual(e.t).k !== 'void') warn("'return' with a value, in function returning void", at);
              return { k: 'return', e: rvalueOrVoid(e), discard: true, pos: at, line };
            }
            let raw = rvalue(e);
            while (raw.k === 'cast') raw = raw.e;
            if ((raw.k === 'decay' || raw.k === 'addr') && raw.e.k === 'var' && (raw.e.sym.storage === 'auto' || raw.e.sym.storage === 'register' || (raw.e.sym.storage === 'param' && raw.k === 'addr'))) {
              warn("function returns address of local variable '" + raw.e.name + "' (it stops existing when the function returns)", at);
            }
            e = assignConvert(rvalue(e), fn.retType, 'return', at);
            return { k: 'return', e, pos: at, line };
          }
        }
      }
      const e = expr();
      expect(';', 'after expression');
      checkUnused(e, at);
      return { k: 'expr', e, pos: at, line };
    }

    function checkUnused(e, at) {
      const k = e.k;
      if (k === 'assign' || k === 'opassign' || k === 'incdec' || k === 'call' || k === 'comma') return;
      if (k === 'cast' && e.t.k === 'void') return;
      if (k === 'cond' || k === 'logand' || k === 'logor') return;
      if (e.t && e.t.k === 'void') return;
      if (k === 'bin' && (e.op === '==')) { warn('statement with no effect (did you mean = instead of ==?)', at); return; }
      warn('statement with no effect', at);
    }

    // ---- initializers ------------------------------------------------------------------------------
    function initializer() {
      const at = peek();
      if (accept('{')) {
        const items = [];
        if (is('}')) throw err('empty initializer braces are not allowed in C89', at);
        while (!accept('}')) {
          items.push(initializer());
          if (!accept(',')) { expect('}', 'at end of initializer'); break; }
        }
        return { k: 'list', items, pos: pos(at) };
      }
      if ((is('[') || is('.')) && (peek(1).k === 'num' || peek(1).k === 'id')) throw err('designated initializers ([2] = x, .name = x) came with C99; list the values in order instead', at);
      const e = assignExpr();
      return { k: 'one', e, pos: pos(at) };
    }

    function completeArrayFromInit(t, init) {
      if (t.k !== 'array' || t.n !== null) return t;
      if (init.k === 'one' && init.e.k === 'str' && (init.e.wide ? isWideType(t.of) : isCharType(t.of))) return Types.array(t.of, init.e.wide ? init.e.chars.length : init.e.bytes.length);
      if (init.k === 'list' && init.items.length === 1 && init.items[0].k === 'one' && init.items[0].e.k === 'str' && isCharType(t.of)) return Types.array(t.of, init.items[0].e.bytes.length);
      if (init.k !== 'list') throw err('invalid initializer', init.pos);
      // count how many elements the list fills
      const elemSize = Types.sizeof(t.of);
      const probe = Types.array(t.of, 1 << 20);
      const entries = flattenInit(probe, init, false, '', true);
      let maxOff = 0;
      for (const e of entries) maxOff = Math.max(maxOff, e.off + 1);
      const n = Math.max(1, Math.ceil((entries.used || maxOff) / elemSize));
      return Types.array(t.of, n);
    }
    function isCharType(t) { return ['char', 'schar', 'uchar'].includes(t.k); }
    function isWideType(t) { return ['long', 'ulong', 'int', 'uint'].includes(t.k); }

    /**
     * Turn an initializer into a flat list of {off, type, e, bit?} entries; missing parts are zero.
     * isStatic: every expression must be a constant.
     */
    function flattenInit(type, init, isStatic, name, probing) {
      const out = [];
      out.used = 0;
      if (init.k === 'one' && !Types.isAggregate(type)) {
        out.push({ off: 0, type, e: initValue(type, init.e, isStatic, name) });
        return out;
      }
      if (init.k === 'one' && Types.isSU(type)) {
        // struct initialized from a struct value (allowed for automatic objects)
        const e = rvalue(init.e);
        if (Types.isSU(e.t) && Types.compatible(Types.unqual(e.t), Types.unqual(type))) {
          if (isStatic) throw err('initializer element is not constant', init.pos);
          out.push({ off: 0, type, e, whole: true });
          return out;
        }
      }
      if (init.k === 'one' && type.k === 'array' && init.e.k === 'str' && (init.e.wide ? isWideType(type.of) : isCharType(type.of))) {
        strInit(type, init.e, 0, out);
        return out;
      }
      if (init.k === 'one') {
        if (init.e.k === 'str' && type.k === 'array') throw err('array of inappropriate type initialized from string constant', init.pos);
        throw err("invalid initializer" + (name ? " for '" + name + "'" : ''), init.pos);
      }
      // brace list: walk with a cursor, allowing brace elision
      const items = init.items;
      let i = 0;
      fill(type, 0, true);
      if (i < items.length) {
        if (probing) return out;
        warn('excess elements in ' + (type.k === 'array' ? 'array' : Types.isSU(type) ? type.k : 'scalar') + ' initializer', items[i].pos);
      }
      return out;

      function fill(t, base, braced) {
        if (t.k === 'array') {
          const n = t.n;
          if (braced && items[i] && items[i].k === 'one' && items[i].e.k === 'str' && isCharType(t.of)) {
            strInit(t, items[i].e, base, out);
            i++;
            return;
          }
          for (let k = 0; (n === null || k < n) && i < items.length; k++) {
            const off = base + k * Types.sizeof(t.of);
            elem(t.of, off);
            out.used = Math.max(out.used, off - (probing ? 0 : 0) + Types.sizeof(t.of));
          }
          return;
        }
        if (Types.isSU(t)) {
          const d = Types.def(t);
          const ms = d.members.filter((m) => m.name);
          for (let k = 0; k < ms.length && i < items.length; k++) {
            elem(ms[k].type, base + ms[k].offset, ms[k]);
            if (d.k === 'union') break;
          }
          return;
        }
        elem(t, base);
      }
      function elem(t, off, member) {
        const it = items[i];
        if (it.k === 'list') {
          i++;
          if (!Types.isAggregate(t)) {
            if (it.items.length > 1) warn('excess elements in scalar initializer', it.pos);
            const sub = it.items[0];
            if (sub.k === 'list') throw err('braces around scalar initializer', it.pos);
            out.push({ off, type: t, e: initValue(t, sub.e, isStatic, name), member });
            return;
          }
          const sub = flattenInit(t, it, isStatic, name);
          for (const s of sub) out.push(Object.assign({}, s, { off: s.off + off }));
          return;
        }
        if (Types.isAggregate(t)) {
          // a string can fill a char array directly; a struct value can fill a struct member
          if (t.k === 'array' && it.e.k === 'str' && isCharType(t.of)) { strInit(t, it.e, off, out); i++; return; }
          if (Types.isSU(t) && !isStatic) {
            const e = rvalue(it.e);
            if (Types.isSU(e.t) && Types.compatible(Types.unqual(e.t), Types.unqual(t))) { out.push({ off, type: t, e, whole: true }); i++; return; }
          }
          fill(t, off, false);
          return;
        }
        i++;
        out.push({ off, type: t, e: initValue(t, it.e, isStatic, name), member });
      }
    }

    function strInit(t, s, off, out) {
      if (s.wide) {
        const n = t.n === null ? s.chars.length : t.n;
        if (s.chars.length - 1 > n) warn('initializer-string for array of wchar_t is too long', s.pos);
        for (let k = 0; k < n; k++) { const e = num(k < s.chars.length ? s.chars[k] : 0, t.of, s.pos); e.constVal = e.v; out.push({ off: off + k * Types.sizeof(t.of), type: t.of, e, fromString: true }); }
        out.used = Math.max(out.used || 0, off + n * Types.sizeof(t.of));
        return;
      }
      const n = t.n === null ? s.bytes.length : t.n;
      if (s.bytes.length - 1 > n) warn('initializer-string for array of chars is too long', s.pos);
      for (let k = 0; k < n; k++) {
        const v = k < s.bytes.length ? s.bytes[k] : 0;
        const e = num(t.of.k === 'uchar' ? v & 255 : (v << 24) >> 24, t.of, s.pos);
        e.constVal = e.v;
        out.push({ off: off + k, type: t.of, e, fromString: true });
      }
      out.used = Math.max(out.used || 0, off + n);
    }

    function initValue(t, e, isStatic, name) {
      let v = assignConvert(rvalue(e), t, 'initialization', e.pos);
      if (isStatic) {
        const c = constValue(v);
        if (c === null) throw err('initializer element is not constant', e.pos);
        v.constVal = c;
      }
      return v;
    }

    // ---- expressions --------------------------------------------------------------------------------
    function expr() {
      let e = assignExpr();
      while (is(',')) {
        const at = toks[p++];
        const r = assignExpr();
        e = { k: 'comma', l: rvalueOrVoid(e), r: rvalueOrVoid(r), t: rvalueOrVoid(r).t, pos: pos(at) };
      }
      return e;
    }

    function assignExpr() {
      const start = p;
      const l = condExpr();
      const t = peek();
      if (t.k === 'p' && ASSIGN_OPS.has(t.v)) {
        p++;
        const r = assignExpr();
        return makeAssign(t.v, l, r, pos(t));
      }
      void start;
      return l;
    }

    function condExpr() {
      const c = binExpr(1);
      if (!is('?')) return c;
      const at = toks[p++];
      const a = expr();
      expect(':');
      const b = condExpr();
      return makeCond(c, a, b, pos(at));
    }

    function binExpr(min) {
      let l = castExpr();
      for (;;) {
        const t = peek();
        if (t.k !== 'p') return l;
        const prec = BIN_PREC[t.v];
        if (!prec || prec < min) return l;
        p++;
        const r = binExpr(prec + 1);
        l = makeBinary(t.v, l, r, pos(t));
      }
    }

    function castExpr() {
      if (is('(') && startsTypeName(1)) {
        const at = toks[p++];
        const t = typeName();
        expect(')');
        if (is('{')) throw err('compound literals are not part of C89', peek());
        const e = castExpr();
        return makeCast(e, t, pos(at));
      }
      return unaryExpr();
    }

    function unaryExpr() {
      const t = peek();
      const at = pos(t);
      if (t.k === 'p') {
        switch (t.v) {
          case '++': case '--': { p++; const e = unaryExpr(); return makeIncDec(t.v, e, false, at); }
          case '&': {
            p++;
            const e = castExpr();
            return makeAddr(e, at);
          }
          case '*': { p++; const e = castExpr(); return makeDeref(e, at); }
          case '+': case '-': {
            p++;
            const e = rvalue(castExpr());
            if (!Types.isArith(e.t)) throw err("wrong type argument to unary " + (t.v === '-' ? 'minus' : 'plus'), at);
            const pt = Types.promote(e.t);
            const ce = convert(e, pt);
            if (t.v === '+') return ce === e ? { k: 'cast', e: ce, t: pt, pos: at } : ce;
            return fold({ k: 'unop', op: '-', e: ce, t: pt, pos: at });
          }
          case '~': {
            p++;
            const e = rvalue(castExpr());
            if (!Types.isInt(e.t)) throw err('wrong type argument to bit-complement', at);
            const pt = Types.promote(e.t);
            return fold({ k: 'unop', op: '~', e: convert(e, pt), t: pt, pos: at });
          }
          case '!': {
            p++;
            const e = rvalue(castExpr());
            if (!Types.isScalar(e.t)) throw err('wrong type argument to unary exclamation mark', at);
            return fold({ k: 'unop', op: '!', e, t: T.int, pos: at });
          }
        }
      }
      if (t.k === 'kw' && t.v === 'sizeof') {
        p++;
        let ty;
        if (is('(') && startsTypeName(1)) {
          p++;
          ty = typeName();
          expect(')');
        } else {
          const e = unaryExpr();
          if (e.k === 'member' && e.m.width !== undefined) throw err("'sizeof' applied to a bit-field", at);
          ty = e.t;
          if (e.k === 'var') e.sym.usedSizeof = true;
        }
        if (ty.k === 'func') throw err("invalid application of 'sizeof' to a function type", at);
        if (ty.k === 'void') throw err("invalid application of 'sizeof' to a void type", at);
        if (!Types.isComplete(ty)) throw err("invalid application of 'sizeof' to incomplete type '" + Types.str(ty) + "'", at);
        return { k: 'num', v: Types.sizeof(ty), t: T.uint, pos: at, sizeofType: ty };
      }
      return postfixExpr();
    }

    function postfixExpr() {
      let e = primaryExpr();
      for (;;) {
        const t = peek();
        const at = pos(t);
        if (is('[')) {
          p++;
          const idx = expr();
          expect(']');
          e = makeIndex(e, idx, at);
          continue;
        }
        if (is('(')) {
          p++;
          const args = [];
          if (!is(')')) {
            for (;;) {
              args.push(assignExpr());
              if (accept(',')) continue;
              break;
            }
          }
          expect(')');
          e = makeCall(e, args, at);
          continue;
        }
        if (is('.') || is('->')) {
          p++;
          const nt = peek();
          if (nt.k !== 'id') throw err('expected identifier before ' + quoteTok(nt), nt);
          p++;
          e = makeMember(e, nt.v, t.v === '->', at, nt);
          continue;
        }
        if (is('++') || is('--')) { p++; e = makeIncDec(t.v, e, true, at); continue; }
        return e;
      }
    }

    function primaryExpr() {
      const t = peek();
      const at = pos(t);
      if (t.k === 'id') {
        p++;
        let s = scope.find(t.v);
        if (!s) {
          if (is('(')) {
            // implicit declaration: int name();
            warn("implicit declaration of function '" + t.v + "'", t);
            s = file.names.get(t.v);
            if (!s) {
              s = { kind: 'func', name: t.v, type: Types.func(T.int, [], false, false), linkage: 'external', storage: 'global', defined: false, pos: at, unit: unit.id, implicit: true };
              file.names.set(t.v, s);
              globals.push(s);
            }
          } else throw err("'" + t.v + "' undeclared" + (fn ? ' (first use in this function)' : ''), t);
        }
        if (s.kind === 'typedef') throw err('unexpected type name ' + quoteTok(t) + ': expected expression', t);
        if (s.kind === 'enumconst') return { k: 'num', v: s.value, t: T.int, pos: at, enumConst: s.name };
        s.used = true;
        if (s.kind === 'func') return { k: 'var', sym: s, t: s.type, lv: false, pos: at, name: s.name };
        return { k: 'var', sym: s, t: s.type, lv: true, pos: at, name: s.name };
      }
      if (t.k === 'num') { p++; return numberLiteral(t); }
      if (t.k === 'char') {
        p++;
        const b = SEE.Lexer.decodeEscapes(t.v, at, warnings);
        if (!b.length) throw err('empty character constant', t);
        if (b.length > 1) warn('multi-character character constant', t);
        let v = 0;
        for (const x of b) v = (v << 8) | x;
        if (b.length === 1) v = (b[0] << 24) >> 24;   // plain char is signed here
        if (t.wide) return { k: 'num', v: b[b.length - 1], t: T.long, pos: at };
        return { k: 'num', v, t: T.int, pos: at, char: true };
      }
      if (t.k === 'str') {
        // adjacent literals are joined
        let bytes = [];
        let wide = false;
        while (peek().k === 'str') {
          const s = toks[p++];
          if (s.wide) wide = true;
          bytes = bytes.concat(SEE.Lexer.decodeEscapes(s.v, pos(s), warnings));
        }
        if (wide) {
          // L"..." is an array of wchar_t (long, 4 bytes each here)
          const codes = bytes.concat([0]);
          const wb = [];
          for (const c of codes) wb.push(c & 255, (c >> 8) & 255, 0, 0);
          const lit = { id: strings.length, bytes: wb, pos: at, unit: unit.id, wide: true };
          strings.push(lit);
          return { k: 'str', lit, bytes: wb, chars: codes, t: Types.array(T.long, codes.length), lv: true, pos: at, wide: true };
        }
        bytes.push(0);
        const lit = { id: strings.length, bytes, pos: at, unit: unit.id };
        strings.push(lit);
        if (bytes.length > 510) warn('string length ' + (bytes.length - 1) + ' is greater than the length 509 C89 compilers are required to support', at);
        return { k: 'str', lit, bytes, t: Types.array(T.char, bytes.length), lv: true, pos: at };
      }
      if (t.k === 'p' && t.v === '(') {
        p++;
        const e = expr();
        expect(')');
        return Object.assign({}, e, { paren: true });
      }
      if (t.k === 'eof') throw err('expected expression at end of input', t);
      throw err('expected expression before ' + quoteTok(t), t);
    }

    function numberLiteral(t) {
      const s = t.v;
      const at = pos(t);
      if (/^(0[xX][0-9a-fA-F]+|[0-9]+)[uUlL]*$/.test(s) && !/^[0-9]*[.eE]/.test(s) || /^0[xX]/.test(s)) {
        const m = /^(0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)([uUlL]*)$/.exec(s);
        if (!m) {
          if (/^0[0-9]+$/.test(s)) throw err("invalid digit \"" + (/[89]/.exec(s) || ['8'])[0] + "\" in octal constant", t);
          throw err('invalid suffix "' + s.replace(/^(0[xX][0-9a-fA-F]+|[0-9]+)/, '') + '" on integer constant', t);
        }
        const suf = m[2].toLowerCase();
        if (/l.*l/.test(suf) || /u.*u/.test(suf)) throw err('invalid suffix "' + m[2] + '" on integer constant', t);
        const dec = !/^0/.test(m[1]) || m[1] === '0';
        let v;
        if (/^0[xX]/.test(m[1])) v = parseInt(m[1].slice(2), 16);
        else if (m[1].length > 1 && m[1][0] === '0') v = parseInt(m[1], 8);
        else v = Number(m[1]);
        const U = suf.includes('u'), L = suf.includes('l');
        let ty;
        // C89 6.1.3.2: decimal: int, long, unsigned long; octal/hex: int, unsigned int, long, unsigned long
        if (v <= 0x7fffffff && !U && !L) ty = T.int;
        else if (!dec && v <= 0xffffffff && !U && !L) ty = T.uint;
        else if (v <= 0x7fffffff && !U) ty = T.long;
        else if (U && !L && v <= 0xffffffff) ty = T.uint;
        else if (v <= 0xffffffff) { ty = T.ulong; if (dec && !U) warn('this decimal constant is unsigned only in ISO C90', t); }
        else { warn('integer constant is too large for its type', t); ty = T.ulong; v = v % 4294967296; }
        return { k: 'num', v, t: ty, pos: at, text: s };
      }
      const m = /^((?:[0-9]+\.[0-9]*|\.[0-9]+|[0-9]+)(?:[eE][+-]?[0-9]+)?)([fFlL]?)$/.exec(s);
      if (!m || (!/[.eE]/.test(m[1]))) throw err('invalid number "' + s + '"', t);
      const suf = m[2].toLowerCase();
      let v = parseFloat(m[1]);
      let ty = suf === 'f' ? T.float : suf === 'l' ? T.ldouble : T.double;
      if (suf === 'f') v = Math.fround(v);
      if (!isFinite(v)) warn('floating constant exceeds range of ' + Types.str(ty), t);
      return { k: 'num', v, t: ty, pos: at, text: s };
    }

    // ---- building typed nodes -----------------------------------------------------------------------
    function num(v, t, at) { return { k: 'num', v, t, pos: at }; }

    /** Value of an expression: arrays and functions decay to pointers, lvalues are read */
    function rvalue(e) {
      if (e.t.k === 'array') return { k: 'decay', e, t: Types.ptr(e.t.of), pos: e.pos };
      if (e.t.k === 'func') return { k: 'decay', e, t: Types.ptr(e.t), pos: e.pos };
      if (e.t.k === 'void') throw err('void value not ignored as it ought to be', e.pos);
      if (e.lv && !Types.isComplete(e.t) && !Types.isSU(e.t)) throw err('invalid use of incomplete type', e.pos);
      if (e.lv && Types.isSU(e.t) && !Types.isComplete(e.t)) throw err("invalid use of undefined type '" + Types.str(e.t) + "'", e.pos);
      if (e.lv) return { k: 'load', e, t: Types.unqual(e.t), pos: e.pos };
      return e;
    }
    function rvalueOrVoid(e) { return e.t.k === 'void' ? e : rvalue(e); }
    function condition(e) {
      if (e.k === 'assign' && !e.paren) warn('suggest parentheses around assignment used as truth value', e.pos);
      e = rvalue(e);
      if (!Types.isScalar(e.t)) throw err('used ' + (Types.isSU(e.t) ? e.t.k + ' type' : 'array type') + ' value where scalar is required', e.pos);
      return e;
    }
    function used(e) { return e; }

    function convert(e, t) {
      const from = e.t;
      if (from === t) return e;
      const a = Types.mkind(from), b = Types.mkind(t);
      if (Types.isSU(t)) return e;
      if (a === b && from.k !== 'enum' && t.k !== 'enum' && from.k === Types.unqual(t).k && !(t.k === 'ptr' || from.k === 'ptr')) return Object.assign({}, e, { t: Types.unqual(t) });
      return fold({ k: 'cast', e, t: Types.unqual(t), pos: e.pos, implicit: true });
    }

    function makeCast(e, t, at) {
      if (t.k === 'void') {
        const v = rvalueOrVoid(e);
        return { k: 'cast', e: v, t: T.void, pos: at };
      }
      const v = rvalue(e);
      if (!Types.isScalar(t)) {
        if (Types.isSU(t) && Types.compatible(Types.unqual(v.t), Types.unqual(t))) return v;
        throw err('conversion to non-scalar type requested', at);
      }
      if (!Types.isScalar(v.t)) throw err('aggregate value used where ' + (Types.isFloat(t) ? 'a float' : 'an integer') + ' was expected', at);
      if (Types.isFloat(t) && v.t.k === 'ptr' || Types.isFloat(v.t) && t.k === 'ptr') throw err('pointer value used where a floating point value was expected', at);
      if (t.k === 'ptr' && Types.isInt(v.t) && Types.sizeof(v.t) < 4 && !isNullConst(v)) warn('cast to pointer from integer of different size', at);
      if (Types.isInt(t) && v.t.k === 'ptr' && Types.sizeof(t) < 4) warn('cast from pointer to integer of different size', at);
      return fold({ k: 'cast', e: v, t: Types.unqual(t), pos: at, explicit: true, castQ: t.q });
    }

    function isNullConst(e) {
      while (e.k === 'cast' && (Types.isInt(e.t) || (e.t.k === 'ptr' && e.t.to.k === 'void' && !e.t.to.q))) e = e.e;
      return e.k === 'num' && Types.isInt(e.t) && e.v === 0;
    }

    /** Conversion as if by assignment (6.3.16.1), with the usual diagnostics */
    function assignConvert(e, t, ctx, at) {
      const to = Types.unqual(t);
      const from = e.t;
      const what = ctx === 'return' ? 'return' : ctx === 'initialization' ? 'initialization' : ctx === 'argument' ? 'passing argument' : 'assignment';
      if (Types.isArith(to) && Types.isArith(from)) {
        if (Types.isInt(to) && e.k === 'num' && Types.isInt(from)) {
          const r = Types.range(to);
          const cv = constValue(e);
          if (typeof cv === 'number' && (cv < r[0] || cv > r[1]) && !(Types.isUnsigned(to) && cv < 0 && cv >= -r[1]) && Types.sizeof(to) < 4) warn('overflow in implicit constant conversion', at);
        }
        if (Types.isInt(to) && Types.isFloat(from) && e.k === 'num') { /* fine, truncates */ }
        return convert(e, to);
      }
      if (Types.isSU(to)) {
        if (Types.isSU(from) && Types.def(from) === Types.def(to)) return e;
        throw err('incompatible types when ' + (what === 'assignment' ? 'assigning to' : what === 'return' ? 'returning' : 'initializing') + " type '" + Types.str(t) + "' from type '" + Types.str(from) + "'", at);
      }
      if (to.k === 'ptr') {
        if (isNullConst(e)) return convert(e, to);
        if (from.k === 'ptr') {
          const lt = to.to, rt = from.to;
          const lost = (rt.q & ~lt.q) & (Q_CONST | Q_VOLATILE);
          if (lt.k === 'void' || rt.k === 'void') {
            if (lt.k === 'void' && rt.k === 'func' || rt.k === 'void' && lt.k === 'func') warn('ISO C forbids conversion of ' + (lt.k === 'func' ? 'object pointer to function pointer' : 'function pointer to object pointer') + ' type', at);
          } else if (!Types.compatible(Types.unqual(lt), Types.unqual(rt))) {
            warn(what + ' ' + (ctx === 'argument' ? '' : '') + "from incompatible pointer type ('" + Types.str(from) + "' to '" + Types.str(t) + "')", at);
          }
          if (lost) warn(what + " discards '" + (lost & Q_CONST ? 'const' : 'volatile') + "' qualifier from pointer target type", at);
          return convert(e, to);
        }
        if (Types.isInt(from)) { warn(what + ' makes pointer from integer without a cast', at); return convert(e, to); }
      }
      if (Types.isInt(to) && from.k === 'ptr') { warn(what + ' makes integer from pointer without a cast', at); return convert(e, to); }
      throw err('incompatible types in ' + what + " (cannot convert '" + Types.str(from) + "' to '" + Types.str(t) + "')", at);
    }

    function checkModifiable(e, at, verb) {
      if (!e.lv) {
        if (e.k === 'str') throw err('lvalue required as ' + verb + ' operand', at);
        throw err('lvalue required as ' + (verb === 'assignment' ? 'left operand of assignment' : verb + ' operand'), at);
      }
      if (e.t.k === 'array') throw err('assignment to expression with array type', at);
      if (e.t.k === 'func') throw err('lvalue required as left operand of assignment', at);
      if (Types.isConst(e.t) || (Types.isSU(e.t) && Types.hasConstMember(e.t))) {
        const desc = describeLvalue(e);
        if (verb === 'assignment') throw err('assignment of read-only ' + desc, at);
        throw err((verb === 'increment' ? 'increment' : 'decrement') + ' of read-only ' + desc, at);
      }
      if (!Types.isComplete(e.t)) throw err('invalid use of incomplete type', at);
    }
    function describeLvalue(e) {
      if (e.k === 'var') return (e.sym.storage === 'param' ? 'parameter' : 'variable') + " '" + e.name + "'";
      if (e.k === 'member') return "member '" + e.m.name + "'";
      return "location '" + exprText(e) + "'";
    }
    function exprText(e) {
      switch (e.k) {
        case 'var': return e.name;
        case 'num': return String(e.v);
        case 'deref': return e.index ? exprText(e.index.a) + '[' + exprText(e.index.i) + ']' : '*' + exprText(e.e);
        case 'load': return exprText(e.e);
        case 'decay': return exprText(e.e);
        case 'member': return exprText(e.e) + (e.arrow ? '->' : '.') + e.m.name;
        case 'padd': return exprText(e.p) + (e.sub ? ' - ' : ' + ') + exprText(e.i);
        case 'cast': return exprText(e.e);
        case 'call': return exprText(e.f) + '(...)';
        case 'str': return '"..."';
      }
      return '...';
    }

    function makeAssign(op, l, r, at) {
      checkModifiable(l, at, 'assignment');
      if (l.k === 'var') l.sym.assigned = true;
      if (op === '=') {
        const rv = assignConvert(rvalue(r), l.t, 'assignment', at);
        return { k: 'assign', l, r: rv, t: Types.unqual(l.t), pos: at };
      }
      const bop = op.slice(0, -1);
      const lt = Types.unqual(l.t);
      const rv = rvalue(r);
      if ((bop === '+' || bop === '-') && lt.k === 'ptr') {
        if (!Types.isInt(rv.t)) throw err('invalid operands to binary ' + bop, at);
        checkPtrArith(lt, at);
        return { k: 'opassign', op: bop, l, r: convert(rv, T.int), t: lt, ptrStep: Types.sizeof(lt.to), pos: at };
      }
      if (!Types.isArith(lt) || !Types.isArith(rv.t)) throw err("invalid operands to binary " + bop + " (have '" + Types.str(l.t) + "' and '" + Types.str(rv.t) + "')", at);
      if (['%', '<<', '>>', '&', '|', '^'].includes(bop) && (!Types.isInt(lt) || !Types.isInt(rv.t))) throw err("invalid operands to binary " + bop + " (have '" + Types.str(l.t) + "' and '" + Types.str(rv.t) + "')", at);
      const ot = bop === '<<' || bop === '>>' ? Types.promote(lt) : Types.arith(lt, rv.t);
      const rr = convert(rv, bop === '<<' || bop === '>>' ? Types.promote(rv.t) : ot);
      if ((bop === '/' || bop === '%') && rr.k === 'num' && rr.v === 0 && Types.isInt(ot)) warn('division by zero', at);
      return { k: 'opassign', op: bop, l, r: rr, ot, t: lt, pos: at };
    }

    function makeCond(c, a, b, at) {
      c = condition(c);
      const av = rvalueOrVoid(a), bv = rvalueOrVoid(b);
      let t;
      if (Types.isArith(av.t) && Types.isArith(bv.t)) t = Types.arith(av.t, bv.t);
      else if (Types.isSU(av.t) && Types.isSU(bv.t) && Types.def(av.t) === Types.def(bv.t)) t = Types.unqual(av.t);
      else if (av.t.k === 'void' && bv.t.k === 'void') t = T.void;
      else if (av.t.k === 'ptr' && isNullConst(bv)) t = av.t;
      else if (bv.t.k === 'ptr' && isNullConst(av)) t = bv.t;
      else if (av.t.k === 'ptr' && bv.t.k === 'ptr') {
        const q = av.t.to.q | bv.t.to.q;
        if (av.t.to.k === 'void' || bv.t.to.k === 'void') t = Types.ptr(Types.qual(T.void, q));
        else {
          if (!Types.compatible(Types.unqual(av.t.to), Types.unqual(bv.t.to))) warn('pointer type mismatch in conditional expression', at);
          t = Types.ptr(Types.qual(Types.unqual(av.t.to), q));
        }
      } else if (av.t.k === 'ptr' && Types.isInt(bv.t) || bv.t.k === 'ptr' && Types.isInt(av.t)) {
        warn('pointer/integer type mismatch in conditional expression', at);
        t = av.t.k === 'ptr' ? av.t : bv.t;
      } else throw err('type mismatch in conditional expression', at);
      const r = { k: 'cond', c, a: t.k === 'void' || Types.isSU(t) ? av : convert(av, t), b: t.k === 'void' || Types.isSU(t) ? bv : convert(bv, t), t, pos: at };
      if (c.k === 'num' && r.a.k === 'num' && r.b.k === 'num') return Object.assign({}, c.v ? r.a : r.b, { pos: at });
      return r;
    }

    function checkPtrArith(pt, at) {
      if (pt.to.k === 'void') throw err("pointer of type 'void *' used in arithmetic", at);
      if (pt.to.k === 'func') throw err('pointer to a function used in arithmetic', at);
      if (!Types.isComplete(pt.to)) throw err('arithmetic on pointer to an incomplete type', at);
    }

    function makeBinary(op, l, r, at) {
      if (op === '&&' || op === '||') {
        const a = condition(l), b = condition(r);
        return fold({ k: op === '&&' ? 'logand' : 'logor', l: a, r: b, t: T.int, pos: at });
      }
      const a = rvalue(l), b = rvalue(r);
      const ta = a.t, tb = b.t;
      const bad = () => err("invalid operands to binary " + op + " (have '" + Types.str(ta) + "' and '" + Types.str(tb) + "')", at);
      if (op === '+' || op === '-') {
        if (ta.k === 'ptr' && Types.isInt(tb)) { checkPtrArith(ta, at); return { k: 'padd', p: a, i: convert(b, Types.promote(tb).k === 'uint' ? T.uint : T.int), sub: op === '-', size: Types.sizeof(ta.to), t: ta, pos: at }; }
        if (op === '+' && Types.isInt(ta) && tb.k === 'ptr') { checkPtrArith(tb, at); return { k: 'padd', p: b, i: convert(a, Types.promote(ta).k === 'uint' ? T.uint : T.int), sub: false, size: Types.sizeof(tb.to), t: tb, pos: at, swapped: true }; }
        if (op === '-' && ta.k === 'ptr' && tb.k === 'ptr') {
          if (!Types.compatible(Types.unqual(ta.to), Types.unqual(tb.to))) throw err('invalid operands to binary - (pointers to different types)', at);
          checkPtrArith(ta, at);
          return { k: 'pdiff', l: a, r: b, size: Types.sizeof(ta.to), t: T.int, pos: at };
        }
      }
      if (['<', '>', '<=', '>=', '==', '!='].includes(op)) {
        const lit = (e) => e.k === 'decay' && e.e.k === 'str';
        if ((op === '==' || op === '!=') && (lit(a) || lit(b))) warn('comparison with string literal compares addresses, not the text (use strcmp)', at);
        if (Types.isArith(ta) && Types.isArith(tb)) {
          const ct0 = Types.arith(ta, tb);
          if (Types.isInt(ct0) && !Types.isSigned(ct0) && ((op === '>=' && b.k === 'num' && b.v === 0) || (op === '<=' && a.k === 'num' && a.v === 0))) warn('comparison of unsigned expression >= 0 is always true', at);
          if (Types.isInt(ct0) && !Types.isSigned(ct0) && ((op === '<' && b.k === 'num' && b.v === 0) || (op === '>' && a.k === 'num' && a.v === 0))) warn('comparison of unsigned expression < 0 is always false', at);
          const ct = Types.arith(ta, tb);
          if (Types.isInt(ct) && !Types.isSigned(ct) && (isNegConst(a) || isNegConst(b))) warn('comparison of unsigned expression with a negative constant', at);
          else if (Types.isInt(ct) && !Types.isSigned(ct) && Types.isInt(ta) && Types.isInt(tb) && Types.isSigned(Types.promote(ta)) !== Types.isSigned(Types.promote(tb)) && a.k !== 'num' && b.k !== 'num') warn('comparison between signed and unsigned integer expressions', at);
          return fold({ k: 'bin', op, l: convert(a, ct), r: convert(b, ct), ot: ct, t: T.int, pos: at });
        }
        if (ta.k === 'ptr' && tb.k === 'ptr') {
          if (op === '==' || op === '!=') {
            if (!(ta.to.k === 'void' || tb.to.k === 'void' || Types.compatible(Types.unqual(ta.to), Types.unqual(tb.to)))) warn('comparison of distinct pointer types lacks a cast', at);
          } else if (!Types.compatible(Types.unqual(ta.to), Types.unqual(tb.to))) warn('comparison of distinct pointer types lacks a cast', at);
          return { k: 'bin', op, l: a, r: b, ot: T.uint, t: T.int, pos: at };
        }
        if (ta.k === 'ptr' && Types.isInt(tb) || tb.k === 'ptr' && Types.isInt(ta)) {
          const nul = ta.k === 'ptr' ? isNullConst(b) : isNullConst(a);
          if (!nul) warn('comparison between pointer and integer', at);
          return { k: 'bin', op, l: convert(a, T.uint), r: convert(b, T.uint), ot: T.uint, t: T.int, pos: at };
        }
        throw bad();
      }
      if (!Types.isArith(ta) || !Types.isArith(tb)) throw bad();
      if (['%', '&', '|', '^', '<<', '>>'].includes(op) && (!Types.isInt(ta) || !Types.isInt(tb))) throw bad();
      if (op === '<<' || op === '>>') {
        const lt = Types.promote(ta);
        if (b.k === 'num' && (b.v < 0 || b.v >= 32)) warn((b.v < 0 ? 'negative shift count' : 'shift count >= width of type') + ' (' + b.v + ')', at);
        return fold({ k: 'bin', op, l: convert(a, lt), r: convert(b, Types.promote(tb)), ot: lt, t: lt, pos: at });
      }
      const ct = Types.arith(ta, tb);
      if ((op === '/' || op === '%') && b.k === 'num' && b.v === 0 && Types.isInt(ct)) warn('division by zero', at);
      if (op === '&' || op === '|' || op === '^') {
        const cmp = (e) => !e.paren && (isCompare(e) || (e.folded && isCompare(e.folded)));
        if (cmp(a) || cmp(b)) warn("suggest parentheses around comparison in operand of '" + op + "' (== binds tighter than " + op + ')', at);
      }
      return fold({ k: 'bin', op, l: convert(a, ct), r: convert(b, ct), ot: ct, t: ct, pos: at });
    }
    function isCompare(e) { return e.k === 'bin' && ['<', '>', '<=', '>=', '==', '!='].includes(e.op); }
    function isNegConst(e) { return e.k === 'num' && Types.isInt(e.t) && e.v < 0 || (e.k === 'cast' && isNegConst(e.e)); }

    function makeAddr(e, at) {
      if (e.t.k === 'func' && e.k === 'var') return { k: 'decay', e, t: Types.ptr(e.t), pos: at, explicitAddr: true };
      if (e.k === 'member' && e.m.width !== undefined) throw err("cannot take address of bit-field '" + e.m.name + "'", at);
      if (!e.lv) throw err('lvalue required as unary \'&\' operand', at);
      if (e.k === 'var' && e.sym.storage === 'register') throw err("address of register variable '" + e.name + "' requested", at);
      if (e.k === 'var') e.sym.addrTaken = true;
      return { k: 'addr', e, t: Types.ptr(e.t), pos: at };
    }

    function makeDeref(e, at) {
      const v = rvalue(e);
      if (v.t.k !== 'ptr') throw err("invalid type argument of unary '*' (have '" + Types.str(v.t) + "')", at);
      const to = v.t.to;
      if (to.k === 'func') return Object.assign({}, v, { t: to, lv: false, fnDeref: true, k: 'fnderef', e: v });
      if (to.k === 'void') warn("dereferencing 'void *' pointer", at);
      return { k: 'deref', e: v, t: to, lv: to.k !== 'void', pos: at };
    }

    function makeIndex(a, i, at) {
      const av = rvalue(a), iv = rvalue(i);
      let base = av, idx = iv;
      if (Types.isInt(av.t) && iv.t.k === 'ptr') { base = iv; idx = av; }
      if (base.t.k !== 'ptr') throw err('subscripted value is neither array nor pointer', at);
      if (!Types.isInt(idx.t)) throw err('array subscript is not an integer', at);
      if (idx.t.k === 'char' && !idx.char) warn("array subscript has type 'char'", at);
      checkPtrArith(base.t, at);
      // a constant index past a known array's end is worth a warning before running
      if (base.k === 'decay' && base.e.t.k === 'array' && base.e.t.n !== null && idx.k === 'num' && (idx.v < 0 || idx.v >= base.e.t.n)) {
        warn("array index " + idx.v + " is past the end of the array (which contains " + base.e.t.n + " elements)", at);
      }
      const sum = { k: 'padd', p: base, i: convert(idx, Types.promote(idx.t).k === 'uint' ? T.uint : T.int), sub: false, size: Types.sizeof(base.t.to), t: base.t, pos: at };
      return { k: 'deref', e: sum, t: base.t.to, lv: true, pos: at, index: { a: base, i: idx } };
    }

    function makeMember(e, name, arrow, at, nt) {
      let obj = e, st;
      if (arrow) {
        const v = rvalue(e);
        if (v.t.k !== 'ptr' || !Types.isSU(v.t.to)) {
          if (Types.isSU(v.t)) throw err("invalid type argument of '->' (have '" + Types.str(v.t) + "'); did you mean '.'?", at);
          throw err("invalid type argument of '->' (have '" + Types.str(v.t) + "')", at);
        }
        st = v.t.to;
        obj = { k: 'deref', e: v, t: st, lv: true, pos: at };
      } else {
        if (!Types.isSU(e.t)) {
          if (e.t.k === 'ptr' && Types.isSU(e.t.to)) throw err("request for member '" + name + "' in something not a structure or union; did you mean '->'?", at);
          throw err("request for member '" + name + "' in something not a structure or union", at);
        }
        st = e.t;
      }
      if (!Types.isComplete(st)) throw err("dereferencing pointer to incomplete type '" + Types.str(Types.unqual(st)) + "'", at);
      const m = Types.member(st, name);
      if (!m) throw err("'" + Types.str(Types.unqual(st)) + "' has no member named '" + name + "'", nt);
      const t = Types.qual(m.type, st.q);
      return { k: 'member', e: obj, m, t, lv: !!obj.lv, arrow, pos: at, name };
    }

    function makeIncDec(op, e, post, at) {
      checkModifiable(e, at, op === '++' ? 'increment' : 'decrement');
      const t = Types.unqual(e.t);
      if (t.k === 'ptr') { checkPtrArith(t, at); return { k: 'incdec', op, post, e, t, step: Types.sizeof(t.to), pos: at }; }
      if (!Types.isArith(t)) throw err('wrong type argument to ' + (op === '++' ? 'increment' : 'decrement'), at);
      if (e.k === 'var') e.sym.assigned = true;
      return { k: 'incdec', op, post, e, t, step: 1, pos: at };
    }

    function makeCall(f, args, at) {
      let fv = rvalue(f);
      if (f.k === 'fnderef') fv = f.e;
      if (fv.t.k !== 'ptr' || fv.t.to.k !== 'func') throw err("called object" + (f.k === 'var' ? " '" + f.name + "'" : '') + ' is not a function', at);
      const ft = fv.t.to;
      const name = f.k === 'var' ? f.name : null;
      const out = [];
      if (ft.proto) {
        const np = ft.params.length;
        if (args.length < np) throw err('too few arguments to function' + (name ? " '" + name + "'" : ''), at);
        if (args.length > np && !ft.variadic) throw err('too many arguments to function' + (name ? " '" + name + "'" : ''), at);
        for (let i = 0; i < args.length; i++) {
          const a = rvalue(args[i]);
          if (i < np) {
            const pt = ft.params[i].type;
            let c;
            try { c = assignConvert(a, pt, 'argument', args[i].pos); } catch (e) {
              throw err("incompatible type for argument " + (i + 1) + (name ? " of '" + name + "'" : '') + " (expected '" + Types.str(pt) + "' but argument is of type '" + Types.str(a.t) + "')", args[i].pos);
            }
            out.push({ e: c, t: Types.unqual(pt) });
          } else {
            const pt = Types.argPromote(a.t);
            out.push({ e: Types.isSU(pt) ? a : convert(a, pt), t: pt, variadic: true });
          }
        }
        if (name && /^(printf|fprintf|sprintf|scanf|fscanf|sscanf)$/.test(name)) checkFormat(name, args, out, at);
      } else {
        for (const x of args) {
          const a = rvalue(x);
          const pt = Types.argPromote(a.t);
          out.push({ e: Types.isSU(pt) ? a : convert(a, pt), t: pt });
        }
        if (ft.params.length && ft.params.length !== args.length) warn('wrong number of arguments to old-style function' + (name ? " '" + name + "'" : ''), at);
      }
      const rt = Types.unqual(ft.ret);
      const call = { k: 'call', f: fv, args: out, t: rt, ft, pos: at, name };
      if (Types.isSU(rt)) {
        if (!Types.isComplete(rt)) throw err('calling a function with incomplete return type', at);
        if (fn) call.temp = allocTemp(rt);
      }
      return call;
    }

    /** printf/scanf format checking, like gcc -Wformat */
    function checkFormat(name, args, out, at) {
      const fi = /^[fs](printf|scanf)$/.test(name) ? 1 : 0;
      const fe = args[fi];
      let f = fe;
      while (f && (f.k === 'cast' || f.k === 'decay')) f = f.e;
      if (!f || f.k !== 'str') return;
      const scan = name.includes('scanf');
      const fmt = String.fromCharCode(...f.bytes.slice(0, -1));
      if (fmt.includes('\0')) warn('embedded \'\\0\' in format: ' + name + ' stops reading the format there', at);
      const re = scan ? /%(\*?)(\d*)([hlL]?)([diouxXeEfgGcsp%n]|\[\^?\]?[^\]]*\])/g : /%([-+ #0]*)(\*|\d+)?(?:\.(\*|\d+)?)?([hlL]?)([diouxXeEfgGcsp%n])/g;
      let m, ai = fi + 1;
      while ((m = re.exec(fmt))) {
        if (scan) {
          const conv = m[4][0] === '[' ? 's' : m[4];
          if (conv === '%') continue;
          if (m[1]) continue;
          const a = out[ai];
          if (!a) { warn("format '%" + m[0].slice(1) + "' expects a matching argument", at); return; }
          ai++;
          if (a.t.k !== 'ptr') { warn("format '" + m[0] + "' expects argument of type '" + scanWant(conv, m[3]) + "', but argument " + ai + " has type '" + Types.str(a.t) + "' (did you forget the &?)", args[ai - 1].pos); continue; }
          const want = scanType(conv, m[3]);
          if (want && !Types.compatible(Types.unqual(a.t.to), want, true) && !(want.k === 'char' && isCharType(a.t.to))) warn("format '" + m[0] + "' expects argument of type '" + scanWant(conv, m[3]) + "', but argument " + ai + " has type '" + Types.str(a.t) + "'", args[ai - 1].pos);
          continue;
        }
        const conv = m[5];
        if (conv === '%') continue;
        if (m[2] === '*') { ai++; }
        if (m[3] === '*') { ai++; }
        const a = out[ai];
        if (!a) { warn("format '" + m[0] + "' expects a matching argument", at); return; }
        ai++;
        const t = a.e.t;
        const len = m[4];
        let okk = true, want = '';
        if ('di'.includes(conv) || 'ouxXc'.includes(conv)) {
          want = conv === 'c' ? 'int' : len === 'l' ? ('di'.includes(conv) ? 'long int' : 'long unsigned int') : ('di'.includes(conv) ? 'int' : 'unsigned int');
          okk = Types.isInt(t) || (conv === 'c' && Types.isInt(t));
          if (okk && len === 'l' && !['long', 'ulong'].includes(Types.unqual(t).k) && !(a.e.k === 'num')) okk = false;
          if (okk && len !== 'l' && ['long', 'ulong'].includes(Types.unqual(t).k) && 'di'.includes(conv)) okk = false;
        } else if ('eEfgG'.includes(conv)) { want = 'double'; okk = Types.isFloat(t); }
        else if (conv === 's') { want = 'char *'; okk = t.k === 'ptr' && isCharType(t.to); }
        else if (conv === 'p') { want = 'void *'; okk = t.k === 'ptr'; }
        else if (conv === 'n') { want = 'int *'; okk = t.k === 'ptr'; }
        if (!okk) warn("format '" + m[0] + "' expects argument of type '" + want + "', but argument " + ai + " has type '" + Types.str(t) + "'", args[ai - 1].pos);
      }
      if (ai < out.length) warn('too many arguments for format', at);
    }
    function scanType(c, len) {
      if ('di'.includes(c) || c === 'n') return len === 'h' ? T.short : len === 'l' ? T.long : T.int;
      if ('ouxX'.includes(c)) return len === 'h' ? T.ushort : len === 'l' ? T.ulong : T.uint;
      if ('eEfgG'.includes(c)) return len === 'l' ? T.double : len === 'L' ? T.ldouble : T.float;
      if (c === 's' || c === 'c') return T.char;
      if (c === 'p') return Types.ptr(T.void);
      return null;
    }
    function scanWant(c, len) { const t = scanType(c, len); return t ? Types.str(Types.ptr(t)) : '?'; }

    // ---- constants ---------------------------------------------------------------------------------
    function intConst(e, what) {
      const v = constValue(rvalueOrVoid(e));
      if (typeof v !== 'number' || !Types.isInt(e.t)) throw err((what || 'expression') + ' is not an integer constant', e.pos);
      return v;
    }

    function castValue(v, t) {
      if (Types.isFloat(t)) return t.k === 'float' ? Math.fround(v) : v;
      if (t.k === 'ptr') return v >>> 0;
      if (!Types.isInt(t)) return v;
      if (!Number.isInteger(v)) v = Math.trunc(v);
      switch (Types.mkind(t)) {
        case 'i8': return (v << 24) >> 24;
        case 'u8': return v & 255;
        case 'i16': return (v << 16) >> 16;
        case 'u16': return v & 0xffff;
        case 'i32': return v | 0;
        case 'u32': return v >>> 0;
      }
      return v;
    }

    /** Fold an operation whose operands are constants */
    function fold(e) {
      const c = constNumber(e);
      if (c === null) return e;
      return { k: 'num', v: c, t: e.t, pos: e.pos, folded: e };
    }
    function constNumber(e) {
      switch (e.k) {
        case 'num': return e.v;
        case 'cast': {
          if (e.t.k === 'void') return null;
          const v = e.e.k === 'num' ? e.e.v : null;
          if (v === null) return null;
          if (e.t.k === 'ptr') return null;   // keep pointer casts visible
          if (Types.isInt(e.t) && Types.isFloat(e.e.t) && !isFinite(v)) return null;
          return castValue(v, e.t);
        }
        case 'unop': {
          if (e.e.k !== 'num') return null;
          const v = e.e.v;
          if (e.op === '-') return castValue(-v, e.t);
          if (e.op === '~') return castValue(~v, e.t);
          if (e.op === '!') return v ? 0 : 1;
          return null;
        }
        case 'bin': {
          if (e.l.k !== 'num' || e.r.k !== 'num') return null;
          return arith(e.op, e.l.v, e.r.v, e.ot, e.t);
        }
        case 'logand': if (e.l.k === 'num' && !e.l.v) return 0; if (e.l.k === 'num' && e.r.k === 'num') return e.r.v ? 1 : 0; return null;
        case 'logor': if (e.l.k === 'num' && e.l.v) return 1; if (e.l.k === 'num' && e.r.k === 'num') return e.r.v ? 1 : 0; return null;
      }
      return null;
    }
    function arith(op, a, b, ot, rt) {
      const isF = Types.isFloat(ot);
      let r;
      switch (op) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = isF ? a * b : Types.isSigned(ot) ? Math.imul(a, b) : Math.imul(a, b) >>> 0; break;
        case '/': if (!isF && b === 0) return null; r = isF ? a / b : Math.trunc(a / b); break;
        case '%': if (b === 0) return null; r = a % b; break;
        case '<<': r = a << (b & 31); break;
        case '>>': r = Types.isSigned(ot) ? a >> (b & 31) : a >>> (b & 31); break;
        case '&': r = a & b; break;
        case '|': r = a | b; break;
        case '^': r = a ^ b; break;
        case '<': return a < b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
        default: return null;
      }
      return castValue(r, rt);
    }

    /**
     * Value of a constant expression for static initializers:
     * a number, or {sym, off} / {str, off} / {fn} address constants. null when not constant.
     */
    function constValue(e) {
      switch (e.k) {
        case 'num': return e.v;
        case 'cast': {
          const v = constValue(e.e);
          if (v === null) return null;
          if (typeof v === 'object') return Types.sizeof(e.t) === 4 || e.t.k === 'ptr' ? v : null;
          return castValue(v, e.t);
        }
        case 'decay': case 'addr': return addrConst(e.e);
        case 'padd': {
          const pv = constValue(e.p), iv = constValue(e.i);
          if (pv === null || typeof iv !== 'number') return null;
          if (typeof pv === 'number') return (pv + (e.sub ? -iv : iv) * e.size) >>> 0;
          return Object.assign({}, pv, { off: pv.off + (e.sub ? -iv : iv) * e.size });
        }
        case 'unop': case 'bin': case 'logand': case 'logor': {
          const c = constNumber(Object.assign({}, e, {
            e: e.e && wrapNum(constValue(e.e), e.e.t), l: e.l && wrapNum(constValue(e.l), e.l.t), r: e.r && wrapNum(constValue(e.r), e.r.t),
          }));
          return c;
        }
        case 'cond': {
          const c = constValue(e.c);
          if (typeof c !== 'number') return null;
          return constValue(c ? e.a : e.b);
        }
      }
      return null;
    }
    function wrapNum(v, t) { return typeof v === 'number' ? { k: 'num', v, t } : { k: 'x', t }; }
    function addrConst(e) {
      switch (e.k) {
        case 'var':
          if (e.sym.storage !== 'global') return null;
          return { sym: e.sym, off: 0 };
        case 'str': return { str: e.lit, off: 0 };
        case 'member': {
          if (e.arrow) {
            const pv = constValue(e.e.e);
            if (pv === null) return null;
            if (typeof pv === 'number') return (pv + e.m.offset) >>> 0;   // offsetof
            return Object.assign({}, pv, { off: pv.off + e.m.offset });
          }
          const b = addrConst(e.e);
          if (b === null) return null;
          if (typeof b === 'number') return (b + e.m.offset) >>> 0;
          return Object.assign({}, b, { off: b.off + e.m.offset });
        }
        case 'deref': {
          const v = constValue(e.e);
          return v;
        }
      }
      return null;
    }
  }

  function parseExpression(tokens, x) { return parse(tokens, { id: '<expression>', file: '<expression>', expression: x }); }

  SEE.Parser = { parse, parseExpression, KEYWORDS };
})(SEE);
