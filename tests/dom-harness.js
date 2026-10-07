/* ==========================================================================
   tests/dom-harness.js —— 极简 DOM 桩
   用途：在 Node 中加载并执行浏览器脚本（UMD 会自动挂到 globalThis/window），
         从而在没有浏览器的环境下验证「页面初始化 → 渲染出卡片」这条链路。

   刻意只实现被测代码真正用到的那部分 DOM：
     getElementById / innerHTML / addEventListener / documentElement
   —— 这是单元测试的常见取舍：桩越小，测试越不容易因为桩的行为而与真实实现偏离。
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** 创建一个最小可用的元素对象。 */
function createElement(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    className: '',
    style: {},
    dataset: {},
    scrollTop: 0,
    children: [],
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, on) { on ? this._set.add(c) : this._set.delete(c); }
    },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      return child;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    matches() { return false; },
    closest() { return null; },
    focus() {},
    select() {}
  };
}

/**
 * 建立沙箱上下文并依次执行脚本。
 * @param {string[]} files 相对项目根目录的脚本路径，按依赖顺序给出
 * @returns {{global: object, elements: Map<string, object>, window: object}}
 */
function createHarness(files) {
  const root = path.resolve(__dirname, '..');
  const elements = new Map();

  const document = {
    body: createElement('body'),
    documentElement: createElement('html'),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return createElement(tag); },
    addEventListener() {},
    removeEventListener() {},
    execCommand() { return true; }
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    isNaN,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent
  };

  sandbox.document = document;
  sandbox.navigator = { clipboard: null, userAgent: 'node-harness' };
  sandbox.location = { search: '', href: 'file:///index.html', hash: '' };
  sandbox.history = { length: 1, back() {} };
  sandbox.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  // 不提供 localStorage：模拟 file:// 下存储不可用的场景，
  // 这样测试同时验证了「退化为内存态」的分支。
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  files.forEach((file) => {
    const full = path.join(root, file);
    const code = fs.readFileSync(full, 'utf8');
    vm.runInContext(code, sandbox, { filename: full });
  });

  return { global: sandbox, elements, document, window: sandbox };
}

module.exports = { createHarness, createElement };
