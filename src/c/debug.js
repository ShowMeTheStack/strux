// Debugger support: what lives at an address, the frames and their variables, reading and
// changing values, evaluating C expressions in a frame, breakpoints, stepping and stepping back.
(function (SEE) {
  'use strict';
  const { Types, SH, MEM, hex, CError } = SEE;
  const { T } = Types;
  const KIND = SEE.Codegen.K;

  // ---- what is at an address -----------------------------------------------------------------------
  /** Path to the part of an object of type t at byte offset off: "[3]", ".born.d", "[1][2]" */
  function partPath(t, off) {
    let s = '';
    for (let guard = 0; guard < 32; guard++) {
      if (off === 0 && !Types.isAggregate(t)) return s;
      if (t.k === 'array') {
        const es = Types.sizeof(t.of) || 1;
        const i = Math.floor(off / es);
        s += '[' + i + ']';
        off -= i * es;
        t = t.of;
        continue;
      }
      if (Types.isSU(t)) {
        const d = Types.def(t);
        let best = null;
        for (const m of d.members || []) {
          if (!m.name) continue;
          const sz = Types.sizeof(m.type);
          if (off >= m.offset && off < m.offset + Math.max(sz, 1)) { best = m; break; }
        }
        if (!best) return s + ' (padding)';
        s += '.' + best.name;
        off -= best.offset;
        t = best.type;
        continue;
      }
      return s + (off ? ' (byte ' + off + ')' : '');
    }
    return s;
  }

  /** Every frame from the innermost out: {index, fn, fp, pc, vars: [{name, type, addr, kind}]} */
  function frames(vm) {
    const out = [];
    const add = (fn, fp, pc, index, sp) => {
      const vars = [];
      for (const sc of fn.scopes || []) {
        const to = sc.to < 0 ? Infinity : sc.to;
        if (!sc.params && !(pc >= sc.from && pc < to)) continue;
        for (const v of sc.vars) {
          if (v.isStaticLocal) {
            const g = vm.prog.globals.find((x) => x.sym === v);
            if (g) vars.push({ name: v.name, type: v.type, addr: g.addr, kind: 'static', sym: v });
            continue;
          }
          vars.push({ name: v.name, type: v.type, addr: (fp + v.off) >>> 0, kind: sc.params ? 'param' : 'local', sym: v, guard: v.guard });
        }
      }
      out.push({ index, fn, name: fn.name, fp, pc, vars, sp, system: !!fn.system, where: whereIn(fn, pc) });
    };
    if (!vm.fn) return out;
    add(vm.fn, vm.FP, vm.pc, vm.frames.length, vm.SP);
    for (let i = vm.frames.length - 1; i >= 0; i--) {
      const f = vm.frames[i];
      const sp = i === vm.frames.length - 1 ? vm.FP + 8 : vm.frames[i + 1].fp + 8;
      add(f.fn, f.fp, f.pc - 1, i, sp);
    }
    return out;
  }
  function whereIn(fn, pc) {
    const id = SEE.stmtAt(fn, pc);
    const s = fn.stmts[id] || { line: fn.pos.line, file: fn.pos.file };
    return { line: s.line, file: s.file, stmt: id };
  }

  /** What the byte at addr belongs to */
  function describeAddr(vm, addr) {
    addr = addr >>> 0;
    const mem = vm.mem;
    const st = mem.shadow(addr);
    // stack
    if (addr >= MEM.STACK_LO && addr < MEM.STACK_TOP) {
      for (const fr of frames(vm)) {
        for (const v of fr.vars) {
          if (v.kind === 'static') continue;
          const size = Math.max(Types.sizeof(v.type), 1);
          if (addr >= v.addr && addr < v.addr + size) {
            const path = partPath(v.type, addr - v.addr);
            return { kind: v.kind, name: v.name, path, text: (v.kind === 'param' ? 'parameter ' : '') + "'" + v.name + path + "' in " + fr.name + '()', frame: fr.index, v, offset: addr - v.addr };
          }
          if (v.guard && addr >= v.addr - 4 && addr < v.addr) {
            const n = v.type.k === 'array' ? v.type.n : 0;
            const near = "'" + v.name + "'" + (n ? ' (an array of ' + n + ' ' + plural(Types.str(v.type.of), n) + ', which starts at ' + v.name + '[0])' : '') + ' in ' + fr.name + '()';
            return { kind: 'guard', name: v.name, near, before: true, text: 'the gap just before ' + near, frame: fr.index, v };
          }
          if (v.guard && addr >= v.addr + size && addr < v.addr + size + 4) {
            const n = v.type.k === 'array' ? v.type.n : 0;
            const near = "'" + v.name + "'" + (n ? ' (an array of ' + n + ' ' + plural(Types.str(v.type.of), n) + ', so the last element is ' + v.name + '[' + (n - 1) + '])' : '') + ' in ' + fr.name + '()';
            return { kind: 'guard', name: v.name, near, text: 'the gap just past ' + near, frame: fr.index, v };
          }
        }
        if (addr >= fr.fp && addr < fr.fp + 4) return { kind: 'link', text: 'the saved frame pointer of ' + fr.name + '()', frame: fr.index };
        if (addr >= fr.fp + 4 && addr < fr.fp + 8) return { kind: 'link', text: 'the return address of ' + fr.name + '()', frame: fr.index };
      }
      if (addr >= vm.stackStart) return { kind: 'args', text: 'the program arguments and environment at the top of the stack' };
      if (addr < vm.SP) return { kind: 'dead', text: 'unused stack below the stack pointer' };
      return { kind: 'stack', text: 'stack memory (temporaries or argument space)' };
    }
    // heap
    if (vm.libc && addr >= mem.heapLo && addr < mem.brk) {
      for (const b of vm.libc.blocks) {
        if (addr >= b.addr - SEE.Libc.HDR && addr < b.addr) return { kind: 'header', text: 'the header of heap block #' + (b.id || '?') + ' (the allocator keeps the size here)', block: b };
        if (addr >= b.addr && addr < b.addr + b.cap) {
          if (b.free) return { kind: 'freed', text: 'freed heap memory (it was block #' + b.id + ')', block: b };
          const near = 'heap block #' + b.id + ' (' + b.size + ' bytes from ' + b.by + ' at line ' + (b.site ? b.site.line : '?') + ')';
          if (addr >= b.addr + b.size) return { kind: 'guard', near, text: 'past the end of ' + near, block: b };
          return { kind: 'heap', text: 'byte ' + (addr - b.addr) + ' of ' + near, block: b, offset: addr - b.addr };
        }
      }
      return { kind: 'heap', text: 'heap memory' };
    }
    // globals and string literals
    for (const g of vm.prog.globals) {
      const size = Math.max(g.size, 1);
      if (addr >= g.addr && addr < g.addr + size) {
        const path = partPath(g.type, addr - g.addr);
        return { kind: 'global', name: g.cname, path, text: (g.fn ? "static '" + g.cname + path + "' in " + g.fn + '()' : "global '" + g.cname + path + "'") + (g.system ? ' (C library)' : ''), g, offset: addr - g.addr };
      }
    }
    for (const s of vm.prog.strings) {
      if (addr >= s.addr && addr < s.addr + s.size) return { kind: 'string', text: 'the string literal ' + quoteBytes(s.lit.bytes.slice(0, -1), 24) + ' (read-only)', str: s, offset: addr - s.addr };
    }
    for (const f of vm.prog.functions) if (addr >= f.addr && addr < f.addr + f.size) return { kind: 'code', text: (addr === f.addr ? 'the start of' : 'inside') + ' function ' + f.name + '()', fn: f };
    for (const n of vm.prog.natives) if (addr >= n.addr && addr < n.addr + 16) return { kind: 'code', text: (addr === n.addr ? '' : 'inside ') + 'library function ' + n.name + '()', native: n };
    if (addr < 0x1000) return { kind: 'null', text: addr ? 'the unmapped page around NULL' : 'NULL' };
    if (st === SH.NONE) return { kind: 'none', text: 'unmapped memory' };
    return null;
  }
  const plural = (w, n) => (n === 1 ? w : w.endsWith('s') ? w : w + (w.includes('*') ? '' : 's'));

  function quoteBytes(bytes, max) {
    let s = '"';
    const n = Math.min(bytes.length, max || 64);
    for (let i = 0; i < n; i++) s += charText(bytes[i], '"');
    return s + (bytes.length > n ? '..."' : '"');
  }
  function charText(c, q) {
    const esc = { 0: '\\0', 7: '\\a', 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r', 92: '\\\\' };
    if (esc[c] !== undefined) return esc[c];
    if (String.fromCharCode(c) === q) return '\\' + q;
    if (c < 32 || c >= 127) return '\\' + c.toString(8).padStart(3, '0');
    return String.fromCharCode(c);
  }

  // ---- reading values --------------------------------------------------------------------------------
  /** Raw value of a scalar at addr (no checks), or null when unmapped */
  function read(vm, t, addr) {
    const k = Types.mkind(Types.unqual(t));
    if (!k) return null;
    return vm.mem.peek(KIND[k], addr);
  }
  /** Is any byte of [addr, addr+n) uninitialised? */
  function uninit(vm, addr, n) {
    for (let i = 0; i < n; i++) if (vm.mem.shadow(addr + i) === SH.UNINIT) return true;
    return false;
  }

  /** Short text for a value: 42, 'A' (65), 3.5, 0xbffff7c0 -> 'arr[0]', "hello", {...} */
  function show(vm, t, addr, opts) {
    opts = opts || {};
    t = Types.unqual(t);
    const size = Types.sizeof(t);
    if (!vm.mem.mapped(addr)) return '<unmapped>';
    if (t.k === 'array') {
      if (['char', 'schar', 'uchar'].includes(t.of.k)) {
        const b = vm.mem.peekBytes(addr, Math.min(Math.max(size, 1), 256)) || [];
        let end = b.indexOf(0);
        const text = quoteBytes(end >= 0 ? b.slice(0, end) : b, 40);
        return text + (end < 0 && size <= 256 ? ' (no NUL)' : '');
      }
      const n = t.n || 0;
      const parts = [];
      for (let i = 0; i < Math.min(n, opts.max || 6); i++) parts.push(show(vm, t.of, addr + i * Types.sizeof(t.of), { inner: true, max: 3 }));
      return '{' + parts.join(', ') + (n > (opts.max || 6) ? ', ...' : '') + '}';
    }
    if (Types.isSU(t)) {
      if (opts.inner) return '{...}';
      const d = Types.def(t);
      const parts = [];
      for (const m of (d.members || []).slice(0, 4)) if (m.name) parts.push(m.name + '=' + (m.width !== undefined ? String(bitValue(vm, m, addr)) : show(vm, m.type, addr + m.offset, { inner: true, max: 2 })));
      return '{' + parts.join(', ') + ((d.members || []).length > 4 ? ', ...' : '') + '}';
    }
    const v = read(vm, t, addr);
    if (v === null) return '?';
    const garbage = uninit(vm, addr, size) && !opts.noGarbage ? ' (not set)' : '';
    return scalarText(vm, t, v, opts) + garbage;
  }
  function bitValue(vm, m, base) {
    const w = vm.mem.peek(5, base + m.offset) || 0;
    let x = m.width === 32 ? w : (w >>> m.shift) & ((1 << m.width) - 1);
    if (Types.isSigned(m.type) && m.width < 32 && (x & (1 << (m.width - 1)))) x -= 1 << m.width;
    return x;
  }
  function scalarText(vm, t, v, opts) {
    opts = opts || {};
    if (t.k === 'char' || t.k === 'schar' || t.k === 'uchar') return v + " '" + charText(v & 255, "'") + "'";
    if (Types.isFloat(t)) return floatText(v, t.k === 'float');
    if (t.k === 'enum') {
      const d = Types.def(t);
      const c = (d.consts || []).find((x) => x[1] === v);
      return c ? c[0] + ' (' + v + ')' : String(v);
    }
    if (t.k === 'ptr') {
      if (v === 0) return 'NULL';
      let s = '0x' + hex(v);
      if (opts.inner) return s;
      if (t.to.k === 'func') {
        const f = vm.prog.byAddr.get(v);
        return s + (f ? ' -> ' + (f.fn ? f.fn.name : f.native.name) + '()' : ' (not a function)');
      }
      if (['char', 'schar', 'uchar'].includes(Types.unqual(t.to).k) && vm.mem.mapped(v)) {
        const b = [];
        for (let i = 0; i < 40; i++) { const c = vm.mem.peek(1, v + i); if (c === null || c === 0) break; b.push(c); }
        const st = vm.mem.shadow(v);
        if (st !== SH.NONE && st !== SH.FREED) return s + ' ' + quoteBytes(b, 32);
      }
      const d = describeAddr(vm, v);
      if (d && d.name) return s + ' -> ' + d.name + (d.path || '');
      if (d && d.kind === 'heap' && d.block) return s + ' -> heap #' + d.block.id + (d.offset ? '+' + d.offset : '');
      if (d && d.kind === 'freed') return s + ' (freed!)';
      if (d && d.kind === 'dead') return s + ' (dangling)';
      return s;
    }
    return String(v);
  }
  function floatText(v, single) {
    if (!isFinite(v)) return v !== v ? 'nan' : v > 0 ? 'inf' : '-inf';
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toFixed(1);
    const s = single ? String(+v.toPrecision(7)) : String(+v.toPrecision(15));
    return s;
  }

  /** Children of an aggregate or the target of a pointer, for the drill-down tree */
  function children(vm, t, addr, opts) {
    opts = opts || {};
    t = Types.unqual(t);
    const out = [];
    if (t.k === 'array') {
      const es = Types.sizeof(t.of);
      const n = t.n || 0;
      const from = opts.from || 0, to = Math.min(n, from + (opts.limit || 100));
      for (let i = from; i < to; i++) out.push({ name: '[' + i + ']', type: t.of, addr: addr + i * es });
      if (to < n) out.push({ more: true, from: to, n });
      return out;
    }
    if (Types.isSU(t)) {
      for (const m of Types.def(t).members || []) {
        if (!m.name) continue;
        out.push({ name: '.' + m.name, type: Types.qual(m.type, t.q), addr: addr + m.offset, bits: m.width !== undefined ? m : null });
      }
      return out;
    }
    if (t.k === 'ptr') {
      const v = read(vm, t, addr);
      if (!v || t.to.k === 'void' || t.to.k === 'func' || !Types.isComplete(t.to) || !vm.mem.mapped(v)) return out;
      const st = vm.mem.shadow(v);
      if (st === SH.NONE || st === SH.FREED) return out;
      // a pointer into a heap block shows the whole block as an array when it fits
      const d = describeAddr(vm, v);
      const es = Types.sizeof(t.to);
      if (d && d.block && !d.block.free && es && d.offset === 0 && d.block.size >= 2 * es && d.block.size % es === 0) {
        out.push({ name: '*', type: Types.array(t.to, d.block.size / es), addr: v, heapArray: true });
        return out;
      }
      out.push({ name: '*', type: t.to, addr: v });
      return out;
    }
    return out;
  }
  const hasChildren = (vm, t, addr) => children(vm, t, addr, { limit: 1 }).length > 0;

  // ---- changing values -------------------------------------------------------------------------------
  /**
   * Parse text typed by the user as a value of type t and store it at addr.
   * Accepts C literals: 42, -7, 0x1f, 'A', '\n', 3.5, 1e3, NULL, &name, name, or any C expression in the frame.
   */
  function setValue(vm, t, addr, text, frameIndex, bits) {
    if (Types.isConst(t)) throw new CError("this is const: C does not let the program change it, so the debugger does not either");
    const u = Types.unqual(t);
    text = String(text).trim();
    if (u.k === 'array' && ['char', 'schar', 'uchar'].includes(u.of.k) && /^".*"$/.test(text)) {
      const b = SEE.Lexer.decodeEscapes(text.slice(1, -1), null, []);
      if (b.length + 1 > u.n) throw new CError('the array holds ' + u.n + ' chars: that string needs ' + (b.length + 1) + ' with its NUL');
      vm.mem.pokeBytes(addr, Uint8Array.from(b.concat([0])));
      return;
    }
    if (!Types.isScalar(u)) throw new CError('change the parts of a ' + (u.k === 'array' ? 'array' : u.k) + ' one at a time');
    const r = evaluate(vm, frameIndex === undefined ? 0 : frameIndex, text);
    let v = r.value;
    if (r.type.k === 'array' || r.type.k === 'func') v = r.addr;
    if (Types.isArith(u) && !Types.isArith(r.type) && !(Types.isInt(u) && r.type.k === 'ptr')) throw new CError("cannot store a '" + Types.str(r.type) + "' in a '" + Types.str(u) + "'");
    if (u.k === 'ptr' && Types.isFloat(r.type)) throw new CError('a pointer cannot hold a floating value');
    v = convertValue(v, r.type, u);
    if (bits) {
      const w = vm.mem.peek(5, addr) || 0;
      const mask = (bits.width === 32 ? 0xffffffff : (1 << bits.width) - 1) >>> 0;
      const nw = ((w & ~(mask << bits.shift)) | ((v & mask) << bits.shift)) >>> 0;
      vm.mem.poke(5, addr, nw);
      return;
    }
    vm.mem.poke(KIND[Types.mkind(u)], addr, v);
  }
  function convertValue(v, from, to) {
    const k = Types.mkind(to);
    if (Types.isFloat(to)) return k === 'f32' ? Math.fround(v) : v;
    if (Types.isFloat(from)) v = Math.trunc(v);
    return SEE.vmNorm(KIND[k], v);
  }

  // ---- C expressions in a frame ----------------------------------------------------------------------
  /** Evaluate a C expression as if written in frame `fi` (0 = innermost). Returns {type, value, addr, lv} */
  function evaluate(vm, fi, text) {
    const fr = frames(vm)[fi || 0];
    // the macros of the file this frame's function is in (NULL, EOF, the program's own #defines)
    const unit = fr && (vm.prog.units || []).find((u) => u.file === fr.fn.unitFile);
    const macros = unit ? unit.macros : (vm.prog.units && vm.prog.units[0] ? vm.prog.units[0].macros : null);
    const toks = SEE.Cpp.preprocess(text, '<expression>', { read: () => null, macros, defines: macros ? {} : { NULL: '((void *)0)', EOF: '(-1)' } }).tokens;
    if (!toks.length) throw new CError('type an expression, like x or p->next or a[i] * 2');
    const lookup = (name) => {
      if (fr) {
        // innermost declaration wins: later scopes come later in the list
        for (let i = fr.vars.length - 1; i >= 0; i--) {
          const v = fr.vars[i];
          if (v.name === name) return { kind: 'var', name, type: v.type, storage: 'global', addr: v.addr, used: true, register: false };
        }
      }
      const unitFile = fr ? fr.fn.unitFile : null;
      const g = vm.prog.globals.find((x) => x.cname === name && !x.fn && (!x.isStatic || x.unit === unitFile) && !x.system)
        || vm.prog.globals.find((x) => x.cname === name && !x.fn);
      if (g) return { kind: 'var', name, type: g.type, storage: 'global', addr: g.addr };
      const f = vm.prog.functions.find((x) => x.name === name);
      if (f) return { kind: 'func', name, type: f.type, storage: 'global', addr: f.addr };
      const n = vm.prog.natives.find((x) => x.name === name);
      if (n) return { kind: 'func', name, type: Types.func(T.int, [], false, false), storage: 'global', addr: n.addr };
      // enum constants and typedefs of the program's units
      for (const u of vm.prog.units || []) {
        for (const c of enumConsts(u)) if (c.name === name) return c;
      }
      return null;
    };
    const tags = (name) => {
      for (const u of vm.prog.units || []) {
        const t = u.ast.tags && u.ast.tags.get(name);
        if (t) return t;
      }
      return null;
    };
    const typedefs = (name) => {
      for (const u of vm.prog.units || []) {
        const t = u.ast.typedefs && u.ast.typedefs.get(name);
        if (t) return t;
      }
      return null;
    };
    const r = SEE.Parser.parseExpression(toks, { lookup, tags, typedefs });
    return new Evaluator(vm).eval(r);
  }
  function enumConsts(u) {
    if (!u.ast.enumConsts) return [];
    return u.ast.enumConsts;
  }

  class Evaluator {
    constructor(vm) { this.vm = vm; this.mem = vm.mem; }
    fail(msg) { throw new CError(msg); }
    eval(e) {
      const t = e.t;
      if (e.lv || Types.isSU(t) || t.k === 'array') {
        const a = this.addr(e);
        let value = null;
        if (Types.isScalar(t) && !(e.k === 'member' && e.m.width !== undefined)) {
          if (!this.mem.mapped(a)) this.fail('0x' + hex(a) + ' is not a valid address');
          value = read(this.vm, t, a);
        } else if (e.k === 'member' && e.m.width !== undefined) value = bitValue(this.vm, e.m, a - e.m.offset);
        return { type: t, value, addr: a, lv: true, bits: e.k === 'member' && e.m.width !== undefined ? e.m : null };
      }
      return { type: t, value: this.val(e), lv: false };
    }
    addr(e) {
      switch (e.k) {
        case 'var': return e.sym.addr;
        case 'deref': {
          const p = this.val(e.e);
          if (!p) this.fail('that pointer is NULL');
          if (!this.mem.mapped(p)) this.fail('the pointer holds 0x' + hex(p) + ', which is not a valid address');
          return p;
        }
        case 'member': return (this.addr(e.e) + e.m.offset) >>> 0;
        case 'load': return this.addr(e.e);
        case 'str': this.fail('string literals cannot be used here');
      }
      this.fail('that expression has no address');
    }
    load(t, a) {
      if (!this.mem.mapped(a)) this.fail('0x' + hex(a) + ' is not a valid address');
      return read(this.vm, t, a);
    }
    val(e) {
      const N = SEE.vmNorm;
      switch (e.k) {
        case 'num': return e.v;
        case 'load': {
          const x = e.e;
          if (x.k === 'member' && x.m.width !== undefined) return bitValue(this.vm, x.m, this.addr(x.e));
          if (Types.isSU(x.t)) return this.addr(x);
          return this.load(x.t, this.addr(x));
        }
        case 'decay': {
          if (e.e.k === 'var' && e.e.sym.kind === 'func') return e.e.sym.addr;
          if (e.e.k === 'fnderef') return this.val(e.e.e);
          return this.addr(e.e);
        }
        case 'addr': return this.addr(e.e);
        case 'fnderef': return this.val(e.e);
        case 'cast': {
          if (e.t.k === 'void') { this.val(e.e); return 0; }
          const v = this.val(e.e);
          if (Types.isSU(e.t)) return v;
          if (e.t.k === 'ptr') return v >>> 0;
          return convertValue(v, e.e.t, e.t);
        }
        case 'unop': {
          const v = this.val(e.e);
          if (e.op === '-') return Types.isFloat(e.t) ? -v : N(KIND[Types.mkind(e.t)], -v);
          if (e.op === '~') return N(KIND[Types.mkind(e.t)], ~v);
          return v ? 0 : 1;
        }
        case 'bin': {
          const a = this.val(e.l), b = this.val(e.r);
          const ot = e.ot;
          const f = Types.isFloat(ot);
          const k = KIND[Types.mkind(e.t)];
          switch (e.op) {
            case '+': return f ? a + b : N(k, a + b);
            case '-': return f ? a - b : N(k, a - b);
            case '*': return f ? a * b : N(k, Types.isSigned(ot) ? Math.imul(a, b) : Math.imul(a, b) >>> 0);
            case '/': if (!f && b === 0) this.fail('division by zero'); return f ? a / b : N(k, Math.trunc(a / b));
            case '%': if (b === 0) this.fail('division by zero'); return N(k, a % b);
            case '<<': return N(k, a << b);
            case '>>': return Types.isSigned(ot) ? a >> b : a >>> b;
            case '&': return N(k, a & b);
            case '|': return N(k, a | b);
            case '^': return N(k, a ^ b);
            case '<': return a < b ? 1 : 0;
            case '>': return a > b ? 1 : 0;
            case '<=': return a <= b ? 1 : 0;
            case '>=': return a >= b ? 1 : 0;
            case '==': return a === b ? 1 : 0;
            case '!=': return a !== b ? 1 : 0;
          }
          break;
        }
        case 'padd': return (this.val(e.p) + (e.sub ? -1 : 1) * this.val(e.i) * e.size) >>> 0;
        case 'pdiff': return ((this.val(e.l) - this.val(e.r)) / e.size) | 0;
        case 'logand': return this.val(e.l) && this.val(e.r) ? 1 : 0;
        case 'logor': return this.val(e.l) || this.val(e.r) ? 1 : 0;
        case 'cond': return this.val(e.c) ? this.val(e.a) : this.val(e.b);
        case 'comma': this.val(e.l); return this.val(e.r);
        case 'assign': {
          const a = this.addr(e.l);
          if (Types.isSU(e.t)) { const src = this.val(e.r); this.vm.mem.pokeBytes(a, this.vm.mem.peekBytes(src, Types.sizeof(e.t))); return a; }
          const v = this.val(e.r);
          this.store(e.l, a, v);
          return v;
        }
        case 'opassign': case 'incdec': {
          const l = e.k === 'incdec' ? e.e : e.l;
          const a = this.addr(l);
          const old = l.k === 'member' && l.m.width !== undefined ? bitValue(this.vm, l.m, a - l.m.offset) : this.load(l.t, a);
          let nv;
          if (e.k === 'incdec') nv = old + (e.op === '++' ? 1 : -1) * e.step;
          else if (e.ptrStep !== undefined) nv = old + (e.op === '-' ? -1 : 1) * this.val(e.r) * e.ptrStep;
          else {
            const b = this.val(e.r);
            const fake = { k: 'bin', op: e.op, l: { k: 'num', v: old, t: e.ot }, r: { k: 'num', v: b, t: e.ot }, ot: e.ot, t: e.ot };
            nv = this.val(fake);
          }
          nv = convertValue(nv, Types.isFloat(l.t) ? l.t : T.int, Types.unqual(l.t));
          this.store(l, a, nv);
          return e.k === 'incdec' && e.post ? old : nv;
        }
        case 'call': this.fail('function calls are not run from the debugger (they could change the program)');
        case 'member': case 'var': case 'deref': return this.load(e.t, this.addr(e));
      }
      this.fail('cannot evaluate that here');
    }
    store(l, a, v) {
      if (l.k === 'member' && l.m.width !== undefined) {
        const base = a;
        const w = this.mem.peek(5, base) || 0;
        const mask = (l.m.width === 32 ? 0xffffffff : (1 << l.m.width) - 1) >>> 0;
        this.mem.poke(5, base, ((w & ~(mask << l.m.shift)) | ((v & mask) << l.m.shift)) >>> 0);
        return;
      }
      this.mem.poke(KIND[Types.mkind(Types.unqual(l.t))], a, v);
    }
  }

  // ---- the debugger ----------------------------------------------------------------------------------
  /**
   * Drives a machine for the studio: run, pause, step into/over/out, step back, breakpoints, watchpoints.
   * Events: 'stop' {reason, ...}, 'running', 'output', 'exit', 'fault', 'input'
   */
  class Debugger extends SEE.Emitter {
    constructor(vm, opts) {
      super();
      this.vm = vm;
      this.opts = opts || {};
      this.breakpoints = new Map();   // "file:line" -> {file, line, cond, enabled, hits}
      this.watchpoints = [];          // {expr, addr, size, type, old, frameFp}
      this.mode = null;               // null | 'into' | 'over' | 'out' | 'run'
      this.history = [];              // checkpoints for stepping back
      this.maxHistory = this.opts.maxHistory || 100000;
      this.pauseRequested = false;
      this.recording = this.opts.record !== false;
      vm.debug = true;
      vm.stmtHook = (m, id) => this.hook(m, id);
      vm.returnHook = (m) => this.onReturn(m, m.lastReturned, m.ret);
      if (this.recording) vm.mem.journal = new SEE.Journal(vm.mem, this.opts.journalLimit || 6000000);
      vm.mem.onWrite = (addr, n) => this.onWrite(addr, n);
      this.resolveAll();
    }

    // ---- breakpoints
    key(file, line) { return file + ':' + line; }
    setBreakpoint(file, line, opts) {
      const k = this.key(file, line);
      const bp = Object.assign({ file, line, cond: '', enabled: true, hits: 0 }, this.breakpoints.get(k) || {}, opts || {});
      this.breakpoints.set(k, bp);
      this.resolveAll();
      return bp;
    }
    clearBreakpoint(file, line) { this.breakpoints.delete(this.key(file, line)); this.resolveAll(); }
    /** Map each breakpoint to statements; a line without code moves to the next line that has some */
    resolveAll() {
      for (const f of this.vm.prog.functions) f.bps = null;
      for (const bp of this.breakpoints.values()) {
        bp.at = null;
        let best = null;
        for (const f of this.vm.prog.functions) {
          if (f.system) continue;
          f.stmts.forEach((s, id) => {
            if (s.file !== bp.file || s.line < bp.line) return;
            if (s.kind === 'end' && s.line !== bp.line) return;
            if (!best || s.line < best.line) best = { f, line: s.line, ids: [id] };
            else if (best.f === f && s.line === best.line) best.ids.push(id);
            else if (s.line === best.line) best.more = (best.more || []).concat([{ f, id }]);
          });
        }
        if (!best || best.line - bp.line > 40) { bp.at = null; continue; }
        bp.at = best.line;
        const add = (f, id) => { (f.bps || (f.bps = new Map())).set(id, bp); };
        for (const id of best.ids) add(best.f, id);
        for (const m of best.more || []) add(m.f, m.id);
      }
    }

    // ---- watchpoints
    addWatchpoint(expr, frameIndex) {
      const r = evaluate(this.vm, frameIndex || 0, expr);
      if (!r.lv) throw new CError("'" + expr + "' is not something stored in memory, so it cannot be watched");
      const size = Math.max(1, Types.sizeof(r.type));
      const w = { expr, addr: r.addr, size, type: r.type, old: this.vm.mem.peekBytes(r.addr, size), bits: r.bits };
      this.watchpoints.push(w);
      this.vm.mem.watching = true;
      return w;
    }
    removeWatchpoint(w) { this.watchpoints = this.watchpoints.filter((x) => x !== w); this.vm.mem.watching = this.watchpoints.length > 0; }
    onWrite(addr, n) {
      for (const w of this.watchpoints) {
        if (addr < w.addr + w.size && w.addr < addr + n) {
          const now = this.vm.mem.peekBytes(w.addr, w.size);
          // compare after the store lands, at the next statement
          this.pendingWatch = this.pendingWatch || [];
          if (!this.pendingWatch.includes(w)) this.pendingWatch.push(w);
          void now;
        }
      }
    }

    // ---- the hook at every statement
    hook(vm, id) {
      const fn = vm.fn;
      if (this.recording) this.checkpoint(id);
      if (this.pendingWatch) {
        const hits = [];
        for (const w of this.pendingWatch) {
          const now = vm.mem.peekBytes(w.addr, w.size);
          if (!sameBytes(now, w.old)) { hits.push({ w, before: w.old, after: now }); w.old = now; }
        }
        this.pendingWatch = null;
        if (hits.length) { this.stopInfo = { reason: 'watch', hits }; return true; }
      }
      if (this.pauseRequested) { this.pauseRequested = false; this.stopInfo = { reason: 'pause' }; return true; }
      if (fn.bps) {
        const bp = fn.bps.get(id);
        if (bp && bp.enabled) {
          let ok = true;
          if (bp.cond) {
            try { ok = !!evaluate(vm, 0, bp.cond).value; } catch (e) { ok = true; bp.condError = e.message; }
          }
          if (ok) { bp.hits++; this.stopInfo = { reason: 'breakpoint', bp }; return true; }
        }
      }
      const depth = vm.frames.length;
      if (fn.system && !this.opts.intoLibrary && this.mode !== 'run') return false;
      const s = fn.stmts[id];
      // a new line, another frame, or the very statement we started from, coming round again in a loop
      let moved = s.line !== this.startLine || fn !== this.startFn || depth !== this.startDepth || (id === this.startStmt && depth === this.startDepth && fn === this.startFn);
      // a loop written on one line (for (;;) { n++; }) would never leave it: stop after a long while
      if (!moved && (this.mode === 'over' || this.mode === 'into') && ++this.sameLine > 200000) { this.stopInfo = { reason: 'step', longLine: true }; return true; }
      switch (this.mode) {
        case 'stmt': this.stopInfo = { reason: 'step' }; return true;
        case 'into':
          if (moved) { this.stopInfo = { reason: 'step' }; return true; }
          return false;
        case 'over':
          if (depth < this.startDepth || (depth === this.startDepth && moved)) { this.stopInfo = { reason: 'step' }; return true; }
          return false;
        case 'out':
          if (depth < this.startDepth) { this.stopInfo = { reason: 'step' }; return true; }
          return false;
        case 'start':
          this.stopInfo = { reason: 'start' };
          return true;
      }
      return false;
    }

    /** After a function returns: stepping that leaves a function stops in the caller, mid-line */
    onReturn(vm, fn, value) {
      if (!this.mode || this.mode === 'run' || this.mode === 'start') return false;
      if (vm.frames.length >= this.startDepth || vm.fn.system) return false;
      if (this.recording) this.checkpoint(-1);
      this.stopInfo = { reason: 'return', from: fn.name, value, type: fn.type.ret };
      return true;
    }

    checkpoint(id) {
      const vm = this.vm;
      const h = this.history;
      h.push({
        fn: vm.fn, pc: vm.pc, code: vm.code, FP: vm.FP, SP: vm.SP, depth: vm.frames.length, sBase: vm.frames.length ? vm.frames[vm.frames.length - 1].sb : 0,
        S: vm.S.slice(vm.frames.length ? vm.frames[vm.frames.length - 1].sb : 0), want: vm.want, retAddr: vm.retAddr, argBytes: vm.argBytes,
        mark: vm.mem.journal.mark(), steps: vm.steps, ops: vm.ops, out: this.opts.outputMark ? this.opts.outputMark() : 0, stmt: vm.mem.stmt, id,
        input: vm.libc ? vm.libc.input.slice() : null, inputEOF: vm.libc ? vm.libc.inputEOF : false, brk: vm.mem.brk,
      });
      if (h.length > this.maxHistory + 20000) h.splice(0, h.length - this.maxHistory);   // trim in chunks: one at a time is slow
    }
    canStepBack() { return this.history.length > 1 && this.vm.state !== 'running'; }
    lineOf(c) { const st = c.fn.stmts[c.id]; return st ? st.line : -1; }
    /**
     * Step back one line in this function, the reverse of step over: to the start of the previous line
     * that ran here (calls made from it are undone too).
     */
    stepBack() {
      const h = this.history;
      // after a crash (or the end) the program stopped part way through a line: go back to its start first
      if ((this.vm.state === 'faulted' || this.vm.state === 'exited') && h.length) {
        let i = h.length - 1;
        while (i > 0 && h[i].fn.system) i--;   // past the library's exit() and friends
        return this.restore(i);
      }
      if (h.length < 2) return false;
      const cur = h[h.length - 1];
      const depth = cur.depth;
      const curLine = this.lineOf(cur);
      let i = h.length - 2;
      for (; i >= 0; i--) {
        const c = h[i];
        if (c.fn.system || c.depth > depth) continue;
        if (c.depth < depth || c.fn !== cur.fn || this.lineOf(c) !== curLine || c.id < 0) break;
      }
      if (i < 0) return false;
      // to the first statement of that line (unless it is the caller, which we land in mid-line)
      const t = h[i];
      const line = this.lineOf(t);
      while (i > 0 && t.id >= 0) {
        const p = h[i - 1];
        if (p.fn.system || p.depth > t.depth) { i--; continue; }
        if (p.fn === t.fn && p.depth === t.depth && this.lineOf(p) === line && p.id >= 0 && p.id <= h[i].id) { i--; continue; }
        break;
      }
      while (h[i].fn.system || h[i].depth > t.depth) i++;
      return this.restore(i);
    }
    /** Back exactly one statement, wherever it was (the reverse of step into) */
    stepBackStatement() {
      const h = this.history;
      if ((this.vm.state === 'faulted' || this.vm.state === 'exited') && h.length) return this.restore(h.length - 1);
      let i = h.length - 2;
      while (i > 0 && h[i].fn.system) i--;
      if (i < 0 || h[i].fn.system) return false;   // nothing of the program's own before this
      return this.restore(i);
    }
    /** Back to where the current function was called from... or simply n statements; restore checkpoint index */
    restore(index) {
      const vm = this.vm;
      const c = this.history[index];
      if (!vm.mem.journal.rewind(c.mark)) return false;
      // the journal has put the frames and the callers' operand values back; this frame's own come from the checkpoint
      vm.fn = c.fn; vm.pc = c.pc; vm.code = c.code; vm.FP = c.FP; vm.SP = c.SP;
      if (vm.frames.length !== c.depth) throw new Error('step back lost track of the frames (' + vm.frames.length + ' vs ' + c.depth + ')');
      vm.S.length = c.sBase; for (const x of c.S) vm.S.push(x);
      vm.want = c.want; vm.retAddr = c.retAddr; vm.argBytes = c.argBytes;
      vm.steps = c.steps; vm.ops = c.ops; vm.mem.stmt = c.stmt; vm.depth = vm.frames.length;
      vm.mem.brk = c.brk;
      if (vm.libc && c.input) { vm.libc.input = c.input.slice(); vm.libc.inputEOF = c.inputEOF; }
      if (vm.state === 'exited' || vm.state === 'faulted') { vm.fault = null; vm.exitCode = null; }
      vm.state = 'paused';
      this.history.length = index + 1;
      if (this.opts.outputRewind) this.opts.outputRewind(c.out);
      for (const w of this.watchpoints) w.old = vm.mem.peekBytes(w.addr, w.size);
      this.stopInfo = { reason: 'back' };
      return true;
    }
    // ---- control
    /** Start or continue running in a mode; the caller drives slices with run() */
    resume(mode) {
      const vm = this.vm;
      this.mode = mode || 'run';
      this.startDepth = vm.frames.length;
      const s = vm.fn && vm.fn.stmts[SEE.stmtAt(vm.fn, vm.pc)];
      this.startLine = s ? s.line : 0;
      this.startFn = vm.fn;
      this.sameLine = 0;
      this.startStmt = vm.fn && vm.code[vm.pc] === SEE.Codegen.OP.STMT ? vm.code[vm.pc + 1] : -1;
      if (vm.state === 'paused') vm.resumed = true;
      this.stopInfo = null;
    }
    pause() { this.pauseRequested = true; }
  }
  function sameBytes(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  SEE.Debug = {
    describeAddr, frames, partPath, show, children, hasChildren, read, setValue, evaluate, Debugger, scalarText, charText, quoteBytes, uninit, bitValue, floatText,
  };
})(SEE);
