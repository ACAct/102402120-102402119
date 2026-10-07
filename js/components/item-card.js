/* ==========================================================================
   js/components/item-card.js —— 信息卡片渲染
   首页用「标准卡」（图标 + 徽章 + 标题 + 摘要 + 地点/发布者）
   搜索页用「紧凑卡」（缩略图 + 徽章 + 标题 + 摘要 + 地点/时间）
   两者都以 <a> 包裹，天然支持键盘与鼠标中键打开详情。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./icons.js') : root.LF.icons,
    isNode ? require('../core/util.js') : root.LF.util,
    isNode ? require('../core/schema.js') : root.LF.schema,
    isNode ? require('./layout.js') : root.LF.layout
  );
  if (isNode) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.itemCard = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (icons, util, schema, layout) {
  'use strict';

  /** 类型徽章：寻物（蓝）/ 招领（琥珀）。 */
  function typeBadge(item) {
    var cls = item.type === schema.TYPE.FOUND ? 'badge-found' : 'badge-lost';
    return '<span class="badge ' + cls + '">' + schema.typeLabel(item.type) + '</span>';
  }

  /** 已解决徽章，仅在进行中之外的卡片上出现。 */
  function resolvedBadge(item) {
    if (!item.resolved) return '';
    return '<span class="badge badge-done">' + schema.statusLabel(item.status) + '</span>';
  }

  /** 分类图标（决定颜色与图形）。 */
  function categoryIcon(item, size) {
    var meta = schema.categoryMeta(item.category);
    return { tone: meta.tone, html: icons.icon(meta.icon, { size: size || 24 }) };
  }

  /** 卡片底部的地点元信息。 */
  function locationMeta(item) {
    return '<span class="meta-item">' + icons.icon('location', { size: 12 }) +
      util.escapeHtml(item.location) + '</span>';
  }

  /**
   * 已被标记解决的信息整体降饱和，让用户一眼区分「还有效」与「已结束」。
   * 只降低视觉权重，不隐藏内容——历史记录仍有参考价值。
   */
  function cardClass(item, base) {
    return base + (item.resolved ? ' is-resolved' : '');
  }

  /**
   * 首页标准卡。
   * @param {object} item 已由 repository 规范化的信息
   */
  function homeCard(item) {
    var ic = categoryIcon(item, 24);
    var timeText = util.formatRelativeTime(item.publishedAt);
    return '' +
      '<a class="' + cardClass(item, 'info-card') + '" href="' + layout.detailUrl(item.id) + '">' +
        '<div class="card-icon ' + ic.tone + '">' + ic.html + '</div>' +
        '<div class="card-main">' +
          '<div class="card-top">' +
            typeBadge(item) +
            resolvedBadge(item) +
            '<span class="card-status">' + util.escapeHtml(timeText) + '</span>' +
          '</div>' +
          '<div class="card-title">' + util.escapeHtml(item.title) + '</div>' +
          '<div class="card-desc">' + util.escapeHtml(item.description) + '</div>' +
          '<div class="card-meta">' +
            locationMeta(item) +
            '<span class="dot">·</span>' +
            '<span>发布者：' + util.escapeHtml(item.publisher.name) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-arrow">' + icons.icon('chevron', { size: 16 }) + '</div>' +
      '</a>';
  }

  /**
   * 搜索页紧凑卡。
   * 时间用绝对日期（搜索结果更关心「什么时候」而非「多久前」）。
   */
  function resultCard(item) {
    var ic = categoryIcon(item, 28);
    return '' +
      '<a class="' + cardClass(item, 'result-card') + '" href="' + layout.detailUrl(item.id) + '">' +
        '<div class="card-thumb ' + ic.tone + '">' + ic.html + '</div>' +
        '<div class="card-main">' +
          '<div class="card-top">' +
            typeBadge(item) +
            resolvedBadge(item) +
            '<span class="card-status">' + util.escapeHtml(schema.statusLabel(item.status)) + '</span>' +
          '</div>' +
          '<div class="card-title">' + util.escapeHtml(item.title) + '</div>' +
          '<div class="card-desc">' + util.escapeHtml(item.description) + '</div>' +
          '<div class="card-meta">' +
            locationMeta(item) +
            '<span class="dot">·</span>' +
            '<span>' + util.escapeHtml(util.formatDate(item.lostAt)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-arrow">' + icons.icon('chevron', { size: 14 }) + '</div>' +
      '</a>';
  }

  /** 批量渲染，空列表返回空串。 */
  function renderList(items, renderer) {
    return (items || []).map(renderer).join('');
  }

  return {
    homeCard: homeCard,
    resultCard: resultCard,
    renderList: renderList,
    typeBadge: typeBadge,
    resolvedBadge: resolvedBadge
  };
});
