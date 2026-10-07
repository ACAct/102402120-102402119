/* ==========================================================================
   js/pages/detail.js —— 信息详情页
   职责：按 ?id= 取出单条信息并完整展示，提供联系发布者与状态维护入口。
   关键设计：
     - 信息不存在（链接过期/被删除）时给出明确提示，而不是白屏；
     - 已解决的信息保留全部内容（便于核对），但联系方式降权，
       避免用户继续为已解决的物品发消息；
     - 联系方式提供一键复制，联系人不用手动选中文本。
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
  root.LF.pages.detail = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, schema, repository, layout, icons) {
  'use strict';

  /** 页面状态：当前展示的信息。 */
  var state = {
    id: '',
    item: null
  };

  /* ---------------------------------------------------------------- 渲染 */

  /** 状态徽章（寻找中 / 待认领 / 已找到 / 已归还）。 */
  function statusBadge(item) {
    var meta = schema.statusMeta(item.status);
    var tone = item.resolved ? 'badge-green' : (item.type === schema.TYPE.LOST ? 'badge-ongoing' : 'badge-waiting');
    return '<span class="badge-status ' + tone + '" id="statusBadge">' +
      '<span class="dot"></span>' + meta.label + '</span>';
  }

  /**
   * 时间与地点的标签随类型变化：
   * 寻物是「丢失时间/地点」，招领是「拾取时间/地点」。
   */
  function labels(item) {
    var isLost = item.type === schema.TYPE.LOST;
    return {
      time: isLost ? '丢失时间' : '拾取时间',
      location: isLost ? '丢失地点' : '拾取地点'
    };
  }

  /** Hero 区：分类图标 + 收藏按钮（装饰）。 */
  function renderHero(item) {
    var meta = schema.categoryMeta(item.category);
    return '' +
      '<div class="hero">' +
        '<div class="hero-ic">' + icons.icon(meta.icon, { size: 96, stroke: 1.2 }) + '</div>' +
        '<div class="hero-actions">' +
          '<span class="circ-btn" title="' + util.escapeHtml(schema.categoryLabel(item.category)) + '">' +
            icons.icon('star', { size: 16 }) + '</span>' +
        '</div>' +
      '</div>';
  }

  /** 标题区：类型徽章 + 状态徽章 + 名称 + 补充说明。 */
  function renderTitle(item) {
    var typeCls = item.type === schema.TYPE.FOUND ? 'badge-found' : 'badge-lost';
    return '' +
      '<div class="title-section">' +
        '<div class="title-tags">' +
          '<span class="badge ' + typeCls + '">' + schema.typeLabel(item.type) + '</span>' +
          statusBadge(item) +
          '<span class="badge badge-cat">' + util.escapeHtml(schema.categoryLabel(item.category)) + '</span>' +
        '</div>' +
        '<h1 class="title-main">' + util.escapeHtml(item.title) + '</h1>' +
        '<div class="title-sub">' + util.escapeHtml(item.locationDetail || schema.typeFullLabel(item.type)) + '</div>' +
      '</div>';
  }

  /** 详细信息卡片：时间、地点、描述、发布者、发布时间。 */
  function renderInfoCard(item) {
    var label = labels(item);
    var initial = item.publisher.name ? item.publisher.name.charAt(0) : '同';
    var avatarTone = item.type === schema.TYPE.FOUND ? ' amber' : '';

    return '' +
      '<div class="info-card-detail">' +
        '<div class="info-row">' +
          '<div class="label">' + icons.icon('clock', { size: 14 }) +
            '<span>' + label.time + '</span></div>' +
          '<div class="value">' + util.escapeHtml(util.formatDateTime(item.lostAt)) + '</div>' +
        '</div>' +
        '<div class="info-row">' +
          '<div class="label">' + icons.icon('location', { size: 14 }) +
            '<span>' + label.location + '</span></div>' +
          '<div class="value">' + util.escapeHtml(item.location) + '</div>' +
        '</div>' +
        '<div class="info-row">' +
          '<div class="label">' + icons.icon('list', { size: 14 }) + '<span>物品描述</span></div>' +
          '<div class="value left-align">' +
            (item.description ? util.escapeHtml(item.description) : '发布者未填写补充描述') +
          '</div>' +
        '</div>' +
        '<div class="publisher-row">' +
          '<div class="avatar' + avatarTone + '">' + util.escapeHtml(initial) + '</div>' +
          '<div class="publisher-info">' +
            '<div class="publisher-name">' + util.escapeHtml(item.publisher.name) + '</div>' +
            '<div class="publisher-meta">' +
              util.escapeHtml(item.publisher.dept || '未填写院系') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="info-row">' +
          '<div class="label">' + icons.icon('clock', { size: 14 }) + '<span>发布时间</span></div>' +
          '<div class="value">' + util.escapeHtml(util.formatRelativeTime(item.publishedAt)) + '</div>' +
        '</div>' +
        (item.resolved && item.resolvedAt
          ? '<div class="info-row">' +
              '<div class="label">' + icons.icon('checkCircle', { size: 14 }) + '<span>解决时间</span></div>' +
              '<div class="value">' + util.escapeHtml(util.formatDateTime(item.resolvedAt)) + '</div>' +
            '</div>'
          : '') +
      '</div>';
  }

  /**
   * 生成 HTML 属性值。
   * JSON.stringify 会同时转义引号、反斜杠与控制字符，比手工拼接更可靠；
   * 联系方式可能包含中文、括号等任意字符，直接拼进属性容易破坏标签结构。
   */
  function attr(value) {
    return util.escapeHtml(JSON.stringify(String(value == null ? '' : value)));
  }

  /**
   * 联系方式卡片。
   * 进行中：正常展示 + 一键复制；
   * 已解决：降权展示 + 明确说明「物品已找回/已归还」，避免无效联系。
   */
  function renderContactCard(item) {
    var active = schema.isActiveStatus(item.status);
    var contactLabel = schema.contactLabel(item.contactType);
    var hasValue = !!item.contactValue;

    return '' +
      '<div class="contact-card' + (active ? '' : ' is-inactive') + '" id="contactCard">' +
        '<div class="contact-head">' + icons.icon('chat', { size: 16 }) +
          '<span>' + (active ? '联系发布者' : '联系方式（信息已结束）') + '</span>' +
        '</div>' +
        (hasValue
          ? '<div class="contact-body">' +
              '<span class="ct-type">' + util.escapeHtml(contactLabel) + '</span>' +
              '<span class="ct-value" id="contactValue">' + util.escapeHtml(item.contactValue) + '</span>' +
              '<button type="button" class="ct-copy" id="copyBtn" data-copy=' + attr(item.contactValue) + '>' +
                icons.icon('copy', { size: 13 }) + '复制' +
              '</button>' +
            '</div>'
          : '<div class="contact-body"><span class="ct-value">发布者未提供联系方式</span></div>') +
        (active
          ? '<div class="contact-note">请先核对物品特征，确认归属后再联系；平台不参与任何金钱交易。</div>'
          : '<div class="contact-note">该信息已被标记为「' + util.escapeHtml(schema.statusLabel(item.status)) +
            '」，无需再联系发布者。如果你也有类似物品丢失，可以搜索同类信息或发布自己的寻物启事。</div>') +
      '</div>';
  }

  /** 底部固定操作区。 */
  function renderBottomBar(item) {
    if (schema.isActiveStatus(item.status)) {
      return '' +
        '<div class="bottom-bar">' +
          '<button type="button" class="btn-primary" id="contactBtn">' +
            icons.icon('chat', { size: 18 }) + '联系发布者' +
          '</button>' +
        '</div>';
    }
    return '' +
      '<div class="bottom-bar">' +
        '<div class="resolved-strip">' + icons.icon('shield', { size: 18 }) +
          (item.type === schema.TYPE.LOST ? '已找到物品，感谢配合！' : '已归还失主，感谢配合！') +
        '</div>' +
        '<button type="button" class="btn-done" disabled>' +
          icons.icon('check', { size: 18 }) + '已完成，无需联系' +
        '</button>' +
      '</div>';
  }

  /** 信息不存在时的页面（链接过期、被删除或手输入错）。 */
  function renderNotFound() {
    document.title = '信息不存在 · 校园失物招领';
    util.setHtml(document.getElementById('content'),
      layout.navbar('信息详情', { floating: true }) +
      layout.emptyState({
        icon: 'alert',
        title: '这条信息不存在或已被删除',
        sub: '可能链接已经过期，也可能发布者撤销了这条信息。',
        actionLabel: '返回首页浏览',
        actionHref: layout.ROUTES.home,
        visible: true
      }));
    util.setHtml(document.getElementById('bottomBar'), '');
  }

  /** 正常渲染整页。 */
  function render(item) {
    document.title = item.title + ' · 校园失物招领';
    util.setHtml(document.getElementById('content'),
      layout.navbar('', { floating: true }) +
      renderHero(item) +
      renderTitle(item) +
      renderInfoCard(item) +
      renderContactCard(item) +
      '<div class="safety-tip">' + icons.icon('alert', { size: 16 }) +
        '<span>请勿向任何人转账、发送验证码或提供身份证号、银行卡号；' +
        '线下交付建议选择图书馆、宿舍楼下等公共场所。</span>' +
      '</div>' +
      '<div class="detail-extra">' +
        '<a class="extra-btn" href="' + layout.searchUrl(item.title, 'all') + '">' +
          icons.icon('search', { size: 15 }) + '搜索同类信息' +
        '</a>' +
        '<a class="extra-btn" href="' + layout.ROUTES.publish + '?type=' +
          (item.type === schema.TYPE.LOST ? 'found' : 'lost') + '">' +
          icons.icon('plus', { size: 15 }) +
          (item.type === schema.TYPE.LOST ? '我捡到了，发布招领' : '我丢了，发布寻物') +
        '</a>' +
      '</div>' +
      '<div style="height:40px"></div>');
    util.setHtml(document.getElementById('bottomBar'), renderBottomBar(item));
  }

  /* ---------------------------------------------------------------- 交互 */

  /** 滚动到联系方式并短暂高亮，让用户知道「联系发布者」做了什么。 */
  function focusContactCard() {
    var card = document.getElementById('contactCard');
    if (!card) return;
    if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (card.classList) {
      card.classList.add('pulse');
      setTimeout(function () { card.classList.remove('pulse'); }, 1200);
    }
  }

  function bindEvents() {
    var content = document.getElementById('content');
    var bottomBar = document.getElementById('bottomBar');

    // 一键复制联系方式
    util.delegate(content, 'click', '#copyBtn', function (event, el) {
      event.preventDefault();
      event.stopPropagation();
      var text = el.getAttribute('data-copy') || '';
      if (!text) return;
      layout.copyText(text).then(function (ok) {
        layout.toast(ok ? '联系方式已复制' : '复制失败，请手动长按选择');
      });
    });

    // 联系发布者 → 定位到联系方式卡片
    util.delegate(bottomBar, 'click', '#contactBtn', function (event) {
      event.preventDefault();
      focusContactCard();
    });
  }

  /* ---------------------------------------------------------------- 初始化 */

  function init() {
    layout.bindGlobalNav();

    document.getElementById('chrome').innerHTML = layout.chrome();
    document.getElementById('statusBar').innerHTML = layout.statusBar();

    state.id = util.getQuery('id');
    state.item = repository.get(state.id);

    if (!state.item) {
      renderNotFound();
    } else {
      render(state.item);
    }
    bindEvents();
  }

  return {
    init: init,
    state: state,
    render: render,
    renderNotFound: renderNotFound,
    focusContactCard: focusContactCard
  };
});
