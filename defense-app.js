(function (root) {
  'use strict';

  function initDefense(document, window) {
    const $ = id => document.getElementById(id);
    const canvas = $('defense-canvas');
    if (!canvas) return null;
    const BEST_KEY = 'feitian-defense-best-v5';
    const BEST_WAVE_KEY = 'feitian-defense-best-wave-v1';
    const HIT_RADIUS = 34;
    let game = null, audio = null, state = null, context = null, goldenImage = null, board = null;
    let roundId = makeRoundId(), roundRecorded = false, bestWave = 0;
    let active = false, focused = true, manualPaused = false;
    let selectedSlot = null, hoverSlot = null, pointer = null;
    let frame = null, lastFrame = null, destroyed = false;
    let best = 0, savedWarning = false, notice = '', noticeUntil = 0;
    let evolutionVisible = false, evolutionFocus = null, evolutionKey = null, evolutionPending = null;
    let discardChoice = null;
    const routeSlots = [0, 1, 2];
    const images = [], enemyImages = {}, listeners = [];
    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let soundEnabled = typeof window.GameSoundEnabled === 'boolean' ? window.GameSoundEnabled : read('photo-merge-sound', 'on') !== 'off';
    window.GameSoundEnabled = soundEnabled;

    function read(key, fallback) { try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
    function write(key, value) { try { window.localStorage.setItem(key, String(value)); return true; } catch { return false; } }
    function makeRoundId() { return window.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
    function ensureBoard() {
      if (board) return board;
      try {
        if (typeof window.DefenseLeaderboard === 'function') board = new window.DefenseLeaderboard({
          canOpen: () => !destroyed && active && !state?.pendingEvolution &&
            (!document.querySelector('dialog[open]') || $('defense-lb-dialog')?.open),
          onOpen: () => { clearInput(); syncPause(); },
          onClose: () => { if (!destroyed) syncPause(); },
        });
      } catch { /* Ranking is optional and must not interrupt the battlefield. */ }
      return board;
    }
    function listen(target, type, listener, options) { target?.addEventListener(type, listener, options); listeners.push([target, type, listener, options]); }
    function prop(id, key, value) { const element = $(id); if (element && element[key] !== value) element[key] = value; }
    function text(id, value) { prop(id, 'textContent', value); }
    function attr(id, key, value) { const element = $(id); if (element && element.getAttribute(key) !== value) element.setAttribute(key, value); }
    function callAudio(method, ...args) {
      try { const pending = audio?.[method]?.(...args); if (pending?.catch) pending.catch(() => {}); } catch { /* Sound is optional. */ }
    }
    function soundUI() {
      text('defense-sound', soundEnabled ? '音效开' : '音效关');
      attr('defense-sound', 'aria-pressed', String(soundEnabled));
    }
    function slots() { return window.DefenseGame?.SLOTS || game?.slots || []; }
    function unitAt(slot) { return game?.units?.find(unit => unit.slot === slot) || null; }
    function formForLevel(level) {
      const levels = window.GameLevels?.levels || [];
      if (window.DefenseForms) return window.DefenseForms.forLevel(level, levels);
      const count = Math.max(1, levels.length - 1), photoIndex = level % count;
      return { ...levels[photoIndex + 1], photoIndex, cycle: Math.floor(level / count), displayLevel: level + 1 };
    }
    function combatStats(unit) { return unit ? window.DefenseGame.statsForUnit(unit) : null; }
    function abilityName(stats) { return stats?.specialName || '旋刃'; }
    function routeInfo(route, level) { return window.DefenseGame.routeInfo(route, level); }
    function choiceInfo(unit, route, pending) { return window.DefenseGame.choiceInfo?.(unit, route, pending) || routeInfo(route, pending.level); }
    function stageName(level) { return level < 7 ? '元素觉醒' : level < 11 ? '属性进阶' : level < 15 ? '专属技能' : '元素专属强化'; }
    function nextStage(unit) {
      const nextLevel = Math.floor((unit.level + 1) / 4 + 1) * 4;
      return `Lv.${nextLevel} ${stageName(nextLevel - 1)}`;
    }
    function chanceFor(unit) { return unit ? window.DefenseGame.evolutionChance(unit.level) : 0; }
    function percent(value) { return `${Math.round(value * 1000) / 10}%`; }
    function routePath(unit) {
      return window.DefenseGame.evolutionPath(unit).map(({ level, route }) => routeInfo(route, level)?.name || route).join(' → ') || '等待 Lv.4 元素觉醒';
    }
    function blocked() { return !active || !focused || document.hidden || manualPaused || Boolean(document.querySelector('dialog[open]')); }
    function canAct() { return Boolean(game && state && state.status !== 'lost' && !state.isPaused && !state.pendingEvolution && !state.isCelebrating && !blocked()); }
    function overTrash(point) {
      const rect = $('defense-trash')?.getBoundingClientRect();
      return Boolean(rect && rect.width > 0 && rect.height > 0 && Number.isFinite(point?.clientX) && Number.isFinite(point?.clientY) &&
        point.clientX >= rect.left && point.clientX <= rect.left + rect.width && point.clientY >= rect.top && point.clientY <= rect.top + rect.height);
    }
    function discardReason(unit) {
      if (!unit) return '先选中一名守卫，或把不要的棋子拖进垃圾筐';
      if (unit.isGolden) return '黄金战士不能丢弃，可以用普通棋子投喂它';
      if (game.units.length <= 1 && state.reserve <= 0) return '至少保留一名守卫击蛋召集同伴';
      return '当前无法丢弃，请继续游戏后再试';
    }
    function renderTrash() {
      const unit = pointer?.unitId != null ? unitAt(pointer.slot) : unitAt(selectedSlot);
      const dragging = Boolean(pointer?.moved && pointer.unitId != null);
      const over = dragging && overTrash(pointer.latest);
      const eligible = Boolean(canAct() && unit && game.canDiscard(unit.slot, unit.id));
      const mode = over ? eligible ? 'over' : 'blocked' : dragging && eligible ? 'ready' : 'idle';
      attr('defense-trash', 'data-state', mode);
      prop('defense-trash', 'disabled', !canAct());
      text('defense-trash-label', mode === 'over' ? '松手丢弃' : mode === 'blocked' ? '不能丢弃' : '垃圾筐');
      const hint = unit && !eligible ? discardReason(unit) : '把普通棋子拖入垃圾筐，松手丢弃；也可以选中后点击垃圾筐';
      attr('defense-trash', 'title', hint);
      attr('defense-trash', 'aria-label', `垃圾筐。${hint}`);
    }
    function clearInput() {
      const previous = pointer; pointer = null; hoverSlot = null;
      try { if (previous && canvas.hasPointerCapture?.(previous.id)) canvas.releasePointerCapture(previous.id); } catch { /* Capture may already have ended. */ }
      renderTrash();
    }
    function stopFrame() {
      if (frame !== null) window.cancelAnimationFrame?.(frame);
      frame = null; lastFrame = null;
    }
    function draw() {
      if (!game || !context || !active || destroyed) return;
      renderTrash();
      window.DefenseRenderer?.draw?.(context, game, {
        images, enemyImages, goldenImage, formForLevel, levels: window.GameLevels?.levels || [], selectedSlot, hoverSlot,
        drag: pointer?.moved && pointer.unitId != null ? { id: pointer.id, fromSlot: pointer.slot, x: pointer.x, y: pointer.y, moved: true } : null,
        reducedMotion,
      });
    }
    function requestFrame() {
      if (frame === null && active && !blocked() && state?.status === 'playing' && !state.isPaused && !state.pendingEvolution && !destroyed && window.requestAnimationFrame) frame = window.requestAnimationFrame(tick);
    }
    function tick(timestamp) {
      frame = null;
      if (blocked()) { syncPause(); return; }
      if (!game || state?.status !== 'playing' || state.isPaused || state.pendingEvolution || destroyed) { lastFrame = null; return; }
      const elapsed = lastFrame === null ? 0 : Math.min(100, Math.max(0, timestamp - lastFrame));
      lastFrame = timestamp;
      if (elapsed > 0) game.step(elapsed);
      draw(); requestFrame();
    }
    function resize() {
      clearInput();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      if (Number.isFinite(viewportHeight) && viewportHeight > 0) document.documentElement?.style?.setProperty('--defense-viewport-height', `${viewportHeight}px`);
      if (!game) return;
      const width = window.DefenseGame.WIDTH || 520, height = window.DefenseGame.HEIGHT || 760;
      const ratio = Math.max(1, Math.min(3, Number(window.devicePixelRatio) || 1));
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context = canvas.getContext('2d');
      context?.setTransform?.(ratio, 0, 0, ratio, 0, 0);
      draw();
    }
    function syncPause() {
      if (!game) return;
      const pause = blocked();
      if (pause) { clearInput(); stopFrame(); callAudio('pause'); }
      game.pause(pause);
      render(game.getState()); draw(); requestFrame();
    }
    function saveBest(score) {
      if (!Number.isSafeInteger(score) || score < 0 || score <= best) return;
      best = score; savedWarning = !write(BEST_KEY, best);
    }
    function statusText(next) {
      if (next.status === 'lost') return '防线失守了，换个阵容再试一次';
      if (blocked() || next.isPaused) return '已暂停，点击「继续」守卫';
      if (next.isCelebrating) return '隐藏进化！黄金战士降临 · 登场期间战场暂停';
      if (next.pendingEvolution) return next.pendingEvolution.kind === 'golden' ? `黄金天赋 · 第 ${next.pendingEvolution.node} 个技能节点 · 战场已冻结` : '特殊进化！战场已冻结，请选择一条路线';
      if (notice && Date.now() < noticeUntil) return notice;
      if (next.status === 'ready') return '点击「出发」，布置你的第一道防线';
      if (next.nextWaveIn > 0) return '下一波即将来袭 · 趁现在调整阵容';
      return `第 ${next.wave} 波 · 剩余 ${next.remaining} 个入侵者 · 击碎孵化蛋获得同伴`;
    }
    function renderEvolution(next) {
      const pending = next.pendingEvolution;
      const visible = Boolean(pending && active && !blocked() && !next.isPaused && !next.isCelebrating && next.status !== 'lost');
      const pendingKey = pending ? `${pending.kind || 'element'}:${pending.unitId}:${pending.node ?? pending.level}` : null;
      const changedChoice = pendingKey !== evolutionKey;
      prop('defense-evolution', 'hidden', !visible);
      if (pending) {
        clearInput(); stopFrame();
        const unit = game?.units.find(candidate => candidate.id === pending.unitId);
        const golden = pending.kind === 'golden';
        attr('defense-evolution', 'data-kind', golden ? 'golden' : 'element');
        text('defense-evolution-title', golden ? `黄金 ${pending.rank} 阶 · 第 ${pending.node} 个技能节点` : `Lv.${pending.level + 1} · ${stageName(pending.level)}`);
        text('defense-evolution-detail', golden ? '升至第 3、5、7…阶获得天赋。选择一项，可重复强化；卡片显示本次变化。跨阶获得的天赋逐个选择，全部完成后继续战斗。' : `${unit ? routePath(unit) + '。' : ''}${pending.level < 7 ? '从本次随机出现的三种元素中选一种，后续沿同元素进化。' : pending.level < 11 ? '沿当前元素解锁更高阶属性，已学能力保留。' : pending.level < 15 ? '选择当前元素的专属技能，让守卫形成独特打法。' : '从本元素的三项强化中选一种，可重复选择。卡片显示本次提升，命中门槛、目标数、控制时长及冷却不变。'}同级、同元素即可合成，保留接收方技能。`);
        for (const slot of routeSlots) {
          const route = pending.choices[slot];
          const info = route ? choiceInfo(unit, route, pending) : null;
          prop(`defense-route-${slot}`, 'hidden', !info);
          prop(`defense-route-${slot}`, 'disabled', !visible || !info);
          attr(`defense-route-${slot}`, 'data-family', info?.family || 'normal');
          attr(`defense-route-${slot}`, 'data-route', route || '');
          text(`defense-route-${slot}-icon`, info?.icon || '✦');
          text(`defense-route-${slot}-name`, info?.name || '');
          text(`defense-route-${slot}-description`, info?.description || '');
          text(`defense-route-${slot}-rank`, info ? golden ? `第 ${pending.node} 个天赋` : pending.level < 15 ? stageName(pending.level) : `第 ${Math.floor((pending.level - 11) / 4)} 次强化` : '');
        }
      }
      const choices = routeSlots.map(slot => $(`defense-route-${slot}`)).filter(button => button && !button.hidden && !button.disabled);
      if (visible && (!evolutionVisible || changedChoice || !choices.includes(document.activeElement))) {
        if (!evolutionFocus) evolutionFocus = document.activeElement;
        choices[0]?.focus({ preventScroll: true });
      } else if (!visible && evolutionVisible && !pending && active && !blocked() && !next.isPaused) {
        const previous = evolutionFocus;
        (previous?.focus && !previous.disabled ? previous : canvas).focus({ preventScroll: true });
        evolutionFocus = null;
      }
      evolutionVisible = visible;
      evolutionKey = pendingKey;
      evolutionPending = visible ? pending : null;
    }
    function render(next) {
      state = next; saveBest(next.score);
      const paused = blocked() || next.isPaused, ended = next.status === 'lost';
      const unit = unitAt(selectedSlot);
      text('defense-score', next.score.toLocaleString());
      text('defense-best', best.toLocaleString());
      text('defense-wave', String(next.wave));
      text('defense-kills', String(next.kills));
      text('defense-lives', `${next.lives}/${next.maxLives}`);
      text('defense-status', statusText(next) + (savedWarning ? ' · 本机记录暂未保存' : ''));
      const reserveHint = next.reserve > 0 ? ` · 待命 ${next.reserve}` : '';
      const stats = combatStats(unit);
      const chance = chanceFor(unit);
      const golden = unit?.isGolden ? window.DefenseGame.goldenProgress(unit) : null;
      const nextGoldenRank = golden ? golden.rank % 2 ? golden.rank + 2 : golden.rank + 1 : null;
      const selection = (golden ? `黄金战士 · ${golden.rank} 阶 · 伤害 ${stats.damage.toLocaleString()} · ${stats.bladeCount} 把飞剑 · 下次天赋：第 ${nextGoldenRank} 阶` : unit ? `Lv.${unit.level + 1} ${abilityName(stats)} · 伤害 ${stats.damage.toLocaleString()} · 路线：${routePath(unit)} · 下次：${nextStage(unit)}` : next.reserve > 0 ? '点击空位让同伴上场' : '拖近酒瓶迎敌 · 拖近孵化蛋召集') + reserveHint;
      text('defense-selection', selection);
      attr('defense-selection', 'title', selection);
      attr('defense-selection', 'aria-label', selection);
      text('defense-unit-stats', golden ? `${stats.bladeCount} 把黄金飞剑 · 下次天赋：第 ${nextGoldenRank} 阶` : unit ? `${stats.bladeCount} 把飞刃 · 下次分支：${nextStage(unit)}` : 'Lv.4 元素 · Lv.8 属性 · Lv.12 技能 · Lv.16 起元素强化');
      text('defense-reserve', `待命 ${next.reserve} 位`);
      text('defense-evolution-risk', golden ? '拖入任意普通守卫投喂，按显示等级累计进度。投喂必定生效，超出进度会保留。' : unit ? `合成成功 ${percent(chance)} · 同级同元素，保留接收方技能。失败仅消耗拖入者，原守卫等级与路线保留。` : '同级同元素即可合成，保留接收方技能。失败仅消耗拖入者。');
      attr('defense-evolution-risk', 'title', $('defense-evolution-risk')?.textContent || '');
      attr('defense-tools', 'data-golden', String(Boolean(golden)));
      prop('defense-golden-progress', 'hidden', !golden);
      if (golden) {
        const progressLabel = `${golden.progress.toLocaleString()} / ${golden.required.toLocaleString()} 级 · 拖入普通守卫投喂`;
        text('defense-golden-progress-label', progressLabel);
        prop('defense-golden-meter', 'max', golden.required);
        prop('defense-golden-meter', 'value', golden.progress);
        attr('defense-golden-meter', 'aria-valuetext', `黄金战士 ${golden.rank} 阶，已投喂 ${golden.progress} 级，升阶需要 ${golden.required} 级`);
      }
      prop('defense-restart', 'disabled', Boolean(next.pendingEvolution));
      prop('defense-guide-open', 'disabled', Boolean(next.pendingEvolution));
      prop('defense-leaderboard-button', 'disabled', Boolean(next.pendingEvolution));
      text('defense-pause', paused ? '继续' : '暂停');
      attr('defense-pause', 'aria-pressed', String(paused));
      prop('defense-pause', 'disabled', next.status !== 'playing');
      prop('defense-intro', 'hidden', next.status !== 'ready' || !active);
      prop('defense-paused', 'hidden', !active || !paused || next.status !== 'playing');
      prop('defense-result', 'hidden', !ended);
      if (ended) {
        text('defense-result-title', '防线守到了第几波？');
        text('defense-result-detail', `到达第 ${next.wave} 波 · ${next.score.toLocaleString()} 分 · 击退 ${next.kills} 个入侵者` + (savedWarning ? ' · 本机记录保存失败' : ` · 本机最高第 ${bestWave} 波`));
      }
      renderEvolution(next);
      renderTrash();
      requestFrame();
    }
    function completed(next) {
      if (Number.isSafeInteger(next.wave) && next.wave > bestWave && next.wave <= 1000000000) {
        bestWave = next.wave;
        savedWarning = !write(BEST_WAVE_KEY, bestWave) || savedWarning;
      }
      clearInput(); stopFrame(); render(next); draw();
      if (active) $('defense-result-title')?.focus({ preventScroll: true });
      if (roundRecorded || !Number.isSafeInteger(next.wave) || next.wave <= 0 || next.wave > 1000000000) return;
      roundRecorded = true;
      const finishedId = roundId, ranking = ensureBoard();
      if (!ranking) { text('defense-submit-status', '波数已在本机记录；排行榜组件未加载，请刷新后重试。'); return; }
      try {
        Promise.resolve(ranking.record(next.wave, finishedId)).catch(() => {
          if (!destroyed && roundId === finishedId) text('defense-submit-status', '波数上传未确认，请打开排行榜重试。');
        });
      } catch { text('defense-submit-status', '波数上传未确认，请打开排行榜重试。'); }
    }
    function showNotice(message) { notice = message; noticeUntil = Date.now() + 1900; if (game) { render(game.getState()); draw(); } }
    function onEvent(event) {
      if (active && !blocked()) callAudio('play', event);
      const messages = { merge: '合成成功，守卫进化了！', hit: '有入侵者突破了防线！', clear: '这一波守住了！趁现在移动和进化', hatch: event.reserve ? '孵化成功！阵位已满，同伴正在待命' : '孵化成功，新同伴加入防线！', wave: `第 ${event.wave || game?.getState().wave || 1} 波来袭` };
      if (event.type === 'evolveFail') messages.evolveFail = `合成失败，拖入的守卫已消耗；原守卫保留 Lv.${event.level + 1} 与路线`;
      if (event.type === 'route') messages.route = `${routeInfo(event.route, event.level)?.name || '特殊能力'}已觉醒！所选路线已生效`;
      if (event.type === 'golden') {
        clearInput();
        selectedSlot = event.slot;
        messages.golden = '隐藏进化！黄金战士降临，拖入任意普通守卫为它升阶';
      }
      if (event.type === 'feed') messages.feed = event.rank > event.previousRank ? `黄金战士升至 ${event.rank} 阶！攻击随升阶提升，余量已保留` : `投喂成功 +${event.gained} 级 · 升阶进度 ${event.progress}/${event.required}`;
      if (event.type === 'discard') messages.discard = `已丢弃 Lv.${event.level + 1} 守卫，腾出一个阵位`;
      if (event.type === 'hatch' && Number.isInteger(event.level)) messages.hatch += ` · Lv.${event.level + 1}` + (Object.keys(event.routeChoices || {}).length ? '，继承击蛋者的已解锁路线' : '，尚未觉醒元素');
      if (messages[event.type]) { notice = messages[event.type]; noticeUntil = Date.now() + (event.type === 'golden' ? 6000 : event.type === 'evolveFail' || event.type === 'feed' ? 4200 : 1700); }
    }
    function preload() {
      if (typeof window.Image !== 'function') return;
      const levels = window.GameLevels?.levels || [];
      const forms = window.DefenseForms?.portraits(levels) || levels.slice(1);
      for (let i = 0; i < forms.length; i++) {
        if (!forms[i]?.image) continue;
        const image = new window.Image();
        image.onload = () => { if (!destroyed) draw(); };
        image.onerror = () => { images[i] = null; if (!destroyed) draw(); };
        images[i] = image; image.src = forms[i].image;
      }
      if (window.DefenseForms?.goldenPortrait?.image) {
        const image = new window.Image();
        image.onload = () => { if (!destroyed) draw(); };
        image.onerror = () => { goldenImage = null; if (!destroyed) draw(); };
        goldenImage = image; image.src = window.DefenseForms.goldenPortrait.image;
      }
      for (const type of window.DefenseEnemies?.types || []) {
        if (!type.image) continue;
        const image = new window.Image();
        image.onload = () => { if (!destroyed) draw(); };
        image.onerror = () => { delete enemyImages[type.kind]; if (!destroyed) draw(); };
        enemyImages[type.kind] = image; image.src = type.image;
      }
    }
    function renderGuide() {
      const list = $('defense-reactions');
      if (!list) return;
      list.replaceChildren();
      for (const reaction of window.DefenseGame.REACTIONS || []) {
        const item = document.createElement('li');
        const heading = document.createElement('strong');
        heading.textContent = `${reaction.elements.map(element => routeInfo(element)?.name || element).join(' + ')} · ${reaction.name}`;
        const description = document.createElement('span');
        description.textContent = reaction.description;
        item.append(heading, description); list.append(item);
      }
      const enhancements = $('defense-enhancements');
      if (enhancements) {
        enhancements.replaceChildren();
        for (const route of Object.values(window.DefenseGame.ENHANCEMENTS || {}).flat()) {
          const info = routeInfo(route);
          const item = document.createElement('li'), heading = document.createElement('strong'), description = document.createElement('span');
          heading.textContent = info.name; description.textContent = info.description;
          item.append(heading, description); enhancements.append(item);
        }
      }
    }
    function ensureGame() {
      if (game) return true;
      try {
        if (typeof window.DefenseGame !== 'function') throw new Error('四周目文件未加载，请刷新后重试');
        const stored = Number(read(BEST_KEY, '0'));
        best = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
        const storedWave = Number(read(BEST_WAVE_KEY, '0'));
        bestWave = Number.isSafeInteger(storedWave) && storedWave >= 0 && storedWave <= 1000000000 ? storedWave : 0;
        ensureBoard();
        try { if (typeof window.DefenseAudio === 'function') audio = new window.DefenseAudio({ enabled: soundEnabled }); } catch { /* Audio failure must not block play. */ }
        callAudio('setEnabled', soundEnabled);
        game = new window.DefenseGame({ onChange: render, onEvent, onComplete: completed });
        render(game.getState()); resize(); preload(); renderGuide();
        return true;
      } catch (error) {
        text('defense-status', error.message || '四周目启动失败，请刷新后重试');
        return false;
      }
    }
    function reset(ask = true) {
      if (!active || !ensureGame() || state?.pendingEvolution || document.querySelector('dialog[open]')) return;
      if (ask && state?.status === 'playing') {
        clearInput(); stopFrame(); game.pause(true); callAudio('pause');
        if (!window.confirm('重新开始会清空本局进度，本机纪录和已结束对局的待上传波数会保留。确定吗？')) { syncPause(); return; }
      }
      clearInput(); stopFrame(); selectedSlot = null; focused = true; manualPaused = false; notice = ''; savedWarning = false;
      roundId = makeRoundId(); roundRecorded = false; board?.clearStatus?.();
      text('defense-submit-status', ''); prop('defense-submit-retry', 'hidden', true);
      callAudio('pause'); game.reset(); syncPause(); canvas.focus({ preventScroll: true });
    }
    function position(event) {
      const rect = canvas.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return null;
      return { x: (event.clientX - rect.left) / rect.width * (window.DefenseGame.WIDTH || 520), y: (event.clientY - rect.top) / rect.height * (window.DefenseGame.HEIGHT || 760) };
    }
    function slotAt(point) {
      if (!point) return null;
      let closest = null, distance = HIT_RADIUS;
      slots().forEach((slot, index) => { const next = Math.hypot(slot.x - point.x, slot.y - point.y); if (next <= distance) { closest = index; distance = next; } });
      return closest;
    }
    function deploy(slot) {
      if (!canAct() || slot === null) return;
      selectedSlot = slot;
      if (!unitAt(slot) && !game.place(slot)) showNotice(state.reserve > 0 ? '这个位置暂时不能部署' : '把守卫拖到右下方，击碎孵化蛋获得同伴');
      render(game.getState()); draw();
    }
    function chooseRoute(route) {
      if (!game || !evolutionPending || !state?.pendingEvolution || !evolutionVisible || blocked() || state.isPaused) return;
      const pending = evolutionPending;
      clearInput(); stopFrame();
      if (game.chooseEvolution(route, pending)) { render(game.getState()); draw(); requestFrame(); }
    }
    function discardUnit(slot, id) {
      const unit = unitAt(slot);
      if (!canAct() || unit?.id !== id) return false;
      if (!game.discard(slot, id)) { showNotice(discardReason(unit)); return false; }
      selectedSlot = null;
      render(game.getState()); draw();
      return true;
    }
    function finishPointer(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      const held = pointer, destination = slotAt(position(event)), trash = overTrash(event);
      const allowed = canAct(); clearInput();
      if (!allowed) { draw(); return; }
      event.preventDefault();
      if (held.moved && held.unitId != null) {
        const source = unitAt(held.slot);
        if (trash && source?.id === held.unitId) discardUnit(held.slot, held.unitId);
        else if (destination !== null && destination !== held.slot && source?.id === held.unitId) {
          if (game.move(held.slot, destination)) selectedSlot = destination;
          else {
            const target = unitAt(destination);
            showNotice(source.isGolden || target?.isGolden
              ? '把普通守卫拖到黄金战士上即可投喂；黄金战士可拖到空位移动'
              : target && source.level === target.level && !window.DefenseGame.canMerge(source, target)
                ? '基础元素不同，无法合成；双方守卫均已保留'
                : '只能合成同级、同元素的守卫，技能可以不同；或拖到空位移动');
          }
        }
      } else if (!held.moved && destination === held.slot) deploy(destination);
      render(game.getState()); draw();
    }
    function unlock(event) { if (active && event.isTrusted) callAudio('unlock'); }
    listen(document, 'pointerdown', unlock, { capture: true });
    listen(document, 'keydown', unlock, { capture: true });
    listen(canvas, 'pointerdown', event => {
      if (!canAct() || pointer || event.isPrimary === false || event.button != null && event.button !== 0) return;
      const point = position(event), slot = slotAt(point);
      if (slot === null) return;
      event.preventDefault(); selectedSlot = slot; hoverSlot = slot;
      pointer = { id: event.pointerId, slot, unitId: unitAt(slot)?.id ?? null, clientX: event.clientX, clientY: event.clientY, latest: { clientX: event.clientX, clientY: event.clientY }, ...point, moved: false };
      try { canvas.setPointerCapture(event.pointerId); } catch { /* Window listeners handle release if capture is unavailable. */ }
      canvas.focus({ preventScroll: true }); render(game.getState()); draw();
    });
    function movePointer(event) {
      if (!active || blocked() || state?.pendingEvolution || pointer && pointer.id !== event.pointerId) return;
      const point = position(event); hoverSlot = slotAt(point);
      if (pointer && point) {
        event.preventDefault(); pointer.x = point.x; pointer.y = point.y;
        pointer.latest = { clientX: event.clientX, clientY: event.clientY };
        pointer.moved ||= Math.hypot(event.clientX - pointer.clientX, event.clientY - pointer.clientY) > 7;
      }
      draw();
    }
    listen(canvas, 'pointermove', movePointer);
    listen(window, 'pointermove', event => { if (pointer && event.target !== canvas) movePointer(event); });
    listen(canvas, 'pointerup', finishPointer);
    listen(window, 'pointerup', finishPointer);
    const cancelPointer = event => { if (!pointer || event.pointerId != null && pointer.id !== event.pointerId) return; clearInput(); draw(); };
    listen(canvas, 'pointercancel', cancelPointer);
    listen(window, 'pointercancel', cancelPointer);
    listen(canvas, 'lostpointercapture', cancelPointer);
    listen(canvas, 'pointerleave', () => { if (!pointer) { hoverSlot = null; draw(); } });
    function selectDirection(key) {
      const choices = slots();
      if (!choices.length) return;
      if (selectedSlot === null) { selectedSlot = 0; return; }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
      const source = choices[selectedSlot]; let chosen = selectedSlot, distance = Infinity;
      choices.forEach((slot, index) => {
        const dx = slot.x - source.x, dy = slot.y - source.y;
        if (dx * direction[0] + dy * direction[1] <= 1) return;
        const next = Math.hypot(dx, dy) + Math.abs(dx * direction[1] - dy * direction[0]) * 3;
        if (next < distance) { chosen = index; distance = next; }
      });
      selectedSlot = chosen;
    }
    listen(document, 'keydown', event => {
      if (active && state?.pendingEvolution) {
        if (!evolutionVisible || blocked() || event.metaKey || event.ctrlKey || event.altKey) return;
        const choices = routeSlots.map(slot => $(`defense-route-${slot}`)).filter(button => button && !button.hidden && !button.disabled);
        const current = choices.indexOf(document.activeElement);
        if (event.key === 'Tab' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault();
          const reverse = event.shiftKey || event.key === 'ArrowUp' || event.key === 'ArrowLeft';
          choices[(current + (reverse ? -1 : 1) + choices.length) % choices.length]?.focus({ preventScroll: true });
        } else if (!/^(BUTTON|A)$/.test(event.target?.tagName || '')) event.preventDefault();
        return;
      }
      if (!active || !game || event.metaKey || event.ctrlKey || event.altKey || event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(event.target?.tagName || '') || document.querySelector('dialog[open]')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === 'Tab') { clearInput(); draw(); return; }
      if (key === 'p' || key === 'Escape') { if (state.status !== 'playing') return; event.preventDefault(); if (!event.repeat) togglePause(); return; }
      if (key === 'r') { event.preventDefault(); if (!event.repeat) reset(); return; }
      if (!canAct()) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) { event.preventDefault(); clearInput(); selectDirection(key); render(game.getState()); draw(); }
      else if (key === 'Enter' || key === ' ') { event.preventDefault(); if (!event.repeat) deploy(selectedSlot ?? 0); }
    });
    function togglePause() {
      if (!active || !game || state.status !== 'playing' || document.querySelector('dialog[open]')) return;
      focused = true; manualPaused = !manualPaused; syncPause();
      if (!manualPaused && !state.pendingEvolution) canvas.focus({ preventScroll: true });
    }
    listen($('defense-start'), 'click', () => {
      if (!active || !ensureGame() || state.status !== 'ready' || state.pendingEvolution || document.querySelector('dialog[open]')) return;
      focused = true; manualPaused = false; game.start(); syncPause(); canvas.focus({ preventScroll: true });
    });
    for (const slot of routeSlots) listen($(`defense-route-${slot}`), 'click', event => {
      if (event.detail > 1) return;
      const button = $(`defense-route-${slot}`), route = evolutionPending?.choices[slot];
      if (route && button && !button.hidden && !button.disabled) chooseRoute(route);
    });
    listen($('defense-pause'), 'click', togglePause);
    listen($('defense-restart'), 'click', () => reset());
    listen($('defense-retry'), 'click', () => reset(false));
    listen($('defense-trash'), 'click', () => {
      if (!canAct() || pointer) return;
      const unit = unitAt(selectedSlot);
      if (!unit || !game.canDiscard(unit.slot, unit.id)) { showNotice(discardReason(unit)); return; }
      discardChoice = { slot: unit.slot, id: unit.id };
      text('defense-discard-detail', `已选中 Lv.${unit.level + 1} ${abilityName(combatStats(unit))}。`);
      clearInput(); $('defense-discard-dialog')?.showModal(); syncPause();
      $('defense-discard-cancel')?.focus({ preventScroll: true });
    });
    const cancelDiscard = () => $('defense-discard-dialog')?.close();
    listen($('defense-discard-cancel'), 'click', cancelDiscard);
    listen($('defense-discard-close'), 'click', cancelDiscard);
    listen($('defense-discard-confirm'), 'click', () => {
      if (!discardChoice || !active || document.hidden || !focused || state?.pendingEvolution || state?.status === 'lost') return;
      const choice = discardChoice;
      // The round was running when this dialog opened. Explicit confirmation
      // resumes it, including after returning from a temporarily hidden tab.
      manualPaused = false;
      $('defense-discard-dialog')?.close(); syncPause();
      discardUnit(choice.slot, choice.id);
    });
    listen($('defense-discard-dialog'), 'close', () => {
      discardChoice = null;
      if (active && !document.hidden && focused) canvas.focus({ preventScroll: true });
    });
    listen($('defense-guide-open'), 'click', () => {
      if (!active || state?.pendingEvolution || document.querySelector('dialog[open]')) return;
      clearInput(); $('defense-guide-dialog')?.showModal(); syncPause();
    });
    listen($('defense-guide-close'), 'click', () => $('defense-guide-dialog')?.close());
    listen($('defense-sound'), 'click', () => {
      soundEnabled = !soundEnabled; window.GameSoundEnabled = soundEnabled;
      write('photo-merge-sound', soundEnabled ? 'on' : 'off'); callAudio('setEnabled', soundEnabled); soundUI();
      window.dispatchEvent(new window.Event('feitian-soundchange'));
    });
    listen(window, 'feitian-soundchange', () => {
      if (typeof window.GameSoundEnabled === 'boolean') soundEnabled = window.GameSoundEnabled;
      callAudio('setEnabled', soundEnabled); soundUI();
    });
    listen(window, 'feitian-modechange', event => {
      const wasActive = active; active = event.detail?.mode === 'defense';
      clearInput(); stopFrame();
      if (!active && discardChoice) cancelDiscard();
      if (!active && $('defense-lb-dialog')?.open) $('defense-lb-dialog').close();
      if (!active && wasActive && state?.status === 'playing') manualPaused = true;
      if (active && !ensureGame()) return;
      soundUI(); if (active) resize(); syncPause();
    });
    listen(window, 'blur', () => { focused = false; if (active && state?.status === 'playing') manualPaused = true; syncPause(); });
    listen(window, 'focus', () => { focused = true; syncPause(); });
    listen(document, 'visibilitychange', () => { if (document.hidden && active && state?.status === 'playing') manualPaused = true; syncPause(); });
    listen(window, 'resize', resize);
    listen(window, 'orientationchange', resize);
    listen(window.visualViewport, 'resize', resize);
    document.querySelectorAll('dialog').forEach(dialog => listen(dialog, 'close', syncPause));
    soundUI();
    return {
      get game() { return game; },
      destroy() {
        destroyed = true; clearInput(); stopFrame(); callAudio('destroy');
        if (discardChoice) cancelDiscard();
        if (game) game.pause(true);
        for (const [target, type, listener, options] of listeners) target?.removeEventListener?.(type, listener, options);
        for (const image of [...images, goldenImage, ...Object.values(enemyImages)]) if (image) image.onload = image.onerror = null;
      },
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = initDefense;
  else initDefense(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis);
