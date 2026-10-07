/* ==========================================================================
   js/components/icons.js —— 图标库
   全部沿用原型的 24x24 线性描边风格，内联 SVG 便于继承 currentColor。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.icons = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** 原始路径数据，仅存放 <svg> 内部内容。 */
  var PATHS = {
    /* --- 导航与操作 --- */
    back: '<path d="M14.4 5.4 7.8 12l6.6 6.6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9.6 12 15.6l6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.2 16.2 20.8 20.8"/>',
    close: '<path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/>',
    plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
    edit: '<path d="M4.6 19.4h4l10-10a2.05 2.05 0 0 0-2.9-2.9l-10 10z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="m8.4 12.2 2.4 2.4 4.8-4.8"/>',

    /* --- 首页 --- */
    home: '<path d="M3 11 12 4l9 7v8a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-6v6H4.5A1.5 1.5 0 0 1 3 19z"/>',
    user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M5 20c.9-3.4 3.6-5.2 7-5.2s6.1 1.8 7 5.2"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    location: '<path d="M12 21s6-5.5 6-10a6 6 0 0 0-12 0c0 4.5 6 10 6 10z"/><circle cx="12" cy="11" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3.1 1.9"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>',

    /* --- 分类图标 --- */
    gift: '<path d="M20 12V8a2 2 0 0 0-2-2h-3V4a3 3 0 1 0-6 0v2H6a2 2 0 0 0-2 2v4"/><path d="M4 12h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><circle cx="8" cy="15" r="1.5"/><path d="M12.5 14.5h5.5"/>',
    headphone: '<path d="M4.5 14.2c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6v3.8H4.5z"/><path d="M4.5 14.2a7.5 7.5 0 0 1-.5-3"/><path d="M17.5 14.2a7.5 7.5 0 0 0 .5-3"/><rect x="3.5" y="15.5" width="2.5" height="5" rx="1"/><rect x="18" y="15.5" width="2.5" height="5" rx="1"/>',
    umbrella: '<path d="M12 3.6c4.7 0 8.4 3.6 8.4 8H3.6c0-4.4 3.7-8 8.4-8z"/><path d="M12 11.6v6.2a2.4 2.4 0 0 0 4.8 0"/>',
    key: '<circle cx="8.5" cy="8.5" r="3.5"/><path d="M11 11 21 21M15 15l3 3"/>',
    book: '<path d="M5 5.5A1.8 1.8 0 0 1 6.8 3.7H19v14H6.8A1.8 1.8 0 0 0 5 19.5z"/><path d="M5 19.5a1.8 1.8 0 0 1 1.8-1.8H19v3H6.8A1.8 1.8 0 0 1 5 19.5z"/>',
    bottle: '<path d="M6.6 7h8.8v9.4a3 3 0 0 1-3 3h-2.8a3 3 0 0 1-3-3z"/><path d="M6.6 7V5.7A1.7 1.7 0 0 1 8.3 4h5.4a1.7 1.7 0 0 1 1.7 1.7V7"/><path d="M15.4 9.6h1.6a2 2 0 0 1 0 4h-1.6"/>',
    phone: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M12 18h.01"/>',
    box: '<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 15H4.8A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    emptySearch: '<circle cx="11" cy="11" r="7"/><path d="M16.2 16.2 20.8 20.8M8.5 11h5"/>',
    alert: '<path d="M12 3.6 5.4 6.4v5.1c0 4 2.8 7.4 6.6 8.9 3.8-1.5 6.6-4.9 6.6-8.9V6.4z"/><path d="M12 8v5M12 16h.01"/>',
    star: '<path d="M12 4.4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.8l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>'
  };

  /**
   * 生成图标 SVG。
   * @param {string} name  PATHS 中的键名
   * @param {object} [opts] { size, cls, stroke }
   * @returns {string} SVG 字符串
   */
  function icon(name, opts) {
    var options = opts || {};
    var body = PATHS[name];
    if (!body) return '';
    var size = options.size == null ? 24 : options.size;
    var cls = 'ic' + (options.cls ? ' ' + options.cls : '');
    var stroke = options.stroke ? ' stroke-width="' + options.stroke + '"' : '';
    return '<svg class="' + cls + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' +
      ' aria-hidden="true" focusable="false"' + stroke + '>' + body + '</svg>';
  }

  function has(name) {
    return Object.prototype.hasOwnProperty.call(PATHS, name);
  }

  return { PATHS: PATHS, icon: icon, has: has };
});
