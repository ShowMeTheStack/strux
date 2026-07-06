// Building a program: preprocess and compile every .c file, compile the C part of the library once,
// then link. Diagnostics carry file, line and column so the editor can show them.
(function (SEE) {
  'use strict';
  const { CError } = SEE;
  const SYS = '/usr/include/';
  let libcUnit = null;

  function dirname(p) { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
  function join(dir, name) {
    const parts = (dir + '/' + name).split('/');
    const out = [];
    for (const x of parts) {
      if (!x || x === '.') continue;
      if (x === '..') out.pop(); else out.push(x);
    }
    return '/' + out.join('/');
  }

  /** Compile one file to a unit; throws CError */
  function compileUnit(path, text, read, opts) {
    const reader = (p) => {
      if (p.startsWith(SYS)) {
        const h = SEE.Headers.files[p.slice(SYS.length)];
        if (h !== undefined) return h;
      }
      return read ? read(p) : null;
    };
    const pp = SEE.Cpp.preprocess(text, path, { read: reader, dirname, join, sysdirs: [SYS], defines: opts.defines, now: opts.now });
    const ast = SEE.Parser.parse(pp.tokens, { id: path, file: path });
    const gen = SEE.Codegen.generate(ast);
    return { file: path, ast, gen, warnings: pp.warnings.concat(ast.warnings), includes: pp.includes, tokens: pp.tokens, macros: pp.macros };
  }

  function libc() {
    if (!libcUnit) {
      libcUnit = compileUnit('/usr/lib/libc.c', SEE.Headers.libc, null, {});
      libcUnit.system = true;
    }
    return libcUnit;
  }

  /**
   * files: [{path, text}] the .c files of the program
   * read(path): text of any other file (headers in the project), or null
   * Returns {ok, prog, units, errors, warnings}
   */
  function build(files, read, opts) {
    opts = opts || {};
    const errors = [], warnings = [];
    const units = [];
    for (const f of files) {
      try {
        const u = compileUnit(f.path, f.text, read, opts);
        units.push(u);
        for (const w of u.warnings) warnings.push(w);
      } catch (e) {
        if (!(e instanceof CError)) {
          errors.push(new CError('internal compiler problem: ' + e.message, { file: f.path, line: 1, col: 1 }));
          if (opts.debugInternal) throw e;
        } else {
          if (!e.pos) e.pos = { file: f.path, line: 1, col: 1 };
          errors.push(e);
        }
      }
    }
    if (errors.length) return { ok: false, errors, warnings, units };
    if (!units.length) return { ok: false, errors: [new CError('no .c files to build')], warnings, units };
    let prog;
    try {
      prog = SEE.Linker.link(units.concat([libc()]), SEE.Libc.natives);
    } catch (e) {
      if (!(e instanceof CError)) { if (opts.debugInternal) throw e; return { ok: false, errors: [new CError('internal linker problem: ' + e.message)], warnings, units }; }
      for (const w of e.warnings || []) warnings.push(w);
      return { ok: false, errors: e.all || [e], warnings, units, linkError: true };
    }
    for (const w of prog.warnings) warnings.push(w);
    prog.units = units;
    return { ok: true, prog, errors, warnings, units };
  }

  SEE.Build = { build, compileUnit, dirname, join, libc };
})(SEE);
