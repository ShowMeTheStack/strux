// Running a topic's C program and recording it. The program runs on the real C89 machine; while it
// is inside the functions being animated, the state after every line is captured by the topic's own
// capture function, together with what that line allocated, freed and wrote. The player then plays
// these ticks forwards and backwards.
(function (SEE) {
  'use strict';
  const { Types, hex } = SEE;
  const D = () => SEE.Debug;

  /** Annotations in the C code: /*@ tag words *\/ at the end of a line. Returns {clean, tags: Map(line -> {tag, args})} */
  function annotations(code) {
    const tags = new Map();
    const lines = code.split('\n').map((l, i) => {
      const m = /\s*\/\*@\s*([^*]*?)\s*\*\/\s*$/.exec(l);
      if (!m) return l;
      const words = m[1].split(/\s+/).filter(Boolean);
      tags.set(i + 1, { tag: words[0] || '', args: words.slice(1) });
      return l.slice(0, m.index).replace(/\s+$/, '');
    });
    return { clean: lines.join('\n'), tags };
  }

  // ---- probing the machine ----------------------------------------------------------------------------
  /** Read program state by name: variables in any frame (newest first), then globals */
  class Probe {
    constructor(vm) { this.vm = vm; this.frames = D().frames(vm); }
    find(name, fi) {
      const fr = this.frames;
      const list = fi === undefined ? fr : [fr[fi]];
      for (const f of list) {
        if (!f) continue;
        for (let i = f.vars.length - 1; i >= 0; i--) if (f.vars[i].name === name) return { type: f.vars[i].type, addr: f.vars[i].addr, frame: f };
      }
      if (fi === undefined) {
        const g = this.vm.prog.globals.find((x) => x.cname === name && !x.system);
        if (g) return { type: g.type, addr: g.addr, frame: null };
      }
      return null;
    }
    has(name, fi) { return !!this.find(name, fi); }
    /** A scalar value (int, char, pointer...), or null when there is no such variable or it is not set yet */
    val(name, fi) {
      const v = this.find(name, fi);
      if (!v) return null;
      return this.read(v.type, v.addr);
    }
    isSet(name, fi) {
      const v = this.find(name, fi);
      return !!v && !D().uninit(this.vm, v.addr, Math.max(Types.sizeof(v.type), 1));
    }
    read(t, addr) {
      t = Types.unqual(t);
      if (t.k === 'array') return null;
      if (!this.vm.mem.mapped(addr)) return null;
      return D().read(this.vm, t, addr);
    }
    /** The value of a C expression in the newest frame (or frame fi); null if it cannot be worked out */
    ev(expr, fi) {
      try { const r = D().evaluate(this.vm, fi || 0, expr); return r.value; } catch (e) { return null; }
    }
    /** Elements of an array variable (or of the block a pointer points to), n of them */
    arr(name, n, fi) {
      const v = this.find(name, fi);
      if (!v) return null;
      let t = Types.unqual(v.type), base = v.addr;
      if (t.k === 'ptr') { base = this.read(t, v.addr); t = Types.array(t.to, n); }
      if (t.k !== 'array') return null;
      const et = Types.unqual(t.of), es = Types.sizeof(et);
      const len = n === undefined ? t.n : n;
      const out = [];
      for (let i = 0; i < len; i++) {
        const a = base + i * es;
        out.push(this.vm.mem.mapped(a) && !D().uninit(this.vm, a, es) ? D().read(this.vm, et, a) : null);
      }
      return out;
    }
    /** Address of a variable's storage */
    addr(name, fi) { const v = this.find(name, fi); return v ? v.addr : null; }
    /** Fields of the struct at address p of struct type t: {field: value} for scalar fields */
    fields(t, p) {
      t = Types.unqual(t);
      const d = Types.def(t);
      const o = {};
      for (const m of d.members || []) {
        if (!m.name) continue;
        const mt = Types.unqual(m.type);
        if (mt.k === 'array') {
          if (['char', 'schar', 'uchar'].includes(mt.of.k)) o[m.name] = this.str(p + m.offset, mt.n);
          else { o[m.name] = []; for (let i = 0; i < mt.n; i++) o[m.name].push(this.read(mt.of, p + m.offset + i * Types.sizeof(mt.of))); }
        } else if (m.width !== undefined) o[m.name] = D().bitValue(this.vm, m, p);
        else if (!Types.isSU(mt)) o[m.name] = this.read(mt, p + m.offset);
      }
      return o;
    }
    str(addr, max) {
      let s = '';
      for (let i = 0; i < (max || 256); i++) { const c = this.vm.mem.peek(1, addr + i); if (!c) break; s += String.fromCharCode(c); }
      return s;
    }
    /** The struct type a pointer variable points to */
    pointee(name) {
      const v = this.find(name);
      if (!v) return null;
      const t = Types.unqual(v.type);
      return t.k === 'ptr' ? t.to : null;
    }
    /** Is p the address of a live heap block's start? */
    live(p) {
      if (!p || !this.vm.libc) return false;
      const i = this.vm.libc.findBlock(p);
      return i >= 0 && !this.vm.libc.blocks[i].free;
    }
    freed(p) {
      if (!p || !this.vm.libc) return false;
      const i = this.vm.libc.findBlock(p);
      return i >= 0 && this.vm.libc.blocks[i].free;
    }
    /**
     * Follow pointers from a start address: nodes reachable through the given link fields.
     * Returns {nodes: Map(addr -> {addr, ...fields, links: {field: addr}}), order: [addr...]} (breadth first).
     */
    walk(start, t, links, limit) {
      const nodes = new Map(), order = [];
      const queue = [];
      for (const s of [].concat(start)) if (s) queue.push(s);
      while (queue.length && nodes.size < (limit || 400)) {
        const p = queue.shift();
        if (!p || nodes.has(p) || !this.vm.mem.mapped(p)) continue;
        const f = this.fields(t, p);
        const node = Object.assign({ addr: p, freed: this.freed(p) }, f);
        node.links = {};
        for (const l of links) node.links[l] = f[l] || 0;
        nodes.set(p, node);
        order.push(p);
        if (!node.freed) for (const l of links) if (f[l]) queue.push(f[l]);
      }
      return { nodes, order };
    }
    /** A chain: start, then follow one field; stops at NULL or when a node repeats (a cycle) */
    chain(start, t, field, limit) {
      const out = [];
      const seen = new Set();
      let p = start;
      while (p && out.length < (limit || 200)) {
        if (seen.has(p)) return { nodes: out, cycleTo: p };
        if (!this.vm.mem.mapped(p)) return { nodes: out, bad: p };
        seen.add(p);
        const f = this.fields(t, p);
        out.push(Object.assign({ addr: p, freed: this.freed(p) }, f));
        if (this.freed(p)) return { nodes: out, dangling: true };
        p = f[field];
      }
      return { nodes: out };
    }
    /** All live heap blocks holding a struct type, for nodes that nothing reaches any more */
    blocksOf(t) {
      const out = [];
      if (!this.vm.libc) return out;
      const sz = Types.sizeof(t);
      for (const b of this.vm.libc.blocks) if (!b.free && b.size === sz) out.push(b.addr);
      return out;
    }
    /** Pointer variables of a frame (or all frames) and the addresses they hold: cursors on the picture */
    pointers(names, fi) {
      const out = {};
      for (const n of names) {
        const v = this.find(n, fi);
        if (!v || Types.unqual(v.type).k !== 'ptr') continue;
        if (D().uninit(this.vm, v.addr, 4)) { out[n] = undefined; continue; }
        out[n] = this.read(v.type, v.addr);
      }
      return out;
    }
    /** The call stack as [{fn, args: {name: value}}], oldest first, user functions only */
    calls(names) {
      const out = [];
      for (let i = this.frames.length - 1; i >= 0; i--) {
        const f = this.frames[i];
        if (f.system) continue;
        const args = {};
        for (const v of f.vars) {
          if (v.kind !== 'param' && !(names && names.includes(v.name))) continue;
          const t = Types.unqual(v.type);
          if (Types.isScalar(t) && !D().uninit(this.vm, v.addr, Types.sizeof(t))) args[v.name] = this.read(t, v.addr);
        }
        out.push({ fn: f.name, args, fp: f.fp });
      }
      return out;
    }
  }

  /**
   * The memory picture at one moment, as See draws it: the user frames on the stack, newest first, with
   * every variable in scope, and the heap blocks (live and freed). Pointers say where they point.
   */
  function memSnap(vm) {
    const Dbg = D();
    const out = { frames: [], heap: [] };
    const blockType = new Map();       // heap block -> the struct/element type some pointer gives it
    for (const f of Dbg.frames(vm)) {
      if (f.system) continue;
      const vars = [];
      for (const v of f.vars) {
        const t = Types.unqual(v.type);
        let text;
        try { text = Dbg.show(vm, t, v.addr, { max: 8 }); } catch (e) { text = '?'; }
        const item = { name: v.name, type: Types.str(v.type), text, param: v.kind === 'param', addr: v.addr };
        if (t.k === 'ptr' && !Dbg.uninit(vm, v.addr, 4)) {
          const p = Dbg.read(vm, t, v.addr);
          item.ptr = p;
          const i = p && vm.libc ? vm.libc.findBlock(p) : -1;
          if (i >= 0) { const b = vm.libc.blocks[i]; item.block = b.id; if (p === b.addr && !blockType.has(b.id) && Types.unqual(t.to).k !== 'void') blockType.set(b.id, t.to); }
        }
        vars.push(item);
      }
      out.frames.push({ fn: f.name, fp: f.fp, line: f.where ? f.where.line : 0, vars });
    }
    if (vm.libc) {
      // struct fields that point at other blocks tell us their types too (a list's later nodes)
      for (let pass = 0; pass < 3; pass++) {
        for (const b of vm.libc.blocks) {
          if (!b.id || b.free || !blockType.has(b.id)) continue;
          const t = Types.unqual(blockType.get(b.id));
          if (!Types.isSU(t)) continue;
          for (const m of Types.def(t).members || []) {
            const mt = Types.unqual(m.type);
            if (mt.k !== 'ptr' || !Types.isSU(Types.unqual(mt.to))) continue;
            const p = Dbg.read(vm, mt, b.addr + m.offset);
            const i = p ? vm.libc.findBlock(p) : -1;
            if (i >= 0 && !blockType.has(vm.libc.blocks[i].id)) blockType.set(vm.libc.blocks[i].id, mt.to);
          }
        }
      }
      for (const b of vm.libc.blocks) {
        if (!b.id) continue;
        const t = blockType.get(b.id);
        let text = '', type = '';
        if (!b.free && t) {
          const et = Types.unqual(t);
          const es = Math.max(1, Types.sizeof(et));
          const n = Math.floor(b.size / es);
          type = Types.str(t) + (n > 1 ? ' [' + n + ']' : '');
          try { text = n > 1 ? Dbg.show(vm, Types.array(et, n), b.addr, { max: 8 }) : Dbg.show(vm, et, b.addr); } catch (e) { text = ''; }
        }
        out.heap.push({ id: b.id, addr: b.addr, size: b.size, free: !!b.free, type, text });
      }
    }
    return out;
  }

  /**
   * Run a program and record the animated part.
   * spec: {code, animate: [function names], capture(P, tick) -> data, input: stdin text, limit}
   * Returns {ok, errors, ticks, output, exit, fault, tags, clean}
   */
  function record(spec) {
    const ann = annotations(spec.code);
    const files = [{ path: '/strux/main.c', text: ann.clean }];
    const built = SEE.Build.build(files, () => null, {});
    if (!built.ok) return { ok: false, errors: built.errors.map((e) => (e.pos ? e.pos.line + ': ' : '') + e.message), warnings: built.warnings, ticks: [], clean: ann.clean, tags: ann.tags };
    let output = '';
    const vm = new SEE.Machine(built.prog, { write: (fd, b) => { output += SEE.unutf8(b); }, argv: ['strux'], checkOverflow: false });
    if (vm.libc) { for (const b of SEE.utf8(spec.input || '')) vm.libc.input.push(b); vm.libc.inputEOF = true; }
    const animate = new Set(spec.animate || []);
    const quiet = new Set(spec.quiet || []);
    const ticks = [];
    let pending = null;         // the line that has just started: its tick is made when the next one starts
    let events = [];            // what happens while a line runs
    let started = false;
    let frozen = false, callerLine = 0;
    const callerOf = (m) => { const fr = D().frames(m); const c = fr.find((f, i) => i > 0 && !f.system && !animate.has(f.name)); return c ? c.where.line : 0; };
    let depth0 = 0;
    let lastMem = null;          // the memory picture taken with the newest snapshot
    // every call seen while recording gets an id, so a recursion tree can be drawn: {id, fn, args, parent,
    // depth, from: first tick, to: tick at its return, ret: the value it returned}
    const callLog = [];
    let open = [];               // the calls on the stack now, oldest first
    let lastCalls = [];
    const callPath = (mem) => {
      if (!mem) return [];
      const fr = mem.frames.slice().reverse();
      const path = [];
      fr.forEach((f, k) => {
        let c = open[k];
        if (!c || c.fp !== f.fp || c.fn !== f.fn) {
          open.length = k;
          const args = {};
          for (const v of f.vars) if (v.param) args[v.name] = v.text;
          c = { id: callLog.length + 1, fn: f.fn, fp: f.fp, args, parent: k ? open[k - 1].id : 0, depth: k, from: ticks.length, to: null, ret: undefined };
          callLog.push(c);
          open[k] = c;
        }
        path.push({ id: c.id, fn: c.fn, args: c.args, line: f.line });
      });
      open.length = fr.length;
      return path;
    };
    const limit = spec.limit || 6000;
    const inScope = (fn) => !fn.system && (animate.has(fn.name) || [...vm.frames].some((f) => animate.has(f.fn.name)) || animate.has('*'));
    vm.on('heap', (kind, blk) => { if (started) events.push({ kind, addr: blk.addr, size: blk.size }); });
    vm.mem.onWrite = (addr, n) => { if (started) events.push({ kind: 'write', addr, n }); };
    vm.mem.watching = true;
    const snap = (line, fnName, tag) => {
      const P = new Probe(vm);
      let data = null;
      try { data = spec.capture(P, { line, fn: fnName, tag }); } catch (e) { data = { error: e.message }; }
      try { lastMem = memSnap(vm); } catch (e) { lastMem = null; }
      lastCalls = callPath(lastMem);
      return data;
    };
    const flush = () => {
      if (!pending) return;
      const t = ann.tags.get(pending.line);
      const last = ticks[ticks.length - 1];
      // one line can hold several statements (int a = 1, b = 2;): they make one tick
      if (last && pending.sameAs === last && last.line === pending.line && last.fn === pending.fn && !last.first) {
        last.events = last.events.concat(events);
        last.data = snap(pending.line, pending.fn, last.tag);
        last.mem = lastMem;
        last.calls = lastCalls;
        events = [];
        pending = null;
        return;
      }
      ticks.push({ line: pending.line, fn: pending.fn, depth: pending.depth, end: !!pending.end, tag: t ? t.tag : '', args: t ? t.args : [], events, data: snap(pending.line, pending.fn, t ? t.tag : ''), mem: lastMem, calls: lastCalls });
      events = [];
      pending = null;
    };
    vm.debug = true;
    vm.stmtHook = (m, id) => {
      const fn = m.fn;
      if (fn.system) return false;
      if (quiet.has(fn.name)) return false;   // helpers like swap run inside their caller's step
      const s = fn.stmts[id];
      const live = inScope(fn);
      if (!started && live) {
        started = true;
        depth0 = m.frames.length;
        events = [];
        callerLine = callerOf(m);
        ticks.push({ line: fn.pos.line, fn: fn.name, depth: 0, tag: 'enter', args: [], events: [], data: snap(fn.pos.line, fn.name, 'enter'), mem: lastMem, calls: lastCalls, first: true });
      }
      if (!started) return false;
      if (frozen && !live) return false;
      if (frozen && live) { frozen = false; callerLine = callerOf(m); }
      const wasPending = pending;
      flush();
      if (!live) {
        // back in the caller, whose line has now finished: one last picture, then wait for another call
        ticks.push({ line: callerLine || s.line, fn: fn.name, depth: 0, tag: 'after', args: [], events, data: snap(callerLine || s.line, fn.name, 'after'), mem: lastMem, calls: lastCalls, after: true });
        events = [];
        frozen = true;
        return false;
      }
      pending = { line: s.line, fn: fn.name, depth: m.frames.length - depth0, end: s.kind === 'end', sameAs: wasPending && wasPending.line === s.line && wasPending.fn === fn.name ? ticks[ticks.length - 1] : null };
      if (ticks.length >= limit) return true;
      return false;
    };
    // a return line's picture is taken as soon as the function has returned, before the caller goes on
    // the return line's picture is taken while the function's frame is still there, so its locals show
    vm.preReturnHook = (m) => {
      if (started && !frozen && pending && !m.fn.system && !quiet.has(m.fn.name) && pending.fn === m.fn.name) flush();
    };
    vm.returnHook = () => {
      // the call that just returned sat one place above its caller
      let c = null;
      if (started && vm.lastReturned && !vm.lastReturned.system) {
        let n = 0;
        for (const f of D().frames(vm)) if (!f.system) n++;
        c = open[n] && open[n].fn === vm.lastReturned.name ? open[n] : null;
        if (c) open.length = n;
      }
      // a quiet helper returning is still inside its caller's line: nothing to record yet
      if (started && !frozen && pending && !(vm.lastReturned && (quiet.has(vm.lastReturned.name) || vm.lastReturned.system))) flush();
      if (c) { c.to = ticks.length - 1; c.ret = vm.ret; if (ticks.length) ticks[ticks.length - 1].ret = vm.ret; }
      return false;
    };
    let res;
    for (let k = 0; k < 400; k++) { res = vm.run(200000); if (res !== 'budget') break; }
    if (!frozen) flush();
    return {
      ok: true, ticks, output, exit: vm.exitCode, fault: vm.fault, state: vm.state, clean: ann.clean, tags: ann.tags,
      truncated: ticks.length >= limit, warnings: built.warnings, callLog,
    };
  }

  SEE.Strux = SEE.Strux || {};
  SEE.Strux.annotations = annotations;
  SEE.Strux.Probe = Probe;
  SEE.Strux.record = record;
  SEE.Strux.hex = (v) => '0x' + hex(v >>> 0).replace(/^0+(?=.{3})/, '');
})(SEE);
