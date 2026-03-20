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

**Hover over any comment to reveal its direct replies**, rendered as normal indented comments below it — just like HN. Each reply has its own tree preview showing *its* subtree. Hover a reply to drill deeper. Move your mouse away and the thread collapses back.

The interaction is entirely CSS-driven:

```css
.comment-children { display: none; }
.comment:hover > .comment-children { display: block; }
```

Because child comments are nested inside their parent's DOM element, hovering a deeply nested reply keeps the entire ancestor chain expanded. No JavaScript event handling needed for the core interaction.

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
- **Algolia HN API** for data

Zero dependencies. Serve with any static file server.

## Usage

```bash
# Serve locally
python3 -m http.server 8080

# Open any HN thread
open "http://localhost:8080?id=47440430"
```

Pass any HN item ID as the `?id=` query parameter.

## File structure

```
index.html        Entry point
style.css         All styling — layout, comment cards, tree previews, hover states
js/
  main.js         Orchestrator — fetch, render, set title
  api.js          Algolia HN API fetch
  render.js       Recursive comment rendering + canvas tree preview generation
```

## Design decisions

**Why hover instead of click-to-expand?** Click requires explicit action for every level. Hover lets you sweep through the tree fluidly — just drag your mouse down the reply chain to read a conversation, move it away to collapse. The thread follows your attention.

**Why a miniature tree instead of just a count?** A count ("38 replies") tells you *how much* discussion there is. The tree shape tells you *what kind* — is it one long back-and-forth (a thin diagonal)? A broad debate with many direct replies (wide and flat)? A mix? You can see this at a glance without reading a single word.

**Why progressive disclosure instead of showing everything?** HN's default view dumps hundreds of comments on the page. Most readers only care about a few threads. Commentree lets you see all top-level comments on one screen and selectively drill into the ones that interest you. The tree previews help you choose *which* threads to explore.

**Why no framework/build step?** The entire application is ~200 lines of JS across 3 files. A framework would add complexity without adding capability. No build step means you can edit any file and refresh — the feedback loop is instant.
