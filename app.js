const STORAGE_KEY = "jot-local-notes:v1";
const SELECTED_KEY = "jot-local-notes:selected";
const SAVE_DELAY = 320;

const notesList = document.querySelector("#notes-list");
const noteSearch = document.querySelector("#note-search");
const newNoteButton = document.querySelector("#new-note");
const deleteNoteButton = document.querySelector("#delete-note");
const noteTitle = document.querySelector("#note-title");
const editor = document.querySelector("#editor");
const saveStatus = document.querySelector("#save-status");
const linkButton = document.querySelector("#link-button");
const linkPanel = document.querySelector("#link-panel");
const linkUrl = document.querySelector("#link-url");
const unlinkButton = document.querySelector("#unlink-button");
const toolButtons = Array.from(document.querySelectorAll("[data-command]"));

const state = {
  notes: [],
  selectedId: null,
  saveTimer: 0,
  isHydrating: false,
  lastSelection: null,
};

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createNote(title = "") {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title,
    content: "",
    createdAt: now,
    updatedAt: now,
  };
}

function seedNotes() {
  const firstNote = createNote("");
  state.notes = [firstNote];
  state.selectedId = firstNote.id;
  persistNow("Stored locally");
}

function readStoredNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((note) => note && typeof note.id === "string")
      .map((note) => ({
        id: note.id,
        title: typeof note.title === "string" ? note.title : "",
        content: sanitizeHtml(typeof note.content === "string" ? note.content : ""),
        createdAt: note.createdAt || new Date().toISOString(),
        updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function persistNow(status = "Saved") {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
    if (state.selectedId) {
      localStorage.setItem(SELECTED_KEY, state.selectedId);
    }
    saveStatus.textContent = status;
  } catch {
    saveStatus.textContent = "Storage full";
  }
}

function queuePersist() {
  saveStatus.textContent = "Saving...";
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => persistNow("Saved"), SAVE_DELAY);
}

function currentNote() {
  return state.notes.find((note) => note.id === state.selectedId) || state.notes[0] || null;
}

function updateCurrentNote(patch) {
  const note = currentNote();
  if (!note) return;

  Object.assign(note, patch, { updatedAt: new Date().toISOString() });
  queuePersist();
  renderNotes();
}

function noteLabel(note) {
  const title = note.title.trim();
  if (title) return title;

  const text = htmlToText(note.content).trim();
  return text || "Untitled";
}

function htmlToText(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeHtml(html);
  return (template.content.textContent || "").replace(/\s+/g, " ");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function renderNotes() {
  const search = noteSearch.value.trim().toLowerCase();
  const sorted = [...state.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const matches = sorted.filter((note) => {
    if (!search) return true;
    return `${noteLabel(note)} ${htmlToText(note.content)}`.toLowerCase().includes(search);
  });

  notesList.innerHTML = "";

  for (const note of matches) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `note-item${note.id === state.selectedId ? " active" : ""}`;
    item.dataset.noteId = note.id;
    item.setAttribute("role", "listitem");

    const title = document.createElement("div");
    title.className = "note-title";
    title.textContent = noteLabel(note);

    const preview = document.createElement("div");
    preview.className = "note-preview";
    preview.textContent = htmlToText(note.content) || "No text yet";

    const date = document.createElement("div");
    date.className = "note-date";
    date.textContent = formatDate(note.updatedAt);

    item.append(title, preview, date);
    notesList.append(item);
  }
}

function hydrateEditor() {
  const note = currentNote();
  if (!note) return;

  state.isHydrating = true;
  noteTitle.value = note.title;
  editor.innerHTML = sanitizeHtml(note.content);
  document.title = noteLabel(note);
  state.isHydrating = false;
  updateToolbarState();
}

function selectNote(id) {
  if (!state.notes.some((note) => note.id === id)) return;

  flushPendingSave();
  state.selectedId = id;
  localStorage.setItem(SELECTED_KEY, id);
  closeLinkPanel();
  hydrateEditor();
  renderNotes();
}

function addNote() {
  flushPendingSave();
  const note = createNote("");
  state.notes.unshift(note);
  state.selectedId = note.id;
  persistNow("Saved");
  closeLinkPanel();
  hydrateEditor();
  renderNotes();
  noteTitle.focus();
}

function deleteCurrentNote() {
  const note = currentNote();
  if (!note) return;

  const label = noteLabel(note);
  const ok = window.confirm(`Delete "${label}"?`);
  if (!ok) return;

  state.notes = state.notes.filter((item) => item.id !== note.id);
  if (!state.notes.length) {
    state.notes = [createNote("")];
  }

  state.selectedId = state.notes[0].id;
  persistNow("Saved");
  closeLinkPanel();
  hydrateEditor();
  renderNotes();
}

function flushPendingSave() {
  if (!state.saveTimer) return;

  window.clearTimeout(state.saveTimer);
  state.saveTimer = 0;
  persistNow("Saved");
}

function saveSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    state.lastSelection = range.cloneRange();
  }
}

function restoreSelection() {
  if (!state.lastSelection) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(state.lastSelection);
}

function focusEditor() {
  editor.focus({ preventScroll: true });
}

function execute(command, value = null) {
  restoreSelection();
  focusEditor();
  document.execCommand(command, false, value);
  saveSelection();
  updateCurrentNote({ content: editor.innerHTML });
  updateToolbarState();
}

function updateToolbarState() {
  for (const button of toolButtons) {
    const command = button.dataset.command;
    button.classList.toggle("active", document.queryCommandState(command));
  }
}

function openLinkPanel() {
  saveSelection();
  linkPanel.hidden = false;
  linkUrl.value = selectedLinkHref();
  linkUrl.focus();
}

function closeLinkPanel() {
  linkPanel.hidden = true;
  linkUrl.value = "";
}

function selectedLinkHref() {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode) return "";

  const node =
    selection.anchorNode.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection.anchorNode.parentElement;
  const link = node ? node.closest("a") : null;
  return link ? link.href : "";
}

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

function applyLink(event) {
  event.preventDefault();
  const href = normalizeUrl(linkUrl.value);
  if (!href) {
    linkUrl.focus();
    return;
  }

  execute("createLink", href);
  sanitizeEditorLinks();
  closeLinkPanel();
}

function removeLink() {
  execute("unlink");
  closeLinkPanel();
}

function sanitizeEditorLinks() {
  editor.querySelectorAll("a").forEach((link) => {
    const href = normalizeUrl(link.getAttribute("href") || "");
    if (!href) {
      link.removeAttribute("href");
      return;
    }
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  updateCurrentNote({ content: editor.innerHTML });
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

function unwrapNode(node) {
  const parent = node.parentNode;
  if (!parent) return;

  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }
  parent.removeChild(node);
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

  updateCurrentNote({ content: editor.innerHTML });
}

function boot() {
  state.notes = readStoredNotes();
  if (!state.notes.length) {
    seedNotes();
  }

  const storedSelected = localStorage.getItem(SELECTED_KEY);
  state.selectedId = state.notes.some((note) => note.id === storedSelected)
    ? storedSelected
    : state.notes[0].id;

  hydrateEditor();
  renderNotes();
}

notesList.addEventListener("click", (event) => {
  const item = event.target.closest(".note-item");
  if (!item) return;
  selectNote(item.dataset.noteId);
});

noteSearch.addEventListener("input", renderNotes);
newNoteButton.addEventListener("click", addNote);
deleteNoteButton.addEventListener("click", deleteCurrentNote);

noteTitle.addEventListener("input", () => {
  if (state.isHydrating) return;
  updateCurrentNote({ title: noteTitle.value });
  document.title = noteTitle.value.trim() || "Jot Local Notes";
});

editor.addEventListener("input", () => {
  if (state.isHydrating) return;
  saveSelection();
  updateCurrentNote({ content: editor.innerHTML });
});

editor.addEventListener("keyup", () => {
  saveSelection();
  updateToolbarState();
});

editor.addEventListener("mouseup", () => {
  saveSelection();
  updateToolbarState();
});

editor.addEventListener("paste", handlePaste);

toolButtons.forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => execute(button.dataset.command));
});

linkButton.addEventListener("mousedown", (event) => event.preventDefault());
linkButton.addEventListener("click", openLinkPanel);
linkPanel.addEventListener("submit", applyLink);
unlinkButton.addEventListener("click", removeLink);

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode) return;
  if (editor.contains(selection.anchorNode)) {
    saveSelection();
    updateToolbarState();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLinkPanel();
});

window.addEventListener("beforeunload", flushPendingSave);

boot();
