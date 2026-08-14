// Stacks at work: matching brackets, and turning infix expressions into postfix (shunting-yard).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit;

  X.family({
    id: 'sqapps', order: 6, group: 'Stacks and queues', title: 'Stacks and queues at work',
    blurb: 'Programs that lean on a stack: checking brackets, reading and evaluating expressions, undo and redo, and the call stack that every recursive function uses.',
    head: (t, inp) => (t.headC ? t.headC(inp) : '#include <stdio.h>'),
  });

  const CW = 46, CG = 6;
  /** A row of character cells; cls(j, ch) gives each its classes */
  const strip = (prefix, text, x0, y0, cls) => text.split('').map((ch, j) => ({ key: prefix + j, kind: 'cell', x: x0 + j * (CW + CG), y: y0, w: CW, h: CW, text: ch, sub: j, cls: cls ? cls(j, ch) : '', pick: true }));
  const cx = (x0, j) => x0 + j * (CW + CG) + CW / 2;
  const q = (ch) => '\'' + ch + '\'';
  X.SqStrip = { strip, cx, CW, CG };

  // ---- bracket matching ------------------------------------------------------------------------------------
  const OPEN = '([{', CLOSE = ')]}';
  const match = (c) => OPEN[CLOSE.indexOf(c)];
  /** Simulate the check in JS: the deepest the stack gets */
  const depthOf = (s) => { let n = 0, mx = 0; for (const c of s) { if (OPEN.includes(c)) mx = Math.max(mx, ++n); else if (CLOSE.includes(c)) { if (!n) break; n--; } } return mx; };

  X.topic({
    id: 'app-brackets', family: 'sqapps', order: 10, title: 'Matching brackets',
    blurb: 'Every opening bracket waits on a stack; every closing one must meet its own kind on top. A wrong kind, a closer with nothing to meet, or openers left over at the end all mean the brackets do not balance.',
    headC: () => `#include <stdio.h>

#define MAX 16

char stack[MAX];    /* opening brackets still waiting for their partner */
int top = -1;

/* the opening bracket that closing bracket c needs */
char opener(char c)
{
    if (c == ')')
        return '(';
    if (c == ']')
        return '[';
    return '{';
}`,
    code: `/* 1 if every bracket in s is closed by the right kind, in the right order */
int balanced(const char *s)
{
    int i;
    for (i = 0; s[i] != '\\0'; i++) {                 /*@ read */
        char c = s[i];                                /*@ char */
        if (c == '(' || c == '[' || c == '{')         /*@ test-open */
            stack[++top] = c;                         /*@ push */
        else if (c == ')' || c == ']' || c == '}') {  /*@ test-close */
            if (top == -1)                            /*@ test-empty */
                return 0;                             /*@ no-opener */
            if (stack[top] != opener(c))              /*@ compare */
                return 0;                             /*@ mismatch */
            top--;                                    /*@ pop */
        }
    }
    return top == -1;                                 /*@ leftover */
}`,
    animate: ['balanced'], quiet: ['opener'],
    inputs: [{ id: 'text', kind: 'text', label: 'Text to check', def: '{a[b(c)d]e}' }],
    check: (inp) => {
      const s = String(inp.text || '');
      if (!s.length) return 'Text: type at least one character';
      if (s.length > 14) return 'Text: at most 14 characters, so the picture stays readable';
      if (!/^[()[\]{}a-z0-9+\-*/]+$/i.test(s)) return 'Text: brackets ( ) [ ] { }, letters, digits and + - * / only, no spaces';
      if (depthOf(s) > 6) return 'Text: at most 6 brackets open at once, so the stack fits';
      return null;
    },
    presets: [
      { label: 'Nested correctly', values: { text: '{a[b(c)d]e}' } },
      { label: 'Crossed over', values: { text: '([)]' } },
      { label: 'Left open', values: { text: '((a)(b)' } },
      { label: 'Closed too soon', values: { text: '(a))(' } },
      { label: 'A formula', values: { text: '2*(a+b)-[c/d]' } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => `char text[] = "${inp.text}";

int main(void)
{
    int ok = balanced(text);
    printf("%s\\n", ok ? "balanced" : "not balanced");
    return 0;
}`,
    capture(P) {
      const s = P.arr('text', 16);
      return { s: S.str(s), stack: P.arr('stack', 16), top: P.val('top'), i: P.has('i', 0) && P.isSet('i', 0) ? P.val('i', 0) : null, c: P.has('c', 0) && P.isSet('c', 0) ? P.val('c', 0) : null, ok: P.has('ok') && P.isSet('ok') ? P.val('ok') : null };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, s = d.s;
      const m = ctx.memo;
      // a JS mirror of the stack holding positions in the string, so each pair can be drawn as an arc
      if (m.at !== ctx.i) {
        m.at = ctx.i;
        m.st = m.st || []; m.pairs = m.pairs || []; m.bad = m.bad || null;
        if (tag === 'push') m.st.push(d.i);
        if (tag === 'pop') m.pairs.push({ a: m.st.pop(), b: d.i });
        if (tag === 'mismatch') m.bad = { a: m.st[m.st.length - 1], b: d.i, kind: 'mismatch' };
        if (tag === 'no-opener') m.bad = { b: m.lastI, kind: 'none' };
        if (tag === 'leftover' && d.top >= 0) m.bad = { kind: 'left' };
        if (d.i !== null) m.lastI = d.i;
      }
      const cur = d.i !== null ? d.i : m.lastI;
      const n = s.length;
      const W = n * (CW + CG) - CG;
      const x0 = -W / 2;
      const matched = new Set(m.pairs.flatMap((p) => [p.a, p.b]));
      const waiting = new Set(m.st);
      const ended = tag === 'leftover' || tag === 'after' || tag === 'mismatch' || tag === 'no-opener';
      const SH = 40, base = 100 + Math.max(1, depthOf(s)) * (SH + 6);
      const items = [S.extent(Math.min(x0, -200) - 20, -115, Math.max(W, 400) + 130, base + 165)];
      items.push(...strip('s', s, x0, 0, (j, ch) => {
        if (m.bad && (m.bad.a === j || m.bad.b === j)) return 'sk-bad';
        if (m.bad && m.bad.kind === 'left' && waiting.has(j)) return 'sk-bad';
        if (j === cur && !ended && tag !== 'enter') return 'sk-read';
        if (matched.has(j)) return 'sk-ok';
        if (waiting.has(j)) return 'sk-live';
        if (!OPEN.includes(ch) && !CLOSE.includes(ch)) return 'sk-plain';
        return '';
      }));
      if (cur !== null && cur < n && !ended) items.push({ key: 'ci', kind: 'cursor', at: 's' + cur, side: 'above', text: 'i = ' + cur, cls: 'c-teal' });
      if (cur !== null && cur >= n) items.push({ key: 'ci', kind: 'cursor', x: x0 + n * (CW + CG) + 6, y: CW / 2, tx: x0 + n * (CW + CG) + 40, ty: -30, text: 'i = ' + cur + ': \\0', cls: 'c-teal' });
      // each matched pair: an arc over the string joining the two brackets
      for (const p of m.pairs) items.push({ key: 'arc' + p.a, kind: 'arrow', from: { x: cx(x0, p.a), y: -4 }, to: { x: cx(x0, p.b), y: -4 }, bend: -(18 + (p.b - p.a) * 9), noHead: true, cls: 'part-a', enter: 'fade' });
      if (m.bad && m.bad.kind === 'mismatch') items.push({ key: 'arcBad', kind: 'arrow', from: { x: cx(x0, m.bad.a), y: -4 }, to: { x: cx(x0, m.bad.b), y: -4 }, bend: -(18 + (m.bad.b - m.bad.a) * 9), noHead: true, cls: 'bad' });
      // the stack, standing under the string
      const sx = -CW;
      items.push({ key: 'stT', kind: 'text', x: sx + CW, y: base + 40, text: 'stack', cls: 'sk-title', anchor: 'middle' });
      items.push({ key: 'stFloor', kind: 'line', x1: sx - 16, y1: base + 12, x2: sx + 2 * CW + 16, y2: base + 12, cls: 'sk-floor' + (tag === 'test-empty' && d.top === -1 || tag === 'no-opener' ? ' bad' : '') });
      m.st.forEach((pos, k) => {
        const y = base - (k + 1) * (SH + 6) + 6;
        const isTop = k === m.st.length - 1;
        items.push({ key: 'st' + pos, kind: 'cell', x: sx, y, w: 2 * CW, h: SH, text: s[pos], sub: '', cls: 'sk-live' + (isTop && m.bad && m.bad.kind === 'mismatch' ? ' sk-bad' : isTop && tag === 'compare' ? ' sk-top' : '') + (m.bad && m.bad.kind === 'left' ? ' sk-bad' : ''), enter: 'fly', from: { x: cx(x0, pos) - CW, y: 0 }, exit: 'fade' });
        items.push({ key: 'stp' + pos, kind: 'text', x: sx + 2 * CW + 10, y: y + SH / 2 + 5, text: 'from [' + pos + ']', cls: 'sk-label' });
      });
      if (!m.st.length) items.push({ key: 'stEmpty', kind: 'text', x: sx + CW, y: base - 14, text: 'empty', cls: 'sk-label', anchor: 'middle' });
      // the question asked at a closing bracket
      const c = d.c !== null ? String.fromCharCode(d.c) : (cur !== null && cur < n ? s[cur] : '');
      const topCh = d.top >= 0 ? String.fromCharCode(d.stack[d.top]) : '';
      if ((tag === 'compare' || tag === 'mismatch' || tag === 'pop') && c) {
        const y = base - Math.max(1, m.st.length + (tag === 'pop' ? 1 : 0)) * (SH + 6) + 6 + SH / 2 + 5;
        const ok = tag === 'pop' || (tag === 'compare' && topCh === match(c));
        items.push({ key: 'cmpT', kind: 'text', x: sx - 30, y, text: (tag === 'pop' ? q(match(c)) + ' meets ' + q(c) : 'top ' + q(topCh) + (ok ? ' = ' : ' ≠ ') + 'opener(' + q(c) + ') = ' + q(match(c))), cls: 'sk-label ' + (ok ? 'good' : 'bad'), anchor: 'end' });
      }
      if (ended && tag !== 'mismatch' && tag !== 'no-opener' || tag === 'after') {
        const good = !m.bad;
        items.push({ key: 'verdict', kind: 'text', x: 0, y: -95, text: good ? 'balanced' : m.bad.kind === 'left' ? 'not balanced: ' + m.st.length + ' left open' : m.bad.kind === 'none' ? 'not balanced: nothing to close' : 'not balanced: wrong kind', cls: 'sk-label ' + (good ? 'good' : 'bad'), anchor: 'middle' });
      }
      let say = '';
      switch (tag) {
        case 'enter': say = 'balanced("' + s + '"): read the text from left to right. Openers go on the stack; each closer must find its partner on top.'; break;
        case 'read': say = cur < n ? 'i = ' + cur + ': s[' + cur + '] is ' + q(s[cur]) + ', not the end of the string.' : 's[' + cur + '] is the terminating \\0: the whole text has been read.'; break;
        case 'char': say = 'c = ' + q(c) + '.'; break;
        case 'test-open': say = OPEN.includes(c) ? q(c) + ' opens something. It cannot be checked yet, so it waits on the stack.' : q(c) + ' is not an opening bracket.'; break;
        case 'push': say = 'Push ' + q(c) + '. The stack now holds ' + m.st.length + ' opener' + (m.st.length === 1 ? '' : 's') + ', the newest on top: it must be the first one closed.'; break;
        case 'test-close': say = CLOSE.includes(c) ? q(c) + ' closes something: it must match the most recent opener still waiting.' : q(c) + ' is not a bracket at all, so it is skipped.'; break;
        case 'test-empty': say = d.top === -1 ? 'The stack is empty: no opener is waiting for this ' + q(c) + '.' : 'The stack is not empty: ' + q(topCh) + ' is on top.'; break;
        case 'no-opener': say = 'balanced() returns 0: ' + q(m.bad ? s[m.bad.b] : c) + ' at position ' + (m.bad ? m.bad.b : cur) + ' closes something that was never opened.'; break;
        case 'compare': say = 'Does the top ' + q(topCh) + ' match ' + q(c) + '? opener(' + q(c) + ') is ' + q(match(c)) + ', so ' + (topCh === match(c) ? 'yes.' : 'no.'); break;
        case 'mismatch': say = 'balanced() returns 0: ' + q(m.bad ? s[m.bad.a] : '') + ' was opened last, but ' + q(m.bad ? s[m.bad.b] : '') + ' tries to close it. The brackets cross over.'; break;
        case 'pop': say = 'They match: pop. The pair at positions ' + m.pairs[m.pairs.length - 1].a + ' and ' + m.pairs[m.pairs.length - 1].b + ' is done, and the arc joins them.'; break;
        case 'leftover': say = d.top === -1 ? 'The text is finished and the stack is empty: every opener was closed. balanced() returns 1.' : 'The text is finished but ' + (d.top + 1) + ' opener' + (d.top ? 's are' : ' is') + ' still on the stack, never closed. balanced() returns 0.'; break;
        case 'after': say = '"' + s + '" is ' + (d.ok ? 'balanced' : 'not balanced') + '. ' + (d.ok ? 'Notice the arcs: they nest inside each other and never cross. That is exactly what the stack enforces.' : 'One stack and one pass over the text were enough to find out.'); break;
      }
      return { items, say, slow: tag === 'mismatch' || tag === 'no-opener' || tag === 'leftover' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'compare', once: true, ask: (t, ts, i) => { const d = ts[i + 1].data; return 'c is ' + q(String.fromCharCode(d.c)) + ' and ' + q(String.fromCharCode(d.stack[d.top])) + ' is on top of the stack. What happens?'; }, options: () => ['They match: pop and go on', 'Wrong kind: return 0'], answer: (ts, i) => { const d = ts[i + 1].data; return String.fromCharCode(d.stack[d.top]) === match(String.fromCharCode(d.c)) ? 'They match: pop and go on' : 'Wrong kind: return 0'; }, pick: 'option' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'leftover', once: true, ask: 'The whole text has been read. Will balanced() return 1?', options: () => ['Yes', 'No'], answer: (ts, i) => (ts[i + 1].data.top === -1 ? 'Yes' : 'No'), pick: 'option', explain: (ts, i) => (ts[i + 1].data.top === -1 ? 'The stack is empty: nothing was left open.' : 'Openers are still on the stack: they were never closed.') },
    ],
    quiz: [
      { q: 'Why is a stack the right tool for matching brackets?', options: ['It sorts them', 'The most recently opened bracket must be the first one closed', 'It counts them', 'It is the fastest structure'], answer: 1, why: 'Last opened, first closed: that is last in, first out.' },
      { q: 'Would counting each kind (as many ( as ), and so on) be enough?', options: ['Yes', 'No: "([)]" has equal counts but is not balanced', 'Only for round brackets', 'Only for short strings'], answer: 1, why: 'Counts ignore order. The stack checks that each closer meets the latest opener.' },
      { q: 'What does it mean if the stack is not empty when the text ends?', options: ['The text is balanced', 'Some openers were never closed', 'There was a wrong kind', 'Nothing'], answer: 1, why: 'Each opener still on the stack is still waiting for its partner.' },
      { q: 'For "(a))(", where does the check fail?', options: ['At the first (', 'At the second ), with the stack empty', 'At the end', 'It passes'], answer: 1, why: 'The first ) closes the (. The second ) finds nothing on the stack.' },
      { q: 'How much work is the check for a text of n characters?', options: ['O(n²)', 'O(n): each character is pushed and popped at most once', 'O(log n)', 'O(n log n)'], answer: 1, why: 'One pass, with constant work per character.' },
    ],
  });

  // ---- infix to postfix (shunting-yard) ----------------------------------------------------------------------
  const PREC = { '*': 2, '/': 2, '+': 1, '-': 1, '(': 0 };
  /** Is s a well-formed infix expression with one-character operands? Returns an error or null */
  const infixError = (s) => {
    if (!s.length) return 'Expression: type one, like a+b*c';
    if (s.length > 13) return 'Expression: at most 13 characters, so the picture stays readable';
    if (!/^[a-z0-9+\-*/()]+$/i.test(s)) return 'Expression: one-letter or one-digit operands, + - * / and brackets only, no spaces';
    let want = 'operand', depth = 0, stackMax = 0;
    const st = [];
    for (const c of s) {
      if (/[a-z0-9]/i.test(c)) { if (want !== 'operand') return 'Expression: two operands in a row near "' + c + '"'; want = 'op'; }
      else if (c === '(') { if (want !== 'operand') return 'Expression: an operator is missing before "("'; depth++; st.push(c); }
      else if (c === ')') { if (want !== 'op') return 'Expression: something is missing before ")"'; if (!depth) return 'Expression: a ")" with no "("'; depth--; while (st[st.length - 1] !== '(') st.pop(); st.pop(); }
      else { if (want !== 'op') return 'Expression: an operand is missing before "' + c + '"'; want = 'operand'; while (st.length && PREC[st[st.length - 1]] >= PREC[c]) st.pop(); st.push(c); }
      stackMax = Math.max(stackMax, st.length);
    }
    if (want !== 'op') return 'Expression: it must end with an operand or ")"';
    if (depth) return 'Expression: a "(" is never closed';
    if (stackMax > 5) return 'Expression: at most 5 operators waiting at once, so the stack fits';
    return null;
  };
  /** The most operators (and brackets) waiting at once */
  const opDepth = (s) => { let mx = 0; const st = []; for (const c of s) { if (c === '(') st.push(c); else if (c === ')') { while (st.length && st[st.length - 1] !== '(') st.pop(); st.pop(); } else if (!/[a-z0-9]/i.test(c)) { while (st.length && PREC[st[st.length - 1]] >= PREC[c]) st.pop(); st.push(c); } mx = Math.max(mx, st.length); } return mx; };
  /** The postfix form, worked out in JS (for the prediction) */
  const postfixOf = (s) => {
    let out = '';
    const st = [];
    for (const c of s) {
      if (/[a-z0-9]/i.test(c)) out += c;
      else if (c === '(') st.push(c);
      else if (c === ')') { while (st[st.length - 1] !== '(') out += st.pop(); st.pop(); }
      else { while (st.length && PREC[st[st.length - 1]] >= PREC[c]) out += st.pop(); st.push(c); }
    }
    while (st.length) out += st.pop();
    return out;
  };

  X.topic({
    id: 'app-infix-postfix', family: 'sqapps', order: 20, title: 'Infix to postfix',
    blurb: 'Operands go straight to the output. Operators wait on a stack, and an incoming operator first sends out every waiting one that binds at least as tightly. Brackets fence off a part of the stack.',
    headC: () => `#include <stdio.h>
#include <ctype.h>

#define MAX 16

char ops[MAX];      /* operators waiting to be written */
int top = -1;

/* how tightly an operator binds; '(' is lowest, so nothing pops it */
int prec(char op)
{
    if (op == '*' || op == '/')
        return 2;
    if (op == '+' || op == '-')
        return 1;
    return 0;
}`,
    code: `/* write the postfix form of the infix expression in into out */
void to_postfix(const char *in, char *out)
{
    int i, k = 0;                                          /*@ init */
    char c;
    for (i = 0; in[i] != '\\0'; i++) {                     /*@ read */
        c = in[i];                                         /*@ char */
        if (isalnum(c))                                    /*@ test-operand */
            out[k++] = c;                                  /*@ emit */
        else if (c == '(')                                 /*@ test-open */
            ops[++top] = c;                                /*@ push-open */
        else if (c == ')') {                               /*@ test-close */
            while (ops[top] != '(')                        /*@ unwind-test */
                out[k++] = ops[top--];                     /*@ unwind */
            top--;                                         /*@ drop-open */
        } else {
            while (top >= 0 && prec(ops[top]) >= prec(c))  /*@ cmp-prec */
                out[k++] = ops[top--];                     /*@ pop-op */
            ops[++top] = c;                                /*@ push-op */
        }
    }
    while (top >= 0)                                       /*@ flush-test */
        out[k++] = ops[top--];                             /*@ flush */
    out[k] = '\\0';                                         /*@ end */
}`,
    animate: ['to_postfix'], quiet: ['prec'],
    inputs: [{ id: 'expr', kind: 'text', label: 'Infix expression', def: 'a+b*(c-d)/e' }],
    check: (inp) => infixError(String(inp.expr || '')),
    presets: [
      { label: 'Precedence and brackets', values: { expr: 'a+b*(c-d)/e' } },
      { label: 'Left to right', values: { expr: 'a-b+c' } },
      { label: 'Times before plus', values: { expr: 'a+b*c' } },
      { label: 'Brackets first', values: { expr: '(a+b)*c' } },
      { label: 'Digits', values: { expr: '9-4/2*3+1' } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => `char infix[] = "${inp.expr}";
char postfix[MAX + 1];

int main(void)
{
    to_postfix(infix, postfix);
    printf("%s\\n", postfix);
    return 0;
}`,
    capture(P) {
      const loc = (n) => (P.has(n, 0) && P.isSet(n, 0) ? P.val(n, 0) : null);
      return { s: S.str(P.arr('infix', 16)), out: S.str(P.arr('postfix', 17)), ops: P.arr('ops', 16), top: P.val('top'), i: loc('i'), k: loc('k'), c: loc('c') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, s = d.s;
      const m = ctx.memo;
      if (d.i !== null) m.lastI = d.i;
      const cur = d.i !== null ? d.i : m.lastI;
      // where each operator on the stack came from, so it can fly out of the right slot
      if (m.at !== ctx.i) {
        m.at = ctx.i;
        m.st = m.st || []; m.src = m.src || [];
        if (tag === 'push-open' || tag === 'push-op') m.st.push(cur);
        if (tag === 'unwind' || tag === 'pop-op' || tag === 'flush') m.src.push({ from: 'stack', pos: m.st.pop(), slot: m.st.length });
        if (tag === 'emit') m.src.push({ from: 'in', pos: cur });
        if (tag === 'drop-open') m.st.pop();
      }
      const n = s.length;
      const W = n * (CW + CG) - CG;
      const x0 = -W / 2;
      const SH = 40, base = 100 + Math.max(1, opDepth(s)) * (SH + 6);
      const outY = base + 60;
      const items = [S.extent(-Math.max(W, 520) / 2 - 40, -60, Math.max(W, 520) + 80, outY + 120)];
      const ended = tag === 'flush-test' || tag === 'flush' || tag === 'end' || tag === 'after';
      items.push({ key: 'inT', kind: 'text', x: x0 - 14, y: CW / 2 + 5, text: 'in', cls: 'sk-title', anchor: 'end' });
      items.push(...strip('s', s, x0, 0, (j) => (j === cur && !ended && tag !== 'enter' && tag !== 'init' ? 'sk-read' : (cur !== null && j < cur) || ended ? 'sk-plain' : '')));
      if (cur !== null && cur < n && !ended) items.push({ key: 'ci', kind: 'cursor', at: 's' + cur, side: 'above', text: 'i', cls: 'c-teal' });
      // the operator stack
      const sx = -CW;
      items.push({ key: 'stT', kind: 'text', x: sx - 20, y: base - 10, text: 'ops', cls: 'sk-title', anchor: 'end' });
      items.push({ key: 'stFloor', kind: 'line', x1: sx - 14, y1: base + 10, x2: sx + 2 * CW + 14, y2: base + 10, cls: 'sk-floor' });
      const slotY = (k) => base - (k + 1) * (SH + 6) + 4;
      m.st.forEach((pos, k) => {
        const isTop = k === m.st.length - 1;
        items.push({ key: 'op' + pos, kind: 'cell', x: sx, y: slotY(k), w: 2 * CW, h: SH, text: s[pos], sub: '', cls: (s[pos] === '(' ? 'sk-plain' : 'sk-op') + (isTop && tag === 'cmp-prec' ? ' sk-top' : ''), enter: 'fly', from: { x: cx(x0, pos) - CW, y: 0 } });
      });
      // the precedence question, written out beside the stack
      const c = d.c !== null ? String.fromCharCode(d.c) : '';
      const topCh = d.top >= 0 ? String.fromCharCode(d.ops[d.top]) : '';
      if (tag === 'cmp-prec' && c) {
        const y = d.top >= 0 ? slotY(d.top) + SH / 2 + 5 : base - 14;
        const pops = d.top >= 0 && PREC[topCh] >= PREC[c];
        items.push({ key: 'inc', kind: 'token', x: sx + 2 * CW + 40, y: y - 5, r: 18, text: c, cls: 'c-violet sk-big' });
        items.push({ key: 'cmpT', kind: 'text', x: sx + 2 * CW + 68, y, text: d.top < 0 ? 'stack empty: push' : 'prec(' + topCh + ') = ' + PREC[topCh] + (pops ? ' ≥ ' : ' < ') + 'prec(' + c + ') = ' + PREC[c] + (pops ? ': pop ' + topCh : ': push ' + c), cls: 'sk-label ' + (pops ? 'hot' : 'good') });
      }
      if (tag === 'unwind-test' && topCh) items.push({ key: 'cmpT', kind: 'text', x: sx + 2 * CW + 24, y: slotY(d.top) + SH / 2 + 5, text: topCh === '(' ? 'reached the ( : stop' : topCh + ' is inside the brackets: out it goes', cls: 'sk-label hot' });
      items.push({ key: 'lgd', kind: 'text', x: sx + 2 * CW + 24, y: base + 4, text: 'prec:  * / = 2   + - = 1   ( = 0', cls: 'sk-label' });
      // the output, growing left to right
      const out = d.out;
      const ox = -Math.max(n, 1) * (CW + CG) / 2;
      items.push({ key: 'outT', kind: 'text', x: ox - 14, y: outY + CW / 2 + 5, text: 'out', cls: 'sk-title', anchor: 'end' });
      out.split('').forEach((ch, j) => {
        const src = m.src[j];
        const from = !src ? null : src.from === 'in' ? { x: cx(x0, src.pos) - CW / 2, y: 0 } : { x: sx + CW / 2, y: slotY(src.slot) };
        items.push({ key: 'o' + j, kind: 'cell', x: ox + j * (CW + CG), y: outY, w: CW, h: CW, text: ch, sub: j, cls: /[a-z0-9]/i.test(ch) ? 'sk-live' : 'sk-op', enter: from ? 'fly' : 'fade', from, flash: j === out.length - 1 && /emit|unwind|pop-op|flush/.test(tag) });
      });
      const k = d.k !== null ? d.k : out.length;
      const name = (ch) => (/[a-z0-9]/i.test(ch) ? 'operand' : 'operator');
      let say = '';
      switch (tag) {
        case 'enter': say = 'to_postfix("' + s + '"): in postfix every operator comes after its two operands, so no brackets or precedence rules are needed to read it.'; break;
        case 'init': say = 'k counts the characters written to out so far: none yet.'; break;
        case 'read': say = cur < n ? 'i = ' + cur + ': next comes ' + q(s[cur]) + '.' : 'The end of the input: \\0.'; break;
        case 'char': say = 'c = ' + q(c) + ', ' + (c === '(' || c === ')' ? 'a bracket' : 'an ' + name(c)) + '.'; break;
        case 'test-operand': say = /[a-z0-9]/i.test(c) ? q(c) + ' is an operand.' : q(c) + ' is not an operand.'; break;
        case 'emit': say = 'Operands go straight to the output: out[' + (k - 1) + '] = ' + q(c) + '. Their order never changes.'; break;
        case 'test-open': say = c === '(' ? 'An opening bracket.' : q(c) + ' is not "(".'; break;
        case 'push-open': say = '"(" goes on the stack as a fence: operators pushed after it stay above it until the matching ")" comes.'; break;
        case 'test-close': say = c === ')' ? 'A closing bracket: everything above the "(" belongs inside the brackets, so it all comes out now.' : q(c) + ' is an operator.'; break;
        case 'unwind-test': say = topCh === '(' ? 'The top is "(": the part in brackets is finished.' : 'The top is ' + q(topCh) + ', still inside the brackets.'; break;
        case 'unwind': say = 'Pop ' + q(out[out.length - 1]) + ' to the output.'; break;
        case 'drop-open': say = 'Pop the "(" and throw it away: brackets never appear in postfix.'; break;
        case 'cmp-prec': {
          if (d.top < 0) say = 'The stack is empty, so ' + q(c) + ' has nothing to wait behind.';
          else if (topCh === '(') say = 'The top is "(", with precedence 0: it fences the stack, so ' + q(c) + ' stops here.';
          else if (PREC[topCh] >= PREC[c]) say = 'Compare: ' + q(topCh) + ' on the stack binds ' + (PREC[topCh] > PREC[c] ? 'more tightly than' : 'as tightly as') + ' ' + q(c) + ' (' + PREC[topCh] + ' ≥ ' + PREC[c] + '), so it must be done first: it goes out.' + (PREC[topCh] === PREC[c] ? ' Equal precedence goes left to right.' : '');
          else say = 'Compare: ' + q(topCh) + ' binds less tightly than ' + q(c) + ' (' + PREC[topCh] + ' < ' + PREC[c] + '), so it keeps waiting and ' + q(c) + ' goes on top of it.';
          break;
        }
        case 'pop-op': say = 'Pop ' + q(out[out.length - 1]) + ' to the output.'; break;
        case 'push-op': say = 'Push ' + q(c) + '. It waits until something binding no more tightly arrives, or the input ends.'; break;
        case 'flush-test': say = d.top >= 0 ? 'The input is finished. ' + (d.top + 1) + ' operator' + (d.top ? 's are' : ' is') + ' still waiting: they all come out, top first.' : 'The stack is empty.'; break;
        case 'flush': say = 'Pop ' + q(out[out.length - 1]) + ' to the output.'; break;
        case 'end': say = 'out[' + k + '] = \\0 ends the string: "' + out + '".'; break;
        case 'after': say = '"' + s + '" in postfix is "' + out + '". Read it left to right with a stack of values: each operator takes the two values before it.'; break;
      }
      return { items, say, slow: tag === 'cmp-prec' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'cmp-prec' && ts[i + 1].data.top >= 0 && ts[i + 1].data.ops[ts[i + 1].data.top] !== 40, once: true, ask: (t, ts, i) => { const d = ts[i + 1].data; return q(String.fromCharCode(d.c)) + ' arrives and ' + q(String.fromCharCode(d.ops[d.top])) + ' is on top of the stack. What happens to ' + q(String.fromCharCode(d.ops[d.top])) + '?'; }, options: () => ['It goes to the output', 'It stays on the stack'], answer: (ts, i) => { const d = ts[i + 1].data; return PREC[String.fromCharCode(d.ops[d.top])] >= PREC[String.fromCharCode(d.c)] ? 'It goes to the output' : 'It stays on the stack'; }, pick: 'option', explain: () => 'An operator on the stack goes out if it binds at least as tightly as the newcomer.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'flush-test' && ts[i].tag === 'read', once: true, ask: 'The input is finished. What will the whole postfix be?', options: (ts) => { const s = ts[0].data.s, right = postfixOf(s); const opsOnly = s.replace(/[a-z0-9()]/gi, ''), vals = s.replace(/[^a-z0-9]/gi, ''); const o = [right, vals + opsOnly, vals + opsOnly.split('').reverse().join('')]; return [...new Set(o)].sort(); }, answer: (ts) => postfixOf(ts[0].data.s), pick: 'option' },
    ],
    quiz: [
      { q: 'What is a+b*c in postfix?', options: ['ab+c*', 'abc*+', 'abc+*', '+a*bc'], answer: 1, why: '* binds more tightly, so b*c is worked out first: b c *, then a plus that.' },
      { q: 'What is (a+b)*c in postfix?', options: ['abc*+', 'ab+c*', 'abc+*', 'a+bc*'], answer: 1, why: 'The brackets make a+b come first: a b +, then times c.' },
      { q: 'Why does an operator of equal precedence pop the one on the stack?', options: ['To save space', 'So that a-b+c is worked out left to right as (a-b)+c', 'It does not', 'Because - is special'], answer: 1, why: 'Popping on ≥ gives left-to-right order for operators of the same level.' },
      { q: 'Do operands ever wait on the stack?', options: ['Yes, all of them', 'No: they go straight to the output in their original order', 'Only digits', 'Only inside brackets'], answer: 1, why: 'Only operators and "(" are held back; the operands keep their order.' },
      { q: 'Why does "(" have the lowest precedence in prec()?', options: ['It is never used', 'So no operator can pop it; only ")" removes it', 'Because it comes first', 'To make it go out first'], answer: 1, why: 'With precedence 0, the test prec(top) >= prec(c) always fails at a "(", which fences off what is below it.' },
    ],
    compareWith: 'app-postfix-eval',
  });
})(SEE);
