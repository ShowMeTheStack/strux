// Stacks at work: evaluating a postfix expression, and an editor's undo and redo stacks.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit;
  const CW = 46, CG = 6;
  const cx = (x0, j) => x0 + j * (CW + CG) + CW / 2;
  const strip = (prefix, text, x0, y0, cls) => text.split('').map((ch, j) => ({ key: prefix + j, kind: 'cell', x: x0 + j * (CW + CG), y: y0, w: CW, h: CW, text: ch, sub: j, cls: cls ? cls(j, ch) : '', pick: true }));
  const q = (ch) => '\'' + ch + '\'';

  // ---- postfix evaluation ------------------------------------------------------------------------------------
  const apply = (a, op, b) => (op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : Math.trunc(a / b));
  /** Run the expression in JS: {error} or {value, depth} */
  const simulate = (s) => {
    const st = [];
    let depth = 0;
    for (const c of s) {
      if (/[0-9]/.test(c)) st.push(+c);
      else {
        if (st.length < 2) return { error: 'Expression: "' + c + '" needs two values before it, but there ' + (st.length === 1 ? 'is only one' : 'are none') };
        const b = st.pop(), a = st.pop();
        if (c === '/' && b === 0) return { error: 'Expression: it divides by zero' };
        st.push(apply(a, c, b));
      }
      depth = Math.max(depth, st.length);
    }
    if (st.length !== 1) return { error: 'Expression: ' + st.length + ' values are left at the end; an operator is missing' };
    return { value: st[0], depth };
  };

  X.topic({
    id: 'app-postfix-eval', family: 'sqapps', order: 30, title: 'Evaluate postfix',
    blurb: 'Numbers go onto a stack. Each operator takes the top two off, works them out, and puts the answer back. The first one popped is the right-hand operand.',
    headC: () => `#include <stdio.h>
#include <ctype.h>

#define MAX 16

int stack[MAX];     /* values waiting for an operator */
int top = -1;

void push(int v)
{
    stack[++top] = v;
}

int pop(void)
{
    return stack[top--];
}`,
    code: `/* the value of a postfix expression of one-digit numbers */
int eval(const char *expr)
{
    int i, a, b;
    char c;
    for (i = 0; expr[i] != '\\0'; i++) {     /*@ read */
        c = expr[i];                         /*@ char */
        if (isdigit(c))                      /*@ test-digit */
            push(c - '0');                   /*@ push-num */
        else {
            b = pop();                       /*@ pop-b */
            a = pop();                       /*@ pop-a */
            switch (c) {                     /*@ op */
            case '+': push(a + b); break;    /*@ apply */
            case '-': push(a - b); break;    /*@ apply */
            case '*': push(a * b); break;    /*@ apply */
            case '/': push(a / b); break;    /*@ apply */
            }
        }
    }
    return pop();                            /*@ result */
}`,
    animate: ['eval'], quiet: ['push', 'pop'],
    inputs: [{ id: 'expr', kind: 'text', label: 'Postfix expression (one-digit numbers)', def: '52-3*1+' }],
    check: (inp) => {
      const s = String(inp.expr || '');
      if (!s.length) return 'Expression: type one, like 23+4*';
      if (s.length > 13) return 'Expression: at most 13 characters, so the picture stays readable';
      if (!/^[0-9+\-*/]+$/.test(s)) return 'Expression: one-digit numbers and + - * / only, no spaces';
      const r = simulate(s);
      if (r.error) return r.error;
      if (r.depth > 6) return 'Expression: at most 6 values waiting at once, so the stack fits';
      return null;
    },
    presets: [
      { label: 'Mixed', values: { expr: '52-3*1+' } },
      { label: 'Order matters', values: { expr: '82-' } },
      { label: 'Deep stack', values: { expr: '2345*+*' } },
      { label: 'Division', values: { expr: '93-2/' } },
      { label: 'Just a number', values: { expr: '7' } },
    ],
    counters: ['writes'],
    main: (inp) => `char postfix[] = "${inp.expr}";

int main(void)
{
    int value = eval(postfix);
    printf("%d\\n", value);
    return 0;
}`,
    capture(P) {
      const loc = (n) => (P.has(n, 0) && P.isSet(n, 0) ? P.val(n, 0) : null);
      return { s: S.str(P.arr('postfix', 16)), stack: P.arr('stack', 16), top: P.val('top'), i: loc('i'), a: loc('a'), b: loc('b'), c: loc('c'), value: P.has('value') && P.isSet('value') ? P.val('value') : null };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, s = d.s;
      const m = ctx.memo;
      if (d.i !== null) m.lastI = d.i;
      const cur = d.i !== null ? d.i : m.lastI;
      // a mirror of the stack holding an id per value, so a value keeps its box as it moves
      if (m.at !== ctx.i) {
        m.at = ctx.i;
        m.st = m.st || []; m.next = m.next || 0; m.hand = m.hand || {};
        if (tag === 'push-num') m.st.push({ id: m.next++, from: 'in', pos: cur });
        if (tag === 'pop-b') { m.hand = { b: m.st.pop() }; }
        if (tag === 'pop-a') m.hand.a = m.st.pop();
        if (tag === 'apply') { m.st.push({ id: m.next++, from: 'eq' }); m.done = m.hand; m.hand = {}; }
        if (tag === 'result') m.hand = { r: m.st.pop() };
        if (tag !== 'apply') m.done = null;
      }
      const n = s.length;
      const W = n * (CW + CG) - CG;
      const x0 = -W / 2;
      const r = simulate(s);
      const SH = 42, base = 110 + Math.max(1, r.depth || 1) * (SH + 6);
      const sx = -150;
      const items = [S.extent(Math.min(x0, -230) - 30, -60, Math.max(W, 520) + 120, base + 90)];
      const ended = tag === 'result' || tag === 'after';
      items.push(...strip('s', s, x0, 0, (j, ch) => (j === cur && !ended && tag !== 'enter' ? 'sk-read' : (cur !== null && j < cur) || ended ? 'sk-plain' : /[0-9]/.test(ch) ? 'sk-live' : 'sk-op')));
      if (cur !== null && cur < n && !ended) items.push({ key: 'ci', kind: 'cursor', at: 's' + cur, side: 'above', text: 'i', cls: 'c-teal' });
      // the value stack
      items.push({ key: 'stT', kind: 'text', x: sx + 50, y: base + 40, text: 'stack', cls: 'sk-title', anchor: 'middle' });
      items.push({ key: 'stFloor', kind: 'line', x1: sx - 14, y1: base + 10, x2: sx + 114, y2: base + 10, cls: 'sk-floor' });
      const slotY = (k) => base - (k + 1) * (SH + 6) + 4;
      const EQX = 30, EQY = slotY(0) - 20;
      m.st.forEach((v, k) => {
        const val = d.stack[k];
        const from = v.from === 'in' ? { x: cx(x0, v.pos) - 50, y: 0 } : { x: EQX + 200, y: EQY };
        items.push({ key: 'v' + v.id, kind: 'cell', x: sx, y: slotY(k), w: 100, h: SH, text: val, sub: '', cls: 'sk-live' + (k === m.st.length - 1 && /pop|result/.test(tag) ? ' sk-top' : ''), enter: 'fly', from, pick: true });
      });
      if (!m.st.length && !m.hand.r) items.push({ key: 'stEmpty', kind: 'text', x: sx + 50, y: base - 14, text: 'empty', cls: 'sk-label', anchor: 'middle' });
      // the operator's workbench: a op b = result
      const hand = m.done || m.hand;
      const c = d.c !== null ? String.fromCharCode(d.c) : '';
      const cellAt = (key, x, y, text, cls) => ({ key, kind: 'cell', x, y, w: 64, h: SH, text, sub: '', cls });
      if (hand.a || hand.b) {
        if (hand.a) items.push(cellAt('v' + hand.a.id, EQX, EQY, d.a, 'sk-live'));
        else items.push({ key: 'aSlot', kind: 'region', x: EQX, y: EQY, w: 64, h: SH, cls: 'sk-slot' });
        items.push({ key: 'eqOp', kind: 'text', x: EQX + 88, y: EQY + SH / 2 + 6, text: c, cls: 'sk-eq hot', anchor: 'middle' });
        if (hand.b) items.push(cellAt('v' + hand.b.id, EQX + 112, EQY, d.b, 'sk-live'));
        items.push({ key: 'eqA', kind: 'text', x: EQX + 32, y: EQY + SH + 18, text: 'a', cls: 'sk-label', anchor: 'middle' });
        items.push({ key: 'eqB', kind: 'text', x: EQX + 144, y: EQY + SH + 18, text: 'b', cls: 'sk-label', anchor: 'middle' });
        if (hand.a && hand.b && (tag === 'op' || tag === 'apply')) items.push({ key: 'eqR', kind: 'text', x: EQX + 196, y: EQY + SH / 2 + 6, text: '= ' + apply(d.a, c, d.b), cls: 'sk-eq good' });
      }
      if (hand.r) items.push(cellAt('v' + hand.r.id, EQX, EQY, d.stack[0], 'sk-ok'));
      if (ended) items.push({ key: 'res', kind: 'text', x: EQX + 80, y: EQY + SH / 2 + 6, text: 'the value is ' + (d.value !== null ? d.value : d.stack[0]), cls: 'sk-eq good' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'eval("' + s + '"): no brackets and no precedence. Read left to right; a stack holds the values that are waiting for an operator.'; break;
        case 'read': say = cur < n ? 'i = ' + cur + ': next comes ' + q(s[cur]) + '.' : 'The end of the expression.'; break;
        case 'char': say = 'c = ' + q(c) + '.'; break;
        case 'test-digit': say = /[0-9]/.test(c) ? q(c) + ' is a digit: a value.' : q(c) + ' is an operator: it works on the two most recent values.'; break;
        case 'push-num': say = 'push(' + q(c) + ' - \'0\') pushes the number ' + d.stack[d.top] + '. It waits until an operator needs it.'; break;
        case 'pop-b': say = 'b = pop() = ' + d.b + '. The top value is the RIGHT-hand operand: it was pushed last.'; break;
        case 'pop-a': say = 'a = pop() = ' + d.a + ', the left-hand operand.'; break;
        case 'op': say = 'The operator is ' + q(c) + ': work out a ' + c + ' b = ' + d.a + ' ' + c + ' ' + d.b + ' = ' + apply(d.a, c, d.b) + '.' + (c === '-' || c === '/' ? ' The order matters here: ' + d.b + ' ' + c + ' ' + d.a + ' would be ' + (c === '/' && d.a === 0 ? 'a division by zero' : apply(d.b, c, d.a)) + '.' : ''); break;
        case 'apply': say = 'push(' + d.a + ' ' + c + ' ' + d.b + '): the answer, ' + d.stack[d.top] + ', goes back on the stack. It is now a value like any other, ready for the next operator.'; break;
        case 'result': say = 'The expression is finished and exactly one value is left: pop() returns ' + d.stack[0] + '.'; break;
        case 'after': say = '"' + s + '" = ' + d.value + '. Every operator found its two operands already on the stack: that is why postfix needs no brackets.'; break;
      }
      return { items, say, slow: tag === 'apply' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'pop-b', once: true, ask: 'An operator has arrived. Click the value that will become b, its right-hand operand.', answer: (ts, i, ctx) => { void ctx; let id = -1; const st = []; for (let j = 0; j <= i; j++) { const tg = ts[j].tag; if (tg === 'push-num') st.push(++id); else if (tg === 'pop-b' || tg === 'pop-a') st.pop(); else if (tg === 'apply') st.push(++id); } return 'v' + st[st.length - 1]; }, explain: () => 'The top of the stack: the value pushed most recently is the right-hand operand.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'op' && /[-/]/.test(String.fromCharCode(ts[i + 1].data.c)), once: true, ask: (t, ts, i) => { const d = ts[i + 1].data; return 'a = ' + d.a + ', b = ' + d.b + ', and the operator is ' + q(String.fromCharCode(d.c)) + '. What goes back on the stack?'; }, options: (ts, i) => { const d = ts[i + 1].data, c = String.fromCharCode(d.c); const o = [String(apply(d.a, c, d.b))]; if (!(c === '/' && d.a === 0)) o.push(String(apply(d.b, c, d.a))); o.push(String(d.a + d.b)); return [...new Set(o)].sort(); }, answer: (ts, i) => { const d = ts[i + 1].data; return String(apply(d.a, String.fromCharCode(d.c), d.b)); }, pick: 'option', explain: () => 'a op b, with a the value pushed earlier.' },
    ],
    quiz: [
      { q: 'What is the value of 8 2 - ?', options: ['-6', '6', '10', '4'], answer: 1, why: 'b = 2 is popped first, then a = 8: a - b = 6.' },
      { q: 'What is the value of 2 3 4 * + ?', options: ['20', '14', '24', '9'], answer: 1, why: '3 * 4 = 12 first, then 2 + 12 = 14.' },
      { q: 'An operator finds only one value on the stack. What does that mean?', options: ['The answer is that value', 'The expression is malformed', 'Push a zero', 'Skip the operator'], answer: 1, why: 'Every binary operator needs two values before it.' },
      { q: 'Why does postfix need no brackets?', options: ['It only has + and *', 'The order of the symbols already fixes which operator works on which values', 'Brackets are implied by spaces', 'It does need them'], answer: 1, why: 'Each operator applies to the two values just before it, so there is never any doubt.' },
      { q: 'How many values are on the stack when a correct expression ends?', options: ['None', 'Exactly one: the answer', 'One per operator', 'It depends'], answer: 1, why: 'Each number adds one, each operator removes two and adds one; a correct expression leaves one.' },
    ],
    compareWith: 'app-infix-postfix',
  });

  // ---- undo and redo -------------------------------------------------------------------------------------------
  /** "c a t del undo redo" into operations */
  const parseEd = (text) => String(text || '').trim().split(/[\s,]+/).filter(Boolean).map((t) => {
    const w = t.toLowerCase();
    if (/^[a-z]$/.test(w)) return { op: 'type', ch: w };
    if (w === 'del' || w === 'undo' || w === 'redo') return { op: w };
    throw new Error('"' + t + '" is not an action: a single letter types it; del, undo and redo do what they say');
  });
  const callOf = (o) => (o.op === 'type' ? 'type(\'' + o.ch + '\')' : o.op === 'del' ? 'erase()' : o.op + '()');
  const what = (kind, ch) => (kind === 't' ? 'typed ' + ch : 'erased ' + ch);

  X.topic({
    id: 'app-undo', family: 'sqapps', order: 40, title: 'Undo and redo',
    blurb: 'Every edit is pushed onto an undo stack. Undo pops the newest, reverses it and pushes it onto a redo stack. Any new edit wipes the redo stack, because that future no longer exists.',
    headC: () => `#include <stdio.h>

#define MAX 16

struct action {
    char kind;      /* 't': a letter was typed, 'e': a letter was erased */
    char ch;        /* which letter */
};

char text[MAX + 1];             /* what the editor shows */
int len = 0;
struct action undos[MAX];       /* edits that can be undone, newest on top */
int nundo = 0;
struct action redos[MAX];       /* edits that were undone and can be redone */
int nredo = 0;

void add_letter(char ch)
{
    text[len++] = ch;
    text[len] = '\\0';
}

char remove_letter(void)
{
    char ch = text[--len];
    text[len] = '\\0';
    return ch;
}

/* push an action onto one of the two stacks */
void record(struct action *stack, int *n, char kind, char ch)
{
    stack[*n].kind = kind;
    stack[*n].ch = ch;
    (*n)++;
}`,
    code: `/* the user types ch */
void type(char ch)
{
    add_letter(ch);                          /*@ write */
    record(undos, &nundo, 't', ch);          /*@ push-undo */
    nredo = 0;                               /*@ clear-redo */
}

/* the user presses backspace */
void erase(void)
{
    char ch;
    if (len == 0)                            /*@ empty-test */
        return;                              /*@ nothing */
    ch = remove_letter();                    /*@ rub */
    record(undos, &nundo, 'e', ch);          /*@ push-undo */
    nredo = 0;                               /*@ clear-redo */
}

/* take back the newest edit */
void undo(void)
{
    struct action *a;
    if (nundo == 0)                          /*@ none */
        return;                              /*@ nothing */
    a = &undos[--nundo];                     /*@ pop-undo */
    if (a->kind == 't')                      /*@ kind */
        remove_letter();                     /*@ unwrite */
    else
        add_letter(a->ch);                   /*@ rewrite */
    record(redos, &nredo, a->kind, a->ch);   /*@ push-redo */
}

/* do again the edit undone most recently */
void redo(void)
{
    struct action *a;
    if (nredo == 0)                          /*@ none */
        return;                              /*@ nothing */
    a = &redos[--nredo];                     /*@ pop-redo */
    if (a->kind == 't')                      /*@ kind */
        add_letter(a->ch);                   /*@ rewrite */
    else
        remove_letter();                     /*@ unwrite */
    record(undos, &nundo, a->kind, a->ch);   /*@ push-undo */
}`,
    animate: ['type', 'erase', 'undo', 'redo'], quiet: ['add_letter', 'remove_letter', 'record'],
    inputs: [{ id: 'ops', kind: 'text', label: 'Edits (a letter types it; del, undo, redo)', def: 'c a t undo undo redo s' }],
    check: (inp) => {
      let o;
      try { o = parseEd(inp.ops); } catch (e) { return e.message; }
      if (!o.length) return 'Edits: give at least one';
      if (o.length > 12) return 'Edits: at most 12, so the picture stays readable';
      return null;
    },
    presets: [
      { label: 'Undo, redo, new edit', values: { ops: 'c a t undo undo redo s' } },
      { label: 'Undo an erase', values: { ops: 'd o g del del undo undo' } },
      { label: 'Undo everything', values: { ops: 'h i undo undo undo redo redo' } },
      { label: 'Nothing to redo', values: { ops: 'a redo b undo x redo' } },
    ],
    counters: ['writes'],
    main: (inp) => 'int main(void)\n{\n' + parseEd(inp.ops).map((o) => '    ' + callOf(o) + ';').join('\n') + '\n    printf("%s\\n", text);\n    return 0;\n}',
    capture(P) {
      const nu = P.val('nundo'), nr = P.val('nredo');
      const stk = (name, cnt) => { const o = []; for (let i = 0; i < cnt; i++) o.push({ kind: String.fromCharCode(P.ev(name + '[' + i + '].kind')), ch: String.fromCharCode(P.ev(name + '[' + i + '].ch')) }); return o; };
      const hand = P.has('a', 0) && P.isSet('a', 0) && P.val('a', 0) ? { kind: String.fromCharCode(P.ev('a->kind')), ch: String.fromCharCode(P.ev('a->ch')) } : null;
      return { text: S.str(P.arr('text', 17)), undos: stk('undos', nu), redos: stk('redos', nr), hand };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const ops = parseEd(ctx.input.ops);
      const k = S.opIndex(ctx);
      const op = ops[Math.min(k, ops.length - 1)];
      const m = ctx.memo;
      // card ids: a card keeps its id when it moves from one stack to the other
      if (m.at !== ctx.i) {
        m.at = ctx.i;
        m.u = m.u || []; m.r = m.r || []; m.next = m.next || 0; m.gone = [];
        m.res = m.res || [];
        if (tag === 'push-undo') m.u.push(m.hand !== undefined && m.hand !== null ? m.hand : m.next++);
        if (tag === 'push-redo') m.r.push(m.hand);
        if (tag === 'push-undo' || tag === 'push-redo') m.hand = null;
        if (tag === 'pop-undo') m.hand = m.u.pop();
        if (tag === 'pop-redo') m.hand = m.r.pop();
        if (tag === 'clear-redo') { m.gone = m.r; m.r = []; }
        if (tag === 'nothing') m.res[k] = 'none';
        m.cardAt = m.cardAt || {};
        m.cardAt[ctx.i] = m.u[m.u.length - 1];
      }
      const CARD_W = 128, CARD_H = 36, GAP = 6;
      if (m.most === undefined) {
        // the tallest either stack gets, worked out from the edits
        let nu = 0, nr = 0, len = 0; m.most = 1;
        for (const o of ops) {
          if (o.op === 'type') { nu++; nr = 0; len++; } else if (o.op === 'del') { if (len) { len--; nu++; nr = 0; } }
          else if (o.op === 'undo') { if (nu) { nu--; nr++; } } else if (nr) { nr--; nu++; }
          m.most = Math.max(m.most, nu, nr);
        }
      }
      const base = 130 + m.most * (CARD_H + GAP);
      const UX = -170, RX = 54;
      const items = [S.extent(-260, -150, 520, base + 110)];
      items.push(...S.script(ops, tag === 'after' ? k + 1 : k, { x0: -Math.min(ops.length, 12) * 49 / 2 + 20, y0: -140, w: 44, label: (o) => (o.op === 'type' ? o.ch : o.op === 'del' ? '⌫' : o.op), result: (j) => (m.res[j] === 'none' ? 'nothing' : ''), bad: () => true }));
      // the editor window
      const text = d.text;
      const EW = Math.max(6, text.length + 1) * 30 + 30;
      items.push({ key: 'ed', kind: 'region', x: -EW / 2, y: -64, w: EW, h: 56, cls: 'sk-frame', text: '' });
      text.split('').forEach((ch, j) => items.push({ key: 'ch' + j, kind: 'text', x: -EW / 2 + 22 + j * 30, y: -27, text: ch, cls: 'sk-eq', size: 24, anchor: 'middle', enter: 'fade' }));
      items.push({ key: 'caret', kind: 'line', x1: -EW / 2 + 9 + text.length * 30, y1: -54, x2: -EW / 2 + 9 + text.length * 30, y2: -18, cls: 'sk-ceiling' });
      if (!text.length) items.push({ key: 'edEmpty', kind: 'text', x: 0, y: -80, text: 'the text is empty', cls: 'sk-label', anchor: 'middle' });
      // the two stacks
      const slotY = (j) => base - (j + 1) * (CARD_H + GAP);
      for (const [name, x, list, data] of [['undo', UX, m.u, d.undos], ['redo', RX, m.r, d.redos]]) {
        items.push({ key: 'fl' + name, kind: 'line', x1: x - 12, y1: base + 4, x2: x + CARD_W + 12, y2: base + 4, cls: 'sk-floor' });
        items.push({ key: 'flT' + name, kind: 'text', x: x + CARD_W / 2, y: base + 28, text: name + ' stack (' + list.length + ')', cls: 'sk-title', anchor: 'middle' });
        list.forEach((id, j) => {
          const a = data[j] || { kind: 't', ch: '?' };
          items.push({ key: 'card' + id, kind: 'node', x, y: slotY(j), w: CARD_W, h: CARD_H, cells: [{ text: what(a.kind, a.ch), cls: 'val' }], cls: 'sk-card' + (a.kind === 'e' ? ' sk-erase' : '') + (j === list.length - 1 && (tag === 'none' || tag === 'empty-test') ? ' sk-hot' : ''), enter: 'drop', exit: 'fall', pick: true });
        });
      }
      // a card in the hand: popped, waiting to be reversed and moved across
      if (m.hand !== null && m.hand !== undefined) {
        const card = d.hand || m.handInfo || { kind: 't', ch: '?' };
        m.handInfo = card;
        items.push({ key: 'card' + m.hand, kind: 'node', x: -CARD_W / 2, y: 60, w: CARD_W, h: CARD_H, cells: [{ text: what(card.kind, card.ch), cls: 'val' }], cls: 'sk-card sk-hot' + (card.kind === 'e' ? ' sk-erase' : ''), pick: true });
        items.push({ key: 'handT', kind: 'text', x: 0, y: 50, text: op.op === 'undo' ? 'reverse it' : 'do it again', cls: 'sk-label hot', anchor: 'middle' });
      }
      const name = callOf(op);
      let say = '';
      switch (tag) {
        case 'enter': say = name + ' is the first edit. The text is empty and both stacks are empty.'; break;
        case 'write': say = 'The letter ' + q(op.ch) + ' appears: the text is now "' + text + '".'; break;
        case 'push-undo': say = op.op === 'redo' ? 'The redone edit goes back onto the undo stack, so it can be undone again.' : 'The edit is recorded on the undo stack: "' + what(d.undos[d.undos.length - 1].kind, d.undos[d.undos.length - 1].ch) + '". It is on top, so it will be the first one undone.'; break;
        case 'clear-redo': say = m.gone.length ? 'nredo = 0: a new edit throws the redo stack away (' + m.gone.length + ' card' + (m.gone.length === 1 ? '' : 's') + '). Those undone edits belonged to a different history.' : 'nredo = 0. The redo stack was already empty.'; break;
        case 'empty-test': say = text.length ? 'erase(): there is a letter to rub out.' : 'erase(): the text is empty, so there is nothing to rub out.'; break;
        case 'nothing': say = name + ' has nothing to do and returns.'; break;
        case 'rub': say = 'The last letter is rubbed out: the text is now "' + text + '".'; break;
        case 'none': {
          const list = op.op === 'undo' ? d.undos : d.redos;
          say = list.length ? name + ': the ' + op.op + ' stack holds ' + list.length + ' edit' + (list.length === 1 ? '' : 's') + '. The newest is on top.' : name + ': the ' + op.op + ' stack is empty.';
          break;
        }
        case 'pop-undo': say = 'Pop the newest edit off the undo stack: "' + (d.hand ? what(d.hand.kind, d.hand.ch) : '') + '".'; break;
        case 'pop-redo': say = 'Pop the newest card off the redo stack: "' + (d.hand ? what(d.hand.kind, d.hand.ch) : '') + '".'; break;
        case 'kind': say = d.hand && d.hand.kind === 't' ? 'It is a typed letter.' : 'It is an erased letter.'; break;
        case 'unwrite': say = (op.op === 'undo' ? 'To undo typing, remove the letter' : 'Redo the erase: remove the letter') + '. The text is now "' + text + '".'; break;
        case 'rewrite': say = (op.op === 'undo' ? 'To undo an erase, put the letter back' : 'Redo the typing: put the letter back') + '. The text is now "' + text + '".'; break;
        case 'push-redo': say = 'The undone edit moves onto the redo stack, so redo() can bring it back.'; break;
        case 'after':
          if (k < ops.length - 1) say = name + ' is done. Text: "' + text + '". Undo stack ' + d.undos.length + ', redo stack ' + d.redos.length + '. Next: ' + callOf(ops[k + 1]) + '.';
          else say = 'All edits done. The text is "' + text + '". Two stacks are all an editor needs: undo walks back through history, redo walks forward again, until a new edit starts a new future.';
          break;
      }
      return { items, say, slow: tag === 'clear-redo' && m.gone.length > 0 };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'clear-redo' && ts[i + 1].data.redos.length === 0 && t.data.redos.length > 0, once: true, ask: (t) => 'A new edit has been made while the redo stack holds ' + t.data.redos.length + ' card' + (t.data.redos.length === 1 ? '' : 's') + '. What happens to them?', options: () => ['They stay for later', 'They are thrown away', 'They are redone now'], answer: () => 'They are thrown away', pick: 'option', explain: () => 'Once history has changed, redoing an old edit could make no sense, so nredo = 0.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'pop-undo', once: true, ask: 'undo() is about to pop. Click the card it will take.', answer: (ts, i, ctx) => 'card' + ctx.memo.cardAt[i], explain: () => 'The top card: the newest edit is the first to be undone.' },
    ],
    quiz: [
      { q: 'You type a, b, c, then undo twice. What is the text?', options: ['"ab"', '"a"', '"c"', '"abc"'], answer: 1, why: 'Undo takes back c, then b.' },
      { q: 'Then you redo once. What is the text?', options: ['"a"', '"ab"', '"abc"', '"ac"'], answer: 1, why: 'Redo brings back the edit undone most recently: typing b.' },
      { q: 'You type a, b, undo, then type x. Can you redo the b?', options: ['Yes', 'No: the new edit cleared the redo stack', 'Only once', 'Only if you undo x'], answer: 1, why: 'A new edit starts a new history; the redo stack is wiped.' },
      { q: 'Why are stacks the right structure for undo?', options: ['They are sorted', 'The most recent edit must be the first one undone', 'They use less memory', 'They allow random access'], answer: 1, why: 'Undo goes back in time, newest first: last in, first out.' },
      { q: 'What does undoing an erase do to the text?', options: ['Removes a letter', 'Puts the erased letter back', 'Nothing', 'Clears it'], answer: 1, why: 'Each action is reversed by its opposite: an erase by adding the letter again.' },
    ],
  });
})(SEE);
