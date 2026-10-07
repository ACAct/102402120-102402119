/* ==========================================================================
   js/components/layout.js —— 页面骨架部件
   状态栏 / 手机外框 / 底部导航 / 分段筛选 / 搜索框 / 空状态 / 轻提示
   这些部件在每个页面重复出现，集中在此保证三页外观完全一致。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./icons.js') : root.LF.icons,
    typeof module === 'object' && module.exports ? require('../core/util.js') : root.LF.util
  );
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.layout = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (icons, util) {
  'use strict';

  /* --------------------------------------------------------------- 路由表 */

  /**
   * 页面级路由集中在此，避免各页面散落硬编码文件名。
   * 用普通 <a href> 跳转（而非 history.pushState）以兼容 file:// 直接打开。
   */
  var ROUTES = {
    home: 'index.html',
    publish: 'publish.html',
    success: 'success.html',
    myposts: 'myposts.html',
    search: 'search.html',
    detail: 'detail.html'
  };

  /** 拼接详情页地址：详情页只需一个 id 参数。 */
  function detailUrl(id) {
    return ROUTES.detail + '?id=' + encodeURIComponent(id);
  }

  /** 拼接搜索页地址，可带初始关键词与类型。 */
  function searchUrl(keyword, type) {
    var params = [];
    if (keyword) params.push('q=' + encodeURIComponent(keyword));
    if (type && type !== 'all') params.push('type=' + encodeURIComponent(type));
    return ROUTES.search + (params.length ? '?' + params.join('&') : '');
  }

  /** 页面跳转。 */
  function go(name, params) {
    var target = ROUTES[name] || name;
    if (params) target += (target.indexOf('?') >= 0 ? '&' : '?') + params;
    if (typeof location !== 'undefined') location.href = target;
  }

  /**
   * 返回上一页；若没有历史记录（例如直接打开详情页链接）则回首页。
   * 详情页被直接分享时，「返回」不该把用户留在一个空白页上。
   */
  function goBack(fallbackName) {
    if (typeof history !== 'undefined' && history.length > 1) {
      history.back();
      return;
    }
    go(fallbackName || 'home');
  }

  /* ------------------------------------------------------------- 静态部件 */

  /** 状态栏（时间 + 信号/WiFi/电池），纯装饰，故加 aria-hidden。 */
  function statusBar(time) {
    return '' +
      '<div class="status-bar" aria-hidden="true">' +
        '<span>' + (time || '9:41') + '</span>' +
        '<div class="right">' +
          '<svg class="ic" viewBox="0 0 24 24" width="17" height="17"><path d="M2 16h3M8 13h3M14 10h3M20 7h2" stroke-width="2.2"/></svg>' +
          '<svg class="ic" viewBox="0 0 24 24" width="16" height="16"><path d="M5.6 10.8a9.4 9.4 0 0 1 12.8 0M8.5 13.9a5.4 5.4 0 0 1 7 0"/><circle cx="12" cy="17.2" r="1.3" fill="currentColor" stroke="none"/></svg>' +
          '<svg viewBox="0 0 27 12" width="24" height="12" fill="none">' +
            '<rect x="0.5" y="0.5" width="22" height="11" rx="2.5" stroke="currentColor" opacity=".5"/>' +
            '<rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5"/>' +
            '<rect x="2" y="2" width="18" height="8" rx="1.2" fill="currentColor"/>' +
          '</svg>' +
        '</div>' +
      '</div>';
  }

  /** 刘海 + 底部横条，装饰元素。 */
  function chrome() {
    return '<div class="notch" aria-hidden="true"></div>';
  }

  function homeIndicator() {
    return '<div class="home-indicator" aria-hidden="true"></div>';
  }

  /** 顶部导航栏：左侧返回 + 居中标题（可带右侧动作）。 */
  function navbar(title, opts) {
    var options = opts || {};
    var back = options.back === false ? '' :
      '<button class="nav-back" type="button" data-nav="' + (options.backTo || 'back') + '" aria-label="返回">' +
        icons.icon('back', { size: 22 }) +
      '</button>';
    var right = options.right ? '<div class="nav-right">' + options.right + '</div>' : '';
    return '<div class="navbar' + (options.floating ? ' floating' : '') + '">' + back +
      (title ? '<span class="nav-title">' + util.escapeHtml(title) + '</span>' : '') + right + '</div>';
  }

  /* ------------------------------------------------------------- 底部导航 */

  var TABS = [
    { key: 'home', label: '首页', icon: 'home' },
    { key: 'publish', label: '发布', icon: 'plus' },
    { key: 'myposts', label: '我的', icon: 'list' }
  ];

  /**
   * 底部导航栏。
   * 中间「发布」做成胶囊主按钮，与原型一致。
   * @param {string} activeKey 当前高亮的 tab
   */
  function tabBar(activeKey) {
    function item(tab) {
      var active = tab.key === activeKey ? ' active' : '';
      return '<a class="tab-item' + active + '" href="' + ROUTES[tab.key] + '"' +
        (active ? ' aria-current="page"' : '') + '>' +
        icons.icon(tab.icon) + '<span>' + tab.label + '</span></a>';
    }
    return '' +
      '<nav class="tabbar" aria-label="主导航">' +
        item(TABS[0]) +
        '<div class="tab-center"><a class="tab-fab" href="' + ROUTES.publish + '">' +
          icons.icon('plus', { size: 14 }) + '发布</a></div>' +
        item(TABS[2]) +
      '</nav>';
  }

  /* ------------------------------------------------------------- 分段筛选 */

  /**
   * 分段控件（全部 / 寻物 / 招领）。
   * @param {Array} items     [{ value, label }]
   * @param {string} active   当前选中值
   * @param {string} hookAttr 挂在按钮上的 data-* 名称，如 'data-filter'
   */
  function segment(items, active, hookAttr) {
    var attr = hookAttr || 'data-filter';
    return '<div class="segment" role="tablist">' + items.map(function (item) {
      var isActive = item.value === active;
      return '<button type="button" class="seg' + (isActive ? ' active' : '') + '"' +
        ' role="tab" aria-selected="' + isActive + '"' +
        ' ' + attr + '="' + util.escapeHtml(item.value) + '">' +
        util.escapeHtml(item.label) + '</button>';
    }).join('') + '</div>';
  }

  /* --------------------------------------------------------------- 搜索框 */

  /**
   * 首页的「假」搜索框：本身是入口，点击跳到搜索页。
   * 用 <a> 而非 <div>，保证键盘可聚焦、可回车触发。
   */
  function searchEntry(placeholder) {
    return '' +
      '<a class="search-box" href="' + ROUTES.search + '" role="search">' +
        icons.icon('search', { size: 18 }) +
        '<span class="search-placeholder">' + util.escapeHtml(placeholder) + '</span>' +
        '<span class="search-hint">搜索</span>' +
      '</a>';
  }

  /**
   * 搜索页的输入框 + 按钮组合。
   * @param {object} opts { value, placeholder }
   */
  function searchField(opts) {
    var options = opts || {};
    var value = options.value || '';
    return '' +
      '<div class="top-bar">' +
        '<button class="nav-back" type="button" data-nav="back" aria-label="返回">' +
          icons.icon('back', { size: 22 }) + '</button>' +
        '<div class="search-input-wrap">' +
          icons.icon('search', { size: 16 }) +
          '<input id="searchInput" type="search" autocomplete="off" enterkeyhint="search"' +
            ' placeholder="' + util.escapeHtml(options.placeholder || '请输入物品名称或关键词') + '"' +
            ' value="' + util.escapeHtml(value) + '" aria-label="搜索关键词">' +
          '<button class="clear-btn' + (value ? '' : ' hidden') + '" id="clearBtn" type="button" aria-label="清空">' +
            icons.icon('close', { size: 10 }) + '</button>' +
        '</div>' +
        '<button class="btn-search" id="searchBtn" type="button">搜索</button>' +
      '</div>';
  }

  /* ------------------------------------------------------------- 空状态 */

  /**
   * 通用空状态。
   * @param {object} opts { icon, title, sub, actionLabel, actionHook, actionHref }
   */
  function emptyState(opts) {
    var options = opts || {};
    var action = '';
    if (options.actionLabel) {
      if (options.actionHref) {
        action = '<a class="empty-btn" href="' + options.actionHref + '">' +
          util.escapeHtml(options.actionLabel) + '</a>';
      } else {
        action = '<button type="button" class="empty-btn" ' +
          (options.actionHook || '') + '>' + util.escapeHtml(options.actionLabel) + '</button>';
      }
    }
    return '' +
      '<div class="empty-state' + (options.visible ? ' show' : '') + '" id="' + (options.id || 'emptyView') + '">' +
        '<div class="empty-illu">' + icons.icon(options.icon || 'emptySearch', { size: 56, cls: '' }) + '</div>' +
        '<div class="empty-title">' + util.escapeHtml(options.title || '没有找到相关信息') + '</div>' +
        (options.sub ? '<div class="empty-sub">' + util.escapeHtml(options.sub) + '</div>' : '') +
        action +
      '</div>';
  }

  /* ------------------------------------------------------------- 轻提示 */

  /** 轻提示（复制成功、状态已更新等），避免使用 alert 打断操作。 */
  function toast(message, duration) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    // 触发进入动画
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 240);
    }, duration || 1800);
  }

  /**
   * 复制文本到剪贴板。
   * 优先用异步剪贴板 API；file:// 或旧环境下回退到 execCommand，
   * 保证「一键复制联系方式」在任何打开方式下都可用。
   */
  function copyText(text) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; },
        function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  /* ---------------------------------------------------------- 全局交互绑定 */

  /**
   * 所有页面共用的点击委托：返回按钮与路由跳转。
   * 页面脚本只需关心自己的业务事件。
   */
  function bindGlobalNav() {
    document.addEventListener('click', function (event) {
      var el = event.target.closest ? event.target.closest('[data-nav]') : null;
      if (!el) return;
      var target = el.getAttribute('data-nav');
      if (target === 'back') {
        event.preventDefault();
        goBack(el.getAttribute('data-back-to') || 'home');
      } else if (ROUTES[target]) {
        event.preventDefault();
        go(target);
      }
    });
  }

  return {
    ROUTES: ROUTES,
    TABS: TABS,
    detailUrl: detailUrl,
    searchUrl: searchUrl,
    go: go,
    goBack: goBack,
    statusBar: statusBar,
    chrome: chrome,
    homeIndicator: homeIndicator,
    navbar: navbar,
    tabBar: tabBar,
    segment: segment,
    searchEntry: searchEntry,
    searchField: searchField,
    emptyState: emptyState,
    toast: toast,
    copyText: copyText,
    bindGlobalNav: bindGlobalNav
  };
});
