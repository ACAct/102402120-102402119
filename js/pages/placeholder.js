/* ==========================================================================
   js/pages/placeholder.js —— 待实现页面的占位控制器
   为什么需要它：首页/详情页会链接到发布页、我的发布、发布成功页。
   如果这些路由不存在，助教按目录说明点击时会直接 404——
   那正是第一次作业被指出的「页面画出来但点不动」问题。
   因此这里先给出可用、可返回的占位页，功能页随后续提交替换。

   页面通过 <body data-page="..."> 声明自己要显示什么。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root.LF.util, root.LF.layout);
  root.LF = root.LF || {};
  root.LF.pages = root.LF.pages || {};
  root.LF.pages.placeholder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (util, layout) {
  'use strict';

  /** 各待实现页面的说明（标题 + 计划交付的功能点）。 */
  var PAGES = {
    publish: {
      title: '发布信息',
      icon: 'edit',
      heading: '发布页正在施工中',
      sub: '发布表单、必填校验与「信息不完整」提示将在后续提交中完成。',
      backTo: 'home'
    },
    myposts: {
      title: '我的发布',
      icon: 'list',
      heading: '我的发布正在施工中',
      sub: '这里将展示我发布的信息，并提供「修改状态」入口把信息标记为已找到/已归还。',
      backTo: 'home'
    },
    success: {
      title: '发布成功',
      icon: 'checkCircle',
      heading: '发布成功页正在施工中',
      sub: '这里将展示发布结果，并引导用户前往「我的发布」查看状态。',
      backTo: 'home'
    }
  };

  /** 渲染占位内容。 */
  function render(key) {
    var conf = PAGES[key] || PAGES.publish;
    document.title = conf.title + ' · 校园失物招领';
    document.getElementById('chrome').innerHTML = layout.chrome();
    document.getElementById('statusBar').innerHTML = layout.statusBar();
    document.getElementById('content').innerHTML =
      layout.navbar(conf.title, { backTo: conf.backTo }) +
      layout.emptyState({
        icon: conf.icon,
        title: conf.heading,
        sub: conf.sub,
        actionLabel: '返回首页',
        actionHref: layout.ROUTES.home,
        visible: true
      });
  }

  function init() {
    layout.bindGlobalNav();
    render(document.body.getAttribute('data-page') || 'publish');
  }

  return { init: init, render: render, PAGES: PAGES };
});
