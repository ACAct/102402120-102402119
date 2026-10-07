/* ==========================================================================
   js/core/search.js —— 搜索与相关性排序（纯函数，无 DOM 依赖）
   独立成模块的原因：搜索规则是本项目最需要被测试覆盖的逻辑，
   把它从页面里抽出来之后就能直接用 Node 断言，而不用模拟浏览器。

   匹配规则：
     - 查询串先归一化（全角转半角、小写、折叠空白），再按空白切成多个关键词；
     - 多个关键词之间是「与」关系（都要命中），单个关键词内部是「或」关系
       （命中任意一个字段即可）；
     - 用子串匹配而非分词：中文里「校园卡」应能命中「黑色校园卡」；
     - 关键词中的正则元字符会被转义，用户输入 "(" 不会导致异常。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./util.js') : root.LF.util,
    isNode ? require('./schema.js') : root.LF.schema
  );
  if (isNode) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.search = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, schema) {
  'use strict';

  /**
   * 字段权重：标题命中远比描述命中重要。
   * 数值没有严格含义，只用于相对排序，便于后续调整。
   */
  var FIELD_WEIGHTS = {
    title: 100,
    category: 45,
    location: 40,
    type: 30,
    publisher: 20,
    description: 10
  };

  /** 已解决信息的相关性惩罚，保证同样匹配度下「还有效」的信息排前面。 */
  var RESOLVED_PENALTY = 25;

  /**
   * 参与搜索的字段集合。
   * 地点把「地点 + 补充说明」合并，这样搜「三楼」也能命中。
   */
  function searchableFields(item) {
    return {
      title: item.title || '',
      description: item.description || '',
      location: (item.location || '') + ' ' + (item.locationDetail || ''),
      category: schema.categoryLabel(item.category),
      type: schema.typeLabel(item.type) + ' ' + schema.typeFullLabel(item.type),
      publisher: (item.publisher && item.publisher.name) || ''
    };
  }

  /** 提前算好归一化后的字段文本，避免在排序比较中重复归一化。 */
  function prepare(item) {
    var fields = searchableFields(item);
    var normalized = {};
    Object.keys(fields).forEach(function (key) {
      normalized[key] = util.normalize(fields[key]);
    });
    return normalized;
  }

  /**
   * 计算一条信息对给定关键词列表的相关性得分。
   * @returns {{score: number, matched: string[]}}
   */
  function scoreItem(normalizedFields, tokens) {
    var matched = [];
    var total = 0;

    for (var t = 0; t < tokens.length; t++) {
      var token = tokens[t];
      var best = 0;
      var bestField = '';

      Object.keys(FIELD_WEIGHTS).forEach(function (field) {
        var haystack = normalizedFields[field];
        if (!haystack) return;
        // 完全等于该字段时给额外加成（例如标题就叫「校园卡」）
        if (haystack === token) {
          if (FIELD_WEIGHTS[field] * 2 > best) {
            best = FIELD_WEIGHTS[field] * 2;
            bestField = field;
          }
        } else if (haystack.indexOf(token) >= 0) {
          if (FIELD_WEIGHTS[field] > best) {
            best = FIELD_WEIGHTS[field];
            bestField = field;
          }
        }
      });

      // 该关键词一个字段都没命中 → 整体不匹配
      if (best === 0) return { score: 0, matched: [] };
      total += best;
      if (bestField && matched.indexOf(bestField) < 0) matched.push(bestField);
    }

    return { score: total, matched: matched };
  }

  /**
   * 搜索主入口。
   * @param {Array} items 待检索的信息（应已规范化）
   * @param {string} query 用户输入的关键词
   * @param {object} [options] { type } 类型过滤，'all' 或具体类型
   * @returns {Array} 命中结果，按相关性倒序、发布时间倒序
   */
  function search(items, query, options) {
    var opts = options || {};
    var list = Array.isArray(items) ? items : [];

    // 类型过滤先做，减少后面的打分开销
    if (opts.type && opts.type !== 'all') {
      list = list.filter(function (item) { return item.type === opts.type; });
    }

    var tokens = util.tokenize(query);

    // 空关键词：等价于「浏览全部」，仍按发布时间倒序返回
    if (!tokens.length) {
      return util.stableSort(list.slice(), function (a, b) {
        return b.publishedAt - a.publishedAt;
      }).map(function (item) {
        return { item: item, score: 0, matched: [] };
      });
    }

    var results = [];
    list.forEach(function (item, index) {
      var outcome = scoreItem(prepare(item), tokens);
      if (outcome.score <= 0) return;
      results.push({
        item: item,
        score: outcome.score,
        matched: outcome.matched,
        index: index
      });
    });

    return results.sort(function (a, b) {
      if (a.score !== b.score) return b.score - a.score;
      // 同分时进行中的信息优先，再按发布时间
      if (a.item.resolved !== b.item.resolved) return a.item.resolved ? 1 : -1;
      if (b.item.publishedAt !== a.item.publishedAt) return b.item.publishedAt - a.item.publishedAt;
      return a.index - b.index;   // 稳定排序
    }).map(function (row) {
      return { item: row.item, score: row.score, matched: row.matched };
    });
  }

  /** 只取信息本身（页面上多数场景只关心列表）。 */
  function searchItems(items, query, options) {
    return search(items, query, options).map(function (row) { return row.item; });
  }

  /**
   * 在文本中高亮关键词，返回 HTML。
   * 先做 HTML 转义再插入 <mark>，避免用户输入被当作标签解析。
   */
  function highlight(text, query) {
    var safe = util.escapeHtml(text);
    var tokens = util.tokenize(query);
    if (!tokens.length) return safe;

    // 长关键词优先，避免短词先替换后破坏长词
    var ordered = tokens.slice().sort(function (a, b) { return b.length - a.length; });
    var pattern = ordered.map(function (token) {
      return util.escapeRegExp(util.escapeHtml(token));
    }).join('|');

    if (!pattern) return safe;
    return safe.replace(new RegExp('(' + pattern + ')', 'gi'), '<mark class="hl">$1</mark>');
  }

  /** 命中字段的中文名，用于结果页说明「为什么这条会出现」。 */
  function matchedFieldLabels(matched) {
    var labels = {
      title: '名称',
      description: '描述',
      location: '地点',
      category: '分类',
      type: '类型',
      publisher: '发布者'
    };
    return (matched || []).map(function (field) { return labels[field] || field; });
  }

  return {
    FIELD_WEIGHTS: FIELD_WEIGHTS,
    RESOLVED_PENALTY: RESOLVED_PENALTY,
    search: search,
    searchItems: searchItems,
    searchableFields: searchableFields,
    highlight: highlight,
    matchedFieldLabels: matchedFieldLabels
  };
});
