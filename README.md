# Strux

Strux shows data structures and algorithms at work. Pick a topic, say deleting a node from
a binary search tree, choose the keys, and press play. A real C89 function runs one line at
a time, and every line is drawn: the cursor that walks down the tree, the successor that is
found, the key that is copied up, the pointer that swings round, the block that is freed.
Under the picture a sentence says what that line just did, with the actual numbers.

I have taught data structures for many years, and students rarely struggle with the idea of
a linked list or a heap. They struggle with the moment: which pointer changes first, what
is lost if the order is wrong, why a deleted slot in a hash table must not look empty. A
whiteboard shows the before and the after. Strux shows every step in between, as often as
you like, forwards and backwards.

Live at https://strux.jyotiprakash.org

![Quick sort on eight numbers: the pivot in red, the two zones that grow behind it, and the swap of two bars drawn as an arc](docs/images/quick-sort.png)

## What it is

Strux is one HTML file. There is nothing to install and nothing is sent anywhere. It runs
on the C89 compiler and the simulated 32-bit machine of [See](https://see.jyotiprakash.org),
so the code you read is the code that runs, and the picture is drawn from that program's
memory after every line: the nodes really are blocks from `malloc`, the arrows really are
the addresses in their `next` fields.

It is read-only on purpose. Students do not write code here; they choose the data and watch.
Every topic has a button that opens its program in See, where they can change it and run it
themselves.

There are 175 topics in ten groups. Each one has its own picture, made for that operation
and no other: bubble sort swaps
neighbours in little arcs, selection sort makes one long jump per pass, insertion sort lifts
a card out of the row and drops it into the gap. A search in a chained hash table sends a
token running along the chain; a tombstone in open addressing is passed with "DELETED: keep
going". Floyd's cycle detection draws the list as the Greek letter rho, so you can see the
hare lapping the tortoise.

![The home page: every group with a card for each family of topics](docs/images/home.png)

## Watching a topic

The stage is in the middle. Play runs the steps at the speed you set; the arrow keys go one
step forward or back; the timeline jumps anywhere. Under the stage the narration explains the
step: "Compare 45 with 30: it is bigger, so it belongs somewhere in the right subtree.
Everything on the other side can be ignored." On the right is the C code with the running
line lit, and under it the counters: comparisons, swaps, moves, pointer steps, mallocs and
frees, so two runs can be compared by the work they did.

Above the stage you choose the data: the numbers to sort, the keys already in the tree, the
edges of a graph. Each topic has presets for the cases that matter: an empty list, one node,
input already sorted, a key that is not there, everything in one bucket. Bad input is turned
away with a plain message, and inputs are kept small so the picture stays readable on a
projector.

![Reversing a singly linked list: prev, curr and next under their nodes, two arrows already turned round](docs/images/sll-reverse.png)

![Deleting a key from a singly linked list: the bypass arrow has swung over, and the node hangs below before free](docs/images/sll-delete-key.png)

Click any line of the code to jump to the next time it runs. The bigger stage button gives
the picture more room, and the zoom buttons, a pinch, or Ctrl with the mouse wheel enlarge
it, with a drag to look around.

## Memory and calls

The **Memory** tab draws memory the way See does: the stack frames of every function on the
stack, newest first, with all their variables, and the heap blocks, live and freed, each
with its type and contents. A pointer shows which block it points to; hover it and the block
lights up. Whatever changed in the last step is lit for a moment.

![The memory tab beside the reversal: the frames of reverse and main, and four heap blocks holding the nodes](docs/images/memory.png)

The **Calls** tab shows the call stack, and for recursive code it draws the tree of every
call made so far, with the current path lit and what each finished call returned. Merge sort
splitting and merging, quick sort's uneven partitions on sorted input, the n + 1 empty calls
of a tree traversal: the shape of the recursion is right there.

![Merge sort with the tree of recursive calls in the side panel](docs/images/calls.png)

## Thinking before watching

At the key moments a topic stops and asks. Which way will 45 go from 30? Which vertex comes
out of the queue next: click it. Which of these two assignments must come first? You answer,
it says whether you were right and why, and then you watch it happen. Predictions can be
turned off in Settings.

![A prediction: which way will the key go from here, Left or Right](docs/images/predict.png)

Every topic also has a quiz of four to six questions about the understanding behind it, not
trivia: why BFS marks a vertex when it is queued, why a deleted slot must not be set to
EMPTY, why a heap is built from the bottom.

![The quiz for quick sort, one answer right and one wrong, each with its explanation](docs/images/quiz.png)

## Compare and courses

**Compare** runs two topics side by side on the same data, step for step, each with its own
counters: bubble sort against insertion sort, BFS against DFS, Lomuto against Hoare
partitioning, a sentinel list against a plain one. You can pick any two topics.

![Bubble sort and insertion sort on the same numbers, stepping together](docs/images/compare.png)

**Courses** put topics in an order that builds up, with a line on what to watch for in each:
arrays, linked lists, pointer puzzles, stacks and queues, searching, sorting, hashing, binary
trees, binary search trees, balanced trees, heaps and tries, graphs, and recursion. A strip
above the topic leads to the next step, and your progress is kept in the browser.

![The course list with progress bars](docs/images/courses.png)

![A course step: the strip above the topic says what to look for and leads on](docs/images/course-step.png)

## Graphs you draw

Every graph topic has a **Draw the graph** button. Click to add a vertex, drag it where you
want it, click two vertices to join them, and give the weight if the topic needs one. Then the
algorithm runs on your graph.

![The graph editor with the house-shaped graph used by the traversals](docs/images/graph-editor.png)

## A tour in pictures

Linked lists, including doubly linked, circular and sentinel lists, and the classic puzzles:

![Floyd's cycle detection on a list drawn as a rho, with the tortoise and the hare](docs/images/sll-floyd-detect.png)

![Inserting into a doubly linked list: four numbered pointer writes against a checklist](docs/images/dll-insert-pos.png)

![A circular list drawn as a ring, walked with a do-while loop](docs/images/csll-traverse.png)

Arrays, stacks and queues, and what they are used for:

![A two-dimensional array beside its row-major layout in memory, with the address worked out](docs/images/mat-rowmajor.png)

![A dynamic array moving house: the old block, the new block twice the size, and the copies](docs/images/dyn-push.png)

![A stack in an array standing on end, with popped values left above top as garbage](docs/images/stack-array.png)

![Infix to postfix with an operator stack and the precedence check written beside it](docs/images/app-infix-postfix.png)

Searching and sorting:

![Binary search: the half that is thrown away greys out and the live range shrinks](docs/images/binary-search.png)

![Merge sort: each value on the row of its deepest call, and the merge into the temporary array](docs/images/merge-sort.png)

![Heap sort with every element drawn twice, in the tree and in the array](docs/images/heap-sort.png)

![Radix sort dropping numbers into ten bins by the current digit](docs/images/radix-sort.png)

Hashing:

![A search in a chained hash table: a token runs along one chain](docs/images/chain-search.png)

![Deleting with tombstones in open addressing, and why EMPTY would break a later search](docs/images/oa-delete.png)

Trees, balanced trees, heaps and tries:

![In-order traversal: a walker goes round the tree and each node is printed from below](docs/images/bt-inorder.png)

![Morris traversal: temporary threads drawn as dashed arrows](docs/images/bt-morris.png)

![Deleting a key with two children from a binary search tree: the successor is found and its key copied up](docs/images/bst-delete.png)

![An AVL rotation with the three pointer changes numbered and the moving subtree shaded](docs/images/avl-rotate.png)

![Red-black insertion: the uncle ringed and the case named](docs/images/rb-insert.png)

![A B-tree splitting a full node, its middle key rising into the parent](docs/images/btree-insert.png)

![A heap insert, sifting up in the tree and in the array at the same time](docs/images/heap-insert.png)

![A trie: the word as letter tiles and the node's 26 child pointers](docs/images/trie-insert.png)

Graphs:

![Dijkstra's algorithm: distance labels drop as edges are relaxed](docs/images/dijkstra.png)

![Floyd-Warshall: the distance matrix with row and column k lit, and the route through k on the graph](docs/images/floyd-warshall.png)

![Kruskal's algorithm with the sorted edges and the union-find forest](docs/images/kruskal.png)

![Strongly connected components: the transposed graph and the second pass](docs/images/scc.png)

## Every topic

### Arrays

- **Static arrays**: Traverse: visit, print and sum; Insert at a position; Delete at a position; Reverse in place; Rotate left (three reversals); Merge two sorted arrays.
- **Dynamic arrays**: Push back (doubling); Pop back (halving).
- **Two-dimensional arrays**: Row-major layout in memory; Transpose in place; Spiral order; Sparse matrix as triplets.
- **Two pointers and sliding windows**: Pair with a given sum (sorted); Remove duplicates in place; Largest sum of k in a row; Shortest window with sum ≥ target.

### Linked lists

- **Singly linked lists**: Traverse and print; Count the nodes; Search for a key; Insert at the front; Insert at the end; Insert at a position; Insert after a key; Insert before a key; Insert into a sorted list; Delete the first node; Delete the last node; Delete at a position; Delete a key; K-th node from the end; Middle node (slow and fast); Reverse (iterative); Reverse (recursive); Reverse in groups of k; Rotate by k places; Split into two halves; Merge two sorted lists; Detect a loop (Floyd); Find and break a loop; Remove duplicates; Where two lists meet; Is it a palindrome.
- **Doubly linked lists**: Insert at the front; Insert at the end; Insert at a position; Delete a key; Walk backwards; Reverse.
- **Circular singly linked lists**: Insert at the front; Insert at the end; Delete a key; Traverse (do-while).
- **Circular doubly linked lists**: Insert at the end; Delete a key.
- **Lists with a sentinel**: Insert in order; Delete a key.

### Stacks and queues

- **Stacks in an array**: Push and pop.
- **Linked stacks**: Push and pop.
- **Queues in an array**: Linear queue (the naive way); Circular queue.
- **Linked queues**: Enqueue and dequeue.
- **Double-ended queues**: Deque in a circular array; Deque as a doubly linked list.
- **Stacks and queues at work**: Matching brackets; Infix to postfix; Evaluate postfix; Undo and redo; Recursion and the call stack.

### Searching

- **Searching an array**: Linear search; Sentinel linear search; Binary search; Binary search: first occurrence; Binary search: last occurrence; Search a rotated sorted array; Interpolation search; Jump search; Exponential search.

### Sorting

- **Sorting**: Bubble sort; Selection sort; Insertion sort; Merge sort; Quick sort; Quick sort (Hoare partition); Quick sort (three-way partition); Shell sort; Heap sort; Counting sort; Radix sort; Bucket sort.

### Hashing

- **Hash tables with chaining**: Insert with chaining; Search with chaining; Delete with chaining; Growing the table (rehash).
- **Open addressing**: Linear probing: insert; Linear probing: search; Quadratic probing; Double hashing; Delete: tombstones.

### Trees

- **Binary trees**: Pre-order (recursive); In-order (recursive); Post-order (recursive); In-order with a stack; Pre-order with a stack; Post-order with two stacks; Level order (breadth first); Morris in-order (no stack); A tree in an array.
- **Tree properties and construction**: Height; Size (count the nodes); Count the leaves; Diameter (longest path); Mirror a tree; Are two trees identical; Is it height-balanced; Lowest common ancestor; Build from preorder and inorder; Build from postorder and inorder; Serialize (tree to array); Deserialize (array to tree).
- **Binary search trees**: Search for a key; Insert a key; Insert a key (recursive); Delete a key; Smallest and biggest key; In-order successor; In-order predecessor; Floor and ceiling; The k-th smallest key; Print the keys in a range; Is it a binary search tree; Build from a sorted array.

### Balanced trees

- **AVL trees**: Rotations: LL, RR, LR, RL; Insert and rebalance; Delete and rebalance.
- **Red-black trees**: Rotations with parent pointers; Insert and fix up; Delete and fix up.
- **B-trees**: Search; Insert (splitting on the way down); Delete (borrow and merge).
- **B+ trees**: Insert (copy up, push up); Range query.
- **Splay trees**: Access (zig, zig-zig, zig-zag); Insert.
- **Treaps**: Insert (rotate up by priority); Delete (rotate down, then cut).

### Heaps and tries

- **Binary heaps**: Insert (sift up); Extract the maximum (sift down); Build a heap bottom-up; Priority queue: change a priority; The k largest (a min-heap of size k).
- **Tries**: Insert a word; Search for a word; All words with a prefix; Delete a word.

### Graphs

- **Representing graphs**: Adjacency matrix; Adjacency lists; Edge list and degrees; Incidence matrix.
- **Graph traversal**: Breadth-first search; Depth-first search; Depth-first search with a stack.
- **Shortest paths**: Dijkstra's algorithm; Bellman-Ford; Floyd-Warshall.
- **Spanning trees**: Prim's algorithm; Kruskal's algorithm; Union-find.
- **Order and structure**: Topological order (Kahn); Topological order (DFS); Cycle (undirected); Cycle (directed); Connected components; Strongly connected components; Bipartite check.

## Looks

There is a dark and a light theme; the first visit follows the system setting. Projector
mode makes the narration, the code and the counters large enough for the back of a
classroom. Sounds for comparisons, swaps, malloc and free can be turned on in Settings; they
are off unless you ask for them.

![Range search in a binary search tree in the light theme](docs/images/light.png)

![Insertion sort in projector mode](docs/images/projector.png)

## Phones and tablets

The page works on phones and tablets. On a narrow screen the catalogue becomes a menu, the
code and memory panels go under the stage, and the stage can be pinched to zoom and dragged
to look around. Buttons are large enough for a finger.

<p>
<img src="docs/images/phone.png" alt="Extracting from a heap on a phone" width="300">
<img src="docs/images/tablet.png" alt="A range scan in a B+ tree on a tablet" width="420">
</p>

## Keyboard

| Key | Does |
| --- | --- |
| Space | play or pause |
| → | next step |
| ← | step back |
| Home, End | first or last step |
| R | from the start, playing |
| Enter in an input box | run with that data |
| Ctrl + wheel | zoom the stage |

## Running it locally

Strux is the single file `index.html`. Open it from any web server:

```
python3 -m http.server 8000
```

and go to http://localhost:8000. To change it, edit the files under `src` and run

```
node build.mjs
```

which joins the sources, in the order listed in `src/manifest.json`, into `index.html`. While
working, `tools/devpage.mjs` serves `dev.html`, the same page with each source file loaded
separately, so a mistake in one topic does not stop the others.

## How it is built

A topic is a C function with a few marks in comments at the ends of its lines, a scene
function and some teaching text. The recorder compiles the program with See's compiler, runs
it on See's machine, and takes a snapshot after every line of the topic's functions: the line,
its mark, the variables and memory the topic asks for, the call stack and the heap. The scene
turns each snapshot into a list of items for the stage (nodes, cells, bars, arrows, cursors,
tokens, rings, labels), each with a stable name, and writes the narration. The stage moves
every item from where it was to where it is now, so a pointer that changes swings, a node
that is freed falls away and two values that swap cross over.

Families of topics share their declarations and helpers, and small drawing kits are shared
by the topics that need them: rows of list nodes, arrays and bars, trees, graphs, hash tables,
multi-key nodes and rings.

## Testing

`node tools/check-topics.mjs` runs every topic with its default data and every preset and
checks that it builds, runs within its step limit, draws every frame, narrates nearly every
step, never says "undefined" or "null", asks questions whose answers are really on the
picture, and has a quiz.

`node tests/e2e/run.mjs` runs more than three thousand end to end tests in headless Chrome:
the page, the player, predictions and quizzes, compare, courses, the graph editor, zoom,
phones and tablets, and for every topic its steps, presets, code, memory and calls panels,
quiz, predictions, input checks, Open in See and a phone-sized screen.

## Project layout

```
src/c            the C89 compiler, linker, machine and library (from See)
src/stage        the recorder, the stage, the topic model and the drawing kits
src/topics       the topics, one or more files per family
src/app          the page: catalogue, player, compare, courses, graph editor, styles
assets           the photo on the About the author page
tests            the topic loader and the end to end tests
tools            the topic checker, the Chrome driver, screenshots
```

## Limitations

Inputs are kept small on purpose, so that every node and label stays readable: at most a
dozen numbers to sort, fifteen keys in a tree, ten vertices in a graph. The programs run on
a simulated machine and are recorded before they are shown, so a topic with a large input
takes a moment to prepare. Strux shows the algorithms; to edit and run the code, use Open in
See.

## Trademarks

UNIX is a registered trademark of The Open Group. Intel and x86 are trademarks of Intel
Corporation. Chrome is a trademark of Google LLC, Safari is a trademark of Apple Inc., Firefox
is a trademark of the Mozilla Foundation, and GitHub is a trademark of GitHub, Inc. These
names are used only to describe compatibility. Strux is an independent work and is not
affiliated with or endorsed by any of these organisations.

## License

Strux is free software under the GNU General Public License, version 3 or later. See
`LICENSE` for the full text and `COPYRIGHT` for the notice.

Under section 7 of the license there is one additional term, written out in full in
`NOTICE`. Any copy, modification or derived work, including a hosted version, must keep the
attribution "Based on Strux by Jyotiprakash Mishra (https://strux.jyotiprakash.org)" in its
source and show it in its about screen or other legal notices. This applies to the program,
the topics, their narration and quizzes, and the courses.

Copyright (C) 2026 Jyotiprakash Mishra
