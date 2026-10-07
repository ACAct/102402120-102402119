/* ==========================================================================
   js/data/seed.js —— 首屏演示数据
   对应原型首页/搜索页出现的 8 条信息，用于「双击 index.html 即可看到效果」。
   注意：时间使用「相对当前时间」生成，而不是写死的日期——
   否则助教几天后打开页面，所有信息都会显示成「3天前/5天前」，看起来像过期数据。
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('../core/schema.js') : root.LF.schema);
  if (isNode) {
    module.exports = api;
  } else {
    root.LF = root.LF || {};
    root.LF.seed = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (schema) {
  'use strict';

  var MINUTE = 60 * 1000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;

  /**
   * 原始记录：publishedAgo / lostAgo 表示「距今多久」，在 getSeedItems() 中换算成时间戳。
   * resolvedAtAgo 仅用于已解决的信息，记录何时被标记（用于详情页展示状态维护结果）。
   */
  var RECORDS = [
    {
      id: 'L20260924001',
      type: 'lost',
      title: '黑色校园卡',
      description: '9月24日下午在图书馆三楼附近遗失，卡套为蓝色硅胶材质，卡面照片有些模糊。',
      category: 'card',
      location: '图书馆三楼',
      locationDetail: '三楼靠窗自习区',
      lostAgo: 26 * HOUR,
      publishedAgo: 2 * HOUR,
      contactType: 'wechat',
      contactValue: 'lin_xy2026',
      publisherName: '林同学',
      publisherDept: '计算机学院 · 大三',
      resolved: false
    },
    {
      id: 'L20260924002',
      type: 'found',
      title: '捡到一把雨伞（灰色长柄）',
      description: '伞柄有磨损，挂有蓝色编织挂绳，已交至三食堂二楼服务台。',
      category: 'umbrella',
      location: '三食堂二楼',
      locationDetail: '二楼服务台',
      lostAgo: 3 * HOUR + 20 * MINUTE,
      publishedAgo: 3 * HOUR,
      contactType: 'phone',
      contactValue: '138****6621',
      publisherName: '王同学',
      publisherDept: '外国语学院 · 大二',
      resolved: false
    },
    {
      id: 'L20260923001',
      type: 'lost',
      title: '白色 AirPods Pro 耳机',
      description: '充电盒内侧贴了星星贴纸，有轻微划痕，丢失在体育馆羽毛球场附近。',
      category: 'electronic',
      location: '体育馆羽毛球场',
      locationDetail: '3 号场地旁休息区',
      lostAgo: 1 * DAY + 6 * HOUR,
      publishedAgo: 8 * HOUR,
      contactType: 'wechat',
      contactValue: 'chen_yq',
      publisherName: '陈同学',
      publisherDept: '体育学院 · 大四',
      resolved: false
    },
    {
      id: 'L20260922001',
      type: 'found',
      title: '捡到一串钥匙（含宿舍门禁卡）',
      description: '共 4 把钥匙，挂坠是银色小铃铛，已找到失主并当面归还。',
      category: 'key',
      location: '操场东侧看台',
      locationDetail: '看台第三排',
      lostAgo: 2 * DAY,
      publishedAgo: 30 * HOUR,
      resolvedAtAgo: 4 * HOUR,
      contactType: 'qq',
      contactValue: '4420**881',
      publisherName: '赵同学',
      publisherDept: '土木工程学院 · 大三',
      resolved: true
    },
    {
      id: 'L20260921001',
      type: 'lost',
      title: '蓝色保温杯（500ml）',
      description: '杯盖深蓝色，贴有哆啦A梦贴纸，杯底有姓名贴，请拾到的同学联系我。',
      category: 'bottle',
      location: '教学楼 B301',
      locationDetail: 'B301 教室最后一排',
      lostAgo: 2 * DAY + 5 * HOUR,
      publishedAgo: 28 * HOUR,
      contactType: 'phone',
      contactValue: '159****3307',
      publisherName: '孙同学',
      publisherDept: '化学学院 · 大一',
      resolved: false
    },
    {
      id: 'L20260919001',
      type: 'found',
      title: '捡到一张学生卡（张*然）',
      description: '照片有些模糊，已联系到失主，可在校门保安室领取。',
      category: 'card',
      location: '校门保安室',
      locationDetail: '东门保安室',
      lostAgo: 3 * DAY,
      publishedAgo: 2 * DAY,
      contactType: 'other',
      contactValue: '东门保安室（8:00-20:00）',
      publisherName: '保安大叔',
      publisherDept: '后勤保卫处',
      resolved: false
    },
    {
      id: 'L20260918001',
      type: 'lost',
      title: 'iPhone 15 Pro 白色',
      description: '背面有透明手机壳，锁屏壁纸为猫咪照片，有定位追踪，拾到请务必联系。',
      category: 'electronic',
      location: '食堂门口',
      locationDetail: '一食堂北门',
      lostAgo: 4 * DAY,
      publishedAgo: 3 * DAY,
      contactType: 'phone',
      contactValue: '186****9014',
      publisherName: '吴同学',
      publisherDept: '经济与管理学院 · 大二',
      resolved: false
    },
    {
      id: 'L20260915001',
      type: 'found',
      title: '捡到高数课本（同济大学版）',
      description: '内页有笔记，封面贴有学号贴纸，已归还失主。',
      category: 'book',
      location: '图书馆四楼',
      locationDetail: '四楼自习区 A 区',
      lostAgo: 6 * DAY,
      publishedAgo: 5 * DAY,
      resolvedAtAgo: 2 * DAY,
      contactType: 'wechat',
      contactValue: 'zhou_mz',
      publisherName: '周同学',
      publisherDept: '数学与统计学院 · 大二',
      resolved: true
    }
  ];

  /**
   * 生成种子数据。
   * @param {number|Date} [now] 参考时间，便于单元测试固定时间
   * @returns {Array} 记录数组（未规范化，由 repository 统一处理）
   */
  function getSeedItems(now) {
    var base = now == null ? Date.now() : new Date(now).getTime();
    return RECORDS.map(function (record) {
      var item = {
        id: record.id,
        type: record.type,
        title: record.title,
        description: record.description,
        category: record.category,
        location: record.location,
        locationDetail: record.locationDetail || '',
        lostAt: base - record.lostAgo,
        publishedAt: base - record.publishedAgo,
        contactType: record.contactType,
        contactValue: record.contactValue,
        publisher: {
          name: record.publisherName,
          dept: record.publisherDept
        },
        resolved: record.resolved === true
      };
      item.status = schema.deriveStatus(item.type, item.resolved);
      item.resolvedAt = record.resolvedAtAgo == null ? null : base - record.resolvedAtAgo;
      return item;
    });
  }

  return {
    RECORDS: RECORDS,
    getSeedItems: getSeedItems
  };
});
