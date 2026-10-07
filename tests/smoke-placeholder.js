/* 冒烟检查：占位页（发布 / 我的发布 / 发布成功）能否正常渲染并接通返回首页的链接。 */
'use strict';

const { createHarness } = require('./dom-harness.js');

const files = [
  'js/core/util.js',
  'js/core/schema.js',
  'js/components/icons.js',
  'js/components/layout.js',
  'js/pages/placeholder.js'
];

let failed = 0;

['publish', 'myposts', 'success'].forEach((key) => {
  const h = createHarness(files);
  h.document.body.setAttribute = function () {};
  h.document.body.getAttribute = function () { return key; };

  h.global.LF.pages.placeholder.init();
  const html = h.document.getElementById('content').innerHTML;
  const ok = html.includes('empty-state show') && html.includes('index.html');
  console.log(key.padEnd(9), ok ? 'OK' : 'FAIL', '| length', html.length);
  if (!ok) failed++;
});

console.log(failed === 0 ? '\nALL PLACEHOLDER PAGES OK' : '\n' + failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);
