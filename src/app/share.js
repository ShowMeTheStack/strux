// Project sharing: pack a folder into a compressed, URL-safe string (and back).
(function (SEE) {
  'use strict';
  const Share = SEE.Share = {};
  const PREFIX = 'SEE1.';

  const b64url = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64url = (str) => {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  };
  async function pipe(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  const canCompress = typeof CompressionStream !== 'undefined';

  /** files: {relPath: Uint8Array}; meta: {name, main, lang} */
  Share.pack = async function (meta, files) {
    const enc = {};
    for (const [k, v] of Object.entries(files)) enc[k] = b64url(v);
    const json = JSON.stringify({ v: 1, meta, files: enc });
    const raw = new TextEncoder().encode(json);
    if (canCompress) return PREFIX + 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw')));
    return PREFIX + 'r' + b64url(raw);
  };
  Share.unpack = async function (str) {
    str = String(str).trim();
    const m = /(?:#share=|^)(SEE1\.[zr][A-Za-z0-9_-]+)/.exec(str);
    if (!m) throw new Error('This does not look like a See share code.');
    const body = m[1].slice(PREFIX.length);
    if (body[0] === 'z' && !canCompress) throw new Error('This browser cannot decompress share codes.');
    let obj;
    try {
      let raw = unb64url(body.slice(1));
      if (body[0] === 'z') raw = await pipe(raw, new DecompressionStream('deflate-raw'));
      obj = JSON.parse(new TextDecoder().decode(raw));
    } catch (e) {
      // a code cut short when copying, or changed by hand
      throw new Error('This share code is damaged or incomplete. Copy the whole link or code again.');
    }
    if (!obj || obj.v !== 1 || !obj.files) throw new Error('Unsupported share code version.');
    const files = {};
    for (const [k, v] of Object.entries(obj.files)) {
      if (/(^|[\\/])\.\.([\\/]|$)/.test(k) || /^[A-Za-z]:/.test(k) || k.startsWith('\\') || k.startsWith('/')) throw new Error('Unsafe path in share code: ' + k);
      try { files[k] = unb64url(v); } catch (e) { throw new Error('This share code is damaged or incomplete. Copy the whole link or code again.'); }
    }
    if (!Object.keys(files).length) throw new Error('This share code has no files in it.');
    return { meta: obj.meta || {}, files };
  };
})(SEE);
