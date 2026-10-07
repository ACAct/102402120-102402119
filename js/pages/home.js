/* ==========================================================================
   js/pages/home.js —— 首页
   职责：渲染信息流、按类型筛选、展示空状态、维护底部导航高亮。
   设计取舍：首页只做「浏览」入口，搜索交给搜索页，
             这样首页信息密度可控，也符合原型的分工。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(
    root.LF.util,
    root.LF.schema,
    root.LF.repository,
    root.LF.layout,
    root.LF.itemCard,
    root.LF.icons
  );
  root.LF.pages = root.LF.pages || {};
  root.LF.pages.home = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, schema, repository, layout, itemCard, icons) {
  'use strict';

  /** 页面状态：当前筛选类型与排序方式。 */
  var state = {
    type: 'all',
    sort: 'active'    // active=进行中优先（默认） / time=最新发布 / type=按类型聚集
  };

  /** 排序选项。 */
  var SORTS = [
    { value: 'active', label: '进行中优先' },
    { value: 'time', label: '最新发布' }
  ];

  /** 常用关键词快捷入口，降低「不知道搜什么」的启动成本。 */
  var HOT_KEYWORDS = ['校园卡', '雨伞', '耳机', '钥匙', '水杯'];

  /* ---------------------------------------------------------------- 渲染 */

  /** 首页顶部：标题 + 个人中心入口 + 搜索入口 + 两大功能入口。 */
  function renderHeader() {
    return '' +
      '<div class="header">' +
        '<h1 class="header-title">校园失物招领</h1>' +
        '<a class="avatar-btn" href="' + layout.ROUTES.myposts + '" aria-label="我的发布">' +
          icons.icon('user', { size: 20 }) +
        '</a>' +
      '</div>' +
      layout.searchEntry('搜索物品，例如：校园卡、雨伞、耳机……') +
      '<div class="action-row">' +
        '<a class="action-card lost" href="' + layout.ROUTES.publish + '?type=lost">' +
          '<div class="deco"></div><div class="deco2"></div>' +
          '<div class="action-ic">' + icons.icon('search', { size: 20 }) + '</div>' +
          '<div><div class="action-text">我要寻物</div>' +
          '<div class="action-sub">发布寻物启事，帮助找回</div></div>' +
        '</a>' +
        '<a class="action-card found" href="' + layout.ROUTES.publish + '?type=found">' +
          '<div class="deco"></div><div class="deco2"></div>' +
          '<div class="action-ic">' + icons.icon('gift', { size: 20 }) + '</div>' +
          '<div><div class="action-text">我要招领</div>' +
          '<div class="action-sub">捡到物品，发布失物招领</div></div>' +
        '</a>' +
      '</div>';
  }

  /** 进度概览：让用户一眼看到「还有多少条在等认领」。 */
  function renderOverview() {
    var stats = repository.stats();
    return '' +
      '<div class="overview">' +
        '<div class="ov-item">' +
          '<div class="ov-num">' + stats.active + '</div>' +
          '<div class="ov-label">进行中</div>' +
        '</div>' +
        '<div class="ov-sep"></div>' +
        '<div class="ov-item">' +
          '<div class="ov-num">' + stats.lost + '</div>' +
          '<div class="ov-label">寻物启事</div>' +
        '</div>' +
        '<div class="ov-sep"></div>' +
        '<div class="ov-item">' +
          '<div class="ov-num">' + stats.found + '</div>' +
          '<div class="ov-label">失物招领</div>' +
        '</div>' +
        '<div class="ov-sep"></div>' +
        '<div class="ov-item">' +
          '<div class="ov-num">' + stats.resolved + '</div>' +
          '<div class="ov-label">已解决</div>' +
        '</div>' +
      '</div>';
  }

  /** 信息列表区块（标题 + 计数 + 卡片）。 */
  function renderList(items) {
    var body = items.length
      ? itemCard.renderList(items, itemCard.homeCard)
      : '';
    return '' +
      '<div class="section-head">' +
        '<span class="section-title">' + (state.type === 'all' ? '最新信息' : schema.typeFullLabel(state.type)) + '</span>' +
        '<span class="section-count">共 ' + items.length + ' 条</span>' +
      '</div>' +
      '<div id="listBody">' + body + '</div>';
  }

  /** 排序切换：信息多起来之后，「还有效的信息」应当先被看到。 */
  function renderSortBar() {
    return '<div class="sort-bar">' +
      '<span class="sort-label">排序</span>' +
      SORTS.map(function (option) {
        var active = option.value === state.sort ? ' active' : '';
        return '<button type="button" class="sort-btn' + active + '" data-sort="' +
          option.value + '" aria-pressed="' + (option.value === state.sort) + '">' +
          option.label + '</button>';
      }).join('') +
      '</div>';
  }

  /** 常用关键词快捷搜索，一键跳到搜索页。 */
  function renderHotKeywords() {
    return '<div class="hot-row">' +
      '<span class="hot-label">热门搜索</span>' +
      HOT_KEYWORDS.map(function (word) {
        return '<a class="hot-tag" href="' + layout.searchUrl(word, 'all') + '">' +
          util.escapeHtml(word) + '</a>';
      }).join('') +
      '</div>';
  }

  /** 当前筛选下的空状态文案。 */
  function emptyOptions(type) {
    if (type === schema.TYPE.LOST) {
      return {
        icon: 'emptySearch',
        title: '还没有寻物启事',
        sub: '如果你丢了东西，可以马上发布一条',
        actionLabel: '发布寻物启事',
        actionHref: layout.ROUTES.publish + '?type=lost'
      };
    }
    if (type === schema.TYPE.FOUND) {
      return {
        icon: 'emptySearch',
        title: '还没有失物招领',
        sub: '捡到东西？发布出来让失主找到你',
        actionLabel: '发布失物招领',
        actionHref: layout.ROUTES.publish + '?type=found'
      };
    }
    return {
      icon: 'emptySearch',
      title: '暂时没有任何信息',
      sub: '成为第一个发布者，帮助同学找回物品',
      actionLabel: '去发布',
      actionHref: layout.ROUTES.publish
    };
  }

  /**
   * 按当前排序方式整理列表。
   * active：进行中优先，其余按发布时间倒序——先让用户看到「还能帮上忙」的信息。
   * time  ：纯按发布时间倒序。
   */
  function sortItems(items) {
    var sorted = items.slice();
    if (state.sort === 'time') {
      return util.stableSort(sorted, function (a, b) { return b.publishedAt - a.publishedAt; });
    }
    return util.stableSort(sorted, function (a, b) {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      return b.publishedAt - a.publishedAt;
    });
  }

  /**
   * 整个首页重绘。
   * 数据量在演示规模（几十条）以内，整体重绘比增量更新更简单可靠，
   * 且不会出现「筛选后残留旧卡片」这类状态不同步的问题。
   */
  function render() {
    var items = sortItems(repository.list({ type: state.type }));
    var hasItems = items.length > 0;

    var html = '' +
      renderHeader() +
      renderHotKeywords() +
      renderOverview() +
      layout.segment(schema.TYPE_FILTERS, state.type, 'data-filter') +
      (hasItems ? renderSortBar() + renderList(items) : '') +
      layout.emptyState(Object.assign({ visible: !hasItems }, emptyOptions(state.type)));

    util.setHtml(document.getElementById('content'), html);
  }

  /* ---------------------------------------------------------------- 交互 */

  /** 切换筛选并重绘。 */
  function setType(type) {
    if (state.type === type) return;
    state.type = type;
    render();
    scrollToTop();
  }

  /** 切换排序并重绘。 */
  function setSort(sort) {
    if (state.sort === sort) return;
    state.sort = sort;
    render();
  }

  /** 切换筛选后滚动位置回到顶部，避免停留在空白区域。 */
  function scrollToTop() {
    var content = document.getElementById('content');
    if (content) content.scrollTop = 0;
  }

  function bindEvents() {
    var content = document.getElementById('content');
    if (!content) return;

    // 分段筛选（事件委托，重绘后无需重新绑定）
    util.delegate(content, 'click', '.segment .seg', function (event, el) {
      event.preventDefault();
      setType(el.getAttribute('data-filter'));
    });

    // 排序切换
    util.delegate(content, 'click', '.sort-btn', function (event, el) {
      event.preventDefault();
      setSort(el.getAttribute('data-sort'));
    });
  }

  /** 页面初始化。 */
  function init() {
    layout.bindGlobalNav();

    // 外壳：状态栏 / 刘海 / 底部导航（一次写入，之后只更新内容区）
    document.getElementById('statusBar').innerHTML = layout.statusBar();
    document.getElementById('chrome').innerHTML = layout.chrome();
    document.getElementById('tabbar').innerHTML = layout.tabBar('home');

    bindEvents();
    render();
  }

  return {
    init: init,
    render: render,
    setType: setType,
    setSort: setSort,
    sortItems: sortItems,
    SORTS: SORTS,
    HOT_KEYWORDS: HOT_KEYWORDS,
    state: state
  };
});
