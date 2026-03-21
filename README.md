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

The bar↔card transition is driven by `grid-template-rows` — bar mode uses `2px 0fr auto`, card mode uses `0px 1fr auto`. CSS transitions handle the animation.

### Tech stack

- **Vanilla JS** (ES modules, no framework, no build step)
- **Pure CSS grid** for bar↔card transitions
- **Algolia HN API** for data (standalone app)

Zero dependencies.

## Chrome extension

The extension adds the commentree layout directly to Hacker News thread pages. It keeps HN's native page, styles, and functionality (voting, reply links, navigation) intact — only the comment tree section is replaced.

### Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` directory

Visit any HN thread and the tree layout appears automatically.

### How it works

The content script runs at `document_idle` on HN item pages. It parses HN's flat comment table (`tr.athing.comtr` rows with `indent` attributes) into a nested tree, clones each comment's original DOM nodes (vote links, author, body, reply), and rebuilds the section with bar↔card expand/collapse behavior.

All CSS classes are prefixed `ct-` to avoid collisions with HN's styles. A scoped `box-sizing: border-box` reset prevents HN's default `content-box` from causing layout overflow.

## Live demo

**https://commentree.acxx.workers.dev**

Open any HN thread by ID: `https://commentree.acxx.workers.dev?id=47440430`

The front page shows current top stories.

### Run locally

```bash
npx wrangler dev --port 8787
open "http://localhost:8787"
```

Uses Cloudflare Workers' local runtime via wrangler, serving from `dist/`.

### Deploy

```bash
./deploy.sh
```

Deploys to Cloudflare Workers via wrangler.

## File structure

```
dist/
  index.html            App entry point
  style.css             App styles
  js/
    main.js             Orchestrator — fetch, render, routing
    api.js              Algolia HN API fetch
    render.js           Comment rendering (bar + row + children grid)
    interact.js         Expand/collapse interactions + pin logic
    onboard.js          First-visit onboarding flow
extension/
  manifest.json         Chrome MV3 manifest
  content.js            Content script — DOM parsing, rendering, interactions
  style.css             Extension-only styles (ct- prefixed)
deploy.sh               Build dist/ and deploy to Cloudflare Workers
wrangler.json           Cloudflare Workers config
```

## Design decisions

**Why hover instead of click-to-expand?** Click requires explicit action for every level. Hover lets you sweep through the tree fluidly — just drag your mouse down the reply chain to read a conversation, move it away to collapse. The thread follows your attention. Click-to-pin is available when you want a comment to stay open.

**Why bars instead of just a count?** A count ("38 replies") tells you *how much* discussion there is. The bar pattern tells you *what kind* — the density and nesting of bars reveals whether it's a long back-and-forth, a broad debate, or a mix. You can see this at a glance without reading a single word.

**Why progressive disclosure instead of showing everything?** HN's default view dumps hundreds of comments on the page. Most readers only care about a few threads. Commentree lets you see all top-level comments on one screen and selectively drill into the ones that interest you. The bar previews help you choose *which* threads to explore.

**Why no framework/build step?** The entire application is a few hundred lines of JS across a handful of files. A framework would add complexity without adding capability. No build step means you can edit any file and refresh — the feedback loop is instant.
