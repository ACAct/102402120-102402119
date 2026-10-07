/* 冒烟检查：搜索页的关键词搜索、类型筛选、无结果引导与搜索历史。 */
'use strict';

const assert = require('node:assert');
const { createHarness } = require('./dom-harness.js');

const files = [
  'js/core/util.js',
  'js/core/schema.js',
  'js/core/search.js',
  'js/data/seed.js',
  'js/data/item.js',
  'js/data/repository.js',
  'js/components/icons.js',
  'js/components/layout.js',
  'js/components/item-card.js',
  'js/pages/search.js'
];

/** 按给定 URL 参数构建搜索页。 */
function buildPage(search) {
  const h = createHarness(files);
  h.global.location.search = search || '';
  h.global.LF.pages.search.init();
  return h;
}

const bodyOf = (h) => h.document.getElementById('body').innerHTML;
const cardCount = (html) => (html.match(/class="result-card/g) || []).length;

/* ---- 1. 无关键词：展示引导与热门搜索 ---- */
{
  const h = buildPage('');
  const html = bodyOf(h);
  assert.ok(html.includes('搜索校园里的失物招领'), '应展示搜索引导');
  assert.ok(html.includes('大家都在搜'), '应展示热门搜索');
  assert.strictEqual(cardCount(html), 0, '无关键词时不应有结果卡片');
  console.log('空关键词        -> 引导 + 热门搜索 OK');
}

/* ---- 2. 带关键词进入：有结果且高亮 ---- */
{
  const h = buildPage('?q=' + encodeURIComponent('校园卡'));
  const html = bodyOf(h);
  assert.strictEqual(cardCount(html), 1, '「校园卡」应命中 1 条');
  assert.ok(html.includes('<mark class="hl">校园卡</mark>'), '命中关键词应高亮');
  assert.ok(html.includes('共 1 条'), '应展示结果条数');
  console.log('搜索「校园卡」   -> 1 条并高亮 OK');
}

/* ---- 3. 多结果搜索 ---- */
{
  const h = buildPage('?q=' + encodeURIComponent('捡到'));
  const html = bodyOf(h);
  assert.ok(cardCount(html) >= 2, '「捡到」应命中多条招领信息');
  console.log('搜索「捡到」     ->', cardCount(html), '条 OK');
}

/* ---- 4. 无结果：展示空状态与替代关键词 ---- */
{
  const h = buildPage('?q=' + encodeURIComponent('宇宙飞船'));
  const html = bodyOf(h);
  assert.strictEqual(cardCount(html), 0);
  assert.ok(html.includes('没有找到'), '应展示无结果提示');
  assert.ok(html.includes('试试这些关键词'), '应给出替代关键词');
  assert.ok(html.includes('index.html'), '应提供返回首页的出口');
  console.log('无结果引导      -> OK');
}

/* ---- 5. 类型筛选与关键词叠加 ---- */
{
  const h = buildPage('?q=' + encodeURIComponent('校园卡') + '&type=found');
  const html = bodyOf(h);
  assert.strictEqual(cardCount(html), 0, '「校园卡」是寻物信息，筛选招领后应为空');
  console.log('关键词+招领筛选 -> 0 条（符合预期）OK');
}

/* ---- 6. 类型筛选生效 ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.search;
  page.setQuery('图书馆');
  const before = cardCount(bodyOf(h));
  page.setType('found');
  const after = bodyOf(h);
  assert.ok(before >= 1, '「图书馆」应至少命中 1 条');
  assert.ok(!after.includes('badge-lost">寻物'), '筛选招领后不应出现寻物徽章');
  console.log('类型筛选        ->', before, '条 -> 招领', cardCount(after), '条 OK');
}

/* ---- 7. 搜索历史：记录、去重、上限 ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.search;

  page.pushHistory('校园卡');
  page.pushHistory('雨伞');
  page.pushHistory('校园卡');   // 重复项应被提前，而不是新增
  let history = page.getHistory();
  assert.deepStrictEqual(Array.from(history), ['校园卡', '雨伞'], '去重并置顶');

  page.pushHistory('x');        // 单字不记录
  assert.strictEqual(page.getHistory().length, 2, '单字关键词不入历史');

  for (let i = 0; i < 12; i++) page.pushHistory('关键词' + i);
  assert.ok(page.getHistory().length <= 8, '历史记录应有条数上限');
  console.log('搜索历史        ->', page.getHistory().length, '条（上限 8）OK');
}

/* ---- 8. 空查询调用不抛异常 ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.search;
  assert.doesNotThrow(() => page.setQuery(null));
  assert.doesNotThrow(() => page.setQuery(undefined));
  assert.doesNotThrow(() => page.setQuery(''));
  console.log('空查询容错      -> OK');
}

console.log('\nSMOKE SEARCH OK');
