// The simulated 32-bit address space: segments, the byte store, and a shadow byte per address that
// remembers what each byte is (code, read-only data, uninitialised, initialised, heap header, guard, freed).
(function (SEE) {
  'use strict';

  const LOW_BASE = 0x08048000;            // where a 32-bit Linux program is loaded
  const LOW_SIZE = 8 * 1024 * 1024;       // text, rodata, data, bss and the heap
  const STACK_TOP = 0xC0000000;           // the stack starts here and grows down
  const STACK_SIZE = 1024 * 1024;
  const STACK_LO = STACK_TOP - STACK_SIZE;

  // shadow states
  const SH = { NONE: 0, CODE: 1, RODATA: 2, UNINIT: 3, INIT: 4, HEADER: 5, GUARD: 6, FREED: 7, CONTROL: 8 };
  const SH_NAMES = ['unmapped', 'code', 'read-only', 'uninitialised', 'initialised', 'heap header', 'guard', 'freed', 'frame link'];
  const KINDS = ['i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'f32', 'f64'];
  const KSIZE = [1, 1, 2, 2, 4, 4, 4, 8];

  class Fault extends Error {
    /** kind: 'segv' | 'fpe' | 'abort' | 'bus' | 'check'; detail: extra facts for the explanation */
    constructor(kind, msg, detail) { super(msg); this.kind = kind; this.detail = detail || {}; }
  }

  class Memory {
    constructor() {
      this.buf = new ArrayBuffer(LOW_SIZE + STACK_SIZE);
      this.u8 = new Uint8Array(this.buf);
      this.dv = new DataView(this.buf);
      this.sh = new Uint8Array(LOW_SIZE + STACK_SIZE);
      this.writer = new Int32Array(LOW_SIZE + STACK_SIZE);    // statement id of the last write, 0 = loader
      this.stmt = 0;                                          // id of the statement running now
      this.journal = null;                                    // undo log while debugging
      this.segments = [];                                     // [{name, lo, hi}]
      this.brk = 0;                                           // heap end
      this.heapLo = 0;
      this.warnUninit = null;                                 // callback(addr, n) for reads of uninitialised bytes
      this.onWrite = null;                                    // watchpoint hook (addr, n)
      this.watching = false;
    }

    static get LOW_BASE() { return LOW_BASE; }
    static get STACK_TOP() { return STACK_TOP; }
    static get STACK_LO() { return STACK_LO; }

    /** Index into the store for [addr, addr+n), or -1 when the range is not mapped */
    idx(addr, n) {
      if (addr >= LOW_BASE && addr + n <= LOW_BASE + LOW_SIZE) return addr - LOW_BASE;
      if (addr >= STACK_LO && addr + n <= STACK_TOP) return addr - STACK_LO + LOW_SIZE;
      return -1;
    }
    addrOf(i) { return i < LOW_SIZE ? i + LOW_BASE : i - LOW_SIZE + STACK_LO; }
    mapped(addr) { return this.idx(addr, 1) >= 0; }

    segmentOf(addr) {
      for (const s of this.segments) if (addr >= s.lo && addr < s.hi) return s;
      if (addr >= this.heapLo && addr < this.brk) return { name: 'heap', lo: this.heapLo, hi: this.brk };
      if (addr >= STACK_LO && addr < STACK_TOP) return { name: 'stack', lo: STACK_LO, hi: STACK_TOP };
      return null;
    }

    // ---- checked access used by the running program -------------------------------------------------
    /** quiet: reading uninitialised bytes is fine here (a byte-exact copy keeps them uninitialised) */
    check(addr, n, write, quiet) {
      const i = this.idx(addr, n);
      if (i < 0) {
        if (addr < 0x1000) throw new Fault('segv', addr === 0 ? 'NULL pointer dereference' : 'invalid memory access near NULL (address 0x' + hex(addr) + ')', { addr, n, write, near: 'null' });
        throw new Fault('segv', (write ? 'write to' : 'read from') + ' unmapped address 0x' + hex(addr), { addr, n, write });
      }
      const sh = this.sh;
      for (let k = 0; k < n; k++) {
        const s = sh[i + k];
        if (s === SH.INIT || s === SH.CONTROL) continue;
        if (s === SH.UNINIT) { if (!write && !quiet && this.warnUninit) this.warnUninit(addr + k, n - k); if (!write) quiet = true; continue; }
        if (s === SH.RODATA || s === SH.CODE) {
          if (!write) continue;
          throw new Fault('segv', 'write to read-only memory at 0x' + hex(addr + k) + (s === SH.CODE ? ' (program code)' : ' (a string literal or other constant data)'), { addr, n, write, state: s });
        }
        throw new Fault(s === SH.NONE ? 'segv' : 'check', describe(s, write, addr + k), { addr, n, write, state: s, at: addr + k });
      }
      return i;
    }
    /** Mark bytes as written: shadow, last writer, journal */
    touched(i, n) {
      const sh = this.sh, w = this.writer, st = this.stmt;
      if (this.journal) this.journal.record(i, n);
      for (let k = 0; k < n; k++) {
        if (sh[i + k] !== SH.CONTROL) sh[i + k] = SH.INIT;
        w[i + k] = st;
      }
      if (this.watching && this.onWrite) this.onWrite(this.addrOf(i), n);
    }

    load(kind, addr) {
      const i = this.check(addr, KSIZE[kind], false);
      return this.raw(kind, i);
    }
    raw(kind, i) {
      const dv = this.dv;
      switch (kind) {
        case 0: return dv.getInt8(i);
        case 1: return dv.getUint8(i);
        case 2: return dv.getInt16(i, true);
        case 3: return dv.getUint16(i, true);
        case 4: return dv.getInt32(i, true);
        case 5: return dv.getUint32(i, true);
        case 6: return dv.getFloat32(i, true);
        case 7: return dv.getFloat64(i, true);
      }
      return 0;
    }
    store(kind, addr, v) {
      const n = KSIZE[kind];
      const i = this.check(addr, n, true);
      this.touched(i, n);
      this.rawSet(kind, i, v);
    }
    rawSet(kind, i, v) {
      const dv = this.dv;
      switch (kind) {
        case 0: case 1: dv.setUint8(i, v & 255); break;
        case 2: case 3: dv.setUint16(i, v & 0xffff, true); break;
        case 4: case 5: dv.setUint32(i, v >>> 0, true); break;
        case 6: dv.setFloat32(i, v, true); break;
        case 7: dv.setFloat64(i, v, true); break;
      }
    }

    /** Checked byte-range helpers for the C library */
    readBytes(addr, n) {
      if (n <= 0) return new Uint8Array(0);
      const i = this.check(addr, n, false);
      return this.u8.slice(i, i + n);
    }
    writeBytes(addr, bytes) {
      const n = bytes.length;
      if (!n) return;
      const i = this.check(addr, n, true);
      this.touched(i, n);
      this.u8.set(bytes, i);
    }
    fill(addr, v, n) {
      if (n <= 0) return;
      const i = this.check(addr, n, true);
      this.touched(i, n);
      this.u8.fill(v & 255, i, i + n);
    }
    copy(dst, src, n) {
      if (n <= 0) return;
      const si = this.check(src, n, false, true);
      const di = this.check(dst, n, true);
      // copying uninitialised bytes keeps them uninitialised, as a byte-exact copy should
      const sh = this.sh.slice(si, si + n);
      this.touched(di, n);
      this.u8.copyWithin(di, si, si + n);
      for (let k = 0; k < n; k++) if (sh[k] === SH.UNINIT && this.sh[di + k] === SH.INIT) this.sh[di + k] = SH.UNINIT;
    }
    /** Read a NUL-terminated string (checked), up to max bytes */
    cstr(addr, max) {
      max = max === undefined ? 1 << 20 : max;
      let s = '';
      for (let k = 0; k < max; k++) {
        const c = this.load(1, addr + k);
        if (!c) return s;
        s += String.fromCharCode(c);
      }
      return s;
    }
    strlen(addr) {
      for (let k = 0; ; k++) {
        if (!this.load(1, addr + k)) return k;
      }
    }

    // ---- unchecked access for the debugger views ----------------------------------------------------
    peek(kind, addr) { const i = this.idx(addr, KSIZE[kind]); return i < 0 ? null : this.raw(kind, i); }
    peekBytes(addr, n) { const i = this.idx(addr, n); return i < 0 ? null : this.u8.slice(i, i + n); }
    shadow(addr) { const i = this.idx(addr, 1); return i < 0 ? SH.NONE : this.sh[i]; }
    lastWriter(addr) { const i = this.idx(addr, 1); return i < 0 ? 0 : this.writer[i]; }
    /** A change made from the debugger: recorded like a program write so stepping back undoes it */
    poke(kind, addr, v) {
      const n = KSIZE[kind];
      const i = this.idx(addr, n);
      if (i < 0) throw new Fault('segv', 'address 0x' + hex(addr) + ' is not mapped');
      const st = this.stmt;
      this.stmt = -1;   // -1 marks "changed in the debugger"
      this.touched(i, n);
      this.stmt = st;
      this.rawSet(kind, i, v);
    }
    pokeBytes(addr, bytes) {
      const i = this.idx(addr, bytes.length);
      if (i < 0) throw new Fault('segv', 'address 0x' + hex(addr) + ' is not mapped');
      const st = this.stmt;
      this.stmt = -1;
      this.touched(i, bytes.length);
      this.stmt = st;
      this.u8.set(bytes, i);
    }
    /** Set shadow state of a range (frames, heap blocks); journaled */
    setShadow(addr, n, state) {
      if (n <= 0) return;
      const i = this.idx(addr, n);
      if (i < 0) return;
      if (this.journal) this.journal.record(i, n);
      this.sh.fill(state, i, i + n);
    }
  }

  /** Undo log: old bytes, shadow and writer of every changed byte, with markers for each step */
  class Journal {
    constructor(mem, limit) {
      this.mem = mem;
      this.limit = limit || 4000000;
      this.idx = new Int32Array(1024);
      this.old = new Uint8Array(1024);
      this.osh = new Uint8Array(1024);
      this.ow = new Int32Array(1024);
      this.n = 0;
      this.base = 0;     // entries dropped from the front (for the limit)
      this.extra = [];   // [{at, undo()}] for state kept outside memory
    }
    grow() {
      const c = this.idx.length * 2;
      const g = (A, a) => { const b = new A(c); b.set(a); return b; };
      this.idx = g(Int32Array, this.idx); this.old = g(Uint8Array, this.old); this.osh = g(Uint8Array, this.osh); this.ow = g(Int32Array, this.ow);
    }
    record(i, n) {
      const m = this.mem;
      for (let k = 0; k < n; k++) {
        if (this.n >= this.idx.length) {
          if (this.n >= this.limit) { this.trim(); }
          else this.grow();
        }
        const j = this.n++;
        this.idx[j] = i + k;
        this.old[j] = m.u8[i + k];
        this.osh[j] = m.sh[i + k];
        this.ow[j] = m.writer[i + k];
      }
    }
    trim() {
      // forget the oldest half
      const h = this.n >> 1;
      this.idx.copyWithin(0, h, this.n); this.old.copyWithin(0, h, this.n); this.osh.copyWithin(0, h, this.n); this.ow.copyWithin(0, h, this.n);
      this.n -= h;
      this.base += h;
      this.extra = this.extra.filter((x) => x.at >= this.base);
    }
    /** Position for a checkpoint */
    mark() { return this.base + this.n; }
    later(fnUndo) {
      this.extra.push({ at: this.mark(), undo: fnUndo });
      // a placeholder entry moves the mark on, so a checkpoint taken just after this sees it as done
      if (this.n >= this.idx.length) { if (this.n >= this.limit) this.trim(); else this.grow(); }
      this.idx[this.n++] = -1;
    }
    /** Roll memory back to a mark; false when that far back was already forgotten */
    rewind(mark) {
      if (mark < this.base) return false;
      const m = this.mem;
      const stop = mark - this.base;
      for (let e = this.extra.length - 1; e >= 0 && this.extra[e].at >= mark; e--) { this.extra[e].undo(); this.extra.pop(); }
      // extras and bytes interleave; extras undo their own JS state only, so order between them does not matter
      for (let j = this.n - 1; j >= stop; j--) {
        const i = this.idx[j];
        if (i < 0) continue;
        m.u8[i] = this.old[j];
        m.sh[i] = this.osh[j];
        m.writer[i] = this.ow[j];
      }
      this.n = stop;
      return true;
    }
  }

  function hex(v) { return (v >>> 0).toString(16).padStart(8, '0'); }
  function describe(s, write, addr) {
    const verb = write ? 'write to' : 'read from';
    switch (s) {
      case SH.NONE: return verb + ' memory that is not in use at 0x' + hex(addr);
      case SH.HEADER: return verb + " the heap's own bookkeeping at 0x" + hex(addr) + ' (past the end of a malloc block)';
      case SH.GUARD: return verb + ' 0x' + hex(addr) + ', just past the end of an object (buffer overflow)';
      case SH.FREED: return verb + ' heap memory at 0x' + hex(addr) + ' after it was freed (use after free)';
    }
    return verb + ' 0x' + hex(addr);
  }

  SEE.Memory = Memory;
  SEE.Journal = Journal;
  SEE.Fault = Fault;
  SEE.SH = SH;
  SEE.SH_NAMES = SH_NAMES;
  SEE.KINDS = KINDS;
  SEE.KSIZE = KSIZE;
  SEE.hex = hex;
  SEE.MEM = { LOW_BASE, LOW_SIZE, STACK_TOP, STACK_SIZE, STACK_LO };
})(SEE);
