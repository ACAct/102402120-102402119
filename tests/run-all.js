/* ==========================================================================
   tests/run-all.js —— 单元测试入口
   等价于 `node --test tests/`，但把所有测试文件加载进同一个进程执行。

   为什么需要它：`node --test` 会为每个测试文件启动子进程，在受限环境下
   可能因进程创建被拒绝而失败（spawn EPERM）。本入口不创建子进程，
   因此在任何环境下都能跑，适合助教在受限机器上复现我们的测试结果。

   分三部分：
     1. *.test.js —— 纯逻辑单元测试（node:test 断言，有通过/失败计数）
     2. smoke-*.js —— 页面冒烟检查（用 DOM 桩验证「初始化 → 渲染出内容」）
     3. check-styles.js —— 样式完整性检查（渲染结果里的每个 class 都要有样式定义）
   ========================================================================== */
'use strict';

console.log('================ 第一部分：逻辑单元测试 ================\n');

require('./item.test.js');
require('./search.test.js');

// node:test 的断言在进程内同步执行，这里等它跑完再进入冒烟检查
setTimeout(function () {
  console.log('\n================ 第二部分：页面冒烟检查 ================\n');

  var smokeFiles = [
    './smoke-home.js',
    './smoke-search.js',
    './smoke-detail.js',
    './smoke-publish.js',
    './smoke-myposts.js'
  ];

  var failed = 0;
  smokeFiles.forEach(function (file) {
    try {
      require(file);
    } catch (error) {
      failed++;
      console.error('\n[冒烟检查失败] ' + file + '\n' + error.message);
    }
  });

  if (failed > 0) {
    console.error('\n有 ' + failed + ' 个冒烟检查未通过');
    process.exitCode = 1;
  } else {
    console.log('\n全部冒烟检查通过');
  }

  console.log('\n================ 第三部分：样式完整性检查 ================\n');
  try {
    require('./check-styles.js');
  } catch (error) {
    console.error('\n[样式检查失败] ' + error.message);
    process.exitCode = 1;
  }
}, 0);
