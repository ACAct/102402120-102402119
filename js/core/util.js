/* ==========================================================================
   js/core/util.js —— 无依赖通用工具
   浏览器：以 <script> 引入后挂在 window.LF.util
   Node   ：可直接 require()，用于单元测试
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;            // Node / 单元测试
  } else {
    root.LF = root.LF || {};
    root.LF.util = api;              // 浏览器全局
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- 文本 */

  /**
   * 全角转半角。
   * 中文输入法下用户很容易打出全角字母/数字/空格与全角标点，
   * 不转换会导致「ＡｉｒＰｏｄｓ」搜不到「AirPods」。
   */
  function toHalfWidth(input) {
    var str = String(input == null ? '' : input);
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code === 0x3000) {                 // 全角空格
        out += ' ';
      } else if (code >= 0xFF01 && code <= 0xFF5E) { // 全角 ASCII 可见字符
        out += String.fromCharCode(code - 0xFEE0);
      } else {
        out += str.charAt(i);
      }
    }
    return out;
  }

  /**
   * 搜索用归一化：全角转半角 → 小写 → 折叠空白 → 去首尾空格。
   * 不做中文分词：中文以子串匹配更符合直觉（「校园卡」应能命中「黑色校园卡」）。
   */
  function normalize(input) {
    return toHalfWidth(input).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** 转义 HTML，防止用户填写的标题/描述破坏页面结构（XSS 与样式错乱）。 */
  function escapeHtml(input) {
    return String(input == null ? '' : input).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /** 转义正则元字符，使关键词按纯文本匹配，而不是被当成正则语法。 */
  function escapeRegExp(input) {
    return String(input == null ? '' : input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 按「空白」切分关键词。
   * 「黑色 校园卡」→ ['黑色', '校园卡']，用于多关键词 AND 匹配。
   */
  function tokenize(input) {
    var normalized = normalize(input);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
  }

  /** 按显示宽度截断（中文按 2 计），用于卡片标题等定宽场景。 */
  function truncate(input, maxWidth, suffix) {
    var str = String(input == null ? '' : input);
    var tail = suffix == null ? '…' : suffix;
    var width = 0;
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      width += code > 0x2E80 ? 2 : 1;
      if (width > maxWidth) return str.slice(0, i) + tail;
    }
    return str;
  }

  /* ---------------------------------------------------------------- 时间 */

  var MINUTE = 60 * 1000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string' && value) {
      var str = value.trim();
      // 纯日期 'YYYY-MM-DD' 在 ES 规范里按 UTC 解析，东八区会整体偏移一天；
      // 'YYYY-MM-DD HH:mm' 在部分浏览器（含 Safari）解析不稳。
      // 这两种形式统一替换为 '/' 分隔后按本地时间解析。
      // 含 'T' 的 ISO 串或带时区的串保持原样，交给引擎按规范解析。
      if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str)) {
        return new Date(str.replace(/-/g, '/'));
      }
      // 纯数字字符串按时间戳处理（避免被当成「年」解析成 1970 年）
      if (/^\d{10,14}$/.test(str)) return new Date(Number(str));
      return new Date(str);
    }
    return new Date(NaN);
  }

  /**
   * 相对时间文案：刚刚 / 12分钟前 / 3小时前 / 昨天 09:30 / 3天前 / 2026年9月20日
   * 列表页展示相对时间更利于判断信息新鲜度。
   */
  function formatRelativeTime(value, now) {
    var date = toDate(value);
    if (isNaN(date.getTime())) return '';
    var base = now ? toDate(now) : new Date();
    var diff = base.getTime() - date.getTime();

    if (diff < 0) return '刚刚';                     // 时钟偏差，按最新处理
    if (diff < MINUTE) return '刚刚';
    if (diff < HOUR) return Math.floor(diff / MINUTE) + '分钟前';
    if (diff < DAY) return Math.floor(diff / HOUR) + '小时前';

    var days = Math.floor(diff / DAY);
    if (days === 1) return '昨天 ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    if (days < 7) return days + '天前';
    return formatDateTime(date);
  }

  /** 绝对时间：2026年9月24日 15:30 */
  function formatDateTime(value) {
    var date = toDate(value);
    if (isNaN(date.getTime())) return '';
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日 ' +
      pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  /** 仅日期：2026年9月24日 */
  function formatDate(value) {
    var date = toDate(value);
    if (isNaN(date.getTime())) return '';
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  /* ------------------------------------------------------------- 集合运算 */

  /** 按 key 去重，保留首次出现的元素。 */
  function uniqueBy(list, keyFn) {
    var seen = Object.create(null);
    return (list || []).filter(function (item) {
      var key = keyFn ? keyFn(item) : item;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  /** 稳定排序：比较结果为 0 时保持原有相对顺序。 */
  function stableSort(list, compare) {
    return (list || []).map(function (item, index) {
      return { item: item, index: index };
    }).sort(function (a, b) {
      var result = compare(a.item, b.item);
      return result !== 0 ? result : a.index - b.index;
    }).map(function (wrapper) { return wrapper.item; });
  }

  /* ------------------------------------------------------------------ DOM */

  /** 转义后的 HTML 字符串写入容器。 */
  function setHtml(el, html) {
    if (el) el.innerHTML = html;
    return el;
  }

  /** 事件委托：避免为每个卡片单独绑定监听。 */
  function delegate(rootEl, eventName, selector, handler) {
    if (!rootEl) return;
    rootEl.addEventListener(eventName, function (event) {
      var target = event.target;
      while (target && target !== rootEl) {
        if (target.matches && target.matches(selector)) {
          handler.call(target, event, target);
          return;
        }
        target = target.parentNode;
      }
    });
  }

  /** 读取查询参数，兼容 file:// 直接打开（不使用 URLSearchParams 之外的 API）。 */
  function getQuery(name, search) {
    var raw = search != null ? search : (typeof location !== 'undefined' ? location.search : '');
    var query = String(raw || '').replace(/^\?/, '');
    if (!query) return '';
    var pairs = query.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var parts = pairs[i].split('=');
      if (decodeURIComponent(parts[0]) === name) {
        return decodeURIComponent((parts.slice(1).join('=') || '').replace(/\+/g, ' '));
      }
    }
    return '';
  }

  /* -------------------------------------------------------------- 存储适配 */

  /**
   * 极小的 localStorage 适配器。
   *
   * 为什么必须 try/catch：Chrome 在 file:// 下把每个页面视为独立源，
   * 部分配置/浏览器会直接抛出 SecurityError。原型要求「双击 html 即可运行」，
   * 因此存储必须可选——不可用时整个应用退回内存态继续工作。
   */
  var storage = (function () {
    var memory = Object.create(null);
    var usable = false;
    // Node 环境（单元测试）没有 window，直接用内存态
    var hasWindow = typeof window !== 'undefined' && window && window.localStorage;

    try {
      if (hasWindow) {
        var probeKey = '__lf_probe__';
        window.localStorage.setItem(probeKey, '1');
        window.localStorage.removeItem(probeKey);
        usable = true;
      }
    } catch (e) {
      usable = false;
    }

    return {
      available: function () { return usable; },
      get: function (key, fallback) {
        try {
          if (usable) {
            var raw = window.localStorage.getItem(key);
            return raw == null ? fallback : JSON.parse(raw);
          }
        } catch (e) { /* 数据损坏时退回默认值 */ }
        return key in memory ? memory[key] : fallback;
      },
      set: function (key, value) {
        memory[key] = value;
        try {
          if (usable) window.localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          return false;   // 配额或权限问题：内存态已写入，不阻断流程
        }
      },
      remove: function (key) {
        delete memory[key];
        try {
          if (usable) window.localStorage.removeItem(key);
        } catch (e) { /* 忽略 */ }
      }
    };
  })();

  /* --------------------------------------------------------------- 导出 */

  return {
    // 文本
    toHalfWidth: toHalfWidth,
    normalize: normalize,
    escapeHtml: escapeHtml,
    escapeRegExp: escapeRegExp,
    tokenize: tokenize,
    truncate: truncate,
    // 时间
    toDate: toDate,
    formatRelativeTime: formatRelativeTime,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    // 集合
    uniqueBy: uniqueBy,
    stableSort: stableSort,
    // DOM
    setHtml: setHtml,
    delegate: delegate,
    getQuery: getQuery,
    // 存储
    storage: storage
  };
});
