// The linker: joins translation units, resolves names (with the errors real linkers give),
// lays out text, rodata, data and bss at fixed addresses, and patches the bytecode.
(function (SEE) {
  'use strict';
  const { Types, CError } = SEE;
  const { OP } = SEE.Codegen;
  const { LOW_BASE } = SEE.MEM;

  const TEXT_BASE = LOW_BASE + 0x400;
  const align = (v, a) => Math.ceil(v / a) * a;

  /**
   * units: [{file, ast, gen, system}]  (system units are the library written in C: pulled in only when needed)
   * natives: {name: {fn, ...}}         (library functions written in JavaScript)
   * Returns the program image or throws a CError (with .all for several errors).
   */
  function link(units, natives) {
    const errors = [];
    const warnings = [];
    const lerr = (msg, pos) => errors.push(new CError(msg, pos || null));
    const lwarn = (msg, pos) => warnings.push(new CError(msg, pos || null, 'warning'));

    // ---- collect definitions ------------------------------------------------------------------------
    const defs = new Map();      // external name -> {sym, unit, kind}
    const libDefs = new Map();
    const userUnits = units.filter((u) => !u.system);
    const sysUnits = units.filter((u) => u.system);
    const fnBySym = new Map();
    for (const u of units) for (const f of u.gen.functions) fnBySym.set(f.sym, { f, u });

    const addDef = (map, u, s) => {
      const old = map.get(s.name);
      if (!old) { map.set(s.name, { sym: s, unit: u }); return; }
      if (u.system) return;
      // like gcc 10 and later: every definition counts, so two files that both define a variable clash
      if (true) {
        if (s.kind !== old.sym.kind) { lerr("'" + s.name + "' is a function in one file and a variable in another", s.pos); return; }
        lerr("multiple definition of '" + s.name + "' (first defined in " + old.unit.file + ')' + (s.kind === 'var' ? "; a header should declare it with 'extern' and one .c file define it" : ''), s.defPos || s.pos);
      }
    };
    for (const u of userUnits) {
      for (const s of u.ast.globals) {
        if (s.linkage !== 'external' || !s.defined) continue;
        addDef(defs, u, s);
      }
    }
    for (const u of sysUnits) {
      for (const s of u.ast.globals) if (s.linkage === 'external' && s.defined) addDef(libDefs, u, s);
    }

    // ---- what is needed: start from user code, pull library definitions on demand ------------------
    const needed = [];           // function entries to place
    const neededSet = new Set();
    const objects = [];          // global objects to place
    const objSet = new Set();
    const nativeUse = new Map(); // name -> callable
    const resolved = new Map();  // sym -> target ({fn} | {obj} | {native} | {str})
    const queue = [];
    const useUnit = (u) => {
      // every reference of every function in this unit, and its objects
      for (const f of u.gen.functions) if (!u.system || neededSet.has(f)) queue.push({ f, u });
    };
    // user code: every function and object is placed
    for (const u of userUnits) {
      for (const f of u.gen.functions) { needed.push({ f, u }); neededSet.add(f); }
      for (const s of u.ast.globals) if (s.kind === 'var' && s.defined && (s.linkage !== 'external' || defs.get(s.name).sym === s)) { objects.push({ s, u }); objSet.add(s); }
      useUnit(u);
    }
    const visitedFn = new Set();
    const resolveSym = (s, u, at) => {
      if (resolved.has(s)) return resolved.get(s);
      let target = null;
      if (s.linkage === 'internal' || s.linkage === 'none') {
        if (s.kind === 'func') {
          const e = fnBySym.get(s);
          if (!e) { lerr("'" + s.name + "' used but never defined", s.pos); target = { missing: true }; }
          else target = { fn: e.f, u: e.u };
        } else target = { obj: s, u };
      } else {
        const d = defs.get(s.name) || libDefs.get(s.name);
        if (d) {
          if (d.sym.kind === 'func') {
            const e = fnBySym.get(d.sym);
            target = { fn: e.f, u: e.u };
            if (s !== d.sym && !sameAcross(s.type, d.sym.type) && !d.unit.system) lwarn("'" + s.name + "' is declared in " + u.file + " as '" + Types.str(s.type) + "' but defined in " + d.unit.file + " as '" + Types.str(d.sym.type) + "'", s.pos);
          } else {
            target = { obj: d.sym, u: d.unit };
            if (s !== d.sym && !sameAcross(Types.unqual(s.type), Types.unqual(d.sym.type)) && !(s.type.k === 'array' && d.sym.type.k === 'array' && sameAcross(s.type.of, d.sym.type.of))) {
              lwarn("'" + s.name + "' is declared in " + u.file + " as '" + Types.str(s.type) + "' but defined in " + d.unit.file + " as '" + Types.str(d.sym.type) + "'", s.pos);
            }
          }
        } else if (natives[s.name]) {
          target = { native: s.name };
        } else {
          lerr("undefined reference to '" + s.name + "'" + (s.implicit ? ' (it was never declared either: check the spelling, or the #include)' : ''), at || s.pos);
          target = { missing: true };
        }
      }
      resolved.set(s, target);
      if (target.fn && !neededSet.has(target.fn)) { neededSet.add(target.fn); needed.push({ f: target.fn, u: target.u }); queue.push({ f: target.fn, u: target.u }); }
      if (target.obj && !objSet.has(target.obj)) { objSet.add(target.obj); objects.push({ s: target.obj, u: target.u }); pullObjectRefs(target.obj, target.u); }
      if (target.native) nativeUse.set(target.native, true);
      return target;
    };
    function pullObjectRefs(s, u) {
      if (!s.init) return;
      for (const e of s.init) {
        const c = e.e && e.e.constVal;
        if (c && typeof c === 'object' && c.sym) resolveSym(c.sym, u, s.pos);
      }
    }
    for (const o of objects.slice()) pullObjectRefs(o.s, o.u);
    // the startup code, the streams and errno are always part of a program
    for (const name of ['_start', '_iob', 'errno']) {
      const d = libDefs.get(name);
      if (d && !defs.has(name)) resolveSym(d.sym, d.unit, null);
    }
    while (queue.length) {
      const { f, u } = queue.shift();
      if (visitedFn.has(f)) continue;
      visitedFn.add(f);
      for (let pc = 0; pc < f.code.length; pc += opLen(f.code, pc)) {
        const op = f.code[pc];
        if (op === OP.GADDR || op === OP.FADDR || op === OP.CALL) {
          const r = u.gen.refs[f.code[pc + 1]];
          if (r.kind === 'sym') resolveSym(r.sym, u, f.stmts.length ? posOfPc(f, pc) : r.sym.pos);
        }
      }
    }
    if (!defs.has('main')) lerr("undefined reference to 'main' (every C program needs a function called main)", null);
    if (errors.length) { const e = errors[0]; e.all = errors; e.warnings = warnings; throw e; }

    // ---- layout -----------------------------------------------------------------------------------
    const functions = [];
    const callables = [];        // index -> {fn} | {native}
    let addr = TEXT_BASE;
    // user functions first, in file order; then library functions
    needed.sort((a, b) => (a.u.system ? 1 : 0) - (b.u.system ? 1 : 0));
    for (const { f, u } of needed) {
      const size = align(Math.max(16, f.code.length), 16);
      const fn = Object.assign({}, f, { addr, size, unitFile: u.file, system: !!u.system, index: functions.length });
      fn.code = f.code.slice();
      functions.push(fn);
      f.linked = fn;
      addr += size;
    }
    const nativeList = [];
    for (const name of [...nativeUse.keys()].sort()) {
      nativeList.push({ name, addr, native: natives[name] });
      addr += 16;
    }
    const textEnd = addr;
    for (const fn of functions) callables.push({ fn });
    for (const n of nativeList) { n.index = callables.length; callables.push({ native: n }); }
    const byAddr = new Map();
    for (const c of callables) byAddr.set(c.fn ? c.fn.addr : c.native.addr, c);

    // rodata: string literals and const objects with initializers
    const strAddr = new Map();
    let ro = align(textEnd, 16);
    const roStart = ro;
    const image = [];            // [{addr, bytes}] initial contents
    const relocs = [];           // [{addr, target(), off}]
    const usedStrings = new Set();
    for (const { f, u } of needed) for (let pc = 0; pc < f.code.length; pc += opLen(f.code, pc)) {
      if (f.code[pc] === OP.GADDR) { const r = u.gen.refs[f.code[pc + 1]]; if (r.kind === 'str') usedStrings.add(r.lit); }
    }
    for (const o of objects) if (o.s.init) for (const e of o.s.init) { const c = e.e && e.e.constVal; if (c && typeof c === 'object' && c.str) usedStrings.add(c.str); }
    const stringList = [];
    for (const u of units) for (const lit of u.ast.strings) {
      if (!usedStrings.has(lit)) continue;
      strAddr.set(lit, ro);
      image.push({ addr: ro, bytes: Uint8Array.from(lit.bytes) });
      stringList.push({ addr: ro, size: lit.bytes.length, lit, unit: u.file });
      ro += lit.bytes.length;
    }
    const constDeep = (t) => (t.k === 'array' ? constDeep(t.of) : Types.isConst(t));
    const isRO = (s) => constDeep(s.type) && s.init && !hasMutable(s.type);
    const symAddr = new Map();
    const globals = [];
    const place = (s, u, at, section) => {
      const a = align(at, Math.max(Types.alignof(s.type), 1));
      symAddr.set(s, a);
      globals.push({ name: s.label || s.name, cname: s.name, addr: a, type: s.type, size: Types.sizeof(s.type), unit: u.file, section, sym: s, isStatic: s.linkage !== 'external', fn: s.fn || null, system: !!u.system, pos: s.defPos || s.pos });
      return a + Types.sizeof(s.type);
    };
    for (const { s, u } of objects) if (isRO(s)) ro = place(s, u, ro, 'rodata');
    const roEnd = ro;
    let data = align(roEnd, 0x1000);
    const dataStart = data;
    for (const { s, u } of objects) if (!isRO(s) && s.init && s.init.some((e) => !isZeroEntry(e))) data = place(s, u, data, 'data');
    const dataEnd = data;
    let bss = align(dataEnd, 16);
    const bssStart = bss;
    for (const { s, u } of objects) if (!symAddr.has(s)) bss = place(s, u, bss, 'bss');
    const bssEnd = bss;
    const heapStart = align(bssEnd, 0x1000);

    // initial values of objects
    for (const { s } of objects) {
      if (!s.init) continue;
      const base = symAddr.get(s);
      for (const e of s.init) {
        const c = e.e.constVal;
        const a = base + e.off;
        if (typeof c === 'number') {
          if (e.member && e.member.width !== undefined) { relocs.push({ addr: a, bits: e.member, value: c }); continue; }
          image.push({ addr: a, bytes: encode(c, e.type) });
        } else if (c && typeof c === 'object') {
          relocs.push({ addr: a, c });
        }
      }
    }
    for (const r of relocs) {
      if (r.bits) continue;
      const c = r.c;
      let target;
      if (c.str) target = strAddr.get(c.str);
      else if (c.sym) {
        const t = resolved.get(c.sym) || resolveSym(c.sym, null, null);
        target = t.fn ? t.fn.linked.addr : t.native ? nativeList.find((n) => n.name === t.native).addr : t.obj ? symAddr.get(t.obj) : 0;
      }
      image.push({ addr: r.addr, bytes: encode((target + c.off) >>> 0, Types.T.uint) });
    }
    const bitInits = relocs.filter((r) => r.bits);

    // ---- patch code --------------------------------------------------------------------------------
    for (const fn of functions) {
      const u = needed.find((x) => x.f.linked === fn).u;
      const code = fn.code;
      for (let pc = 0; pc < code.length; pc += opLen(code, pc)) {
        const op = code[pc];
        if (op === OP.GADDR || op === OP.FADDR) {
          const r = u.gen.refs[code[pc + 1]];
          let a;
          if (r.kind === 'str') a = strAddr.get(r.lit);
          else {
            const t = resolved.get(r.sym);
            a = t.fn ? t.fn.linked.addr : t.native ? nativeList.find((n) => n.name === t.native).addr : symAddr.get(t.obj);
          }
          code[pc] = OP.CONST;
          code[pc + 1] = a;
        } else if (op === OP.CALL) {
          const r = u.gen.refs[code[pc + 1]];
          const t = resolved.get(r.sym);
          code[pc + 1] = t.fn ? t.fn.linked.index : nativeList.find((n) => n.name === t.native).index;
        }
      }
    }
    const main = functions.find((f) => f.name === 'main' && !f.isStatic);
    const segments = [
      { name: 'text', lo: TEXT_BASE, hi: textEnd },
      { name: 'rodata', lo: roStart, hi: Math.max(roEnd, roStart) },
      { name: 'data', lo: dataStart, hi: dataEnd },
      { name: 'bss', lo: bssStart, hi: bssEnd },
    ];
    return {
      functions, callables, byAddr, natives: nativeList, globals, strings: stringList, image, bitInits, segments,
      heapStart, main, warnings, symAddr,
    };
  }

  /** Types in different files: a struct from another file is a different object with the same shape */
  function sameAcross(a, b) {
    if (Types.compatible(a, b)) return true;
    return Types.str(a).replace(/\[\]/g, '[?]') === Types.str(b).replace(/\[\]/g, '[?]') || (a.k === 'array' && b.k === 'array' && (a.n === null || b.n === null) && Types.str(a.of) === Types.str(b.of));
  }
  function hasMutable(t) { return false && t; }
  function isZeroEntry(e) { return typeof e.e.constVal === 'number' && e.e.constVal === 0 && !(e.member && e.member.width !== undefined); }

  function encode(v, t) {
    const n = Math.max(Types.sizeof(t), 1);
    const b = new Uint8Array(n);
    const dv = new DataView(b.buffer);
    if (t.k === 'float') dv.setFloat32(0, v, true);
    else if (t.k === 'double' || t.k === 'ldouble') dv.setFloat64(0, v, true);
    else if (n === 1) dv.setUint8(0, v & 255);
    else if (n === 2) dv.setUint16(0, v & 0xffff, true);
    else dv.setUint32(0, v >>> 0, true);
    return b;
  }

  /** Length of the instruction at pc (opcode plus operands) */
  const LEN = {};
  (function () {
    const one = ['CONST', 'LADDR', 'LOAD', 'STORE', 'STOREP', 'CVT', 'F2I', 'I2F', 'F2F', 'JMP', 'JZ', 'JNZ', 'SWITCH', 'ALLOC', 'FREE', 'STMT', 'MEMCPY', 'MEMZERO', 'PADD', 'PSUB', 'PDIFF', 'GADDR', 'FADDR', 'DECL', 'BLOCK'];
    const two = ['ARG', 'ARGCPY', 'CALLI'];
    const three = ['BFLOAD', 'BFSTORE', 'INCDEC', 'CALL'];
    for (const n of SEE.Codegen.OPNAMES) LEN[OP[n]] = 1;
    for (const n of one) LEN[OP[n]] = 2;
    for (const n of two) LEN[OP[n]] = 3;
    for (const n of three) LEN[OP[n]] = 4;
  })();
  function opLen(code, pc) { return LEN[code[pc]]; }
  function posOfPc(f, pc) {
    let id = -1;
    for (let i = 0; i <= pc; i += opLen(f.code, i)) if (f.code[i] === OP.STMT) id = f.code[i + 1];
    if (id < 0) return f.pos;
    const s = f.stmts[id];
    return { file: s.file, line: s.line, col: s.col };
  }

  SEE.Linker = { link, opLen, LEN, TEXT_BASE, encode };
})(SEE);
