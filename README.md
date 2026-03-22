# Commentree

**A better way to read deeply nested comment threads.**

## The problem

Sites like Hacker News and Reddit display comment trees as indented 2D lists. This works fine for shallow threads, but deeply nested conversations create two problems:

1. **Direct replies end up visually far apart.** A top-level comment with 70 replies pushes the next top-level comment hundreds of pixels down the page. You scroll past dozens of replies you didn't ask to see.
2. **You can't see the shape of a conversation before entering it.** A comment might have 2 replies or 200 — you won't know until you scroll through all of them. There's no way to gauge which threads are deep, which are broad, which are worth reading.

## The idea

Commentree adds a "third dimension" to comment threads — not with 3D rendering, but with **progressive disclosure and inline tree shape previews**.

Each comment starts in **bar mode** — a thin colored strip whose opacity reflects the comment's length. Bars stack vertically in the left margin, forming a compact fingerprint of the conversation shape. You can immediately see:

- **How many replies** a comment has (bar count)
- **How deep the conversation goes** (nesting depth)
- **Where the discussion clusters** (dense vs sparse regions)

**Hover over any comment to expand it into card mode**, revealing the full text and its children's bars. Hover a child bar to drill deeper. Move your mouse away and the thread collapses back with a staggered animation (deepest children first).

**Click an expanded comment to pin it open.** Only one comment can be pinned at a time. Pinning updates the URL hash, so you can share or bookmark a specific comment. Ancestors of the pinned comment stay expanded; everything else remains dynamically hover-driven.

On touch devices, tap to expand and tap again to collapse.

## How it works

### Data

A single fetch to the [Algolia HN API](https://hn.algolia.com/api/v1/items/{id}) returns the full nested comment tree as JSON. No pagination, no multiple requests.

### Rendering

Comments are rendered recursively as nested DOM elements using a CSS grid layout with three tracks: bar, row, and children.

```html
<div class="comment has-children">
  <div class="comment-bar"></div>           <!-- thin strip in bar mode -->
  <div class="comment-row">
    <div class="comment-content">...</div>  <!-- author, time, text -->
  </div>
  <div class="comment-children">           <!-- hidden until hover -->
    <div class="comment">...</div>         <!-- same structure, recursive -->
  </div>
</div>
```

The bar-to-card transition is driven by `grid-template-rows` — bar mode uses `3px 0fr auto`, card mode uses `0px 1fr auto`. CSS transitions handle the animation.

### Tech stack

- **Vanilla JS** (ES modules, no framework, no build step)
- **Pure CSS grid** for bar-to-card transitions
- **Algolia HN API** for data (standalone app)

Zero dependencies.

## Chrome extension

The extension adds the commentree layout directly to **Hacker News** and **old Reddit** thread pages. It keeps each site's native page, styles, and functionality (voting, reply links, navigation) intact — only the comment tree section is replaced.

On Reddit, bar darkness also factors in the comment's score — higher-voted comments produce darker bars. Negative-score comments are faded. RES dark mode is supported.

### Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` directory

Visit any HN or Reddit thread and the tree layout appears automatically.

### How it works

The content script runs at `document_idle` on matching pages. On HN, it parses the flat comment table (`tr.athing.comtr` rows with `indent` attributes) into a nested tree. On Reddit, it walks the already-nested `.thing.comment` DOM. In both cases, each comment's original DOM nodes are cloned (preserving votes, author styles, reply links) and rebuilt with bar-to-card expand/collapse behavior.

All CSS classes are prefixed `ct-` to avoid collisions with each site's styles.

## Live demo

**https://commentree.acxx.workers.dev**

Open any HN thread by ID: `https://commentree.acxx.workers.dev?id=47440430`

The front page shows current top stories.

### Run locally

```bash
npm start
open http://localhost:8787
```

### Deploy

```bash
npm run deploy
```

## File structure

```
src/
  index.html          App entry point
  style.css           App styles
  js/
    main.js           Orchestrator — fetch, render, routing
    api.js            Algolia HN API fetch
    render.js         Comment rendering (bar + row + children grid)
    interact.js       Expand/collapse interactions + pin logic
    color.js          Color assignment for comment bars
    onboard.js        First-visit onboarding flow
extension/
  entry.js            Extension entry point — DOM parsing, rendering
  content.js          Built by esbuild (entry.js + shared modules)
  manifest.json       Chrome MV3 manifest (HN + Reddit)
  style.css           Extension-only styles (ct- prefixed)
worker.js             Cloudflare Workers entry
wrangler.json         Cloudflare Workers config
package.json          Dev and deploy scripts
```

## Design decisions

**Why hover instead of click-to-expand?** Click requires explicit action for every level. Hover lets you sweep through the tree fluidly — just drag your mouse down the reply chain to read a conversation, move it away to collapse. The thread follows your attention. Click-to-pin is available when you want a comment to stay open.

**Why bars instead of just a count?** A count ("38 replies") tells you *how much* discussion there is. The bar pattern tells you *what kind* — the density and nesting of bars reveals whether it's a long back-and-forth, a broad debate, or a mix. You can see this at a glance without reading a single word.

**Why progressive disclosure instead of showing everything?** HN's default view dumps hundreds of comments on the page. Most readers only care about a few threads. Commentree lets you see all top-level comments on one screen and selectively drill into the ones that interest you. The bar previews help you choose *which* threads to explore.

**Why no framework/build step?** The entire application is a few hundred lines of JS across a handful of files. A framework would add complexity without adding capability. No build step means you can edit any file and refresh — the feedback loop is instant.

## License

MIT
