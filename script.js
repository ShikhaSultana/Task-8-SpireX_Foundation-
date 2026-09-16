/* ============================================
   Drag & Drop List
   Reorder list items using JavaScript DOM events
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const list      = document.getElementById("list");
  const newItem   = document.getElementById("newItem");
  const addBtn    = document.getElementById("addBtn");
  const resetBtn  = document.getElementById("resetBtn");
  const countEl   = document.getElementById("count");
  const orderLabel = document.getElementById("orderLabel");
  const toastEl   = document.getElementById("toast");

  const STORAGE_KEY = "dragdrop.items.v1";

  /* ---------- Default items ---------- */
  const DEFAULTS = [
    "Design the landing page",
    "Write the project proposal",
    "Review pull requests",
    "Update the documentation",
    "Prepare the demo presentation",
    "Fix reported bugs",
  ];

  let items = [];          // array of { id, text }
  let dragEl = null;       // element currently being dragged
  let placeholder = null;  // gap element that follows the pointer

  /* ---------- Helpers ---------- */
  const uid = () => "i" + Math.random().toString(36).slice(2, 9);

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {
      /* storage may be unavailable — ignore */
    }
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_) {
      /* ignore */
    }
    return DEFAULTS.map((text) => ({ id: uid(), text }));
  };

  let toastTimer = null;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  };

  /* ---------- Build a single list item ---------- */
  const createItem = (item) => {
    const li = document.createElement("li");
    li.className = "item";
    li.draggable = true;
    li.dataset.id = item.id;

    li.innerHTML = `
      <span class="item__handle" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
          <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
          <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
        </svg>
      </span>
      <span class="item__index"></span>
      <span class="item__text"></span>
      <button class="item__remove" type="button" aria-label="Remove item" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    `;

    li.querySelector(".item__text").textContent = item.text;
    return li;
  };

  /* ---------- Render the whole list ---------- */
  const render = () => {
    list.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.innerHTML = "<span>🗒️</span>No items yet — add one above to get started.";
      list.appendChild(empty);
    } else {
      items.forEach((item) => list.appendChild(createItem(item)));
    }

    refreshIndexes();
    countEl.textContent = items.length;
  };

  /* ---------- Update the position badges ---------- */
  const refreshIndexes = () => {
    [...list.querySelectorAll(".item")].forEach((el, i) => {
      const badge = el.querySelector(".item__index");
      if (badge) badge.textContent = i + 1;
    });
  };

  /* ---------- Read the current DOM order back into `items` ---------- */
  const syncOrderFromDOM = () => {
    const ids = [...list.querySelectorAll(".item")].map((el) => el.dataset.id);
    items = ids
      .map((id) => items.find((it) => it.id === id))
      .filter(Boolean);
    save();
  };

  /* ---------- Add an item ---------- */
  const addItem = () => {
    const text = newItem.value.trim();
    if (!text) {
      newItem.focus();
      toast("Type something first ✍️");
      return;
    }
    items.push({ id: uid(), text });
    newItem.value = "";
    render();
    save();
    toast("Item added ✅");

    // Scroll the new item into view and flash it
    const last = list.querySelector(".item:last-child");
    if (last) {
      last.scrollIntoView({ behavior: "smooth", block: "nearest" });
      last.classList.add("just-dropped");
      setTimeout(() => last.classList.remove("just-dropped"), 420);
    }
  };

  /* ---------- Remove an item ---------- */
  const removeItem = (el) => {
    const id = el.dataset.id;
    items = items.filter((it) => it.id !== id);
    el.style.transition = "opacity .2s, transform .2s";
    el.style.opacity = "0";
    el.style.transform = "translateX(24px)";
    setTimeout(() => {
      render();
      save();
    }, 180);
    toast("Item removed 🗑️");
  };

  /* ============================================
     DRAG & DROP (native HTML5 DOM events)
     ============================================ */

  // --- dragstart: mark the dragged element ---
  list.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".item");
    if (!item) return;

    dragEl = item;
    item.classList.add("dragging");

    // Create the placeholder gap
    placeholder = document.createElement("li");
    placeholder.className = "placeholder";
    placeholder.style.height = item.offsetHeight + "px";

    // Required for Firefox to initiate the drag
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.id);
  });

  // --- dragover: move the placeholder to the hovered position ---
  list.addEventListener("dragover", (e) => {
    if (!dragEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const after = getDragAfterElement(list, e.clientY);

    if (after == null) {
      list.appendChild(placeholder);
    } else {
      list.insertBefore(placeholder, after);
    }
  });

  // --- drop: place the dragged element where the placeholder is ---
  list.addEventListener("drop", (e) => {
    if (!dragEl) return;
    e.preventDefault();

    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(dragEl, placeholder);
      placeholder.remove();
    }

    dragEl.classList.remove("dragging");
    dragEl.classList.add("just-dropped");
    setTimeout(() => dragEl && dragEl.classList.remove("just-dropped"), 420);

    dragEl = null;
    placeholder = null;

    refreshIndexes();
    syncOrderFromDOM();
    orderLabel.textContent = "Order updated ✓";
    toast("Order updated 🔀");
  });

  // --- dragend: clean up if the drop happened outside the list ---
  list.addEventListener("dragend", () => {
    if (placeholder && placeholder.parentNode) placeholder.remove();
    if (dragEl) dragEl.classList.remove("dragging");
    dragEl = null;
    placeholder = null;
    refreshIndexes();
    syncOrderFromDOM();
  });

  /* ---------- Find the element the pointer is above ---------- */
  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".item:not(.dragging)")];

    return els.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  /* ============================================
     TOUCH SUPPORT (pointer events for mobile)
     ============================================ */
  let touchEl = null;
  let touchGhost = null;
  let touchOffsetY = 0;

  list.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return; // mouse uses native DnD
    const item = e.target.closest(".item");
    if (!item || e.target.closest(".item__remove")) return;

    touchEl = item;
    const rect = item.getBoundingClientRect();
    touchOffsetY = e.clientY - rect.top;

    // Ghost that follows the finger
    touchGhost = item.cloneNode(true);
    touchGhost.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      pointer-events: none;
      z-index: 100;
      opacity: .92;
      transform: scale(1.02);
      box-shadow: 0 20px 40px rgba(0,0,0,.5);
    `;
    document.body.appendChild(touchGhost);

    item.classList.add("dragging");
    item.style.visibility = "hidden";

    placeholder = document.createElement("li");
    placeholder.className = "placeholder";
    placeholder.style.height = rect.height + "px";
    list.insertBefore(placeholder, item);

    item.setPointerCapture?.(e.pointerId);
  });

  list.addEventListener("pointermove", (e) => {
    if (!touchEl || e.pointerType === "mouse") return;
    e.preventDefault();

    if (touchGhost) {
      touchGhost.style.top = e.clientY - touchOffsetY + "px";
    }

    const after = getDragAfterElement(list, e.clientY);
    if (after == null) {
      list.appendChild(placeholder);
    } else {
      list.insertBefore(placeholder, after);
    }
  });

  const endTouch = () => {
    if (!touchEl) return;
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(touchEl, placeholder);
      placeholder.remove();
    }
    touchEl.classList.remove("dragging");
    touchEl.style.visibility = "";
    touchEl.classList.add("just-dropped");
    setTimeout(() => touchEl && touchEl.classList.remove("just-dropped"), 420);

    if (touchGhost) touchGhost.remove();
    touchGhost = null;
    touchEl = null;
    placeholder = null;

    refreshIndexes();
    syncOrderFromDOM();
    orderLabel.textContent = "Order updated ✓";
    toast("Order updated 🔀");
  };

  list.addEventListener("pointerup", endTouch);
  list.addEventListener("pointercancel", endTouch);

  /* ---------- Click handling (remove buttons) ---------- */
  list.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".item__remove");
    if (removeBtn) {
      removeItem(removeBtn.closest(".item"));
    }
  });

  /* ---------- Toolbar events ---------- */
  addBtn.addEventListener("click", addItem);
  newItem.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem();
  });

  resetBtn.addEventListener("click", () => {
    items = DEFAULTS.map((text) => ({ id: uid(), text }));
    render();
    save();
    orderLabel.textContent = "Order reset";
    toast("Order reset ↺");
  });

  /* ---------- Init ---------- */
  items = load();
  render();
});
