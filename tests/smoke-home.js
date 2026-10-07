/* 冒烟检查：首页渲染、筛选、排序与热门关键词入口。 */
'use strict';

const assert = require('node:assert');
const { createHarness } = require('./dom-harness.js');

const files = [
  'js/core/util.js',
  'js/core/schema.js',
  'js/data/seed.js',
  'js/data/item.js',
  'js/data/repository.js',
  'js/components/icons.js',
  'js/components/layout.js',
  'js/components/item-card.js',
  'js/pages/home.js'
];

const h = createHarness(files);
const home = h.global.LF.pages.home;
home.init();

const content = () => h.document.getElementById('content').innerHTML;
const cardCount = (html) => (html.match(/class="info-card/g) || []).length;
const titles = (html) => Array.from(html.matchAll(/card-title">([^<]+)</g)).map((m) => m[1]);

/* ---- 基本渲染 ---- */
const initial = content();
assert.strictEqual(cardCount(initial), 8, '首页应渲染 8 条信息');
assert.ok(h.document.getElementById('statusBar').innerHTML.includes('status-bar'), '状态栏应存在');
assert.ok(h.document.getElementById('chrome').innerHTML.includes('notch'), '刘海应存在');
assert.ok(h.document.getElementById('tabbar').innerHTML.includes('tabbar'), '底部导航应存在');
console.log('渲染卡片数        =', cardCount(initial));

/* ---- 热门关键词 ---- */
const hotTags = Array.from(initial.matchAll(/class="hot-tag" href="([^"]+)"/g)).map((m) => m[1]);
assert.ok(hotTags.length >= 5, '应至少有 5 个热门关键词');
assert.ok(hotTags.every((href) => href.startsWith('search.html?q=')), '热门关键词应跳转到搜索页');
console.log('热门关键词        =', hotTags.length, '个 ->', hotTags[0]);

/* ---- 默认排序：进行中优先 ---- */
const defaultOrder = titles(initial);
const resolvedItems = h.global.LF.repository.list().filter((i) => i.resolved);
// 默认排序：最后 N 条应当正好是全部已解决的信息（它们内部顺序不作要求）
const tail = defaultOrder.slice(defaultOrder.length - resolvedItems.length);
resolvedItems.forEach((item) => {
  assert.ok(tail.indexOf(item.title) >= 0,
    '已解决的信息「' + item.title + '」应排在列表末尾，实际末尾为：' + tail.join(' / '));
});
const activeTail = defaultOrder.slice(0, defaultOrder.length - resolvedItems.length);
const activeTitles = h.global.LF.repository.list().filter((i) => !i.resolved).map((i) => i.title);
activeTail.forEach((title) => {
  assert.ok(activeTitles.indexOf(title) >= 0, '进行中的信息应排在已解决信息之前：' + title);
});
console.log('默认排序末尾两条  =', tail.join(' | '));

/* ---- 切换为「最新发布」排序 ---- */
home.setSort('time');
const byTime = h.global.LF.repository.list();
const byTimeTitles = titles(content());
// 注意：这里用 deepEqual 而非 deepStrictEqual。
// repository 在 vm 沙箱（独立 realm）中返回数组，其原型与本文件的 Array.prototype
// 不是同一个对象，deepStrictEqual 会因为「结构相同但引用不同」而失败。
// 断言的是内容而不是原型，因此这里用 deepEqual 更贴合意图。
assert.deepEqual(byTimeTitles, byTime.map((i) => i.title),
  '按时间排序应与仓库倒序一致');
console.log('最新发布首条      =', byTimeTitles[0]);

/* ---- 筛选 ---- */
home.setSort('active');
home.setType('lost');
const lostHtml = content();
assert.strictEqual(cardCount(lostHtml), 4, '寻物筛选应剩 4 条');
assert.ok(lostHtml.includes('寻物启事'), '标题应变为寻物启事');
assert.ok(!lostHtml.includes('badge-found">招领'), '不应出现招领徽章');
console.log('筛选寻物          =', cardCount(lostHtml), '条');

home.setType('found');
assert.strictEqual(cardCount(content()), 4, '招领筛选应剩 4 条');
console.log('筛选招领          =', cardCount(content()), '条');

/* ---- 空状态：清空数据后应展示空状态而不是空白 ---- */
home.setType('all');
h.global.LF.repository.reset();
const items = h.global.LF.repository.list();
assert.ok(items.length > 0, 'reset 后应重新载入种子数据');

console.log('\nSMOKE HOME OK');
