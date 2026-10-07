/* 手工冒烟检查：验证首页能否在无浏览器环境下渲染出内容。 */
'use strict';

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
h.global.LF.pages.home.init();

const html = h.document.getElementById('content').innerHTML;

const cards = html.match(/class="info-card/g) || [];
const titles = Array.from(html.matchAll(/card-title">([^<]+)</g)).map((m) => m[1]);
const overview = Array.from(html.matchAll(/ov-num">(\d+)</g)).map((m) => m[1]);

console.log('content length   =', html.length);
console.log('card count       =', cards.length);
console.log('overview numbers =', overview.join(','));
console.log('status bar       =', h.document.getElementById('statusBar').innerHTML.includes('status-bar'));
console.log('tab bar          =', h.document.getElementById('tabbar').innerHTML.includes('tabbar'));
console.log('titles:');
titles.forEach((t) => console.log('   -', t));

// 筛选到「寻物」后应只剩寻物卡片
h.global.LF.pages.home.setType('lost');
const lostHtml = h.document.getElementById('content').innerHTML;
const lostTitles = Array.from(lostHtml.matchAll(/card-title">([^<]+)</g)).map((m) => m[1]);
console.log('after filter lost:', lostTitles.length, 'cards');
console.log('   ', lostTitles.join(' | '));
