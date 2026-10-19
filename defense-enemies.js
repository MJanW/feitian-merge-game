(function (root) {
  'use strict';

  // Real product photos are loaded locally; combat values are fictional game rules.
  const types = Object.freeze([
    { kind: 'whisky', image: 'assets/defense/whisky.png', frame: Object.freeze([6, 0, 259, 750]), name: '威士忌', hp: 4, speed: 24, reward: 9, tint: '#c58a39', role: '均衡' },
    { kind: 'brandy', image: 'assets/defense/brandy.png', frame: Object.freeze([690, 172, 617, 1665]), name: '白兰地', hp: 7, speed: 18, reward: 15, tint: '#a76135', role: '厚甲' },
    { kind: 'wine', image: 'assets/defense/wine.png', frame: Object.freeze([102, 0, 82, 317]), name: '红酒', hp: 3, speed: 29, reward: 8, tint: '#7b344d', role: '轻装' },
    { kind: 'baijiu', image: 'assets/defense/baijiu.png', frame: Object.freeze([338, 23, 128, 397]), name: '白酒', hp: 5, speed: 25, reward: 12, tint: '#d65a42', role: '突进' },
    { kind: 'gin', image: 'assets/defense/gin.png', frame: Object.freeze([200, 1, 199, 598]), name: '金酒', hp: 2, speed: 37, reward: 8, tint: '#4d9bb1', role: '迅捷' },
    { kind: 'champagne', image: 'assets/defense/champagne.png', frame: Object.freeze([156, 43, 137, 488]), name: '香槟', hp: 10, speed: 20, reward: 20, tint: '#71915b', role: '重装' },
  ].map(Object.freeze));
  const byKind = Object.freeze(Object.fromEntries(types.map(type => [type.kind, type])));
  const api = Object.freeze({ types, byKind });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DefenseEnemies = api;
})(typeof window !== 'undefined' ? window : globalThis);
