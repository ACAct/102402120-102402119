/* ==========================================================================
   js/pages/myposts.js —— 我的发布（信息状态维护入口）
   职责：列出自己发布的信息，并提供「标记已找到/已归还」与「撤销该标记」的操作。

   关于「自己发布的」如何判定：本项目不引入登录/实名体系（作业明确不要求），
   因此用浏览器本地记录的「发布时填写的称呼」来筛选。
   若本地没有记录（例如助教首次打开这个页面），则展示全部信息作为演示，
   并在页面上明确说明这一点，避免用户误以为这些都是自己发的。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(
    root.LF.util,
    root.LF.schema,
    root.LF.repository,
    root.LF.layout,
    root.LF.icons
  );
  root.LF.pages = root.LF.pages || {};
  root.LF.pages.myposts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, schema, repository, layout, icons) {
  'use strict';

  var IDENTITY_KEY = 'lf.myPublisher.v1';

  /** 页面状态：筛选类型 + 是否展示全部（无身份记录时的演示模式）。 */
  var state = {
    type: 'all',
    demoMode: false,
    publisherName: ''
  };

  /* ---------------------------------------------------------------- 数据 */

  /** 取出「我的」信息；没有本地身份记录时退化为全部信息（演示模式）。 */
  function myItems() {
    var all = repository.list({ type: state.type });
    var name = state.publisherName;

    if (!name) {
      state.demoMode = true;
      return all;
    }
    state.demoMode = false;
    var mine = all.filter(function (item) {
      return item.publisher.name === name;
    });
    // 有身份记录但确实没有发布过：返回空数组，由空状态引导去发布
    return mine;
  }

  /* ---------------------------------------------------------------- 渲染 */

  /** 统计概览：共发布 / 进行中 / 已解决。 */
  function renderSummary(items) {
    var all = repository.list();
    var mine = state.publisherName
      ? all.filter(function (item) { return item.publisher.name === state.publisherName; })
      : all;
    var active = mine.filter(function (item) { return !item.resolved; }).length;

    return '' +
      '<div class="my-summary">' +
        '<div class="ms-item"><div class="ms-num">' + mine.length + '</div>' +
          '<div class="ms-label">共发布</div></div>' +
        '<div class="ms-sep"></div>' +
        '<div class="ms-item"><div class="ms-num">' + active + '</div>' +
          '<div class="ms-label">进行中</div></div>' +
        '<div class="ms-sep"></div>' +
        '<div class="ms-item"><div class="ms-num">' + (mine.length - active) + '</div>' +
          '<div class="ms-label">已解决</div></div>' +
      '</div>';
  }

  /** 单条信息卡片（含状态维护按钮）。 */
  function renderCard(item) {
    var meta = schema.categoryMeta(item.category);
    var active = schema.isActiveStatus(item.status);
    var label = item.type === schema.TYPE.LOST ? '丢失' : '拾取';
    var resolveText = item.type === schema.TYPE.LOST ? '标记已找到' : '标记已归还';

    return '' +
      '<div class="my-card' + (item.resolved ? ' is-resolved' : '') + '" data-id="' + util.escapeHtml(item.id) + '">' +
        '<div class="card-icon ' + meta.tone + '">' + icons.icon(meta.icon, { size: 24 }) + '</div>' +
        '<div class="my-main">' +
          '<div class="card-top">' +
            '<span class="badge badge-' + (item.type === schema.TYPE.FOUND ? 'found' : 'lost') + '">' +
              schema.typeLabel(item.type) + '</span>' +
            '<span class="badge ' + (item.resolved ? 'badge-done' : 'badge-active') + '">' +
              util.escapeHtml(schema.statusLabel(item.status)) + '</span>' +
          '</div>' +
          '<div class="card-title">' + util.escapeHtml(item.title) + '</div>' +
          '<div class="card-meta">' +
            '<span class="meta-item">' + icons.icon('location', { size: 12 }) +
              util.escapeHtml(item.location) + '</span>' +
            '<span class="dot">·</span>' +
            '<span>' + util.escapeHtml(util.formatRelativeTime(item.publishedAt)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="my-actions">' +
          (active
            ? '<button type="button" class="act-btn resolve" data-action="resolve" data-id="' +
                util.escapeHtml(item.id) + '">' + icons.icon('check', { size: 11 }) + resolveText + '</button>'
            : '<button type="button" class="act-btn reopen" data-action="reopen" data-id="' +
                util.escapeHtml(item.id) + '">' + icons.icon('back', { size: 11 }) + '撤销标记</button>') +
          '<a class="act-btn view" href="' + layout.detailUrl(item.id) + '">' +
            icons.icon('chevron', { size: 11 }) + '查看详情</a>' +
        '</div>' +
      '</div>';
  }

  /** 演示模式提示条。 */
  function renderDemoTip() {
    if (!state.demoMode) return '';
    return '' +
      '<div class="demo-tip">' + icons.icon('info', { size: 15 }) +
        '<span>本地还没有你的发布记录，这里先展示全部信息作为演示。' +
        '发布一条信息后，本页只显示你自己发布的内容。</span>' +
      '</div>';
  }

  /** 空状态。 */
  function emptyOptions() {
    if (state.publisherName && state.type === 'all') {
      return {
        icon: 'edit',
        title: '你还没有发布过信息',
        sub: '丢失了东西或捡到物品，都可以发布出来',
        actionLabel: '去发布',
        actionHref: layout.ROUTES.publish
      };
    }
    return {
      icon: 'emptySearch',
      title: state.type === 'all' ? '暂时没有信息' : '这个分类下还没有信息',
      sub: '换个分类看看，或者发布一条新的信息',
      actionLabel: '去发布',
      actionHref: layout.ROUTES.publish
    };
  }

  /** 整体渲染。 */
  function render() {
    var items = myItems();
    var hasItems = items.length > 0;

    util.setHtml(document.getElementById('content'),
      renderSummary(items) +
      renderDemoTip() +
      layout.segment(schema.TYPE_FILTERS, state.type, 'data-filter') +
      (hasItems
        ? '<div class="section-head"><span class="section-title">我发布的信息</span>' +
          '<span class="section-count">共 ' + items.length + ' 条</span></div>' +
          items.map(renderCard).join('')
        : layout.emptyState(Object.assign({ visible: true }, emptyOptions()))));
  }

  /* ---------------------------------------------------------------- 交互 */

  /** 切换状态：已解决 ↔ 进行中。 */
  function toggleStatus(id, resolved) {
    var updated = repository.updateStatus(id, resolved, { now: Date.now() });
    if (!updated) {
      layout.toast('操作失败，信息可能已被删除');
      return;
    }
    render();
    layout.toast('已标记为「' + schema.statusLabel(updated.status) + '」');
  }

  function setType(type) {
    if (state.type === type) return;
    state.type = type;
    render();
  }

  function bindEvents() {
    var content = document.getElementById('content');
    if (!content) return;

    util.delegate(content, 'click', '.segment .seg', function (event, el) {
      event.preventDefault();
      setType(el.getAttribute('data-filter'));
    });

    // 标记已解决
    util.delegate(content, 'click', '[data-action="resolve"]', function (event, el) {
      event.preventDefault();
      toggleStatus(el.getAttribute('data-id'), true);
    });

    // 撤销标记
    util.delegate(content, 'click', '[data-action="reopen"]', function (event, el) {
      event.preventDefault();
      toggleStatus(el.getAttribute('data-id'), false);
    });
  }

  /* ---------------------------------------------------------------- 初始化 */

  function init() {
    layout.bindGlobalNav();

    document.getElementById('chrome').innerHTML = layout.chrome();
    document.getElementById('statusBar').innerHTML = layout.statusBar();
    util.setHtml(document.getElementById('navSlot'), layout.navbar('我的发布', { back: false }));
    util.setHtml(document.getElementById('tabbar'), layout.tabBar('myposts'));

    state.publisherName = util.storage.get(IDENTITY_KEY, '') || '';

    bindEvents();
    render();
  }

  return {
    init: init,
    render: render,
    setType: setType,
    toggleStatus: toggleStatus,
    myItems: myItems,
    state: state
  };
});
