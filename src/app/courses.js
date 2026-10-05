// Guided courses: topics in a sensible order, each with a word on what to watch for. A course step opens
// the topic with a bar above it that leads on to the next one.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const { h, icon } = SEE.UI;

  const COURSES = [
    { id: 'arrays', title: 'Arrays, cell by cell', blurb: 'The simplest structure, and the cost hidden in it: every insertion and deletion in the middle moves everything after it.', steps: [
      ['arr-traverse', 'One index walks the array. Notice that reaching a[i] costs the same for every i.'],
      ['arr-insert', 'Count the shifts. Inserting near the front moves almost everything.'],
      ['arr-delete', 'The same shifting, the other way. The last cell is left holding a stale copy.'],
      ['arr-reverse', 'Two ends meet in the middle: n/2 swaps.'],
      ['arr-rotate', 'Three reversals do a rotation with no extra array. Watch each bracket.'],
      ['arr-merge', 'Two sorted inputs, two read cursors, one write cursor.'],
      ['dyn-push', 'When the array is full it moves house. Count the copies over many pushes.'],
      ['mat-rowmajor', 'A grid is really one long row. See where a[i][j] lives.'],
      ['two-sum-sorted', 'Two pointers close in from both ends; each step rules out a whole row of pairs.'],
      ['window-max-sum', 'A sliding window adds one element and drops one, instead of starting again.'],
    ] },
    { id: 'lists', title: 'Linked lists from scratch', blurb: 'Nodes on the heap and the arrows between them. The order of two assignments decides whether the rest of the list survives.', steps: [
      ['sll-traverse', 'A cursor follows next pointers until it reaches NULL.'],
      ['sll-search', 'No jumping to the middle: a list is searched one node at a time.'],
      ['sll-insert-front', 'Two pointer writes. Try to predict which must come first.'],
      ['sll-insert-end', 'Without a tail pointer, adding at the end means walking the whole list.'],
      ['sll-insert-pos', 'Stop one node early: you need the node before the gap.'],
      ['sll-delete-front', 'Save the old head before you move on, or you cannot free it.'],
      ['sll-delete-key', 'A trailing pointer keeps hold of the node before the one to delete.'],
      ['sll-reverse', 'Three pointers turn every arrow round. The saved next is what keeps the rest reachable.'],
      ['sll-reverse-rec', 'The same job done by recursion: the arrows turn on the way back up.'],
      ['dll-insert-pos', 'Two links per node means four pointer writes per insertion.'],
      ['dll-delete', 'A node can unlink itself: it knows both neighbours.'],
      ['csll-traverse', 'In a ring there is no NULL to stop at. A do-while loop stops back at the start.'],
      ['sentinel-delete', 'A dummy node removes every special case at the front.'],
    ] },
    { id: 'pointer-tricks', title: 'Pointer puzzles', blurb: 'The classic interview questions on lists, each solved by two pointers moving at different speeds or with a gap between them.', steps: [
      ['sll-middle', 'The fast pointer moves two steps for each one of the slow pointer. Where is slow when fast stops?'],
      ['sll-kth-end', 'A fixed gap between two pointers finds the k-th node from the end in one pass.'],
      ['sll-floyd-detect', 'If there is a loop, the hare laps the tortoise.'],
      ['sll-floyd-remove', 'After they meet, one restarts from the head; they meet again at the loop\'s first node.'],
      ['sll-merge-sorted', 'A dummy head makes the merge loop uniform.'],
      ['sll-intersection', 'Two lists that share a tail: line up their lengths first.'],
      ['sll-palindrome', 'Reverse the second half, compare, then put it back.'],
    ] },
    { id: 'stacks-queues', title: 'Stacks and queues', blurb: 'Last in first out, first in first out, and what each is good for.', steps: [
      ['stack-array', 'One index, top, does all the work. Watch for overflow and underflow.'],
      ['stack-linked', 'The same stack on a list: push and pop at the head.'],
      ['queue-array-naive', 'A queue that only moves forward wastes the space it leaves behind.'],
      ['circular-queue', 'Wrapping round with % reuses that space.'],
      ['queue-linked', 'Front and rear pointers; the last dequeue must reset rear too.'],
      ['deque-array', 'Both ends open: four operations, all O(1).'],
      ['app-brackets', 'A stack remembers which bracket must close next.'],
      ['app-infix-postfix', 'Operators wait on a stack until something weaker arrives.'],
      ['app-postfix-eval', 'Each operator pops two values and pushes one.'],
      ['app-recursion', 'Every call is a frame pushed on the machine\'s own stack.'],
    ] },
    { id: 'searching', title: 'Searching', blurb: 'From checking everything to halving the problem at every step.', steps: [
      ['linear-search', 'One comparison per element, in the worst case n of them.'],
      ['binary-search', 'Each comparison throws away half. Count the steps against log2 n.'],
      ['binary-first', 'A match is not the end when you want the first one.'],
      ['binary-rotated', 'One half is always sorted. Find out which, then decide.'],
      ['interpolation-search', 'Guess the position from the value, as you would in a phone book.'],
      ['jump-search', 'Big jumps, then a short walk back.'],
      ['exponential-search', 'Double the bound until you pass the key, then search inside.'],
    ] },
    { id: 'sorting', title: 'Sorting, from simple to clever', blurb: 'Eleven ways to put numbers in order, and why some are so much faster than others.', steps: [
      ['bubble-sort', 'Neighbours swap; the biggest bubbles to the end each pass.'],
      ['selection-sort', 'One long scan for the smallest, then a single swap.'],
      ['insertion-sort', 'Like sorting cards in your hand. Very fast on nearly sorted input.'],
      ['shell-sort', 'Insertion sort on elements far apart first, then closer.'],
      ['merge-sort', 'Split in halves until trivial, then merge back in order.'],
      ['quick-sort', 'One pivot lands in its final place; then the same on each side.'],
      ['quick-hoare', 'Two pointers from both ends: fewer swaps than Lomuto.'],
      ['quick-3way', 'Many equal keys? Three zones instead of two.'],
      ['heap-sort', 'A heap inside the array hands out the largest each time.'],
      ['counting-sort', 'No comparisons at all: count, add up, place.'],
      ['radix-sort', 'One digit at a time, and each pass must be stable.'],
      ['bucket-sort', 'Spread into buckets by range, sort each, join them.'],
    ] },
    { id: 'hashing', title: 'Hashing', blurb: 'Turn a key into an index and go straight there. Then deal with collisions.', steps: [
      ['chain-insert', 'The hash picks the bucket; the new entry goes at the front of its chain.'],
      ['chain-search', 'Only one chain is searched, however big the table.'],
      ['chain-delete', 'Unlinking from a singly linked chain needs the previous entry.'],
      ['chain-rehash', 'When chains get long, a bigger table spreads them out again.'],
      ['oa-linear-insert', 'No lists: a collision moves on to the next free slot. Watch clusters form.'],
      ['oa-linear-search', 'Probe until you find it or reach an empty slot.'],
      ['oa-quadratic', 'Bigger and bigger jumps break up the clusters.'],
      ['oa-double', 'A second hash decides the step size.'],
      ['oa-delete', 'A deleted slot must not look empty, or later searches stop too early.'],
    ] },
    { id: 'trees', title: 'Binary trees', blurb: 'Walking a tree in every order, measuring it, and building it back from its walks.', steps: [
      ['bt-preorder', 'Visit, then left, then right. Watch where each node is printed.'],
      ['bt-inorder', 'Left, visit, right.'],
      ['bt-postorder', 'Children first: a node is printed only after both subtrees.'],
      ['bt-levelorder', 'A queue gives the tree level by level.'],
      ['bt-inorder-iter', 'The recursion\'s stack made explicit.'],
      ['bt-morris', 'In-order with no stack at all, using temporary threads.'],
      ['bt-height', 'Heights flow upwards: one more than the taller child.'],
      ['bt-diameter', 'The longest path may not go through the root.'],
      ['bt-lca', 'The first node where the two keys part ways.'],
      ['bt-array', 'A complete tree fits in an array with no pointers at all.'],
      ['bt-build-pre-in', 'Preorder says who the root is; inorder says what is on each side.'],
    ] },
    { id: 'bst', title: 'Binary search trees', blurb: 'Smaller to the left, bigger to the right, and every operation follows one path down.', steps: [
      ['bst-search', 'Each comparison picks one side and ignores the other.'],
      ['bst-insert', 'A new key always ends up as a leaf.'],
      ['bst-insert-rec', 'The recursive version re-assigns every link on the way back.'],
      ['bst-min-max', 'All the way left, or all the way right.'],
      ['bst-successor', 'Two cases: down into the right subtree, or up to an ancestor.'],
      ['bst-delete', 'Three cases. The two-children case borrows the successor\'s key.'],
      ['bst-range', 'Whole subtrees outside the range are never visited.'],
      ['bst-validate', 'Checking each node against its children is not enough.'],
      ['bst-from-sorted', 'The middle element becomes the root: a balanced tree.'],
    ] },
    { id: 'balanced', title: 'Keeping trees balanced', blurb: 'Rotations: three pointer changes that fix a lopsided tree without breaking the order.', steps: [
      ['avl-rotate', 'Four cases, two kinds of rotation.'],
      ['avl-insert', 'Heights update on the way up; the first node out of balance is rotated.'],
      ['avl-delete', 'Deletion may need rotations at several levels.'],
      ['rb-rotate', 'The same rotation, now with parent pointers to repair.'],
      ['rb-insert', 'Insert red; fix red-red with recolouring or rotation.'],
      ['rb-delete', 'The hardest one: a missing black is pushed up or absorbed.'],
      ['btree-insert', 'Many keys per node. A full node splits and its middle key rises.'],
      ['btree-delete', 'Borrow from a sibling, or merge with one.'],
      ['bplus-range', 'All keys in leaves, and the leaves are linked for range scans.'],
      ['splay-access', 'Whatever you touch is brought to the root.'],
      ['treap-insert', 'A BST by key and a heap by random priority.'],
    ] },
    { id: 'heaps-tries', title: 'Heaps and tries', blurb: 'A tree packed into an array that always knows its largest element, and a tree of letters.', steps: [
      ['heap-insert', 'Add at the end, then sift up.'],
      ['heap-extract', 'The last element jumps to the root, then sifts down.'],
      ['heap-build', 'Building from the bottom is faster than n inserts.'],
      ['pq-change', 'Changing a priority moves the item up or down.'],
      ['trie-insert', 'One node per letter, shared by every word with the same start.'],
      ['trie-search', 'Reaching the last letter is not enough: it must be marked as a word.'],
      ['trie-prefix', 'Every word below a node starts with the same prefix.'],
      ['trie-delete', 'Nodes are freed from the bottom up while nothing else needs them.'],
    ] },
    { id: 'graphs', title: 'Graphs', blurb: 'Storing a graph, exploring it, and the classic algorithms on top.', steps: [
      ['graph-matrix', 'One cell per pair of vertices.'],
      ['graph-list', 'One list per vertex: only the edges that exist.'],
      ['bfs', 'A queue explores in rings around the start.'],
      ['dfs', 'Go as deep as possible, then back up.'],
      ['components', 'Each fresh search finds one connected piece.'],
      ['cycle-directed', 'A back edge to a vertex still in progress means a cycle.'],
      ['topo-kahn', 'Take what has no prerequisites left, again and again.'],
      ['dijkstra', 'Always settle the closest unsettled vertex, then relax its edges.'],
      ['bellman-ford', 'Relax every edge, n-1 times. Negative weights are fine.'],
      ['floyd-warshall', 'All pairs at once: may going through k make i to j shorter?'],
      ['union-find', 'Sets that merge, with ranks and path compression.'],
      ['kruskal', 'Cheapest edges first, skipping any that would close a cycle.'],
      ['prim', 'Grow one tree, always across the cheapest edge.'],
      ['scc', 'Two passes of DFS find strongly connected groups.'],
    ] },
    { id: 'recursion', title: 'Recursion everywhere', blurb: 'The same idea in lists, arrays, trees and graphs: solve a smaller copy and combine. Keep the Calls tab open.', steps: [
      ['app-recursion', 'Frames pushed and popped: the call stack itself.'],
      ['sll-reverse-rec', 'Down to the last node, then every arrow turns on the way back.'],
      ['merge-sort', 'Two calls per level, and the merge does the real work.'],
      ['quick-sort', 'The partition does the work first, then two calls.'],
      ['bt-height', 'A value returned from each subtree.'],
      ['bst-insert-rec', 'Each call returns the root of its subtree.'],
      ['dfs', 'The recursion stack is the path from the start.'],
    ] },
  ];

  const stepsOf = (c) => c.steps.filter(([id]) => X.byId(id));

  X.Courses = {
    list: COURSES,
    render(app, main) {
      document.title = 'Courses · Strux';
      app.renderSide();
      const box = h('div.home');
      box.append(h('h1', 'Courses'), h('p.lead', 'Topics in an order that builds up, with a word on what to look for in each. Your progress is kept in this browser.'));
      const grid = h('div.fam-grid');
      for (const c of COURSES) {
        const st = stepsOf(c);
        if (!st.length) continue;
        const done = st.filter(([id]) => app.done.has(id)).length;
        const card = h('button.fam-card.course-card', { type: 'button', dataset: { course: c.id } }, h('h3', c.title), h('p', c.blurb), h('span.n', done + ' of ' + st.length + ' done'), h('div.course-bar', h('i', { style: { width: (100 * done / st.length) + '%' } })));
        card.addEventListener('click', () => { location.hash = 'course=' + c.id; });
        grid.appendChild(card);
      }
      box.appendChild(grid);
      main.appendChild(box);
    },
    open(app, main, arg) {
      const [cid, ks] = arg.split('/');
      const c = COURSES.find((x) => x.id === cid);
      if (!c) { this.render(app, main); return; }
      const st = stepsOf(c);
      if (ks === undefined) {
        document.title = c.title + ' · Strux';
        app.renderSide();
        const box = h('div.home');
        const next = st.findIndex(([id]) => !app.done.has(id));
        const start = h('button.btn.primary', { type: 'button', id: 'courseStart' }, icon('run'), next <= 0 ? 'Start' : next < 0 ? 'Start again' : 'Continue');
        start.addEventListener('click', () => { location.hash = 'course=' + c.id + '/' + Math.max(0, next); });
        box.append(h('div.crumbs', h('a', { href: '#courses' }, 'Courses')), h('h1', c.title), h('p.lead', c.blurb), start);
        const ol = h('ol.course-steps');
        st.forEach(([id, note], k) => {
          const t = X.byId(id);
          const li = h('li' + (app.done.has(id) ? '.done' : ''), h('a', { href: '#course=' + c.id + '/' + k }, t.title), app.done.has(id) ? h('span.done', ' ✓') : null, h('p', note));
          ol.appendChild(li);
        });
        box.appendChild(ol);
        main.appendChild(box);
        return;
      }
      const k = Math.max(0, Math.min(st.length - 1, +ks || 0));
      const [id, note] = st[k];
      app.openTopic(X.byId(id));
      const prev = h('button.btn', { type: 'button', id: 'coursePrev', disabled: k === 0 }, '‹ Back');
      prev.addEventListener('click', () => { location.hash = 'course=' + c.id + '/' + (k - 1); });
      const next = h('button.btn.primary', { type: 'button', id: 'courseNext' }, k === st.length - 1 ? 'Finish' : 'Next ›');
      next.addEventListener('click', () => { location.hash = k === st.length - 1 ? 'course=' + c.id : 'course=' + c.id + '/' + (k + 1); });
      const bar = h('div.course-strip', { id: 'courseStrip' }, h('div', h('a', { href: '#course=' + c.id }, c.title), h('span.muted', ' · step ' + (k + 1) + ' of ' + st.length), h('p', note)), h('div.course-nav', prev, next));
      main.insertBefore(bar, main.firstChild);
    },
  };
})(SEE);
