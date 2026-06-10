const STORAGE_KEY = "jot:minimal-note:v1";
const LEGACY_KEY = "jot-local-notes:v1";
const SAVE_DELAY = 250;

const editor = document.querySelector("#editor");
let saveTimer = 0;
let isApplying = false;

const BLOCK_TAGS = new Set(["BLOCKQUOTE", "DIV", "H1", "H2", "H3", "LI", "P", "PRE"]);
const TOP_LEVEL_TAGS = new Set(["BLOCKQUOTE", "DIV", "H1", "H2", "H3", "OL", "P", "PRE", "UL"]);

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

function normalizeEditorRoot() {
  const fragment = document.createDocumentFragment();
  let line = null;

  function flushLine() {
    if (!line) return;
    if (!line.childNodes.length) {
      line.append(document.createElement("br"));
    }
    fragment.append(line);
    line = null;
  }

  Array.from(editor.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) {
      return;
    }

    const isTopLevelElement =
      child.nodeType === Node.ELEMENT_NODE && TOP_LEVEL_TAGS.has(child.tagName);

    if (isTopLevelElement) {
      flushLine();
      fragment.append(child);
      return;
    }

    if (!line) {
      line = document.createElement("div");
    }
    line.append(child);
  });

  flushLine();

  editor.innerHTML = "";
  editor.append(fragment);

  if (!editor.childNodes.length) {
    const emptyLine = document.createElement("div");
    emptyLine.append(document.createElement("br"));
    editor.append(emptyLine);
  }
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
  normalizeEditorRoot();
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

function selectionRange() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) {
    return null;
  }

  return selection.getRangeAt(0);
}

function currentLineElement() {
  const range = selectionRange();
  if (!range) return null;

  let element =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;

  while (element && element !== editor) {
    if (BLOCK_TAGS.has(element.tagName)) {
      return element;
    }
    element = element.parentElement;
  }

  return null;
}

function setCaretAtStart(element) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setCaretAfter(node) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function textOffsetWithin(element) {
  const range = selectionRange();
  if (!range) return 0;

  const clone = range.cloneRange();
  clone.selectNodeContents(element);
  clone.setEnd(range.startContainer, range.startOffset);
  return clone.toString().length;
}

function setCaretByTextOffset(element, offset) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node = walker.nextNode();

  while (node) {
    const nextOffset = currentOffset + node.textContent.length;
    if (offset <= nextOffset) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(node, Math.max(0, offset - currentOffset));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    currentOffset = nextOffset;
    node = walker.nextNode();
  }

  setCaretAtStart(element);
}

function createEmptyBlock(tagName) {
  const block = document.createElement(tagName);
  block.append(document.createElement("br"));
  return block;
}

function replaceLineWithElement(line, element, caretElement = element) {
  line.replaceWith(element);
  setCaretAtStart(caretElement);
  saveNow();
}

function convertLineToList(line, tagName) {
  const list = document.createElement(tagName);
  const item = createEmptyBlock("li");
  list.append(item);
  replaceLineWithElement(line, list, item);
}

function applyBlockMarkdown() {
  const line = currentLineElement();
  if (!line || line.tagName === "LI") return false;

  const text = line.textContent;

  if (text === "- " || text === "* ") {
    convertLineToList(line, "ul");
    return true;
  }

  if (/^\d+\. $/.test(text)) {
    convertLineToList(line, "ol");
    return true;
  }

  const heading = text.match(/^(#{1,3}) $/);
  if (heading) {
    replaceLineWithElement(line, createEmptyBlock(`h${heading[1].length}`));
    return true;
  }

  if (text === "> ") {
    replaceLineWithElement(line, createEmptyBlock("blockquote"));
    return true;
  }

  return false;
}

function textNodeBeforeCaret(range) {
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    return {
      node: range.startContainer,
      offset: range.startOffset,
    };
  }

  if (range.startOffset === 0) return null;

  let node = range.startContainer.childNodes[range.startOffset - 1];
  while (node && node.lastChild) {
    node = node.lastChild;
  }

  if (node && node.nodeType === Node.TEXT_NODE) {
    return {
      node,
      offset: node.textContent.length,
    };
  }

  return null;
}

function markdownMatch(beforeCaret) {
  const patterns = [
    {
      regex: /\[([^\]\n]+)\]\(([^)\s]+)\)$/,
      create(match) {
        const href = normalizeUrl(match[2]);
        if (!href) return null;
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = match[1];
        return link;
      },
    },
    {
      regex: /`([^`\n]+)`$/,
      create(match) {
        const code = document.createElement("code");
        code.textContent = match[1];
        return code;
      },
    },
    {
      regex: /\*\*([^*\n]+)\*\*$/,
      create(match) {
        const strong = document.createElement("strong");
        strong.textContent = match[1];
        return strong;
      },
    },
    {
      regex: /__([^_\n]+)__$/,
      create(match) {
        const strong = document.createElement("strong");
        strong.textContent = match[1];
        return strong;
      },
    },
    {
      regex: /\+\+([^+\n]+)\+\+$/,
      create(match) {
        const underline = document.createElement("u");
        underline.textContent = match[1];
        return underline;
      },
    },
    {
      regex: /~~([^~\n]+)~~$/,
      create(match) {
        const strike = document.createElement("s");
        strike.textContent = match[1];
        return strike;
      },
    },
    {
      regex: /(^|[^*])\*([^*\n]+)\*$/,
      leadingChars: (match) => match[1].length,
      create(match) {
        const italic = document.createElement("em");
        italic.textContent = match[2];
        return italic;
      },
    },
    {
      regex: /(^|[^_])_([^_\n]+)_$/,
      leadingChars: (match) => match[1].length,
      create(match) {
        const italic = document.createElement("em");
        italic.textContent = match[2];
        return italic;
      },
    },
  ];

  for (const pattern of patterns) {
    const match = beforeCaret.match(pattern.regex);
    if (!match) continue;

    const element = pattern.create(match);
    if (!element) continue;

    const leadingChars =
      typeof pattern.leadingChars === "function"
        ? pattern.leadingChars(match)
        : pattern.leadingChars || 0;
    return {
      element,
      length: match[0].length - leadingChars,
    };
  }

  return null;
}

function applyInlineMarkdown() {
  const range = selectionRange();
  if (!range || !range.collapsed) return false;

  const textPosition = textNodeBeforeCaret(range);
  if (!textPosition) return false;

  const beforeCaret = textPosition.node.textContent.slice(0, textPosition.offset);
  const match = markdownMatch(beforeCaret);
  if (!match) return false;

  const node = textPosition.node;
  const parent = node.parentNode;
  const start = textPosition.offset - match.length;
  const before = node.textContent.slice(0, start);
  const after = node.textContent.slice(textPosition.offset);

  if (before) {
    parent.insertBefore(document.createTextNode(before), node);
  }
  parent.insertBefore(match.element, node);
  if (after) {
    parent.insertBefore(document.createTextNode(after), node);
  }
  parent.removeChild(node);
  setCaretAfter(match.element);
  saveNow();
  return true;
}

function applyMarkdown() {
  if (isApplying) return;

  isApplying = true;
  try {
    if (!applyBlockMarkdown()) {
      applyInlineMarkdown();
    }
  } finally {
    isApplying = false;
  }
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

  normalizeEditorRoot();
  saveNow();
}

function moveLine(direction) {
  const line = currentLineElement();
  if (!line || line === editor) return false;

  const sibling = direction < 0 ? line.previousElementSibling : line.nextElementSibling;
  if (!sibling) return true;

  const offset = textOffsetWithin(line);
  if (direction < 0) {
    line.parentNode.insertBefore(line, sibling);
  } else {
    line.parentNode.insertBefore(line, sibling.nextSibling);
  }
  setCaretByTextOffset(line, offset);
  saveNow();
  return true;
}

function duplicateLine(direction) {
  const line = currentLineElement();
  if (!line || line === editor) return false;

  const offset = textOffsetWithin(line);
  const clone = line.cloneNode(true);

  if (direction < 0) {
    line.parentNode.insertBefore(clone, line);
  } else {
    line.parentNode.insertBefore(clone, line.nextSibling);
  }

  setCaretByTextOffset(clone, offset);
  saveNow();
  return true;
}

function handleKeydown(event) {
  const modifier = event.metaKey || event.ctrlKey;
  const movingUp = event.altKey && event.key === "ArrowUp";
  const movingDown = event.altKey && event.key === "ArrowDown";

  if ((movingUp || movingDown) && !modifier) {
    event.preventDefault();
    const direction = movingUp ? -1 : 1;
    if (event.shiftKey) {
      duplicateLine(direction);
    } else {
      moveLine(direction);
    }
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    runCommand(event.shiftKey ? "outdent" : "indent");
    return;
  }

  if (event.key === "Enter" && currentLineElement()?.tagName === "LI") {
    window.setTimeout(() => {
      normalizeEditorRoot();
      saveNow();
    });
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

editor.addEventListener("input", () => {
  if (!isApplying) {
    applyMarkdown();
  }
  queueSave();
});
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
