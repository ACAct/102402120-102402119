/* ==========================================================================
   js/data/item.js —— Item 领域模型
   职责：
     1. defineSchema() —— 字段规范（类型/必填/长度/枚举），是数据结构的自描述
     2. normalize()    —— 外部数据（种子、本地存储、以后的接口）统一收敛成合法 Item
     3. validate()     —— 表单校验，返回逐字段错误，供发布页提示
     4. create()       —— 新建一条信息（生成 id 与时间戳）
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('../core/schema.js') : root.LF.schema,
    isNode ? require('../core/util.js') : root.LF.util
  );
  if (isNode) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.item = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (schema, util) {
  'use strict';

  var TYPE = schema.TYPE;
  var LIMITS = schema.LIMITS;

  /**
   * 合法分类集合。
   * 以 CATEGORY_META 的键为准——它才是「分类是否存在」的唯一来源。
   * 用 CATEGORY 的键（CARD/ELECTRONIC…）做校验会得到大写常量名，属于典型错误。
   */
  function allowedCategories() {
    return Object.keys(schema.CATEGORY_META);
  }

  /** 合法联系方式集合。 */
  function allowedContacts() {
    return Object.keys(schema.CONTACT_META);
  }

  /* ------------------------------------------------------------ 字段规范 */

  /**
   * 数据结构自描述表。
   * 校验、文档与后续接口对接都以这里为准，避免「文档写一套、代码写一套」。
   */
  function defineSchema() {
    return [
      { key: 'id', label: '信息编号', type: 'string', required: true, note: '同一仓库内唯一' },
      { key: 'type', label: '信息类型', type: 'enum', required: true, values: [TYPE.LOST, TYPE.FOUND], note: 'lost 寻物 / found 招领' },
      { key: 'title', label: '物品名称', type: 'string', required: true, maxLength: LIMITS.TITLE_MAX },
      { key: 'description', label: '物品描述', type: 'string', required: false, maxLength: LIMITS.DESC_MAX },
      { key: 'category', label: '物品分类', type: 'enum', required: false, values: allowedCategories(), default: 'other' },
      { key: 'location', label: '丢失/拾取地点', type: 'string', required: true, maxLength: LIMITS.LOCATION_MAX },
      { key: 'locationDetail', label: '地点补充说明', type: 'string', required: false },
      { key: 'lostAt', label: '丢失/拾取时间', type: 'datetime', required: true, note: '不得晚于当前时间' },
      { key: 'contactType', label: '联系方式类型', type: 'enum', required: true, values: allowedContacts() },
      { key: 'contactValue', label: '联系方式', type: 'string', required: true, maxLength: LIMITS.CONTACT_MAX },
      { key: 'publisher.name', label: '发布者', type: 'string', required: true, maxLength: LIMITS.PUBLISHER_MAX },
      { key: 'publisher.dept', label: '发布者院系', type: 'string', required: false },
      { key: 'resolved', label: '是否已解决', type: 'boolean', required: false, default: false },
      { key: 'status', label: '当前状态', type: 'derived', required: false, note: '由 type + resolved 派生，不接收外部赋值' },
      { key: 'publishedAt', label: '发布时间', type: 'datetime', required: false, note: '由系统自动写入' }
    ];
  }

  /** 所有合法字段名，用于过滤外部脏数据。 */
  function allowedKeys() {
    return ['id', 'type', 'title', 'description', 'category', 'location', 'locationDetail',
      'lostAt', 'publishedAt', 'resolvedAt', 'contactType', 'contactValue',
      'publisher', 'resolved', 'status'];
  }

  /* -------------------------------------------------------------- 取值助手 */

  function text(value, fallback) {
    if (value == null) return fallback == null ? '' : fallback;
    var str = String(value).replace(/\s+/g, ' ').trim();
    return str === '' ? (fallback == null ? '' : fallback) : str;
  }

  function bool(value, fallback) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return fallback === true;
  }

  /** 时间容错：非法值退化为参考时间，保证列表排序与展示不会出现 NaN。 */
  function timestamp(value, fallback) {
    var date = util.toDate(value);
    return isNaN(date.getTime()) ? fallback : date.getTime();
  }

  function pickEnum(value, values, fallback) {
    var str = text(value);
    return values.indexOf(str) >= 0 ? str : fallback;
  }

  /**
   * 生成信息编号：LF + 类型首字母 + 日期 + 随机后缀。
   * 便于人工核对（看得出类型与大致创建时间），且不依赖后端自增主键。
   */
  function nextId(type, now) {
    var stamp = new Date(now || Date.now());
    var datePart = stamp.getFullYear() +
      ('0' + (stamp.getMonth() + 1)).slice(-2) +
      ('0' + stamp.getDate()).slice(-2);
    var randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
    return 'LF' + (type === TYPE.FOUND ? 'F' : 'L') + datePart + randomPart;
  }

  /* -------------------------------------------------------------- 规范化 */

  /**
   * 把任意来源的数据收敛为结构一致的 Item。
   * 关键约定：
   *   - status 永远由 type + resolved 派生，不信任外部传入的状态值；
   *   - 未知字段被丢弃，缺少的可选字段补默认值；
   *   - 时间非法时退化而非报错，避免一条脏数据让整页白屏。
   */
  function normalize(raw, options) {
    var input = raw || {};
    var opts = options || {};
    var now = opts.now == null ? Date.now() : new Date(opts.now).getTime();
    var clean = {};

    allowedKeys().forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(input, key)) clean[key] = input[key];
    });

    var type = pickEnum(clean.type, [TYPE.LOST, TYPE.FOUND], TYPE.LOST);
    var resolved = bool(clean.resolved, false);
    var publisherInput = clean.publisher && typeof clean.publisher === 'object' ? clean.publisher : {};

    var item = {
      id: text(clean.id) || nextId(type, now),
      type: type,
      title: text(clean.title, '未命名物品'),
      description: text(clean.description),
      category: pickEnum(clean.category, allowedCategories(), 'other'),
      location: text(clean.location, '地点待补充'),
      locationDetail: text(clean.locationDetail),
      lostAt: timestamp(clean.lostAt, now),
      publishedAt: timestamp(clean.publishedAt, now),
      contactType: pickEnum(clean.contactType, allowedContacts(), 'other'),
      contactValue: text(clean.contactValue),
      publisher: {
        name: text(publisherInput.name, '匿名同学'),
        dept: text(publisherInput.dept)
      },
      resolved: resolved,
      resolvedAt: resolved ? timestamp(clean.resolvedAt, null) : null
    };

    item.status = schema.deriveStatus(item.type, item.resolved);
    return item;
  }

  /* ---------------------------------------------------------------- 校验 */

  /**
   * 表单校验。
   * @returns {{valid: boolean, errors: Object, messages: string[]}}
   *          errors 以字段名为键，便于逐项高亮
   */
  function validate(raw, options) {
    var input = raw || {};
    var opts = options || {};
    var now = opts.now == null ? Date.now() : new Date(opts.now).getTime();
    var errors = {};

    // 类型
    if ([TYPE.LOST, TYPE.FOUND].indexOf(text(input.type)) < 0) {
      errors.type = '请选择信息类型（寻物或招领）';
    }

    // 物品名称
    var title = text(input.title);
    if (!title) {
      errors.title = '请填写物品名称';
    } else if (title.length > LIMITS.TITLE_MAX) {
      errors.title = '物品名称不超过 ' + LIMITS.TITLE_MAX + ' 字';
    }

    // 描述（选填，但填了就要符合长度）
    var description = text(input.description);
    if (description.length > LIMITS.DESC_MAX) {
      errors.description = '物品描述不超过 ' + LIMITS.DESC_MAX + ' 字';
    }

    // 地点
    var location = text(input.location);
    if (!location) {
      errors.location = '请填写丢失/拾取地点';
    } else if (location.length > LIMITS.LOCATION_MAX) {
      errors.location = '地点不超过 ' + LIMITS.LOCATION_MAX + ' 字';
    }

    // 时间：必填且不能是未来
    var lostAt = opts.lostAt instanceof Date ? opts.lostAt : util.toDate(input.lostAt);
    if (!input.lostAt || isNaN(lostAt.getTime())) {
      errors.lostAt = '请选择丢失/拾取时间';
    } else if (lostAt.getTime() > now + 60 * 1000) {
      // 允许 1 分钟时钟误差
      errors.lostAt = '时间不能晚于当前时间';
    }

    // 联系方式
    if (allowedContacts().indexOf(text(input.contactType)) < 0) {
      errors.contactType = '请选择联系方式类型';
    }
    var contactValue = text(input.contactValue);
    if (!contactValue) {
      errors.contactValue = '请填写联系方式';
    } else if (contactValue.length > LIMITS.CONTACT_MAX) {
      errors.contactValue = '联系方式不超过 ' + LIMITS.CONTACT_MAX + ' 字';
    }

    // 分类（选填）
    var category = text(input.category);
    if (category && allowedCategories().indexOf(category) < 0) {
      errors.category = '物品分类不合法';
    }

    var keys = Object.keys(errors);
    return {
      valid: keys.length === 0,
      errors: errors,
      messages: keys.map(function (key) { return errors[key]; })
    };
  }

  /* ---------------------------------------------------------------- 创建 */

  /**
   * 由表单数据创建一条新信息。
   * @param {object} input 表单值
   * @param {object} [options] { now } 便于测试固定时间
   */
  function create(input, options) {
    var opts = options || {};
    var now = opts.now == null ? Date.now() : new Date(opts.now).getTime();
    // 先按本地时间规则解析一次，validate 与 normalize 复用同一结果，
    // 避免「校验通过但落库时间不同」这类隐蔽的解析不一致问题。
    var lostAt = util.toDate(input && input.lostAt);
    var check = validate(input, { now: now, lostAt: lostAt });
    if (!check.valid) {
      return { ok: false, errors: check.errors, messages: check.messages };
    }

    var item = normalize({
      id: nextId(input.type, now),
      type: text(input.type),
      title: text(input.title),
      description: text(input.description),
      category: text(input.category, 'other'),
      location: text(input.location),
      locationDetail: text(input.locationDetail),
      lostAt: lostAt.getTime(),
      publishedAt: now,
      contactType: text(input.contactType),
      contactValue: text(input.contactValue),
      publisher: input.publisher || {},
      resolved: false
    }, { now: now });

    return { ok: true, item: item };
  }

  /* ------------------------------------------------------------ 状态变更 */

  /** 状态流转结果（纯函数，便于测试；副作用交给 repository）。 */
  function applyResolved(item, resolved, options) {
    var opts = options || {};
    var now = opts.now == null ? Date.now() : new Date(opts.now).getTime();
    return normalize(Object.assign({}, item, {
      resolved: resolved === true,
      resolvedAt: resolved === true ? now : null
    }), { now: now });
  }

  return {
    defineSchema: defineSchema,
    allowedKeys: allowedKeys,
    allowedCategories: allowedCategories,
    allowedContacts: allowedContacts,
    normalize: normalize,
    validate: validate,
    create: create,
    applyResolved: applyResolved,
    nextId: nextId
  };
});
