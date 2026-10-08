/* ==========================================================================
   tests/check-styles.js —— 样式完整性检查
   做法：用 DOM 桩真实运行三个页面的渲染，从渲染结果里取出所有 class 名，
         再检查每个类名是否在样式表中定义。

   为什么这样做：直接扫源码会被 JS 变量名（isLost、fieldClass 等）干扰，
   而「渲染出的 DOM」才是真正需要样式的对象。
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { createHarness } = require('./dom-harness.js');

const root = path.resolve(__dirname, '..');
const CSS_FILES = ['css/tokens.css', 'css/components.css', 'css/app.css'];
const css = CSS_FILES.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

const CORE = ['js/core/util.js', 'js/core/schema.js', 'js/data/seed.js', 'js/data/item.js',
  'js/data/repository.js', 'js/components/icons.js', 'js/components/layout.js'];

/** 从一段 HTML 中收集所有 class 名。 */
function collectClasses(html, into) {
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    m[1].split(/\s+/).forEach((c) => { if (c) into.add(c); });
  }
  return into;
}

/** 该类名是否在样式表中有定义。 */
function isStyled(cls) {
  // 转义正则元字符后查找 .cls 选择器
  const escaped = cls.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return new RegExp('\\.' + escaped + '(?![\\w-])').test(css);
}

const classes = new Set();
const report = [];

function checkPage(name, files, setup) {
  const h = createHarness(files);
  if (setup) setup(h);
  // 收集布局外壳（状态栏、底部导航等）
  ['chrome', 'statusBar', 'navSlot', 'tabbar', 'content', 'bottomBar'].forEach((id) => {
    collectClasses(h.document.getElementById(id).innerHTML || '', classes);
  });
  report.push(name);
}

/* 首页 */
checkPage('首页', CORE.concat(['js/components/item-card.js', 'js/pages/home.js']),
  (h) => { h.global.LF.pages.home.init(); });

/* 搜索页（有关键词，覆盖结果卡与高亮） */
checkPage('搜索页', CORE.concat(['js/core/search.js', 'js/components/item-card.js', 'js/pages/search.js']),
  (h) => { h.global.location.search = '?q=' + encodeURIComponent('校园卡'); h.global.LF.pages.search.init(); });

/* 详情页 */
checkPage('详情页', CORE.concat(['js/core/search.js', 'js/pages/detail.js']),
  (h) => { h.global.location.search = '?id=L20260924001'; h.global.LF.pages.detail.init(); });

/* 详情页（已解决态） */
checkPage('详情页-已解决', CORE.concat(['js/core/search.js', 'js/pages/detail.js']),
  (h) => { h.global.location.search = '?id=L20260922001'; h.global.LF.pages.detail.init(); });

/* 发布页 */
checkPage('发布页', CORE.concat(['js/pages/publish.js']),
  (h) => { h.global.LF.pages.publish.init(); });

/* 发布页（校验失败态，覆盖 has-error / field-error） */
checkPage('发布页-错误态', CORE.concat(['js/pages/publish.js']),
  (h) => {
    const p = h.global.LF.pages.publish;
    p.init();
    p.state.title = ''; p.state.location = ''; p.state.contactValue = '';
    p.state.publisherName = ''; p.state.lostAt = '';
    p.submit();
  });

/* 我的发布 */
checkPage('我的发布', CORE.concat(['js/pages/myposts.js']),
  (h) => { h.global.LF.pages.myposts.init(); });

/* 我的发布（已解决态，覆盖撤销按钮） */
checkPage('我的发布-已解决', CORE.concat(['js/pages/myposts.js']),
  (h) => {
    h.global.LF.pages.myposts.init();
    const p = h.global.LF.pages.myposts;
    const t = h.global.LF.repository.list().find((i) => !i.resolved);
    p.toggleStatus(t.id, true);
  });

/* 成功页 */
checkPage('发布成功页', CORE.concat(['js/pages/success.js']),
  (h) => { h.global.location.search = '?id=L20260924001'; h.global.LF.pages.success.init(); });

/* 空状态（覆盖 empty-state 相关类） */
checkPage('我的发布-空状态', CORE.concat(['js/pages/myposts.js']),
  (h) => {
    h.global.LF.util.storage.set('lf.myPublisher.v1', '不存在的人');
    h.global.LF.pages.myposts.init();
  });

/* ---- 汇总 ---- */
const missing = [...classes].filter((c) => !isStyled(c)).sort();

console.log('检查页面: ' + report.join('、'));
console.log('收集到 class 名: ' + classes.size + ' 个');
console.log('');

if (missing.length) {
  console.log('以下类名没有对应的样式定义：');
  missing.forEach((c) => console.log('  .' + c));
  process.exit(1);
} else {
  console.log('全部类名均有样式定义，页面样式完整。');
}
