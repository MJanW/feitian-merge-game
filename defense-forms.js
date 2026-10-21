(function (root) {
  'use strict';

  // Add future cutout metadata here, without changing combat levels or old modes.
  // Each entry uses { image: 'assets/defense/portrait-11.png', frame: [x,y,w,h] }.
  const extraPortraits = Object.freeze([]);
  // This secret form has its own cutout and never joins the normal photo cycle.
  const goldenPortrait = Object.freeze({ image: 'assets/defense/golden-warrior.png', frame: Object.freeze([180, 30, 860, 1100]) });
  function portraits(levels = []) {
    return [...levels.slice(1), ...extraPortraits].filter(item => item && typeof item.image === 'string');
  }
  function forLevel(level, levels = []) {
    const n = Number.isSafeInteger(level) && level >= 0 ? level : 0;
    const choices = portraits(levels), count = choices.length || 1;
    const photoIndex = n % count;
    return { ...(choices[photoIndex] || {}), photoIndex, cycle: Math.floor(n / count), displayLevel: n + 1 };
  }
  const api = Object.freeze({ extraPortraits, goldenPortrait, portraits, forLevel });
  root.DefenseForms = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
