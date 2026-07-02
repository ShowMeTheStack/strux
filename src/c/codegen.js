// Code generation: the typed tree of each function becomes bytecode for the stack machine in vm.js.
// Values live on an operand stack; variables live in simulated memory, in frames laid out like i386 cdecl.
(function (SEE) {
  'use strict';
  const { Types, CError } = SEE;
  const { T } = Types;

  const NAMES = ['NOP', 'CONST', 'LADDR', 'LOAD', 'STORE', 'STOREP', 'DUP', 'POP', 'SWAP',
    'ADD_I', 'ADD_U', 'ADD_F', 'ADD_F32', 'SUB_I', 'SUB_U', 'SUB_F', 'SUB_F32', 'MUL_I', 'MUL_U', 'MUL_F', 'MUL_F32',
    'DIV_I', 'DIV_U', 'DIV_F', 'DIV_F32', 'MOD_I', 'MOD_U', 'NEG_I', 'NEG_U', 'NEG_F', 'NEG_F32',
    'AND_I', 'AND_U', 'OR_I', 'OR_U', 'XOR_I', 'XOR_U', 'SHL_I', 'SHL_U', 'SHR_I', 'SHR_U', 'NOT_I', 'NOT_U',
    'EQ', 'NE', 'LT', 'LE', 'GT', 'GE', 'LNOT', 'BOOL',
    'CVT', 'F2I', 'I2F', 'F2F',
    'JMP', 'JZ', 'JNZ', 'SWITCH',
    'ALLOC', 'FREE', 'ARG', 'ARGCPY', 'CALL', 'CALLI', 'RET', 'RETV',
    'STMT', 'MEMCPY', 'MEMZERO', 'BFLOAD', 'BFSTORE', 'INCDEC', 'PADD', 'PSUB', 'PDIFF',
    'GADDR', 'FADDR', 'DECL', 'RETS', 'FALLOFF', 'DUP2', 'ROT3', 'BLOCK'];
  const OP = {};
  NAMES.forEach((n, i) => { OP[n] = i; });
  const K = { i8: 0, u8: 1, i16: 2, u16: 3, i32: 4, u32: 5, f32: 6, f64: 7 };

  const kindOf = (t) => {
    const m = Types.mkind(t);
    if (!m) throw new Error('no machine kind for ' + Types.str(t));
    return K[m];
  };

  /**
   * Generate code for one parsed unit.
   * Returns {functions: [{name, code, stmts, ...}], refs} where refs are symbols to be fixed by the linker:
   * GADDR/FADDR/CALL operands index unit.refs.
   */
  function generate(ast) {
    const refs = [];        // [{kind: 'sym'|'str'|'fn', sym, lit}]
    const refIndex = new Map();
    const ref = (key, r) => { if (!refIndex.has(key)) { refIndex.set(key, refs.length); refs.push(r); } return refIndex.get(key); };
    const symRef = (sym) => ref(sym, { kind: 'sym', sym });
    const strRef = (lit) => ref(lit, { kind: 'str', lit });
    const out = [];
    for (const f of ast.functions) out.push(genFunction(f));
    return { functions: out, refs };

    function genFunction(F) {
      const code = [];
      const stmts = [];            // [{line, file, col, kind}]
      const lines = new Map();     // line -> first stmt id
      const scopes = [];           // [{vars, from, to}] for the debugger
      const switchTables = [];
      let breaks = [], conts = [];
      const labels = new Map();    // name -> pc
      const gotoFix = [];          // [{at, name}]
      const emit = (...a) => { for (const x of a) code.push(x); return code.length; };
      const here = () => code.length;
      const patch = (at, v) => { code[at] = v; };
      const err = (msg, pos) => new CError(msg, pos);

      // parameters are visible over the whole body
      scopes.push({ vars: F.params, from: 0, to: -1, params: true });
      const stmt = (s, kind) => {
        const id = stmts.length;
        const pos = s.pos || F.pos;
        stmts.push({ line: pos.line, file: pos.file, col: pos.col, kind: kind || s.k, fn: F.name });
        emit(OP.STMT, id);
        if (!lines.has(pos.line)) lines.set(pos.line, id);
        return id;
      };

      genStmt(F.body, true);
      // closing brace: a stop so stepping shows the frame before it goes away
      const endId = stmts.length;
      stmts.push({ line: F.endPos.line, file: F.endPos.file, col: F.endPos.col, kind: 'end', fn: F.name });
      emit(OP.STMT, endId);
      if (F.name === 'main' && Types.unqual(F.type.ret).k !== 'void') emit(OP.CONST, 0, OP.RETV);
      else if (Types.unqual(F.type.ret).k !== 'void') emit(OP.FALLOFF);
      else emit(OP.RET);
      scopes[0].to = here();
      for (const g of gotoFix) {
        if (!labels.has(g.name)) throw err("label '" + g.name + "' used but not defined", g.pos);
        patch(g.at, labels.get(g.name));
      }
      return {
        name: F.name, code, stmts, scopes, switchTables, frameSize: F.frameSize, argBytes: F.params.reduce((a, p) => a + ((Types.sizeof(p.type) + 3) & ~3), 0) + (F.hiddenRet ? 4 : 0),
        params: F.params, locals: F.locals, type: F.type, pos: F.pos, endPos: F.endPos, unit: F.unit, sym: F.sym, isStatic: F.isStatic,
        hiddenRet: F.hiddenRet, retKind: Types.isScalar(Types.unqual(F.type.ret)) ? kindOf(Types.unqual(F.type.ret)) : -1, lines,
      };

      // ---- statements ------------------------------------------------------------------------------
      function genStmt(s, top) {
        switch (s.k) {
          case 'block': {
            const sc = { vars: s.decls.filter((v) => v.storage === 'auto' || v.storage === 'register' || v.isStaticLocal), from: here(), to: -1 };
            scopes.push(sc);
            for (const it of s.items) genStmt(it);
            sc.to = here();
            if (top) sc.to = -2;   // resolved below: function body scope covers the closing brace
            return;
          }
          case 'decl': {
            // a fresh automatic variable has no value until something is stored
            emit(OP.LADDR, s.v.off, OP.DECL, Math.max(Types.sizeof(s.v.type), 1));
            return;
          }
          case 'init': {
            stmt(s, 'decl');
            genInit(s.v, s.entries);
            return;
          }
          case 'expr': {
            stmt(s);
            genDiscard(s.e);
            return;
          }
          case 'empty': stmt(s); return;
          case 'if': {
            stmt(s);
            genCond(s.cond);
            const jz = emit(OP.JZ, 0) - 1;
            genStmt(s.then);
            if (s.else) {
              const jmp = emit(OP.JMP, 0) - 1;
              patch(jz, here());
              genStmt(s.else);
              patch(jmp, here());
            } else patch(jz, here());
            return;
          }
          case 'while': {
            const saveB = breaks, saveC = conts;
            breaks = []; conts = [];
            const top = here();
            stmt(s);
            genCond(s.cond);
            const jz = emit(OP.JZ, 0) - 1;
            genStmt(s.body);
            emit(OP.JMP, top);
            patch(jz, here());
            for (const b of breaks) patch(b, here());
            for (const c of conts) patch(c, top);
            breaks = saveB; conts = saveC;
            return;
          }
          case 'do': {
            const saveB = breaks, saveC = conts;
            breaks = []; conts = [];
            const top = here();
            stmt(s, 'do');
            genStmt(s.body);
            const condAt = here();
            stmt({ pos: Object.assign({}, s.pos, { line: s.condLine || s.pos.line }) }, 'while');
            genCond(s.cond);
            emit(OP.JNZ, top);
            for (const b of breaks) patch(b, here());
            for (const c of conts) patch(c, condAt);
            breaks = saveB; conts = saveC;
            return;
          }
          case 'for': {
            const saveB = breaks, saveC = conts;
            breaks = []; conts = [];
            stmt(s, 'for');
            if (s.init) genDiscard(s.init);
            const top = here();
            let jz = -1;
            if (s.cond) {
              stmt(s, 'for-test');
              genCond(s.cond);
              jz = emit(OP.JZ, 0) - 1;
            }
            genStmt(s.body);
            const stepAt = here();
            if (s.step) { stmt(s, 'for-step'); genDiscard(s.step); }
            emit(OP.JMP, top);
            if (jz >= 0) patch(jz, here());
            for (const b of breaks) patch(b, here());
            for (const c of conts) patch(c, stepAt);
            breaks = saveB; conts = saveC;
            return;
          }
          case 'switch': {
            const saveB = breaks;
            breaks = [];
            stmt(s);
            genExpr(s.e);
            const table = { cases: new Map(), def: -1 };
            const ti = switchTables.length;
            switchTables.push(table);
            emit(OP.SWITCH, ti);
            const saveSw = curSwitch;
            curSwitch = table;
            genStmt(s.body);
            curSwitch = saveSw;
            if (table.def < 0) table.def = here();
            for (const b of breaks) patch(b, here());
            breaks = saveB;
            return;
          }
          case 'case': {
            curSwitch.cases.set(s.c.v, here());
            genStmt(s.body);
            return;
          }
          case 'default': {
            curSwitch.def = here();
            genStmt(s.body);
            return;
          }
          case 'break': stmt(s); breaks.push(emit(OP.JMP, 0) - 1); return;
          case 'continue': stmt(s); conts.push(emit(OP.JMP, 0) - 1); return;
          case 'goto': stmt(s); gotoFix.push({ at: emit(OP.JMP, 0) - 1, name: s.label, pos: s.pos }); return;
          case 'label': labels.set(s.name, here()); genStmt(s.body); return;
          case 'return': {
            stmt(s);
            if (!s.e) { emit(OP.RET); return; }
            if (s.discard) { genDiscard(s.e); emit(OP.RET); return; }
            const rt = Types.unqual(F.type.ret);
            if (Types.isSU(rt)) {
              // copy into the caller's space (hidden first argument) and return its address
              emit(OP.LADDR, F.hiddenRet.off, OP.LOAD, K.u32);
              genExpr(s.e);
              emit(OP.MEMCPY, Types.sizeof(rt), OP.RETV);
              return;
            }
            genExpr(s.e);
            emit(OP.RETV);
            return;
          }
        }
        throw new Error('unknown statement ' + s.k);
      }
      var curSwitch = null;

      function genInit(v, entries) {
        const size = Types.sizeof(v.type);
        const agg = Types.isAggregate(v.type);
        if (agg) {
          // everything not mentioned is zero
          emit(OP.LADDR, v.off, OP.MEMZERO, size);
        }
        for (const e of entries) {
          if (e.whole) {
            emit(OP.LADDR, v.off + e.off);
            genExpr(e.e);
            emit(OP.MEMCPY, Types.sizeof(e.type), OP.POP);
            continue;
          }
          if (agg && e.e.k === 'num' && e.e.v === 0 && !e.member) continue;   // already zero
          if (e.member && e.member.width !== undefined) {
            emit(OP.LADDR, v.off + e.off);
            genExpr(e.e);
            emit(OP.BFSTORE, e.member.shift, e.member.width, Types.isSigned(e.member.type) ? 1 : 0, OP.POP);
            continue;
          }
          emit(OP.LADDR, v.off + e.off);
          genExpr(e.e);
          emit(OP.STOREP, kindOf(e.type));
        }
      }

      function genCond(e) { genExpr(e); }

      /** Evaluate for side effects only */
      function genDiscard(e) {
        switch (e.k) {
          case 'assign':
            if (Types.isSU(e.t)) { genAddr(e.l); genExpr(e.r); emit(OP.MEMCPY, Types.sizeof(e.t), OP.POP); return; }
            if (e.l.k === 'member' && e.l.m.width !== undefined) { genExpr(e); emit(OP.POP); return; }
            genAddr(e.l); genExpr(e.r); emit(OP.STOREP, kindOf(e.l.t));
            return;
          case 'comma': genDiscard(e.l); genDiscard(e.r); return;
          case 'cast': if (e.t.k === 'void') { genDiscard(e.e); return; } break;
          case 'call': genCall(e, false); return;
          case 'cond':
            if (e.t.k === 'void' || Types.isSU(e.t)) {
              genExpr(e.c);
              const jz = emit(OP.JZ, 0) - 1;
              genDiscard(e.a);
              const j = emit(OP.JMP, 0) - 1;
              patch(jz, here());
              genDiscard(e.b);
              patch(j, here());
              return;
            }
            break;
          case 'num': return;
        }
        if (e.t.k === 'void') { genExpr(e); return; }
        genExpr(e);
        emit(OP.POP);
      }

      // ---- lvalues: push the address ---------------------------------------------------------------
      function genAddr(e) {
        switch (e.k) {
          case 'var': {
            const s = e.sym;
            if (s.storage === 'global') { emit(OP.GADDR, symRef(s)); return; }
            if (s.kind === 'func') { emit(OP.FADDR, symRef(s)); return; }
            emit(OP.LADDR, s.off);
            return;
          }
          case 'str': emit(OP.GADDR, strRef(e.lit)); return;
          case 'deref': genExpr(e.e); return;
          case 'member': {
            genAddr(e.e);
            if (e.m.offset) emit(OP.CONST, e.m.offset, OP.ADD_U);
            return;
          }
          case 'call':
            // a struct returned by value: its temporary
            genCall(e, true);
            return;
          case 'cond':
            if (Types.isSU(e.t)) { genExpr(e); return; }
            break;
          case 'assign':
            if (Types.isSU(e.t)) { genExpr(e); return; }
            break;
          case 'comma':
            if (Types.isSU(e.t)) { genDiscard(e.l); genAddr(e.r); return; }
            break;
          case 'load': genAddr(e.e); return;
        }
        throw err('lvalue required', e.pos);
      }

      // ---- rvalues: push the value (structs: push their address) -----------------------------------
      function genExpr(e) {
        switch (e.k) {
          case 'num': emit(OP.CONST, e.v); return;
          case 'load': {
            const x = e.e;
            if (Types.isSU(x.t)) { genAddr(x); return; }
            if (x.k === 'member' && x.m.width !== undefined) {
              genAddr(x);
              emit(OP.BFLOAD, x.m.shift, x.m.width, Types.isSigned(x.m.type) ? 1 : 0);
              return;
            }
            genAddr(x);
            emit(OP.LOAD, kindOf(x.t));
            return;
          }
          case 'decay': {
            const x = e.e;
            if (x.k === 'var' && x.sym.kind === 'func') { emit(OP.FADDR, symRef(x.sym)); return; }
            if (x.k === 'fnderef') { genExpr(x.e); return; }
            genAddr(x);
            return;
          }
          case 'addr': genAddr(e.e); return;
          case 'var': case 'str': case 'deref':
            if (Types.isSU(e.t)) { genAddr(e); return; }
            break;
          case 'fnderef': genExpr(e.e); return;
          case 'member':
            // a member of a struct value that is not an lvalue (say, of a function's result)
            if (e.m.width !== undefined) { genAddr(e); emit(OP.BFLOAD, e.m.shift, e.m.width, Types.isSigned(e.m.type) ? 1 : 0); return; }
            if (e.t.k === 'array' || Types.isSU(e.t)) { genAddr(e); return; }
            genAddr(e);
            emit(OP.LOAD, kindOf(e.t));
            return;
          case 'cast': genCast(e); return;
          case 'unop': {
            genExpr(e.e);
            const t = e.t;
            if (e.op === '-') emit(Types.isFloat(t) ? (t.k === 'float' ? OP.NEG_F32 : OP.NEG_F) : Types.isSigned(t) ? OP.NEG_I : OP.NEG_U);
            else if (e.op === '~') emit(Types.isSigned(t) ? OP.NOT_I : OP.NOT_U);
            else if (e.op === '!') emit(OP.LNOT);
            return;
          }
          case 'bin': {
            genExpr(e.l);
            genExpr(e.r);
            emit(binOp(e.op, e.ot));
            return;
          }
          case 'padd': {
            genExpr(e.p);
            genExpr(e.i);
            emit(e.sub ? OP.PSUB : OP.PADD, e.size);
            return;
          }
          case 'pdiff': genExpr(e.l); genExpr(e.r); emit(OP.PDIFF, e.size); return;
          case 'logand': case 'logor': {
            genExpr(e.l);
            const j1 = emit(e.k === 'logand' ? OP.JZ : OP.JNZ, 0) - 1;
            genExpr(e.r);
            const j2 = emit(e.k === 'logand' ? OP.JZ : OP.JNZ, 0) - 1;
            emit(OP.CONST, e.k === 'logand' ? 1 : 0);
            const j3 = emit(OP.JMP, 0) - 1;
            patch(j1, here()); patch(j2, here());
            emit(OP.CONST, e.k === 'logand' ? 0 : 1);
            patch(j3, here());
            return;
          }
          case 'cond': {
            genExpr(e.c);
            const jz = emit(OP.JZ, 0) - 1;
            if (e.t.k === 'void') genDiscard(e.a); else genExpr(e.a);
            const j = emit(OP.JMP, 0) - 1;
            patch(jz, here());
            if (e.t.k === 'void') genDiscard(e.b); else genExpr(e.b);
            patch(j, here());
            return;
          }
          case 'comma': genDiscard(e.l); if (e.t.k === 'void') genDiscard(e.r); else genExpr(e.r); return;
          case 'assign': {
            if (Types.isSU(e.t)) { genAddr(e.l); genExpr(e.r); emit(OP.MEMCPY, Types.sizeof(e.t)); return; }
            if (e.l.k === 'member' && e.l.m.width !== undefined) {
              genAddr(e.l); genExpr(e.r);
              emit(OP.BFSTORE, e.l.m.shift, e.l.m.width, Types.isSigned(e.l.m.type) ? 1 : 0);
              return;
            }
            genAddr(e.l); genExpr(e.r); emit(OP.STORE, kindOf(e.l.t));
            return;
          }
          case 'opassign': {
            const l = e.l;
            const bf = l.k === 'member' && l.m.width !== undefined;
            genAddr(l);
            emit(OP.DUP);
            if (bf) emit(OP.BFLOAD, l.m.shift, l.m.width, Types.isSigned(l.m.type) ? 1 : 0);
            else emit(OP.LOAD, kindOf(l.t));
            if (e.ptrStep !== undefined) {
              genExpr(e.r);
              emit(e.op === '-' ? OP.PSUB : OP.PADD, e.ptrStep);
            } else {
              convertOnStack(Types.unqual(l.t), e.op === '<<' || e.op === '>>' ? Types.promote(l.t) : e.ot);
              genExpr(e.r);
              emit(binOp(e.op, e.op === '<<' || e.op === '>>' ? Types.promote(l.t) : e.ot));
              convertOnStack(e.op === '<<' || e.op === '>>' ? Types.promote(l.t) : e.ot, Types.unqual(l.t));
            }
            if (bf) emit(OP.BFSTORE, l.m.shift, l.m.width, Types.isSigned(l.m.type) ? 1 : 0);
            else emit(OP.STORE, kindOf(l.t));
            return;
          }
          case 'incdec': {
            const l = e.e;
            if (l.k === 'member' && l.m.width !== undefined) {
              // read, change, write back through the bit-field
              genAddr(l); emit(OP.DUP, OP.BFLOAD, l.m.shift, l.m.width, Types.isSigned(l.m.type) ? 1 : 0);
              if (e.post) {
                emit(OP.DUP, OP.ROT3);   // addr v v -> v addr v
                emit(OP.CONST, e.op === '++' ? 1 : -1, OP.ADD_I, OP.BFSTORE, l.m.shift, l.m.width, Types.isSigned(l.m.type) ? 1 : 0, OP.POP);
              } else emit(OP.CONST, e.op === '++' ? 1 : -1, OP.ADD_I, OP.BFSTORE, l.m.shift, l.m.width, Types.isSigned(l.m.type) ? 1 : 0);
              return;
            }
            genAddr(l);
            emit(OP.INCDEC, kindOf(l.t), (e.op === '++' ? 1 : -1) * e.step, e.post ? 1 : 0);
            return;
          }
          case 'call': genCall(e, true); return;
        }
        if (e.lv) {
          genAddr(e);
          emit(OP.LOAD, kindOf(e.t));
          return;
        }
        throw err('cannot generate code for ' + e.k, e.pos);
      }

      function binOp(op, t) {
        const f = Types.isFloat(t), f32 = t.k === 'float', s = Types.isSigned(t);
        const pick = (I, U, F, F32) => (f ? (f32 ? F32 : F) : s ? I : U);
        switch (op) {
          case '+': return pick(OP.ADD_I, OP.ADD_U, OP.ADD_F, OP.ADD_F32);
          case '-': return pick(OP.SUB_I, OP.SUB_U, OP.SUB_F, OP.SUB_F32);
          case '*': return pick(OP.MUL_I, OP.MUL_U, OP.MUL_F, OP.MUL_F32);
          case '/': return pick(OP.DIV_I, OP.DIV_U, OP.DIV_F, OP.DIV_F32);
          case '%': return s ? OP.MOD_I : OP.MOD_U;
          case '&': return s ? OP.AND_I : OP.AND_U;
          case '|': return s ? OP.OR_I : OP.OR_U;
          case '^': return s ? OP.XOR_I : OP.XOR_U;
          case '<<': return s ? OP.SHL_I : OP.SHL_U;
          case '>>': return s ? OP.SHR_I : OP.SHR_U;
          case '==': return OP.EQ;
          case '!=': return OP.NE;
          case '<': return OP.LT;
          case '<=': return OP.LE;
          case '>': return OP.GT;
          case '>=': return OP.GE;
        }
        throw new Error('op ' + op);
      }

      function genCast(e) {
        if (e.t.k === 'void') { genDiscard(e.e); return; }
        genExpr(e.e);
        if (Types.isSU(e.t)) return;
        convertOnStack(e.e.t, e.t);
      }
      /** Convert the value on top of the stack from type a to type b */
      function convertOnStack(a, b) {
        if (b.k === 'ptr' && (a.k === 'ptr' || Types.isUnsigned(a) && Types.sizeof(a) === 4)) return;
        const ka = Types.isScalar(a) ? kindOf(a) : null, kb = kindOf(b);
        if (b.k === 'int' && a.k === 'enum' || a.k === 'int' && b.k === 'enum') return;
        const fa = Types.isFloat(a), fb = Types.isFloat(b);
        if (fa && fb) { if (ka !== kb) emit(OP.F2F, kb); return; }
        if (fa) { emit(OP.F2I, kb); return; }
        if (fb) { emit(OP.I2F, kb); return; }
        if (ka === kb) return;
        // widening a value that already fits needs nothing
        if (ka === K.i8 && (kb === K.i16 || kb === K.i32)) return;
        if (ka === K.u8 && (kb === K.i16 || kb === K.u16 || kb === K.i32 || kb === K.u32)) return;
        if (ka === K.i16 && kb === K.i32) return;
        if (ka === K.u16 && (kb === K.i32 || kb === K.u32)) return;
        emit(OP.CVT, kb);
      }

      function genCall(e, want) {
        const rt = e.t;
        const isSU = Types.isSU(rt);
        let bytes = 0;
        const slots = [];
        if (isSU) bytes += 4;
        for (const a of e.args) {
          const sz = Types.isSU(a.t) ? Types.sizeof(a.t) : Math.max(4, Types.sizeof(a.t));
          slots.push(bytes);
          bytes += (sz + 3) & ~3;
        }
        // the callee address is computed first, then the argument area is filled
        const direct = e.f.k === 'decay' && e.f.e.k === 'var' && e.f.e.sym.kind === 'func';
        if (!direct) genExpr(e.f);
        emit(OP.ALLOC, bytes);
        if (isSU) { emit(OP.LADDR, e.temp.off, OP.ARG, 0, K.u32); }
        // arguments are evaluated right to left, like most C compilers for this machine
        for (let i = e.args.length - 1; i >= 0; i--) {
          const a = e.args[i];
          genExpr(a.e);
          if (Types.isSU(a.t)) emit(OP.ARGCPY, slots[i], Types.sizeof(a.t));
          else emit(OP.ARG, slots[i], kindOf(a.t));
        }
        if (direct) emit(OP.CALL, symRef(e.f.e.sym), bytes, want && rt.k !== 'void' ? 1 : 0);
        else emit(OP.CALLI, bytes, want && rt.k !== 'void' ? 1 : 0);
        emit(OP.FREE, bytes);
      }
    }
  }

  SEE.Codegen = { generate, OP, OPNAMES: NAMES, K, kindOf };
})(SEE);
