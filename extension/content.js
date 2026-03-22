(() => {
  // src/js/interact.js
  var COLLAPSE_DELAY = 400;
  var EXPAND_DELAY = 200;
  var STAGGER_DELAY = 80;
  var scrollFloor = 0;
  var collapseActive = 0;
  var collapseTimer = null;
  window.addEventListener("scroll", () => {
    if (collapseActive === 0) {
      scrollFloor = window.scrollY;
    } else if (window.scrollY < scrollFloor) {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(scrollFloor, maxScroll));
    }
  });
  function setupInteractions(container, p = "") {
    const CLS = {
      comment: `${p}comment`,
      hasChildren: `${p}has-children`,
      expanded: `${p}expanded`,
      pinned: `${p}pinned`,
      pinnedAnc: `${p}pinned-ancestor`,
      row: `${p}comment-row`,
      children: `${p}comment-children`,
      bar: `${p}comment-bar`
    };
    const childrenCls = p === "ct-" ? "ct-children" : CLS.children;
    const collapseTimers = /* @__PURE__ */ new Map();
    let pendingExpand = null;
    function outermostUnexpanded(comment) {
      let target = comment;
      while (target) {
        const parent = target.parentElement?.closest(`.${CLS.comment}`);
        if (!parent || parent.classList.contains(CLS.expanded)) break;
        target = parent;
      }
      return target?.classList.contains(CLS.hasChildren) && !target.classList.contains(CLS.expanded) ? target : null;
    }
    function scheduleExpand(comment) {
      if (pendingExpand && pendingExpand.comment === comment) return;
      if (pendingExpand) {
        clearTimeout(pendingExpand.timer);
        pendingExpand = null;
      }
      const timer = setTimeout(() => {
        pendingExpand = null;
        comment.classList.add(CLS.expanded);
      }, EXPAND_DELAY);
      pendingExpand = { comment, timer };
    }
    document.addEventListener("mouseover", (e) => {
      const row = e.target.closest?.(`.${CLS.row}`);
      const childrenArea = !row && e.target.closest?.(`.${childrenCls}`);
      if (!row && !childrenArea) return;
      const comment = row ? row.parentElement : childrenArea.parentElement;
      if (!comment) return;
      cancelCollapseChain(comment);
      const target = outermostUnexpanded(comment);
      if (target) scheduleExpand(target);
    });
    document.addEventListener("mouseout", (e) => {
      const comment = e.target.closest?.(`.${CLS.comment}`);
      if (!comment?.classList.contains(CLS.hasChildren)) return;
      const related = e.relatedTarget;
      if (related && comment.contains(related)) return;
      if (pendingExpand && pendingExpand.comment === comment) {
        clearTimeout(pendingExpand.timer);
        pendingExpand = null;
      }
      scheduleCollapse(comment);
    });
    const isTouch = matchMedia("(pointer: coarse)").matches;
    if (!isTouch) {
      document.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        const row = e.target.closest?.(`.${CLS.row}`);
        if (!row) return;
        const comment = row.parentElement;
        if (!comment?.classList.contains(CLS.hasChildren)) return;
        if (comment.classList.contains(CLS.pinned)) {
          unpinAll();
          history.replaceState(null, "", location.pathname + location.search);
        } else if (comment.classList.contains(CLS.expanded)) {
          pinComment(comment);
        }
      });
    }
    function unpinAll() {
      container.querySelectorAll(`.${CLS.pinned}`).forEach((el) => el.classList.remove(CLS.pinned));
      container.querySelectorAll(`.${CLS.pinnedAnc}`).forEach((el) => el.classList.remove(CLS.pinnedAnc));
    }
    function pinComment(comment) {
      unpinAll();
      comment.classList.add(CLS.pinned);
      if (!comment.classList.contains(CLS.expanded)) {
        comment.classList.add(CLS.expanded);
      }
      let ancestor = comment.parentElement?.closest?.(`.${CLS.comment}`);
      while (ancestor) {
        ancestor.classList.add(CLS.pinnedAnc);
        if (!ancestor.classList.contains(CLS.expanded)) {
          ancestor.classList.add(CLS.expanded);
        }
        ancestor = ancestor.parentElement?.closest?.(`.${CLS.comment}`);
      }
      const id = comment.dataset.id;
      if (id) history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
    }
    if (location.hash) {
      const id = location.hash.slice(1);
      const target = document.querySelector(`.${CLS.comment}[data-id="${id}"]`);
      if (target) pinComment(target);
    }
    if (isTouch) {
      document.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        const childrenArea = e.target.closest?.(`.${childrenCls}`);
        if (childrenArea) {
          let comment2 = childrenArea.parentElement;
          while (comment2) {
            const parent = comment2.parentElement?.closest(`.${CLS.comment}`);
            if (!parent || parent.classList.contains(CLS.expanded)) break;
            comment2 = parent;
          }
          if (comment2?.classList.contains(CLS.hasChildren) && !comment2.classList.contains(CLS.expanded)) {
            comment2.classList.add(CLS.expanded);
            return;
          }
        }
        const row = e.target.closest?.(`.${CLS.row}`);
        if (!row) return;
        const comment = row.parentElement;
        if (!comment?.classList.contains(CLS.hasChildren)) return;
        if (comment.classList.contains(CLS.expanded)) {
          const expandedChildren = comment.querySelectorAll(`:scope > .${childrenCls} > .${CLS.comment}.${CLS.expanded}`);
          if (expandedChildren.length > 0) {
            expandedChildren.forEach((child) => {
              child.querySelectorAll(`.${CLS.expanded}`).forEach((desc) => desc.classList.remove(CLS.expanded));
              child.classList.remove(CLS.expanded);
            });
            beginCollapse();
          } else {
            beginCollapse();
            comment.classList.remove(CLS.expanded);
          }
        } else {
          comment.classList.add(CLS.expanded);
        }
      });
    }
    container.addEventListener("mouseleave", () => {
      if (pendingExpand) {
        clearTimeout(pendingExpand.timer);
        pendingExpand = null;
      }
      const expanded = [];
      container.querySelectorAll(`.${CLS.comment}.${CLS.expanded}:not(.${CLS.pinned}):not(.${CLS.pinnedAnc})`).forEach((el) => {
        let depth = 0;
        let parent = el.parentElement?.closest?.(`.${CLS.comment}`);
        while (parent) {
          depth++;
          parent = parent.parentElement?.closest?.(`.${CLS.comment}`);
        }
        expanded.push({ el, depth });
      });
      expanded.sort((a, b) => b.depth - a.depth);
      const byDepth = /* @__PURE__ */ new Map();
      for (const { el, depth } of expanded) {
        if (!byDepth.has(depth)) byDepth.set(depth, []);
        byDepth.get(depth).push(el);
      }
      const depths = [...byDepth.keys()].sort((a, b) => b - a);
      depths.forEach((depth, i) => {
        const comments = byDepth.get(depth);
        const delay = COLLAPSE_DELAY + i * STAGGER_DELAY;
        for (const comment of comments) {
          if (collapseTimers.has(comment)) {
            clearTimeout(collapseTimers.get(comment));
            collapseTimers.delete(comment);
          }
          const timer = setTimeout(() => {
            collapseTimers.delete(comment);
            if (comment.classList.contains(CLS.expanded)) {
              collapseSingle(comment);
            }
          }, delay);
          collapseTimers.set(comment, timer);
        }
      });
    });
    function scheduleCollapse(comment, delay = COLLAPSE_DELAY) {
      if (collapseTimers.has(comment)) return;
      const timer = setTimeout(() => {
        collapseTimers.delete(comment);
        collapseTree(comment);
      }, delay);
      collapseTimers.set(comment, timer);
    }
    function cancelCollapseChain(comment) {
      let el = comment;
      while (el) {
        if (collapseTimers.has(el)) {
          clearTimeout(collapseTimers.get(el));
          collapseTimers.delete(el);
        }
        el = el.parentElement?.closest?.(`.${CLS.comment}`);
      }
    }
    function collapseSingle(comment) {
      if (comment.classList.contains(CLS.pinned) || comment.classList.contains(CLS.pinnedAnc)) return;
      comment.querySelectorAll(`.${CLS.expanded}:not(.${CLS.pinned}):not(.${CLS.pinnedAnc})`).forEach((desc) => {
        desc.classList.remove(CLS.expanded);
      });
      const row = comment.querySelector(`:scope > .${CLS.row}`);
      if (!row) return;
      const rowRect = row.getBoundingClientRect();
      if (rowRect.bottom < 0 || rowRect.top > window.innerHeight) return;
      beginCollapse();
      comment.classList.remove(CLS.expanded);
    }
    function collapseTree(comment) {
      if (comment.classList.contains(CLS.pinned) || comment.classList.contains(CLS.pinnedAnc)) return;
      const toCollapse = [];
      comment.querySelectorAll(`.${CLS.expanded}:not(.${CLS.pinned}):not(.${CLS.pinnedAnc})`).forEach((desc) => {
        if (collapseTimers.has(desc)) {
          clearTimeout(collapseTimers.get(desc));
          collapseTimers.delete(desc);
        }
        toCollapse.push(desc);
      });
      toCollapse.push(comment);
      toCollapse.sort((a, b) => {
        let dA = 0, el = a;
        while (el = el.parentElement?.closest?.(`.${CLS.comment}`)) dA++;
        let dB = 0;
        el = b;
        while (el = el.parentElement?.closest?.(`.${CLS.comment}`)) dB++;
        return dB - dA;
      });
      for (const el of toCollapse) {
        if (el.classList.contains(CLS.expanded)) collapseSingle(el);
      }
    }
  }
  function beginCollapse() {
    collapseActive++;
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
      collapseActive = 0;
      scrollFloor = window.scrollY;
    }, 500);
  }

  // src/js/onboard.js
  var STORAGE_KEY = "commentree_onboarded";
  function setupOnboarding(container, p = "") {
    const isTouch = matchMedia("(pointer: coarse)").matches;
    const btn = document.createElement("button");
    btn.className = `${p}info-btn`;
    btn.textContent = "i";
    btn.addEventListener("click", () => showOverlay(container, isTouch, p));
    document.body.appendChild(btn);
    if (!localStorage.getItem(STORAGE_KEY)) {
      showOverlay(container, isTouch, p);
    }
  }
  function showOverlay(container, isTouch, p) {
    document.querySelector(`.${p}onboard-overlay`)?.remove();
    const overlay = document.createElement("div");
    overlay.className = `${p}onboard-overlay`;
    if (isTouch) {
      overlay.innerHTML = `
      <div class="${p}onboard-content">
        <p class="${p}onboard-title">commentree</p>
        <p>A hover-based UX experiment to help read large nested comment trees.</p>
        <p>Tap a comment to expand its reply tree.</p>
        <p>Tap again to collapse.</p>
        <p class="${p}onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a></p>
        <p class="${p}onboard-dismiss">tap anywhere to start</p>
      </div>
    `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add(`${p}visible`));
      overlay.addEventListener("click", () => dismiss(overlay, p));
    } else {
      let onMove = function(e) {
        const rect = container.getBoundingClientRect();
        if (e.clientX < rect.left) {
          dismiss(overlay, p);
          document.removeEventListener("mousemove", onMove);
        }
      };
      overlay.innerHTML = `
      <div class="${p}onboard-content">
        <p class="${p}onboard-title">commentree</p>
        <p>A hover-based UX experiment to help read large nested comment trees.</p>
        <p>Explore with your mouse cursor, hover to expand.</p>
        <p>Each line represents a comment \u2014 darker lines mean longer comments.</p>
        <p>Best to interact with the tree from the left.</p>
        <p class="${p}onboard-author">by <a href="https://news.ycombinator.com/user?id=modemuser" target="_blank">modemuser</a></p>
        <p class="${p}onboard-dismiss">move your cursor to the left margin to begin</p>
      </div>
    `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add(`${p}visible`));
      overlay.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        dismiss(overlay, p);
        document.removeEventListener("mousemove", onMove);
      });
      document.addEventListener("mousemove", onMove);
    }
  }
  function dismiss(overlay, p) {
    localStorage.setItem(STORAGE_KEY, "1");
    overlay.classList.remove(`${p}visible`);
    setTimeout(() => overlay.remove(), 500);
  }

  // src/js/color.js
  function barColor(textLen, score, dark) {
    const textFactor = Math.min(Math.sqrt(textLen) * 0.01, 0.25);
    const s = score || 0;
    const scoreFactor = s > 0 ? Math.min(Math.sqrt(s) * 0.015, 0.3) : 0;
    const downFactor = s < 0 ? Math.min(Math.sqrt(-s) * 0.15, 0.7) : 0;
    if (dark) {
      const i2 = Math.max(0.01, 0.04 + textFactor * 0.5 + scoreFactor * 0.5 - downFactor * 0.5);
      return `rgba(255, 255, 255, ${i2})`;
    }
    const i = Math.max(0.02, 0.08 + textFactor + scoreFactor - downFactor);
    return `rgba(0, 0, 0, ${i})`;
  }

  // extension/entry.js
  (function() {
    "use strict";
    const P = "ct-";
    const commentTree = document.querySelector("table.comment-tree");
    const redditCommentArea = document.querySelector(".commentarea > .sitetable.nestedlisting");
    if (!commentTree && !redditCommentArea) return;
    function parseHNComments() {
      const rows = commentTree.querySelectorAll("tr.athing.comtr");
      const flat = [];
      for (const row of rows) {
        if (row.classList.contains("noshow")) continue;
        const indentTd = row.querySelector("td.ind");
        const depth = parseInt(indentTd?.getAttribute("indent") || "0", 10);
        const bodyEl = row.querySelector("div.commtext");
        if (!bodyEl) continue;
        const commentDiv = bodyEl.closest(".comment");
        if (commentDiv?.classList.contains("noshow")) continue;
        const innerTable = row.querySelector(":scope > td > table");
        const clonedTable = innerTable.cloneNode(true);
        const clonedInd = clonedTable.querySelector("td.ind");
        if (clonedInd) clonedInd.remove();
        const clonedTogg = clonedTable.querySelector("a.togg");
        if (clonedTogg) clonedTogg.remove();
        flat.push({
          depth,
          rowNode: clonedTable,
          text: bodyEl?.innerHTML || null,
          children: []
        });
      }
      const roots = [];
      const stack = [];
      for (const item of flat) {
        while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
          stack.pop();
        }
        if (stack.length === 0) {
          roots.push(item);
        } else {
          stack[stack.length - 1].node.children.push(item);
        }
        stack.push({ node: item, depth: item.depth });
      }
      return roots;
    }
    function parseRedditComments() {
      const roots = [];
      const topLevel = redditCommentArea.querySelectorAll(":scope > .thing");
      for (const thing of topLevel) {
        const item = parseRedditComment(thing);
        if (item) roots.push(item);
      }
      return roots;
    }
    function parseRedditComment(thing) {
      if (thing.dataset.type !== "comment") return null;
      const entry = thing.querySelector(":scope > .entry");
      if (!entry) return null;
      const bodyEl = entry.querySelector(".usertext-body .md");
      const text = bodyEl?.innerHTML || null;
      if (text == null) return null;
      const rowNode = document.createElement("div");
      rowNode.style.display = "flex";
      rowNode.style.alignItems = "flex-start";
      const midcol = thing.querySelector(":scope > .midcol");
      if (midcol) rowNode.appendChild(midcol.cloneNode(true));
      rowNode.appendChild(entry.cloneNode(true));
      const children = [];
      const childSitetable = thing.querySelector(":scope > .child > .sitetable");
      if (childSitetable) {
        for (const childThing of childSitetable.querySelectorAll(":scope > .thing")) {
          const child = parseRedditComment(childThing);
          if (child) children.push(child);
        }
      }
      const scoreEl = entry.querySelector(".score.unvoted");
      const score = scoreEl ? parseInt(scoreEl.getAttribute("title") || "0", 10) : 0;
      return { rowNode, text, children, score };
    }
    let isDarkMode = document.documentElement.classList.contains("res-nightmode");
    function renderComment(item) {
      if (!item || item.text == null) return null;
      const wrapper = document.createElement("div");
      wrapper.className = `${P}comment`;
      const bar = document.createElement("div");
      bar.className = `${P}comment-bar`;
      bar.dataset.textLen = item.text.length;
      bar.dataset.score = item.score || 0;
      bar.style.background = barColor(item.text.length, item.score, isDarkMode);
      wrapper.appendChild(bar);
      const row = document.createElement("div");
      row.className = `${P}comment-row`;
      row.appendChild(item.rowNode);
      wrapper.appendChild(row);
      const validChildren = (item.children || []).filter((c) => c.text != null);
      if (validChildren.length > 0) {
        wrapper.classList.add(`${P}has-children`);
        const childrenContainer = document.createElement("div");
        childrenContainer.className = `${P}children`;
        for (const child of validChildren) {
          const childEl = renderComment(child);
          if (childEl) childrenContainer.appendChild(childEl);
        }
        wrapper.appendChild(childrenContainer);
      }
      return wrapper;
    }
    const comments = commentTree ? parseHNComments() : parseRedditComments();
    const container = document.createElement("div");
    container.id = `${P}container`;
    for (const child of comments) {
      const el = renderComment(child);
      if (el) container.appendChild(el);
    }
    (commentTree || redditCommentArea).replaceWith(container);
    new MutationObserver(() => {
      const dark = document.documentElement.classList.contains("res-nightmode");
      if (dark === isDarkMode) return;
      isDarkMode = dark;
      container.querySelectorAll(`.${P}comment-bar`).forEach((bar) => {
        bar.style.background = barColor(
          parseInt(bar.dataset.textLen, 10),
          parseInt(bar.dataset.score, 10),
          isDarkMode
        );
      });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    setupInteractions(container, P);
    setupOnboarding(container, P);
  })();
})();
