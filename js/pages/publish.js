/* ==========================================================================
   js/pages/publish.js —— 发布页
   职责：收集表单 → 字段级即时校验 → 提交入库 → 跳转发布成功页。
   设计要点：
     - 校验失败时逐字段标红并给出具体原因，同时把首个错误滚动到可视区；
     - 表单值实时保存在内存中，切换类型（寻物/招领）不会丢失已填内容；
     - 「丢失时间」默认取当前时间，减少必填项的操作成本。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(
    root.LF.util,
    root.LF.schema,
    root.LF.item,
    root.LF.repository,
    root.LF.layout,
    root.LF.icons
  );
  root.LF.pages = root.LF.pages || {};
  root.LF.pages.publish = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, schema, itemModel, repository, layout, icons) {
  'use strict';

  var LIMITS = schema.LIMITS;

  /** 表单状态：与 DOM 值保持同步，用于校验与提交。 */
  var state = {
    type: schema.TYPE.LOST,
    title: '',
    description: '',
    category: 'other',
    location: '',
    locationDetail: '',
    lostAt: '',
    contactType: schema.CONTACT.WECHAT,
    contactValue: '',
    publisherName: '',
    publisherDept: ''
  };

  /** 本次校验产生的错误，键为字段名。 */
  var errors = {};

  /* ---------------------------------------------------------------- 文案 */

  /** 时间/地点标签随类型变化。 */
  function labels() {
    var isLost = state.type === schema.TYPE.LOST;
    return {
      time: isLost ? '丢失时间' : '拾取时间',
      location: isLost ? '丢失地点' : '拾取地点',
      timePlaceholder: isLost ? '请选择丢失时间' : '请选择拾取时间',
      locationPlaceholder: isLost ? '请输入丢失地点' : '请输入拾取地点',
      titlePlaceholder: isLost ? '例如：黑色校园卡' : '例如：捡到一把雨伞',
      submit: isLost ? '发布寻物启事' : '发布失物招领'
    };
  }

  /** 把时间戳转成 <input type="datetime-local"> 需要的 'YYYY-MM-DDTHH:mm'。 */
  function toLocalInputValue(timestamp) {
    var date = util.toDate(timestamp);
    if (isNaN(date.getTime())) return '';
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  /* ---------------------------------------------------------------- 渲染 */

  /** 类型选择卡片。 */
  function renderTypeCards() {
    var isLost = state.type === schema.TYPE.LOST;
    return '' +
      '<div class="type-row">' +
        '<button type="button" class="type-card' + (isLost ? ' active' : '') + '" data-type="lost">' +
          '<span class="type-icon">' + icons.icon('search', { size: 22 }) + '</span>' +
          '<span><span class="type-label">我要寻物</span>' +
          '<span class="type-sub">我丢了东西，请大家帮忙</span></span>' +
        '</button>' +
        '<button type="button" class="type-card' + (!isLost ? ' active' : '') + '" data-type="found">' +
          '<span class="type-icon">' + icons.icon('gift', { size: 22 }) + '</span>' +
          '<span><span class="type-label">我要招领</span>' +
          '<span class="type-sub">我捡到东西，寻找失主</span></span>' +
        '</button>' +
      '</div>';
  }

  /** 单个表单字段的错误提示。 */
  function fieldError(name) {
    return errors[name]
      ? '<div class="field-error">' + icons.icon('alert', { size: 13 }) +
        util.escapeHtml(errors[name]) + '</div>'
      : '';
  }

  /** 给字段容器加上错误态样式。 */
  function fieldClass(name, base) {
    return base + (errors[name] ? ' has-error' : '');
  }

  /** 分类下拉选项。 */
  function renderCategoryOptions() {
    return schema.categoryOptions().map(function (option) {
      return '<option value="' + option.value + '"' +
        (option.value === state.category ? ' selected' : '') + '>' +
        util.escapeHtml(option.label) + '</option>';
    }).join('');
  }

  /** 联系方式类型选项。 */
  function renderContactOptions() {
    return schema.contactOptions().map(function (option) {
      return '<option value="' + option.value + '"' +
        (option.value === state.contactType ? ' selected' : '') + '>' +
        util.escapeHtml(option.label) + '</option>';
    }).join('');
  }

  /** 整个表单。 */
  function renderForm() {
    var label = labels();
    return '' +
      renderTypeCards() +

      // 物品名称
      '<div class="form-group">' +
        '<label class="form-label" for="f-title">物品名称 <span class="req">*</span>' +
          '<span class="hint" id="titleCount">' + state.title.length + ' / ' + LIMITS.TITLE_MAX + '</span>' +
        '</label>' +
        '<input id="f-title" class="' + fieldClass('title', 'form-input') + '" type="text"' +
          ' maxlength="' + LIMITS.TITLE_MAX + '" data-field="title"' +
          ' placeholder="' + util.escapeHtml(label.titlePlaceholder) + '"' +
          ' value="' + util.escapeHtml(state.title) + '" />' +
        fieldError('title') +
      '</div>' +

      // 物品分类
      '<div class="form-group">' +
        '<label class="form-label" for="f-category">物品分类' +
          '<span class="hint">用于按类别浏览</span></label>' +
        '<div class="form-select">' +
          '<select id="f-category" class="' + fieldClass('category', 'form-input') + '" data-field="category">' +
            renderCategoryOptions() +
          '</select>' +
          '<span class="arrow">' + icons.icon('chevronDown', { size: 16 }) + '</span>' +
        '</div>' +
        fieldError('category') +
      '</div>' +

      // 时间
      '<div class="form-group">' +
        '<label class="form-label" for="f-lostAt">' + label.time + ' <span class="req">*</span></label>' +
        '<input id="f-lostAt" class="' + fieldClass('lostAt', 'form-input') + '"' +
          ' type="datetime-local" data-field="lostAt"' +
          ' value="' + util.escapeHtml(state.lostAt) + '" />' +
        fieldError('lostAt') +
      '</div>' +

      // 地点
      '<div class="form-group">' +
        '<label class="form-label" for="f-location">' + label.location + ' <span class="req">*</span>' +
          '<span class="hint">' + LIMITS.LOCATION_MAX + ' 字以内</span></label>' +
        '<input id="f-location" class="' + fieldClass('location', 'form-input') + '" type="text"' +
          ' maxlength="' + LIMITS.LOCATION_MAX + '" data-field="location"' +
          ' placeholder="' + util.escapeHtml(label.locationPlaceholder) + '"' +
          ' value="' + util.escapeHtml(state.location) + '" />' +
        fieldError('location') +
      '</div>' +

      // 地点补充
      '<div class="form-group">' +
        '<label class="form-label" for="f-locationDetail">地点补充说明' +
          '<span class="hint">选填，例如「三楼靠窗自习区」</span></label>' +
        '<input id="f-locationDetail" class="form-input" type="text" maxlength="40"' +
          ' data-field="locationDetail" placeholder="让线索更精确，有助于快速找回"' +
          ' value="' + util.escapeHtml(state.locationDetail) + '" />' +
      '</div>' +

      // 描述
      '<div class="form-group">' +
        '<label class="form-label" for="f-description">物品描述' +
          '<span class="hint">特征、颜色、特殊标记</span></label>' +
        '<textarea id="f-description" class="' + fieldClass('description', 'form-textarea') + '"' +
          ' maxlength="' + LIMITS.DESC_MAX + '" data-field="description"' +
          ' placeholder="描述得越具体，越容易被认出来（选填）">' +
          util.escapeHtml(state.description) + '</textarea>' +
        '<div class="counter"><span id="descCount">' + state.description.length +
          '</span> / ' + LIMITS.DESC_MAX + '</div>' +
        fieldError('description') +
      '</div>' +

      // 联系方式
      '<div class="form-group">' +
        '<label class="form-label" for="f-contactValue">联系方式 <span class="req">*</span></label>' +
        '<div class="' + fieldClass('contactValue', 'contact-bar') + '">' +
          '<div class="form-select-inline">' +
            '<select class="contact-type" data-field="contactType" aria-label="联系方式类型">' +
              renderContactOptions() +
            '</select>' +
            icons.icon('chevronDown', { size: 12, cls: 'chev' }) +
          '</div>' +
          '<input id="f-contactValue" class="contact-val" type="text" maxlength="' + LIMITS.CONTACT_MAX + '"' +
            ' data-field="contactValue"' +
            ' placeholder="' + util.escapeHtml(schema.contactMeta(state.contactType).placeholder) + '"' +
            ' value="' + util.escapeHtml(state.contactValue) + '" />' +
        '</div>' +
        fieldError('contactType') +
        fieldError('contactValue') +
      '</div>' +

      // 发布者
      '<div class="form-group">' +
        '<label class="form-label" for="f-publisherName">你的称呼 <span class="req">*</span>' +
          '<span class="hint">例如「林同学」</span></label>' +
        '<input id="f-publisherName" class="' + fieldClass('publisherName', 'form-input') + '" type="text"' +
          ' maxlength="' + LIMITS.PUBLISHER_MAX + '" data-field="publisherName"' +
          ' placeholder="方便同学称呼你就好"' +
          ' value="' + util.escapeHtml(state.publisherName) + '" />' +
        fieldError('publisherName') +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label" for="f-publisherDept">院系（选填）</label>' +
        '<input id="f-publisherDept" class="form-input" type="text" maxlength="30"' +
          ' data-field="publisherDept" placeholder="例如：计算机学院 · 大三"' +
          ' value="' + util.escapeHtml(state.publisherDept) + '" />' +
      '</div>' +

      // 安全提示
      '<div class="safety-tip">' + icons.icon('alert', { size: 16 }) +
        '<span>请勿填写身份证号、银行卡号等敏感信息；仅在确认物品归属后再归还或交付，' +
        '平台不参与任何金钱交易。</span>' +
      '</div>';
  }

  /** 底部按钮文案随类型变化。 */
  function renderBottomBar() {
    return '<button type="button" class="btn-primary" id="submitBtn">' +
      util.escapeHtml(labels().submit) + '</button>';
  }

  /** 整体渲染：内容区 + 底部按钮。 */
  function render() {
    util.setHtml(document.getElementById('content'),
      renderForm() + '<div style="height:20px"></div>');
    util.setHtml(document.getElementById('bottomBar'), renderBottomBar());
  }

  /* ------------------------------------------------------------ 表单同步 */

  /** 从 DOM 读取全部表单值写入 state（重绘前调用，避免丢输入）。 */
  function syncFromDom() {
    var fields = document.querySelectorAll('[data-field]');
    Array.prototype.forEach.call(fields, function (el) {
      var key = el.getAttribute('data-field');
      if (key && Object.prototype.hasOwnProperty.call(state, key)) {
        state[key] = el.value;
      }
    });
  }

  /* ---------------------------------------------------------------- 校验 */

  /**
   * 表单校验：复用领域模型的规则，再补充「发布者称呼」这项表单专有要求。
   * @returns {boolean} 是否通过
   */
  function validateForm() {
    var result = itemModel.validate({
      type: state.type,
      title: state.title,
      description: state.description,
      category: state.category,
      location: state.location,
      lostAt: state.lostAt,
      contactType: state.contactType,
      contactValue: state.contactValue
    });

    errors = {};
    Object.keys(result.errors).forEach(function (key) { errors[key] = result.errors[key]; });

    // 发布者称呼属于表单字段，领域模型里放在 publisher.name
    if (!util.normalize(state.publisherName)) {
      errors.publisherName = '请填写你的称呼，方便同学联系你';
    } else if (state.publisherName.length > LIMITS.PUBLISHER_MAX) {
      errors.publisherName = '称呼不超过 ' + LIMITS.PUBLISHER_MAX + ' 字';
    }

    return Object.keys(errors).length === 0;
  }

  /** 把首个出错的字段滚动到可视区并聚焦，减少用户来回找错的位置。 */
  function focusFirstError() {
    var names = Object.keys(errors);
    if (!names.length) return;
    var el = document.querySelector('[data-field="' + names[0] + '"]');
    if (!el) return;
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el.focus) el.focus();
  }

  /* ---------------------------------------------------------------- 提交 */

  /** 提交：校验 → 入库 → 跳转成功页。 */
  function submit() {
    syncFromDom();

    if (!validateForm()) {
      render();
      focusFirstError();
      layout.toast('还有 ' + Object.keys(errors).length + ' 项需要完善');
      return;
    }

    var created = itemModel.create({
      type: state.type,
      title: state.title,
      description: state.description,
      category: state.category,
      location: state.location,
      locationDetail: state.locationDetail,
      lostAt: state.lostAt,
      contactType: state.contactType,
      contactValue: state.contactValue,
      publisher: { name: state.publisherName, dept: state.publisherDept }
    }, { now: Date.now() });

    if (!created.ok) {
      // 理论上不会走到这里（校验已通过），但保留兜底避免静默失败
      errors = created.errors || {};
      render();
      layout.toast('发布失败，请检查填写内容');
      return;
    }

    repository.add(created.item);

    // 记录本次使用的称呼，供「我的发布」筛出自己发布的信息。
    // 本项目不引入登录体系，用浏览器本地标记代替账号身份。
    util.storage.set('lf.myPublisher.v1', created.item.publisher.name);

    layout.go('success', 'id=' + encodeURIComponent(created.item.id));
  }

  /* ---------------------------------------------------------------- 交互 */

  /** 切换信息类型：保留已填内容，只更换标签与占位文案。 */
  function setType(type) {
    if (type !== schema.TYPE.LOST && type !== schema.TYPE.FOUND) return;
    if (state.type === type) return;
    syncFromDom();
    state.type = type;
    errors = {};
    render();
  }

  function bindEvents() {
    var content = document.getElementById('content');
    var bottomBar = document.getElementById('bottomBar');

    // 类型选择
    util.delegate(content, 'click', '.type-card', function (event, el) {
      event.preventDefault();
      setType(el.getAttribute('data-type'));
    });

    // 输入：同步 state 并更新计数 / 清除该项错误
    content.addEventListener('input', function (event) {
      var el = event.target;
      if (!el || !el.getAttribute) return;
      var key = el.getAttribute('data-field');
      if (!key) return;
      state[key] = el.value;

      if (key === 'title') {
        var tc = document.getElementById('titleCount');
        if (tc) tc.textContent = el.value.length + ' / ' + LIMITS.TITLE_MAX;
      }
      if (key === 'description') {
        var dc = document.getElementById('descCount');
        if (dc) dc.textContent = el.value.length;
      }
      // 用户开始修正时立即去掉该项的错误样式，反馈更及时
      if (errors[key] && el.classList) {
        el.classList.remove('has-error');
        var box = el.closest ? el.closest('.form-group') : null;
        if (box) {
          var msg = box.querySelector('.field-error');
          if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
        }
        delete errors[key];
      }
    });

    // 下拉切换（change 才可靠）
    content.addEventListener('change', function (event) {
      var el = event.target;
      if (!el || !el.getAttribute) return;
      var key = el.getAttribute('data-field');
      if (!key) return;
      state[key] = el.value;
      // 联系方式类型变化时同步占位提示
      if (key === 'contactType') {
        var input = document.querySelector('[data-field="contactValue"]');
        if (input) input.setAttribute('placeholder', schema.contactMeta(el.value).placeholder);
      }
    });

    // 提交
    util.delegate(bottomBar, 'click', '#submitBtn', function (event) {
      event.preventDefault();
      submit();
    });
  }

  /* ---------------------------------------------------------------- 初始化 */

  function init() {
    layout.bindGlobalNav();

    document.getElementById('chrome').innerHTML = layout.chrome();
    document.getElementById('statusBar').innerHTML = layout.statusBar();
    util.setHtml(document.getElementById('navSlot'),
      layout.navbar('发布信息', { backTo: 'home' }));

    // 从首页「我要寻物/我要招领」带 ?type= 进入时预选类型
    var initialType = util.getQuery('type');
    if (initialType === schema.TYPE.FOUND || initialType === schema.TYPE.LOST) {
      state.type = initialType;
    }
    // 时间默认取当前时间（取整到分钟），减少一次必填操作
    var now = new Date();
    now.setSeconds(0, 0);
    state.lostAt = toLocalInputValue(now.getTime());

    bindEvents();
    render();
  }

  return {
    init: init,
    render: render,
    submit: submit,
    setType: setType,
    validateForm: validateForm,
    syncFromDom: syncFromDom,
    state: state,
    errors: function () { return errors; }
  };
});
