// Core namespace and shared helpers. Every source file attaches to the global SEE object.
/* global globalThis */
var SEE = (typeof globalThis !== 'undefined' && globalThis.SEE) || {};
if (typeof globalThis !== 'undefined') globalThis.SEE = SEE;

(function (SEE) {
  'use strict';

  /** UTF-8 text <-> Uint8Array */
  SEE.utf8 = function (s) { return new TextEncoder().encode(s); };
  SEE.unutf8 = function (b) { return new TextDecoder().decode(b); };

  SEE.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  SEE.escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Tiny event emitter mixin */
  SEE.Emitter = class {
    constructor() { this._h = {}; }
    on(ev, fn) { (this._h[ev] || (this._h[ev] = [])).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this._h[ev]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    emit(ev, ...args) { const a = this._h[ev]; if (a) for (const fn of a.slice()) fn(...args); }
  };

  SEE.isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
})(SEE);
