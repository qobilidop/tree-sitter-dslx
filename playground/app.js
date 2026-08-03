// SPDX-License-Identifier: Apache-2.0

import { Language, Parser, Query } from "./web-tree-sitter.js";

const BROKEN_SUFFIX = "\nfn broken(x: u32 {\n  x\n}\n";
const MAX_TREE_ROWS = 3000;

const elements = {
  changedRanges: document.querySelector("#changed-ranges"),
  copyTree: document.querySelector("#copy-tree"),
  cursorPosition: document.querySelector("#cursor-position"),
  editor: document.querySelector("#source-editor"),
  errorCount: document.querySelector("#error-count"),
  errorToggle: document.querySelector("#error-toggle"),
  exampleDescription: document.querySelector("#example-description"),
  exampleSelect: document.querySelector("#example-select"),
  highlight: document.querySelector("#highlight-layer code"),
  highlightScroller: document.querySelector("#highlight-layer"),
  nodeCount: document.querySelector("#node-count"),
  parseDuration: document.querySelector("#parse-duration"),
  parserStatus: document.querySelector("#parser-status"),
  treeView: document.querySelector("#tree-view"),
};

let parser;
let highlightsQuery;
let examples;
let tree = null;
let source = "";
let scheduled = false;
let selectedTreeRow = null;
let treeRowsByKey = new Map();

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pointAt(text, index) {
  const prefix = text.slice(0, index);
  const row = (prefix.match(/\n/g) ?? []).length;
  const newline = prefix.lastIndexOf("\n");
  return { row, column: index - newline - 1 };
}

function smallestEdit(before, after) {
  let startIndex = 0;
  const commonLength = Math.min(before.length, after.length);
  while (
    startIndex < commonLength &&
    before[startIndex] === after[startIndex]
  ) {
    startIndex += 1;
  }

  let oldSuffix = before.length;
  let newSuffix = after.length;
  while (
    oldSuffix > startIndex &&
    newSuffix > startIndex &&
    before[oldSuffix - 1] === after[newSuffix - 1]
  ) {
    oldSuffix -= 1;
    newSuffix -= 1;
  }

  return {
    startIndex,
    oldEndIndex: oldSuffix,
    newEndIndex: newSuffix,
    startPosition: pointAt(before, startIndex),
    oldEndPosition: pointAt(before, oldSuffix),
    newEndPosition: pointAt(after, newSuffix),
  };
}

function collectRecoveryNodes(root) {
  const recoveries = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.isError || node.isMissing) recoveries.push(node);
    for (let index = node.childCount - 1; index >= 0; index -= 1) {
      const child = node.child(index);
      if (child !== null) pending.push(child);
    }
  }
  return recoveries;
}

function renderHighlights(text, root, recoveries) {
  const styles = new Array(text.length).fill("");
  for (const capture of highlightsQuery.captures(root)) {
    const className = `hl-${capture.name.replaceAll(".", "-")}`;
    for (
      let index = capture.node.startIndex;
      index < capture.node.endIndex;
      index += 1
    ) {
      styles[index] = className;
    }
  }
  for (const node of recoveries) {
    const end = Math.max(node.endIndex, node.startIndex + 1);
    for (
      let index = node.startIndex;
      index < Math.min(end, text.length);
      index += 1
    ) {
      styles[index] = "hl-error";
    }
  }

  let html = "";
  let start = 0;
  while (start < text.length) {
    const style = styles[start];
    let end = start + 1;
    while (end < text.length && styles[end] === style) end += 1;
    const escaped = escapeHtml(text.slice(start, end));
    html += style === "" ? escaped : `<span class="${style}">${escaped}</span>`;
    start = end;
  }
  elements.highlight.innerHTML = `${html}\n`;
}

function nodeKey(node) {
  return `${node.type}:${node.startIndex}:${node.endIndex}`;
}

function renderTree(root) {
  const fragment = document.createDocumentFragment();
  const stack = [{ node: root, depth: 0, field: null }];
  treeRowsByKey = new Map();
  let rendered = 0;

  while (stack.length > 0 && rendered < MAX_TREE_ROWS) {
    const { node, depth, field } = stack.pop();
    const row = document.createElement("button");
    row.type = "button";
    row.className = `tree-row${node.isError || node.isMissing ? " error" : ""}`;
    row.style.setProperty("--depth", depth);
    row.dataset.start = node.startIndex;
    row.dataset.end = node.endIndex;
    const start = node.startPosition;
    const end = node.endPosition;
    row.innerHTML = `${
      field === null
        ? ""
        : `<span class="tree-field">${escapeHtml(field)}: </span>`
    }${escapeHtml(node.isMissing ? `MISSING ${node.type}` : node.type)} <span class="tree-range">${
      start.row + 1
    }:${start.column + 1}–${end.row + 1}:${end.column + 1}</span>`;
    row.addEventListener("click", () => {
      elements.editor.focus();
      elements.editor.setSelectionRange(node.startIndex, node.endIndex);
      selectTreeRow(row);
      updateCursorPosition();
    });
    fragment.append(row);
    treeRowsByKey.set(nodeKey(node), row);
    rendered += 1;

    for (let index = node.childCount - 1; index >= 0; index -= 1) {
      const child = node.child(index);
      if (
        child === null ||
        (!child.isNamed && !child.isError && !child.isMissing)
      ) {
        continue;
      }
      stack.push({
        node: child,
        depth: depth + 1,
        field: node.fieldNameForChild(index),
      });
    }
  }

  if (stack.length > 0) {
    const truncated = document.createElement("p");
    truncated.className = "tree-placeholder";
    truncated.textContent = `Tree view limited to ${MAX_TREE_ROWS.toLocaleString()} rows.`;
    fragment.append(truncated);
  }
  elements.treeView.replaceChildren(fragment);
  return rendered;
}

function selectTreeRow(row) {
  selectedTreeRow?.classList.remove("selected");
  selectedTreeRow = row;
  selectedTreeRow?.classList.add("selected");
  selectedTreeRow?.scrollIntoView({ block: "nearest" });
}

function syncSelectionToTree() {
  if (tree === null || source.length === 0) return;
  const start = Math.min(elements.editor.selectionStart, source.length - 1);
  const end = Math.max(
    start,
    Math.min(elements.editor.selectionEnd, source.length),
  );
  const node = tree.rootNode.namedDescendantForIndex(start, end);
  if (node !== null) selectTreeRow(treeRowsByKey.get(nodeKey(node)) ?? null);
}

function updateCursorPosition() {
  const point = pointAt(elements.editor.value, elements.editor.selectionStart);
  elements.cursorPosition.textContent = `Ln ${point.row + 1}, Col ${point.column + 1}`;
  syncSelectionToTree();
}

function parseEditor() {
  scheduled = false;
  const nextSource = elements.editor.value;
  const started = performance.now();
  let nextTree;
  let changedRanges = [];

  if (tree === null) {
    nextTree = parser.parse(nextSource);
  } else {
    tree.edit(smallestEdit(source, nextSource));
    nextTree = parser.parse(nextSource, tree);
    changedRanges = tree.getChangedRanges(nextTree);
    tree.delete();
  }
  tree = nextTree;
  source = nextSource;
  const duration = performance.now() - started;
  const recoveries = collectRecoveryNodes(tree.rootNode);

  renderHighlights(source, tree.rootNode, recoveries);
  const renderedNodes = renderTree(tree.rootNode);
  updateCursorPosition();
  elements.parseDuration.textContent = `${duration.toFixed(2)} ms`;
  elements.changedRanges.textContent = changedRanges.length.toLocaleString();
  elements.changedRanges.title = changedRanges
    .map(
      (range) =>
        `${range.startPosition.row + 1}:${range.startPosition.column + 1}`,
    )
    .join(", ");
  elements.errorCount.textContent = recoveries.length.toLocaleString();
  elements.nodeCount.textContent = renderedNodes.toLocaleString();
  elements.parserStatus.innerHTML = recoveries.length
    ? '<span class="scope-dot"></span> Recovering'
    : '<span class="scope-dot"></span> Ready';
  elements.errorToggle.textContent = source.endsWith(BROKEN_SUFFIX)
    ? "Repair the error"
    : "Introduce an error";
}

function scheduleParse() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(parseEditor);
}

function loadExample(index) {
  const example = examples[index];
  elements.exampleDescription.textContent = example.description;
  elements.editor.value = example.source;
  elements.editor.scrollTop = 0;
  elements.editor.scrollLeft = 0;
  scheduleParse();
}

function syncScroll() {
  elements.highlightScroller.scrollTop = elements.editor.scrollTop;
  elements.highlightScroller.scrollLeft = elements.editor.scrollLeft;
}

async function initialize() {
  try {
    const base = new URL("./", import.meta.url);
    const [, examplesResponse, queryResponse] = await Promise.all([
      Parser.init({ locateFile: (name) => new URL(name, base).href }),
      fetch(new URL("examples.json", base)),
      fetch(new URL("highlights.scm", base)),
    ]);
    if (!examplesResponse.ok || !queryResponse.ok) {
      throw new Error("Could not load playground data");
    }
    examples = await examplesResponse.json();
    const language = await Language.load(
      new URL("tree-sitter-dslx.wasm", base).href,
    );
    parser = new Parser();
    parser.setLanguage(language);
    highlightsQuery = new Query(language, await queryResponse.text());

    for (const [index, example] of examples.entries()) {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = example.label;
      elements.exampleSelect.append(option);
    }

    elements.exampleSelect.disabled = false;
    elements.editor.disabled = false;
    elements.errorToggle.disabled = false;
    elements.copyTree.disabled = false;
    loadExample(0);
  } catch (error) {
    console.error(error);
    elements.parserStatus.textContent = "Initialization failed";
    elements.treeView.innerHTML =
      '<p class="tree-placeholder">The Wasm parser could not load. Serve the built <code>dist/</code> directory over HTTP instead of opening it as a local file.</p>';
  }
}

elements.editor.addEventListener("input", scheduleParse);
elements.editor.addEventListener("scroll", syncScroll);
elements.editor.addEventListener("select", updateCursorPosition);
elements.editor.addEventListener("keyup", updateCursorPosition);
elements.editor.addEventListener("click", updateCursorPosition);
elements.exampleSelect.addEventListener("change", (event) => {
  loadExample(Number.parseInt(event.target.value, 10));
});
elements.errorToggle.addEventListener("click", () => {
  const broken = elements.editor.value.endsWith(BROKEN_SUFFIX);
  elements.editor.value = broken
    ? elements.editor.value.slice(0, -BROKEN_SUFFIX.length)
    : `${elements.editor.value}${BROKEN_SUFFIX}`;
  scheduleParse();
});
elements.copyTree.addEventListener("click", async () => {
  if (tree === null) return;
  await navigator.clipboard.writeText(tree.rootNode.toString());
  const label = elements.copyTree.textContent;
  elements.copyTree.textContent = "Copied";
  setTimeout(() => {
    elements.copyTree.textContent = label;
  }, 1200);
});

initialize();
