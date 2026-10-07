/* ==========================================================================
   js/pages/search.js —— 搜索页
   职责：关键词输入（实时搜索）、类型筛选、结果列表、无结果引导、搜索历史。
   搜索逻辑本身在 js/core/search.js（纯函数，有独立单测），这里只负责交互与呈现。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(
    root.LF.util,
    root.LF.schema,
    root.LF.repository,
    root.LF.layout,
    root.LF.search,
    root.LF.itemCard,
    root.LF.icons
  );
  root.LF.pages = root.LF.pages || {};
  root.LF.pages.search = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, schema, repository, layout, search, itemCard, icons) {
  'use strict';

  var HISTORY_KEY = 'lf.searchHistory.v1';
  var HISTORY_MAX = 8;

  /** 页面状态。 */
  var state = {
    query: '',
    type: 'all',
    results: []
  };

  /* ------------------------------------------------------------ 搜索历史 */

  /** 读取历史关键词（存储不可用时返回空数组）。 */
  function getHistory() {
    var list = util.storage.get(HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  /**
   * 记录一次搜索。
   * 只记录「有意义」的关键词：去重、置顶、限制条数，
   * 避免用户每敲一个字就写入一条历史。
   */
  function pushHistory(query) {
    var keyword = String(query || '').trim();
    if (keyword.length < 2) return;          // 单字搜索不记入历史
    var list = getHistory().filter(function (item) { return item !== keyword; });
    list.unshift(keyword);
    util.storage.set(HISTORY_KEY, list.slice(0, HISTORY_MAX));
  }

  function clearHistory() {
    util.storage.remove(HISTORY_KEY);
  }

  /* ---------------------------------------------------------------- 渲染 */

  /** 结果区头部：结果条数 + 当前关键词 + 命中说明。 */
  function renderResultHead() {
    var count = state.results.length;
    var keyword = state.query.trim();
    return '' +
      '<div class="section-head">' +
        '<span class="section-title">搜索结果</span>' +
        '<span class="section-count">' + (keyword ? '「' + util.escapeHtml(keyword) + '」共 ' + count + ' 条' : '共 ' + count + ' 条') + '</span>' +
      '</div>';
  }

  /**
   * 结果卡片。
   * 在通用紧凑卡的基础上叠加关键词高亮，
   * 让用户一眼看出「为什么这条会被搜出来」。
   */
  function renderResultCard(row) {
    var item = row.item;
    var keyword = state.query;
    var ic = schema.categoryMeta(item.category);
    var matchedLabels = search.matchedFieldLabels(row.matched);

    return '' +
      '<a class="result-card' + (item.resolved ? ' is-resolved' : '') + '" href="' + layout.detailUrl(item.id) + '">' +
        '<div class="card-thumb ' + ic.tone + '">' + icons.icon(ic.icon, { size: 28 }) + '</div>' +
        '<div class="card-main">' +
          '<div class="card-top">' +
            itemCard.typeBadge(item) +
            itemCard.resolvedBadge(item) +
            '<span class="card-status">' + util.escapeHtml(schema.statusLabel(item.status)) + '</span>' +
          '</div>' +
          '<div class="card-title">' + search.highlight(item.title, keyword) + '</div>' +
          '<div class="card-desc">' + search.highlight(item.description, keyword) + '</div>' +
          '<div class="card-meta">' +
            '<span class="meta-item">' + icons.icon('location', { size: 12 }) +
              search.highlight(item.location, keyword) + '</span>' +
            '<span class="dot">·</span>' +
            '<span>' + util.escapeHtml(util.formatDate(item.lostAt)) + '</span>' +
            (matchedLabels.length && !row.matched.includes('title')
              ? '<span class="match-tag">命中' + util.escapeHtml(matchedLabels.join('/')) + '</span>'
              : '') +
          '</div>' +
        '</div>' +
        '<div class="card-arrow">' + icons.icon('chevron', { size: 14 }) + '</div>' +
      '</a>';
  }

  /** 空关键词时展示的搜索引导（热门搜索 + 历史记录）。 */
  function renderSuggestions() {
    var history = getHistory();
    var hot = ['校园卡', '雨伞', '耳机', '钥匙', '水杯', '课本'];

    var historyBlock = history.length
      ? '<div class="sug-group">' +
          '<div class="sug-head">' +
            '<span class="sug-title">搜索历史</span>' +
            '<button type="button" class="sug-clear" data-clear-history>清空</button>' +
          '</div>' +
          '<div class="sug-tags">' + history.map(function (word) {
            return '<button type="button" class="sug-tag" data-keyword="' +
              util.escapeHtml(word) + '">' + util.escapeHtml(word) + '</button>';
          }).join('') + '</div>' +
        '</div>'
      : '';

    return '' +
      historyBlock +
      '<div class="sug-group">' +
        '<div class="sug-head"><span class="sug-title">大家都在搜</span></div>' +
        '<div class="sug-tags">' + hot.map(function (word) {
          return '<button type="button" class="sug-tag" data-keyword="' +
            util.escapeHtml(word) + '">' + util.escapeHtml(word) + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      layout.emptyState({
        icon: 'emptySearch',
        title: '搜索校园里的失物招领',
        sub: '输入物品名称、地点或描述中的关键词，例如「校园卡」「图书馆」',
        actionLabel: '按类别浏览',
        actionHref: layout.ROUTES.home,
        visible: true,
        id: 'introView'
      });
  }

  /** 无结果时的引导（给出可点击的替代关键词，而不是让用户自己猜）。 */
  function renderNoResult() {
    var keyword = state.query.trim();
    var suggestions = ['校园卡', '雨伞', '耳机', '钥匙'];
    return '' +
      layout.emptyState({
        icon: 'emptySearch',
        title: '没有找到「' + util.escapeHtml(keyword) + '」相关信息',
        sub: '换个关键词试试，或者浏览全部信息',
        actionLabel: '返回首页浏览',
        actionHref: layout.ROUTES.home,
        visible: true,
        id: 'emptyView'
      }) +
      '<div class="sug-group">' +
        '<div class="sug-head"><span class="sug-title">试试这些关键词</span></div>' +
        '<div class="sug-tags">' + suggestions.map(function (word) {
          return '<button type="button" class="sug-tag" data-keyword="' +
            util.escapeHtml(word) + '">' + util.escapeHtml(word) + '</button>';
        }).join('') + '</div>' +
      '</div>';
  }

  /** 结果区整体渲染：顶部是类型分段控件，下面是结果/引导。 */
  function renderBody() {
    var keyword = state.query.trim();
    var body = document.getElementById('body');

    var segmentHtml = layout.segment(schema.TYPE_FILTERS, state.type, 'data-filter');
    var contentHtml;

    if (!keyword && state.type === 'all') {
      contentHtml = renderSuggestions();
    } else if (!state.results.length) {
      contentHtml = renderNoResult();
    } else {
      contentHtml = renderResultHead() + state.results.map(renderResultCard).join('');
    }

    util.setHtml(body, segmentHtml + contentHtml);
  }

  /** 顶部搜索栏（含清除按钮）单独更新，避免输入时重建输入框导致光标丢失。 */
  function renderSearchBar() {
    util.setHtml(document.getElementById('searchBar'),
      layout.searchField({ value: state.query }));
  }

  /* ---------------------------------------------------------------- 交互 */

  /** 执行搜索并重绘结果区。 */
  function runSearch(options) {
    var opts = options || {};
    var items = repository.list();
    state.results = search.search(items, state.query, { type: state.type });

    // 输入框只在需要时重建（例如从 URL 或建议词进入），
    // 用户手动输入时不能重建，否则会丢失焦点。
    if (opts.syncInput) renderSearchBar();
    renderBody();
  }

  /** 设置关键词并同步到地址栏（便于分享与刷新后保持结果）。 */
  function setQuery(query, options) {
    state.query = String(query == null ? '' : query);
    runSearch(options);
  }

  /** 切换类型筛选。 */
  function setType(type) {
    if (state.type === type) return;
    state.type = type;
    runSearch({});
  }

  function bindEvents() {
    var searchBar = document.getElementById('searchBar');
    var body = document.getElementById('body');

    // 输入：实时搜索
    searchBar.addEventListener('input', function (event) {
      var input = event.target;
      if (!input || input.id !== 'searchInput') return;
      state.query = input.value;
      // 清除按钮随内容显隐
      var clearBtn = document.getElementById('clearBtn');
      if (clearBtn) {
        if (input.value) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      runSearch({});
    });

    // 回车 / 点击搜索按钮
    searchBar.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        pushHistory(state.query);
        runSearch({});
      }
    });

    util.delegate(searchBar, 'click', '#searchBtn', function (event) {
      event.preventDefault();
      pushHistory(state.query);
      runSearch({});
    });

    util.delegate(searchBar, 'click', '#clearBtn', function (event) {
      event.preventDefault();
      state.query = '';
      pushHistory('');     // 不记录空关键词
      renderSearchBar();
      var input = document.getElementById('searchInput');
      if (input && input.focus) input.focus();
      runSearch({});
    });

    // 类型筛选（委托在 body 上，分段控件由 renderBody 一并渲染，重绘后无需重新绑定）
    util.delegate(body, 'click', '.segment .seg', function (event, el) {
      event.preventDefault();
      setType(el.getAttribute('data-filter'));
    });

    // 建议词 / 历史记录 / 清空历史
    util.delegate(body, 'click', '.sug-tag', function (event, el) {
      event.preventDefault();
      var word = el.getAttribute('data-keyword');
      state.query = word;
      pushHistory(word);
      renderSearchBar();
      runSearch({});
    });

    util.delegate(body, 'click', '[data-clear-history]', function (event) {
      event.preventDefault();
      clearHistory();
      renderBody();
      layout.toast('已清空搜索历史');
    });
  }

  /* ---------------------------------------------------------------- 初始化 */

  /** 初始化：读取 URL 参数 → 渲染骨架 → 绑定事件 → 首次搜索。 */
  function init() {
    layout.bindGlobalNav();

    document.getElementById('chrome').innerHTML = layout.chrome();
    document.getElementById('statusBar').innerHTML = layout.statusBar();
    renderSearchBar();

    // 首页热门关键词与详情页「搜索同类」会带 q / type 参数进来
    var initialQuery = util.getQuery('q');
    var initialType = util.getQuery('type');
    state.query = initialQuery || '';
    state.type = (initialType === 'lost' || initialType === 'found') ? initialType : 'all';
    if (state.query) pushHistory(state.query);

    bindEvents();
    runSearch({});
  }

  return {
    init: init,
    state: state,
    setQuery: setQuery,
    setType: setType,
    runSearch: runSearch,
    getHistory: getHistory,
    pushHistory: pushHistory,
    clearHistory: clearHistory,
    renderSuggestions: renderSuggestions
  };
});
