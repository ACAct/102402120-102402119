/* 冒烟检查：发布表单渲染、必填校验、长度边界、提交入库与类型切换。 */
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
  'js/pages/publish.js'
];

function buildPage(search) {
  const h = createHarness(files);
  h.global.location.search = search || '';
  h.global.LF.pages.publish.init();
  return h;
}

const contentOf = (h) => h.document.getElementById('content').innerHTML;
const bottomOf = (h) => h.document.getElementById('bottomBar').innerHTML;

/** 模拟用户填写表单：写入 DOM 与控制器状态。 */
function fill(h, values) {
  const page = h.global.LF.pages.publish;
  Object.keys(values).forEach((key) => {
    page.state[key] = values[key];
    const el = h.document.querySelector(`[data-field="${key}"]`);
    if (el) el.value = values[key];
  });
}

/** 记录跳转目标，替换真实的 location 跳转。 */
function spyGo(h) {
  const calls = [];
  h.global.LF.layout.go = (name, params) => calls.push({ name, params });
  return calls;
}

/* ---- 1. 默认渲染：寻物类型 + 完整字段 ---- */
{
  const h = buildPage('');
  const html = contentOf(h);
  assert.ok(html.includes('我要寻物') && html.includes('我要招领'), '应展示两个类型卡');
  assert.ok(html.includes('丢失时间'), '默认应为寻物，标注丢失时间');
  assert.ok(html.includes('丢失地点'), '默认应为寻物，标注丢失地点');
  assert.ok(html.includes('物品名称'), '应展示物品名称字段');
  assert.ok(html.includes('物品分类'), '应展示物品分类字段');
  assert.ok(html.includes('联系方式'), '应展示联系方式字段');
  assert.ok(bottomOf(h).includes('发布寻物启事'), '提交按钮文案应随类型变化');
  // 默认时间已填好，减少一次操作
  assert.ok(h.global.LF.pages.publish.state.lostAt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    '丢失时间应默认预填当前时间');
  console.log('默认渲染        -> 寻物表单 OK');
}

/* ---- 2. 带 ?type=found 进入：预选招领 ---- */
{
  const h = buildPage('?type=found');
  const html = contentOf(h);
  assert.ok(html.includes('拾取时间'), '应切换为拾取时间');
  assert.ok(html.includes('拾取地点'), '应切换为拾取地点');
  assert.ok(bottomOf(h).includes('发布失物招领'), '按钮文案应为招领');
  console.log('带参进入        -> 预选招领 OK');
}

/* ---- 3. 必填校验：全空提交应逐项报错且不入库 ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.publish;
  const repo = h.global.LF.repository;
  const before = repo.list().length;

  page.state.title = '';
  page.state.location = '';
  page.state.contactValue = '';
  page.state.publisherName = '';
  page.state.lostAt = '';
  page.submit();

  const errs = page.errors();
  assert.ok(errs.title, '应提示物品名称必填');
  assert.ok(errs.location, '应提示地点必填');
  assert.ok(errs.contactValue, '应提示联系方式必填');
  assert.ok(errs.publisherName, '应提示称呼必填');
  assert.ok(errs.lostAt, '应提示时间必填');
  assert.strictEqual(repo.list().length, before, '校验失败不应写入数据');

  const html = contentOf(h);
  assert.ok(html.includes('has-error'), '出错字段应带错误样式');
  assert.ok(html.includes('field-error'), '应渲染错误提示');
  console.log('必填校验        -> 逐项报错且不入库 OK');
}

/* ---- 4. 标题长度边界：30 字通过 / 31 字拒绝（maxlength 同时兜底） ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.publish;
  const html = contentOf(h);
  assert.ok(html.includes('maxlength="30"'), '物品名称应有 maxlength 兜底');

  fill(h, {
    title: 'a'.repeat(31), location: '图书馆', contactValue: 'wx123',
    publisherName: '测试同学', lostAt: '2026-09-20T10:00'
  });
  assert.strictEqual(page.validateForm(), false, '31 字应校验失败');
  assert.ok(page.errors().title, '应提示名称超长');

  page.state.title = 'a'.repeat(30);
  assert.strictEqual(page.validateForm(), true, '30 字应校验通过');
  console.log('长度边界        -> 30 通过 / 31 拒绝 OK');
}

/* ---- 5. 合法提交：写入仓库并跳转成功页 ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.publish;
  const repo = h.global.LF.repository;
  const calls = spyGo(h);
  const before = repo.list().length;

  fill(h, {
    type: 'found',
    title: '捡到一只黑色保温杯',
    description: '杯身有划痕，贴着星星贴纸',
    category: 'bottle',
    location: '三食堂二楼',
    locationDetail: '二楼服务台',
    lostAt: '2026-09-25T12:30',
    contactType: 'wechat',
    contactValue: 'finder_wx',
    publisherName: '测试同学',
    publisherDept: '计算机学院'
  });
  page.submit();

  assert.strictEqual(repo.list().length, before + 1, '应新增 1 条信息');
  const created = repo.list().find((i) => i.title === '捡到一只黑色保温杯');
  assert.ok(created, '新增的信息应能查到');
  assert.strictEqual(created.type, 'found');
  assert.strictEqual(created.status, 'waiting', '招领信息初始状态应为待认领');
  assert.strictEqual(created.category, 'bottle');
  assert.strictEqual(created.publisher.name, '测试同学');
  assert.strictEqual(created.publisher.dept, '计算机学院');

  assert.strictEqual(calls.length, 1, '应发生一次跳转');
  assert.strictEqual(calls[0].name, 'success');
  assert.ok(calls[0].params.includes(encodeURIComponent(created.id)), '应带上新信息的 id');
  console.log('合法提交        -> 入库 + 跳转成功页 OK');
}

/* ---- 6. 类型切换保留已填内容 ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.publish;
  fill(h, { title: '已填写的名称', location: '已填写的地点' });

  page.setType('found');
  assert.strictEqual(page.state.title, '已填写的名称', '切换类型不应丢失名称');
  assert.strictEqual(page.state.location, '已填写的地点', '切换类型不应丢失地点');
  assert.strictEqual(page.state.type, 'found');
  assert.ok(contentOf(h).includes('拾取时间'), '标签应更新为拾取时间');

  page.setType('不合法类型');
  assert.strictEqual(page.state.type, 'found', '非法类型应被忽略');
  console.log('类型切换        -> 保留输入 + 拒绝非法值 OK');
}

/* ---- 7. 描述与联系方式长度上限兜底 ---- */
{
  const h = buildPage('');
  const html = contentOf(h);
  assert.ok(html.includes('maxlength="200"'), '描述应有 maxlength');
  assert.ok(html.includes('maxlength="60"'), '联系方式应有 maxlength');
  assert.ok(html.includes('200'), '应展示描述字数上限');
  console.log('长度兜底        -> maxlength 属性已设置 OK');
}

/* ---- 8. 未来时间被拒绝 ---- */
{
  const h = buildPage('');
  const page = h.global.LF.pages.publish;
  const future = new Date(Date.now() + 86400000);
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  fill(h, {
    title: '未来时间的物品', location: '图书馆', contactValue: 'wx',
    publisherName: '同学',
    lostAt: future.getFullYear() + '-' + pad(future.getMonth() + 1) + '-' + pad(future.getDate()) +
      'T' + pad(future.getHours()) + ':' + pad(future.getMinutes())
  });
  assert.strictEqual(page.validateForm(), false, '未来时间应校验失败');
  assert.ok(page.errors().lostAt, '应提示时间不能晚于当前');
  console.log('未来时间        -> 拒绝 OK');
}

console.log('\nSMOKE PUBLISH OK');
