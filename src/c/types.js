// C types for a 32-bit machine (ILP32): char 1, short 2, int 4, long 4, pointers 4, float 4, double 8.
(function (SEE) {
  'use strict';

  const Q_CONST = 1, Q_VOLATILE = 2;

  const BASIC = {
    void: { size: 0, align: 1 },
    char: { size: 1, align: 1, int: true, signed: true },
    schar: { size: 1, align: 1, int: true, signed: true },
    uchar: { size: 1, align: 1, int: true, signed: false },
    short: { size: 2, align: 2, int: true, signed: true },
    ushort: { size: 2, align: 2, int: true, signed: false },
    int: { size: 4, align: 4, int: true, signed: true },
    uint: { size: 4, align: 4, int: true, signed: false },
    long: { size: 4, align: 4, int: true, signed: true },
    ulong: { size: 4, align: 4, int: true, signed: false },
    float: { size: 4, align: 4, float: true },
    double: { size: 8, align: 8, float: true },
    ldouble: { size: 8, align: 8, float: true },
  };
  const RANK = { char: 1, schar: 1, uchar: 1, short: 2, ushort: 2, int: 3, uint: 3, long: 4, ulong: 4 };
  const NAMES = {
    void: 'void', char: 'char', schar: 'signed char', uchar: 'unsigned char', short: 'short', ushort: 'unsigned short',
    int: 'int', uint: 'unsigned int', long: 'long', ulong: 'unsigned long', float: 'float', double: 'double', ldouble: 'long double',
  };

  const T = {};
  for (const k of Object.keys(BASIC)) T[k] = Object.freeze({ k, q: 0 });

  let tagId = 0;
  const Types = {
    T, Q_CONST, Q_VOLATILE, BASIC, NAMES,

    ptr(to, q) { return { k: 'ptr', to, q: q || 0 }; },
    array(of, n) { return { k: 'array', of, n: n === undefined ? null : n, q: 0 }; },
    func(ret, params, variadic, proto) { return { k: 'func', ret, params: params || [], variadic: !!variadic, proto: proto !== false, q: 0 }; },
    newTag(kind, tag) {
      return { k: kind, tag: tag || null, id: ++tagId, members: null, size: 0, align: 1, complete: false, q: 0, consts: null };
    },
    /** Same type with extra qualifiers. Struct/union/enum share their definition. */
    qual(t, q) {
      if (!q || (t.q & q) === q) return t;
      if (t.k === 'array') return Object.assign({}, t, { of: Types.qual(t.of, q) });   // qualifiers on an array go to the elements
      const c = Object.assign({}, t);
      c.q = t.q | q;
      if (t.k === 'struct' || t.k === 'union' || t.k === 'enum') c.base = t.base || t;
      return c;
    },
    unqual(t) {
      if (!t.q) return t;
      if (t.base) return t.base;
      if (BASIC[t.k]) return T[t.k];
      return Object.assign({}, t, { q: 0 });
    },
    /** The definition object of a struct/union/enum (qualified copies point to it) */
    def(t) { return t.base || t; },

    isInt: (t) => !!(BASIC[t.k] && BASIC[t.k].int) || t.k === 'enum',
    isFloat: (t) => !!(BASIC[t.k] && BASIC[t.k].float),
    isArith: (t) => Types.isInt(t) || Types.isFloat(t),
    isPtr: (t) => t.k === 'ptr',
    isScalar: (t) => Types.isArith(t) || t.k === 'ptr',
    isAggregate: (t) => t.k === 'array' || t.k === 'struct' || t.k === 'union',
    isSU: (t) => t.k === 'struct' || t.k === 'union',
    isVoid: (t) => t.k === 'void',
    isFunc: (t) => t.k === 'func',
    isConst: (t) => !!(t.q & Q_CONST),
    isSigned(t) { if (t.k === 'enum') return true; const b = BASIC[t.k]; return !!(b && b.signed); },
    isUnsigned(t) { return Types.isInt(t) && !Types.isSigned(t); },
    isComplete(t) {
      if (t.k === 'void') return false;
      if (t.k === 'array') return t.n !== null && Types.isComplete(t.of);
      if (t.k === 'struct' || t.k === 'union') return Types.def(t).complete;
      if (t.k === 'enum') return true;
      return true;
    },
    /** Has a const member somewhere (so the whole struct cannot be assigned) */
    hasConstMember(t) {
      if (Types.isConst(t)) return true;
      if (t.k === 'array') return Types.hasConstMember(t.of);
      if (Types.isSU(t)) {
        const d = Types.def(t);
        return !!d.members && d.members.some((m) => Types.hasConstMember(m.type));
      }
      return false;
    },

    sizeof(t) {
      if (BASIC[t.k]) return BASIC[t.k].size;
      switch (t.k) {
        case 'ptr': return 4;
        case 'enum': return 4;
        case 'array': return t.n === null ? 0 : t.n * Types.sizeof(t.of);
        case 'struct': case 'union': return Types.def(t).size;
        case 'func': return 1;
      }
      return 0;
    },
    alignof(t) {
      if (BASIC[t.k]) return BASIC[t.k].align;
      switch (t.k) {
        case 'ptr': case 'enum': return 4;
        case 'array': return Types.alignof(t.of);
        case 'struct': case 'union': return Types.def(t).align;
      }
      return 1;
    },

    /** Lay out a struct or union; members: [{name, type, bits?, pos}] */
    layout(su, members) {
      const d = Types.def(su);
      let off = 0, align = 1, size = 0;
      let bitUnit = -1, bitUsed = 0;   // bit-fields pack into int-sized units
      const out = [];
      for (const m of members) {
        const a = Types.alignof(m.type);
        if (m.bits !== undefined && m.bits !== null) {
          align = Math.max(align, 4);
          if (d.k === 'union') { out.push(Object.assign({}, m, { offset: 0, shift: 0, width: m.bits })); size = Math.max(size, 4); continue; }
          if (m.bits === 0) { if (bitUnit >= 0) { off = bitUnit + 4; bitUnit = -1; } continue; }
          if (bitUnit < 0 || bitUsed + m.bits > 32) { off = (off + 3) & ~3; bitUnit = off; bitUsed = 0; off += 4; }
          out.push(Object.assign({}, m, { offset: bitUnit, shift: bitUsed, width: m.bits }));
          bitUsed += m.bits;
          continue;
        }
        bitUnit = -1;
        align = Math.max(align, a);
        if (d.k === 'union') { out.push(Object.assign({}, m, { offset: 0 })); size = Math.max(size, Types.sizeof(m.type)); continue; }
        off = (off + a - 1) & ~(a - 1);
        out.push(Object.assign({}, m, { offset: off }));
        off += Types.sizeof(m.type);
      }
      if (d.k === 'struct') size = off;
      size = (size + align - 1) & ~(align - 1);
      d.members = out;
      d.size = size;
      d.align = align;
      d.complete = true;
      return d;
    },
    member(t, name) {
      const d = Types.def(t);
      if (!d.members) return null;
      for (const m of d.members) {
        if (m.name === name) return m;
      }
      return null;
    },

    /** Integer promotion */
    promote(t) {
      if (t.k === 'enum') return T.int;
      if (Types.isInt(t) && RANK[t.k] < 3) return T.int;   // all of char/short fit in int
      return Types.unqual(t);
    },
    /** Usual arithmetic conversions */
    arith(a, b) {
      a = Types.promote(a); b = Types.promote(b);
      if (a.k === 'ldouble' || b.k === 'ldouble') return T.ldouble;
      if (a.k === 'double' || b.k === 'double') return T.double;
      if (a.k === 'float' || b.k === 'float') return T.float;
      if (a.k === 'ulong' || b.k === 'ulong') return T.ulong;
      if ((a.k === 'long' && b.k === 'uint') || (a.k === 'uint' && b.k === 'long')) return T.ulong;   // long cannot hold every unsigned int here
      if (a.k === 'long' || b.k === 'long') return T.long;
      if (a.k === 'uint' || b.k === 'uint') return T.uint;
      return T.int;
    },
    /** Default argument promotion (for ... and calls without a prototype) */
    argPromote(t) {
      if (t.k === 'float') return T.double;
      if (Types.isInt(t)) return Types.promote(t);
      return t;
    },

    /** Compatible types (6.1.2.6), ignoring top-level qualifiers if asked */
    compatible(a, b, ignoreQ) {
      if (a === b) return true;
      if (!ignoreQ && (a.q || 0) !== (b.q || 0)) return false;
      if (a.k === 'enum' && b.k === 'int' || a.k === 'int' && b.k === 'enum') return true;
      if (a.k !== b.k) return false;
      if (BASIC[a.k]) return true;
      switch (a.k) {
        case 'ptr': return Types.compatible(a.to, b.to);
        case 'array':
          if (a.n !== null && b.n !== null && a.n !== b.n) return false;
          return Types.compatible(a.of, b.of);
        case 'struct': case 'union': case 'enum': return Types.def(a) === Types.def(b);
        case 'func': {
          if (!Types.compatible(a.ret, b.ret)) return false;
          if (a.proto && b.proto) {
            if (a.params.length !== b.params.length || a.variadic !== b.variadic) return false;
            for (let i = 0; i < a.params.length; i++) if (!Types.compatible(Types.unqual(Types.adjustParam(a.params[i].type)), Types.unqual(Types.adjustParam(b.params[i].type)))) return false;
            return true;
          }
          const p = a.proto ? a : b.proto ? b : null;
          if (!p) return true;
          if (p.variadic) return false;
          for (const x of p.params) if (!Types.compatible(Types.argPromote(Types.unqual(x.type)), Types.unqual(x.type))) return false;
          return true;
        }
      }
      return false;
    },
    /** Composite type of two compatible types (keeps the more complete information) */
    composite(a, b) {
      if (a.k === 'array' && b.k === 'array') return a.n !== null ? a : b;
      if (a.k === 'func' && b.k === 'func') {
        if (!a.proto && b.proto) return Object.assign({}, b, { ret: Types.composite(a.ret, b.ret) });
        return Object.assign({}, a, { ret: Types.composite(a.ret, b.ret) });
      }
      return a;
    },
    /** Parameter adjustment: array -> pointer, function -> pointer to function */
    adjustParam(t) {
      if (t.k === 'array') return Types.qual(Types.ptr(t.of), t.q);
      if (t.k === 'func') return Types.ptr(t);
      return t;
    },
    decay(t) {
      if (t.k === 'array') return Types.ptr(t.of);
      if (t.k === 'func') return Types.ptr(t);
      return t;
    },

    /** Readable spelling, e.g. "char *const", "int (*)[10]", "int (*fp)(int, char *)" */
    str(t, name) {
      return spell(t, name || '').replace(/\s+/g, ' ').replace(/\* /g, '*').replace(/ \)/g, ')').replace(/\( /g, '(').replace(/ \[/g, '[').trim();
    },
    /** Value range of an integer type */
    range(t) {
      const sz = Types.sizeof(t) * 8;
      if (t.k === 'enum' || Types.isSigned(t)) return [-(2 ** (sz - 1)), 2 ** (sz - 1) - 1];
      return [0, 2 ** sz - 1];
    },
    /** Kind of machine value: i8 u8 i16 u16 i32 u32 f32 f64, or null for aggregates */
    mkind(t) {
      switch (t.k) {
        case 'char': case 'schar': return 'i8';
        case 'uchar': return 'u8';
        case 'short': return 'i16';
        case 'ushort': return 'u16';
        case 'int': case 'long': case 'enum': return 'i32';
        case 'uint': case 'ulong': case 'ptr': return 'u32';
        case 'float': return 'f32';
        case 'double': case 'ldouble': return 'f64';
      }
      return null;
    },
  };

  function qs(q) { return (q & Q_CONST ? 'const ' : '') + (q & Q_VOLATILE ? 'volatile ' : ''); }
  function baseName(t) {
    if (BASIC[t.k]) return NAMES[t.k];
    if (t.k === 'struct' || t.k === 'union' || t.k === 'enum') {
      const d = Types.def(t);
      return t.k + ' ' + (d.tag || '<anonymous>');
    }
    return '?';
  }
  function spell(t, inner) {
    switch (t.k) {
      case 'ptr': {
        const q = t.q & Q_CONST ? ' const' : '';
        const v = t.q & Q_VOLATILE ? ' volatile' : '';
        const s = '*' + q + v + (inner && (q || v) ? ' ' : '') + inner;
        return spell(t.to, t.to.k === 'array' || t.to.k === 'func' ? '(' + s + ')' : s);
      }
      case 'array': return spell(t.of, inner + '[' + (t.n === null ? '' : t.n) + ']');
      case 'func': {
        let ps;
        if (!t.proto) ps = '';
        else if (!t.params.length && !t.variadic) ps = 'void';
        else ps = t.params.map((p) => Types.str(p.type)).concat(t.variadic ? ['...'] : []).join(', ');
        return spell(t.ret, inner + '(' + ps + ')');
      }
      default:
        return qs(t.q) + baseName(t) + (inner ? ' ' + inner : '');
    }
  }

  SEE.Types = Types;
})(SEE);
