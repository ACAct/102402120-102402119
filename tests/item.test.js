/* ==========================================================================
   tests/item.test.js —— 数据结构与领域模型的单元测试
   运行：node --test tests/

   覆盖重点：
     - Item 的字段规范与规范化（normalize）
     - 表单校验（validate）的边界：空值、超长、未来时间、非法枚举
     - 状态派生：status 一律由 type + resolved 计算，外部传入无效
     - 仓储层（repository）的增删改查与排序
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const schema = require('../js/core/schema.js');
const util = require('../js/core/util.js');
const itemModel = require('../js/data/item.js');
const repository = require('../js/data/repository.js');
const seed = require('../js/data/seed.js');

/** 固定参考时间，保证时间相关断言可复现。 */
const NOW = new Date('2026-10-01T12:00:00').getTime();

/** 一份合法的表单输入，供各用例按需覆盖字段。 */
function validInput(overrides) {
  return Object.assign({
    type: schema.TYPE.LOST,
    title: '黑色雨伞',
    description: '伞柄有蓝色挂绳',
    category: 'umbrella',
    location: '教学楼 A 区',
    lostAt: new Date(NOW - 3600 * 1000),
    contactType: schema.CONTACT.WECHAT,
    contactValue: 'test_wx',
    publisher: { name: '测试同学', dept: '计算机学院' }
  }, overrides || {});
}

/* ====================================================== 规范化 normalize */

test('normalize: 完整字段被原样保留', () => {
  const item = itemModel.normalize({
    id: 'LF20261001AAAAA',
    type: 'found',
    title: '校园卡',
    description: '黑色卡套',
    category: 'card',
    location: '图书馆',
    lostAt: NOW - 1000,
    publishedAt: NOW,
    contactType: 'qq',
    contactValue: '123456',
    publisher: { name: '林同学', dept: '计算机学院' },
    resolved: false
  }, { now: NOW });

  assert.strictEqual(item.id, 'LF20261001AAAAA');
  assert.strictEqual(item.type, 'found');
  assert.strictEqual(item.title, '校园卡');
  assert.strictEqual(item.category, 'card');
  assert.strictEqual(item.location, '图书馆');
  assert.strictEqual(item.contactValue, '123456');
  assert.strictEqual(item.publisher.name, '林同学');
  assert.strictEqual(item.publisher.dept, '计算机学院');
});

test('normalize: status 由 type + resolved 派生，忽略外部传入的 status', () => {
  // 外部传入伪造的 status 不应生效
  const ongoing = itemModel.normalize({ type: 'lost', resolved: false, status: 'returned' }, { now: NOW });
  assert.strictEqual(ongoing.status, schema.STATUS.ONGOING);

  const found = itemModel.normalize({ type: 'lost', resolved: true }, { now: NOW });
  assert.strictEqual(found.status, schema.STATUS.FOUND);

  const waiting = itemModel.normalize({ type: 'found', resolved: false }, { now: NOW });
  assert.strictEqual(waiting.status, schema.STATUS.WAITING);

  const returned = itemModel.normalize({ type: 'found', resolved: true }, { now: NOW });
  assert.strictEqual(returned.status, schema.STATUS.RETURNED);
});

test('normalize: 缺少 id 时自动生成，且带类型前缀', () => {
  const lost = itemModel.normalize({ type: 'lost', title: 'a' }, { now: NOW });
  const found = itemModel.normalize({ type: 'found', title: 'b' }, { now: NOW });
  assert.match(lost.id, /^LFL/);
  assert.match(found.id, /^LFF/);
});

test('normalize: 非法枚举退化为默认值而不是抛错', () => {
  const item = itemModel.normalize({
    type: '不存在的类型',
    category: '不存在分类',
    contactType: '不存在方式'
  }, { now: NOW });

  assert.strictEqual(item.type, 'lost');
  assert.strictEqual(item.category, 'other');
  assert.strictEqual(item.contactType, 'other');
});

test('normalize: 非法时间退化为参考时间，避免出现 NaN', () => {
  const item = itemModel.normalize({ lostAt: '不是时间', publishedAt: null }, { now: NOW });
  assert.strictEqual(item.lostAt, NOW);
  assert.strictEqual(item.publishedAt, NOW);
  assert.ok(!Number.isNaN(item.lostAt));
});

test('normalize: 未知字段被丢弃，不污染数据结构', () => {
  const item = itemModel.normalize({
    title: 'x', __proto__hack: 1, evil: 'boom', nested: { a: 1 }
  }, { now: NOW });

  assert.strictEqual(Object.prototype.hasOwnProperty.call(item, 'evil'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(item, 'nested'), false);
  assert.deepStrictEqual(Object.keys(item).sort(), itemModel.allowedKeys().sort());
});

test('normalize: 过滤脚本标签等特殊字符时保留原文（转义交给视图层）', () => {
  const raw = '<script>alert(1)</script>';
  const item = itemModel.normalize({ title: raw }, { now: NOW });
  // 模型层不做转义，避免同一份数据被重复转义
  assert.strictEqual(item.title, raw);
  // 视图层负责转义
  assert.strictEqual(util.escapeHtml(item.title), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

/* ============================================================ 校验 validate */

test('validate: 合法输入通过', () => {
  const result = itemModel.validate(validInput(), { now: NOW });
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.messages, []);
});

test('validate: 必填项缺失时逐项报错', () => {
  const result = itemModel.validate({}, { now: NOW });
  assert.strictEqual(result.valid, false);
  ['type', 'title', 'location', 'lostAt', 'contactType', 'contactValue'].forEach((key) => {
    assert.ok(result.errors[key], '缺少 ' + key + ' 的错误提示');
  });
});

test('validate: 物品名称超长被拒绝（边界 30 字通过、31 字拒绝）', () => {
  const max = schema.LIMITS.TITLE_MAX;

  const ok = itemModel.validate(validInput({ title: 'a'.repeat(max) }), { now: NOW });
  assert.strictEqual(ok.valid, true, max + ' 字应当通过');

  const tooLong = itemModel.validate(validInput({ title: 'a'.repeat(max + 1) }), { now: NOW });
  assert.strictEqual(tooLong.valid, false);
  assert.ok(tooLong.errors.title);
});

test('validate: 描述超长被拒绝（描述为选填，留空应通过）', () => {
  const max = schema.LIMITS.DESC_MAX;

  const empty = itemModel.validate(validInput({ description: '' }), { now: NOW });
  assert.strictEqual(empty.valid, true, '描述留空应当通过');

  const tooLong = itemModel.validate(validInput({ description: 'x'.repeat(max + 1) }), { now: NOW });
  assert.strictEqual(tooLong.valid, false);
  assert.ok(tooLong.errors.description);
});

test('validate: 时间晚于当前时间被拒绝', () => {
  const future = itemModel.validate(validInput({ lostAt: new Date(NOW + 3600 * 1000) }), { now: NOW });
  assert.strictEqual(future.valid, false);
  assert.ok(future.errors.lostAt);
});

test('validate: 允许一分钟内的时钟误差', () => {
  const nearlyNow = itemModel.validate(validInput({ lostAt: new Date(NOW + 30 * 1000) }), { now: NOW });
  assert.strictEqual(nearlyNow.valid, true);
});

test('validate: 地点超长被拒绝', () => {
  const result = itemModel.validate(
    validInput({ location: '地'.repeat(schema.LIMITS.LOCATION_MAX + 1) }), { now: NOW });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.location);
});

test('validate: 只有空白的字段视为未填写', () => {
  const result = itemModel.validate(validInput({ title: '   ', contactValue: '  ' }), { now: NOW });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.title);
  assert.ok(result.errors.contactValue);
});

/* ============================================================== 创建 create */

test('create: 合法输入生成带 id/状态/发布时间的新信息', () => {
  const result = itemModel.create(validInput(), { now: NOW });
  assert.strictEqual(result.ok, true);
  assert.match(result.item.id, /^LFL/);
  assert.strictEqual(result.item.status, schema.STATUS.ONGOING);
  assert.strictEqual(result.item.publishedAt, NOW);
  assert.strictEqual(result.item.resolved, false);
  assert.strictEqual(result.item.resolvedAt, null);
});

test('create: 非法输入返回错误集合且不产生 item', () => {
  const result = itemModel.create({ type: 'lost' }, { now: NOW });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.item, undefined);
  assert.ok(result.messages.length >= 4);
});

test('create: 本地时间字符串按本地时区解析，不被当成 UTC', () => {
  const result = itemModel.create(
    validInput({ lostAt: '2026-09-30 08:30' }), { now: NOW });
  assert.strictEqual(result.ok, true);
  const date = new Date(result.item.lostAt);
  assert.strictEqual(date.getHours(), 8);
  assert.strictEqual(date.getMinutes(), 30);
  assert.strictEqual(date.getDate(), 30);
});

/* ========================================================= 状态流转 */

test('applyResolved: 标记已解决会写入 resolvedAt，撤销时清空', () => {
  const item = itemModel.normalize(validInput(), { now: NOW });

  const done = itemModel.applyResolved(item, true, { now: NOW + 1000 });
  assert.strictEqual(done.resolved, true);
  assert.strictEqual(done.resolvedAt, NOW + 1000);
  assert.strictEqual(done.status, schema.STATUS.FOUND);

  const undone = itemModel.applyResolved(done, false, { now: NOW + 2000 });
  assert.strictEqual(undone.resolved, false);
  assert.strictEqual(undone.resolvedAt, null);
  assert.strictEqual(undone.status, schema.STATUS.ONGOING);
});

/* ============================================================ 状态与标签 */

test('statusMeta: 未知状态退化为「寻找中」，不会渲染出空白徽章', () => {
  const meta = schema.statusMeta('根本不存在的状态');
  assert.strictEqual(meta.label, '寻找中');
});

test('isActiveStatus: 只有进行中的状态鼓励联系发布者', () => {
  assert.strictEqual(schema.isActiveStatus(schema.STATUS.ONGOING), true);
  assert.strictEqual(schema.isActiveStatus(schema.STATUS.WAITING), true);
  assert.strictEqual(schema.isActiveStatus(schema.STATUS.FOUND), false);
  assert.strictEqual(schema.isActiveStatus(schema.STATUS.RETURNED), false);
});

/* ================================================================ 种子数据 */

test('seed: 种子数据全部能通过规范化并保持分类有效', () => {
  const items = seed.getSeedItems(NOW);
  assert.ok(items.length >= 8, '至少 8 条演示数据');

  const allowed = itemModel.allowedCategories();
  items.forEach((raw) => {
    const item = itemModel.normalize(raw, { now: NOW });
    assert.ok(allowed.indexOf(item.category) >= 0,
      item.title + ' 的分类 ' + item.category + ' 不合法');
    assert.ok(item.title.length > 0);
    assert.ok(item.location.length > 0);
    assert.ok(item.contactValue.length > 0);
  });
});

test('seed: 时间偏移符合预期（相对当前时间生成，不会显示成过期数据）', () => {
  const items = seed.getSeedItems(NOW);
  const first = items[0];
  // 第一条记录是「2 小时前发布」
  assert.strictEqual(NOW - first.publishedAt, 2 * 60 * 60 * 1000);
});

/* ================================================================ 仓储层 */

test('repository: list 返回全部并按发布时间倒序', () => {
  const items = repository.list();
  assert.ok(items.length >= 8);
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i - 1].publishedAt >= items[i].publishedAt, '应按发布时间倒序');
  }
});

test('repository: list 支持按类型过滤', () => {
  const lost = repository.list({ type: 'lost' });
  const found = repository.list({ type: 'found' });
  const all = repository.list({ type: 'all' });

  assert.strictEqual(lost.length + found.length, all.length);
  lost.forEach((item) => assert.strictEqual(item.type, 'lost'));
  found.forEach((item) => assert.strictEqual(item.type, 'found'));
});

test('repository: get 按 id 取单条，未命中返回 null', () => {
  const first = repository.list()[0];
  assert.strictEqual(repository.get(first.id).id, first.id);
  assert.strictEqual(repository.get('NOT_EXIST_ID'), null);
  assert.strictEqual(repository.get(''), null);
  assert.strictEqual(repository.get(null), null);
});

test('repository: add 后能被 get 到，且排在列表首位', () => {
  const created = itemModel.create(validInput({ title: '新增测试物品' }), { now: Date.now() });
  assert.strictEqual(created.ok, true);

  repository.add(created.item);
  const fetched = repository.get(created.item.id);
  assert.ok(fetched, '新增的信息应当能查到');
  assert.strictEqual(fetched.title, '新增测试物品');
  assert.strictEqual(repository.list()[0].id, created.item.id, '最新发布应排在最前');
});

test('repository: updateStatus 能标记已解决并同步 status', () => {
  const target = repository.list().find((item) => !item.resolved);
  const updated = repository.updateStatus(target.id, true, { now: NOW });

  assert.strictEqual(updated.resolved, true);
  assert.strictEqual(updated.resolvedAt, NOW);
  assert.strictEqual(updated.status, schema.deriveStatus(updated.type, true));
  assert.strictEqual(repository.get(target.id).status, updated.status);
});

test('repository: updateStatus 对不存在的 id 返回 null', () => {
  assert.strictEqual(repository.updateStatus('NOT_EXIST_ID', true), null);
});

test('repository: stats 与列表数据一致', () => {
  const items = repository.list();
  const stats = repository.stats();

  assert.strictEqual(stats.total, items.length);
  assert.strictEqual(stats.lost, items.filter((i) => i.type === 'lost').length);
  assert.strictEqual(stats.found, items.filter((i) => i.type === 'found').length);
  assert.strictEqual(stats.resolved, items.filter((i) => i.resolved).length);
  assert.strictEqual(stats.active + stats.resolved, stats.total);
});
