/* ==========================================================================
   js/core/schema.js —— 枚举与业务文案（领域常量唯一来源）
   把「寻物/招领」「寻找中/已找到/待认领/已归还」集中在这里，
   避免各页面把中文字面量散落一地导致口径不一致。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.schema = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------ 信息类型 */

  /**
   * LOST  寻物启事：我丢了东西，请大家帮我找
   * FOUND 失物招领：我捡到东西，请失主来认领
   */
  var TYPE = {
    LOST: 'lost',
    FOUND: 'found'
  };

  var TYPE_LABEL = {
    lost: '寻物',
    found: '招领'
  };

  /** 详情页/发布页用的完整说法 */
  var TYPE_FULL_LABEL = {
    lost: '寻物启事',
    found: '失物招领'
  };

  /* -------------------------------------------------------------- 状态 */

  /**
   * 状态由「类型 + resolved 布尔值」派生，而不是单独存储。
   * 好处：不可能出现「寻物 + 已归还」这类自相矛盾的组合。
   *
   *   lost  + 未解决 → 寻找中 (ongoing)
   *   lost  + 已解决 → 已找到 (found)
   *   found + 未解决 → 待认领 (waiting)
   *   found + 已解决 → 已归还 (returned)
   */
  var STATUS = {
    ONGOING: 'ongoing',
    WAITING: 'waiting',
    FOUND: 'found',
    RETURNED: 'returned'
  };

  var STATUS_META = {
    ongoing: { label: '寻找中', tone: 'blue', active: true },
    waiting: { label: '待认领', tone: 'amber', active: true },
    found: { label: '已找到', tone: 'green', active: false },
    returned: { label: '已归还', tone: 'green', active: false }
  };

  /** 由类型与解决与否派生状态码。 */
  function deriveStatus(type, resolved) {
    if (type === TYPE.LOST) return resolved ? STATUS.FOUND : STATUS.ONGOING;
    return resolved ? STATUS.RETURNED : STATUS.WAITING;
  }

  /** 状态码 → 元信息（未知状态退化为「寻找中」，保证页面不出现空白徽章）。 */
  function statusMeta(status) {
    return STATUS_META[status] || STATUS_META[STATUS.ONGOING];
  }

  /** 状态码 → 中文文案。 */
  function statusLabel(status) {
    return statusMeta(status).label;
  }

  /** 该状态是否仍可联系（已解决的信息不再鼓励联系，减少无效打扰）。 */
  function isActiveStatus(status) {
    return statusMeta(status).active === true;
  }

  /** 类型 → 中文文案。 */
  function typeLabel(type) {
    return TYPE_LABEL[type] || type;
  }

  /** 类型 → 完整中文文案。 */
  function typeFullLabel(type) {
    return TYPE_FULL_LABEL[type] || type;
  }

  /* -------------------------------------------------------------- 分类 */

  /**
   * 物品分类。category 决定卡片图标与配色，
   * 后续「按类别筛选」也复用这份定义。
   */
  var CATEGORY = {
    CARD: 'card',
    ELECTRONIC: 'electronic',
    UMBRELLA: 'umbrella',
    KEY: 'key',
    BOOK: 'book',
    CLOTHING: 'clothing',
    BOTTLE: 'bottle',
    OTHER: 'other'
  };
  var CATEGORY_META = {
    card: { label: '证件卡类', tone: 'blue', icon: 'card' },
    electronic: { label: '数码电子', tone: 'violet', icon: 'headphone' },
    umbrella: { label: '雨伞雨具', tone: 'amber', icon: 'umbrella' },
    key: { label: '钥匙挂件', tone: 'green', icon: 'key' },
    book: { label: '书籍资料', tone: 'violet', icon: 'book' },
    clothing: { label: '衣物配饰', tone: 'rose', icon: 'phone' },
    bottle: { label: '水杯餐具', tone: 'amber', icon: 'bottle' },
    other: { label: '其他物品', tone: 'cyan', icon: 'box' }
  };

  function categoryMeta(category) {
    return CATEGORY_META[category] || CATEGORY_META.other;
  }

  function categoryLabel(category) {
    return categoryMeta(category).label;
  }

  /** 供 <select> 使用的分类列表。 */
  function categoryOptions() {
    return Object.keys(CATEGORY_META).map(function (key) {
      return { value: key, label: CATEGORY_META[key].label };
    });
  }

  /* ---------------------------------------------------------- 联系方式 */

  var CONTACT = {
    WECHAT: 'wechat',
    QQ: 'qq',
    PHONE: 'phone',
    OTHER: 'other'
  };

  var CONTACT_META = {
    wechat: { label: '微信', placeholder: '请输入微信号' },
    qq: { label: 'QQ', placeholder: '请输入 QQ 号' },
    phone: { label: '手机', placeholder: '请输入手机号' },
    other: { label: '其他', placeholder: '请输入方便联系的方式' }
  };

  function contactMeta(type) {
    return CONTACT_META[type] || CONTACT_META.other;
  }

  function contactLabel(type) {
    return contactMeta(type).label;
  }

  function contactOptions() {
    return Object.keys(CONTACT_META).map(function (key) {
      return { value: key, label: CONTACT_META[key].label };
    });
  }

  /* ------------------------------------------------------------ 筛选选项 */

  /** 首页/搜索页的三个分段：全部 / 寻物 / 招领 */
  var TYPE_FILTERS = [
    { value: 'all', label: '全部' },
    { value: TYPE.LOST, label: '寻物' },
    { value: TYPE.FOUND, label: '招领' }
  ];

  /* ------------------------------------------------------------ 字段约束 */

  var LIMITS = {
    TITLE_MAX: 30,
    DESC_MAX: 200,
    LOCATION_MAX: 40,
    CONTACT_MAX: 60,
    PUBLISHER_MAX: 20,
    IMAGE_MAX: 3
  };

  return {
    TYPE: TYPE,
    STATUS: STATUS,
    CATEGORY: CATEGORY,
    CONTACT: CONTACT,
    CATEGORY_META: CATEGORY_META,
    CONTACT_META: CONTACT_META,
    TYPE_FILTERS: TYPE_FILTERS,
    LIMITS: LIMITS,
    deriveStatus: deriveStatus,
    statusMeta: statusMeta,
    statusLabel: statusLabel,
    isActiveStatus: isActiveStatus,
    typeLabel: typeLabel,
    typeFullLabel: typeFullLabel,
    categoryMeta: categoryMeta,
    categoryLabel: categoryLabel,
    categoryOptions: categoryOptions,
    contactMeta: contactMeta,
    contactLabel: contactLabel,
    contactOptions: contactOptions
  };
});
