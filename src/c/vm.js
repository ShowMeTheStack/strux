// The machine: runs linked bytecode against simulated memory, one frame per call in the real stack area.
// Calls follow i386 cdecl: arguments, return address, saved frame pointer, then the locals.
(function (SEE) {
  'use strict';
  const { OP } = SEE.Codegen;
  const { Memory, Journal, Fault, SH, MEM, hex } = SEE;
  const KSIZE = SEE.KSIZE;

  // the switch in loop() uses literal opcode numbers for speed; they must match codegen's table
  if (OP.PDIFF !== 75 || OP.STMT !== 67 || OP.CALL !== 63) throw new Error('opcode numbers changed: regenerate the cases in vm.js');
  const BLOCK = { block: true };      // a library function waiting for input
  class Exit { constructor(code) { this.code = code; } }
  const STACK_RESERVE = 4096;

  class Machine extends SEE.Emitter {
    /**
     * prog: from SEE.Linker.link
     * io: {write(fd, text), vfs, cwd, argv, env}
     */
    constructor(prog, io) {
      super();
      this.prog = prog;
      this.io = io || {};
      this.mem = new Memory();
      this.state = 'ready';          // ready running paused input exited faulted
      this.S = [];                   // operand stack
      this.frames = [];
      this.debug = false;
      this.stmtHook = null;          // (machine) => true to stop before this statement
      this.steps = 0;                // statements executed
      this.ops = 0;
      this.ret = 0;
      this.exitCode = null;
      this.fault = null;
      this.warnings = [];
      this.uninitSeen = new Set();
      this.checkOverflow = io.checkOverflow !== false;
      this.libc = SEE.Libc ? SEE.Libc.create(this) : null;
      this.load();
    }

    BLOCK() { return BLOCK; }

    // ---- loading ----------------------------------------------------------------------------------
    load() {
      const m = this.mem, p = this.prog;
      m.segments = p.segments.map((s) => Object.assign({}, s));
      const mark = (lo, hi, st) => { if (hi > lo) { const i = m.idx(lo, hi - lo); m.sh.fill(st, i, i + (hi - lo)); } };
      const [text, ro, data, bss] = p.segments;
      mark(text.lo, text.hi, SH.CODE);
      // code bytes: a recognisable filler, so a hex view of the text segment shows something
      for (const f of p.functions) { const i = m.idx(f.addr, f.size); m.u8.fill(0x90, i, i + f.size); m.u8[i] = 0x55; m.u8[i + 1] = 0x89; m.u8[i + 2] = 0xe5; }
      mark(ro.lo, ro.hi, SH.RODATA);
      mark(data.lo, data.hi, SH.INIT);
      mark(bss.lo, bss.hi, SH.INIT);
      for (const im of p.image) {
        const i = m.idx(im.addr, im.bytes.length);
        m.u8.set(im.bytes, i);
      }
      for (const b of p.bitInits) {
        const i = m.idx(b.addr, 4);
        const old = m.dv.getUint32(i, true);
        const mask = (b.bits.width === 32 ? 0xffffffff : ((1 << b.bits.width) - 1)) << b.bits.shift;
        m.dv.setUint32(i, ((old & ~mask) | ((b.value << b.bits.shift) & mask)) >>> 0, true);
      }
      m.heapLo = m.brk = p.heapStart;
      let base = 1;
      for (const f of p.functions) { f.stmtBase = base; base += f.stmts.length; }
      m.warnUninit = (addr, n) => this.uninitRead(addr, n);
      if (this.libc) this.libc.init();
      // the stack starts with the program's arguments and environment, like on a real system
      let sp = MEM.STACK_TOP - 16;
      const argv = this.io.argv || ['a.out'];
      const env = this.io.env || ['HOME=/home/user', 'PATH=/bin:/usr/bin', 'USER=user'];
      const putStr = (s) => {
        const b = SEE.utf8(s);
        sp -= b.length + 1;
        const i = m.idx(sp, b.length + 1);
        m.u8.set(b, i); m.u8[i + b.length] = 0;
        m.sh.fill(SH.INIT, i, i + b.length + 1);
        return sp;
      };
      const envp = env.map(putStr);
      const argp = argv.map(putStr);
      sp = (sp & ~3) >>> 0;
      const putWord = (v) => { sp -= 4; const i = m.idx(sp, 4); m.dv.setUint32(i, v >>> 0, true); m.sh.fill(SH.INIT, i, i + 4); return sp; };
      putWord(0);
      for (let k = envp.length - 1; k >= 0; k--) putWord(envp[k]);
      this.envAddr = sp;
      putWord(0);
      for (let k = argp.length - 1; k >= 0; k--) putWord(argp[k]);
      this.argvAddr = sp;
      this.argc = argv.length;
      sp = (sp & ~15) >>> 0;
      this.stackStart = sp;
      this.SP = sp;
      this.FP = 0;
      // fill the unused stack with leftovers, as a real stack has: reading a local before setting it shows junk
      let seed = 0x2545f491;
      for (let a = MEM.STACK_LO + (MEM.STACK_SIZE - 65536); a < sp; a += 4) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        const i = m.idx(a, 4);
        m.dv.setUint32(i, (seed & 0xff) < 160 ? 0 : seed >>> 0, true);
      }
      // start in the C startup routine, which calls main and then exit
      const start = p.functions.find((f) => f.name === '_start') || p.main;
      this.fn = null;
      this.pc = 0;
      this.enter(start, 0, 0, start === p.main ? 1 : 0);
      this.entry = start;
      this.state = 'ready';
    }

    // ---- frames -------------------------------------------------------------------------------------
    enter(fn, retPc, argBytes, want) {
      const m = this.mem;
      if (this.SP - fn.frameSize - 8 < MEM.STACK_LO + STACK_RESERVE) {
        throw new Fault('segv', 'stack overflow: ' + (this.frames.length + 1) + ' calls deep (is a recursive function missing its base case?)', { stackOverflow: true });
      }
      const caller = this.fn;
      const retAddr = caller ? (caller.addr + retPc) >>> 0 : 0;
      // push the return address and the caller's frame pointer
      this.SP -= 4;
      m.setShadow(this.SP, 4, SH.CONTROL);
      this.rawStoreU32(this.SP, retAddr);
      this.SP -= 4;
      m.setShadow(this.SP, 4, SH.CONTROL);
      this.rawStoreU32(this.SP, this.FP);
      if (caller) {
        this.frames.push({ fn: caller, pc: retPc, fp: this.FP, sb: this.S.length, want: this.want, retAddr: this.retAddr, argBytes: this.argBytes });
        // stepping back undoes the call: the journal keeps this instead of copying all frames at every step
        if (m.journal) { const frames = this.frames; m.journal.later(() => { frames.pop(); }); }
      }
      this.want = want;
      this.FP = this.SP;
      this.SP -= fn.frameSize;
      // a new frame holds whatever was there before: not initialised
      if (fn.frameSize) m.setShadow(this.SP, fn.frameSize, SH.UNINIT);
      for (const v of fn.locals) {
        if (v.guard) { m.setShadow(this.FP + v.off + Math.max(SEE.Types.sizeof(v.type), 1), 4, SH.GUARD); m.setShadow(this.FP + v.off - 4, 4, SH.GUARD); }
      }
      this.fn = fn;
      this.code = fn.code;
      this.pc = 0;
      this.retAddr = retAddr;
      this.argBytes = argBytes;
      this.depth = this.frames.length;
      if (this.debug) this.emit('call', fn);
    }
    rawStoreU32(addr, v) {
      const m = this.mem;
      const i = m.idx(addr, 4);
      if (m.journal) m.journal.record(i, 4);
      m.dv.setUint32(i, v >>> 0, true);
      m.writer[i] = m.writer[i + 1] = m.writer[i + 2] = m.writer[i + 3] = m.stmt;
    }

    leave() {
      const m = this.mem;
      const fp = this.FP;
      const fn = this.fn;
      const savedFp = m.peek(5, fp), ret = m.peek(5, fp + 4);
      if (ret !== this.retAddr || (this.frames.length && savedFp !== this.frames[this.frames.length - 1].fp)) {
        const which = ret !== this.retAddr ? 'return address' : 'saved frame pointer';
        throw new Fault('check', 'stack smashing detected in ' + fn.name + '(): its ' + which + ' was overwritten (a write ran past the end of a local array?)', { smashed: true, addr: ret !== this.retAddr ? fp + 4 : fp, expected: ret !== this.retAddr ? this.retAddr : null });
      }
      // the frame is gone: its bytes are no longer anyone's
      const lo = fp - fn.frameSize, hi = fp + 8;
      if (this.mem.idx(lo, hi - lo) >= 0) m.setShadow(lo, hi - lo, SH.NONE);
      this.SP = fp + 8;
      this.FP = savedFp;
      if (!this.frames.length) return -1;
      const f = this.frames.pop();
      if (m.journal) {
        // keep the caller's own operand values: after the return it consumes them
        const frames = this.frames, S = this.S;
        const base = frames.length ? frames[frames.length - 1].sb : 0;
        const seg = S.slice(base, f.sb);
        m.journal.later(() => { frames.push(f); S.length = base; for (const x of seg) S.push(x); });
      }
      this.fn = f.fn;
      this.code = f.fn.code;
      this.pc = f.pc;
      this.S.length = f.sb;
      const want = this.want;
      this.want = f.want;
      this.retAddr = f.retAddr;
      this.argBytes = f.argBytes;
      this.depth = this.frames.length;
      if (this.debug) this.emit('return', fn);
      return want;
    }

    // ---- running ------------------------------------------------------------------------------------
    /**
     * Run up to `budget` instructions. Returns the reason it stopped:
     * 'budget' | 'pause' | 'input' | 'exit' | 'fault'
     */
    run(budget) {
      if (this.state === 'exited' || this.state === 'faulted') return this.state === 'exited' ? 'exit' : 'fault';
      this.state = 'running';
      try {
        const r = this.loop(budget);
        if (r === 'input') this.state = 'input';
        else if (r === 'pause') this.state = 'paused';
        else this.state = 'running';
        return r;
      } catch (e) {
        if (e instanceof Exit) {
          this.exitCode = e.code;
          this.state = 'exited';
          this.emit('exit', e.code);
          return 'exit';
        }
        if (e instanceof Fault) {
          this.fault = this.explain(e);
          this.state = 'faulted';
          this.emit('fault', this.fault);
          return 'fault';
        }
        throw e;
      }
    }

    loop(budget) {
      const S = this.S, mem = this.mem;
      let code = this.code, pc = this.pc;
      let a, b, v;
      const end = this.ops + budget;
      const hook = this.debug ? this.stmtHook : null;
      let skipHook = this.resumed && code[pc] === OP.STMT;   // do not stop again at the statement we stopped at
      this.resumed = false;
      for (;;) {
        const op = code[pc];
        switch (op) {
          case 0: /* NOP */ pc++; break;
          case 1: /* CONST */ S.push(code[pc + 1]); pc += 2; break;
          case 2: /* LADDR */ S.push((this.FP + code[pc + 1]) >>> 0); pc += 2; break;
          case 3: /* LOAD */ S.push(mem.load(code[pc + 1], S.pop())); pc += 2; break;
          case 4: /* STORE */ v = S.pop(); a = S.pop(); this.pc = pc; mem.store(code[pc + 1], a, v); S.push(norm(code[pc + 1], v)); pc += 2; break;
          case 5: /* STOREP */ v = S.pop(); a = S.pop(); this.pc = pc; mem.store(code[pc + 1], a, v); pc += 2; break;
          case 6: /* DUP */ S.push(S[S.length - 1]); pc++; break;
          case 81: /* DUP2 */ a = S[S.length - 2]; b = S[S.length - 1]; S.push(a, b); pc++; break;
          case 82: /* ROT3 */ { const n = S.length; const z = S[n - 1]; S[n - 1] = S[n - 2]; S[n - 2] = S[n - 3]; S[n - 3] = z; pc++; break; }
          case 7: /* POP */ S.pop(); pc++; break;
          case 8: /* SWAP */ { const n = S.length; a = S[n - 1]; S[n - 1] = S[n - 2]; S[n - 2] = a; pc++; break; }
          case 9: /* ADD_I */ b = S.pop(); a = S.pop(); v = a + b; if (this.checkOverflow && (v | 0) !== v) this.overflow('+', a, b); S.push(v | 0); pc++; break;
          case 10: /* ADD_U */ b = S.pop(); a = S.pop(); S.push((a + b) >>> 0); pc++; break;
          case 11: /* ADD_F */ b = S.pop(); a = S.pop(); S.push(a + b); pc++; break;
          case 12: /* ADD_F32 */ b = S.pop(); a = S.pop(); S.push(Math.fround(a + b)); pc++; break;
          case 13: /* SUB_I */ b = S.pop(); a = S.pop(); v = a - b; if (this.checkOverflow && (v | 0) !== v) this.overflow('-', a, b); S.push(v | 0); pc++; break;
          case 14: /* SUB_U */ b = S.pop(); a = S.pop(); S.push((a - b) >>> 0); pc++; break;
          case 15: /* SUB_F */ b = S.pop(); a = S.pop(); S.push(a - b); pc++; break;
          case 16: /* SUB_F32 */ b = S.pop(); a = S.pop(); S.push(Math.fround(a - b)); pc++; break;
          case 17: /* MUL_I */ b = S.pop(); a = S.pop(); v = Math.imul(a, b); if (this.checkOverflow && v !== a * b) this.overflow('*', a, b); S.push(v); pc++; break;
          case 18: /* MUL_U */ b = S.pop(); a = S.pop(); S.push(Math.imul(a, b) >>> 0); pc++; break;
          case 19: /* MUL_F */ b = S.pop(); a = S.pop(); S.push(a * b); pc++; break;
          case 20: /* MUL_F32 */ b = S.pop(); a = S.pop(); S.push(Math.fround(a * b)); pc++; break;
          case 21: /* DIV_I */
            b = S.pop(); a = S.pop();
            if (b === 0) { this.pc = pc; throw new Fault('fpe', 'integer division by zero', { div: true }); }
            if (a === -2147483648 && b === -1) { this.pc = pc; throw new Fault('fpe', 'integer overflow: INT_MIN / -1 does not fit in an int', { div: true }); }
            S.push((a / b) | 0); pc++; break;
          case 22: /* DIV_U */ b = S.pop(); a = S.pop(); if (b === 0) { this.pc = pc; throw new Fault('fpe', 'integer division by zero', { div: true }); } S.push(Math.floor(a / b) >>> 0); pc++; break;
          case 23: /* DIV_F */ b = S.pop(); a = S.pop(); S.push(a / b); pc++; break;
          case 24: /* DIV_F32 */ b = S.pop(); a = S.pop(); S.push(Math.fround(a / b)); pc++; break;
          case 25: /* MOD_I */
            b = S.pop(); a = S.pop();
            if (b === 0) { this.pc = pc; throw new Fault('fpe', 'integer division by zero (in %)', { div: true }); }
            if (a === -2147483648 && b === -1) { this.pc = pc; throw new Fault('fpe', 'integer overflow: INT_MIN % -1', { div: true }); }
            S.push((a % b) | 0); pc++; break;
          case 26: /* MOD_U */ b = S.pop(); a = S.pop(); if (b === 0) { this.pc = pc; throw new Fault('fpe', 'integer division by zero (in %)', { div: true }); } S.push((a % b) >>> 0); pc++; break;
          case 27: /* NEG_I */ a = S.pop(); if (this.checkOverflow && a === -2147483648) this.overflow('-', 0, a); S.push((-a) | 0); pc++; break;
          case 28: /* NEG_U */ a = S.pop(); S.push((-a) >>> 0); pc++; break;
          case 29: /* NEG_F */ S.push(-S.pop()); pc++; break;
          case 30: /* NEG_F32 */ S.push(Math.fround(-S.pop())); pc++; break;
          case 31: /* AND_I */ b = S.pop(); a = S.pop(); S.push(a & b); pc++; break;
          case 32: /* AND_U */ b = S.pop(); a = S.pop(); S.push((a & b) >>> 0); pc++; break;
          case 33: /* OR_I */ b = S.pop(); a = S.pop(); S.push(a | b); pc++; break;
          case 34: /* OR_U */ b = S.pop(); a = S.pop(); S.push((a | b) >>> 0); pc++; break;
          case 35: /* XOR_I */ b = S.pop(); a = S.pop(); S.push(a ^ b); pc++; break;
          case 36: /* XOR_U */ b = S.pop(); a = S.pop(); S.push((a ^ b) >>> 0); pc++; break;
          case 37: /* SHL_I */ b = S.pop(); a = S.pop(); S.push(a << b); pc++; break;
          case 38: /* SHL_U */ b = S.pop(); a = S.pop(); S.push((a << b) >>> 0); pc++; break;
          case 39: /* SHR_I */ b = S.pop(); a = S.pop(); S.push(a >> b); pc++; break;
          case 40: /* SHR_U */ b = S.pop(); a = S.pop(); S.push(a >>> b); pc++; break;
          case 41: /* NOT_I */ S.push(~S.pop()); pc++; break;
          case 42: /* NOT_U */ S.push((~S.pop()) >>> 0); pc++; break;
          case 43: /* EQ */ b = S.pop(); a = S.pop(); S.push(a === b ? 1 : 0); pc++; break;
          case 44: /* NE */ b = S.pop(); a = S.pop(); S.push(a !== b ? 1 : 0); pc++; break;
          case 45: /* LT */ b = S.pop(); a = S.pop(); S.push(a < b ? 1 : 0); pc++; break;
          case 46: /* LE */ b = S.pop(); a = S.pop(); S.push(a <= b ? 1 : 0); pc++; break;
          case 47: /* GT */ b = S.pop(); a = S.pop(); S.push(a > b ? 1 : 0); pc++; break;
          case 48: /* GE */ b = S.pop(); a = S.pop(); S.push(a >= b ? 1 : 0); pc++; break;
          case 49: /* LNOT */ S.push(S.pop() ? 0 : 1); pc++; break;
          case 50: /* BOOL */ S.push(S.pop() ? 1 : 0); pc++; break;
          case 51: /* CVT */ S.push(norm(code[pc + 1], S.pop())); pc += 2; break;
          case 52: /* F2I */ S.push(f2i(code[pc + 1], S.pop())); pc += 2; break;
          case 53: /* I2F */ S.push(code[pc + 1] === 6 ? Math.fround(S.pop()) : S.pop()); pc += 2; break;
          case 54: /* F2F */ S.push(code[pc + 1] === 6 ? Math.fround(S.pop()) : S.pop()); pc += 2; break;
          case 55: /* JMP */ pc = code[pc + 1]; break;
          case 56: /* JZ */ pc = S.pop() ? pc + 2 : code[pc + 1]; break;
          case 57: /* JNZ */ pc = S.pop() ? code[pc + 1] : pc + 2; break;
          case 58: /* SWITCH */ {
            const t = this.fn.switchTables[code[pc + 1]];
            v = S.pop();
            const to = t.cases.get(v);
            pc = to === undefined ? t.def : to;
            break;
          }
          case 59: /* ALLOC */ this.SP = (this.SP - code[pc + 1]) >>> 0; if (this.SP < MEM.STACK_LO + 1024) { this.pc = pc; throw new Fault('segv', 'stack overflow', { stackOverflow: true }); } mem.setShadow(this.SP, code[pc + 1], SH.UNINIT); pc += 2; break;
          case 60: /* FREE */ if (code[pc + 1]) mem.setShadow(this.SP, code[pc + 1], SH.NONE); this.SP = (this.SP + code[pc + 1]) >>> 0; pc += 2; break;
          case 61: /* ARG */ v = S.pop(); this.pc = pc; mem.store(code[pc + 2], this.SP + code[pc + 1], v); pc += 3; break;
          case 62: /* ARGCPY */ a = S.pop(); this.pc = pc; mem.copy(this.SP + code[pc + 1], a, code[pc + 2]); pc += 3; break;
          case 63: /* CALL */ case 64: /* CALLI */ {
            let c, bytes, want, popped = null;
            if (op === OP.CALL) { c = this.prog.callables[code[pc + 1]]; bytes = code[pc + 2]; want = code[pc + 3]; }
            else {
              popped = S.pop();
              c = this.prog.byAddr.get(popped);
              bytes = code[pc + 1]; want = code[pc + 2];
              if (!c) {
                this.pc = pc;
                throw new Fault('segv', popped === 0 ? 'call through a NULL function pointer' : 'call to 0x' + hex(popped) + ', which is not the start of a function', { addr: popped, call: true });
              }
            }
            const next = pc + (op === OP.CALL ? 4 : 3);
            if (c.native) {
              this.pc = pc;
              this.code = code;
              this.callWant = want;
              this.callNext = next;
              let r;
              try { r = c.native.native.fn(this, this.SP, c.native.name); } catch (e) {
                if (e instanceof Fault && !e.detail.lib) e.detail.lib = c.native.name;
                throw e;
              }
              if (r === BLOCK) {
                if (popped !== null) S.push(popped);
                return 'input';
              }
              if (this.jumped) { this.jumped = false; code = this.code; pc = this.pc; break; }   // longjmp
              if (want) S.push(r === undefined ? 0 : r);
              pc = next;
              break;
            }
            this.pc = next;
            this.want = this.want;
            this.enter(c.fn, next, bytes, want);
            code = this.code; pc = 0;
            break;
          }
          case 65: /* RET */ case 66: /* RETV */ case 80: /* FALLOFF */ {
            if (op === OP.RETV) this.ret = S.pop();
            else if (op === OP.FALLOFF) { this.pc = pc; this.ret = 0; this.warnOnce('falloff:' + this.fn.name, "function '" + this.fn.name + "' ended without a return statement; its caller gets a meaningless value"); }
            else this.ret = undefined;
            this.pc = pc;
            this.lastReturned = this.fn;
            if (this.debug && this.preReturnHook) this.preReturnHook(this);
            const want = this.leave();
            if (want === -1) throw new Exit(this.ret | 0);   // the outermost function returned
            code = this.code; pc = this.pc;
            if (want) S.push(this.ret === undefined ? 0 : this.ret);
            if (this.debug && this.returnHook && this.returnHook(this)) { this.pc = pc; this.code = code; return 'pause'; }
            break;
          }
          case 67: /* STMT */ {
            const id = code[pc + 1];
            mem.stmt = this.fn.stmtBase + id;
            this.pc = pc;   // so a crash in this statement is reported on its line
            if (hook && !skipHook) {
              this.pc = pc;
              this.code = code;
              if (hook(this, id)) return 'pause';
            }
            skipHook = false;
            this.steps++;
            pc += 2;
            if (++this.ops > end) { this.pc = pc; this.code = code; return 'budget'; }
            break;
          }
          case 68: /* MEMCPY */ a = S.pop(); b = S.pop(); this.pc = pc; mem.copy(b, a, code[pc + 1]); S.push(b); pc += 2; break;
          case 69: /* MEMZERO */ a = S.pop(); this.pc = pc; mem.fill(a, 0, code[pc + 1]); pc += 2; break;
          case 78: /* DECL */ a = S.pop(); mem.setShadow(a, code[pc + 1], SH.UNINIT); pc += 2; break;
          case 70: /* BFLOAD */ {
            a = S.pop();
            const w = mem.load(5, a), sh = code[pc + 1], wd = code[pc + 2];
            let x = wd === 32 ? w : (w >>> sh) & ((1 << wd) - 1);
            if (code[pc + 3] && wd < 32 && (x & (1 << (wd - 1)))) x -= 1 << wd;
            if (code[pc + 3] && wd === 32) x |= 0;
            S.push(x); pc += 4; break;
          }
          case 71: /* BFSTORE */ {
            v = S.pop(); a = S.pop();
            const sh = code[pc + 1], wd = code[pc + 2];
            this.pc = pc;
            const i = mem.idx(a, 4);
            const old = i >= 0 && mem.sh[i] === SH.UNINIT ? 0 : mem.load(5, a);
            const mask = wd === 32 ? 0xffffffff : ((1 << wd) - 1);
            const nw = wd === 32 ? v >>> 0 : ((old & ~(mask << sh)) | ((v & mask) << sh)) >>> 0;
            mem.store(5, a, nw);
            let x = wd === 32 ? v >>> 0 : v & mask;
            if (code[pc + 3] && wd < 32 && (x & (1 << (wd - 1)))) x -= 1 << wd;
            if (code[pc + 3] && wd === 32) x |= 0;
            S.push(x); pc += 4; break;
          }
          case 72: /* INCDEC */ {
            a = S.pop();
            const k = code[pc + 1], d = code[pc + 2];
            this.pc = pc;
            const old = mem.load(k, a);
            let nv = old + d;
            if (k === 4 && this.checkOverflow && (nv | 0) !== nv) this.overflow(d > 0 ? '+' : '-', old, Math.abs(d));
            nv = norm(k, nv);
            mem.store(k, a, nv);
            S.push(code[pc + 3] ? old : nv);
            pc += 4; break;
          }
          case 73: /* PADD */ b = S.pop(); a = S.pop(); S.push((a + b * code[pc + 1]) >>> 0); pc += 2; break;
          case 74: /* PSUB */ b = S.pop(); a = S.pop(); S.push((a - b * code[pc + 1]) >>> 0); pc += 2; break;
          case 75: /* PDIFF */ b = S.pop(); a = S.pop(); S.push(((a - b) / code[pc + 1]) | 0); pc += 2; break;
          default:
            throw new Error('bad opcode ' + op + ' at ' + this.fn.name + ':' + pc);
        }
      }
    }

    // ---- diagnostics ------------------------------------------------------------------------------
    overflow(op, a, b) {
      this.warnOnce('ovf:' + this.where().line + ':' + this.fn.name, 'signed integer overflow: ' + a + ' ' + op + ' ' + b + " does not fit in an int (the result wraps around here; C calls this undefined behaviour)");
    }
    uninitRead(addr, n) {
      if (this.fn && this.fn.system) return;   // the library copies bytes as bytes (qsort's swaps): not a read of a value
      const key = addr + ':' + this.mem.stmt;
      if (this.uninitSeen.has(key)) return;
      this.uninitSeen.add(key);
      if (this.uninitSeen.size > 200) return;
      const what = this.describeAddr(addr);
      this.warnings.push({ kind: 'uninit', msg: 'reading ' + (what ? what.text : n + ' bytes at 0x' + hex(addr)) + ' before it was given a value', at: this.where(), addr });
      this.emit('warning', this.warnings[this.warnings.length - 1]);
    }
    warnOnce(key, msg) {
      this.warnedKeys = this.warnedKeys || new Set();
      if (this.warnedKeys.has(key)) return;
      this.warnedKeys.add(key);
      const w = { kind: 'runtime', msg, at: this.where() };
      this.warnings.push(w);
      this.emit('warning', w);
    }

    /** Where the machine is: {fn, file, line, stmt} */
    where(frameIndex) {
      let fn = this.fn, pc = this.pc;
      if (frameIndex !== undefined && frameIndex < this.frames.length) { fn = this.frames[frameIndex].fn; pc = this.frames[frameIndex].pc - 1; }
      if (!fn) return { fn: null, file: null, line: 0 };
      const id = stmtAt(fn, pc);
      const s = fn.stmts[id] || { line: fn.pos.line, file: fn.pos.file };
      return { fn: fn.name, file: s.file, line: s.line, stmt: id, system: fn.system };
    }

    /** Statement record by global id (see the "who wrote this" view) */
    stmtById(gid) {
      if (gid === -1) return { debugger: true };
      if (!gid) return null;
      for (const f of this.prog.functions) {
        if (gid >= f.stmtBase && gid < f.stmtBase + f.stmts.length) return Object.assign({ fnName: f.name }, f.stmts[gid - f.stmtBase]);
      }
      return null;
    }

    /** What lives at an address: a variable (and which part), a heap block, a string literal */
    describeAddr(addr) {
      return SEE.Debug ? SEE.Debug.describeAddr(this, addr) : null;
    }

    explain(f) {
      const at = this.where();
      const d = Object.assign({}, f.detail);
      let title = f.kind === 'fpe' ? 'Floating point exception' : f.kind === 'abort' ? 'Aborted' : f.kind === 'check' ? 'Memory error' : 'Segmentation fault';
      let msg = f.message;
      const addr = d.at !== undefined ? d.at : d.addr;
      if (d.stackOverflow) title = 'Stack overflow';
      if (addr !== undefined && SEE.Debug) {
        const w = SEE.Debug.describeAddr(this, addr);
        if (w) d.what = w;
        const st = this.mem.shadow(addr);
        if (st === SH.NONE && addr >= MEM.STACK_LO && addr < this.SP) msg = (d.write ? 'write to' : 'read from') + ' 0x' + hex(addr) + ', stack memory of a function that has already returned (a dangling pointer to a local variable)';
        else if (st === SH.NONE && addr >= this.mem.heapLo && addr < this.mem.brk) msg = (d.write ? 'write to' : 'read from') + ' 0x' + hex(addr) + ', heap memory that is not part of any block';
        else if (st === SH.NONE && addr >= this.mem.brk && addr < MEM.LOW_BASE + MEM.LOW_SIZE) msg = (d.write ? 'write to' : 'read from') + ' 0x' + hex(addr) + ', past the end of the heap';
        if (st === SH.GUARD && w && w.near) msg = (d.write ? 'write' : 'read') + (w.before ? ' just before the start of ' : ' just past the end of ') + w.near + (w.before ? ' (an index below 0?)' : ' (buffer overflow)');
        if (st === SH.HEADER && w) msg = (d.write ? 'write to' : 'read from') + ' ' + w.text + ': the access ran past the end of the block before it (heap buffer overflow)';
        if (d.lib) msg = 'in ' + d.lib + '(): ' + msg;
      }
      if (d.smashed) title = 'Stack smashing detected';
      const r = { kind: f.kind, title, msg, at, detail: d, frames: this.frames.length + 1 };
      return r;
    }
  }

  function stmtAt(fn, pc) {
    const c = fn.code;
    let id = 0;
    for (let i = 0; i <= pc && i < c.length; i += SEE.Linker.opLen(c, i)) if (c[i] === OP.STMT) id = c[i + 1];
    return id;
  }

  function norm(k, v) {
    switch (k) {
      case 0: return (v << 24) >> 24;
      case 1: return v & 255;
      case 2: return (v << 16) >> 16;
      case 3: return v & 0xffff;
      case 4: return v | 0;
      case 5: return v >>> 0;
      case 6: return Math.fround(v);
      default: return v;
    }
  }
  function f2i(k, v) {
    if (v !== v || v >= 4294967296 || v <= -2147483649) return k === 5 ? 0 : k === 4 ? -2147483648 : 0;
    const t = Math.trunc(v);
    if (k === 4 && (t > 2147483647 || t < -2147483648)) return -2147483648;
    return norm(k, t);
  }

  SEE.Machine = Machine;
  SEE.Exit = Exit;
  SEE.vmNorm = norm;
  SEE.stmtAt = stmtAt;
})(SEE);
