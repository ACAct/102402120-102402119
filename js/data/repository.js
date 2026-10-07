/* ==========================================================================
   js/data/repository.js —— 数据访问层（唯一的数据出入口）
   页面不直接读写 localStorage，只调用这里的 list/get/save/add/updateStatus。

   为什么要有这一层：
     - file:// 下 localStorage 可能不可用，必须静默退化为内存态；
     - item 需要统一规范化后再返回，避免脏数据传到视图层；
     - 查询与写入顺序（按发布时间倒序）只在这里定义一次。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./seed.js') : root.LF.seed,
    isNode ? require('./item.js') : root.LF.item,
    isNode ? require('../core/util.js') : root.LF.util,
    isNode ? require('../core/schema.js') : root.LF.schema
  );
  if (isNode) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.repository = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (seed, itemModel, util, schema) {
  'use strict';

  var STORAGE_KEY = 'lf.items.v1';
  var SEED_FLAG_KEY = 'lf.seeded.v1';

  /** 内存缓存：初始化时一次性载入，之后读写都走内存。 */
  var cache = null;

  /**
   * 是否可以使用持久化存储。
   * 不可用时（例如部分浏览器在 file:// 下的安全限制）应用仍完全可用，
   * 只是刷新后回到初始演示数据——这一点会在 README 中说明。
   */
  function storageAvailable() {
    return !!(util.storage && util.storage.available());
  }

  /** 按发布时间倒序（最新在前）；时间相同时按 id 稳定排序。 */
  function byPublishedDesc(a, b) {
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
    return String(a.id) < String(b.id) ? -1 : 1;
  }

  /**
   * 载入数据：
   *   1. 优先读取持久化存储；
   *   2. 没有则用种子数据初始化并落盘；
   *   3. 存储不可用则直接用种子数据（内存态）。
   */
  function load() {
    if (cache) return cache;

    var stored = storageAvailable() ? util.storage.get(STORAGE_KEY, null) : null;

    if (Array.isArray(stored) && stored.length) {
      cache = stored.map(function (raw) { return itemModel.normalize(raw); }).sort(byPublishedDesc);
      return cache;
    }

    cache = seed.getSeedItems().map(function (raw) { return itemModel.normalize(raw); }).sort(byPublishedDesc);
    persist();
    return cache;
  }

  /** 写回存储；失败不抛异常，保证内存态继续可用。 */
  function persist() {
    if (!storageAvailable()) return false;
    var ok = util.storage.set(STORAGE_KEY, cache);
    if (ok) util.storage.set(SEED_FLAG_KEY, true);
    return ok;
  }

  /* ---------------------------------------------------------------- 查询 */

  /**
   * 列出信息。
   * @param {object} [options] { type }  type 为 'all' 或具体类型
   * @returns {Array} 规范化后的 Item 数组（新数组，调用方修改不影响缓存）
   */
  function list(options) {
    var opts = options || {};
    var items = load().slice();
    if (opts.type && opts.type !== 'all') {
      items = items.filter(function (item) { return item.type === opts.type; });
    }
    return items;
  }

  /** 按 id 取单条，找不到返回 null（详情页据此展示「信息不存在」）。 */
  function get(id) {
    if (!id) return null;
    var target = String(id);
    var items = load();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === target) return items[i];
    }
    return null;
  }

  /**
   * 统计信息。
   * @returns {{total, lost, found, active, resolved}}
   */
  function stats() {
    var items = load();
    return items.reduce(function (acc, item) {
      acc.total++;
      acc[item.type]++;
      if (item.resolved) acc.resolved++; else acc.active++;
      return acc;
    }, { total: 0, lost: 0, found: 0, active: 0, resolved: 0 });
  }

  /* ---------------------------------------------------------------- 写入 */

  /** 新增一条信息（title/描述等已在 item.create 校验过）。 */
  function add(item) {
    var normalized = itemModel.normalize(item);
    var items = load();
    items.push(normalized);
    items.sort(byPublishedDesc);
    persist();
    return normalized;
  }

  /**
   * 更新状态（标记已找到 / 已归还，或撤销该标记）。
   * 这是「发布者维护信息状态」的落地点：只有发布者本人才应触发，
   * 权限判断在页面层完成（本项目不引入登录体系）。
   * @returns {object|null} 更新后的 Item，找不到返回 null
   */
  function updateStatus(id, resolved, options) {
    var items = load();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === String(id)) {
        items[i] = itemModel.applyResolved(items[i], resolved, options);
        persist();
        return items[i];
      }
    }
    return null;
  }

  /** 删除（用于「我的发布」撤销误发信息）。 */
  function remove(id) {
    var items = load();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === String(id)) {
        var removed = items.splice(i, 1)[0];
        persist();
        return removed;
      }
    }
    return null;
  }

  /** 仅供测试与「重置演示数据」使用。 */
  function reset() {
    cache = null;
    if (storageAvailable()) {
      util.storage.remove(STORAGE_KEY);
      util.storage.remove(SEED_FLAG_KEY);
    }
    return load();
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    storageAvailable: storageAvailable,
    list: list,
    get: get,
    stats: stats,
    add: add,
    updateStatus: updateStatus,
    remove: remove,
    reset: reset,
    byPublishedDesc: byPublishedDesc
  };
});
