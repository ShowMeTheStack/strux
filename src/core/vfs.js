// A small Unix-style file system.
//   /           a virtual disk kept in the browser (IndexedDB), memory only when headless
//   /mnt/NAME   a real folder the user mounts through the File System Access API, read-only,
//               ask-before-writing or writable as the user chooses
// Names keep their case for display but are matched without regard to case.
(function (SEE) {
  'use strict';

  const MESSAGES = {
    ENOENT: 'File not found', EEXIST: 'File already exists', ENOTDIR: 'Not a folder', EISDIR: 'Is a folder',
    EACCES: 'Permission denied', ENOTEMPTY: 'Folder not empty', EFBIG: 'File too large', ENOSPC: 'Disk full',
    EINVAL: 'Bad file name', EBUSY: 'File is in use', ENOTREADY: 'File is still loading',
  };
  class VfsError extends Error {
    constructor(code, path) { super((MESSAGES[code] || code) + (path ? ': ' + path : '')); this.code = code; this.path = path; }
  }
  SEE.VfsError = VfsError;
  const fail = (code, path) => { throw new VfsError(code, path); };
  const BAD = /[<>:"|?*\\\x00-\x1f]/;

  /** Split and normalise a path against a working directory. Returns segment array. */
  function segments(path, cwd) {
    if (typeof path !== 'string') fail('EINVAL');
    let p = path.trim().replace(/\\/g, '/');
    if (!p) fail('EINVAL');
    const out = p.startsWith('/') ? [] : (cwd || '/').split('/').filter(Boolean);
    for (const s of p.split('/')) {
      if (!s || s === '.') continue;
      if (s === '..') { out.pop(); continue; }
      if (BAD.test(s) || s.length > 120) fail('EINVAL', path);
      out.push(s);
    }
    return out;
  }
  const keyOf = (segs) => '/' + segs.map((s) => s.toLowerCase()).join('/');

  class VFS extends SEE.Emitter {
    constructor(opts) {
      super();
      this.opts = Object.assign({ maxFileSize: 8 * 1024 * 1024, maxTotal: 64 * 1024 * 1024, maxEntries: 8000 }, opts || {});
      this.entries = new Map();   // key -> {name, type, data?, mtime, readOnly?, mount?}
      this.mounts = new Map();    // key of mount point -> {handle, mode, name}
      this.cwd = '/';
      this.total = 0;
    }

    resolve(path) {
      const segs = segments(path, this.cwd);
      const key = keyOf(segs);
      return { segs, key, parentKey: keyOf(segs.slice(0, -1)), name: segs[segs.length - 1] || '', display: this.display(segs) };
    }
    /** Display path using the stored capitalisation */
    display(segs) {
      const out = [];
      for (let i = 0; i < segs.length; i++) {
        const e = this.entries.get(keyOf(segs.slice(0, i + 1)));
        out.push(e ? e.name : segs[i]);
      }
      return '/' + out.join('/');
    }
    abs(path) { return this.resolve(path).display; }
    isDirKey(key) { return key === '/' || (this.entries.has(key) && this.entries.get(key).type === 'dir'); }
    mountOf(key) {
      for (const [mk, m] of this.mounts) if (key === mk || key.startsWith(mk + '/')) return Object.assign({ key: mk }, m);
      return null;
    }

    // ---- queries -------------------------------------------------------------------------------
    exists(path) { try { const r = this.resolve(path); return r.key === '/' || this.entries.has(r.key); } catch (e) { return false; } }
    stat(path) {
      const r = this.resolve(path);
      if (r.key === '/') return { type: 'dir', size: 0, mtime: 0, name: '', path: '/' };
      const e = this.entries.get(r.key);
      if (!e) return null;
      return { type: e.type, size: e.data ? e.data.length : (e.size || 0), mtime: e.mtime, name: e.name, path: r.display, readOnly: !!e.readOnly, mount: !!this.mountOf(r.key) };
    }
    isDir(path) { try { return this.isDirKey(this.resolve(path).key); } catch (e) { return false; } }
    isReady(path) { const e = this.entries.get(this.resolve(path).key); return !e || e.type !== 'file' || !!e.data; }
    load(path) {
      const e = this.entries.get(this.resolve(path).key);
      if (!e || e.data || !e.handle) return Promise.resolve();
      if (!e.loading) {
        e.loading = e.handle.getFile().then((f) => f.arrayBuffer()).then((ab) => { e.data = new Uint8Array(ab); e.loading = null; })
          .catch(() => { e.data = new Uint8Array(0); e.loading = null; });
      }
      return e.loading;
    }
    readFile(path) {
      const r = this.resolve(path);
      const e = this.entries.get(r.key);
      if (!e) fail(this.isDirKey(r.parentKey) ? 'ENOENT' : 'ENOENT', r.display);
      if (e.type === 'dir') fail('EISDIR', r.display);
      if (!e.data) fail('ENOTREADY', r.display);
      return e.data;
    }
    readText(path) { return SEE.unutf8(this.readFile(path)); }
    /** 'yes' | 'no' | 'ask' */
    canWrite(path) {
      const r = this.resolve(path);
      const m = this.mountOf(r.key);
      if (m) return m.mode === 'write' ? 'yes' : m.mode === 'ask' ? 'ask' : 'no';
      for (let i = r.segs.length; i >= 1; i--) { const e = this.entries.get(keyOf(r.segs.slice(0, i))); if (e && e.readOnly) return 'no'; }
      return 'yes';
    }
    checkWrite(r, trusted) {
      if (trusted) return;
      const m = this.mountOf(r.key);
      if (m && m.mode !== 'write') fail('EACCES', r.display);
      // inside a folder from the computer its mode decides (the /mnt folder above it is read-only)
      if (m) return;
      // a read-only folder protects everything inside it
      for (let i = r.segs.length; i >= 1; i--) {
        const e = this.entries.get(keyOf(r.segs.slice(0, i)));
        if (e && e.readOnly) fail('EACCES', r.display);
      }
    }

    // ---- changes -------------------------------------------------------------------------------
    writeFile(path, data, opts) {
      opts = opts || {};
      const r = this.resolve(path);
      if (!r.name) fail('EINVAL', path);
      this.checkWrite(r, opts.trusted);
      if (!this.isDirKey(r.parentKey)) fail('ENOENT', this.display(r.segs.slice(0, -1)));
      const bytes = data instanceof Uint8Array ? data : SEE.utf8(String(data));
      if (bytes.length > this.opts.maxFileSize) fail('EFBIG', r.display);
      const old = this.entries.get(r.key);
      if (old && old.type === 'dir') fail('EISDIR', r.display);
      const total = this.used() - (old && old.data ? old.data.length : 0) + bytes.length;
      if (total > this.opts.maxTotal && !this.mountOf(r.key)) fail('ENOSPC');
      if (!old && this.entries.size >= this.opts.maxEntries) fail('ENOSPC');
      const e = old || { name: r.name, type: 'file' };
      e.data = bytes;
      e.mtime = Date.now();
      if (opts.readOnly !== undefined) e.readOnly = !!opts.readOnly;
      if (!old) this.entries.set(r.key, e);
      this.changed(r.key, e);
      return e;
    }
    writeText(path, text, opts) { return this.writeFile(path, SEE.utf8(text), opts); }
    used() { let n = 0; for (const [k, e] of this.entries) if (e.data && !this.mountOf(k)) n += e.data.length; return n; }
    unlink(path, opts) {
      const r = this.resolve(path);
      this.checkWrite(r, opts && opts.trusted);
      const e = this.entries.get(r.key);
      if (!e) fail('ENOENT', r.display);
      if (e.type === 'dir') fail('EISDIR', r.display);
      this.entries.delete(r.key);
      this.changed(r.key, null, e);
    }
    mkdir(path, opts) {
      const r = this.resolve(path);
      if (!r.name) fail('EEXIST', '/');
      this.checkWrite(r, opts && opts.trusted);
      if (this.entries.has(r.key)) { if (opts && opts.exist) return; fail('EEXIST', r.display); }
      if (!this.isDirKey(r.parentKey)) {
        if (opts && opts.parents) this.mkdir(this.display(r.segs.slice(0, -1)), opts);
        else fail('ENOENT', this.display(r.segs.slice(0, -1)));
      }
      const e = { name: r.name, type: 'dir', mtime: Date.now() };
      if (opts && opts.readOnly) e.readOnly = true;
      this.entries.set(r.key, e);
      this.changed(r.key, e);
    }
    rmdir(path, opts) {
      const r = this.resolve(path);
      this.checkWrite(r, opts && opts.trusted);
      const e = this.entries.get(r.key);
      if (!e || e.type !== 'dir') fail('ENOTDIR', r.display);
      const kids = [...this.entries.keys()].filter((k) => k.startsWith(r.key + '/'));
      if (kids.length && !(opts && opts.recursive)) fail('ENOTEMPTY', r.display);
      if (this.cwdKey() === r.key || this.cwdKey().startsWith(r.key + '/')) this.cwd = '/';
      for (const k of kids.sort().reverse()) { const x = this.entries.get(k); this.entries.delete(k); this.changed(k, null, x); }
      this.entries.delete(r.key);
      this.changed(r.key, null, e);
    }
    rename(from, to, opts) {
      const a = this.resolve(from), b = this.resolve(to);
      this.checkWrite(a, opts && opts.trusted); this.checkWrite(b, opts && opts.trusted);
      const e = this.entries.get(a.key);
      if (!e) fail('ENOENT', a.display);
      if (a.key !== b.key && this.entries.has(b.key)) fail('EEXIST', b.display);
      if (!this.isDirKey(b.parentKey)) fail('ENOENT', this.display(b.segs.slice(0, -1)));
      if (b.key.startsWith(a.key + '/')) fail('EINVAL', b.display);
      const moves = [[a.key, b.key]];
      if (e.type === 'dir') for (const k of this.entries.keys()) if (k.startsWith(a.key + '/')) moves.push([k, b.key + k.slice(a.key.length)]);
      for (const [k1, k2] of moves) {
        const x = this.entries.get(k1);
        const before = Object.assign({}, x);
        this.entries.delete(k1);
        if (k1 === a.key) x.name = b.name;
        this.entries.set(k2, x);
        this.changed(k1, null, before);
        this.changed(k2, x);
      }
      if (this.cwdKey() === a.key) this.cwd = b.display;
    }
    cwdKey() { return keyOf(segments(this.cwd, '/')); }
    chdir(path) {
      const r = this.resolve(path);
      if (!this.isDirKey(r.key)) fail('ENOTDIR', r.display);
      this.cwd = r.display;
    }
    /** Directory listing [{name, type, size, mtime, path, readOnly}] folders first */
    list(path) {
      const r = this.resolve(path || '.');
      if (!this.isDirKey(r.key)) fail('ENOTDIR', r.display);
      const prefix = r.key === '/' ? '/' : r.key + '/';
      const out = [];
      for (const [k, e] of this.entries) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        out.push({ name: e.name, type: e.type, size: e.data ? e.data.length : (e.size || 0), mtime: e.mtime, path: (r.key === '/' ? '' : r.display) + '/' + e.name, readOnly: !!e.readOnly });
      }
      out.sort((x, y) => (x.type === y.type ? x.name.localeCompare(y.name, undefined, { numeric: true, sensitivity: 'base' }) : x.type === 'dir' ? -1 : 1));
      return out;
    }
    /** All entries below a folder: [{key, rel, entry, path}] */
    walk(path) {
      const r = this.resolve(path);
      const prefix = r.key === '/' ? '/' : r.key + '/';
      const out = [];
      for (const [k, e] of this.entries) if (k.startsWith(prefix)) out.push({ key: k, rel: k.slice(prefix.length), entry: e, path: this.display(segments(k, '/')) });
      return out;
    }
    changed(key, e, old) {
      this.emit('change', { key, entry: e, old });
      const m = this.mountOf(key);
      if (m) this.hostWrite(m, key, e, old);
      else if (this.onPersist) this.onPersist(key, e);
    }

    // ---- persistence ---------------------------------------------------------------------------
    async persist(dbName) {
      if (typeof indexedDB === 'undefined') return;
      const open = () => new Promise((res, rej) => {
        const rq = indexedDB.open(dbName || 'see-disk', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('entries');
        rq.onsuccess = () => {
          // give way when the database is being deleted or upgraded elsewhere; the next save opens it again
          rq.result.onversionchange = () => rq.result.close();
          res(rq.result);
        };
        rq.onerror = () => rej(rq.error);
      });
      let db = await open();
      this.db = db;
      await new Promise((res) => {
        const rq = db.transaction('entries', 'readonly').objectStore('entries').openCursor();
        rq.onsuccess = () => {
          const c = rq.result;
          if (!c) { res(); return; }
          const v = c.value;
          this.entries.set(c.key, { name: v.name, type: v.type, data: v.data ? new Uint8Array(v.data) : undefined, mtime: v.mtime, readOnly: !!v.readOnly });
          c.continue();
        };
        rq.onerror = () => res();
      });
      const pending = new Map();
      let timer = null;
      let reopening = null;
      let gone = false;
      const flush = () => {
        timer = null;
        if (!pending.size) return;
        let st;
        try {
          st = db.transaction('entries', 'readwrite').objectStore('entries');
        } catch (e) {
          // the browser closed the connection (site data cleared, say): open it again and retry.
          // Not while the page is going away: an open started then can be left hanging and hold up
          // the next page's open, and the localStorage backup already has these changes.
          if (!reopening && !gone) reopening = open().then((d) => { db = this.db = d; reopening = null; flush(); }, () => { reopening = null; });
          return;
        }
        for (const [k, e] of pending) {
          if (e) st.put({ name: e.name, type: e.type, data: e.data ? e.data.slice().buffer : null, mtime: e.mtime, readOnly: !!e.readOnly }, k);
          else st.delete(k);
        }
        pending.clear();
      };
      this.onPersist = (k, e) => { pending.set(k, e); if (!timer) timer = setTimeout(flush, 200); };
      this.flushNow = flush;
      // A page that is closing or reloading may never finish an IndexedDB write, so changes still
      // waiting (often the autosave made on the way out) are also kept in localStorage, which is
      // written at once, and put back on the next start.
      const BACKUP = 'see.diskPending';
      const ls = typeof localStorage !== 'undefined' ? localStorage : null;
      const toB64 = (b) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s); };
      const fromB64 = (t) => { const s = atob(t); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
      try {
        const raw = ls && ls.getItem(BACKUP);
        if (raw) {
          for (const [k, v] of JSON.parse(raw)) {
            if (v) this.entries.set(k, { name: v.name, type: v.type, data: v.data !== null ? fromB64(v.data) : undefined, mtime: v.mtime, readOnly: !!v.readOnly });
            else this.entries.delete(k);
            pending.set(k, this.entries.get(k) || null);
          }
          ls.removeItem(BACKUP);
          flush();
        }
      } catch (e) { /* a damaged backup is ignored */ }
      const leaving = () => {
        if (pending.size && ls) {
          try {
            ls.setItem(BACKUP, JSON.stringify([...pending].map(([k, e]) => [k, e ? { name: e.name, type: e.type, data: e.data ? toB64(e.data) : null, mtime: e.mtime, readOnly: !!e.readOnly } : null])));
          } catch (e) { /* too big for localStorage: IndexedDB may still make it */ }
        }
        gone = true;
        flush();
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', leaving);
        // back from the back/forward cache: saving works as usual again
        window.addEventListener('pageshow', (ev) => { if (ev.persisted) { gone = false; if (pending.size) flush(); } });
      }
    }

    // ---- real folders ----------------------------------------------------------------------------
    /** Mount a directory handle at /mnt/NAME. mode: 'read' | 'ask' | 'write' */
    async mountHandle(handle, mode) {
      if (!this.entries.has('/mnt')) { this.entries.set('/mnt', { name: 'mnt', type: 'dir', mtime: Date.now(), readOnly: true }); }
      let name = handle.name.replace(/[<>:"|?*\\/\x00-\x1f]/g, '_') || 'folder';
      let key = '/mnt/' + name.toLowerCase();
      for (let i = 2; this.mounts.has(key) || this.entries.has(key); i++) { name = handle.name + '-' + i; key = '/mnt/' + name.toLowerCase(); }
      this.mounts.set(key, { handle, mode, name });
      this.entries.set(key, { name, type: 'dir', mtime: Date.now(), handle });
      let count = 0;
      const scan = async (dir, prefix, depth) => {
        if (depth > 8) return;
        for await (const [nm, h] of dir.entries()) {
          if (++count > this.opts.maxEntries || nm.startsWith('.')) continue;
          const k = prefix + '/' + nm.toLowerCase();
          if (h.kind === 'directory') { this.entries.set(k, { name: nm, type: 'dir', mtime: 0, handle: h }); await scan(h, k, depth + 1); }
          else {
            let size = 0, mtime = 0;
            try { const f = await h.getFile(); size = f.size; mtime = f.lastModified; } catch (e) { /* unreadable */ }
            this.entries.set(k, { name: nm, type: 'file', size, mtime, handle: h });
          }
        }
      };
      await scan(handle, key, 0);
      this.emit('mount', key);
      return '/mnt/' + name;
    }
    unmount(path) {
      const r = this.resolve(path);
      if (!this.mounts.has(r.key)) return;
      this.mounts.delete(r.key);
      for (const k of [...this.entries.keys()]) if (k === r.key || k.startsWith(r.key + '/')) this.entries.delete(k);
      if (this.cwdKey().startsWith(r.key)) this.cwd = '/';
      if (![...this.mounts.keys()].length) this.entries.delete('/mnt');
      this.emit('mount', r.key);
    }
    async hostWrite(m, key, e, old) {
      try {
        const rel = key.slice(m.key.length).split('/').filter(Boolean);
        let dir = m.handle;
        for (let i = 0; i < rel.length - 1; i++) {
          const pe = this.entries.get(m.key + '/' + rel.slice(0, i + 1).join('/'));
          dir = await dir.getDirectoryHandle(pe ? pe.name : rel[i], { create: true });
        }
        if (!rel.length) return;
        if (!e) { await dir.removeEntry(old ? old.name : rel[rel.length - 1], { recursive: true }).catch(() => {}); return; }
        if (e.type === 'dir') { e.handle = await dir.getDirectoryHandle(e.name, { create: true }); return; }
        const fh = e.handle && e.handle.kind === 'file' && e.handle.name === e.name ? e.handle : await dir.getFileHandle(e.name, { create: true });
        e.handle = fh;
        const w = await fh.createWritable();
        await w.write(e.data);
        await w.close();
      } catch (x) {
        this.emit('hostError', { key, error: x });
      }
    }
  }

  SEE.VFS = VFS;
  SEE.vfsSegments = segments;
})(SEE);
