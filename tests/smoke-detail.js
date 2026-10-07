/* 冒烟检查：详情页的完整信息展示、联系方式、已解决降权与「信息不存在」处理。 */
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
  'js/pages/detail.js'
];

/** 按 id 构建详情页。 */
function buildPage(id) {
  const h = createHarness(files);
  h.global.location.search = id == null ? '' : '?id=' + encodeURIComponent(id);
  h.global.LF.pages.detail.init();
  return h;
}

const contentOf = (h) => h.document.getElementById('content').innerHTML;
const bottomOf = (h) => h.document.getElementById('bottomBar').innerHTML;

/* ---- 1. 寻物信息：完整字段 + 进行中操作区 ---- */
{
  const h = buildPage('L20260924001');
  const html = contentOf(h);
  const bottom = bottomOf(h);

  assert.ok(html.includes('黑色校园卡'), '应展示物品名称');
  assert.ok(html.includes('图书馆三楼'), '应展示地点');
  assert.ok(html.includes('丢失时间'), '寻物信息应标注「丢失时间」');
  assert.ok(html.includes('丢失地点'), '寻物信息应标注「丢失地点」');
  assert.ok(html.includes('林同学'), '应展示发布者');
  assert.ok(html.includes('计算机学院'), '应展示发布者院系');
  assert.ok(html.includes('寻找中'), '应展示进行中状态');
  assert.ok(html.includes('lin_xy2026'), '应展示联系方式');
  assert.ok(html.includes('微信'), '应展示联系方式类型');
  assert.ok(html.includes('物品描述'), '应展示物品描述字段');
  // 种子数据的时间是「相对当前时间」生成的，因此这里不能断言写死的年月，
  // 只验证时间被格式化成「YYYY年M月D日 HH:mm」这种绝对时间。
  assert.match(html, /\d{4}年\d{1,2}月\d{1,2}日 \d{2}:\d{2}/, '应展示绝对时间');

  assert.ok(bottom.includes('联系发布者'), '进行中信息应提供联系入口');
  assert.ok(!bottom.includes('无需联系'), '进行中信息不应出现已完成提示');
  console.log('寻物详情        -> 字段完整 + 联系入口 OK');
}

/* ---- 2. 招领信息：拾取时间/地点措辞 ---- */
{
  const h = buildPage('L20260924002');
  const html = contentOf(h);
  assert.ok(html.includes('拾取时间'), '招领信息应标注「拾取时间」');
  assert.ok(html.includes('拾取地点'), '招领信息应标注「拾取地点」');
  assert.ok(html.includes('待认领'), '应展示待认领状态');
  assert.ok(!html.includes('丢失时间'), '招领信息不应出现「丢失时间」');
  console.log('招领详情        -> 措辞随类型切换 OK');
}

/* ---- 3. 已解决信息：降权 + 不鼓励联系 ---- */
{
  const h = buildPage('L20260922001');   // 已归还的钥匙
  const html = contentOf(h);
  const bottom = bottomOf(h);

  assert.ok(html.includes('已归还'), '应展示已归还状态');
  assert.ok(html.includes('is-inactive'), '联系方式卡片应降权');
  assert.ok(html.includes('无需再联系发布者'), '应说明不必再联系');
  assert.ok(html.includes('解决时间'), '应展示解决时间');
  assert.ok(bottom.includes('无需联系'), '底部应显示已完成');
  assert.ok(!bottom.includes('联系发布者'), '已解决信息不应再有联系按钮');
  console.log('已解决详情      -> 降权 + 禁止无效联系 OK');
}

/* ---- 4. 已找到（寻物）---- */
{
  const h = buildPage('L20260915001');   // 已归还
  assert.ok(contentOf(h).includes('已归还'), '书本信息应为已归还');
  console.log('已归还详情      -> OK');
}

/* ---- 5. id 不存在：明确提示而不是白屏 ---- */
{
  const h = buildPage('NOT_A_REAL_ID');
  const html = contentOf(h);
  assert.ok(html.includes('信息不存在'), '应提示信息不存在');
  assert.ok(html.includes('index.html'), '应提供返回首页的出口');
  assert.strictEqual(bottomOf(h), '', '不存在的信息不应渲染底部操作区');
  console.log('无效 id         -> 友好提示 OK');
}

/* ---- 6. 完全不带 id 参数 ---- */
{
  const h = buildPage(null);
  assert.ok(contentOf(h).includes('信息不存在'), '缺少 id 时应提示不存在');
  console.log('缺少 id 参数    -> 友好提示 OK');
}

/* ---- 7. XSS 防护：恶意联系方式不应破坏结构 ---- */
{
  const h = createHarness(files);
  h.global.location.search = '';
  const repo = h.global.LF.repository;
  repo.reset();
  repo.add({
    id: 'XSS1', type: 'lost', title: '<img src=x onerror=alert(1)>',
    description: '"><script>alert(2)</script>', category: 'other',
    location: '"><b>地点</b>', lostAt: Date.now(), publishedAt: Date.now(),
    contactType: 'wechat', contactValue: '" onmouseover="alert(3)',
    publisher: { name: '<b>坏人</b>' }, resolved: false
  });
  h.global.LF.pages.detail.init();
  // 直接渲染这条恶意信息
  const detail = h.global.LF.pages.detail;
  detail.render(repo.get('XSS1'));
  const html = contentOf(h);

  assert.ok(!html.includes('<img src=x'), '标签应被转义');
  assert.ok(!html.includes('<script>'), '脚本标签应被转义');
  assert.ok(!html.includes('onmouseover="alert(3)"'), '属性注入应被阻断');
  assert.ok(html.includes('&lt;b&gt;坏人&lt;/b&gt;'), '发布者名称应被转义');
  console.log('XSS 防护        -> 输出全部转义 OK');
}

/* ---- 8. 路由闭环：列表生成的链接能被详情页正确解析 ---- */
{
  const h = createHarness(files);
  h.global.location.search = '';
  const repo = h.global.LF.repository;
  const layout = h.global.LF.layout;
  const util = h.global.LF.util;

  let checked = 0;
  repo.list().forEach((item) => {
    const url = layout.detailUrl(item.id);
    // detailUrl 必须是「detail.html?id=...」并且 id 能原样解析出来
    const query = url.slice(url.indexOf('?'));
    const parsed = util.getQuery('id', query);
    assert.strictEqual(parsed, item.id,
      '详情链接中的 id 应能原样解析：' + url);
    assert.ok(repo.get(parsed), '解析出的 id 应能取到信息');
    checked++;
  });
  assert.ok(checked >= 8, '应校验全部种子数据的详情链接');
  console.log('详情路由闭环    ->', checked, '条链接全部可解析 OK');
}

/* ---- 9. 特殊字符 id 也能安全传递 ---- */
{
  const h = createHarness(files);
  h.global.location.search = '';
  const layout = h.global.LF.layout;
  const util = h.global.LF.util;

  ['a b', '中文&符号', 'x=y?z', 'a/b#c'].forEach((rawId) => {
    const url = layout.detailUrl(rawId);
    const query = url.slice(url.indexOf('?'));
    assert.strictEqual(util.getQuery('id', query), rawId,
      '特殊字符 id 应能正确往返：' + rawId);
  });
  console.log('特殊字符 id     -> 编码往返正常 OK');
}

console.log('\nSMOKE DETAIL OK');
