/* ==========================================================================
   js/pages/success.js —— 发布成功页
   携带 ?id= 进入时展示刚发布信息的摘要，让用户确认「发出去的到底是什么」；
   id 缺失或查不到时退化为通用成功提示，而不是报错。
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
  root.LF.pages.success = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, schema, repository, layout, icons) {
  'use strict';

  /** 刚发布信息的摘要卡片。 */
  function renderSummary(item) {
    return '' +
      '<div class="success-card">' +
        '<div class="sc-row"><span class="sc-label">信息类型</span>' +
          '<span class="sc-value">' + util.escapeHtml(schema.typeFullLabel(item.type)) + '</span></div>' +
        '<div class="sc-row"><span class="sc-label">物品名称</span>' +
          '<span class="sc-value">' + util.escapeHtml(item.title) + '</span></div>' +
        '<div class="sc-row"><span class="sc-label">' +
          (item.type === schema.TYPE.LOST ? '丢失地点' : '拾取地点') + '</span>' +
          '<span class="sc-value">' + util.escapeHtml(item.location) + '</span></div>' +
        '<div class="sc-row"><span class="sc-label">当前状态</span>' +
          '<span class="sc-value">' + util.escapeHtml(schema.statusLabel(item.status)) + '</span></div>' +
      '</div>';
  }

  /** 渲染整页。 */
  function render(item) {
    var detailHref = item ? layout.detailUrl(item.id) : layout.ROUTES.myposts;
    var sub = item
      ? '你的' + util.escapeHtml(schema.typeFullLabel(item.type)) + '已经发布<br>其他同学可以通过搜索找到这条信息'
      : '你的信息已经发布<br>其他同学可以通过搜索找到这条信息';

    util.setHtml(document.getElementById('content'),
      '<div class="success-wrap">' +
        '<div class="success-ic-wrap">' +
          '<span class="success-ic-ring pulse"></span>' +
          '<div class="success-ic">' +
            '<svg viewBox="0 0 32 32"><path d="M8 16.5 13.5 22 24 10.5"/></svg>' +
          '</div>' +
        '</div>' +
        '<div class="success-title">发布成功</div>' +
        '<div class="success-sub">' + sub + '</div>' +
        (item ? renderSummary(item) : '') +
        '<div class="tip-card">' + icons.icon('info', { size: 20 }) +
          '<div class="tip-text">可以点击下方按钮查看这条信息，或者去 <strong>「我的发布」</strong> ' +
          '管理它的状态<br>物品一旦找到或归还，请及时标记为已解决</div>' +
        '</div>' +
        '<div class="btn-group">' +
          '<a class="btn-primary" href="' + detailHref + '">查看这条信息</a>' +
          '<a class="btn-secondary" href="' + layout.ROUTES.myposts + '">前往我的发布</a>' +
          '<a class="btn-secondary" href="' + layout.ROUTES.home + '">返回首页</a>' +
        '</div>' +
      '</div>');
  }

  function init() {
    layout.bindGlobalNav();
    document.getElementById('chrome').innerHTML = layout.chrome();
    document.getElementById('statusBar').innerHTML = layout.statusBar();
    document.title = '发布成功 · 校园失物招领';
    // 顺带渲染底部导航，方便用户直接切到「我的发布」
    render(repository.get(util.getQuery('id')));
  }

  return { init: init, render: render };
});
