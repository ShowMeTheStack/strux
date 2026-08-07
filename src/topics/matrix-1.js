// Two-dimensional arrays: the family (int m[ROWS][COLS]), row-major layout, in-place transpose, spiral
// order and the triplet form of a sparse matrix.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StripKit;
  const CW = 50, CP = 56;

  /** "1 2 3; 4 5 6" -> [[1, 2, 3], [4, 5, 6]] */
  X.parseMatrix = (text) => String(text || '').split(/[;\n]/).map((r) => r.trim()).filter(Boolean).map((r) => r.split(/[\s,]+/).map(Number));
  const matCheck = (maxR, maxC, maxN, square) => (v) => {
    const m = X.parseMatrix(v);
    if (!m.length) return 'The matrix: give at least one row, rows split by ;';
    if (m.some((r) => r.some((x) => !Number.isInteger(x) || Math.abs(x) > 99))) return 'The matrix: whole numbers from -99 to 99';
    if (m.some((r) => r.length !== m[0].length)) return 'The matrix: every row needs the same number of values';
    if (m.length > maxR || m[0].length > maxC) return 'The matrix: at most ' + maxR + ' rows and ' + maxC + ' columns, so it stays readable';
    if (maxN && m.length * m[0].length > maxN) return 'The matrix: at most ' + maxN + ' elements in all';
    if (square && m.length !== m[0].length) return 'The matrix: it must be square (as many rows as columns) to transpose in place';
    return null;
  };
  const matIn = (def, maxR, maxC, maxN, square) => ({ id: 'm', kind: 'text', label: 'The matrix (rows split by ;)', def, check: matCheck(maxR, maxC, maxN, square) });
  const dims = (inp) => { const m = X.parseMatrix(inp.m); return { R: m.length, C: m[0].length, m, flat: [].concat(...m) }; };

  X.family({
    id: 'matrix', order: 3, group: 'Arrays', title: 'Two-dimensional arrays',
    blurb: 'A grid of rows and columns that C stores as one long row in memory, row after row. Every element is found by arithmetic on its two indexes.',
    head: (t, inp) => { const { R, C } = dims(inp); return `#include <stdio.h>

#define ROWS ${R}
#define COLS ${C}`; },
  });
  const matMain = (inp, decl, call) => { const { m } = dims(inp); return `int main(void)
{
    int m[ROWS][COLS] = {
${m.map((r) => '        { ' + r.join(', ') + ' }').join(',\n')}
    };
${decl ? '    ' + decl + '\n' : ''}    ${call}
    return 0;
}`; };

  /** The matrix's ints, from main (an array) or a function (a pointer to its first row) */
  function matCells(P, n) {
    const v = P.find('m');
    if (!v) return null;
    const t = SEE.Types.unqual(v.type);
    return S.ints(P, t.k === 'ptr' ? P.val('m') : v.addr, n);
  }
  const at = (C) => (k) => ({ x: (k % C) * CP, y: Math.floor(k / C) * CP });
  const ctr = (C, k) => ({ x: (k % C) * CP + CW / 2, y: Math.floor(k / C) * CP + CW / 2 });
  /** Index labels round the grid */
  function axes(R, C, y0, x0) {
    const items = [];
    for (let c = 0; c < C; c++) items.push({ key: 'ax-c' + c, kind: 'text', x: (x0 || 0) + c * CP + CW / 2, y: (y0 || 0) - 10, text: String(c), cls: 'idx', anchor: 'middle' });
    for (let r = 0; r < R; r++) items.push({ key: 'ax-r' + r, kind: 'text', x: (x0 || 0) - 14, y: (y0 || 0) + r * CP + CW / 2 + 5, text: String(r), cls: 'idx', anchor: 'middle' });
    return items;
  }
  const local = S.local;

  // ---- row-major layout ------------------------------------------------------------------------------------
  X.topic({
    id: 'mat-rowmajor', family: 'matrix', order: 10, title: 'Row-major layout in memory',
    blurb: 'The grid is how we think of it; memory is one strip, row 0 then row 1 and so on. The address of m[i][j] is base + (i × COLS + j) × sizeof(int).',
    code: (inp) => {
      const rows = inp.order !== 'col';
      const loops = rows ? `    for (i = 0; i < ROWS; i++)                  /*@ outer */
        for (j = 0; j < COLS; j++) {            /*@ inner */` : `    for (j = 0; j < COLS; j++)                  /*@ outer */
        for (i = 0; i < ROWS; i++) {            /*@ inner */`;
      return `/* visit every element ${rows ? 'row by row' : 'column by column'}, showing where each one lies in memory */
void walk(int m[ROWS][COLS])
{
    int *flat = &m[0][0];                       /*@ base */
    int i, j, k;
${loops}
            k = i * COLS + j;                   /*@ offset */
            printf("m[%d][%d] is flat[%d] = %d\\n", i, j, k, flat[k]);   /*@ visit */
        }
}                                               /*@ back */`;
    },
    animate: ['walk'],
    inputs: [matIn('11 12 13 14; 21 22 23 24; 31 32 33 34', 4, 5, 16), { id: 'order', kind: 'choice', label: 'Visit order', def: 'row', options: [{ value: 'row', label: 'Row by row' }, { value: 'col', label: 'Column by column' }] }],
    presets: [
      { label: '3 × 4, row by row', values: { m: '11 12 13 14; 21 22 23 24; 31 32 33 34', order: 'row' } },
      { label: '3 × 4, column by column', values: { m: '11 12 13 14; 21 22 23 24; 31 32 33 34', order: 'col' } },
      { label: 'One row', values: { m: '5 6 7 8 9', order: 'row' } },
      { label: '4 × 2', values: { m: '1 2; 3 4; 5 6; 7 8', order: 'col' } },
    ],
    counters: ['follows'],
    main: (inp) => matMain(inp, '', 'walk(m);'),
    capture: (P) => {
      const R = P.ev('ROWS'), C = P.ev('COLS');
      return { cells: matCells(P, R * C), i: local(P, 'i'), j: local(P, 'j'), k: local(P, 'k'), flat: local(P, 'flat') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const { R, C } = dims(inp);
      const rows = inp.order !== 'col';
      const past = ctx.ticks.slice(0, ctx.i + 1);
      const visits = past.filter((t) => t.tag === 'visit').map((t) => t.data.k);
      const cur = (tag === 'offset' || tag === 'visit') ? d.k : null;
      const items = [];
      // the grid, coloured by row
      const g = S.cells(ctx, 'g', d.cells, { pos: at(C), w: CW, sub: () => '', cls: (k) => 'row' + Math.floor(k / C) + (k === cur ? ' lit' : visits.includes(k) ? '' : ' ghost'), hotWrites: false });
      items.push(...g.items, ...axes(R, C));
      items.push({ key: 'gt', kind: 'text', x: -24, y: -34, text: 'm[' + R + '][' + C + '], as we picture it', cls: 'idx' });
      // the strip: the same ints as memory holds them
      const SW = 44, SP = 47, sy = R * CP + 90;
      const s = S.cells(ctx, 's', d.cells, { pos: (k) => ({ x: k * SP, y: sy }), w: SW, sub: (k) => '+' + 4 * k, cls: (k) => 'small row' + Math.floor(k / C) + (k === cur ? ' lit' : visits.includes(k) ? '' : ' ghost'), hotWrites: false });
      items.push(...s.items);
      items.push({ key: 'st', kind: 'text', x: -24, y: sy - 34, text: 'in memory: one strip of ' + R * C + ' ints, ' + 4 * R * C + ' bytes from ' + (d.flat !== null ? X.hex(d.flat) : 'the start of m'), cls: 'idx' });
      for (let r = 0; r < R; r++) items.push(...S.bracket('rb' + r, r * C * SP, (r * C + C - 1) * SP + SW, sy + SW + 34, 'row ' + r, 'c-' + ['teal', 'amber', 'violet', 'rose', 'indigo'][r], true));
      if (cur !== null) {
        items.push({ key: 'link', kind: 'arrow', from: { key: g.keyOf(cur), side: 'bottom' }, to: { key: s.keyOf(cur), side: 'top' }, cls: 'hot' });
        const i = d.i, j = d.j;
        items.push({ key: 'fx', kind: 'text', x: C * CP + 30, y: 20, text: 'm[' + i + '][' + j + ']', cls: 'code-text' });
        items.push({ key: 'fx2', kind: 'text', x: C * CP + 30, y: 46, text: 'k = ' + i + ' × ' + C + ' + ' + j + ' = ' + d.k, cls: 'code-text step-now' });
        items.push({ key: 'fx3', kind: 'text', x: C * CP + 30, y: 72, text: 'address = base + ' + d.k + ' × 4 = base + ' + 4 * d.k, cls: 'mono' });
      }
      // where the previous visit was: the jump in memory between two neighbours in the loop
      const prevK = visits.length > (tag === 'visit' ? 1 : 0) ? visits[visits.length - (tag === 'visit' ? 2 : 1)] : null;
      if (cur !== null && prevK !== null && prevK !== cur) items.push({ key: 'jump', kind: 'arrow', from: { key: s.keyOf(prevK), side: 'top' }, to: { key: s.keyOf(cur), side: 'top' }, bend: -Math.min(60, 14 + 6 * Math.abs(cur - prevK)), cls: Math.abs(cur - prevK) === 1 ? 'part-a' : 'bad', label: (cur - prevK > 0 ? '+' : '') + 4 * (cur - prevK) + ' bytes' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'walk(m): m has ' + S.pl(R, 'row') + ' of ' + C + '. C stores it as one row of ' + R * C + ' ints: all of row 0, then all of row 1, and so on.'; break;
        case 'base': say = 'flat points at m[0][0], the first int of the strip. Through flat, the matrix is just a 1-D array.'; break;
        case 'outer': say = rows ? (d.i < R ? 'Row i = ' + d.i + '.' : 'i = ' + R + ': every row has been walked.') : (d.j < C ? 'Column j = ' + d.j + '.' : 'j = ' + C + ': every column has been walked.'); break;
        case 'inner': say = rows ? (d.j < C ? 'j = ' + d.j + ': the next element along row ' + d.i + '.' : 'j = ' + C + ': the end of row ' + d.i + '.') : (d.i < R ? 'i = ' + d.i + ': the next element down column ' + d.j + '.' : 'i = ' + R + ': the end of column ' + d.j + '.'); break;
        case 'offset': say = 'k = i × COLS + j = ' + d.i + ' × ' + C + ' + ' + d.j + ' = ' + d.k + ': skip ' + S.pl(d.i, 'whole row') + ' of ' + C + ', then ' + d.j + ' more.' + (prevK !== null ? ' From the last element that is a jump of ' + (d.k - prevK) + (Math.abs(d.k - prevK) === 1 ? ': the very next int in memory.' : ' ints.') : ''); break;
        case 'visit': say = 'm[' + d.i + '][' + d.j + '] and flat[' + d.k + '] are the same int, ' + d.cells[d.k] + ', ' + 4 * d.k + ' bytes from the start.'; break;
        case 'back': say = 'walk() has visited all ' + R * C + ' elements.'; break;
        case 'after': say = rows ? 'Row by row, every step moved to the next int in memory: the strip was read straight through, which is what caches like best.' : 'Column by column, each step jumped ' + C + ' ints (' + 4 * C + ' bytes) ahead, then came back: the same ' + R * C + ' ints, read in a scattered order.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'base', once: true, ask: (t, ts, i, ctx) => { const { R, C } = dims(ctx.input); const r = Math.min(1, R - 1), c = Math.min(2, C - 1); return 'Before the walk: how many ints from the start of the strip is m[' + r + '][' + c + ']?'; }, options: (ts, i, ctx) => { const { R, C } = dims(ctx.input); const r = Math.min(1, R - 1), c = Math.min(2, C - 1); return [...new Set([r * C + c, c * R + r, r + c, r * C + c + 1])].sort((a, b) => a - b).map(String); }, answer: (ts, i, ctx) => { const { R, C } = dims(ctx.input); return String(Math.min(1, R - 1) * C + Math.min(2, C - 1)); }, pick: 'option', explain: (ts, i, ctx) => 'i × COLS + j: the whole rows before it, then its place in its own row. COLS is ' + dims(ctx.input).C + '.' },
      { at: (t, i, ts) => t.tag === 'visit' && ts.slice(0, i + 1).filter((x) => x.tag === 'visit').length === 1 && ts.filter((x) => x.tag === 'visit').length > 1, once: true, ask: (t, ts, i, ctx) => 'Click the cell of the strip the next visit reads.', answer: (ts, i, ctx) => { const { R, C } = dims(ctx.input); const nk = ctx.input.order === 'col' ? (R > 1 ? C : 1) : 1; return 'es' + nk; }, explain: (ts, i, ctx) => (ctx.input.order === 'col' ? 'Column by column, the next element is one row down: COLS ints further on.' : 'Row by row, the next element is the very next int.') },
    ],
    quiz: [
      { q: 'In int m[3][4], how many ints come before m[2][1] in memory?', options: ['3', '7', '9', '6'], answer: 2, why: '2 × 4 + 1 = 9: two whole rows of 4, then one more.' },
      { q: 'Why must a function parameter say int m[][COLS] (the column count given)?', options: ['Style only', 'To work out i × COLS + j the compiler must know the row length', 'To know the number of rows', 'So the array is copied'], answer: 1, why: 'The row count is not needed for the address arithmetic; the length of a row is.' },
      { q: 'Which loop order reads memory straight through?', options: ['Outer loop over columns', 'Outer loop over rows, inner over columns', 'Both the same', 'Neither'], answer: 1, why: 'C is row-major: along a row the elements are neighbours in memory.' },
      { q: 'If m starts at address 1000, where is m[1][3] in an int m[3][4]? (int is 4 bytes)', options: ['1016', '1028', '1012', '1007'], answer: 1, why: '(1 × 4 + 3) × 4 = 28 bytes on: 1028.' },
    ],
  });

  // ---- transpose in place ------------------------------------------------------------------------------------
  X.topic({
    id: 'mat-transpose', family: 'matrix', order: 20, title: 'Transpose in place',
    blurb: 'Rows become columns. In a square matrix every element above the diagonal swaps with its mirror image below it; the diagonal stays.',
    code: `/* exchange two ints through their addresses */
void swap(int *x, int *y)
{
    int t = *x;
    *x = *y;
    *y = t;
}

/* turn rows into columns, in place (the matrix must be square) */
void transpose(int m[ROWS][COLS])
{
    int i, j;
    for (i = 0; i < ROWS; i++)              /*@ outer */
        for (j = i + 1; j < COLS; j++)      /*@ inner */
            swap(&m[i][j], &m[j][i]);       /*@ swap */
}                                           /*@ back */`,
    animate: ['transpose'], quiet: ['swap'],
    inputs: [matIn('1 2 3 4; 5 6 7 8; 9 10 11 12; 13 14 15 16', 5, 5, 25, true)],
    presets: [
      { label: '4 × 4', values: { m: '1 2 3 4; 5 6 7 8; 9 10 11 12; 13 14 15 16' } },
      { label: '3 × 3', values: { m: '1 2 3; 4 5 6; 7 8 9' } },
      { label: '2 × 2', values: { m: '1 2; 3 4' } },
      { label: 'Already symmetric', values: { m: '1 7 8; 7 2 9; 8 9 3' } },
      { label: '1 × 1', values: { m: '42' } },
    ],
    counters: ['swaps'],
    main: (inp) => matMain(inp, '', 'transpose(m);'),
    capture: (P) => { const R = P.ev('ROWS'); return { cells: matCells(P, R * R), i: local(P, 'i'), j: local(P, 'j') }; },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const { R, C } = dims(ctx.input);
      const N = R;
      const tr = S.track(ctx, 'm', d.cells);
      // each value is coloured by the triangle it started in, so the two triangles visibly trade places
      const origin = (k) => +tr.ids[k].slice(1);
      const tri = (k) => { const r = Math.floor(k / C), c = k % C; return r < c ? 'blk-a' : r > c ? 'blk-b' : 'diagc'; };
      const pair = tag === 'swap' || (tag === 'inner' && d.j !== null && d.j < N) ? [d.i * C + d.j, d.j * C + d.i] : null;
      const g = S.cells(ctx, 'm', d.cells, { pos: at(C), w: CW, tracked: tr, sub: () => '', arc: 30, cls: (k) => tri(origin(k)) + (pair && pair.includes(k) ? ' focus' : '') });
      const items = g.items.concat(axes(R, C));
      items.push({ key: 'diag', kind: 'line', x1: -12, y1: -12, x2: (N - 1) * CP + CW + 12, y2: (N - 1) * CP + CW + 12, cls: 'diag' });
      items.push({ key: 'diag-t', kind: 'text', x: (N - 1) * CP + CW + 16, y: (N - 1) * CP + CW + 30, text: 'the diagonal stays', cls: 'c-rose' });
      if (pair) {
        const a = ctr(C, pair[0]), b = ctr(C, pair[1]);
        items.push({ key: 'mirror', kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, cls: 'hot' });
        items.push({ key: 'pair-t', kind: 'text', x: N * CP + 40, y: 30, text: 'm[' + d.i + '][' + d.j + '] ↔ m[' + d.j + '][' + d.i + ']', cls: 'code-text step-now' });
      }
      if (d.i !== null && d.i < N) items.push({ key: 'rowband', kind: 'region', x: -6, y: d.i * CP - 6, w: N * CP + 2, h: CW + 12, cls: 'part-b' });
      const sw = ctx.counters.swaps, total = N * (N - 1) / 2;
      const v = (r, c) => d.cells[r * C + c];
      let say = '';
      switch (tag) {
        case 'enter': say = 'transpose(m): ' + N + ' × ' + N + '. Row r must become column r. The ' + total + ' elements above the diagonal (teal) each trade places with their mirror below it (amber).'; break;
        case 'outer': say = d.i < N ? 'Row i = ' + d.i + '. Only its elements to the right of the diagonal are visited: j starts at ' + (d.i + 1) + '.' : 'i = ' + N + ': all rows done.'; break;
        case 'inner': say = d.j < N ? 'j = ' + d.j + ': m[' + d.i + '][' + d.j + '] = ' + v(d.i, d.j) + ' and its mirror m[' + d.j + '][' + d.i + '] = ' + v(d.j, d.i) + '.' : 'j = ' + N + ': the end of row ' + d.i + '.'; break;
        case 'swap': say = 'Swap: ' + v(d.i, d.j) + ' and ' + v(d.j, d.i) + ' cross the diagonal. ' + sw + ' of ' + total + ' swaps done.'; break;
        case 'back': say = 'transpose() is done: ' + S.pl(sw, 'swap') + ', one per pair, and the diagonal was never touched.'; break;
        case 'after': say = 'Transposed. Row 0 now reads ' + d.cells.slice(0, C).join(' ') + ', which was column 0. The teal values all sit below the diagonal now.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'inner' && t.data.j === 1 && t.data.i === 0 && t.data.cells.length > 1, once: true, ask: (t) => 'm[0][1] is about to swap. Click its partner.', answer: (ts, i, ctx) => 'em' + dims(ctx.input).C, explain: () => 'm[1][0]: the same two indexes, the other way round.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'If the inner loop started at j = 0 instead of i + 1, what would the matrix look like at the end?', options: () => ['Transposed', 'Exactly as it started', 'All zeros', 'Upside down'], answer: () => 'Exactly as it started', pick: 'option', explain: () => 'Every pair would be swapped twice, once from each side, which undoes the first swap.' },
    ],
    quiz: [
      { q: 'How many swaps does transposing an n × n matrix take?', options: ['n²', 'n(n - 1) / 2', 'n', '2n'], answer: 1, why: 'One per element above the diagonal.' },
      { q: 'Why does j start at i + 1?', options: ['To skip the diagonal and visit each pair once', 'To go faster only', 'Arrays start at 1', 'It does not matter'], answer: 0, why: 'Starting at 0 swaps every pair twice; starting at i would swap diagonal elements with themselves.' },
      { q: 'Where does m[1][3] end up?', options: ['m[1][3]', 'm[3][1]', 'm[2][2]', 'm[0][3]'], answer: 1, why: 'Transposing exchanges the two indexes.' },
      { q: 'Why can a 3 × 4 matrix not be transposed in place like this?', options: ['It can', 'Its transpose is 4 × 3: a different shape, so the elements need a different layout, not just pairwise swaps', 'It has no diagonal', 'Swaps need even sizes'], answer: 1, why: 'In place pairwise swapping only works when the shape stays the same.' },
    ],
  });

  // ---- spiral order --------------------------------------------------------------------------------------------
  const WALL = { top: 'c-teal', right: 'c-amber', bottom: 'c-violet', left: 'c-rose' };
  X.topic({
    id: 'mat-spiral', family: 'matrix', order: 30, title: 'Spiral order',
    blurb: 'Four boundaries, top, bottom, left and right, close in like walls. Each side of the spiral is printed, then its wall moves one step inwards.',
    code: `/* print the matrix clockwise, from the outside in */
void spiral(int m[ROWS][COLS])
{
    int top = 0, bottom = ROWS - 1;             /*@ init-tb */
    int left = 0, right = COLS - 1;             /*@ init-lr */
    int i;
    while (top <= bottom && left <= right) {    /*@ test */
        for (i = left; i <= right; i++)         /*@ go-right */
            printf("%d ", m[top][i]);           /*@ print-top */
        top++;                                  /*@ wall-top */
        for (i = top; i <= bottom; i++)         /*@ go-down */
            printf("%d ", m[i][right]);         /*@ print-right */
        right--;                                /*@ wall-right */
        if (top <= bottom) {                    /*@ test-bottom */
            for (i = right; i >= left; i--)     /*@ go-left */
                printf("%d ", m[bottom][i]);    /*@ print-bottom */
            bottom--;                           /*@ wall-bottom */
        }
        if (left <= right) {                    /*@ test-left */
            for (i = bottom; i >= top; i--)     /*@ go-up */
                printf("%d ", m[i][left]);      /*@ print-left */
            left++;                             /*@ wall-left */
        }
    }
}                                               /*@ back */`,
    animate: ['spiral'],
    inputs: [matIn('1 2 3 4; 5 6 7 8; 9 10 11 12; 13 14 15 16', 5, 5, 20)],
    presets: [
      { label: '4 × 4', values: { m: '1 2 3 4; 5 6 7 8; 9 10 11 12; 13 14 15 16' } },
      { label: '3 × 5 (wide)', values: { m: '1 2 3 4 5; 6 7 8 9 10; 11 12 13 14 15' } },
      { label: '4 × 2 (tall)', values: { m: '1 2; 3 4; 5 6; 7 8' } },
      { label: 'One row', values: { m: '1 2 3 4' } },
      { label: '3 × 3 (a centre left over)', values: { m: '1 2 3; 4 5 6; 7 8 9' } },
    ],
    counters: ['follows'],
    main: (inp) => matMain(inp, '', 'spiral(m);\n    printf("\\n");'),
    capture: (P) => {
      const R = P.ev('ROWS'), C = P.ev('COLS');
      const o = { cells: matCells(P, R * C), i: local(P, 'i') };
      for (const w of ['top', 'bottom', 'left', 'right']) o[w] = local(P, w);
      return o;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const { R, C } = dims(ctx.input);
      const past = ctx.ticks.slice(0, ctx.i + 1);
      // the cell each print read, from the walls and i at that moment
      const cellOf = (t) => { const q = t.data; switch (t.tag) { case 'print-top': return q.top * C + q.i; case 'print-right': return q.i * C + q.right; case 'print-bottom': return q.bottom * C + q.i; case 'print-left': return q.i * C + q.left; } return null; };
      const printed = past.map(cellOf).filter((k) => k !== null);
      const cur = cellOf(ctx.tick);
      const g = S.cells(ctx, 'm', d.cells, { pos: at(C), w: CW, sub: () => '', cls: (k) => (k === cur ? 'lit' : printed.includes(k) ? 'used' : '') });
      const items = g.items.concat(axes(R, C));
      // the path so far
      for (let q = 1; q < printed.length; q++) {
        const a = ctr(C, printed[q - 1]), b = ctr(C, printed[q]);
        items.push({ key: 'path' + q, kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, cls: q === printed.length - 1 && cur !== null ? 'hot' : 'link' });
      }
      // the four walls: each on the outside edge of the part still to print
      const live = past.some((t) => t.tag === 'init-lr');
      if (live && d.top !== null) {
        const t = d.top, b = d.bottom, l = d.left, r = d.right;
        const y0 = t * CP - 5, y1 = b * CP + CW + 5, x0 = l * CP - 5, x1 = r * CP + CW + 5;
        const lo = (a, z) => Math.min(a, z), hi = (a, z) => Math.max(a, z);
        items.push(...S.wall('w-top', lo(x0, x1), y0, hi(x0, x1), y0, 'top = ' + t, WALL.top, { x: -30 - ('top = ' + t).length * 8, y: y0 + 5, anchor: 'start' }));
        items.push(...S.wall('w-bottom', lo(x0, x1), y1, hi(x0, x1), y1, 'bottom = ' + b, WALL.bottom, { x: -30 - ('bottom = ' + b).length * 8, y: y1 + 5, anchor: 'start' }));
        items.push(...S.wall('w-left', x0, lo(y0, y1), x0, hi(y0, y1), 'left = ' + l, WALL.left, { x: x0, y: R * CP + 28 }));
        items.push(...S.wall('w-right', x1, lo(y0, y1), x1, hi(y0, y1), 'right = ' + r, WALL.right, { x: x1, y: -30 }));
      }
      // the output so far
      const out = printed.map((k) => d.cells[k]);
      items.push({ key: 'out-l', kind: 'text', x: -78, y: R * CP + 70, text: 'printed', cls: 'idx' });
      items.push({ key: 'out', kind: 'text', x: 0, y: R * CP + 70, text: out.join(' '), cls: 'out' });
      const v = cur !== null ? d.cells[cur] : null;
      const none = ctx.prev && !/^print/.test(ctx.prev.tag);
      let say = '';
      switch (tag) {
        case 'enter': say = 'spiral(m): ' + S.pl(R, 'row') + ', ' + C + ' columns. Four walls mark the part still to print; it starts as the whole matrix.'; break;
        case 'init-tb': say = 'top = 0 and bottom = ' + (R - 1) + ': the first and last rows not yet printed.'; break;
        case 'init-lr': say = 'left = 0 and right = ' + (C - 1) + ': the first and last columns not yet printed.'; break;
        case 'test': say = d.top <= d.bottom && d.left <= d.right ? 'Rows ' + d.top + ' to ' + d.bottom + ' and columns ' + d.left + ' to ' + d.right + ' are still inside the walls: go round once more.' : 'The walls have crossed: nothing is left inside. Every element has been printed once.'; break;
        case 'go-right': say = d.i <= d.right ? 'Along the top row, left to right: column ' + d.i + '.' : 'The top row is finished.'; break;
        case 'go-down': say = d.i <= d.bottom ? 'Down the right column: row ' + d.i + '.' : none ? 'No rows are left between top and bottom, so the right column has nothing to print.' : 'The right column is finished.'; break;
        case 'go-left': say = d.i >= d.left ? 'Along the bottom row, right to left: column ' + d.i + '.' : none ? 'No columns are left between the walls: nothing to print.' : 'The bottom row is finished.'; break;
        case 'go-up': say = d.i >= d.top ? 'Up the left column: row ' + d.i + '.' : none ? 'No rows are left between top and bottom, so the left column has nothing to print.' : 'The left column is finished.'; break;
        case 'print-top': case 'print-right': case 'print-bottom': case 'print-left': say = 'Print m[' + Math.floor(cur / C) + '][' + cur % C + '] = ' + v + '.'; break;
        case 'wall-top': say = 'top++: row ' + (d.top - 1) + ' is done, so the top wall drops to row ' + d.top + '.'; break;
        case 'wall-right': say = 'right--: column ' + (d.right + 1) + ' is done, so the right wall moves in to column ' + d.right + '.'; break;
        case 'wall-bottom': say = 'bottom--: the bottom wall rises to row ' + d.bottom + '.'; break;
        case 'wall-left': say = 'left++: the left wall moves in to column ' + d.left + '.'; break;
        case 'test-bottom': say = d.top <= d.bottom ? 'top ' + d.top + ' ≤ bottom ' + d.bottom + ': a bottom row is still left to print.' : 'top ' + d.top + ' > bottom ' + d.bottom + ': no rows are left. Without this test, the row just printed would be printed again backwards.'; break;
        case 'test-left': say = d.left <= d.right ? 'left ' + d.left + ' ≤ right ' + d.right + ': a left column is still left to print.' : 'left ' + d.left + ' > right ' + d.right + ': no columns are left, so the left side is skipped.'; break;
        case 'back': say = 'spiral() ends: the walls have closed in completely.'; break;
        case 'after': say = 'Printed in spiral order: ' + out.join(' ') + '. ' + S.pl(out.length, 'element') + ', each exactly once.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'wall-top' && t.data.top === 1 && t.data.bottom >= 1, once: true, ask: 'The top row is printed. Which element is printed next? Click it.', answer: (ts, i, ctx) => { const { R, C } = dims(ctx.input); return R > 1 ? 'em' + (C + C - 1) : 'em' + (C - 1); }, explain: () => 'The right column, starting one row below the old top: m[1][right].' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'Which element will be printed last?', options: (ts, i, ctx) => { const { flat } = dims(ctx.input); return [...new Set(flat.map(String))].slice(0, 25); }, answer: (ts, i, ctx) => { const { R, C, m } = dims(ctx.input); let t = 0, b = R - 1, l = 0, r = C - 1; const o = []; while (t <= b && l <= r) { for (let k = l; k <= r; k++) o.push(m[t][k]); t++; for (let k = t; k <= b; k++) o.push(m[k][r]); r--; if (t <= b) { for (let k = r; k >= l; k--) o.push(m[b][k]); b--; } if (l <= r) { for (let k = b; k >= t; k--) o.push(m[k][l]); l++; } } return String(o[o.length - 1]); }, pick: 'option', explain: () => 'The spiral ends at the centre, or on the last strip left inside the walls.' },
    ],
    quiz: [
      { q: 'Why test top <= bottom again before printing the bottom row?', options: ['For speed', 'With a single row left, the top pass already printed it; printing the bottom would repeat it backwards', 'C requires it', 'To skip the corners'], answer: 1, why: 'The extra tests matter for matrices that are not square.' },
      { q: 'How many times is each element printed?', options: ['Once', 'Corners twice', 'Up to four times', 'It depends on the size'], answer: 0, why: 'Each pass starts one step past the corner the previous pass printed, and the walls move after every side.' },
      { q: 'What makes the loop end?', options: ['A counter reaching ROWS × COLS', 'top > bottom or left > right: the walls have crossed', 'i reaching COLS', 'A break statement'], answer: 1, why: 'When the walls cross, there is nothing left between them.' },
      { q: 'For a 3 × 3 matrix, which element is printed last?', options: ['m[0][0]', 'm[2][2]', 'm[1][1]', 'm[1][0]'], answer: 2, why: 'The spiral closes in on the centre.' },
    ],
  });

  // ---- sparse matrix to triplets ---------------------------------------------------------------------------------
  X.topic({
    id: 'mat-sparse', family: 'matrix', order: 40, title: 'Sparse matrix as triplets',
    blurb: 'Most of a sparse matrix is zero. Store only the non-zero elements, each as a (row, column, value) triplet, and the zeros take no space at all.',
    code: `/* one non-zero element: where it is and what it holds */
struct triple {
    int row;
    int col;
    int val;
};

/* list the non-zero elements of m in t; returns how many there are */
int to_triples(int m[ROWS][COLS], struct triple t[])
{
    int i, j, k = 0;                       /*@ init */
    for (i = 0; i < ROWS; i++)             /*@ outer */
        for (j = 0; j < COLS; j++)         /*@ inner */
            if (m[i][j] != 0) {            /*@ test-key */
                t[k].row = i;              /*@ set-row */
                t[k].col = j;              /*@ set-col */
                t[k].val = m[i][j];        /*@ set-val */
                k++;                       /*@ count */
            }
    return k;                              /*@ done */
}`,
    animate: ['to_triples'],
    inputs: [matIn('0 0 3 0 0; 0 0 0 0 7; 0 0 0 0 0; 0 5 0 0 0; 0 0 0 9 0', 6, 6, 36)],
    presets: [
      { label: 'Sparse 5 × 5', values: { m: '0 0 3 0 0; 0 0 0 0 7; 0 0 0 0 0; 0 5 0 0 0; 0 0 0 9 0' } },
      { label: 'Diagonal', values: { m: '4 0 0 0; 0 4 0 0; 0 0 4 0; 0 0 0 4' } },
      { label: 'Not sparse at all', values: { m: '1 2 0; 3 4 5; 0 6 7' } },
      { label: 'All zeros', values: { m: '0 0 0; 0 0 0' } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => matMain(inp, 'struct triple t[ROWS * COLS];\n    int count;', 'count = to_triples(m, t);\n    printf("%d non-zero elements\\n", count);'),
    capture: (P) => {
      const R = P.ev('ROWS'), C = P.ev('COLS');
      const tv = P.find('t');
      const base = tv ? (SEE.Types.unqual(tv.type).k === 'ptr' ? P.val('t') : tv.addr) : 0;
      return { cells: matCells(P, R * C), trip: S.ints(P, base, 3 * R * C), i: local(P, 'i'), j: local(P, 'j'), k: local(P, 'k') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const { R, C, flat } = dims(ctx.input);
      const memo = ctx.memo;
      if (d.k !== null) memo.k = d.k;
      const k = d.k === null ? memo.k : d.k;
      const scan = d.i !== null && d.j !== null && d.i < R && d.j < C ? d.i * C + d.j : null;
      const seenUpTo = scan === null ? (tag === 'done' || tag === 'after' ? R * C : -1) : scan;
      const g = S.cells(ctx, 'm', d.cells, { pos: at(C), w: CW, sub: () => '', hotWrites: false, cls: (q, v) => (q === scan && tag === 'test-key' ? (v ? 'lit' : 'focus zero') : v === 0 ? 'zero' : q <= seenUpTo ? 'part-a' : '') });
      const items = g.items.concat(axes(R, C));
      // the triplet table on the right
      const tx = C * CP + 70, ty = 0, RW = 150;
      items.push({ key: 'th', kind: 'node', x: tx, y: ty - 4, w: RW, h: 26, cells: [{ text: 'row' }, { text: 'col' }, { text: 'val' }], cls: 'root', label: 'struct triple t[]' });
      const filled = [];
      for (let q = 0; q < R * C; q++) {
        const r = d.trip.slice(3 * q, 3 * q + 3);
        if (q > k || (q === k && r.every((x) => x === null))) break;
        filled.push(r);
      }
      filled.forEach((r, q) => {
        const src = ctr(C, (r[0] !== null && r[1] !== null) ? r[0] * C + r[1] : 0);
        items.push({ key: 'tr' + q, kind: 'node', x: tx, y: ty + 30 + q * 36, w: RW, h: 32, cells: r.map((x) => ({ text: x === null ? '?' : x, cls: x === null ? 'link' : 'val' })), label: '', cls: q === k && tag !== 'done' && tag !== 'after' ? 'part-b' : 'part-a', enter: 'fly', from: { x: src.x - RW / 2, y: src.y - 16 } });
        items.push({ key: 'tri' + q, kind: 'text', x: tx - 10, y: ty + 30 + q * 36 + 21, text: String(q), cls: 'idx', anchor: 'end' });
      });
      if (scan !== null) items.push({ key: 'scan', kind: 'region', x: -6, y: d.i * CP - 6, w: C * CP + 2, h: CW + 12, cls: 'part-b' });
      // storage: the full grid against the triplets
      const nz = flat.filter((x) => x !== 0).length;
      const by = R * CP + 40;
      const dense = R * C * 4, sparse = (k || 0) * 12, scale = 260 / Math.max(dense, nz * 12, 1);
      items.push({ key: 'bd', kind: 'region', x: 0, y: by, w: dense * scale, h: 16, cls: 'fill-b' });
      items.push({ key: 'bd-t', kind: 'text', x: dense * scale + 10, y: by + 13, text: 'whole matrix: ' + R + ' × ' + C + ' × 4 = ' + dense + ' bytes', cls: 'mono' });
      items.push({ key: 'bs', kind: 'region', x: 0, y: by + 28, w: Math.max(2, sparse * scale), h: 16, cls: 'fill-a' });
      items.push({ key: 'bs-t', kind: 'text', x: Math.max(2, sparse * scale) + 10, y: by + 41, text: 'triplets: ' + (k || 0) + ' × 12 = ' + sparse + ' bytes', cls: 'mono' });
      const v = scan !== null ? d.cells[scan] : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'to_triples(m, t): ' + R * C + ' elements, of which ' + nz + ' are not zero. Only those ' + nz + ' will be kept.'; break;
        case 'init': say = 'k counts the triplets written so far: none yet.'; break;
        case 'outer': say = d.i < R ? 'Row ' + d.i + '.' : 'Every row scanned.'; break;
        case 'inner': say = d.j < C ? 'm[' + d.i + '][' + d.j + '].' : 'The end of row ' + d.i + '.'; break;
        case 'test-key': say = v !== 0 ? 'm[' + d.i + '][' + d.j + '] = ' + v + ' is not zero: it gets a triplet.' : 'm[' + d.i + '][' + d.j + '] is zero: skipped, it costs nothing to store.'; break;
        case 'set-row': say = 't[' + k + '].row = ' + d.i + '.'; break;
        case 'set-col': say = 't[' + k + '].col = ' + d.j + '.'; break;
        case 'set-val': say = 't[' + k + '].val = ' + d.cells[d.i * C + d.j] + '. The position travels with the value, because the grid itself will not be kept.'; break;
        case 'count': say = 'k = ' + k + ': ' + S.pl(k, 'triplet') + ' so far.'; break;
        case 'done': say = 'to_triples() returns ' + k + '. Every element was looked at once; only the non-zero ones were written.'; break;
        case 'after': say = k + ' triplets take ' + sparse + ' bytes against ' + dense + ' for the whole matrix. ' + (sparse < dense ? 'A saving, because fewer than a third of the elements are non-zero.' : 'No saving here: with this many non-zero elements, three ints each cost more than the grid.'); break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'init', once: true, ask: 'How many triplets will be written?', options: (ts, i, ctx) => { const { R, C, flat } = dims(ctx.input); const nz = flat.filter((x) => x !== 0).length; return [...new Set([nz, R * C, R, C])].sort((a, b) => a - b).map(String); }, answer: (ts, i, ctx) => String(dims(ctx.input).flat.filter((x) => x !== 0).length), pick: 'option', explain: () => 'One per non-zero element; the zeros are skipped.' },
      { at: (t) => t.tag === 'set-row', once: true, ask: 'This triplet records row and column as well as the value. Why?', options: () => ['To sort it later', 'Without the grid, the position is lost unless it is stored', 'C needs three fields', 'To count the zeros'], answer: () => 'Without the grid, the position is lost unless it is stored', pick: 'option', explain: () => 'In a 2-D array the position is implied by where a value sits; in a list of triplets it must be written down.' },
    ],
    quiz: [
      { q: 'A 100 × 100 int matrix has 300 non-zero elements. How many bytes do the triplets need (4-byte ints)?', options: ['40000', '3600', '1200', '300'], answer: 1, why: '300 × 3 ints × 4 bytes = 3600, against 40000 for the full grid.' },
      { q: 'When do triplets stop saving space?', options: ['Never', 'When at least a third of the elements are non-zero', 'When the matrix is square', 'When values are negative'], answer: 1, why: 'Each non-zero costs 3 ints instead of 1; break-even is at one third.' },
      { q: 'In what order are the triplets written?', options: ['By value', 'Row-major: row by row, left to right', 'Column by column', 'Random'], answer: 1, why: 'They follow the scan, which is row by row.' },
      { q: 'What is lost by storing only triplets?', options: ['Nothing', 'Constant-time access to m[i][j]: finding an element now means searching the list', 'The values', 'The row numbers'], answer: 1, why: 'A lookup must search for the matching row and column instead of computing an address.' },
    ],
  });
})(SEE);
