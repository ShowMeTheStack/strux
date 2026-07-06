// The C library functions written in JavaScript: stdio streams and formatting, the heap allocator,
// strings, ctype, math, time, setjmp/longjmp. Every memory access goes through the checked memory,
// so a strcpy into a buffer that is too small is caught exactly where it overflows.
(function (SEE) {
  'use strict';
  const { Fault, SH, MEM, hex } = SEE;

  const F_READ = 1, F_WRITE = 2, F_EOF = 4, F_ERR = 8, F_OPEN = 16;
  const FILE_SIZE = 24;
  const HDR = 8;
  const MAGIC_USED = 0xa110c8ed, MAGIC_FREE = 0xf4eed000;
  const EOF = -1;
  const E = { EPERM: 1, ENOENT: 2, EIO: 5, EBADF: 9, ENOMEM: 12, EACCES: 13, EEXIST: 17, ENOTDIR: 20, EISDIR: 21, EINVAL: 22, EMFILE: 24, ENOSPC: 28, EDOM: 33, ERANGE: 34 };

  class NeedInput { }
  const NEED = new NeedInput();

  /** Reads arguments from the stack, one slot at a time */
  class Args {
    constructor(vm, p) { this.m = vm.mem; this.p = p; }
    i32() { const v = this.m.load(4, this.p); this.p += 4; return v; }
    u32() { const v = this.m.load(5, this.p); this.p += 4; return v; }
    ptr() { return this.u32(); }
    f64() { const v = this.m.load(7, this.p); this.p += 8; return v; }
  }

  const natives = {};
  /** def('name', (L, a) => value); `L` is the library state of the running machine */
  function def(name, fn, opts) { natives[name] = Object.assign({ fn: (vm, sp) => fn(vm.libc, new Args(vm, sp), vm) }, opts || {}); }

  // ---- library state per machine ------------------------------------------------------------------
  class Lib {
    constructor(vm) {
      this.vm = vm;
      this.mem = vm.mem;
      this.streams = new Map();
      this.blocks = [];        // heap blocks, sorted by address
      this.nextId = 1;
      this.randNext = 1;
      this.strtokPtr = 0;
      this.jmps = new Map();
      this.jmpToken = 1;
      this.input = [];         // bytes typed into the terminal, available to stdin
      this.inputEOF = false;
      this.heapOps = 0;
    }
    init() {
      const g = (n) => this.vm.prog.globals.find((x) => x.name === n && x.system);
      const iob = g('_iob');
      this.iob = iob ? iob.addr : 0;
      const er = g('errno');
      this.errnoAddr = er ? er.addr : 0;
      if (this.iob) {
        this.streams.set(this.iob, { addr: this.iob, fd: 0, kind: 'in', flags: F_READ | F_OPEN, ungot: [], name: 'stdin', mode: 1 });
        this.streams.set(this.iob + FILE_SIZE, { addr: this.iob + FILE_SIZE, fd: 1, kind: 'out', flags: F_WRITE | F_OPEN, buf: [], mode: 1, name: 'stdout' });
        this.streams.set(this.iob + 2 * FILE_SIZE, { addr: this.iob + 2 * FILE_SIZE, fd: 2, kind: 'out', flags: F_WRITE | F_OPEN, buf: [], mode: 2, name: 'stderr' });
      }
    }
    get stdin() { return this.streams.get(this.iob); }
    get stdout() { return this.streams.get(this.iob + FILE_SIZE); }
    get stderr() { return this.streams.get(this.iob + 2 * FILE_SIZE); }
    setErrno(v) { if (this.errnoAddr) this.mem.store(4, this.errnoAddr, v); }
    warn(key, msg) { this.vm.warnOnce(key, msg); }
    /** Keep state outside memory in step with stepping backwards */
    remember(obj, keys) {
      const j = this.mem.journal;
      if (!j) return;
      const saved = {};
      for (const k of keys) saved[k] = clone(obj[k]);
      j.later(() => { for (const k of keys) obj[k] = clone(saved[k]); });
    }

    // ---- streams --------------------------------------------------------------------------------
    stream(addr, fname) {
      const s = this.streams.get(addr);
      if (!s || !(s.flags & F_OPEN)) {
        if (!addr) throw new Fault('segv', fname + '() was given a NULL FILE pointer (did fopen fail?)', { addr: 0 });
        throw new Fault('check', fname + '() was given 0x' + hex(addr) + ', which is not an open FILE', { addr });
      }
      return s;
    }
    mirror(s) {
      // keep the FILE structure in memory showing the stream's state
      if (!s.addr) return;
      const m = this.mem;
      const w = (off, v) => { const i = m.idx(s.addr + off, 4); if (i >= 0) { if (m.journal) m.journal.record(i, 4); m.dv.setUint32(i, v >>> 0, true); m.sh.fill(SH.INIT, i, i + 4); } };
      w(0, s.fd);
      w(4, s.flags);
      w(8, s.kind === 'out' ? s.buf.length : s.kind === 'file' ? (s.wbuf ? s.wbuf : 0) : 0);
      w(12, s.mode === undefined ? 0 : s.mode);
      w(16, s.kind === 'file' ? s.pos : 0);
      w(20, s.nameAddr || 0);
    }
    putBytes(s, bytes) {
      if (!(s.flags & F_WRITE)) { s.flags |= F_ERR; this.mirror(s); this.setErrno(E.EBADF); return false; }
      if (s.kind === 'out') {
        this.remember(s, ['buf']);   // stepping back takes buffered output back too
        for (const b of bytes) {
          s.buf.push(b);
          if (s.mode === 2 || (s.mode === 1 && b === 10) || s.buf.length >= (s.bufsize || 1024)) this.flushOut(s);
        }
        this.mirror(s);
        return true;
      }
      if (s.kind === 'file') {
        if (s.append) s.pos = s.size;
        this.ensure(s, s.pos + bytes.length);
        s.data.set(bytes, s.pos);
        s.pos += bytes.length;
        if (s.pos > s.size) s.size = s.pos;
        s.dirty = true;
        s.lastOp = 'w';
        this.mirror(s);
        return true;
      }
      return false;
    }
    flushOut(s) {
      if (s.kind === 'out' && s.buf.length) {
        this.remember(s, ['buf']);
        const b = Uint8Array.from(s.buf);
        s.buf.length = 0;
        const io = this.vm.io;
        if (io.write) io.write(s.fd, b);
        this.vm.emit('output', s.fd, b);
      }
      if (s.kind === 'file' && s.dirty) this.writeBack(s);
      this.mirror(s);
    }
    flushAll() { for (const s of this.streams.values()) if (s.flags & F_OPEN) this.flushOut(s); }
    ensure(s, n) {
      if (n <= s.data.length) return;
      const d = new Uint8Array(Math.max(n, s.data.length * 2, 256));
      d.set(s.data.subarray(0, s.size));
      s.data = d;
    }
    writeBack(s) {
      const vfs = this.vm.io.vfs;
      try {
        if (vfs) vfs.writeFile(s.path, s.data.slice(0, s.size));
        s.dirty = false;
      } catch (e) {
        s.flags |= F_ERR;
        this.setErrno(E.EACCES);
        this.warn('wb:' + s.path, 'could not write ' + s.path + ': ' + e.message);
      }
    }
    /** Next byte from a stream; throws NEED when the terminal has nothing yet */
    peekByte(s, k) {
      k = k || 0;
      if (s.ungot.length > k) return s.ungot[s.ungot.length - 1 - k];
      k -= s.ungot.length;
      if (s.kind === 'in') {
        if (k < this.input.length) return this.input[k];
        if (this.inputEOF) return EOF;
        throw NEED;
      }
      if (s.kind === 'file') {
        if (s.pos + k < s.size) return s.data[s.pos + k];
        return EOF;
      }
      return EOF;
    }
    takeByte(s) {
      if (s.ungot.length) return s.ungot.pop();
      if (s.kind === 'in') {
        if (this.input.length) return this.input.shift();
        return EOF;
      }
      if (s.kind === 'file') {
        if (s.pos < s.size) return s.data[s.pos++];
        return EOF;
      }
      return EOF;
    }
    /** Before reading from the terminal, line-buffered output is flushed */
    beforeRead(s) {
      if (!(s.flags & F_READ)) { s.flags |= F_ERR; this.mirror(s); this.setErrno(E.EBADF); return false; }
      if (s.kind === 'in') { const o = this.stdout; if (o && o.mode !== 0) this.flushOut(o); else if (o) this.flushOut(o); }
      if (s.kind === 'file' && s.lastOp === 'w' && s.mode !== 'rw-ok') { /* C requires fflush/fseek between write and read; tolerated */ }
      return true;
    }
    /** Run a reading operation; returns BLOCK when it must wait for the terminal */
    reading(s, fn) {
      const saved = this.input.length;
      try { return fn(); } catch (e) {
        if (e === NEED) { void saved; this.vm.waitingFor = s; return this.vm.BLOCK(); }
        throw e;
      }
    }

    // ---- heap -----------------------------------------------------------------------------------
    findBlock(p) {
      const b = this.blocks;
      let lo = 0, hi = b.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (b[mid].addr === p) return mid;
        if (b[mid].addr < p) lo = mid + 1; else hi = mid - 1;
      }
      return -1;
    }
    blockContaining(p) {
      for (const b of this.blocks) if (p >= b.addr - HDR && p < b.addr + b.cap) return b;
      return null;
    }
    malloc(n, fname) {
      n = n >>> 0;
      if (n > MEM.LOW_SIZE) { this.setErrno(E.ENOMEM); return 0; }   // more than the whole heap could ever hold
      const cap = Math.max(8, Math.ceil(n / 8) * 8);
      this.remember(this, ['blocks', 'nextId']);
      const m = this.mem;
      const brkBefore = m.brk;
      if (m.journal) m.journal.later(() => { m.brk = brkBefore; });
      let blk = null;
      for (let i = 0; i < this.blocks.length; i++) {
        const b = this.blocks[i];
        if (!b.free || b.cap < cap) continue;
        // split when the rest can hold a header and a small block
        if (b.cap - cap >= HDR + 8) {
          const rest = { addr: b.addr + cap + HDR, cap: b.cap - cap - HDR, size: 0, free: true, id: 0 };
          b.cap = cap;
          this.blocks.splice(i + 1, 0, rest);
          this.writeHeader(rest);
          m.setShadow(rest.addr - HDR, HDR, SH.HEADER);
        }
        blk = b;
        break;
      }
      if (!blk) {
        const addr = m.brk + HDR;
        if (addr + cap > MEM.LOW_BASE + MEM.LOW_SIZE) { this.setErrno(E.ENOMEM); return 0; }
        blk = { addr, cap, size: 0, free: true, id: 0 };
        this.blocks.push(blk);
        m.brk = addr + cap;
        m.setShadow(addr - HDR, HDR, SH.HEADER);
      }
      blk.free = false;
      blk.size = n;
      blk.id = this.nextId++;
      blk.site = this.vm.where();
      blk.by = fname || 'malloc';
      blk.frames = this.vm.frames.length;
      this.writeHeader(blk);
      m.setShadow(blk.addr, n, SH.UNINIT);
      m.setShadow(blk.addr + n, blk.cap - n, SH.GUARD);
      this.heapOps++;
      this.vm.emit('heap', 'malloc', blk);
      return blk.addr;
    }
    writeHeader(b) {
      const m = this.mem;
      const i = m.idx(b.addr - HDR, HDR);
      if (m.journal) m.journal.record(i, HDR);
      m.dv.setUint32(i, b.free ? b.cap : b.size, true);
      m.dv.setUint32(i + 4, b.free ? MAGIC_FREE : MAGIC_USED, true);
    }
    free(p, fname) {
      if (!p) return;
      const i = this.findBlock(p);
      const m = this.mem;
      if (i < 0) {
        const inside = this.blockContaining(p);
        if (inside && !inside.free) throw new Fault('check', (fname || 'free') + '() was given 0x' + hex(p) + ', which points into the middle of a block (it starts at 0x' + hex(inside.addr) + ')', { addr: p, heap: true });
        if (p >= MEM.STACK_LO && p < MEM.STACK_TOP) throw new Fault('check', (fname || 'free') + '() was given 0x' + hex(p) + ', a stack address: only memory from malloc, calloc or realloc can be freed', { addr: p });
        throw new Fault('check', (fname || 'free') + '() was given 0x' + hex(p) + ', which did not come from malloc, calloc or realloc', { addr: p });
      }
      const b = this.blocks[i];
      if (b.free) throw new Fault('check', 'double free: the block at 0x' + hex(p) + ' was already freed' + (b.freedAt ? ' at line ' + b.freedAt.line : ''), { addr: p, heap: true, doubleFree: true });
      this.remember(this, ['blocks']);
      b.free = true;
      b.freedAt = this.vm.where();
      b.size = 0;
      m.setShadow(b.addr, b.cap, SH.FREED);
      this.writeHeader(b);
      this.heapOps++;
      this.vm.emit('heap', 'free', b);
      // merge with free neighbours
      const next = this.blocks[i + 1];
      if (next && next.free && b.addr + b.cap + HDR === next.addr) {
        m.setShadow(next.addr - HDR, HDR, SH.FREED);
        b.cap += next.cap + HDR;
        this.blocks.splice(i + 1, 1);
        this.writeHeader(b);
      }
      const prev = this.blocks[i - 1];
      if (prev && prev.free && prev.addr + prev.cap + HDR === b.addr) {
        m.setShadow(b.addr - HDR, HDR, SH.FREED);
        prev.cap += b.cap + HDR;
        prev.freedAt = b.freedAt;
        this.blocks.splice(i, 1);
        this.writeHeader(prev);
      }
    }
    realloc(p, n) {
      if (!p) return this.malloc(n, 'realloc');
      if (!n) { this.free(p, 'realloc'); return 0; }
      const i = this.findBlock(p);
      if (i < 0 || this.blocks[i].free) {
        if (i >= 0) throw new Fault('check', 'realloc() of a block that was already freed (0x' + hex(p) + ')', { addr: p, heap: true });
        this.free(p, 'realloc');
      }
      const b = this.blocks[i];
      const m = this.mem;
      if (n <= b.cap) {
        this.remember(this, ['blocks']);
        const old = b.size;
        b.size = n;
        if (n > old) m.setShadow(b.addr + old, n - old, SH.UNINIT);
        m.setShadow(b.addr + n, b.cap - n, SH.GUARD);
        this.writeHeader(b);
        return p;
      }
      // room after the block? grow it where it is: the end of the heap, or a free neighbour big enough
      if (n > MEM.LOW_SIZE) { this.setErrno(E.ENOMEM); return 0; }
      const need = Math.ceil(n / 8) * 8;
      const next = this.blocks[i + 1];
      if (!next && b.addr + b.cap === m.brk && b.addr + need <= MEM.LOW_BASE + MEM.LOW_SIZE) {
        this.remember(this, ['blocks']);
        const brkBefore = m.brk;
        if (m.journal) m.journal.later(() => { m.brk = brkBefore; });
        const old = b.size;
        b.cap = need; b.size = n;
        m.brk = b.addr + need;
        m.setShadow(b.addr + old, n - old, SH.UNINIT);
        m.setShadow(b.addr + n, b.cap - n, SH.GUARD);
        this.writeHeader(b);
        return p;
      }
      if (next && next.free && b.addr + b.cap + HDR === next.addr && b.cap + HDR + next.cap >= need) {
        this.remember(this, ['blocks']);
        const old = b.size;
        const total = b.cap + HDR + next.cap;
        this.blocks.splice(i + 1, 1);
        b.cap = total;
        if (total - need >= HDR + 8) {
          // keep the rest as a free block
          const rest = { addr: b.addr + need + HDR, cap: total - need - HDR, size: 0, free: true, id: 0 };
          b.cap = need;
          this.blocks.splice(i + 1, 0, rest);
          m.setShadow(rest.addr - HDR, HDR, SH.HEADER);
          m.setShadow(rest.addr, rest.cap, SH.FREED);
          this.writeHeader(rest);
        }
        b.size = n;
        m.setShadow(b.addr + old, n - old, SH.UNINIT);
        m.setShadow(b.addr + n, b.cap - n, SH.GUARD);
        this.writeHeader(b);
        return p;
      }
      const q = this.malloc(n, 'realloc');
      if (!q) return 0;
      m.copy(q, p, b.size);
      this.free(p, 'realloc');
      return q;
    }
    leaks() { return this.blocks.filter((b) => !b.free); }
  }

  function clone(v) {
    if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? Object.assign({}, x) : x));
    if (v && typeof v === 'object') return Object.assign({}, v);
    return v;
  }

  // ---- startup and exit ---------------------------------------------------------------------------
  def('__argc', (L, a, vm) => vm.argc);
  def('__argv', (L, a, vm) => vm.argvAddr);
  def('__envp', (L, a, vm) => vm.envAddr);
  def('__exit', (L, a) => {
    const code = a.i32();
    L.flushAll();
    throw new SEE.Exit(code);
  });
  def('__abort', (L, a) => {
    const sig = a.i32();
    L.lostOutput = L.stdout ? L.stdout.buf.length : 0;
    const names = { 2: 'SIGINT', 4: 'SIGILL', 6: 'SIGABRT', 8: 'SIGFPE', 11: 'SIGSEGV', 15: 'SIGTERM' };
    L.flushOut(L.stderr);
    throw new Fault('abort', sig === 6 ? 'abort() was called' : 'the program was stopped by signal ' + (names[sig] || sig), { signal: sig });
  });
  def('__huge_val', () => Infinity);
  def('system', (L, a) => { const p = a.ptr(); return p ? -1 : 0; });
  def('getenv', (L, a, vm) => {
    const name = L.mem.cstr(a.ptr());
    const env = vm.io.env || ['HOME=/home/user', 'PATH=/bin:/usr/bin', 'USER=user'];
    for (let k = 0; k < env.length; k++) {
      if (env[k].startsWith(name + '=')) {
        const sp = L.mem.load(5, vm.envAddr + 4 * k);
        return sp + name.length + 1;
      }
    }
    return 0;
  });

  // ---- heap ---------------------------------------------------------------------------------------
  def('malloc', (L, a) => L.malloc(a.u32(), 'malloc'));
  def('calloc', (L, a) => {
    const n = a.u32(), s = a.u32();
    const total = n * s;
    if (total > 0xffffffff) { L.setErrno(E.ENOMEM); return 0; }
    const p = L.malloc(total, 'calloc');
    if (p && total) L.mem.fill(p, 0, total);
    return p;
  });
  def('realloc', (L, a) => { const p = a.ptr(); return L.realloc(p, a.u32()); });
  def('free', (L, a) => { L.free(a.ptr(), 'free'); });

  // ---- setjmp / longjmp ---------------------------------------------------------------------------
  def('setjmp', (L, a, vm) => {
    const env = a.ptr();
    const token = L.jmpToken++;
    L.jmps.set(token, { depth: vm.frames.length, fn: vm.fn, fp: vm.FP, sp: vm.SP, stack: vm.S.slice(), pc: vm.callNext, want: vm.callWant });   // the operand stack plays the part of saved registers
    const w = [0x5e7a3b00, vm.frames.length, vm.SP, vm.FP, (vm.fn.addr + vm.callNext) >>> 0, token];
    for (let k = 0; k < 6; k++) L.mem.store(5, env + 4 * k, w[k]);
    return 0;
  });
  def('longjmp', (L, a, vm) => {
    const env = a.ptr();
    let val = a.i32();
    if (L.mem.load(5, env) !== 0x5e7a3b00) throw new Fault('check', 'longjmp() with a jmp_buf that setjmp never filled in', { addr: env });
    const token = L.mem.load(5, env + 20);
    const st = L.jmps.get(token);
    if (!st) throw new Fault('check', 'longjmp() with a damaged jmp_buf', { addr: env });
    const depth = st.depth;
    const cur = vm.frames.length;
    let ok;
    if (depth === cur) ok = vm.fn === st.fn && vm.FP === st.fp;
    else ok = depth < cur && vm.frames[depth].fn === st.fn && vm.frames[depth].fp === st.fp;
    if (!ok) throw new Fault('check', 'longjmp() back into ' + st.fn.name + '(), which has already returned: the jmp_buf is out of date', { addr: env });
    if (!val) val = 1;
    if (L.mem.journal) {
      const frames = vm.frames, savedF = frames.slice(), savedS = vm.S.slice();
      L.mem.journal.later(() => { frames.length = 0; for (const x of savedF) frames.push(x); vm.S.length = 0; for (const x of savedS) vm.S.push(x); });
    }
    const oldSp = vm.SP;
    if (depth < cur) {
      const f = vm.frames[depth];
      vm.fn = f.fn; vm.FP = f.fp; vm.want = f.want; vm.retAddr = f.retAddr; vm.argBytes = f.argBytes;
      vm.frames.length = depth;
    }
    vm.SP = st.sp;
    if (st.sp > oldSp) L.mem.setShadow(oldSp, st.sp - oldSp, SH.NONE);
    vm.S.length = 0;
    for (const x of st.stack) vm.S.push(x);
    vm.code = vm.fn.code;
    vm.pc = st.pc;
    vm.depth = vm.frames.length;
    if (st.want) vm.S.push(val);
    vm.jumped = true;
    if (vm.debug) vm.emit('return', null);
    return 0;
  });

  // ---- ctype ----------------------------------------------------------------------------------------
  const ctype = (name, test) => def(name, (L, a) => {
    const c = a.i32();
    if (c !== EOF && (c < 0 || c > 255)) L.warn('ctype:' + name, name + '(' + c + '): the argument must be EOF or an unsigned char value (cast a char to unsigned char first)');
    const x = c & 255;
    return c === EOF ? 0 : test(x) ? 1 : 0;
  });
  const isU = (c) => c >= 65 && c <= 90, isL = (c) => c >= 97 && c <= 122, isD = (c) => c >= 48 && c <= 57;
  ctype('isalnum', (c) => isU(c) || isL(c) || isD(c));
  ctype('isalpha', (c) => isU(c) || isL(c));
  ctype('iscntrl', (c) => c < 32 || c === 127);
  ctype('isdigit', isD);
  ctype('isgraph', (c) => c > 32 && c < 127);
  ctype('islower', isL);
  ctype('isprint', (c) => c >= 32 && c < 127);
  ctype('ispunct', (c) => c > 32 && c < 127 && !isU(c) && !isL(c) && !isD(c));
  ctype('isspace', (c) => c === 32 || (c >= 9 && c <= 13));
  ctype('isupper', isU);
  ctype('isxdigit', (c) => isD(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102));
  def('tolower', (L, a) => { const c = a.i32(); return isU(c) ? c + 32 : c; });
  def('toupper', (L, a) => { const c = a.i32(); return isL(c) ? c - 32 : c; });

  // ---- strings --------------------------------------------------------------------------------------
  /** Write bytes, faulting at the exact first byte that cannot be written */
  function put(L, addr, bytes) {
    try { L.mem.writeBytes(addr, bytes); } catch (e) {
      if (!(e instanceof Fault)) throw e;
      for (let k = 0; k < bytes.length; k++) L.mem.store(1, addr + k, bytes[k]);
    }
  }
  function get(L, addr, n) {
    try { return L.mem.readBytes(addr, n); } catch (e) {
      if (!(e instanceof Fault)) throw e;
      const out = new Uint8Array(n);
      for (let k = 0; k < n; k++) out[k] = L.mem.load(1, addr + k);
      return out;
    }
  }
  const strBytes = (L, p) => get(L, p, L.mem.strlen(p) + 1);
  const overlap = (a, n, b, m) => a < b + m && b < a + n;

  def('strlen', (L, a) => L.mem.strlen(a.ptr()));
  def('strcpy', (L, a) => {
    const d = a.ptr(), s = a.ptr();
    const b = strBytes(L, s);
    if (overlap(d, b.length, s, b.length) && d !== s) L.warn('ov:strcpy', 'strcpy() with overlapping source and destination: the result is undefined');
    put(L, d, b);
    return d;
  });
  def('strncpy', (L, a) => {
    const d = a.ptr(), s = a.ptr(), n = a.u32();
    const out = new Uint8Array(n);
    let k = 0;
    for (; k < n; k++) { const c = L.mem.load(1, s + k); if (!c) break; out[k] = c; }
    put(L, d, out);
    return d;
  });
  def('strcat', (L, a) => {
    const d = a.ptr(), s = a.ptr();
    const dl = L.mem.strlen(d);
    put(L, d + dl, strBytes(L, s));
    return d;
  });
  def('strncat', (L, a) => {
    const d = a.ptr(), s = a.ptr(), n = a.u32();
    const dl = L.mem.strlen(d);
    const out = [];
    for (let k = 0; k < n; k++) { const c = L.mem.load(1, s + k); if (!c) break; out.push(c); }
    out.push(0);
    put(L, d + dl, Uint8Array.from(out));
    return d;
  });
  const cmpBytes = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  def('strcmp', (L, a) => {
    const p = a.ptr(), q = a.ptr();
    for (let k = 0; ; k++) {
      const x = L.mem.load(1, p + k), y = L.mem.load(1, q + k);
      if (x !== y) return cmpBytes(x, y);
      if (!x) return 0;
    }
  });
  def('strcoll', (L, a) => natives.strcmp.fn(L.vm, a.p));
  def('strncmp', (L, a) => {
    const p = a.ptr(), q = a.ptr(), n = a.u32();
    for (let k = 0; k < n; k++) {
      const x = L.mem.load(1, p + k), y = L.mem.load(1, q + k);
      if (x !== y) return cmpBytes(x, y);
      if (!x) return 0;
    }
    return 0;
  });
  def('strxfrm', (L, a) => {
    const d = a.ptr(), s = a.ptr(), n = a.u32();
    const b = strBytes(L, s);
    if (n >= b.length) put(L, d, b);
    return b.length - 1;
  });
  def('strchr', (L, a) => {
    const s = a.ptr(), c = a.i32() & 255;
    for (let k = 0; ; k++) { const x = L.mem.load(1, s + k); if (x === c) return s + k; if (!x) return 0; }
  });
  def('strrchr', (L, a) => {
    const s = a.ptr(), c = a.i32() & 255;
    let r = 0;
    for (let k = 0; ; k++) { const x = L.mem.load(1, s + k); if (x === c) r = s + k; if (!x) return r; }
  });
  const setOf = (L, p) => new Set(strBytes(L, p).slice(0, -1));
  def('strspn', (L, a) => { const s = a.ptr(); const set = setOf(L, a.ptr()); let k = 0; while (true) { const c = L.mem.load(1, s + k); if (!c || !set.has(c)) return k; k++; } });
  def('strcspn', (L, a) => { const s = a.ptr(); const set = setOf(L, a.ptr()); let k = 0; while (true) { const c = L.mem.load(1, s + k); if (!c || set.has(c)) return k; k++; } });
  def('strpbrk', (L, a) => { const s = a.ptr(); const set = setOf(L, a.ptr()); for (let k = 0; ; k++) { const c = L.mem.load(1, s + k); if (!c) return 0; if (set.has(c)) return s + k; } });
  def('strstr', (L, a) => {
    const h = a.ptr(), nd = a.ptr();
    const hs = strBytes(L, h), ns = strBytes(L, nd);
    const n = ns.length - 1;
    if (!n) return h;
    outer: for (let k = 0; k + n <= hs.length - 1; k++) {
      for (let j = 0; j < n; j++) if (hs[k + j] !== ns[j]) continue outer;
      return h + k;
    }
    return 0;
  });
  def('strtok', (L, a) => {
    let s = a.ptr();
    const set = setOf(L, a.ptr());
    L.remember(L, ['strtokPtr']);
    if (!s) s = L.strtokPtr;
    if (!s) return 0;
    while (L.mem.load(1, s) && set.has(L.mem.load(1, s))) s++;
    if (!L.mem.load(1, s)) { L.strtokPtr = 0; return 0; }
    const start = s;
    while (L.mem.load(1, s) && !set.has(L.mem.load(1, s))) s++;
    if (L.mem.load(1, s)) { L.mem.store(1, s, 0); L.strtokPtr = s + 1; } else L.strtokPtr = 0;
    return start;
  });
  def('memcpy', (L, a) => {
    const d = a.ptr(), s = a.ptr(), n = a.u32();
    if (n && overlap(d, n, s, n) && d !== s) L.warn('ov:memcpy', 'memcpy() with overlapping source and destination: use memmove() for that');
    if (!n) return d;
    try { L.mem.copy(d, s, n); } catch (e) { if (!(e instanceof Fault)) throw e; for (let k = 0; k < n; k++) L.mem.store(1, d + k, L.mem.load(1, s + k)); }
    return d;
  });
  def('memmove', (L, a) => {
    const d = a.ptr(), s = a.ptr(), n = a.u32();
    if (!n) return d;
    const b = get(L, s, n);
    put(L, d, b);
    return d;
  });
  def('memset', (L, a) => {
    const d = a.ptr(), c = a.i32(), n = a.u32();
    if (!n) return d;
    try { L.mem.fill(d, c, n); } catch (e) { if (!(e instanceof Fault)) throw e; for (let k = 0; k < n; k++) L.mem.store(1, d + k, c); }
    return d;
  });
  def('memcmp', (L, a) => {
    const p = a.ptr(), q = a.ptr(), n = a.u32();
    for (let k = 0; k < n; k++) { const x = L.mem.load(1, p + k), y = L.mem.load(1, q + k); if (x !== y) return cmpBytes(x, y); }
    return 0;
  });
  def('memchr', (L, a) => {
    const s = a.ptr(), c = a.i32() & 255, n = a.u32();
    for (let k = 0; k < n; k++) if (L.mem.load(1, s + k) === c) return s + k;
    return 0;
  });

  // ---- numbers from strings -------------------------------------------------------------------------
  /** Parse like strtol/strtoul; returns {v, end, range} where end is the offset after the number */
  function parseInt_(str, base, unsigned) {
    let i = 0;
    while (i < str.length && /[ \t\n\v\f\r]/.test(str[i])) i++;
    let neg = false;
    if (str[i] === '+' || str[i] === '-') { neg = str[i] === '-'; i++; }
    if ((base === 0 || base === 16) && str[i] === '0' && /[xX]/.test(str[i + 1] || '') && /[0-9a-fA-F]/.test(str[i + 2] || '')) { i += 2; base = 16; }
    else if (base === 0) base = str[i] === '0' ? 8 : 10;
    const start = i;
    let v = 0n;
    const B = BigInt(base);
    while (i < str.length) {
      const d = parseInt(str[i], 36);
      if (isNaN(d) || d >= base) break;
      v = v * B + BigInt(d);
      i++;
    }
    if (i === start) return { v: 0, end: 0, none: true };
    let range = false;
    let r;
    if (unsigned) {
      if (v > 0xffffffffn) { range = true; r = 0xffffffff; } else r = Number(neg ? (0x100000000n - v) % 0x100000000n : v);
    } else {
      if (neg) v = -v;
      if (v > 2147483647n) { range = true; r = 2147483647; } else if (v < -2147483648n) { range = true; r = -2147483648; } else r = Number(v);
    }
    return { v: r, end: i, range };
  }
  /** Parse a C floating constant prefix */
  function parseFloat_(str) {
    const m = /^[ \t\n\v\f\r]*([+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|inf(?:inity)?|nan))/i.exec(str);
    if (!m) return { v: 0, end: 0, none: true };
    let s = m[1];
    let v = /inf/i.test(s) ? (s[0] === '-' ? -Infinity : Infinity) : /nan/i.test(s) ? NaN : parseFloat(s);
    return { v, end: m[0].length, range: !isFinite(v) && !/inf|nan/i.test(s) };
  }
  const textAt = (L, p, max) => L.mem.cstr(p, max || 4096);
  def('atoi', (L, a) => parseInt_(textAt(L, a.ptr()), 10, false).v);
  def('atol', (L, a) => parseInt_(textAt(L, a.ptr()), 10, false).v);
  def('atof', (L, a) => parseFloat_(textAt(L, a.ptr())).v);
  def('strtol', (L, a) => {
    const p = a.ptr(), endp = a.ptr(), base = a.i32();
    const r = parseInt_(textAt(L, p), base, false);
    if (endp) L.mem.store(5, endp, p + r.end);
    if (r.range) L.setErrno(E.ERANGE);
    return r.v;
  });
  def('strtoul', (L, a) => {
    const p = a.ptr(), endp = a.ptr(), base = a.i32();
    const r = parseInt_(textAt(L, p), base, true);
    if (endp) L.mem.store(5, endp, p + r.end);
    if (r.range) L.setErrno(E.ERANGE);
    return r.v >>> 0;
  });
  def('strtod', (L, a) => {
    const p = a.ptr(), endp = a.ptr();
    const r = parseFloat_(textAt(L, p));
    if (endp) L.mem.store(5, endp, p + r.end);
    if (r.range) L.setErrno(E.ERANGE);
    return r.v;
  });

  // ---- rand: the portable generator the C standard gives as an example --------------------------------
  def('rand', (L) => {
    L.remember(L, ['randNext']);
    L.randNext = (Math.imul(L.randNext, 1103515245) + 12345) >>> 0;
    return Math.floor(L.randNext / 65536) % 32768;
  });
  def('srand', (L, a) => { L.remember(L, ['randNext']); L.randNext = a.u32(); });

  // ---- multibyte: only one-byte characters in the "C" locale -----------------------------------------
  def('mblen', (L, a) => { const s = a.ptr(); const n = a.u32(); if (!s) return 0; if (!n) return -1; return L.mem.load(1, s) ? 1 : 0; });
  def('mbtowc', (L, a) => { const pw = a.ptr(), s = a.ptr(), n = a.u32(); if (!s) return 0; if (!n) return -1; const c = L.mem.load(1, s); if (pw) L.mem.store(4, pw, c); return c ? 1 : 0; });
  def('wctomb', (L, a) => { const s = a.ptr(), w = a.i32(); if (!s) return 0; if (w < 0 || w > 255) return -1; L.mem.store(1, s, w); return 1; });
  def('mbstowcs', (L, a) => { const pw = a.ptr(), s = a.ptr(), n = a.u32(); let k = 0; for (; k < n; k++) { const c = L.mem.load(1, s + k); if (pw) L.mem.store(4, pw + 4 * k, c); if (!c) break; } return k; });
  def('wcstombs', (L, a) => { const s = a.ptr(), pw = a.ptr(), n = a.u32(); let k = 0; for (; k < n; k++) { const c = L.mem.load(4, pw + 4 * k); if (s) L.mem.store(1, s + k, c); if (!c) break; } return k; });

  // ---- math -----------------------------------------------------------------------------------------
  const m1 = (name, f, domain) => def(name, (L, a) => {
    const x = a.f64();
    if (domain && !domain(x)) { L.setErrno(E.EDOM); return NaN; }
    const r = f(x);
    if (!isFinite(r) && isFinite(x)) L.setErrno(E.ERANGE);
    return r;
  });
  m1('acos', Math.acos, (x) => x >= -1 && x <= 1);
  m1('asin', Math.asin, (x) => x >= -1 && x <= 1);
  m1('atan', Math.atan);
  m1('cos', Math.cos);
  m1('sin', Math.sin);
  m1('tan', Math.tan);
  m1('cosh', Math.cosh);
  m1('sinh', Math.sinh);
  m1('tanh', Math.tanh);
  m1('exp', Math.exp);
  m1('log', (x) => (x === 0 ? -Infinity : Math.log(x)), (x) => x >= 0);
  m1('log10', (x) => (x === 0 ? -Infinity : Math.log10(x)), (x) => x >= 0);
  m1('sqrt', Math.sqrt, (x) => x >= 0 || x !== x);
  m1('ceil', Math.ceil);
  m1('floor', Math.floor);
  m1('fabs', Math.abs);
  def('atan2', (L, a) => { const y = a.f64(), x = a.f64(); return Math.atan2(y, x); });
  def('pow', (L, a) => {
    const x = a.f64(), y = a.f64();
    if (x < 0 && !Number.isInteger(y)) { L.setErrno(E.EDOM); return NaN; }
    if (x === 0 && y < 0) { L.setErrno(E.EDOM); return Infinity; }
    const r = Math.pow(x, y);
    if (!isFinite(r)) L.setErrno(E.ERANGE);
    return r;
  });
  def('fmod', (L, a) => { const x = a.f64(), y = a.f64(); if (y === 0) { L.setErrno(E.EDOM); return NaN; } return x % y; });
  def('ldexp', (L, a) => { const x = a.f64(), e = a.i32(); const r = x * Math.pow(2, e); if (!isFinite(r)) L.setErrno(E.ERANGE); return r; });
  def('frexp', (L, a) => {
    const x = a.f64(), ep = a.ptr();
    if (x === 0 || !isFinite(x)) { L.mem.store(4, ep, 0); return x; }
    let e = Math.max(-1073, Math.floor(Math.log2(Math.abs(x))) + 1);
    let m = x * Math.pow(2, -e);
    while (Math.abs(m) < 0.5) { m *= 2; e--; }
    while (Math.abs(m) >= 1) { m /= 2; e++; }
    L.mem.store(4, ep, e);
    return m;
  });
  def('modf', (L, a) => {
    const x = a.f64(), ip = a.ptr();
    const i = x < 0 ? Math.ceil(x) : Math.floor(x);
    L.mem.store(7, ip, i);
    return x - i;
  });

  // ---- time -----------------------------------------------------------------------------------------
  def('time', (L, a, vm) => {
    const p = a.ptr();
    const t = Math.floor((vm.io.now ? vm.io.now() : Date.now()) / 1000);
    if (p) L.mem.store(4, p, t);
    return t;
  });
  def('clock', (L, a, vm) => Math.floor(vm.ops / 40) | 0);
  def('difftime', (L, a) => { const t1 = a.i32(), t0 = a.i32(); return t1 - t0; });
  const TM = ['tm_sec', 'tm_min', 'tm_hour', 'tm_mday', 'tm_mon', 'tm_year', 'tm_wday', 'tm_yday', 'tm_isdst'];
  const readTm = (L, p) => { const o = {}; TM.forEach((k, i) => { o[k] = L.mem.load(4, p + 4 * i); }); return o; };
  const writeTm = (L, p, o) => TM.forEach((k, i) => L.mem.store(4, p + 4 * i, o[k]));
  function tmOf(t, utc) {
    const d = new Date(t * 1000);
    const g = (n) => (utc ? d['getUTC' + n]() : d['get' + n]());
    const y = g('FullYear');
    const start = utc ? Date.UTC(y, 0, 1) : new Date(y, 0, 1).getTime();
    return {
      tm_sec: g('Seconds'), tm_min: g('Minutes'), tm_hour: g('Hours'), tm_mday: g('Date'), tm_mon: g('Month'), tm_year: y - 1900,
      tm_wday: g('Day'), tm_yday: Math.floor((d.getTime() - start) / 86400000), tm_isdst: 0,
    };
  }
  def('__localtime', (L, a) => { const t = a.i32(), p = a.ptr(), utc = a.i32(); writeTm(L, p, tmOf(t, utc)); });
  def('mktime', (L, a) => {
    const p = a.ptr();
    const o = readTm(L, p);
    const d = new Date(o.tm_year + 1900, o.tm_mon, o.tm_mday, o.tm_hour, o.tm_min, o.tm_sec);
    const t = Math.floor(d.getTime() / 1000);
    if (!isFinite(t)) return -1;
    writeTm(L, p, tmOf(t, false));
    return t;
  });
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p2 = (n) => String(n).padStart(2, '0');
  def('__asctime', (L, a) => {
    const o = readTm(L, a.ptr()), buf = a.ptr();
    const s = DAYS[((o.tm_wday % 7) + 7) % 7].slice(0, 3) + ' ' + MONTHS[((o.tm_mon % 12) + 12) % 12].slice(0, 3) + ' ' + String(o.tm_mday).padStart(2, ' ') + ' ' +
      p2(o.tm_hour) + ':' + p2(o.tm_min) + ':' + p2(o.tm_sec) + ' ' + (o.tm_year + 1900) + '\n';
    put(L, buf, Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat([0])));
  });
  def('strftime', (L, a) => {
    const s = a.ptr(), max = a.u32(), f = L.mem.cstr(a.ptr()), o = readTm(L, a.ptr());
    const wd = ((o.tm_wday % 7) + 7) % 7, mo = ((o.tm_mon % 12) + 12) % 12;
    const out = f.replace(/%([aAbBcdHIjmMpSUwWxXyYZ%])/g, (m, c) => {
      switch (c) {
        case 'a': return DAYS[wd].slice(0, 3);
        case 'A': return DAYS[wd];
        case 'b': return MONTHS[mo].slice(0, 3);
        case 'B': return MONTHS[mo];
        case 'c': return DAYS[wd].slice(0, 3) + ' ' + MONTHS[mo].slice(0, 3) + ' ' + String(o.tm_mday).padStart(2, ' ') + ' ' + p2(o.tm_hour) + ':' + p2(o.tm_min) + ':' + p2(o.tm_sec) + ' ' + (o.tm_year + 1900);
        case 'd': return p2(o.tm_mday);
        case 'H': return p2(o.tm_hour);
        case 'I': return p2(((o.tm_hour + 11) % 12) + 1);
        case 'j': return String(o.tm_yday + 1).padStart(3, '0');
        case 'm': return p2(o.tm_mon + 1);
        case 'M': return p2(o.tm_min);
        case 'p': return o.tm_hour < 12 ? 'AM' : 'PM';
        case 'S': return p2(o.tm_sec);
        case 'U': return p2(Math.floor((o.tm_yday + 7 - wd) / 7));
        case 'w': return String(wd);
        case 'W': return p2(Math.floor((o.tm_yday + 7 - ((wd + 6) % 7)) / 7));
        case 'x': return p2(o.tm_mon + 1) + '/' + p2(o.tm_mday) + '/' + p2((o.tm_year + 1900) % 100);
        case 'X': return p2(o.tm_hour) + ':' + p2(o.tm_min) + ':' + p2(o.tm_sec);
        case 'y': return p2((o.tm_year + 1900) % 100);
        case 'Y': return String(o.tm_year + 1900);
        case 'Z': return 'UTC';
        case '%': return '%';
      }
      return m;
    });
    if (out.length + 1 > max) return 0;
    put(L, s, Uint8Array.from([...out].map((c) => c.charCodeAt(0) & 255).concat([0])));
    return out.length;
  });

  // ---- printf ---------------------------------------------------------------------------------------
  /** Format like printf. next(kind) gives the next argument: 'i' int, 'u' unsigned, 'd' double, 'p' pointer */
  function format(L, fmt, next) {
    let out = '';
    let i = 0;
    const n = fmt.length;
    while (i < n) {
      const c = fmt[i];
      if (c !== '%') { out += c; i++; continue; }
      const start = i;
      i++;
      let flags = '';
      while ('-+ #0'.includes(fmt[i]) && i < n) flags += fmt[i++];
      let width = null, prec = null;
      if (fmt[i] === '*') { width = next('i'); i++; if (width < 0) { flags += '-'; width = -width; } }
      else { let w = ''; while (/[0-9]/.test(fmt[i] || '')) w += fmt[i++]; if (w) width = +w; }
      if (fmt[i] === '.') {
        i++;
        if (fmt[i] === '*') { prec = next('i'); i++; if (prec < 0) prec = null; }
        else { let w = ''; while (/[0-9]/.test(fmt[i] || '')) w += fmt[i++]; prec = w ? +w : 0; }
      }
      let len = '';
      if ('hlL'.includes(fmt[i]) && i < n) len = fmt[i++];
      const conv = fmt[i++];
      const left = flags.includes('-'), plus = flags.includes('+'), space = flags.includes(' '), alt = flags.includes('#'), zero = flags.includes('0') && !left;
      const pad = (body, sign, numeric) => {
        let s = sign + body;
        if (width !== null && s.length < width) {
          if (left) s = s + ' '.repeat(width - s.length);
          else if (zero && numeric) s = sign + '0'.repeat(width - s.length) + body;
          else s = ' '.repeat(width - s.length) + s;
        }
        return s;
      };
      switch (conv) {
        case 'd': case 'i': {
          let v = next('i');
          if (len === 'h') v = (v << 16) >> 16;
          let body = Math.abs(v).toString();
          if (prec !== null) { body = body.padStart(prec, '0'); if (prec === 0 && v === 0) body = ''; }
          const sign = v < 0 ? '-' : plus ? '+' : space ? ' ' : '';
          out += pad(body, sign, prec === null);
          break;
        }
        case 'o': case 'u': case 'x': case 'X': {
          let v = next('u') >>> 0;
          if (len === 'h') v &= 0xffff;
          let body = v.toString(conv === 'o' ? 8 : conv === 'u' ? 10 : 16);
          if (conv === 'X') body = body.toUpperCase();
          if (prec !== null) { body = body.padStart(prec, '0'); if (prec === 0 && v === 0) body = ''; }
          let prefix = '';
          if (alt && conv === 'o' && body[0] !== '0') body = '0' + body;
          if (alt && (conv === 'x' || conv === 'X') && v !== 0) prefix = conv === 'x' ? '0x' : '0X';
          out += pad(body, prefix, prec === null);
          break;
        }
        case 'c': out += pad(String.fromCharCode(next('i') & 255), '', false); break;
        case 's': {
          const p = next('p');
          let s;
          if (!p) { s = '(null)'; L.warn('printf-null', 'printf was given a NULL pointer for %s (a real program may crash here)'); }
          else if (prec !== null) {
            s = '';
            for (let k = 0; k < prec; k++) { const ch = L.mem.load(1, p + k); if (!ch) break; s += String.fromCharCode(ch); }
          } else s = L.mem.cstr(p);
          out += pad(s, '', false);
          break;
        }
        case 'p': {
          const p = next('p') >>> 0;
          out += pad(p ? '0x' + p.toString(16) : '(nil)', '', false);
          break;
        }
        case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': {
          const v = next('d');
          const r = fmtFloat(v, conv, prec === null ? 6 : prec, alt);
          const neg = v < 0 || (v === 0 && 1 / v < 0);
          const sign = neg ? '-' : plus ? '+' : space ? ' ' : '';
          out += pad(r, sign, isFinite(v));
          break;
        }
        case 'n': { const p = next('p'); L.mem.store(4, p, out.length + (L.counted || 0)); break; }
        case '%': out += '%'; break;
        default:
          out += fmt.slice(start, i);
          L.warn('fmt:' + conv, "unknown conversion '%" + (conv || '') + "' in a printf format");
      }
    }
    return out;
  }
  function fmtFloat(v, conv, prec, alt) {
    const up = conv === 'E' || conv === 'G' || conv === 'F';
    const a = Math.abs(v);
    if (!isFinite(v)) return v !== v ? (up ? 'NAN' : 'nan') : (up ? 'INF' : 'inf');
    let s;
    if (conv === 'f' || conv === 'F') s = fixed(a, prec);
    else if (conv === 'e' || conv === 'E') s = expo(a, prec);
    else {
      const P = prec === 0 ? 1 : prec;
      const X = a === 0 ? 0 : parseInt(expo(a, P - 1).split('e')[1], 10);
      if (P > X && X >= -4) s = fixed(a, P - 1 - X);
      else s = expo(a, P - 1);
      if (!alt) {
        // remove trailing zeros (and a trailing point)
        const [m, e] = s.split('e');
        let mm = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
        s = mm + (e !== undefined ? 'e' + e : '');
      }
    }
    if (alt && prec === 0 && !s.includes('.')) s = s.replace(/^(\d+)/, '$1.');
    return up ? s.toUpperCase() : s;
  }
  // Exact decimal conversion of a double, rounding ties to even like a C library does
  function parts(a) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, a);
    const hi = dv.getUint32(0), lo = dv.getUint32(4);
    const ex = (hi >>> 20) & 0x7ff;
    let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    let e;
    if (ex === 0) e = -1074; else { mant |= 1n << 52n; e = ex - 1075; }
    return { mant, e };
  }
  /** round(a * 10^k) as a BigInt */
  function scaled(a, k) {
    const { mant, e } = parts(a);
    let num = mant, den = 1n;
    if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
    if (k >= 0) num *= 10n ** BigInt(k); else den *= 10n ** BigInt(-k);
    let q = num / den;
    const r = num % den;
    if (2n * r > den || (2n * r === den && (q & 1n))) q++;
    return q;
  }
  function fixed(a, prec) {
    const q = scaled(a, prec).toString().padStart(prec + 1, '0');
    return prec ? q.slice(0, q.length - prec) + '.' + q.slice(q.length - prec) : q;
  }
  function expo(a, prec) {
    let X = a === 0 ? 0 : Math.floor(Math.log10(a));
    let q;
    for (let tries = 0; tries < 3; tries++) {
      q = scaled(a, prec - X);
      const lim = 10n ** BigInt(prec + 1);
      if (q >= lim) { X++; continue; }
      if (a !== 0 && q < lim / 10n) { X--; continue; }
      break;
    }
    const d = q.toString().padStart(prec + 1, '0');
    const m = prec ? d[0] + '.' + d.slice(1) : d;
    return m + 'e' + (X < 0 ? '-' : '+') + String(Math.abs(X)).padStart(2, '0');
  }

  /** Arguments of printf: from the stack (a), or from a va_list pointer */
  function argSource(a) {
    return (k) => (k === 'd' ? a.f64() : k === 'u' || k === 'p' ? a.u32() : a.i32());
  }
  const bytesOf = (s) => { const b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k) & 255; return b; };
  const toStream = (L, s, text) => { if (!L.putBytes(s, bytesOf(text))) return EOF; return text.length; };

  def('printf', (L, a) => { const f = L.mem.cstr(a.ptr()); return toStream(L, L.stdout, format(L, f, argSource(a))); });
  def('fprintf', (L, a) => { const s = L.stream(a.ptr(), 'fprintf'); const f = L.mem.cstr(a.ptr()); return toStream(L, s, format(L, f, argSource(a))); });
  def('sprintf', (L, a) => { const d = a.ptr(); const f = L.mem.cstr(a.ptr()); const t = format(L, f, argSource(a)); put(L, d, bytesOf(t + '\0')); return t.length; });
  const vaSource = (L, ap) => { const a = new Args(L.vm, ap); return argSource(a); };
  def('vprintf', (L, a) => { const f = L.mem.cstr(a.ptr()); return toStream(L, L.stdout, format(L, f, vaSource(L, a.ptr()))); });
  def('vfprintf', (L, a) => { const s = L.stream(a.ptr(), 'vfprintf'); const f = L.mem.cstr(a.ptr()); return toStream(L, s, format(L, f, vaSource(L, a.ptr()))); });
  def('vsprintf', (L, a) => { const d = a.ptr(); const f = L.mem.cstr(a.ptr()); const t = format(L, f, vaSource(L, a.ptr())); put(L, d, bytesOf(t + '\0')); return t.length; });

  // ---- character output -----------------------------------------------------------------------------
  def('putchar', (L, a) => { const c = a.i32() & 255; return L.putBytes(L.stdout, [c]) ? c : EOF; });
  def('fputc', (L, a) => { const c = a.i32() & 255; const s = L.stream(a.ptr(), 'fputc'); return L.putBytes(s, [c]) ? c : EOF; });
  natives.putc = natives.fputc;
  def('puts', (L, a) => { const b = strBytes(L, a.ptr()); b[b.length - 1] = 10; return L.putBytes(L.stdout, b) ? 1 : EOF; });
  def('fputs', (L, a) => { const b = strBytes(L, a.ptr()).slice(0, -1); const s = L.stream(a.ptr(), 'fputs'); return L.putBytes(s, b) ? 1 : EOF; });
  def('fwrite', (L, a) => {
    const p = a.ptr(), size = a.u32(), n = a.u32();
    const s = L.stream(a.ptr(), 'fwrite');
    if (!size || !n) return 0;
    const b = get(L, p, size * n);
    return L.putBytes(s, b) ? n : 0;
  });
  def('fflush', (L, a) => {
    const p = a.ptr();
    if (!p) { L.flushAll(); return 0; }
    const s = L.stream(p, 'fflush');
    if (s.kind === 'in') { L.warn('fflush-stdin', 'fflush(stdin) is undefined in C; it does nothing here'); return 0; }
    L.flushOut(s);
    return 0;
  });
  def('setvbuf', (L, a) => {
    const s = L.stream(a.ptr(), 'setvbuf'); a.ptr();
    const mode = a.i32(), size = a.u32();
    if (mode < 0 || mode > 2) return -1;
    L.flushOut(s);
    s.mode = mode;
    if (size) s.bufsize = size;
    L.mirror(s);
    return 0;
  });
  def('setbuf', (L, a) => { const s = L.stream(a.ptr(), 'setbuf'); const b = a.ptr(); L.flushOut(s); s.mode = b ? (s.fd === 1 ? 1 : 0) : 2; L.mirror(s); });

  // ---- character input ------------------------------------------------------------------------------
  function getcFrom(L, s) {
    if (!L.beforeRead(s)) return EOF;
    return L.reading(s, () => {
      const c = L.peekByte(s);
      if (c === EOF) { s.flags |= F_EOF; L.mirror(s); return EOF; }
      L.takeByte(s);
      L.consumed(s);
      return c;
    });
  }
  Lib.prototype.consumed = function (s) { this.mirror(s); this.vm.emit('stdin', s); };
  def('getchar', (L) => getcFrom(L, L.stdin));
  def('fgetc', (L, a) => getcFrom(L, L.stream(a.ptr(), 'fgetc')));
  natives.getc = natives.fgetc;
  def('ungetc', (L, a) => {
    const c = a.i32(); const s = L.stream(a.ptr(), 'ungetc');
    if (c === EOF) return EOF;
    s.ungot.push(c & 255);
    s.flags &= ~F_EOF;
    L.mirror(s);
    return c & 255;
  });
  def('fgets', (L, a) => {
    const d = a.ptr(), n = a.i32(); const s = L.stream(a.ptr(), 'fgets');
    if (n <= 0) return 0;
    if (!L.beforeRead(s)) return 0;
    return L.reading(s, () => {
      // look ahead first, so nothing is taken until the whole line (or n-1 bytes) is there
      const line = [];
      let k = 0;
      for (; line.length < n - 1; k++) {
        const c = L.peekByte(s, k);
        if (c === EOF) break;
        line.push(c);
        if (c === 10) break;
      }
      if (!line.length) { s.flags |= F_EOF; L.mirror(s); return 0; }
      for (let j = 0; j < line.length; j++) L.takeByte(s);
      if (line.length < n - 1 && line[line.length - 1] !== 10) s.flags |= F_EOF;
      put(L, d, Uint8Array.from(line.concat([0])));
      L.consumed(s);
      return d;
    });
  });
  def('gets', (L, a) => {
    const d = a.ptr();
    const s = L.stdin;
    L.warn('gets', 'gets() cannot know how big the buffer is, and was removed from C later for that reason; use fgets()');
    if (!L.beforeRead(s)) return 0;
    return L.reading(s, () => {
      const line = [];
      let k = 0;
      for (;; k++) {
        const c = L.peekByte(s, k);
        if (c === EOF) { if (!line.length) { s.flags |= F_EOF; L.mirror(s); return 0; } break; }
        if (c === 10) { k++; break; }
        line.push(c);
      }
      for (let j = 0; j < k; j++) L.takeByte(s);
      put(L, d, Uint8Array.from(line.concat([0])));
      L.consumed(s);
      return d;
    });
  });
  def('fread', (L, a) => {
    const p = a.ptr(), size = a.u32(), n = a.u32(); const s = L.stream(a.ptr(), 'fread');
    if (!size || !n) return 0;
    if (!L.beforeRead(s)) return 0;
    return L.reading(s, () => {
      const want = size * n;
      const got = [];
      for (let k = 0; k < want; k++) {
        const c = L.peekByte(s, k);
        if (c === EOF) break;
        got.push(c);
      }
      for (let j = 0; j < got.length; j++) L.takeByte(s);
      if (got.length < want) s.flags |= F_EOF;
      const whole = Math.floor(got.length / size);
      if (got.length) put(L, p, Uint8Array.from(got));
      L.consumed(s);
      return whole;
    });
  });

  // ---- scanf ----------------------------------------------------------------------------------------
  /**
   * The scanf engine. src: {peek(k), take()} where peek may throw NEED. Writes go to the argument
   * pointers; returns the count (or EOF).
   */
  function scan(L, fmt, src, nextPtr) {
    let count = 0, consumed = 0;
    let i = 0;
    const isWs = (c) => c === 32 || (c >= 9 && c <= 13);
    let k = 0;   // look-ahead position (nothing is consumed until the end)
    const peek = () => src.peek(k);
    const adv = () => { k++; consumed++; };
    const skipWs = () => { while (true) { const c = peek(); if (c === EOF || !isWs(c)) return c; adv(); } };
    let inputFailure = false;
    outer: while (i < fmt.length) {
      const f = fmt.charCodeAt(i);
      if (isWs(f)) { i++; skipWs(); continue; }
      if (fmt[i] !== '%') {
        const c = peek();
        if (c === EOF) { inputFailure = true; break; }
        if (c !== f) break;
        adv(); i++;
        continue;
      }
      i++;
      let suppress = false;
      if (fmt[i] === '*') { suppress = true; i++; }
      let w = '';
      while (/[0-9]/.test(fmt[i] || '')) w += fmt[i++];
      let width = w ? +w : Infinity;
      let len = '';
      if ('hlL'.includes(fmt[i]) && i < fmt.length) len = fmt[i++];
      let conv = fmt[i++];
      if (conv === '%') {
        const c = skipWs();
        if (c !== 37) { if (c === EOF) inputFailure = true; break; }
        adv(); continue;
      }
      if (conv === 'n') { if (!suppress) store(nextPtr(), 'i', len, consumed); continue; }
      let set = null, negate = false;
      if (conv === '[') {
        negate = fmt[i] === '^';
        if (negate) i++;
        let body = '';
        if (fmt[i] === ']') { body += ']'; i++; }
        while (i < fmt.length && fmt[i] !== ']') body += fmt[i++];
        i++;
        set = new Set();
        for (let j = 0; j < body.length; j++) {
          if (body[j + 1] === '-' && j + 2 < body.length) { for (let x = body.charCodeAt(j); x <= body.charCodeAt(j + 2); x++) set.add(x); j += 2; }
          else set.add(body.charCodeAt(j));
        }
      }
      if (conv !== 'c' && conv !== '[') {
        const c = skipWs();
        if (c === EOF) { inputFailure = true; break; }
      }
      if (conv === 'c') {
        if (width === Infinity) width = 1;
        const got = [];
        for (let j = 0; j < width; j++) { const c = peek(); if (c === EOF) break; got.push(c); adv(); }
        if (!got.length) { inputFailure = true; break; }
        if (got.length < width) break;
        if (!suppress) { put(L, nextPtr(), Uint8Array.from(got)); count++; }
        continue;
      }
      if (conv === 's' || conv === '[') {
        const got = [];
        while (got.length < width) {
          const c = peek();
          if (c === EOF) break;
          if (conv === 's' ? isWs(c) : (negate ? set.has(c) : !set.has(c))) break;
          got.push(c); adv();
        }
        if (!got.length) { if (peek() === EOF) inputFailure = true; break; }
        if (!suppress) { put(L, nextPtr(), Uint8Array.from(got.concat([0]))); count++; }
        continue;
      }
      // numbers: collect the longest prefix that can start a number of this kind
      let text = '';
      const take = () => { text += String.fromCharCode(peek()); adv(); };
      const isDigitIn = (c, base) => { const d = parseInt(String.fromCharCode(c), 36); return !isNaN(d) && d < base && c !== EOF; };
      if ('diouxXp'.includes(conv)) {
        let base = conv === 'o' ? 8 : conv === 'x' || conv === 'X' || conv === 'p' ? 16 : conv === 'i' ? 0 : 10;
        if (text.length < width && (peek() === 43 || peek() === 45)) take();
        if (text.length < width && (base === 0 || base === 16) && peek() === 48) {
          take();
          if (text.length < width && (peek() === 120 || peek() === 88)) { take(); base = 16; }
          else if (base === 0) base = 8;
        }
        if (base === 0) base = 10;
        while (text.length < width && isDigitIn(peek(), base)) take();
        const digits = text.replace(/^[+-]?(0[xX])?/, '');
        if (!digits.length && !/^[+-]?0/.test(text)) break;
        const r = parseInt_(text, base, conv !== 'd' && conv !== 'i');
        if (!suppress) { store(nextPtr(), conv === 'd' || conv === 'i' ? 'i' : 'u', len, r.v); count++; }
        continue;
      }
      if ('eEfgG'.includes(conv)) {
        if (text.length < width && (peek() === 43 || peek() === 45)) take();
        let digits = 0;
        while (text.length < width && isDigitIn(peek(), 10)) { take(); digits++; }
        if (text.length < width && peek() === 46) { take(); while (text.length < width && isDigitIn(peek(), 10)) { take(); digits++; } }
        if (!digits) break;
        if (text.length < width && (peek() === 101 || peek() === 69)) {
          take();
          if (text.length < width && (peek() === 43 || peek() === 45)) take();
          while (text.length < width && isDigitIn(peek(), 10)) take();
        }
        const v = parseFloat(text);
        if (!suppress) { store(nextPtr(), len === 'l' || len === 'L' ? 'd' : 'f', '', v); count++; }
        continue;
      }
      L.warn('scanf:' + conv, "unknown conversion '%" + conv + "' in a scanf format");
      break outer;
    }
    // commit what was read
    for (let j = 0; j < k; j++) src.take();
    if (inputFailure && count === 0) return EOF;
    return count;

    function store(p, kind, len, v) {
      if (kind === 'd') { L.mem.store(7, p, v); return; }
      if (kind === 'f') { L.mem.store(6, p, v); return; }
      if (len === 'h') { L.mem.store(kind === 'i' ? 2 : 3, p, v); return; }
      L.mem.store(kind === 'i' ? 4 : 5, p, v);
    }
  }
  function streamSrc(L, s) { return { peek: (k) => L.peekByte(s, k), take: () => L.takeByte(s) }; }
  function scanStream(L, s, fmtAddr, a) {
    const fmt = L.mem.cstr(fmtAddr);
    if (!L.beforeRead(s)) return EOF;
    const start = a.p;
    return L.reading(s, () => {
      a.p = start;
      const r = scan(L, fmt, streamSrc(L, s), () => a.ptr());
      if (L.peekByteSafe(s) === EOF) { s.flags |= F_EOF; }
      L.consumed(s);
      return r;
    });
  }
  Lib.prototype.peekByteSafe = function (s) { try { return this.peekByte(s); } catch (e) { return 0; } };
  def('scanf', (L, a) => scanStream(L, L.stdin, a.ptr(), a));
  def('fscanf', (L, a) => { const s = L.stream(a.ptr(), 'fscanf'); return scanStream(L, s, a.ptr(), a); });
  def('sscanf', (L, a) => {
    const str = a.ptr(); const fmt = L.mem.cstr(a.ptr());
    const text = strBytes(L, str);
    let pos = 0;
    return scan(L, fmt, { peek: (k) => (pos + k < text.length - 1 ? text[pos + k] : EOF), take: () => text[pos++] }, () => a.ptr());
  });

  // ---- files ----------------------------------------------------------------------------------------
  function resolvePath(L, name) {
    const io = L.vm.io;
    if (!io.vfs) return null;
    if (name.startsWith('/')) return name;
    const cwd = io.cwd || '/';
    return (cwd.endsWith('/') ? cwd : cwd + '/') + name;
  }
  function openFile(L, name, mode, slotAddr) {
    const m = /^([rwa])(b?)(\+?)(b?)$/.exec(mode);
    if (!m) { L.setErrno(E.EINVAL); return 0; }
    const io = L.vm.io;
    const vfs = io.vfs;
    if (!vfs) { L.setErrno(E.ENOENT); return 0; }
    const path = resolvePath(L, name);
    let data = null;
    try {
      if (vfs.exists(path)) {
        if (vfs.isDir(path)) { L.setErrno(E.EISDIR); return 0; }
        data = vfs.readFile(path);
      }
    } catch (e) { data = null; }
    const kind = m[1], plus = !!m[3];
    if (kind === 'r' && !data) { L.setErrno(E.ENOENT); return 0; }
    const parent = path.replace(/\/[^/]*$/, '') || '/';
    if (!vfs.exists(parent)) { L.setErrno(E.ENOENT); return 0; }
    if (!vfs.isDir(parent)) { L.setErrno(E.ENOTDIR); return 0; }
    if (kind !== 'r') {
      try {
        const can = vfs.canWrite ? vfs.canWrite(path) : 'yes';
        if (can === 'no' || (can === 'ask' && !(io.allowWrite && io.allowWrite(path)))) { L.setErrno(E.EACCES); return 0; }
      } catch (e) { L.setErrno(E.EACCES); return 0; }
    }
    let addr = slotAddr;
    if (!addr) {
      for (let k = 3; k < 20; k++) {
        const a = L.iob + k * FILE_SIZE;
        const s = L.streams.get(a);
        if (!s || !(s.flags & F_OPEN)) { addr = a; break; }
      }
    }
    if (!addr) { L.setErrno(E.EMFILE); return 0; }
    L.remember(L, ['streams']);
    const bytes = kind === 'w' || !data ? new Uint8Array(0) : data;
    const s = {
      addr, fd: (addr - L.iob) / FILE_SIZE, kind: 'file', path, name, flags: F_OPEN | (kind === 'r' || plus ? F_READ : 0) | (kind !== 'r' || plus ? F_WRITE : 0),
      data: new Uint8Array(Math.max(256, bytes.length)), size: bytes.length, pos: kind === 'a' ? bytes.length : 0, append: kind === 'a', ungot: [], mode: 0, dirty: kind === 'w',
    };
    s.data.set(bytes);
    if (kind === 'w' || (kind === 'a' && !data)) L.writeBack(s);
    if (s.flags & F_ERR) { L.setErrno(E.EACCES); return 0; }
    // keep a copy of the name in memory for the FILE structure? the name field stays NULL
    L.streams = new Map(L.streams);
    L.streams.set(addr, s);
    L.mirror(s);
    L.vm.emit('file', 'open', s);
    return addr;
  }
  def('fopen', (L, a) => { const name = L.mem.cstr(a.ptr()); const mode = L.mem.cstr(a.ptr()); return openFile(L, name, mode, 0); });
  def('freopen', (L, a) => {
    const name = L.mem.cstr(a.ptr()); const mode = L.mem.cstr(a.ptr()); const old = a.ptr();
    const s = L.streams.get(old);
    if (s && (s.flags & F_OPEN)) closeStream(L, s);
    return openFile(L, name, mode, old);
  });
  function closeStream(L, s) {
    L.flushOut(s);
    L.remember(L, ['streams']);
    L.streams = new Map(L.streams);
    const c = Object.assign({}, s, { flags: 0 });
    L.streams.set(s.addr, c);
    if (s.temp && L.vm.io.vfs) { try { L.vm.io.vfs.unlink(s.path); } catch (e) { /* gone */ } }
    L.mirror(c);
    L.vm.emit('file', 'close', s);
  }
  def('fclose', (L, a) => {
    const s = L.stream(a.ptr(), 'fclose');
    const err = s.flags & F_ERR;
    closeStream(L, s);
    return err ? EOF : 0;
  });
  def('tmpfile', (L) => {
    L.tmpCount = (L.tmpCount || 0) + 1;
    const p = openFile(L, '/tmp/tmpfile' + L.tmpCount, 'w+b', 0);
    if (p) L.streams.get(p).temp = true;
    return p;
  });
  const errnoOf = (e) => (e && e.code && E[e.code]) || (e && /no such|not found/i.test(e.message) ? E.ENOENT : E.EACCES);
  def('remove', (L, a) => {
    const path = resolvePath(L, L.mem.cstr(a.ptr()));
    const vfs = L.vm.io.vfs;
    try {
      if (!vfs.exists(path)) { L.setErrno(E.ENOENT); return -1; }
      if (vfs.isDir(path)) vfs.rmdir(path); else vfs.unlink(path);
      return 0;
    } catch (e) { L.setErrno(errnoOf(e)); return -1; }
  });
  def('rename', (L, a) => {
    const from = resolvePath(L, L.mem.cstr(a.ptr())), to = resolvePath(L, L.mem.cstr(a.ptr()));
    const vfs = L.vm.io.vfs;
    try {
      if (!vfs.exists(from)) { L.setErrno(E.ENOENT); return -1; }
      // as on Unix, renaming onto an existing file replaces it
      if (vfs.exists(to) && !vfs.isDir(to) && from.toLowerCase() !== to.toLowerCase()) vfs.unlink(to);
      vfs.rename(from, to);
      return 0;
    } catch (e) { L.setErrno(errnoOf(e)); return -1; }
  });
  def('fseek', (L, a) => {
    const s = L.stream(a.ptr(), 'fseek'); const off = a.i32(), whence = a.i32();
    if (s.kind !== 'file') { L.setErrno(E.EBADF); return -1; }
    const base = whence === 0 ? 0 : whence === 1 ? s.pos : whence === 2 ? s.size : null;
    if (base === null || base + off < 0) { L.setErrno(E.EINVAL); return -1; }
    L.remember(s, ['pos', 'ungot', 'flags']);
    s.pos = base + off;
    s.ungot = [];
    s.flags &= ~F_EOF;
    L.mirror(s);
    return 0;
  });
  def('ftell', (L, a) => { const s = L.stream(a.ptr(), 'ftell'); if (s.kind !== 'file') { L.setErrno(E.EBADF); return -1; } return s.pos - s.ungot.length; });
  def('rewind', (L, a) => { const s = L.stream(a.ptr(), 'rewind'); if (s.kind === 'file') { L.remember(s, ['pos', 'ungot', 'flags']); s.pos = 0; s.ungot = []; s.flags &= ~(F_EOF | F_ERR); L.mirror(s); } });
  def('fgetpos', (L, a) => { const s = L.stream(a.ptr(), 'fgetpos'); const p = a.ptr(); if (s.kind !== 'file') { L.setErrno(E.EBADF); return -1; } L.mem.store(4, p, s.pos - s.ungot.length); return 0; });
  def('fsetpos', (L, a) => { const s = L.stream(a.ptr(), 'fsetpos'); const p = a.ptr(); if (s.kind !== 'file') { L.setErrno(E.EBADF); return -1; } L.remember(s, ['pos', 'ungot', 'flags']); s.pos = L.mem.load(4, p); s.ungot = []; s.flags &= ~F_EOF; L.mirror(s); return 0; });
  def('feof', (L, a) => (L.stream(a.ptr(), 'feof').flags & F_EOF ? 1 : 0));
  def('ferror', (L, a) => (L.stream(a.ptr(), 'ferror').flags & F_ERR ? 1 : 0));
  def('clearerr', (L, a) => { const s = L.stream(a.ptr(), 'clearerr'); s.flags &= ~(F_EOF | F_ERR); L.mirror(s); });

  SEE.Libc = {
    natives,
    create: (vm) => new Lib(vm),
    format, scan, parseInt: parseInt_, parseFloat: parseFloat_, fmtFloat, E, F: { F_READ, F_WRITE, F_EOF, F_ERR, F_OPEN }, HDR, MAGIC_USED, MAGIC_FREE, FILE_SIZE,
  };
})(SEE);
