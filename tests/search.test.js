/* ==========================================================================
   tests/search.test.js —— 搜索模块单元测试
   覆盖：关键词切分、多字段命中、相关性排序、全角/大小写、正则元字符、
         空关键词、无结果、类型过滤、高亮转义
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const search = require('../js/core/search.js');
const util = require('../js/core/util.js');
const itemModel = require('../js/data/item.js');
const seed = require('../js/data/seed.js');

const NOW = new Date('2026-10-01T12:00:00').getTime();

/** 用种子数据构造检索源。 */
function corpus() {
  return seed.getSeedItems(NOW).map((raw) => itemModel.normalize(raw, { now: NOW }));
}

/** 构造一条自定义信息，字段可覆盖。 */
function makeItem(overrides) {
  return itemModel.normalize(Object.assign({
    id: 'X1',
    type: 'lost',
    title: '示例物品',
    description: '示例描述',
    category: 'other',
    location: '示例地点',
    lostAt: NOW - 3600 * 1000,
    publishedAt: NOW,
    contactType: 'wechat',
    contactValue: 'demo',
    publisher: { name: '示例同学' }
  }, overrides || {}), { now: NOW });
}

/* ------------------------------------------------------------ 基本匹配 */

test('search: 按物品名称子串命中', () => {
  const results = search.searchItems(corpus(), '校园卡');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].title, '黑色校园卡');
});

test('search: 中文子串匹配，而不是分词匹配', () => {
  // 「黑色校园卡」应当能被「黑色」和「校园卡」分别命中
  assert.strictEqual(search.searchItems(corpus(), '黑色').length, 1);
  assert.strictEqual(search.searchItems(corpus(), '校园卡').length, 1);
  assert.strictEqual(search.searchItems(corpus(), '色校').length, 1, '跨词连续子串也应命中');
});

test('search: 可以命中描述、地点、分类与发布者字段', () => {
  assert.ok(search.searchItems(corpus(), '哆啦A梦').length >= 1, '描述命中');
  assert.ok(search.searchItems(corpus(), '图书馆').length >= 1, '地点命中');
  assert.ok(search.searchItems(corpus(), '数码电子').length >= 1, '分类命中');
  assert.ok(search.searchItems(corpus(), '林同学').length >= 1, '发布者命中');
});

test('search: 命中「寻物」「招领」类型标签', () => {
  const lost = search.searchItems(corpus(), '寻物');
  const found = search.searchItems(corpus(), '招领');
  assert.ok(lost.length >= 1);
  assert.ok(found.length >= 1);
  lost.forEach((item) => assert.strictEqual(item.type, 'lost'));
  found.forEach((item) => assert.strictEqual(item.type, 'found'));
});

/* ------------------------------------------------------- 大小写与全角 */

test('search: 英文大小写不敏感', () => {
  const lower = search.searchItems(corpus(), 'airpods');
  const upper = search.searchItems(corpus(), 'AIRPODS');
  const mixed = search.searchItems(corpus(), 'AiRpOdS');
  assert.ok(lower.length >= 1);
  assert.strictEqual(lower.length, upper.length);
  assert.strictEqual(lower.length, mixed.length);
});

test('search: 全角字符自动转半角', () => {
  const half = search.searchItems(corpus(), 'AirPods');
  const full = search.searchItems(corpus(), 'ＡｉｒＰｏｄｓ');
  assert.ok(half.length >= 1);
  assert.strictEqual(full.length, half.length, '全角输入应与半角输入结果一致');
});

test('search: 全角空格与首尾空白被忽略', () => {
  const plain = search.searchItems(corpus(), '耳机');
  const padded = search.searchItems(corpus(), '　 耳机 　');
  assert.strictEqual(padded.length, plain.length);
});

/* --------------------------------------------------------- 多关键词 */

test('search: 多个关键词之间是「与」关系', () => {
  // 「白色 耳机」两个词都在同一条信息的字段中出现
  const results = search.searchItems(corpus(), '白色 耳机');
  assert.ok(results.length >= 1);
  results.forEach((item) => {
    const text = util.normalize([item.title, item.description, item.location].join(' '));
    assert.ok(text.includes('白色') && text.includes('耳机'));
  });
});

test('search: 关键词可以分别命中不同字段', () => {
  // 「校园卡」在标题，「林同学」在发布者
  const results = search.searchItems(corpus(), '校园卡 林');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].title, '黑色校园卡');
});

test('search: 存在不匹配的关键词时整体不命中', () => {
  const results = search.searchItems(corpus(), '校园卡 不存在的词');
  assert.strictEqual(results.length, 0);
});

/* --------------------------------------------------------- 边界与异常 */

test('search: 空查询返回全部（等价于浏览）', () => {
  const items = corpus();
  assert.strictEqual(search.searchItems(items, '').length, items.length);
  assert.strictEqual(search.searchItems(items, '   ').length, items.length);
  assert.strictEqual(search.searchItems(items, null).length, items.length);
  assert.strictEqual(search.searchItems(items, undefined).length, items.length);
});

test('search: 无结果时返回空数组而不是抛错', () => {
  const results = search.search(corpus(), '这个词肯定搜不到xyz');
  assert.ok(Array.isArray(results));
  assert.strictEqual(results.length, 0);
});

test('search: 正则元字符被当作普通字符处理', () => {
  // 这些输入如果直接拼进 RegExp 会抛异常，必须先转义
  ['.*', '(', '[', '\\', '+', '?', '^$', '((('].forEach((query) => {
    assert.doesNotThrow(() => search.search(corpus(), query), '关键词 ' + query + ' 不应抛错');
  });
});

test('search: 含括号的物品名称可以精确搜到', () => {
  const results = search.searchItems(corpus(), '（灰色长柄）');
  assert.strictEqual(results.length, 1);
  assert.ok(results[0].title.includes('灰色长柄'));
});

test('search: 空数据源返回空结果', () => {
  assert.deepStrictEqual(search.searchItems([], '校园卡'), []);
  assert.deepStrictEqual(search.searchItems(null, '校园卡'), []);
});

/* ------------------------------------------------------------- 排序 */

test('search: 标题命中排在描述命中之前', () => {
  const items = [
    makeItem({ id: 'A', title: '雨伞', description: '这是一把普通的伞' }),
    makeItem({ id: 'B', title: '水杯', description: '旁边放着一把雨伞' })
  ];
  const results = search.searchItems(items, '雨伞');
  assert.strictEqual(results[0].id, 'A', '标题命中应优先');
});

test('search: 完全匹配的标题获得最高优先级', () => {
  const items = [
    makeItem({ id: 'A', title: '黑色雨伞', description: '' }),
    makeItem({ id: 'B', title: '雨伞', description: '' })
  ];
  const results = search.searchItems(items, '雨伞');
  assert.strictEqual(results[0].id, 'B', '标题完全等于关键词的应排最前');
});

test('search: 同等相关度下进行中的信息排在已解决之前', () => {
  const items = [
    makeItem({ id: 'DONE', title: '校园卡', resolved: true }),
    makeItem({ id: 'ACTIVE', title: '校园卡', resolved: false })
  ];
  const results = search.searchItems(items, '校园卡');
  assert.strictEqual(results[0].id, 'ACTIVE');
});

test('search: 空查询结果按发布时间倒序', () => {
  const items = [
    makeItem({ id: 'OLD', title: '旧信息', publishedAt: NOW - 10 * 3600 * 1000 }),
    makeItem({ id: 'NEW', title: '新信息', publishedAt: NOW })
  ];
  const results = search.searchItems(items, '');
  assert.deepStrictEqual(results.map((i) => i.id), ['NEW', 'OLD']);
});

test('search: search 返回命中字段说明，便于解释结果来源', () => {
  const results = search.search(corpus(), '图书馆');
  assert.ok(results.length >= 1);
  assert.ok(Array.isArray(results[0].matched));
  assert.ok(results[0].matched.indexOf('location') >= 0, '应标注命中了地点字段');
  const labels = search.matchedFieldLabels(results[0].matched);
  assert.ok(labels.indexOf('地点') >= 0);
});

/* --------------------------------------------------------- 类型过滤 */

test('search: type 过滤与关键词共同生效', () => {
  const items = corpus();
  const all = search.searchItems(items, '捡到');
  const found = search.searchItems(items, '捡到', { type: 'found' });
  const lost = search.searchItems(items, '捡到', { type: 'lost' });

  assert.ok(all.length >= 1);
  found.forEach((item) => assert.strictEqual(item.type, 'found'));
  // 「捡到」是招领类信息的常见表述，寻物里通常不会出现
  assert.ok(found.length >= lost.length);
});

test('search: type 为 all 时不做过滤', () => {
  const items = corpus();
  assert.strictEqual(
    search.searchItems(items, '校园卡', { type: 'all' }).length,
    search.searchItems(items, '校园卡').length
  );
});

/* ------------------------------------------------------------- 高亮 */

test('highlight: 命中部分包裹 mark 标签', () => {
  const html = search.highlight('黑色校园卡', '校园卡');
  assert.ok(html.includes('<mark class="hl">校园卡</mark>'));
});

test('highlight: 输出经过 HTML 转义，不会注入标签', () => {
  // 关键词避开标签名，这样能同时验证「原文被转义」与「命中被高亮」
  const html = search.highlight('<script>alert(1)</script>', 'alert');
  assert.ok(!html.includes('<script>'), '不能出现原始 script 标签');
  assert.ok(html.includes('&lt;script&gt;'), '尖括号应被转义');
  assert.ok(html.includes('<mark class="hl">alert</mark>'), '命中部分应被高亮');
});

test('highlight: 关键词本身含正则元字符也能安全高亮', () => {
  assert.doesNotThrow(() => search.highlight('价格 (元)', '('));
  const html = search.highlight('价格 (元)', '(');
  assert.ok(html.includes('<mark class="hl">(</mark>'));
});

test('highlight: 空关键词返回原文本（已转义）', () => {
  assert.strictEqual(search.highlight('黑色校园卡', ''), '黑色校园卡');
  assert.strictEqual(search.highlight('<b>x</b>', ''), '&lt;b&gt;x&lt;/b&gt;');
});
