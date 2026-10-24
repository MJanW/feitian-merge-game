(function (root) {
  'use strict';
  function initGarden(document, window) {
    const $ = id => document.getElementById(id), canvas = $('garden-canvas');
    if (!canvas) return null;
    let game = null, renderer = null, prepRenderer = null, audio = null, state = null, active = false, manualPaused = false;
    let selected = 'shooter', shovel = false, plantFoodSelected = false, mapChapter = 'garden', hover = null, pointer = null, pendingLevel = null, pendingDestination = 'deck';
    let phase = 'map', introElapsed = 0, previewElapsed = 0, endingElapsed = -1, deckSelection = new Set(), selectedPacket = null, traySignature = '', selectedCart = null, cartMode = false;
    const traySlots = [], packetSlots = [];
    const INTRO_MS = 2400;
    const SPEED_KEY = 'feitian-garden-speed';
    const SPEEDS = [['garden-speed-1', 1], ['garden-speed-15', 1.5], ['garden-speed-2', 2]];
    const savedSpeed = Number(read(SPEED_KEY, '1'));
    let preferredSpeed = [1, 1.5, 2].includes(savedSpeed) ? savedSpeed : 1;
    const SHORTCUTS = ['1','2','3','4','5','6','7','8'];
    const CHAPTERS = [
      { id: 'garden', name: '花园', symbol: '✿', detail: '01 / 花园 · 10 关，从第一束阳光学会布防' },
      { id: 'pool', name: '泳池', symbol: '≈', detail: '02 / 泳池 · 10 关，莲叶托起水上防线' },
      { id: 'western', name: '沙漠西部', symbol: '♧', detail: '03 / 沙漠西部 · 10 关，矿车沿铁轨调动火力' },
    ];
    let storage;
    try { storage = window.localStorage; } catch (_) {}
    const progress = window.GardenProgress?.create({ storage });
    let progressSnapshot = progress?.getSnapshot(), campaignSeed = progressSnapshot?.campaignSeed;
    const chapterButtons = new Map(), sunFlights = new Set();
    let frame = null, lastFrame = null, destroyed = false, notice = '', noticeUntil = 0;
    const cards = new Map(), deckCards = new Map(), levelButtons = [], listeners = [], completed = new Set();
    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let soundEnabled = typeof window.GameSoundEnabled === 'boolean' ? window.GameSoundEnabled : read('photo-merge-sound', 'on') !== 'off';
    if (progressSnapshot) for (const id of progressSnapshot.completed) completed.add(id);
    function syncProgress(event) {
      if (!progress) return;
      progress.refresh(event); progressSnapshot = progress.getSnapshot();
      for (const id of progressSnapshot.completed) completed.add(id);
      saveStatus();
      if (game) { refreshMap(); refresh(); }
    }
    function saveStatus(message) {
      const status = progress?.getStatus();
      attr($('garden-save-status'), 'data-error', !status?.saved);
      text('garden-save-status', message || (!progress ? '存档模块未加载，请刷新页面后继续。' : status.message ? status.message : !status.saved ? '通关进度暂未保存。请在世界地图导出存档，再尝试重新保存。' : status.recovered ? '已从本机备份恢复进度，通关记录已保存。' : status.migrated ? '旧版通关记录已接续，进度已自动保存。' : '通关记录已自动保存，更新会接续进度。'));
    }
    function exportProgress() {
      if (!progress || phase !== 'map') return;
      let url, link;
      try {
        const data = progress.exportData();
        url = window.URL.createObjectURL(new window.Blob([data], { type: 'application/json' }));
        link = document.createElement('a'); link.href = url;
        link.download = `飞天花园存档-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link); link.click();
        text('garden-backup-message', '已生成存档文件，请确认已下载或保存到“文件”。导入旧存档也不会减少进度。');
      } catch (_) { text('garden-backup-message', '下载未完成，请用 Safari 或 Chrome 打开同一网址后重试。'); }
      finally { link?.remove(); if (url) window.setTimeout(() => window.URL.revokeObjectURL(url), 60000); }
      syncProgress();
    }
    async function importProgress() {
      const input = $('garden-import-file'), file = input?.files?.[0];
      if (!file || !progress || phase !== 'map') return;
      const button = $('garden-import'); button.disabled = true;
      try {
        if (file.size > 262144) throw new Error('存档文件过大，请选择飞天花园导出的 JSON 文件。');
        const data = await file.text();
        if (destroyed) return;
        progress.importData(data); syncProgress();
        if (game && phase === 'map') {
          const index = resumeIndex(); game.reset(index); state = game.getState(); mapChapter = game.level.chapter;
          deckSelection = new Set(recommendedDeck()); refreshMap(); refresh();
        }
        text('garden-backup-message', progress.getStatus().saved ? '存档已合并，原有通关记录全部保留。' : '存档已读入，但浏览器仍无法保存。离开前请导出合并后的存档。');
      } catch (error) { text('garden-backup-message', error.message || '无法读取存档，现有记录未改变。'); }
      finally { input.value = ''; button.disabled = false; }
    }
    function read(key, fallback) { try { return window.localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } }
    function write(key, value) { try { window.localStorage.setItem(key, value); } catch (_) {} }
    function listen(target, type, fn, opts) { target?.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }
    function text(id, value) { const node = $(id); if (node && node.textContent !== String(value)) node.textContent = String(value); }
    function attr(node, name, value) { if (node?.getAttribute(name) !== String(value)) node?.setAttribute(name, String(value)); }
    function blocked() { return !active || document.hidden || manualPaused || Boolean(document.querySelector('dialog[open]')); }
    function audioCall(method, ...args) { try { const p = audio?.[method]?.(...args); if (p?.catch) p.catch(() => {}); } catch (_) {} }
    function unlock() { if (active) audioCall('unlock'); }
    function now() { return window.performance?.now?.() || Date.now(); }
    function showNotice(message) { notice = message; noticeUntil = now() + 2700; refresh(); }
    function soundUI() { text('garden-sound', soundEnabled ? '音效开' : '音效关'); attr($('garden-sound'), 'aria-pressed', soundEnabled); }
    function speedUnlocked() { return completed.has('garden-3'); }
    function playbackSpeed() { return speedUnlocked() ? preferredSpeed : 1; }
    function canChangeSpeed() { return active && game && ['intro', 'battle'].includes(phase) && ['ready', 'running', 'paused'].includes(state?.status) && !document.hidden && !document.querySelector('dialog[open]'); }
    function speedUI() {
      const unlocked = speedUnlocked(), rate = playbackSpeed();
      attr($('garden-speed-controls'), 'data-locked', !unlocked);
      text('garden-speed-hint', unlocked ? '战斗速度' : '通关第 3 关解锁快进');
      for (const [id, value] of SPEEDS) {
        const button = $(id); if (!button) continue;
        button.disabled = !canChangeSpeed() || value !== 1 && !unlocked;
        attr(button, 'aria-pressed', value === rate);
        attr(button, 'title', value !== 1 && !unlocked ? '通关花园第 3 关后解锁' : `${value} 倍战斗速度`);
      }
      const duration = `${2.8 / rate}s`;
      if ($('garden-conveyor').style.animationDuration !== duration) $('garden-conveyor').style.animationDuration = duration;
    }
    function chooseSpeed(rate) {
      if (destroyed || !canChangeSpeed() || ![1, 1.5, 2].includes(rate) || rate !== 1 && !speedUnlocked()) return;
      preferredSpeed = rate; write(SPEED_KEY, String(rate)); speedUI();
    }
    function campaignLevels() { return game?.levels || window.GardenGame.LEVELS; }
    function campaignNumber(config = level()) { return config.campaignOrder; }
    function nextCampaignIndex() { const next = state.levelIndex + 1; return next < campaignLevels().length ? next : -1; }
    function isUnlocked(index) { const config = campaignLevels()[index]; return Boolean(config && (completed.has(config.id) || config.campaignOrder <= (progressSnapshot?.unlockedThrough || 1))); }
    function resumeIndex() { const levels = campaignLevels(); const next = levels.findIndex(l => l.campaignOrder >= (progressSnapshot?.unlockedThrough || 1)); return next >= 0 ? next : levels.length - 1; }
    function rewardText(config) {
      const rewards = Array.isArray(config.reward) ? config.reward : config.reward ? [config.reward] : [];
      return rewards.map(id => window.GardenGame.PLANTS.find(p => p.id === id)?.name || ({ shovel: '铲除工具', plantFood: '能量豆' }[id] || id)).join('、');
    }
    function refreshMap() {
      const chapter = CHAPTERS.find(item => item.id === mapChapter) || CHAPTERS[0], levels = campaignLevels();
      attr($('garden-map'), 'data-chapter', chapter.id);
      const finished = levels.filter(item => item.chapter === chapter.id && completed.has(item.id)).length;
      text('garden-chapter-detail', `${chapter.detail} · 已完成 ${finished}/10`);
      text('garden-world-progress', `${levels.filter(item => completed.has(item.id)).length} / 30`);
      text('garden-world-note', chapter.id === 'pool' ? '中间两行是水路。先放莲叶，再种陆生植物；水生伙伴可以直接下水。' : chapter.id === 'western' ? '矿车能带着植物沿轨道换行。先点“调动矿车”，再点矿车与目标轨道格。' : '每过一关，下一道防线就会打开。新植物和工具会随着旅程逐步加入。');
      for (const [id, button] of chapterButtons) { attr(button, 'aria-pressed', id === chapter.id); const first = levels.findIndex(l => l.chapter === id); attr(button, 'data-locked', !isUnlocked(first)); }
      levelButtons.forEach((button, index) => {
        const config = levels[index], unlocked = isUnlocked(index);
        button.hidden = config.chapter !== chapter.id; button.disabled = !unlocked;
        attr(button, 'data-locked', !unlocked); attr(button, 'data-complete', completed.has(config.id));
        const reward = rewardText(config), action = button.children[3];
        if (action) action.textContent = !unlocked ? '完成前一关解锁' : completed.has(config.id) ? '已完成 · 再玩一次 ↗' : reward ? `通关解锁 ${reward}` : config.mode === 'conveyor' ? '传送带挑战 →' : '准备出发 →';
      });
    }
    function clearSunFlights() { for (const item of sunFlights) { item.animation.cancel(); item.node.remove(); } sunFlights.clear(); }
    function flyCollectedSun(event) {
      if (reducedMotion || !active || blocked() || !renderer || !document.body?.appendChild) return;
      const node = document.createElement('span'); if (typeof node.animate !== 'function') return;
      const rect = canvas.getBoundingClientRect(), target = $('garden-sun').getBoundingClientRect(), g = renderer.geometry;
      const x = rect.left + (g.left + event.x * g.cellWidth) / renderer.width * rect.width;
      const y = rect.top + (g.top + event.y * g.cellHeight) / renderer.height * rect.height;
      if (![x,y,target.left,target.top].every(Number.isFinite)) return;
      node.className = 'garden-collected-sun'; node.textContent = '☀'; attr(node, 'aria-hidden', true);
      node.style.left = x + 'px'; node.style.top = y + 'px'; document.body.appendChild(node);
      const dx = target.left + target.width / 2 - x, dy = target.top + target.height / 2 - y;
      const animation = node.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx * .35 + 'px),calc(-50% + ' + (dy * .35 - 30) + 'px)) scale(1.15)', opacity: 1, offset: .38 },
        { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(.35)', opacity: .2 }
      ], { duration: 620, easing: 'cubic-bezier(.25,.7,.35,1)', fill: 'forwards' });
      const item = { node, animation }; sunFlights.add(item);
      animation.onfinish = () => { node.remove(); sunFlights.delete(item); };
    }
    function level() { return state?.level || game?.level || campaignLevels()[0]; }
    function available(type) { const config = level(); return (state?.deck || config.cards).includes(type) && (state?.tutorialReady !== false || type === config.tutorialGate?.type); }
    function portraitFor(plant) {
      const portrait = document.createElement('span'); portrait.className = 'garden-portrait';
      const form = window.GardenForms?.[plant.id] || window.GameLevels?.levels?.[plant.photoIndex];
      if (form?.image) {
        const img = document.createElement('img'); img.src = form.image; img.alt = ''; img.draggable = false;
        const [x, y, w, h] = form.frame || [0, 0, 1, 1], [iw, ih] = form.imageSize || [w, h], side = Math.max(w, h);
        img.style.width = `${iw / side * 100}%`; img.style.height = `${ih / side * 100}%`;
        img.style.left = `${((side - w) / 2 - x) / side * 100}%`; img.style.top = `${((side - h) / 2 - y) / side * 100}%`;
        portrait.appendChild(img);
      } else if (plant.id === 'star') {
        portrait.className += ' garden-star-portrait'; portrait.textContent = '★';
      }
      return portrait;
    }
    function recommendedDeck(config = level()) { return (config.recommendedDeck || config.cards).slice(0, window.GardenGame.MAX_DECK_SIZE || 8); }
    function isConveyor() { return level().mode === 'conveyor'; }
    function toggleDeck(id) {
      if (destroyed || !active || phase !== 'deck' || isConveyor() || !level().cards.includes(id) || blocked()) return;
      unlock();
      if (deckSelection.has(id)) deckSelection.delete(id);
      else if (deckSelection.size < (window.GardenGame.MAX_DECK_SIZE || 8)) deckSelection.add(id);
      else { text('garden-deck-message', '种子栏已满，先点顶部卡片取回一位。'); attr($('garden-deck-message'), 'data-error', true); return; }
      const plant = cards.get(id)?.plant;
      text('garden-card-detail', plant ? `${plant.name} · ${plant.description}　能量豆：${plant.ultimateName}` : '');
      audioCall('play', { type: 'select' }); refreshDeck();
    }
    function refreshTray() {
      const ids = isConveyor() ? [...new Set([...level().conveyorInitial, ...level().conveyorPool])].slice(0, 8) : [...deckSelection];
      const signature = `${state.levelIndex}:${isConveyor()}:${ids.join(',')}`;
      if (signature === traySignature) return; traySignature = signature;
      traySlots.forEach((slot, index) => {
        const id = ids[index], plant = cards.get(id)?.plant;
        slot.button.disabled = !plant || isConveyor(); attr(slot.button, 'data-filled', Boolean(plant));
        attr(slot.button, 'aria-label', plant ? `${plant.name}，${isConveyor() ? '传送带供应植物' : '点击从种子栏移出'}` : `空种子槽 ${index + 1}`);
        slot.button.replaceChildren();
        if (plant) { const name = document.createElement('strong'); name.textContent = plant.name; const cost = document.createElement('small'); cost.textContent = isConveyor() ? '免费供应' : `☀ ${plant.cost}`; slot.button.append(portraitFor(plant), name, cost); }
        else { const number = document.createElement('span'); number.textContent = index + 1; slot.button.append(number); }
      });
    }
    function deckError() {
      const config = level();
      if (isConveyor()) return '';
      if (deckSelection.size > (window.GardenGame.MAX_DECK_SIZE || 8)) return '最多携带 8 位植物。';
      if (!deckSelection.size) return '种子盒还是空的，先选几位伙伴。';
      if (config.cards.includes('sun') && !deckSelection.has('sun')) return '记得带上日光伙伴，保持阳光供给。';
      if (![...deckSelection].some(id => ['shooter', 'ice', 'burst', 'star', 'corn', 'cannon', 'lightning', 'tide', 'cactus'].includes(id))) return '至少带上一位能持续射击的伙伴。';
      if (config.waterRows?.length && !deckSelection.has('lily')) return '泳池需要莲叶，让陆生植物也能守住水路。';
      if (config.tutorialGate && !deckSelection.has(config.tutorialGate.type)) return '带上本关教学需要的伙伴。';
      return '';
    }
    function refreshDeck() {
      const config = level(), belt = isConveyor(), error = deckError();
      attr($('garden-deck'), 'data-conveyor', belt);
      text('garden-deck-level', config.title); text('garden-deck-title', belt ? '传送带，准备开动' : '挑选你的植物');
      text('garden-feature-intro', config.featureIntro || ''); $('garden-feature-intro').hidden = !config.featureIntro;
      text('garden-deck-goal', `${config.waterRows?.length ? '六行战场 · 两行水路' : config.tracks?.length ? '西部矿车战场' : config.activeRows.length + ' 行草坪'} · ${config.ruleSummary || (config.featureIntro ? '先观察来客，再选择阵容' : config.subtitle)}`);
      text('garden-deck-count', belt ? '供应植物' : `${deckSelection.size} / 8`);
      text('garden-deck-message', error || (belt ? '种子自动送来，每张免费种植一次。' : (config.plantFoodEnabled === false ? '阵容已就绪 · 能量豆将在花园旅程中解锁。' : '阵容已就绪 · 每局还有一颗能量豆。')));
      attr($('garden-deck-message'), 'data-error', Boolean(error)); $('garden-deck-start').disabled = Boolean(error);
      text('garden-deck-start', belt ? '开启传送带 →' : '开始种植 →');
      $('garden-deck-recommended').hidden = belt; $('garden-deck-cards').hidden = belt;
      $('garden-conveyor-brief').hidden = !belt; $('garden-card-detail').hidden = belt;
      text('garden-belt-supply', belt ? '本关供应：' + [...new Set([...config.conveyorInitial, ...config.conveyorPool])].map(id => cards.get(id)?.plant.name).join('、') : '');
      text('garden-catalog-title', belt ? '玩法说明' : '植物图鉴');
      text('garden-catalog-hint', belt ? '卡片只能使用一次' : '点卡片装入 · 点顶栏取回');
      for (const [id, item] of deckCards) {
        const allowed = config.cards.includes(id), chosen = allowed && deckSelection.has(id);
        item.button.hidden = !allowed; item.button.disabled = !allowed; attr(item.button, 'aria-pressed', chosen);
        item.label.textContent = chosen ? '已装入' : '选入';
      }
      const types = [...new Set(config.waves.flatMap(w => [...w.pool, ...(w.flag ? ['flag'] : [])]))];
      text('garden-deck-enemies', types.map(type => window.GardenGame.ENEMIES[type].name).join(' · '));
      attr($('garden-prep-canvas'), 'aria-label', '本关僵尸：' + types.map(type => window.GardenGame.ENEMIES[type].name).join('、'));
      refreshTray();
    }
    function showPhase(next, focus = false) {
      phase = next; pointer = null; hover = null; selectedCart = null; cartMode = false; plantFoodSelected = false; clearSunFlights(); if (next === 'map') refreshMap();
      $('garden-map').hidden = next !== 'map'; $('garden-deck').hidden = next !== 'deck';
      $('garden-play').hidden = !['intro', 'battle'].includes(next); $('garden-map-button').hidden = next === 'map';
      stopFrame(); attr($('garden-layout'), 'data-phase', next); attr($('garden-layout'), 'data-chapter', level().chapter || 'garden'); refresh(); resize();
      if (next !== 'battle') window.scrollTo?.({ top: 0, behavior: 'instant' });
      schedule();
      if (focus) (next === 'deck' ? $('garden-deck-title') : next === 'map' ? levelButtons[state.levelIndex] : canvas)?.focus({ preventScroll: true });
    }
    function onEvent(event) {
      if (active && !blocked()) audioCall('play', event.type === 'conveyor' ? { ...event, type: 'packet' } : event);
      if (event.type === 'collect') flyCollectedSun(event);
      if (event.type === 'win') {
        const index = game?.levelIndex ?? state?.levelIndex ?? 0;
        const config = campaignLevels()[index];
        progress.saveCompleted(config.id, config.campaignOrder); syncProgress();
      }
      if (event.type === 'win' || event.type === 'lose') endingElapsed = 0;
      if (event.type === 'wave' && game) showNotice('新一波入侵者来了，检查每条小路的防线。');
    }
    function makeDeck() {
      for (const [i, plant] of window.GardenGame.PLANTS.entries()) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'garden-seed';
        attr(button, 'aria-pressed', false); attr(button, 'title', `${plant.name} · ${plant.cost}阳光 · ${plant.description}`);
        attr(button, 'aria-label', `${plant.name}，${plant.cost}阳光，${plant.description}`);
        const key = document.createElement('span'); key.className = 'garden-seed-key'; key.textContent = '';
        const portrait = portraitFor(plant);
        const name = document.createElement('strong'); name.textContent = plant.name;
        const footer = document.createElement('small'), cost = document.createElement('span'), status = document.createElement('span');
        cost.textContent = `☀ ${plant.cost}`; status.className = 'garden-seed-status'; footer.append(cost, status);
        button.append(key, portrait, name, footer); $('garden-seeds').appendChild(button);
        cards.set(plant.id, { button, status, plant, key }); listen(button, 'click', () => choose(plant.id));
        const choice = document.createElement('button'); choice.type = 'button'; choice.className = 'garden-deck-card';
        attr(choice, 'aria-label', `${plant.name}，${plant.cost}阳光，${plant.description}。大招：${plant.ultimateName}，${plant.ultimateDescription}`); attr(choice, 'aria-pressed', false);
        choice.style.setProperty('--plant-color', plant.color);
        const choiceName = document.createElement('strong'); choiceName.textContent = plant.name;
        const price = document.createElement('span'); price.className = 'garden-deck-price'; price.textContent = `☀ ${plant.cost}`;
        const detail = document.createElement('p'); detail.textContent = plant.description;
        const check = document.createElement('small'); check.className = 'garden-deck-check';
        const ultimate = document.createElement('p'); ultimate.className = 'garden-deck-power'; ultimate.textContent = `能量豆 · ${plant.ultimateName}：${plant.ultimateDescription}`;
        choice.append(price, portraitFor(plant), choiceName, detail, check, ultimate); $('garden-deck-cards').appendChild(choice);
        deckCards.set(plant.id, { button: choice, label: check });
        listen(choice, 'click', () => toggleDeck(plant.id));
        listen(choice, 'focus', () => { text('garden-card-detail', `${plant.name} · ${plant.description}　能量豆：${plant.ultimateName}`); });
        if (['sun', 'shooter', 'wall'].includes(plant.id)) $('garden-welcome-friends').appendChild(portraitFor(plant));
      }
      for (let index = 0; index < 8; index++) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'garden-tray-slot';
        $('garden-selected-seeds').appendChild(button); traySlots.push({ button });
        listen(button, 'click', () => toggleDeck([...deckSelection][index]));
        const packet = document.createElement('button'); packet.type = 'button'; packet.className = 'garden-seed garden-packet'; packet.hidden = true;
        $('garden-conveyor').appendChild(packet); packetSlots.push({ button: packet, id: null });
        listen(packet, 'click', () => choosePacket(state?.conveyor?.[index]?.id));
      }
      for (const chapter of CHAPTERS) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'garden-world-tab'; attr(button, 'data-world', chapter.id); const icon = document.createElement('span'); icon.textContent = chapter.symbol; attr(icon, 'aria-hidden', true); const label = document.createElement('b'); label.textContent = chapter.name; const count = document.createElement('small'); count.textContent = '10 道防线'; button.append(icon, label, count);
        attr(button, 'aria-pressed', chapter.id === mapChapter); chapterButtons.set(chapter.id, button);
        $('garden-chapters').appendChild(button);
        listen(button, 'click', () => { if (active && phase === 'map') { mapChapter = chapter.id; refreshMap(); } });
      }
      for (const [index, config] of campaignLevels().entries()) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'garden-level-stop';
        const number = document.createElement('span'); number.className = 'garden-level-number'; number.textContent = String(config.worldStage).padStart(2, '0');
        button.style.order = config.practice ? 99 : campaignNumber(config);
        const title = document.createElement('b'); title.textContent = config.title.replace(/^[\d-]+\s*·\s*/, '');
        const info = document.createElement('small'); info.textContent = config.practice ? '5 行草地 · 自选阵容' : `${config.modeLabel || '冒险关卡'} · ${config.waterRows?.length ? '水陆协作' : config.tracks?.length ? '矿车布防' : config.activeRows.length + ' 行草坪'}`;
        const arrow = document.createElement('em'); arrow.textContent = config.mode === 'conveyor' ? '传送带 →' : '选植物 →';
        button.append(number, title, info, arrow); attr(button, 'aria-label', config.practice ? config.title : `第${campaignNumber(config)}关 ${config.title.replace(/^[\d-]+\s*·\s*/, '')}`);
        $('garden-levels').appendChild(button); levelButtons.push(button); listen(button, 'click', () => requestReset(index));
      }
    }
    function ensure() {
      if (game) return true;
      if (!progress || !window.GardenGame || !window.GardenRenderer) { text('garden-status', '花园加载失败，请刷新页面重试。'); return false; }
      game = new window.GardenGame({ onEvent, campaignSeed }); state = game.getState();
      renderer = new window.GardenRenderer(canvas, { levels: window.GameLevels?.levels || [], forms: window.GardenForms, reducedMotion, onReady: () => { if (active) draw(); } });
      prepRenderer = new window.GardenRenderer($('garden-prep-canvas'), { levels: window.GameLevels?.levels || [], forms: window.GardenForms, reducedMotion, onReady: () => { if (active && phase === 'deck') draw(); } });
      try { if (window.GardenAudio) audio = new window.GardenAudio({ enabled: soundEnabled }); } catch (_) {}
      game.reset(resumeIndex()); state = game.getState(); mapChapter = game.level.chapter;
      makeDeck(); deckSelection = new Set(recommendedDeck(game.level)); showPhase('map'); return true;
    }
    function draw() {
      if (!active || !state || !renderer) return;
      if (phase === 'deck') { prepRenderer?.render(state, { preparation: true, time: previewElapsed }); return; }
      const visual = endingElapsed >= 0 ? { ...state, elapsed: state.elapsed + endingElapsed, effects: state.effects.map(effect => ({ ...effect, life: effect.life - endingElapsed })).filter(effect => effect.life > 0) } : state;
      renderer.render(visual, { selected: phase === 'battle' && !plantFoodSelected ? selected : null, shovel, plantFoodSelected, selectedCart, cartMode, placementValid: hover && selected && !shovel && !plantFoodSelected && !cartMode ? game.canPlant(selected, hover.row, hover.col) : null, hover, time: visual.elapsed, ...(phase === 'intro' ? { introProgress: introElapsed / INTRO_MS, introTime: introElapsed } : {}) });
    }
    function resize() {
      if (!active || !renderer) return;
      pointer = null; hover = null;
      const target = phase === 'deck' ? $('garden-prep-canvas') : canvas, painter = phase === 'deck' ? prepRenderer : renderer;
      const rect = target.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) painter?.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
      draw();
    }
    function refresh() {
      if (!game) return;
      state = game.getState(); renderer?.setRows?.(state.rows || 5); prepRenderer?.setRows?.(state.rows || 5); const config = level(), running = state.status === 'running';
      if (phase === 'deck') refreshDeck();
      const belt = config.mode === 'conveyor';
      attr($('garden-workbench'), 'data-conveyor', belt);
      $('garden-seeds').hidden = belt; $('garden-sun-counter').hidden = belt;
      $('garden-conveyor').hidden = !belt; $('garden-belt-label').hidden = !belt;
      if (belt) refreshConveyor();
      $('garden-intro').hidden = phase !== 'intro';
      $('garden-intro-resume').hidden = phase !== 'intro' || !manualPaused;
      $('garden-intro-skip').disabled = manualPaused;
      const introBeat = introElapsed < 900 ? 0 : introElapsed < 1600 ? 1 : 2;
      attr($('garden-intro'), 'data-beat', introBeat);
      text('garden-intro-kicker', manualPaused ? '开场已暂停' : introBeat === 0 ? '门外的来客，已经到了' : config.title);
      text('garden-intro-title', manualPaused ? '准备好再出发' : ['看看门外！', '准备好了？', '开始种植！'][introBeat]);
      text('garden-sun', state.sun); text('garden-level-name', config.title);
      text('garden-level-goal', config.subtitle || '守住五条小路');
      text('garden-wave', state.status === 'ready' ? '准备种植' : state.tutorialReady === false ? '教学布阵' : !state.wave ? `布阵时间 · ${Math.max(0, Math.ceil((state.nextWaveIn ?? ((config.waves?.[0]?.at || 20000) - state.elapsed)) / 1000))}s` : `第 ${state.wave}/${state.totalWaves || 3} 波 · 击退 ${state.kills}`);
      for (const [id, { button, status, plant, key }] of cards) {
        const cd = state.cooldowns?.[id] || 0, allowed = available(id);
        button.hidden = belt || !(state.deck || config.cards).includes(id);
        const slot = (state.deck || config.cards).indexOf(id); button.style.order = slot; key.textContent = slot >= 0 && slot < 8 ? String(slot + 1) : '';
        button.disabled = !allowed; attr(button, 'aria-pressed', selected === id && !shovel && !plantFoodSelected);
        attr(button, 'data-unaffordable', state.sun < plant.cost);
        button.style.setProperty('--cooldown', `${Math.min(100, cd / plant.cooldown * 100)}%`);
        const label = !allowed ? config.cards.includes(id) ? '先完成教学' : '后续关卡' : cd > 0 ? `${Math.ceil(cd / 1000)}s` : state.sun < plant.cost ? '缺阳光' : '就绪';
        if (status.textContent !== label) status.textContent = label;
      }
      levelButtons.forEach((button, i) => { attr(button, 'aria-current', state.levelIndex === i); attr(button, 'data-complete', completed.has(campaignLevels()[i].id)); });
      $('garden-pause').disabled = phase !== 'battle' || !['running', 'paused'].includes(state.status);
      $('garden-shovel').disabled = phase !== 'battle' || config.shovel === false;
      attr($('garden-shovel'), 'title', config.shovel === false ? '通过花园教学后解锁铲除工具' : '移除一位同伴，不返还阳光');
      text('garden-pause', state.status === 'paused' ? '继续' : '暂停'); attr($('garden-pause'), 'aria-pressed', state.status === 'paused');
      attr($('garden-shovel'), 'aria-pressed', shovel);
      $('garden-power').hidden = config.plantFoodEnabled === false; $('garden-food').hidden = config.plantFoodEnabled === false; $('garden-food-note').hidden = config.plantFoodEnabled === false;
      $('garden-cart').hidden = !config.tracks?.length; attr($('garden-cart'), 'aria-pressed', cartMode);
      attr(canvas, 'aria-label', `${state.rows || 5}行九列战场。选择卡片后点击格子种植。${config.waterRows?.length ? '中间两行水路需先种莲叶。' : ''}${config.tracks?.length ? '点击调动矿车，再点矿车和目标轨道格移动。' : ''}方向键选格，回车行动，1到8选卡，C收阳光，F能量豆，P暂停。`);
      $('garden-food').disabled = phase !== 'battle' || !running || state.plantFood < 1;
      text('garden-food-count', state.plantFood); attr($('garden-food'), 'aria-pressed', plantFoodSelected);
      attr($('garden-food'), 'aria-label', state.plantFood ? '能量豆，剩余1颗。点击后再点植物释放大招' : '能量豆，本局已用完');
      text('garden-food-hint', state.plantFood ? plantFoodSelected ? '再点植物 · 点此取消' : '每局 1 颗 · 点此使用' : '本局已用完');
      const plant = cards.get(selected)?.plant;
      text('garden-selected-name', cartMode ? '调动矿车 · ' + (selectedCart ? '选择目标轨道格' : '选择一辆矿车') : plantFoodSelected ? '能量豆 · 选择一位植物' : shovel ? '铲除工具' : plant ? `${plant.name} · ${belt ? '免费种植' : plant.cost + ' 阳光'}` : belt ? '传送带 · 等待或选择种子' : '选择一位同伴');
      text('garden-status', cartMode ? (noticeUntil > now() ? notice : '点一辆矿车，再点同一轨道的目标格；车上的植物会一起移动。') : plantFoodSelected ? '点击场上的植物释放专属大招；空地不会消耗。按 F 或再次点豆子取消。' : noticeUntil > now() ? notice : state.tutorialReady === false && state.status === 'running' ? state.tutorialHint : shovel ? '点击已种植的角色铲除。铲除不返还阳光。' : plant?.description || (belt ? '点传送带卡片，再点空格。一张种一次；满带后暂缓送卡。' : '选择角色，再点击空格种植。'));
      $('garden-overlay').hidden = phase !== 'battle' || running || endingElapsed >= 0 && endingElapsed < 650;
      const secondary = $('garden-overlay-secondary'); secondary.hidden = !['won', 'lost'].includes(state.status);
      text('garden-overlay-secondary', state.status === 'lost' ? '重新布阵' : '再玩本关');
      if (state.status === 'ready') {
        text('garden-overlay-kicker', config.practice ? `自由演练 / ${config.cards.length} 位同伴全部开放` : `第 ${campaignNumber()} 关 / ${config.title.replace(/^[\d-]+\s*·\s*/, '')}`);
        text('garden-overlay-title', '今天，守住花园。');
        text('garden-overlay-copy', config.subtitle || '先种采光员收集阳光，再在每条小路安排射手。'); text('garden-start', '开始种植 ↗');
      } else if (state.status === 'paused') {
        text('garden-overlay-kicker', '花园已暂停'); text('garden-overlay-title', '歇一会，阳光还在。');
        text('garden-overlay-copy', '同伴和入侵者都会等你回来。'); text('garden-start', '继续守护 ↗');
      } else if (state.status === 'won') {
        text('garden-overlay-kicker', `${config.practice ? '自由演练' : '第 ' + campaignNumber() + ' 关'}完成 · 击退 ${state.kills}`); text('garden-overlay-title', '这一片晴天，守住了。');
        const next = campaignLevels()[nextCampaignIndex()], reward = rewardText(config);
        const speedReward = config.id === 'garden-3' ? '快进已解锁：战场上方可选择 1.5× 或 2×。' : '';
        text('garden-overlay-copy', `${reward ? '新伙伴 / 功能已解锁：' + reward + '。' : ''}${speedReward}${next ? '下一关：' + next.title + '。' + next.subtitle : '花园、泳池、沙漠西部，30关旅程全部完成！回到世界地图，可以重玩喜欢的关卡。'}`);
        text('garden-start', next ? '进入下一关 ↗' : '返回世界地图 ↗');
      } else if (state.status === 'lost') {
        text('garden-overlay-kicker', `击退 ${state.kills} 位入侵者`); text('garden-overlay-title', '花园需要你再试一次。');
        text('garden-overlay-copy', '先建立阳光供给，给每条小路配上射手，盾卫放在前面。'); text('garden-start', '再试一次 ↗');
      }
      speedUI(); soundUI();
    }
    function stopFrame() { if (frame !== null) window.cancelAnimationFrame?.(frame); frame = null; lastFrame = null; }
    function schedule() { if (frame === null && active && !blocked() && (phase === 'deck' && !reducedMotion || phase === 'intro' || phase === 'battle' && (state?.status === 'running' || endingElapsed >= 0 && endingElapsed < 900)) && !destroyed) frame = window.requestAnimationFrame(tick); }
    function tick(timestamp) {
      frame = null;
      if (destroyed || blocked()) {
        if (phase === 'intro' && document.querySelector('dialog[open]')) manualPaused = true;
        syncPause(); return;
      }
      const dt = lastFrame === null ? 0 : Math.max(0, Math.min(100, timestamp - lastFrame)); lastFrame = timestamp;
      if (phase === 'deck') { previewElapsed += dt; draw(); schedule(); return; }
      else if (phase === 'intro') {
        introElapsed = Math.min(INTRO_MS, introElapsed + dt);
        if (introElapsed >= INTRO_MS) { completeIntro(); return; }
      } else if (endingElapsed >= 0) endingElapsed = Math.min(900, endingElapsed + dt);
      else game.step(dt * playbackSpeed());
      refresh(); draw(); schedule();
    }
    function syncPause() {
      stopFrame(); if (blocked()) { clearSunFlights(); plantFoodSelected = false; selectedCart = null; cartMode = false; } if (!game) return;
      game.pause(blocked()); if (blocked()) audioCall('pause');
      refresh(); draw(); schedule();
    }
    function choose(id) {
      if (isConveyor() || !active || phase !== 'battle' || !game || !available(id) || document.querySelector('dialog[open]')) return;
      unlock(); audioCall('play', { type: 'select' }); selectedCart = null; cartMode = false; selectedPacket = null; selected = selected === id && !shovel && !plantFoodSelected ? null : id; shovel = false; plantFoodSelected = false; refresh(); draw();
    }
    function refreshConveyor() {
      const packets = state.conveyor || [];
      attr($('garden-conveyor'), 'data-moving', state.status === 'running' && packets.length < 8);
      if (!packets.some(packet => packet.id === selectedPacket)) { selectedPacket = null; if (!shovel && !plantFoodSelected) selected = null; }
      text('garden-belt-status', packets.length >= 8 ? '已满 · 种下后继续' : `下一张 ${Math.ceil((state.conveyorNextIn || 0) / 1000)}s`);
      packetSlots.forEach((slot, index) => {
        const packet = packets[index], plant = packet && cards.get(packet.type)?.plant;
        slot.button.hidden = !packet; slot.button.disabled = state.status !== 'running';
        attr(slot.button, 'aria-pressed', Boolean(packet && selectedPacket === packet.id && !shovel && !plantFoodSelected));
        if (!packet || slot.id === packet.id && slot.type === packet.type) return;
        slot.id = packet.id; slot.type = packet.type; slot.button.replaceChildren();
        const name = document.createElement('strong'); name.textContent = plant.name;
        const label = document.createElement('small'); label.textContent = '免费 · 一次';
        slot.button.append(portraitFor(plant), name, label);
        attr(slot.button, 'aria-label', `${plant.name}，免费种植一次，快捷键 ${index + 1}`);
        if (!reducedMotion) slot.button.animate?.([{ transform: 'translateX(38px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,.7,.3,1)' });
      });
    }
    function choosePacket(id) {
      if (destroyed || !active || phase !== 'battle' || !isConveyor() || blocked() || state.status !== 'running') return;
      const packet = state.conveyor.find(item => item.id === id); if (!packet) return;
      unlock(); audioCall('play', { type: 'select' });
      selectedPacket = selectedPacket === id && !shovel && !plantFoodSelected ? null : id;
      selectedCart = null; cartMode = false; selected = selectedPacket ? packet.type : null; shovel = false; plantFoodSelected = false; refresh(); draw();
    }
    function reset(index) {
      stopFrame(); audioCall('pause'); manualPaused = false; pointer = null; hover = null; shovel = false; notice = ''; noticeUntil = 0;
      introElapsed = 0; previewElapsed = 0; endingElapsed = -1; selectedPacket = null; traySignature = ''; selectedCart = null; cartMode = false; plantFoodSelected = false; clearSunFlights();
      game.reset(index); state = game.getState(); mapChapter = game.level.practice ? 'practice' : game.level.chapter || 'garden'; deckSelection = new Set(recommendedDeck(game.level)); selected = game.level.cards.includes('sun') ? 'sun' : 'shooter'; showPhase('deck', true);
    }
    function requestReset(index, destination = 'deck') {
      if (!active || !game || document.querySelector('dialog[open]') || !isUnlocked(index)) return;
      if (['running', 'paused'].includes(state.status)) {
        pendingLevel = index; pendingDestination = destination;
        text('garden-confirm-title', destination === 'map' ? '返回庭院地图？' : '重新布置花园？');
        text('garden-confirm-ok', destination === 'map' ? '返回地图' : '重新布阵');
        $('garden-confirm').showModal(); syncPause();
      } else { reset(index); if (destination === 'map') showPhase('map', true); }
    }
    function beginIntro() {
      if (!active || phase !== 'deck' || blocked() || deckError() || !game.setDeck([...deckSelection])) return;
      unlock(); stopFrame(); introElapsed = 0; endingElapsed = -1; manualPaused = false;
      selected = isConveyor() ? null : deckSelection.has('sun') ? 'sun' : [...deckSelection][0]; selectedPacket = null;
      showPhase('intro'); audioCall('play', { type: 'select' });
      if (reducedMotion) completeIntro(); else schedule();
    }
    function completeIntro() {
      if (!active || destroyed || phase !== 'intro' || blocked()) return;
      stopFrame(); introElapsed = INTRO_MS; showPhase('battle'); game.start();
      syncPause(); canvas.focus({ preventScroll: true });
    }
    function start() {
      if (!active || !ensure() || document.querySelector('dialog[open]')) return;
      unlock();
      if (state.status === 'won') { const next = nextCampaignIndex(); if (next >= 0) reset(next); else showPhase('map', true); return; }
      if (state.status === 'lost') { reset(state.levelIndex); return; }
      if (state.status === 'ready') { showPhase('deck', true); return; }
      manualPaused = false;
      syncPause(); canvas.focus({ preventScroll: true });
    }
    function togglePause() {
      if (!active || !game || !['running', 'paused'].includes(state.status) || document.querySelector('dialog[open]')) return;
      manualPaused = !manualPaused; if (!manualPaused) unlock(); syncPause();
    }
    function togglePlantFood() {
      if (!active || phase !== 'battle' || blocked() || state?.status !== 'running' || state.plantFood < 1) return;
      unlock(); cartMode = false; selectedCart = null; plantFoodSelected = !plantFoodSelected; shovel = false; refresh(); draw();
    }
    function act(cell) {
      if (!cell || blocked() || state?.status !== 'running') return;
      if (level().activeRows && !level().activeRows.includes(cell.row)) { showNotice('这条草地尚未开放，请种在亮色草坪上。'); return; }
      if (cartMode) {
        const cart = state.carts?.find(c => c.row === cell.row && c.col === cell.col);
        if (selectedCart && state.carts.find(c => c.id === selectedCart)?.col === cell.col && game.moveCart(selectedCart, cell.row)) { selectedCart = null; showNotice('矿车和植物已换行，火力继续。'); }
        else if (cart) { selectedCart = cart.id; showNotice('已选中矿车，再点同一铁轨的目标格。'); }
        else showNotice('先选矿车，再点同一条铁轨上的空格。');
      } else if (plantFoodSelected) {
        const target = state.plants.filter(plant => plant.row === cell.row && plant.col === cell.col && plant.hp > 0).sort((a,b) => (a.type === 'lily') - (b.type === 'lily'))[0];
        if (game.usePlantFood(cell.row, cell.col)) {
          plantFoodSelected = false;
          showNotice(cards.get(target?.type)?.plant.ultimateName + '！本局能量豆已使用。');
        } else showNotice('请点一位已经种下的植物；能量豆尚未消耗。');
      } else if (shovel) {
        if (game.remove(cell.row, cell.col)) showNotice('已腾出位置，可以重新种植。');
        else showNotice('这个位置没有角色。');
      } else if (isConveyor()) {
        if (!selectedPacket) showNotice('先点一张传送带卡片，再点空草地。');
        else if (game.plantFromConveyor(selectedPacket, cell.row, cell.col)) { selected = null; selectedPacket = null; showNotice('种子已种下，新卡继续送来。'); }
        else showNotice('这个位置无法种植，卡片仍保留在传送带上。');
      } else if (selected) {
        const plant = cards.get(selected).plant;
        if (state.cooldowns[selected] > 0) showNotice(`${plant.name}还需冷却 ${Math.ceil(state.cooldowns[selected] / 1000)} 秒。`);
        else if (state.sun < plant.cost) showNotice(`还差 ${plant.cost - state.sun} 阳光，先收集金色太阳。`);
        else if (game.plant(selected, cell.row, cell.col)) { selected = null; showNotice('种植成功。继续收集阳光，照顾其他小路。'); }
        else showNotice(level().plantLimit && state.plants.filter(p => p.hp > 0 && p.type !== 'lily').length >= level().plantLimit ? `本关最多 ${level().plantLimit} 位植物，先铲除一位再种植。` : placementHint(cell));
      } else showNotice('先点击上方的角色卡，再选择草地。');
      refresh(); draw();
    }
    function placementHint(cell) {
      if (level().waterRows?.includes(cell.row)) return '水路先放莲叶，再种陆生植物；水生伙伴直接下水。一格只能有一位伙伴和一片莲叶。';
      if (level().tracks?.some(track => track.col === cell.col)) return '铁轨上只有矿车所在的格子可以种植。用“调动矿车”换行。';
      if (['lily','kelp','tide'].includes(selected)) return '这位伙伴只能种在水路。';
      return '这个位置已经有同伴了，换个空格试试。';
    }
    listen(canvas, 'pointerdown', event => {
      if (pointer || event.isPrimary === false || event.button != null && event.button !== 0 || !active || blocked() || state?.status !== 'running') return;
      unlock(); pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    listen(canvas, 'pointerup', event => {
      if (!pointer || pointer.id !== event.pointerId || event.isPrimary === false) return;
      const previous = pointer; pointer = null;
      if ( Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 15 || blocked()) return;
      const id = renderer.sunAt(event.clientX, event.clientY, state);
      if (id != null && game.collectSun(id)) { refresh(); draw(); return; }
      hover = renderer.cellAt(event.clientX, event.clientY); act(hover);
    });
    listen(canvas, 'pointermove', event => { if (!active || !renderer) return; hover = renderer.cellAt(event.clientX, event.clientY); if (state?.status !== 'running') draw(); });
    listen(canvas, 'pointerleave', () => { pointer = null; hover = null; draw(); });
    listen(canvas, 'pointercancel', () => { pointer = null; hover = null; draw(); });
    listen($('garden-start'), 'click', start);
    listen($('garden-deck-start'), 'click', beginIntro);
    listen($('garden-deck-back'), 'click', () => { if (active && phase === 'deck') showPhase('map', true); });
    listen($('garden-map-button'), 'click', () => requestReset(state.levelIndex, 'map'));
    listen($('garden-deck-recommended'), 'click', () => { if (active && phase === 'deck') { deckSelection = new Set(recommendedDeck()); refreshDeck(); } });
    listen($('garden-intro-skip'), 'click', completeIntro);
    listen($('garden-intro-resume'), 'click', () => { if (active && phase === 'intro') { manualPaused = false; unlock(); syncPause(); } });
    listen($('garden-overlay-secondary'), 'click', () => { if (active) reset(state.levelIndex); });
    listen($('garden-pause'), 'click', togglePause);
    for (const [id, rate] of SPEEDS) listen($(id), 'click', () => chooseSpeed(rate));
    listen($('garden-food'), 'click', togglePlantFood);
    listen($('garden-restart'), 'click', () => requestReset(state.levelIndex));
    listen($('garden-cart'), 'click', () => { if (!active || phase !== 'battle' || blocked() || state?.status !== 'running' || !level().tracks?.length) return; cartMode = !cartMode; selectedCart = null; selected = null; selectedPacket = null; shovel = false; plantFoodSelected = false; noticeUntil = 0; refresh(); draw(); });
    listen($('garden-shovel'), 'click', () => { if (!active || phase !== 'battle' || level().shovel === false || document.querySelector('dialog[open]')) return; cartMode = false; selectedCart = null; shovel = !shovel; selected = null; plantFoodSelected = false; refresh(); draw(); });
    listen($('garden-confirm-cancel'), 'click', () => { pendingLevel = null; $('garden-confirm').close(); });
    listen($('garden-confirm-ok'), 'click', () => { const index = pendingLevel, destination = pendingDestination; pendingLevel = null; $('garden-confirm').close(); if (index != null) { reset(index); if (destination === 'map') showPhase('map', true); } });
    listen($('garden-confirm'), 'close', () => { pendingLevel = null; syncPause(); });
    listen($('garden-sound'), 'click', () => { unlock(); soundEnabled = !soundEnabled; window.GameSoundEnabled = soundEnabled; write('photo-merge-sound', soundEnabled ? 'on' : 'off'); audioCall('setEnabled', soundEnabled); if (soundEnabled) unlock(); soundUI(); window.dispatchEvent(new window.Event('feitian-soundchange')); });
    listen(window, 'feitian-soundchange', () => { soundEnabled = window.GameSoundEnabled !== false; audioCall('setEnabled', soundEnabled); soundUI(); });
    listen(document, 'keydown', event => {
      if (!active || !game || event.metaKey || event.ctrlKey || event.altKey || event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(event.target?.tagName || '') || document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      if (key === 'p' || key === 'escape') { event.preventDefault(); if (!event.repeat) togglePause(); return; }
      if (key === 'r') { event.preventDefault(); if (!event.repeat) requestReset(state.levelIndex); return; }
      if (blocked() || state.status !== 'running') return;
      unlock();
      if (SHORTCUTS.includes(key)) { event.preventDefault(); if (!event.repeat) { const index = SHORTCUTS.indexOf(key); if (isConveyor()) choosePacket(state.conveyor[index]?.id); else choose(state.deck[index]); } }
      else if (key === 'f') { event.preventDefault(); if (!event.repeat) togglePlantFood(); }
      else if (key === 'c') { event.preventDefault(); for (const sun of [...state.suns]) game.collectSun(sun.id); refresh(); draw(); }
      else if (key.startsWith('arrow')) { event.preventDefault(); const cell = hover || { row: 2, col: 0 }; hover = { row: Math.max(0, Math.min((state.rows || 5) - 1, cell.row + (key === 'arrowdown' ? 1 : key === 'arrowup' ? -1 : 0))), col: Math.max(0, Math.min(8, cell.col + (key === 'arrowright' ? 1 : key === 'arrowleft' ? -1 : 0))) }; draw(); }
      else if (key === 'enter' || key === ' ') { event.preventDefault(); if (!event.repeat) act(hover || { row: 2, col: 0 }); }
    });
    listen(window, 'feitian-modechange', event => {
      const wasActive = active; active = event.detail?.mode === 'garden'; pointer = null; hover = null; plantFoodSelected = false;
      if (wasActive && !active && (state?.status === 'running' || phase === 'intro')) manualPaused = true;
      if (!active && $('garden-confirm').open) $('garden-confirm').close();
      if (active) syncProgress();
      if (active && ensure()) resize(); syncPause();
    });
    const loseFocus = () => { pointer = null; if (active && (state?.status === 'running' || phase === 'intro')) manualPaused = true; syncPause(); };
    listen(window, 'blur', loseFocus); listen(document, 'visibilitychange', () => { if (document.hidden) loseFocus(); else { syncProgress(); syncPause(); } });
    listen(window, 'storage', event => { if (event.key === null || event.key?.startsWith('feitian-garden-')) syncProgress(event); });
    listen(window, 'pageshow', () => syncProgress());
    listen(window, 'focus', () => syncProgress());
    listen($('garden-export'), 'click', exportProgress);
    listen($('garden-import'), 'click', () => { if (phase === 'map' && progress) $('garden-import-file').click(); });
    listen($('garden-import-file'), 'change', importProgress);
    listen($('garden-save-retry'), 'click', () => { syncProgress(); text('garden-backup-message', progress?.getStatus().saved ? '保存成功，已接续全部通关记录。' : '浏览器仍无法保存，请先导出存档。'); });
    listen(window, 'resize', resize); listen(window, 'orientationchange', resize); listen(window.visualViewport, 'resize', resize);
    saveStatus(); soundUI();
    return { get game() { return game; }, destroy() { destroyed = true; active = false; clearSunFlights(); stopFrame(); audioCall('destroy'); game?.pause(true); for (const [target, type, fn, opts] of listeners) target?.removeEventListener?.(type, fn, opts); } };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = initGarden;
  else initGarden(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis);
