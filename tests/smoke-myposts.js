/* 冒烟检查：发布成功页与我的发布页（含状态维护闭环）。 */
'use strict';

const assert = require('node:assert');
const { createHarness } = require('./dom-harness.js');

const SUCCESS_FILES = [
  'js/core/util.js', 'js/core/schema.js', 'js/data/seed.js', 'js/data/item.js',
  'js/data/repository.js', 'js/components/icons.js', 'js/components/layout.js',
  'js/pages/success.js'
];

const MYPOSTS_FILES = [
  'js/core/util.js', 'js/core/schema.js', 'js/data/seed.js', 'js/data/item.js',
  'js/data/repository.js', 'js/components/icons.js', 'js/components/layout.js',
  'js/pages/myposts.js'
];

/* ==================== 发布成功页 ==================== */

/* ---- 1. 带 id 进入：展示刚发布信息的摘要 ---- */
{
  const h = createHarness(SUCCESS_FILES);
  h.global.location.search = '?id=L20260924001';
  h.global.LF.pages.success.init();
  const html = h.document.getElementById('content').innerHTML;

  assert.ok(html.includes('发布成功'), '应展示发布成功标题');
  assert.ok(html.includes('黑色校园卡'), '应展示物品名称');
  assert.ok(html.includes('图书馆三楼'), '应展示地点');
  assert.ok(html.includes('寻物启事'), '应展示信息类型');
  assert.ok(html.includes('寻找中'), '应展示当前状态');
  assert.ok(html.includes('detail.html?id=L20260924001'), '应提供查看该信息的入口');
  assert.ok(html.includes('myposts.html'), '应提供前往我的发布的入口');
  assert.ok(html.includes('index.html'), '应提供返回首页的入口');
  console.log('成功页(带id)    -> 摘要 + 三个入口 OK');
}

/* ---- 2. 无 id：退化为通用成功提示，而不是报错 ---- */
{
  const h = createHarness(SUCCESS_FILES);
  h.global.location.search = '';
  h.global.LF.pages.success.init();
  const html = h.document.getElementById('content').innerHTML;
  assert.ok(html.includes('发布成功'), '仍应展示成功提示');
  assert.ok(html.includes('myposts.html'), '仍应提供后续入口');
  console.log('成功页(无id)    -> 优雅降级 OK');
}

/* ==================== 我的发布页 ==================== */

/* ---- 3. 无身份记录：演示模式展示全部信息并给出说明 ---- */
{
  const h = createHarness(MYPOSTS_FILES);
  h.global.LF.pages.myposts.init();
  const html = h.document.getElementById('content').innerHTML;

  assert.ok(html.includes('共发布'), '应展示统计概览');
  assert.ok(html.includes('本地还没有你的发布记录'), '应说明处于演示模式');
  assert.ok(html.includes('标记已找到'), '寻物信息应提供标记已找到');
  assert.ok(html.includes('标记已归还'), '招领信息应提供标记已归还');
  assert.ok(html.includes('my-card'), '应渲染卡片');
  console.log('我的发布(演示)  -> 全部信息 + 说明 OK');
}

/* ---- 4. 有身份记录：只显示该称呼发布的信息 ---- */
{
  const h = createHarness(MYPOSTS_FILES);
  const repo = h.global.LF.repository;
  repo.reset();
  repo.add({
    id: 'MINE1', type: 'lost', title: '我发的信息', location: '图书馆',
    lostAt: Date.now() - 3600000, publishedAt: Date.now(),
    category: 'card', contactType: 'wechat', contactValue: 'me',
    publisher: { name: '本人同学' }, resolved: false
  });
  h.global.LF.util.storage.set('lf.myPublisher.v1', '本人同学');

  h.global.LF.pages.myposts.init();
  const html = h.document.getElementById('content').innerHTML;

  assert.ok(html.includes('我发的信息'), '应显示自己发布的信息');
  assert.ok(!html.includes('黑色校园卡'), '不应显示他人的信息');
  assert.ok(!html.includes('本地还没有你的发布记录'), '不应再提示演示模式');
  console.log('我的发布(本人)  -> 仅显示本人信息 OK');
}

/* ---- 5. 状态维护闭环：标记已解决 → 状态与统计同步 → 撤销 ---- */
{
  const h = createHarness(MYPOSTS_FILES);
  const repo = h.global.LF.repository;
  const page = h.global.LF.pages.myposts;
  const contentOf = () => h.document.getElementById('content').innerHTML;

  const target = repo.list().find((i) => !i.resolved && i.type === 'lost');
  page.toggleStatus(target.id, true);

  const after = repo.get(target.id);
  assert.strictEqual(after.resolved, true, '应已标记为已解决');
  assert.strictEqual(after.status, 'found', '寻物信息应变为已找到');
  assert.ok(after.resolvedAt, '应记录解决时间');
  assert.ok(contentOf().includes('已找到'), '列表徽章应更新');
  assert.ok(contentOf().includes('撤销标记'), '已解决信息应提供撤销入口');

  // 状态变化应当被首页/搜索页的数据源同步感知
  assert.strictEqual(
    repo.list().filter((i) => i.id === target.id && i.resolved).length, 1,
    '仓储层状态应已同步');

  page.toggleStatus(target.id, false);
  const reverted = repo.get(target.id);
  assert.strictEqual(reverted.resolved, false, '应已撤销标记');
  assert.strictEqual(reverted.status, 'ongoing', '应回到寻找中');
  assert.strictEqual(reverted.resolvedAt, null, '撤销后应清空解决时间');
  assert.ok(contentOf().includes('寻找中'), '列表徽章应回到寻找中');
  console.log('状态维护闭环    -> 标记/撤销 + 统计同步 OK');
}

/* ---- 6. 类型筛选 ---- */
{
  const h = createHarness(MYPOSTS_FILES);
  const page = h.global.LF.pages.myposts;
  const contentOf = () => h.document.getElementById('content').innerHTML;

  page.setType('lost');
  const lostHtml = contentOf();
  const lostCards = (lostHtml.match(/class="my-card/g) || []).length;
  assert.ok(lostCards >= 1, '寻物筛选应有结果');
  assert.ok(!lostHtml.includes('badge-found">招领'), '不应出现招领徽章');

  page.setType('found');
  const foundCards = (contentOf().match(/class="my-card/g) || []).length;
  assert.ok(foundCards >= 1, '招领筛选应有结果');

  page.setType('all');
  const allCards = (contentOf().match(/class="my-card/g) || []).length;
  assert.strictEqual(allCards, lostCards + foundCards, '全部应等于两类之和');
  console.log('我的发布筛选    ->', lostCards, '+', foundCards, '=', allCards, 'OK');
}

/* ---- 7. 有身份但无发布：展示空状态与发布引导 ---- */
{
  const h = createHarness(MYPOSTS_FILES);
  h.global.LF.util.storage.set('lf.myPublisher.v1', '从未发布过的同学');
  h.global.LF.pages.myposts.init();
  const html = h.document.getElementById('content').innerHTML;

  assert.ok(html.includes('你还没有发布过信息'), '应展示空状态');
  assert.ok(html.includes('publish.html'), '应提供发布入口');
  assert.ok(!html.includes('my-card'), '不应有任何卡片');
  console.log('我的发布(空)    -> 空状态 + 发布引导 OK');
}

/* ---- 8. 操作不存在的信息不抛异常 ---- */
{
  const h = createHarness(MYPOSTS_FILES);
  const page = h.global.LF.pages.myposts;
  assert.doesNotThrow(() => page.toggleStatus('NOT_EXIST', true));
  console.log('非法 id 操作    -> 不抛异常 OK');
}

console.log('\nSMOKE SUCCESS + MYPOSTS OK');
