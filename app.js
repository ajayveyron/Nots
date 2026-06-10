const STORAGE_KEY = "jot:minimal-note:v1";
const LEGACY_KEY = "jot-local-notes:v1";
const SAVE_DELAY = 250;

const editor = document.querySelector("#editor");
let saveTimer = 0;

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}

function unwrapNode(node) {
  const parent = node.parentNode;
  if (!parent) return;

  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }
  parent.removeChild(node);
}

function sanitizeHtml(input) {
  const template = document.createElement("template");
  template.innerHTML = input;

  const allowedTags = new Set([
    "A",
    "B",
    "BLOCKQUOTE",
    "BR",
    "CODE",
    "DEL",
    "DIV",
    "EM",
    "H1",
    "H2",
    "H3",
    "I",
    "LI",
    "OL",
    "P",
    "PRE",
    "S",
    "SPAN",
    "STRIKE",
    "STRONG",
    "U",
    "UL",
  ]);
  const blockedTags = new Set(["EMBED", "IFRAME", "OBJECT", "SCRIPT", "STYLE"]);

  const nodes = [];
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (const node of nodes) {
    if (blockedTags.has(node.tagName)) {
      node.remove();
      continue;
    }

    if (!allowedTags.has(node.tagName)) {
      unwrapNode(node);
      continue;
    }

    for (const attr of Array.from(node.attributes)) {
      if (node.tagName === "A" && attr.name === "href") continue;
      node.removeAttribute(attr.name);
    }

    if (node.tagName === "A") {
      const href = normalizeUrl(node.getAttribute("href") || "");
      if (!href) {
        unwrapNode(node);
      } else {
        node.setAttribute("href", href);
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  }

  return template.innerHTML;
}

function legacyNoteHtml() {
  try {
    const notes = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    if (!Array.isArray(notes) || !notes.length) return "";

    return notes
      .map((note) => {
        const title = typeof note.title === "string" ? note.title.trim() : "";
        const content = typeof note.content === "string" ? note.content : "";
        return `${title ? `<p>${escapeHtml(title)}</p>` : ""}${content}`;
      })
      .filter(Boolean)
      .join("<p><br></p>");
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadNote() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = stored !== null ? stored : legacyNoteHtml();
  editor.innerHTML = sanitizeHtml(initial);
}

function saveNow() {
  try {
    localStorage.setItem(STORAGE_KEY, sanitizeHtml(editor.innerHTML));
  } catch {
    // A minimal writing surface should not show persistent UI for quota errors.
  }
}

function queueSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, SAVE_DELAY);
}

function focusEditor() {
  editor.focus({ preventScroll: true });
}

function runCommand(command, value = null) {
  document.execCommand(command, false, value);
  saveNow();
}

function promptForLink() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const href = normalizeUrl(window.prompt("Paste a link") || "");
  if (!href) return;

  runCommand("createLink", href);
  sanitizeLinks();
}

function sanitizeLinks() {
  editor.querySelectorAll("a").forEach((link) => {
    const href = normalizeUrl(link.getAttribute("href") || "");
    if (!href) {
      unwrapNode(link);
      return;
    }
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  saveNow();
}

function handlePaste(event) {
  event.preventDefault();

  const clipboard = event.clipboardData;
  const html = clipboard.getData("text/html");
  const text = clipboard.getData("text/plain");

  if (html) {
    document.execCommand("insertHTML", false, sanitizeHtml(html));
  } else {
    document.execCommand("insertText", false, text);
  }

  saveNow();
}

function handleKeydown(event) {
  const modifier = event.metaKey || event.ctrlKey;

  if (event.key === "Tab") {
    event.preventDefault();
    runCommand(event.shiftKey ? "outdent" : "indent");
    return;
  }

  if (modifier && event.key.toLowerCase() === "k") {
    event.preventDefault();
    promptForLink();
    return;
  }

  if (modifier && event.shiftKey && event.key.toLowerCase() === "x") {
    event.preventDefault();
    runCommand("strikeThrough");
    return;
  }

  if (modifier && event.shiftKey && event.key === "8") {
    event.preventDefault();
    runCommand("insertUnorderedList");
    return;
  }

  if (modifier && event.shiftKey && event.key === "7") {
    event.preventDefault();
    runCommand("insertOrderedList");
  }
}

function boot() {
  loadNote();
  focusEditor();
}

editor.addEventListener("input", queueSave);
editor.addEventListener("paste", handlePaste);
editor.addEventListener("keydown", handleKeydown);
editor.addEventListener("blur", saveNow);

document.addEventListener("click", (event) => {
  if (event.target === document.body || event.target.classList.contains("page")) {
    focusEditor();
  }
});

window.addEventListener("beforeunload", saveNow);

boot();
