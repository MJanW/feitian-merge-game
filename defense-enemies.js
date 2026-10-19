(function (root) {
  'use strict';

  // Bottle shapes refer to common packaging, but these combat values and
  // descriptive roles belong entirely to the game. No brand art is loaded.
  const types = Object.freeze([
    { kind: 'whisky', name: '威士忌', hp: 38, speed: 24, reward: 9, tint: '#c58a39', role: '均衡' },
    { kind: 'brandy', name: '白兰地', hp: 76, speed: 18, reward: 15, tint: '#a76135', role: '厚甲' },
    { kind: 'wine', name: '红酒', hp: 30, speed: 29, reward: 8, tint: '#7b344d', role: '轻装' },
    { kind: 'baijiu', name: '白酒', hp: 56, speed: 25, reward: 12, tint: '#d65a42', role: '突进' },
    { kind: 'gin', name: '金酒', hp: 24, speed: 37, reward: 8, tint: '#4d9bb1', role: '迅捷' },
    { kind: 'champagne', name: '香槟', hp: 110, speed: 20, reward: 20, tint: '#71915b', role: '重装' },
  ].map(Object.freeze));
  const byKind = Object.freeze(Object.fromEntries(types.map(type => [type.kind, type])));
  const api = Object.freeze({ types, byKind });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DefenseEnemies = api;
})(typeof window !== 'undefined' ? window : globalThis);
