/* Minimal UI shell for running the unchanged production rule engine without a game page. */
globalThis.installWorkshopEngineHarness = function (root) {
  function element() {
    return {
      className: '', classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
      style: {}, dataset: {}, children: [], value: '', textContent: '', innerHTML: '', disabled: false,
      appendChild(child) { this.children.push(child); return child; }, removeChild() {}, replaceChildren() {},
      addEventListener() {}, removeEventListener() {}, querySelector: element, querySelectorAll() { return []; }, closest() { return null; },
      setAttribute() {}, removeAttribute() {}, focus() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
    };
  }
  const elements = new Map();
  root.document = { body: element(), currentScript: null, writtenScripts: [], getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelector: element, querySelectorAll() { return []; }, createElement: element, write(value) { this.writtenScripts.push(String(value)); } };
  root.window = root;
  root.setTimeout = () => 0; root.clearTimeout = () => {}; root.requestAnimationFrame = () => 0; root.cancelAnimationFrame = () => {};
  root.confirm = () => true;
  if (!root.location) root.location = { search: '' };
  root.authClient = { loadUser() { return null; }, clearUser() {} };
};
