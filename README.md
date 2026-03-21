# Commentree

**A better way to read deeply nested comment threads.**

## The problem

Sites like Hacker News and Reddit display comment trees as indented 2D lists. This works fine for shallow threads, but deeply nested conversations create two problems:

1. **Direct replies end up visually far apart.** A top-level comment with 70 replies pushes the next top-level comment hundreds of pixels down the page. You scroll past dozens of replies you didn't ask to see.
2. **You can't see the shape of a conversation before entering it.** A comment might have 2 replies or 200 — you won't know until you scroll through all of them. There's no way to gauge which threads are deep, which are broad, which are worth reading.

## The idea

Commentree adds a "third dimension" to comment threads — not with 3D rendering, but with **progressive disclosure and tree shape previews**.

When you load a thread, you see:

```
┌─────────┬──────────────────────────────────────────────┐
│ ▪▪      │ Top-level comment A                          │
│  ▪▪▪    │ "Here's my take on..."                       │
│ ▪▪      │                                              │
│   12    │                                              │
├─────────┼──────────────────────────────────────────────┤
│ ▪       │ Top-level comment B                          │
│   1     │ "I disagree because..."                      │
├─────────┼──────────────────────────────────────────────┤
│ ▪▪▪     │ Top-level comment C                          │
│ ▪▪▪▪    │ "Relevant link: ..."                         │
│  ▪▪▪    │                                              │
│ ▪▪      │                                              │
│  ▪▪▪▪▪  │                                              │
│   38    │                                              │
└─────────┴──────────────────────────────────────────────┘
```

**The left column is a miniature tree preview** — a compact canvas rendering where each descendant comment is a tiny bar, indented by its depth in the reply chain. The shape of this preview immediately tells you:

- **How many replies** a comment has (the number below the preview)
- **How deep the conversation goes** (how jagged the left edge is)
- **Where the discussion clusters** (dense vs sparse regions)

Comment A has 12 replies in a balanced tree. Comment B has a single reply. Comment C has 38 replies with a deep, branching discussion.

**Hover over any comment to reveal its direct replies**, rendered as normal indented comments below it — just like HN. Each reply has its own tree preview showing *its* subtree. Hover a reply to drill deeper. Move your mouse away and the thread collapses back with a staggered animation (deepest children first).

Because child comments are nested inside their parent's DOM element, hovering a deeply nested reply keeps the entire ancestor chain expanded. On touch devices, tap to expand and tap again to collapse.

## How it works

### Data

A single fetch to the [Algolia HN API](https://hn.algolia.com/api/v1/items/{id}) returns the full nested comment tree as JSON. No pagination, no multiple requests.

### Rendering

Comments are rendered recursively as nested DOM elements:

```html
<div class="comment">
  <div class="comment-row">
    <div class="tree-preview">        <!-- canvas minimap -->
    <div class="comment-content">     <!-- author, time, text -->
  </div>
  <div class="comment-children">      <!-- hidden until hover -->
    <div class="comment">...</div>    <!-- same structure, recursive -->
    <div class="comment">...</div>
  </div>
</div>
```

### Tree preview

Each tree preview is a `<canvas>` element rendered at 2x for retina displays. Descendant comments are collected via DFS traversal, and each becomes a fixed-width bar at its depth-indented position. For large subtrees (70+ comments), bars are scaled vertically to fit within a 60px max height, producing a dense fingerprint of the conversation shape.

### Tech stack

- **Vanilla JS** (ES modules, no framework, no build step)
- **Pure CSS** for hover interaction
- **Canvas API** for tree previews
- **Algolia HN API** for data (standalone app)

Zero dependencies. Serve with any static file server.

## Chrome extension

The extension adds tree previews directly to Hacker News thread pages. It keeps HN's native page, styles, and functionality (voting, reply links, navigation) intact — only the comment tree section is replaced with the commentree layout.

### Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` directory

Visit any HN thread and tree previews appear automatically.

### How it works

The content script runs at `document_idle` on HN item pages. It parses HN's flat comment table (`tr.athing.comtr` rows with `indent` attributes) into a nested tree, clones each comment's original DOM nodes (vote links, author, body, reply), and rebuilds the section with tree previews and expand/collapse behavior.

All CSS classes are prefixed `ct-` to avoid collisions with HN's styles. A scoped `box-sizing: border-box` reset prevents HN's default `content-box` from causing layout overflow.

## Live demo

**https://commentree.acxx.workers.dev**

Open any HN thread by ID: `https://commentree.acxx.workers.dev?id=47440430`

The front page shows current top stories.

### Run locally

```bash
python3 -m http.server 8080
open "http://localhost:8080"
```

### Deploy

```bash
./deploy.sh
```

Deploys to Cloudflare Workers via wrangler.

## File structure

```
index.html            App entry point
style.css             App styles
js/
  main.js             Orchestrator — fetch, render, routing
  api.js              Algolia HN API fetch
  render.js           Comment rendering + canvas tree previews
  interact.js         Expand/collapse interactions
  onboard.js          First-visit onboarding flow
extension/
  manifest.json       Chrome MV3 manifest
  content.js          Content script — DOM parsing, rendering, interactions
  style.css           Extension-only styles (ct- prefixed)
deploy.sh             Build dist/ and deploy to Cloudflare Workers
wrangler.json         Cloudflare Workers config
```

## Design decisions

**Why hover instead of click-to-expand?** Click requires explicit action for every level. Hover lets you sweep through the tree fluidly — just drag your mouse down the reply chain to read a conversation, move it away to collapse. The thread follows your attention.

**Why a miniature tree instead of just a count?** A count ("38 replies") tells you *how much* discussion there is. The tree shape tells you *what kind* — is it one long back-and-forth (a thin diagonal)? A broad debate with many direct replies (wide and flat)? A mix? You can see this at a glance without reading a single word.

**Why progressive disclosure instead of showing everything?** HN's default view dumps hundreds of comments on the page. Most readers only care about a few threads. Commentree lets you see all top-level comments on one screen and selectively drill into the ones that interest you. The tree previews help you choose *which* threads to explore.

**Why no framework/build step?** The entire application is ~200 lines of JS across 3 files. A framework would add complexity without adding capability. No build step means you can edit any file and refresh — the feedback loop is instant.
