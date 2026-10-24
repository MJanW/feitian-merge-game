(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = '#304723';
  const FONT = '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif';
  const LOOKS = {
    sun: { photo: 1, color: '#ffcf56', dark: '#aa712f', symbol: '☀' },
    shooter: { photo: 3, color: '#9fd560', dark: '#46732c', symbol: '•' },
    wall: { photo: 5, color: '#d7a87b', dark: '#825942', symbol: '盾' },
    mine: { photo: null, color: '#c49a63', dark: '#735033', symbol: '雷' },
    ice: { photo: 7, color: '#9ce3f2', dark: '#3d8ca1', symbol: '❄' },
    burst: { photo: 9, color: '#b8adf0', dark: '#6b629c', symbol: '••' },
    bomb: { photo: 11, color: '#fa9674', dark: '#b84b36', symbol: '✦' },
    star: { photo: null, color: '#ffe783', dark: '#b98534', symbol: '★' },
    corn: { photo: null, color: '#f7db76', dark: '#a78238', symbol: '玉' },
    tallwall: { photo: null, color: '#bd9b76', dark: '#71573f', symbol: '垒' },
    torch: { photo: null, color: '#f5a85c', dark: '#a95131', symbol: '炎' },
    cannon: { photo: null, color: '#b3c870', dark: '#5d7438', symbol: '炮' },
    lightning: { photo: null, color: '#b8b9f5', dark: '#6765a4', symbol: '电' },
    lily: { photo: null, color: '#9ad675', dark: '#42784b', symbol: '叶' },
    kelp: { photo: null, color: '#70c9a3', dark: '#317d69', symbol: '缠' },
    tide: { photo: null, color: '#95dfed', dark: '#367e9a', symbol: '潮' },
    cactus: { photo: null, color: '#b5cc78', dark: '#657d3f', symbol: '刺' },
  };
  const THEMES = {
    garden: { sky: '#ead6a3', hedge: ['#285537','#709d45'], tiles: ['#86b84d','#96c45a','#6e9e3f','#80af49'],
      accent: '#ffe8ad', border: '#3c702c', title: '飞 天 花 园' },
    pool: { sky: '#c1e5df', hedge: ['#32725c','#80ad6e'], tiles: ['#83b85b','#96c66d','#6da14a','#84b457'],
      accent: '#ecf8d5', border: '#3b7852', title: '碧 波 泳 池' },
    western: { sky: '#f6dfae', hedge: ['#d8aa71','#edc18c'], tiles: ['#d8ae72','#e8bd83','#c99a60','#dab07a'],
      accent: '#ffe6af', border: '#936844', title: '落 日 西 部' },
    courtyard: { sky: '#ead6a3', hedge: ['#285537','#709d45'], tiles: ['#86b84d','#96c45a','#6e9e3f','#80af49'],
      accent: '#ffe8ad', border: '#3c702c', title: '飞 天 花 园' },
    dunes: { sky: '#f1d293', hedge: ['#b87c45','#e3b475'], tiles: ['#abc365','#bdd37a','#91ae52','#a5bf60'],
      accent: '#ffe5a9', border: '#917b41', title: '琥 珀 沙 庭' },
    harbor: { sky: '#bddcd8', hedge: ['#3d8a9d','#87bec1'], tiles: ['#78bda0','#90cdb0','#61a98b','#78bb98'],
      accent: '#d9f0e8', border: '#397969', title: '风 帆 港 湾' },
    fairground: { sky: '#f7dea4', hedge: ['#486b42','#8ab360'], tiles: ['#91bd52','#a2cc62','#76a746','#88b650'],
      accent: '#ffebbc', border: '#567740', title: '花 园 游 乐 会' },
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;

  function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function line(ctx, x, y, xx, yy, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(xx, yy);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  }
  function poly(ctx, points, fill, stroke, width = 1) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function round(ctx, x, y, w, h, r, fill, stroke, width = 1) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function label(ctx, content, x, y, size, color = INK, weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(String(content), x, y);
  }
  function leaf(ctx, x, y, scale, flip = 1, color = '#6ba84b') {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale * flip, scale);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-13, -17, -25, -11);
    ctx.quadraticCurveTo(-20, 3, 0, 0); ctx.fillStyle = color; ctx.fill();
    line(ctx, -2, -1, -20, -10, '#507b39', 1.3); ctx.restore();
  }
  function sparkle(ctx, x, y, r, fill) {
    poly(ctx, [[x, y-r], [x+r*.23, y-r*.23], [x+r, y], [x+r*.23, y+r*.23],
      [x,y+r], [x-r*.23,y+r*.23], [x-r,y], [x-r*.23,y-r*.23]], fill);
  }
  function star(ctx, x, y, r, fill, stroke, width = 1) {
    const points=[];
    for(let i=0;i<10;i++) {
      const angle=-Math.PI/2+i*Math.PI/5, radius=i%2?r*.46:r;
      points.push([x+Math.cos(angle)*radius,y+Math.sin(angle)*radius]);
    }
    poly(ctx,points,fill,stroke,width);
  }
  function flame(ctx, x, y, size, time, reducedMotion = false) {
    const sway=reducedMotion?0:Math.sin(time*9+x)*size*.12;
    ctx.save();ctx.translate(x,y);
    ctx.beginPath();ctx.moveTo(0,-size*1.65);ctx.quadraticCurveTo(size*.1+sway,-size*.75,size*.68,-size*.5);
    ctx.quadraticCurveTo(size, size*.25,0,size*.38);ctx.quadraticCurveTo(-size*.86,size*.3,-size*.6,-size*.62);
    ctx.quadraticCurveTo(-size*.4,-size*.24,0,-size*1.65);ctx.fillStyle='#f18b40';ctx.fill();
    poly(ctx,[[0,-size*.95],[size*.35,-size*.25],[size*.17,size*.21],[-size*.26,size*.14]],'#ffe9a0');
    ctx.restore();
  }
  function bolt(ctx, x, y, size, fill = '#f4ecff') {
    poly(ctx,[[x+size*.2,y-size],[x-size*.6,y+size*.08],[x-size*.03,y+size*.08],
      [x-size*.25,y+size],[x+size*.64,y-size*.23],[x+size*.09,y-size*.23]],fill);
  }
  function flower(ctx, x, y, r, color = '#fff5c0') {
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5;
      ellipse(ctx, x + Math.cos(a) * r * .75, y + Math.sin(a) * r * .75, r * .58, r * .58, color);
    }
    ellipse(ctx, x, y, r * .4, r * .4, '#e2aa43');
  }
  function visitorHead(ctx, skin = '#acc09a', edge = '#647a58', eating = 0) {
    ellipse(ctx,0,0,18,19,skin,edge,2);
    ellipse(ctx,16,2,4,6,skin,edge,1.5);
    ellipse(ctx,-9,-3,6.8,7.8,'#f5ecd1',edge,1.2);
    ellipse(ctx,4,-5,6,6.9,'#fff0ce',edge,1.2);
    ellipse(ctx,-12,-2,2,3,'#344331'); ellipse(ctx,1,-4,2,2.6,'#344331');
    line(ctx,-15,-12,-5,-10,edge,2); line(ctx,0,-12,8,-14,edge,2);
    const jaw=2+Math.abs(eating)*3;
    poly(ctx,[[-16,8],[-4,7],[2,11],[-2,13+jaw],[-14,12+jaw]],'#5b6251',edge,1);
    round(ctx,-12,8,4,5,.8,'#f7e8c6'); round(ctx,-6,8,4,4,.8,'#f7e8c6');
  }
  function armorIntegrity(enemy) {
    const total=finite(enemy.maxArmorHp,['brute','bucket'].includes(enemy.type)?1100:370);
    return clamp(finite(enemy.armorHp,total)/Math.max(1,total),0,1);
  }

  function visitorArmor(ctx, type, integrity = 1, wobble = 0) {
    const wear=1-clamp(integrity,0,1),creased=wear>.3,crushed=wear>.65;
    ctx.save();ctx.rotate(wear*.11+wobble);ctx.translate(wear*2,wear*3);
    if (['brute','bucket'].includes(type)) {
      // Dents move the actual pail silhouette, while scratches make progressive damage readable.
      const rimY=-38+wear*8;
      poly(ctx,[[-19,-8],[-16,rimY],[-5,rimY+(crushed?5:0)],[15,rimY-1],
        [16-wear*6,-23],[21,-8]],'#a8b6b7','#637a7d',2);
      ellipse(ctx,-.5,rimY,15.5,4-wear*1.5,'#d4dcda','#637a7d',1.5);
      poly(ctx,[[-22,-10],[-10,-11+wear*3],[3,-10],[22,-11],[24,-5],[0,-4-wear*2],[-22,-4]],
        '#bdc9c6','#637a7d',1.5);
      line(ctx,-10,rimY+6,-12,-14,'#e5ece3',3);
      line(ctx,9,rimY+8,13-wear*5,-15,'#859da0',2);
      ctx.beginPath();ctx.moveTo(-18,-25+wear*5);ctx.quadraticCurveTo(0,-10+wear*5,19,-25+wear*3);
      ctx.strokeStyle='#698286';ctx.lineWidth=2;ctx.stroke();
      ellipse(ctx,-18,-25+wear*5,2,2,'#536e72');ellipse(ctx,19,-25+wear*3,2,2,'#536e72');
      if(creased) {
        poly(ctx,[[3,-29],[9,-25],[4,-21],[11,-18]],null,'#60777a',1.7);
        line(ctx,1,-27,5,-23,'#e2e7d7',1.4);
      }
      if(crushed) {
        poly(ctx,[[-13,-32],[-5,-27],[-10,-21],[-4,-16]],null,'#546c70',2.3);
        line(ctx,-10,-29,-5,-27,'#d9e1d2',1.3);
      }
    } else {
      const tipX=-5-wear*13,tipY=-48+wear*15;
      poly(ctx,[[-18,-10],[tipX,tipY],[tipX+11,tipY-1],[5+wear*6,-32],[20,-10]],'#ee994d','#aa603a',2);
      poly(ctx,[[-12,-25],[-9-wear*3,-34+wear*5],[10,-34+wear*3],[14,-25]],'#fff1c9');
      poly(ctx,[[-24,-12],[-8,-13+wear*3],[11,-12],[24,-10],[24,-5],[-24,-5]],'#cf753f','#aa603a',1.5);
      line(ctx,tipX+5,tipY+5,-11,-16,'#ffc374',2);
      if(creased) {
        poly(ctx,[[-8,-24],[-1,-27],[5,-23],[13,-24]],null,'#b66a3f',1.8);
        line(ctx,-6,-22,3,-23,'#ffe0a0',1.4);
      }
      if(crushed)poly(ctx,[[-3,-35],[-7,-29],[1,-25],[-4,-19],[3,-13]],null,'#994c31',2);
    }
    ctx.restore();
  }

  function visitorLooseArm(ctx, type = 'walker') {
    // A closed jacket sleeve and a mitten-like hand: no exposed wound or blood.
    line(ctx,0,0,-11,7,type==='runner'?'#a16b55':'#737c75',9);
    ellipse(ctx,1,-.3,4.2,4.2,'#586554','#95a18d',1);
    line(ctx,-11,7,-21,5,'#acc09a',7);
    ellipse(ctx,-24,5,5,3.8,'#acc09a','#647a58',1);
    for(let i=0;i<3;i++)line(ctx,-24,3+i*2,-29,3+i*2.2,'#647a58',1);
  }

  function visitorFallenBody(ctx, effect) {
    const runner=effect.enemyType==='runner';
    line(ctx,-8,-18,-10,-2,'#64594d',8);
    line(ctx,8,-17,15,-2,'#6e6252',8);
    round(ctx,-23,-4,18,8,3,'#483f37','#37392b',1.4);
    round(ctx,6,-3,18,8,3,'#55483b','#37392b',1.4);
    poly(ctx,[[-14,-38],[12,-40],[18,-17],[5,-13],[0,-19],[-12,-15],[-17,-26]],
      runner?'#a16b55':'#7d8290','#4e594b',2);
    poly(ctx,[[-2,-36],[5,-37],[7,-18],[2,-21],[-3,-17]],'#e6d4ad');
    line(ctx,9,-33,20,-22,'#727e72',8);
    line(ctx,20,-22,27,-24,'#acc09a',6);
    if(!effect.armLost) {
      ctx.save();ctx.translate(-12,-33);ctx.rotate(-.3);visitorLooseArm(ctx,effect.enemyType);ctx.restore();
    }
    if(effect.headless) ellipse(ctx,-2,-37,8,3,'#e6d4ad','#65715d',1.3);
    else {
      ctx.save();ctx.translate(-3,-49);ctx.rotate(-.15);visitorHead(ctx);
      if(finite(effect.armorHp)>0)visitorArmor(ctx,effect.enemyType,armorIntegrity({...effect,type:effect.enemyType}));
      ctx.restore();
    }
  }

  class GardenRenderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.levels = options.levels || root.GameLevels?.levels || [];
      this.forms = options.forms || root.GardenForms || {};
      this.enemyForms = options.enemyForms || root.GardenEnemyForms || {};
      this.reducedMotion = !!options.reducedMotion;
      this.images = new Map();
      this.width = 1; this.height = 1; this.dpr = 1; this.rows = 5;
      this.waterRows = []; this.tracks = []; this.worldTheme = 'garden';
      this.terrainCanvas = null; this.terrainKey = '';
      this.geometry = this._geometry(1, 1);
      if (typeof root.Image === 'function') {
        for (const info of [...Object.keys(LOOKS), 'mower'].map(type=>this._form(type))
          .concat(Object.values(this.enemyForms))) {
          if (!info?.image || this.images.has(info.image)) continue;
          const image = new root.Image();
          image.onload = image.onerror = () => options.onReady?.();
          image.src = info.image;
          this.images.set(info.image, image);
        }
      }
      const rect = canvas.getBoundingClientRect?.();
      this.resize(rect?.width || 900, rect?.height || 500);
    }

    _form(type) {
      return this.forms[type] || (Number.isInteger(LOOKS[type]?.photo) ? this.levels[LOOKS[type].photo] : undefined);
    }

    _geometry(width, height) {
      const left = width * .075, right = width * .045;
      const top = Math.min(height * .135, width * .09), bottom = height * .055;
      const boardWidth = width - left - right, boardHeight = height - top - bottom;
      return { left, top, right, bottom, boardWidth, boardHeight,
        cellWidth: boardWidth / 9, cellHeight: boardHeight / this.rows };
    }

    resize(width, height, dpr = root.devicePixelRatio || 1) {
      this.width = Math.max(1, finite(width, 900)); this.height = Math.max(1, finite(height, 500));
      this.dpr = clamp(finite(dpr, 1), 1, 3);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.geometry = this._geometry(this.width, this.height);
      this.terrainKey = '';
    }

    setRows(rows = 5) {
      const next = rows === 6 ? 6 : 5;
      if (this.rows !== next) {
        this.rows = next;
        this.geometry = this._geometry(this.width, this.height);
        this.terrainKey = '';
      }
    }

    _point(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return { x: (clientX - rect.left) * this.width / rect.width,
        y: (clientY - rect.top) * this.height / rect.height };
    }

    cellAt(clientX, clientY) {
      const point = this._point(clientX, clientY); if (!point) return null;
      const g = this.geometry;
      const col = Math.floor((point.x - g.left) / g.cellWidth);
      const row = Math.floor((point.y - g.top) / g.cellHeight);
      return col >= 0 && col < 9 && row >= 0 && row < this.rows ? { row, col } : null;
    }

    sunAt(clientX, clientY, state) {
      const point = this._point(clientX, clientY); if (!point) return null;
      const radius = Math.max(18, Math.min(this.geometry.cellWidth * .37, 28));
      for (let i = (state?.suns?.length || 0) - 1; i >= 0; i--) {
        const sun = state.suns[i], p = this._world(sun.x, sun.y);
        if (Math.hypot(point.x - p.x, point.y - p.y) <= radius * 1.32) return sun.id;
      }
      return null;
    }

    _world(x, y) {
      const g = this.geometry;
      return { x: g.left + finite(x) * g.cellWidth, y: g.top + finite(y) * g.cellHeight };
    }

    _terrain(ctx, themeName = 'garden') {
      const w = this.width, h = this.height, g = this.geometry;
      const theme=THEMES[themeName] || THEMES.garden;
      if(themeName==='western') { this._westernTerrain(ctx,theme); return; }
      ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, w, h);
      // A warm garden wall and a small cottage edge give the field a clear home side.
      const hedge = ctx.createLinearGradient(0, 0, 0, g.top);
      hedge.addColorStop(0, theme.hedge[0]); hedge.addColorStop(1, theme.hedge[1]);
      ctx.fillStyle = hedge; ctx.fillRect(0, 0, w, g.top + 6);
      for (let i = 0; i < 20 && ['courtyard','garden','pool','fairground'].includes(themeName); i++) {
        const x = i * w / 18 - w * .03;
        ellipse(ctx, x, g.top * .12, w * .055, g.top * .68, i % 2 ? '#35894c' : '#469b4a');
        ellipse(ctx, x + w*.015, g.top*.03, w*.032, g.top*.31, '#80bf59');
      }
      if(themeName==='dunes') {
        for(let i=0;i<5;i++) {
          const x=w*(.08+i*.24),rise=g.top*(.68+(i%2)*.3);
          poly(ctx,[[x-w*.13,g.top],[x,g.top-rise],[x+w*.12,g.top]],i%2?'#efd19b':'#ddb176');
          poly(ctx,[[x,g.top-rise],[x+w*.035,g.top],[x+w*.12,g.top]],'#cf9c63');
        }
      } else if(themeName==='harbor') {
        for(let i=0;i<3;i++) {
          const x=w*(.1+i*.37),y=g.top*.7;
          line(ctx,x,y,x,y-g.top*.57,'#496f78',Math.max(1,w*.0016));
          poly(ctx,[[x+2,y-g.top*.57],[x+w*.033,y-g.top*.06],[x+2,y-g.top*.06]],'#f5eed2');
          poly(ctx,[[x-w*.023,y],[x+w*.04,y],[x+w*.028,y+g.top*.12],[x-w*.015,y+g.top*.12]],'#9b7659');
        }
      }
      const fenceY = g.top * .38;
      for (let i = 0; i < 31; i++) {
        const fw = w / 31, x = fw * i;
        poly(ctx, [[x+1,g.top+5],[x+1,fenceY+fw*.23],[x+fw*.45,fenceY],
          [x+fw*.9,fenceY+fw*.23],[x+fw*.9,g.top+5]], '#f6dca0', '#b48c4f', Math.max(.6,w/1400));
      }
      line(ctx, 0, g.top * .83, w, g.top * .83, '#c99b58', Math.max(2,w*.004));
      line(ctx, 0, g.top * .77, w, g.top * .77, '#ffe5b5', Math.max(1,w*.002));
      for(let i=0;i<31;i+=2)ellipse(ctx,(i+.45)*w/31,g.top*.83,Math.max(.6,w*.0011),Math.max(.6,w*.0011),'#846c48');
      if(themeName==='fairground') {
        ctx.beginPath();ctx.moveTo(w*.06,g.top*.08);ctx.quadraticCurveTo(w*.5,g.top*.8,w*.97,g.top*.1);
        ctx.strokeStyle='#84694a';ctx.lineWidth=Math.max(1,w*.0015);ctx.stroke();
        for(let i=0;i<14;i++) {
          const t=(i+.5)/14,x=w*(.06+.91*t),y=g.top*(.08+1.44*t*(1-t));
          poly(ctx,[[x-w*.012,y],[x+w*.012,y],[x+w*.003,y+g.top*.32]],
            ['#e7926b','#f7d87c','#7ba4b3'][i%3],'#806b4b',.65);
        }
      }
      ctx.fillStyle = '#cfb183'; ctx.fillRect(w - g.right - 4, g.top, g.right + 4, h - g.top);
      for (let i=0;i<15;i++) {
        const yy = g.top + i * (h-g.top) / 14;
        ellipse(ctx, w - g.right*.45 + Math.sin(i*4)*g.right*.15, yy, g.right*.16, g.right*.07, '#eccea0');
      }
      ctx.fillStyle = '#d8bd93'; ctx.fillRect(0,g.top,g.left,g.boardHeight+g.bottom);
      for(let row=0;row<=this.rows;row++) {
        const y=g.top+row*g.cellHeight;
        line(ctx,0,y,g.left,y,'#b29c81',1);
      }
      // The shaded porch edge and irregular stone joints establish the house side.
      for(let row=0;row<=this.rows;row++) {
        const y=g.top+(row+.5)*g.cellHeight;
        line(ctx,g.left*.64,y-g.cellHeight*.42,g.left*.64,y+g.cellHeight*.38,'#c4ad8c',1);
        line(ctx,g.left*.2,y+g.cellHeight*.1,g.left*.47,y+g.cellHeight*.13,'#eee0bc',Math.max(1,w*.002));
      }
      const sill = g.left * .52;
      ctx.fillStyle='#e7d9bc'; ctx.fillRect(0,0,sill,h);
      line(ctx,sill,0,sill,h,'#a3977a',Math.max(1,w*.002));
      for (let i=0;i<8;i++) {
        const yy=g.top+i*h/7;
        line(ctx,0,yy,sill,yy,'#cdbda0',1);
      }
      const porchShade=ctx.createLinearGradient(sill,0,g.left,0);
      porchShade.addColorStop(0,'#49473d38');porchShade.addColorStop(1,'#49473d00');
      ctx.fillStyle=porchShade;ctx.fillRect(sill,g.top,g.left-sill,g.boardHeight);
      // Mown stripes, soft turf seams and uneven blade clusters keep the lawn organic.
      ctx.fillStyle='#735c37'; ctx.fillRect(g.left-4,g.top+g.boardHeight,g.boardWidth+8,9);
      ctx.fillStyle=theme.border; ctx.fillRect(g.left-3,g.top-2,g.boardWidth+6,g.boardHeight+7);
      for(let row=0;row<this.rows;row++) for(let col=0;col<9;col++) {
        const x=g.left+col*g.cellWidth,y=g.top+row*g.cellHeight;
        const grass=ctx.createLinearGradient(x,y,x+g.cellWidth*.15,y+g.cellHeight);
        grass.addColorStop(0,theme.tiles[(row+col)%2?0:1]);
        grass.addColorStop(1,theme.tiles[(row+col)%2?2:3]);
        ctx.fillStyle=grass;ctx.fillRect(x,y,g.cellWidth+.5,g.cellHeight+.5);
        ctx.fillStyle='#e3f49a10';
        ctx.fillRect(x,y,g.cellWidth,Math.max(1.2,g.cellHeight*.025));
        // Broad curved mowing streaks avoid a perfectly flat checkerboard.
        ctx.beginPath();ctx.moveTo(x,y+g.cellHeight*.12);
        ctx.quadraticCurveTo(x+g.cellWidth*.6,y+g.cellHeight*.25,x+g.cellWidth,y+g.cellHeight*.16);
        ctx.lineTo(x+g.cellWidth,y+g.cellHeight*.3);
        ctx.quadraticCurveTo(x+g.cellWidth*.5,y+g.cellHeight*.4,x,y+g.cellHeight*.27);
        ctx.closePath();ctx.fillStyle='#e6f7b00a';ctx.fill();
        for(let j=0;j<6;j++) {
          const seed=(row*23+col*41+j*19), xx=x+(.12+(seed%67)/87)*g.cellWidth;
          const yy=y+(.14+((seed*17)%70)/90)*g.cellHeight;
          const z=Math.max(.65,Math.min(g.cellWidth,g.cellHeight)/70);
          line(ctx,xx-2*z,yy+2*z,xx-3*z,yy-z,'#549a35',z);
          line(ctx,xx,yy+2*z,xx+z,yy-3*z,'#5aa039',z);
          line(ctx,xx+z,yy+2*z,xx+4*z,yy-z,'#b9df73',z);
          if(seed%8===0) flower(ctx,xx+3*z,yy,2*z,j%2?'#f0d36f':'#e9efc2');
        }
      }
      const canopy=ctx.createLinearGradient(0,g.top,0,g.top+g.cellHeight*.7);
      canopy.addColorStop(0,'#254d3040');canopy.addColorStop(1,'#254d3000');
      ctx.fillStyle=canopy;ctx.fillRect(g.left,g.top,g.boardWidth,g.cellHeight*.7);
      for(let i=0;i<32;i++) {
        const x=g.left+(i+.35)*g.boardWidth/32;
        const y=g.top+g.boardHeight-1,z=Math.max(.65,w/950);
        poly(ctx,[[x-3*z,y+3*z],[x-5*z,y-5*z],[x,y],[x+2*z,y-9*z],[x+3*z,y],[x+7*z,y-4*z],[x+5*z,y+4*z]],
          i%2?'#6b9d3f':'#80ae49');
        line(ctx,x+z,y+1,x+2*z,y-5*z,'#b4d875',z);
      }
      for(let row=1;row<this.rows;row++) line(ctx,g.left,g.top+row*g.cellHeight,g.left+g.boardWidth,
        g.top+row*g.cellHeight,'#4c922b35',Math.max(.7,w/1100));
      for(let i=0;i<30;i++) {
        const x=g.left+i*g.boardWidth/29,y=g.top+g.boardHeight+3;
        line(ctx,x,y,x+Math.sin(i*4)*3,y+g.bottom*.3,'#6fab3b',Math.max(1,w*.0017));
      }
      // The flower bed at the front is scenery, never an extra playable row.
      for(let i=0;i<14;i++) {
        const xx=g.left+(i+.5)*g.boardWidth/14;
        if(i%3===0) flower(ctx,xx,h-g.bottom*.31,Math.max(1.6,w*.0026),i%2?'#faf0b2':'#f7bda0');
      }
      if(themeName==='pool') this._poolTerrain(ctx);
      // A compact garden sign sits above the board without obscuring any cell.
      const signW=Math.min(w*.19,150),signH=Math.max(14,g.top*.52),signX=g.left+g.boardWidth*.52;
      round(ctx,signX-signW/2,g.top*.12,signW,signH,3,theme.accent,'#8f7246',1.3);
      label(ctx,theme.title,signX,g.top*.12+signH*.52,Math.min(13,Math.max(8,w*.018)),'#49632e',800);
    }

    _poolTerrain(ctx) {
      const g=this.geometry,w=this.width;
      if(!this.waterRows.length)return;
      const first=Math.min(...this.waterRows),last=Math.max(...this.waterRows);
      const x=g.left,y=g.top+first*g.cellHeight,height=(last-first+1)*g.cellHeight;
      const coping=Math.max(4,Math.min(9,g.cellHeight*.1));
      round(ctx,x-coping,y-coping,g.boardWidth+coping*2,height+coping*2,coping,
        '#eae6c8','#608d81',Math.max(1,w*.0015));
      // Hand-set rim tiles and a shaded pool wall make the water a real recessed space.
      for(let i=0;i<18;i++) {
        const xx=x+i*g.boardWidth/18;
        line(ctx,xx,y-coping,xx,y,'#bdc9ad',1);
        line(ctx,xx,y+height,xx,y+height+coping,'#bdc9ad',1);
      }
      const depth=ctx.createLinearGradient(x,y,x,y+height);
      depth.addColorStop(0,'#367f92');depth.addColorStop(.12,'#55adbd');
      depth.addColorStop(.63,'#71c7cb');depth.addColorStop(1,'#4aafbb');
      ctx.fillStyle=depth;ctx.fillRect(x,y,g.boardWidth,height);
      const edge=ctx.createLinearGradient(x,y,x,y+Math.min(14,height*.15));
      edge.addColorStop(0,'#255e7059');edge.addColorStop(1,'#255e7000');
      ctx.fillStyle=edge;ctx.fillRect(x,y,g.boardWidth,Math.min(14,height*.15));
      for(const row of this.waterRows)for(let col=0;col<9;col++) {
        const xx=x+col*g.cellWidth,yy=g.top+row*g.cellHeight;
        ctx.fillStyle=(row+col)%2?'#b0f0dc10':'#307e9210';
        ctx.fillRect(xx,yy,g.cellWidth,g.cellHeight);
        for(let j=0;j<3;j++) {
          const px=xx+g.cellWidth*(.15+j*.27),py=yy+g.cellHeight*(.22+(j%2)*.43);
          ctx.beginPath();ctx.moveTo(px-g.cellWidth*.12,py);
          ctx.quadraticCurveTo(px,py-g.cellHeight*.06,px+g.cellWidth*.14,py+g.cellHeight*.02);
          ctx.strokeStyle='#b2eeeb43';ctx.lineWidth=Math.max(.8,g.cellWidth*.014);ctx.stroke();
        }
      }
      for(let row=first+1;row<=last;row++)line(ctx,x,g.top+row*g.cellHeight,x+g.boardWidth,
        g.top+row*g.cellHeight,'#c5f5ed42',1);
      // Entry steps and two metal ladder rails remain outside planting cells.
      for(let i=0;i<3;i++)round(ctx,x-coping*2-i*2,y+height*.36+i*4,coping*2+i*2,
        height*.26-i*8,2,'#bfd9cd','#719c96',.8);
      for(const lx of [x+g.boardWidth*.89,x+g.boardWidth*.93]) {
        ctx.beginPath();ctx.moveTo(lx,y+height+coping*1.8);ctx.lineTo(lx,y+height-coping*1.2);
        ctx.quadraticCurveTo(lx-coping*.6,y+height-coping*2,lx-coping,y+height-coping*.7);
        ctx.strokeStyle='#376b76';ctx.lineWidth=coping*.5;ctx.stroke();
        ctx.strokeStyle='#c4e9df';ctx.lineWidth=coping*.28;ctx.stroke();
      }
      // A striped pool parasol belongs to the background rather than the board.
      const ux=w*.86,uy=g.top*.55,r=Math.min(w*.035,g.top*.48);
      line(ctx,ux,uy-r*.6,ux,uy+r*.6,'#d5c4a0',Math.max(1,w*.002));
      for(let i=0;i<6;i++) {
        const a=Math.PI+i*Math.PI/6,b=a+Math.PI/6;
        poly(ctx,[[ux,uy-r*.9],[ux+Math.cos(a)*r,uy+Math.sin(a)*r*.34],
          [ux+Math.cos(b)*r,uy+Math.sin(b)*r*.34]],i%2?'#f9e8b6':'#75b7ac','#4d8e82',.6);
      }
    }

    _westernTerrain(ctx,theme) {
      const g=this.geometry,w=this.width,h=this.height;
      const sky=ctx.createLinearGradient(0,0,0,g.top*1.4);
      sky.addColorStop(0,'#f7dfad');sky.addColorStop(1,'#eac48d');
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      ellipse(ctx,w*.84,g.top*.13,g.top*.4,g.top*.4,'#fff2c6');
      // Layered mesas, rather than a green lawn with a different palette.
      for(let i=0;i<5;i++) {
        const x=w*(-.07+i*.27),hill=g.top*(.1+(i%2)*.2);
        poly(ctx,[[x,g.top],[x+w*.045,hill+g.top*.25],[x+w*.075,hill+g.top*.25],
          [x+w*.09,hill],[x+w*.18,hill],[x+w*.2,hill+g.top*.3],
          [x+w*.24,g.top]],i%2?'#c78c64':'#dca676');
        line(ctx,x+w*.09,hill+g.top*.2,x+w*.183,hill+g.top*.2,'#edbe87',Math.max(1,w*.002));
        line(ctx,x+w*.075,hill+g.top*.43,x+w*.196,hill+g.top*.43,'#b9805b',Math.max(1,w*.002));
      }
      // The left homestead porch has broad old boards; bottles enter via the right dusty path.
      ctx.fillStyle='#b78b5d';ctx.fillRect(0,g.top,g.left,h-g.top);
      for(let row=0;row<this.rows+1;row++) {
        const y=g.top+row*g.cellHeight;
        line(ctx,0,y,g.left,y,'#825d3e',2);
        line(ctx,0,y+3,g.left,y+3,'#d8ad75',1);
      }
      ctx.fillStyle='#dec08a';ctx.fillRect(g.left+g.boardWidth,g.top,g.right,h-g.top);
      for(let i=0;i<15;i++) {
        const y=g.top+i*(h-g.top)/14,x=w-g.right*.52+Math.sin(i*4)*g.right*.16;
        ellipse(ctx,x,y,g.right*.15,g.right*.08,'#bd9868');
        ellipse(ctx,x+g.right*.15,y+7,g.right*.08,g.right*.045,'#ecd4a2');
      }
      ctx.fillStyle='#936844';ctx.fillRect(g.left-3,g.top-2,g.boardWidth+6,g.boardHeight+7);
      for(let row=0;row<this.rows;row++)for(let col=0;col<9;col++) {
        const x=g.left+col*g.cellWidth,y=g.top+row*g.cellHeight;
        const soil=ctx.createLinearGradient(x,y,x,y+g.cellHeight);
        soil.addColorStop(0,theme.tiles[(row+col)%2?0:1]);soil.addColorStop(1,theme.tiles[(row+col)%2?2:3]);
        ctx.fillStyle=soil;ctx.fillRect(x,y,g.cellWidth+.5,g.cellHeight+.5);
        const z=Math.max(.55,g.cellWidth/80);
        // Sparse crack patterns and chips leave unit silhouettes easy to read.
        for(let j=0;j<3;j++) {
          const seed=row*31+col*17+j*41,px=x+(.14+(seed%59)/85)*g.cellWidth;
          const py=y+(.2+(seed%43)/67)*g.cellHeight;
          if(seed%3===0) {
            poly(ctx,[[px-7*z,py],[px,py+2*z],[px+4*z,py-2*z],[px+9*z,py]],null,'#a97b4e70',.8*z);
            line(ctx,px,py+2*z,px-2*z,py+7*z,'#b58a5870',.8*z);
          } else {
            ellipse(ctx,px,py,2.5*z,1.2*z,'#b7895d6b');
            line(ctx,px-z,py-z,px+z,py-z,'#efd3a0',z);
          }
        }
      }
      for(let row=1;row<this.rows;row++)line(ctx,g.left,g.top+row*g.cellHeight,
        g.left+g.boardWidth,g.top+row*g.cellHeight,'#8b623237',1);
      for(let i=0;i<14;i++) {
        const x=g.left+(i+.5)*g.boardWidth/14,y=g.top+g.boardHeight+3;
        const z=Math.max(.6,w/1000);
        if(i%3===1)for(let j=0;j<5;j++)line(ctx,x,y+5*z,x+(j-2)*4*z,y-(6-Math.abs(j-2))*z,'#9c9855',z);
        else poly(ctx,[[x-5*z,y+3*z],[x-3*z,y-2*z],[x+3*z,y-3*z],[x+6*z,y+3*z]],'#b28e65','#97764f',.7);
      }
      // Split-rail fence and small saguaro silhouettes frame the horizon.
      for(let i=0;i<12;i++) {
        const x=w*(i+.25)/12;
        round(ctx,x,g.top*.5,w*.007,g.top*.53,1,'#9b7149','#75543a',.6);
        line(ctx,x,g.top*.7,x+w*.08,g.top*.76,'#c49a62',Math.max(1,w*.004));
        line(ctx,x,g.top*.9,x+w*.08,g.top*.87,'#9f754a',Math.max(1,w*.003));
      }
      for(const x of [w*.08,w*.94]) {
        const z=Math.max(.4,g.top/60);
        round(ctx,x-4*z,g.top*.27,8*z,g.top*.6,3*z,'#738957','#526940',.8);
        line(ctx,x-3*z,g.top*.64,x-11*z,g.top*.6,'#738957',5*z);
        line(ctx,x-11*z,g.top*.6,x-11*z,g.top*.43,'#738957',5*z);
        line(ctx,x+3*z,g.top*.52,x+10*z,g.top*.48,'#738957',5*z);
        line(ctx,x+10*z,g.top*.48,x+10*z,g.top*.31,'#738957',5*z);
        line(ctx,x-1*z,g.top*.34,x-1*z,g.top*.8,'#adc18a',z);
      }
      this._tracks(ctx);
      const signW=Math.min(w*.2,160),signH=Math.max(15,g.top*.54),signX=g.left+g.boardWidth*.52;
      poly(ctx,[[signX-signW*.52,g.top*.13],[signX+signW*.48,g.top*.09],
        [signX+signW*.52,g.top*.13+signH],[signX-signW*.48,g.top*.17+signH]],'#d4a56d','#805b3d',1.6);
      line(ctx,signX-signW*.46,g.top*.2,signX+signW*.41,g.top*.17,'#edc995',1.1);
      label(ctx,theme.title,signX,g.top*.13+signH*.53,Math.min(13,Math.max(8,w*.018)),'#674b32',800);
    }

    _tracks(ctx) {
      const g=this.geometry;
      for(const track of this.tracks) {
        const rows=(track.rows || []).filter(row=>Number.isInteger(row)&&row>=0&&row<this.rows);
        if(!rows.length)continue;
        const x=g.left+(track.col+.5)*g.cellWidth,y=g.top+Math.min(...rows)*g.cellHeight;
        const bottom=g.top+(Math.max(...rows)+1)*g.cellHeight;
        const rail=g.cellWidth*.26;
        for(let yy=y+g.cellHeight*.15;yy<bottom;yy+=g.cellHeight*.3) {
          round(ctx,x-rail*1.35,yy,rail*2.7,Math.max(3,g.cellHeight*.07),1.5,'#92704d','#73553c',.8);
          for(const xx of [x-rail,x+rail])ellipse(ctx,xx,yy+g.cellHeight*.035,1,1,'#b5b29a');
        }
        for(const xx of [x-rail,x+rail]) {
          line(ctx,xx+1,y+2,xx+1,bottom-2,'#6c6757',Math.max(2.5,g.cellWidth*.045));
          line(ctx,xx,y+2,xx,bottom-2,'#c1c2a8',Math.max(1.2,g.cellWidth*.019));
        }
        for(const yy of [y+2,bottom-2])line(ctx,x-rail*1.2,yy,x+rail*1.2,yy,'#786346',Math.max(2,g.cellHeight*.05));
      }
    }

    _waterLife(ctx,time) {
      if(!this.waterRows.length)return;
      const g=this.geometry,t=this.reducedMotion?0:time;
      ctx.save();
      for(const row of this.waterRows)for(let i=0;i<7;i++) {
        const x=g.left+(i+.35)*g.boardWidth/7+Math.sin(t*.35+i)*g.cellWidth*.08;
        const y=g.top+(row+.28+(i%2)*.4)*g.cellHeight;
        const wave=Math.sin(t*.9+i)*g.cellHeight*.018;
        ctx.beginPath();ctx.moveTo(x-g.cellWidth*.19,y);
        ctx.quadraticCurveTo(x,y-g.cellHeight*.04+wave,x+g.cellWidth*.21,y+wave);
        ctx.strokeStyle='#dcfff342';ctx.lineWidth=Math.max(1,g.cellWidth*.018);ctx.stroke();
        if(i%3===0)sparkle(ctx,x+g.cellWidth*.13,y-g.cellHeight*.035,
          Math.max(1.2,g.cellWidth*.026),'#eaffef80');
      }
      ctx.restore();
    }

    _cartRow(cart) {
      if(this.reducedMotion || !(cart.moveTime>0))return cart.row;
      const t=clamp(1-cart.moveTime/250,0,1),ease=1-Math.pow(1-t,3);
      return finite(cart.fromRow,cart.row)+(cart.row-finite(cart.fromRow,cart.row))*ease;
    }

    _cartDestinations(ctx,state,selected) {
      const cart=(state.carts || []).find(item=>item.id===selected);if(!cart)return;
      const g=this.geometry,track=this.tracks.find(item=>item.col===cart.col);
      for(const row of track?.rows || []) {
        if(row===cart.row)continue;
        const p=this._world(cart.col+.5,row+.55),occupied=(state.plants || []).some(plant=>plant.row===row&&plant.col===cart.col);
        if(occupied)continue;
        round(ctx,p.x-g.cellWidth*.38,p.y-g.cellHeight*.34,g.cellWidth*.76,g.cellHeight*.69,5,
          '#fff3bd35','#fff6cd',Math.max(1.5,g.cellWidth*.022));
        const direction=row<cart.row?-1:1;
        poly(ctx,[[p.x-g.cellWidth*.11,p.y+direction*g.cellHeight*.07],
          [p.x,p.y-direction*g.cellHeight*.06],[p.x+g.cellWidth*.11,p.y+direction*g.cellHeight*.07]],
          null,'#fff7d2',Math.max(1.7,g.cellWidth*.03));
      }
    }

    _cart(ctx,cart,time,selected=false) {
      const g=this.geometry,p=this._world(cart.col+.5,this._cartRow(cart)+.82);
      const sx=g.cellWidth/75,sy=Math.min(g.cellHeight/80,sx*1.2);
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(sx,sy);
      ellipse(ctx,0,7,31,8,'#7b583b38');
      for(const x of [-23,23]) {
        ellipse(ctx,x,2,7,8,'#5d625b','#3e514d',1.5);
        ellipse(ctx,x,2,3.2,3.2,'#c2c5a3','#6c7160',1.1);
        line(ctx,x-5,2,x+5,2,'#909a80',1.3);
      }
      poly(ctx,[[-32,-18],[31,-18],[26,0],[-25,0]],'#987148','#5d533b',1.7);
      poly(ctx,[[-31,-23],[31,-23],[34,-16],[-34,-16]],'#d2ab72','#6c5b3f',1.6);
      line(ctx,-23,-13,22,-13,'#b99463',2);line(ctx,-24,-4,22,-4,'#c9a476',1);
      for(const x of [-24,24]) {ellipse(ctx,x,-11,1.8,1.8,'#dbd7aa');ellipse(ctx,x,-4,1.5,1.5,'#655b40');}
      if(selected) {
        round(ctx,-35,-27,70,36,7,null,'#fff3b5',3);
        for(const sign of [-1,1])poly(ctx,[[-5,sign<0?-35:19],[0,sign<0?-42:26],[5,sign<0?-35:19]],null,'#fff2b8',2.5);
      }
      ctx.restore();
    }

    _lily(ctx,plant,time,ghost=false) {
      const g=this.geometry,p=this._world(plant.col+.5,plant.row+.72),scale=Math.min(g.cellWidth/70,g.cellHeight/65);
      const bob=this.reducedMotion?0:Math.sin(time*1.8+plant.col)*.8;
      ctx.save();ctx.translate(p.x,p.y+bob*scale);ctx.scale(scale,scale);
      if(ghost)ctx.globalAlpha=.53;
      ellipse(ctx,0,7,31,10,null,'#c8f6e288',1.5);
      // A notched broad leaf is visibly a support beneath another character.
      ctx.beginPath();ctx.moveTo(0,-1);ctx.lineTo(23,13);
      ctx.quadraticCurveTo(48,-16,-5,-21);
      ctx.quadraticCurveTo(-40,-23,-33,-2);ctx.quadraticCurveTo(-26,18,12,15);ctx.closePath();
      ctx.fillStyle='#73b767';ctx.fill();ctx.strokeStyle='#3f7b4d';ctx.lineWidth=1.7;ctx.stroke();
      for(let i=0;i<5;i++) {
        const angle=Math.PI*.15+i*Math.PI*.31;
        line(ctx,-1,-2,Math.cos(angle)*24,-3-Math.sin(angle)*14,'#b1d882',1.2);
      }
      const info=this._form('lily'),image=info&&this.images.get(info.image);
      if(image?.complete&&image.naturalWidth) {
        const frame=info.frame || [0,0,image.naturalWidth,image.naturalHeight],ratio=frame[2]/frame[3];
        const height=Math.min(29,53/ratio),width=height*ratio;
        ctx.drawImage(image,...frame,-width/2,-height+2,width,height);
      } else flower(ctx,-12,-10,6,'#ffe5b4');
      if(finite(plant.shieldHp)>0||finite(plant.powerTime)>0) {
        ellipse(ctx,0,-2,33,18,'#e3ffdc20','#e9ffd9',2);
        sparkle(ctx,-26,-19,4,'#faffdf');
      }
      if(plant.hp<plant.maxHp) {
        round(ctx,-20,18,40,4,2,'#34614b');
        round(ctx,-19,19,38*clamp(plant.hp/plant.maxHp,0,1),2,1,'#d7e792');
      }
      ctx.restore();
    }

    _drawTerrain(ctx, themeName = 'garden') {
      const theme=THEMES[themeName]?themeName:'garden';
      const key = `${this.width}/${this.height}/${this.dpr}/${theme}/${this.rows}/${this.waterRows.join(',')}/${JSON.stringify(this.tracks)}`;
      if (root.document?.createElement) {
        if (!this.terrainCanvas) this.terrainCanvas = root.document.createElement('canvas');
        if (key !== this.terrainKey) {
          this.terrainCanvas.width=this.canvas.width; this.terrainCanvas.height=this.canvas.height;
          const c=this.terrainCanvas.getContext('2d');
          c.setTransform(this.dpr,0,0,this.dpr,0,0); this._terrain(c,theme); this.terrainKey=key;
        }
        ctx.drawImage(this.terrainCanvas,0,0,this.canvas.width,this.canvas.height,0,0,this.width,this.height);
      } else this._terrain(ctx,theme);
    }

    _gardenLife(ctx,time) {
      const g=this.geometry,w=this.width;
      // Tiny visitors stay in the borders, never over the playable lawn or sun targets.
      const t=this.reducedMotion?0:time;
      if(this.worldTheme==='western') {
        for(let i=0;i<3;i++) {
          const x=g.left+g.boardWidth*(.18+i*.31)+Math.sin(t*.5+i)*w*.015;
          const y=this.height-g.bottom*(.32+i%2*.2);
          ctx.beginPath();ctx.moveTo(x-w*.025,y);ctx.quadraticCurveTo(x,y-3,x+w*.035,y-1);
          ctx.strokeStyle='#f7e3bb80';ctx.lineWidth=Math.max(.9,w*.0015);ctx.stroke();
        }
        return;
      }
      for(let i=0;i<2;i++) {
        const x=g.left+g.boardWidth*(.12+i*.63)+Math.sin(t*.7+i)*w*.012;
        const y=g.top*(.3+i*.14)+Math.cos(t*.9+i)*g.top*.06;
        const s=Math.max(1.3,w*.0023),flap=.4+Math.abs(Math.sin(t*7+i))*.6;
        ellipse(ctx,x-s*1.2,y,s*1.5*flap,s*1.3,i?'#fff3a5':'#ffd39b','#b8874c',.6);
        ellipse(ctx,x+s*1.2,y,s*1.5*flap,s*1.3,i?'#fff3a5':'#ffd39b','#b8874c',.6);
        line(ctx,x,y-s,x,y+s,'#80623f',Math.max(.7,s*.35));
      }
    }

    _introVisitors(ctx,state,progress,time) {
      if(progress>=.85)return;
      const rows=state.activeRows||state.level?.activeRows||Array.from({length:this.rows},(_,row)=>row);
      const planned=state.level?.previewEnemies || [...new Set((state.level?.waves||[])
        .flatMap(wave=>[...(wave.pool||[]),...(wave.flag?['flag']:[])]))];
      const types=planned.length?planned:['walker'];
      const reveal=this.reducedMotion?1:clamp(progress/.22,0,1);
      ctx.save();ctx.globalAlpha=clamp((.85-progress)/.2,0,1)*reveal;
      for(let i=0;i<Math.min(rows.length,types.length,3);i++) {
        const type=types[i%types.length];
        this._enemy(ctx,{id:90+i,type,row:rows[i],x:8.7+(1-reveal)*.8+i*.08,
          hp:270,maxHp:270,armorHp:['helmet','brute'].includes(type)?370:0,hasPole:type==='runner',aquatic:this.waterRows.includes(rows[i])},time);
      }
      ctx.restore();
    }

    _preparationVisitors(ctx,state,time) {
      const waves=state.level?.waves || [];
      const types=[...new Set(state.level?.previewEnemies || waves.flatMap(wave=>
        [...(wave.pool || []),...(wave.flag?['flag']:[])]))];
      if(!types.length)types.push('walker');
      const compact=this.width<700,g=this.geometry;
      const nominalScale=Math.min(g.cellWidth/69,g.cellHeight/80);
      const targetScale=Math.min(this.width*(compact?.0022:.0015),this.height*(compact?.0043:.0024),1.5);
      const displayScale=clamp(targetScale/nominalScale,.5,2.4);
      const count=types.length;
      // Keep the entire tallest silhouette below the DOM visitor caption, even at narrow desktop sizes.
      const firstBaseline=Math.max(this.height*.4,Math.min(this.height*.65,110+nominalScale*displayScale*100));
      const lastBaseline=this.height*.91;
      const placements=types.map((type,index)=>{
        const x=compact ? this.width*(.15+(count===1?.35:index/(count-1)*.7))
          : this.width*(count<4?.74+(index%2)*.1:.70+(index%2)*.15);
        const y=compact ? this.height*(.72+(index%2)*.13)
          : count===1?Math.max(firstBaseline,this.height*.67):firstBaseline+index/(count-1)*(lastBaseline-firstBaseline);
        const armor=['brute','bucket'].includes(type)?1100:['helmet','cone','armor','armored'].includes(type)?370:0;
        return {id:180+index,type,x:(x-g.left)/g.cellWidth,row:(y-g.top)/g.cellHeight-.72,
          hp:270+armor,maxHp:270+armor,armorHp:armor,maxArmorHp:armor,hasPole:type==='runner',aquatic:state.level?.chapter==='pool' && index%2===1,displayScale};
      });
      if(!compact) {
        const shade=ctx.createLinearGradient(0,0,this.width*.63,0);
        shade.addColorStop(0,'#e5ddbb35');shade.addColorStop(.8,'#e5ddbb12');shade.addColorStop(1,'#e5ddbb00');
        ctx.fillStyle=shade;ctx.fillRect(0,0,this.width*.63,this.height);
      }
      for(const enemy of placements.sort((a,b)=>a.row-b.row))this._enemy(ctx,enemy,time);
    }

    _mine(ctx, plant, time, ghost = false) {
      const g=this.geometry,p=this._world(plant.col+.5,finite(plant.drawRow,plant.row)+.66);
      const scale=Math.min(g.cellWidth/70,g.cellHeight/76);
      const armed=plant.armed===true,remaining=Math.max(0,finite(plant.armRemaining,15000));
      const progress=armed?1:clamp(1-remaining/15000,0,1),emerge=progress*progress*(3-2*progress);
      const breathing=this.reducedMotion?0:Math.sin(time*2.6+plant.col)*.65;
      const lamp=armed?(this.reducedMotion?1:.62+.38*Math.sin(time*7)**2):.25;
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);if(ghost)ctx.globalAlpha=.53;
      ellipse(ctx,0,9,29,8,'#345b2d36');
      ellipse(ctx,0,5,27,10,'#8c653e','#684b31',1.4);
      ellipse(ctx,-2,1,24,9,'#be925e');
      if(plant.boosted) {
        const halo=ctx.createRadialGradient(0,-12,2,0,-12,39);
        halo.addColorStop(0,'#fff3b899');halo.addColorStop(1,'#ffe7a100');
        ctx.fillStyle=halo;ctx.fillRect(-40,-52,80,75);
        ellipse(ctx,0,6,29,10,null,'#fff0ac',2);
        sparkle(ctx,-23,-16,4,'#fff6ce');sparkle(ctx,23,-28,4,'#fff6ce');
      }
      // Keep the full source crop: the ground occludes its lower part as it grows out.
      ctx.save();ctx.beginPath();ctx.moveTo(-25,-58);ctx.lineTo(25,-58);ctx.lineTo(25,4);ctx.lineTo(-25,4);ctx.closePath();ctx.clip();
      const bottom=20-emerge*23+breathing*emerge;
      const info=this._form('mine'),image=info&&this.images.get(info.image);
      if(image?.complete&&image.naturalWidth) {
        const frame=info.frame || [0,0,image.naturalWidth,image.naturalHeight];
        const ratio=frame[2]/frame[3],height=Math.min(39,42/ratio),width=height*ratio;
        ctx.drawImage(image,...frame,-width/2,bottom-height,width,height);
      } else {
        ellipse(ctx,0,bottom-15,20,17,'#c49a63','#735033',1.5);
        ellipse(ctx,-6,bottom-20,2,2.5,'#423b27');ellipse(ctx,6,bottom-20,2,2.5,'#423b27');
        ellipse(ctx,-11,bottom-11,2,1.2,'#dcb781');ellipse(ctx,10,bottom-7,2,1.2,'#a57948');
      }
      ctx.restore();
      // Foreground clods hide the lower edge and keep this silhouette close to the soil.
      for(let i=0;i<7;i++)ellipse(ctx,(i-3)*7,5+(i%2)*2,5.5,3.5,i%2?'#ad7f4f':'#c7a06c','#8d653e',.7);
      line(ctx,19,0,19,-13-emerge*8,'#675d42',3);
      ellipse(ctx,19,-16-emerge*8,6,5.5,armed?'#8c312d':'#887a54','#5c4c36',1.1);
      ctx.save();ctx.globalAlpha*=lamp;
      ellipse(ctx,19,-16-emerge*8,4.2,3.7,armed?'#ff6550':'#cfb976');
      if(armed) {
        ellipse(ctx,19,-16-emerge*8,8.5,8,'#ff7b4333');
        ellipse(ctx,18,-17-emerge*8,1.4,1.1,'#ffe9bd');
      }
      ctx.restore();
      if(!ghost&&!armed) {
        round(ctx,-12,13,24,11,4,'#715334df');
        label(ctx,`${Math.ceil(remaining/1000)}s`,0,18.5,8.5,'#fff1cf',700);
      }
      if(finite(plant.hurtPulse)>0)sparkle(ctx,-18,-18,8*clamp(plant.hurtPulse/180,0,1),'#fff5b6');
      ctx.restore();
    }

    _plant(ctx, plant, time, ghost = false) {
      if(plant.type==='lily') { this._lily(ctx,plant,time,ghost); return; }
      if(plant.type==='mine') { this._mine(ctx,plant,time,ghost); return; }
      const g=this.geometry, look=LOOKS[plant.type] || LOOKS.shooter;
      const p=this._world(plant.col+.5,finite(plant.drawRow,plant.row)+.66);
      const scale=Math.min(g.cellWidth/70,g.cellHeight/76);
      const pulse=clamp(finite(plant.attackPulse)/180,0,1);
      const hurt=clamp(finite(plant.hurtPulse)/180,0,1);
      const phase=time*3.1+plant.col*.8+plant.row*1.3;
      const idle=this.reducedMotion ? 0 : Math.sin(phase)*.047;
      const breathe=this.reducedMotion ? 0 : Math.sin(phase+.8)*.026;
      // A quick elastic kick settles through the full attack pulse instead of snapping at its end.
      const attackProgress=1-clamp(finite(plant.attackPulse)/230,0,1);
      const recoil=this.reducedMotion||!pulse ? 0 : Math.cos(attackProgress*Math.PI*2.2)*Math.pow(1-attackProgress,1.8);
      const flinch=this.reducedMotion ? 0 : Math.sin(hurt*Math.PI*.85)*hurt;
      const powered=finite(plant.powerTime)>0;
      ctx.save(); ctx.translate(p.x,p.y); ctx.scale(scale,scale);
      if(ghost) ctx.globalAlpha=.53;
      if(powered) {
        const aura=ctx.createRadialGradient(0,-22,4,0,-22,49);
        aura.addColorStop(0,'#f8ffd4bb');aura.addColorStop(1,'#c7f58c00');
        ctx.fillStyle=aura;ctx.fillRect(-50,-72,100,100);
        ellipse(ctx,0,7,33,11,null,'#efffd3',2.5);
        for(let i=0;i<6;i++) {
          const angle=i*TAU/6+(this.reducedMotion?0:time*.65);
          sparkle(ctx,Math.cos(angle)*32,-25+Math.sin(angle)*31,4,'#f6ffd0');
        }
      }
      ellipse(ctx,0,8,27,9,'#345b2d36');
      ctx.save();ctx.rotate(idle*.45);
      leaf(ctx,-2,5,.92+breathe,1); leaf(ctx,2,5,.92-breathe,-1,'#8cc64d');ctx.restore();
      if(plant.type==='wall'||plant.type==='tallwall') {
        round(ctx,-26,-3,52,19,5,'#bb8659','#795137',2);
        line(ctx,-18,0,-18,12,'#e4b67d',2); line(ctx,18,0,18,12,'#e4b67d',2);
      } else {
        ellipse(ctx,0,4,23,7,look.dark);
        ellipse(ctx,0,0,23,7,look.color,look.dark,1.4);
      }
      ctx.save();ctx.translate(-recoil*6-flinch*3,-3-Math.sin(phase+.35)*(this.reducedMotion?0:1.1));
      ctx.rotate(idle-recoil*.06+flinch*.1);
      ctx.scale(1-breathe+recoil*.13+flinch*.08,1+breathe-recoil*.09-flinch*.12);
      if(plant.type==='sun') {
        for(let i=0;i<10;i++) {
          const a=i*TAU/10;
          ellipse(ctx,Math.cos(a)*20,-22+Math.sin(a)*22,7,9,'#edbb4c','#c99233',1);
        }
      }
      if(plant.type==='ice') {
        const glow=ctx.createRadialGradient(0,-20,4,0,-20,34);
        glow.addColorStop(0,'#bdeef56b'); glow.addColorStop(1,'#bdeef500');
        ctx.fillStyle=glow; ctx.fillRect(-35,-57,70,70);
        sparkle(ctx,-22,-33,6,'#defcff'); sparkle(ctx,25,-15,4,'#defcff');
      }
      if(plant.type==='bomb') {
        ellipse(ctx,0,-16,26,21,'#d75c3a','#a34f35',2);
        line(ctx,7,-33,17,-43,'#644e36',3);
        sparkle(ctx,19,-45,5+Math.sin(time*12)*1.2,'#ffe6a1');
      }
      if(plant.type==='kelp') {
        for(let i=0;i<4;i++) {
          const x=(i-1.5)*13, sway=this.reducedMotion?0:Math.sin(time*2.1+i)*6;
          ctx.beginPath();ctx.moveTo(x,6);ctx.quadraticCurveTo(x+sway-12,-17,x+sway,-44-(i%2)*10);
          ctx.quadraticCurveTo(x+sway+9,-14,x+4,6);ctx.fillStyle=i%2?'#73c89e':'#459b7f';ctx.fill();
          line(ctx,x+2,1,x+sway,-34,'#b9e5a8',1.1);
        }
      } else if(plant.type==='tide') {
        ellipse(ctx,0,4,28,9,'#7acbdf99','#daf8e4',1.6);
        for(let i=0;i<3;i++) ellipse(ctx,-26+i*8,-21-i*13,2.3+i*.6,2.8+i*.6,'#e4fbff80','#9cdce9',1);
      } else if(plant.type==='cactus') {
        round(ctx,-28,-32,10,34,5,'#88aa59','#5f7c3d',1.2);
        round(ctx,18,-42,10,44,5,'#a2be6c','#5f7c3d',1.2);
        for(let i=0;i<4;i++) {
          line(ctx,-27,-23+i*7,-31,-25+i*7,'#eff2be',1.2);
          line(ctx,26,-31+i*8,31,-34+i*8,'#eff2be',1.2);
        }
        flower(ctx,23,-44,4,'#f3b588');
      }
      if(plant.type==='lightning') {
        const halo=ctx.createRadialGradient(0,-24,7,0,-24,36);
        halo.addColorStop(0,'#d5d4ff88');halo.addColorStop(1,'#b0b7ff00');
        ctx.fillStyle=halo;ctx.fillRect(-37,-61,74,74);
        bolt(ctx,-25,-34,7,'#e8ddff');bolt(ctx,26,-18,6,'#dcd8ff');
      }
      const info=this._form(plant.type),image=info&&this.images.get(info.image);
      if(image?.complete && image.naturalWidth) {
        const frame=info.frame || [0,0,image.naturalWidth,image.naturalHeight];
        const ratio=frame[2]/frame[3],height=Math.min(56,53/ratio),width=height*ratio;
        ctx.save(); ctx.shadowColor='#fff9e8'; ctx.shadowBlur=3; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
        ctx.drawImage(image,...frame,-width/2,-height+1,width,height); ctx.restore();
      } else if(plant.type==='star') {
        star(ctx,0,-25,27,look.color,look.dark,2);
        ellipse(ctx,-6,-27,2,3,'#755823');ellipse(ctx,6,-27,2,3,'#755823');
        line(ctx,-3,-19,3,-19,look.dark,1.5);
      } else {
        ellipse(ctx,0,-25,19,22,look.color,look.dark,2);
        ellipse(ctx,-6,-28,2.5,3,'#fff8db'); ellipse(ctx,7,-28,2.5,3,'#fff8db');
        line(ctx,-4,-17,5,-17,look.dark,2);
      }
      if(plant.type==='shooter' || plant.type==='ice' || plant.type==='burst') {
        const color=plant.type==='ice'?'#80cfe7':plant.type==='burst'?'#9d8ace':'#75a94e';
        round(ctx,10,-24,22,14,5,color,look.dark,1.7);
        ellipse(ctx,32,-17,4,7,look.dark);
        ellipse(ctx,33,-17,2,4,'#314535');
        if(plant.type==='burst') {
          round(ctx,8,-9,23,9,4,color,look.dark,1.4); ellipse(ctx,31,-4.5,3,4.5,look.dark);
        }
        if(pulse>.05) sparkle(ctx,39,-17,8*pulse,plant.type==='ice'?'#e8fcff':'#fff9a4');
      }
      if(plant.type==='tide') {
        ctx.save();ctx.translate(20,-13);ctx.rotate(-.15);
        poly(ctx,[[-5,7],[-12,-6],[-9,-15],[0,-19],[10,-15],[14,-6],[8,8]],'#bde9e8','#5c9ba7',1.7);
        for(let i=0;i<4;i++)line(ctx,0,5,-8+i*6,-13,'#e7fbeb',1.2);
        ellipse(ctx,10,-4,5,7,'#439cb6','#367e9a',1.5);ctx.restore();
        if(pulse>.05)for(let i=0;i<3;i++)ellipse(ctx,35+i*4,-16+(i-1)*5,3*pulse,2*pulse,'#d0f8ff');
      } else if(plant.type==='cactus' && pulse>.05) {
        for(let i=0;i<3;i++)line(ctx,27,-16+i*5,39+pulse*8,-19+i*5,'#fff7cc',1.2);
      }
      if(plant.type==='star') {
        for(let i=0;i<5;i++) {
          const angle=i*TAU/5-Math.PI/2, radius=29+pulse*9;
          star(ctx,Math.cos(angle)*radius,-24+Math.sin(angle)*radius,3+pulse*4,'#fff4b4','#d2a248',.7);
        }
      }
      if(plant.type==='corn') {
        ctx.save();ctx.translate(21,-11);ctx.rotate(-.4-recoil*.25);
        ellipse(ctx,0,-6,8,16,'#edbd4e','#a78338',1.3);
        for(let row=0;row<this.rows;row++)for(let col=0;col<2;col++) {
          round(ctx,-5+col*5,-18+row*5,4,4,1,'#ffdf78','#d3a245',.5);
        }
        leaf(ctx,0,5,.53,1,'#83b45a');leaf(ctx,1,5,.55,-1,'#a4c66d');ctx.restore();
      } else if(plant.type==='tallwall') {
        // The low shield leaves the actual photograph and face visible above it.
        poly(ctx,[[-24,-17],[0,-24],[24,-17],[20,7],[0,15],[-20,7]],'#ad9772','#68563f',2);
        poly(ctx,[[-18,-13],[0,-18],[18,-13],[15,3],[0,9],[-15,3]],'#c6b189','#e2d2aa',1);
        sparkle(ctx,0,-5,8,'#f5e2b5');
      } else if(plant.type==='torch') {
        line(ctx,23,7,23,-17,'#895238',6);line(ctx,22,4,22,-15,'#d69a54',2);
        flame(ctx,23,-22,11+pulse*2,time,this.reducedMotion);
        if(powered)flame(ctx,-24,-17,9,time+.8,this.reducedMotion);
      } else if(plant.type==='cannon') {
        ctx.save();ctx.translate(17,-10);ctx.rotate(-.35-recoil*.12);
        round(ctx,-2,-9,29,18,6,'#8a9d60','#53683c',2);
        round(ctx,19,-11,9,22,3,'#b9c992','#53683c',1.5);
        ellipse(ctx,28,0,4,8,'#394d33');ellipse(ctx,28,-1,2,4,'#20382a');ctx.restore();
        ellipse(ctx,13,4,8,7,'#bd9a61','#77663c',1.5);
        if(pulse>.05)sparkle(ctx,42,-22,11*pulse,'#fff3b7');
      } else if(plant.type==='lightning') {
        ellipse(ctx,20,-4,8,7,'#a19ac9','#68619a',1.5);
        line(ctx,20,-9,20,-24,'#9b92c2',3);
        bolt(ctx,20,-31,11,'#f5e9ff');
        if(pulse>.05)bolt(ctx,34,-35,8*pulse,'#fef8ff');
      }
      ctx.restore();
      if(finite(plant.shieldHp)>0) {
        round(ctx,-31,-62,62,76,16,'#e6f7ff1c','#e4fcffd9',2.4);
        sparkle(ctx,-22,-51,5,'#ffffff');
      }
      if(hurt>0) {
        sparkle(ctx,18,-32,10*hurt,'#fff5b6');
        line(ctx,24,-38,28,-43,'#ffdc77',1.5*hurt);
      }
      if(plant.hp<plant.maxHp) {
        round(ctx,-20,16,40,5,2,'#3f5234');
        round(ctx,-19,17,38*clamp(plant.hp/plant.maxHp,0,1),3,1,
          plant.hp/plant.maxHp<.3?'#ed9c64':'#d7e792');
      }
      ctx.restore();
    }

    _enemyPhoto(type) {
      const info=this.enemyForms[type],image=info&&this.images.get(info.image);
      if(!image?.complete || !image.naturalWidth || !info.rig)return null;
      if(['head','torso','nearArm','farArm','nearLeg','farLeg'].some(name=>{
        const part=info.rig[name];
        return !part?.polygon?.length || !Array.isArray(part.pivot) || part.pivot.length!==2;
      }))return null;
      const frame=info.frame || [0,0,image.naturalWidth,image.naturalHeight];
      const height=74,width=height*frame[2]/frame[3];
      return {info,image,frame,width,height};
    }

    _photoPart(ctx,photo,name,angle=0,shiftX=0,shiftY=0) {
      const part=photo.info.rig[name];
      if(!part?.polygon?.length || !part.pivot)return false;
      const {width:w,height:h}=photo,px=(part.pivot[0]-.5)*w,py=(part.pivot[1]-1)*h;
      ctx.save();ctx.translate(px+shiftX,py+shiftY);ctx.rotate(angle);ctx.translate(-px,-py);
      ctx.beginPath();
      part.polygon.forEach(([x,y],i)=>i?ctx.lineTo((x-.5)*w,(y-1)*h):ctx.moveTo((x-.5)*w,(y-1)*h));
      ctx.closePath();ctx.clip();
      ctx.drawImage(photo.image,...photo.frame,-w/2,-h,w,h);
      ctx.restore();return true;
    }

    _photoHeadPosition(photo) {
      const points=photo.info.rig.head?.polygon || [[.3,0],[.7,.22]];
      const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      return {x:((left+right)/2-.5)*photo.width,
        y:((top+bottom)/2-1)*photo.height,
        armorScale:clamp((right-left)*photo.width/36,.2,.46)};
    }

    _photoPose(ctx,photo,enemy,pose={}) {
      const stride=finite(pose.stride),reach=finite(pose.reach),bite=finite(pose.bite);
      const still=this.reducedMotion,legSwing=still?0:stride*.17;
      const farLift=still?0:Math.pow(Math.max(0,-stride),2)*2;
      const nearLift=still?0:Math.pow(Math.max(0,stride),2)*2;
      this._photoPart(ctx,photo,'farLeg',-legSwing,0,-farLift);
      this._photoPart(ctx,photo,'nearLeg',legSwing,0,-nearLift);
      ctx.save();ctx.translate(0,-finite(pose.bob));
      // Arms and legs are independent photo pieces. A removed part is never painted into the torso.
      this._photoPart(ctx,photo,'farArm',.34+reach*.35+(still?0:finite(pose.sway,stride)*.11));
      this._photoPart(ctx,photo,'torso',-.035+(still?0:stride*.018));
      if(!enemy.headless)this._photoPart(ctx,photo,'head',-.04-bite*.11,-bite*1.1,still?0:-finite(pose.bob)*.25);
      if(!enemy.armLost)this._photoPart(ctx,photo,'nearArm',.55+reach*.43-(still?0:finite(pose.sway,stride)*.13));
      if(!enemy.headless&&finite(enemy.armorHp)>0&&['helmet','brute','bucket','cone','armor','armored'].includes(enemy.type)) {
        const p=this._photoHeadPosition(photo);
        ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.armorScale,p.armorScale);
        visitorArmor(ctx,enemy.type,armorIntegrity(enemy),still?0:stride*.02*(1-armorIntegrity(enemy)));ctx.restore();
      }
      ctx.restore();
    }

    _photoEnemy(ctx,enemy,time) {
      const photo=this._enemyPhoto(enemy.type);if(!photo)return false;
      const g=this.geometry,p=this._world(enemy.x,enemy.row+.72);
      const hasPole=enemy.type==='runner'&&!enemy.headless&&(enemy.hasPole??(!enemy.usedPole&&!enemy.hasVaulted));
      const vaulting=hasPole&&!!enemy.vaulting,progress=clamp(finite(enemy.vaultProgress),0,1);
      const jump=vaulting?Math.sin(progress*Math.PI)*49:0;
      const fast=hasPole||enemy.type==='flag',cold=finite(enemy.slowTime)>0;
      const immobilized=finite(enemy.freezeTime)>0||finite(enemy.stunTime)>0;
      const seed=typeof enemy.id==='number'?enemy.id:Array.from(String(enemy.id||enemy.row))
        .reduce((value,character)=>value+character.charCodeAt(0),0);
      const phase=this.reducedMotion||immobilized?0:time*(fast?12:5)*(cold?.5:1)+seed*1.7;
      const stride=this.reducedMotion||immobilized?0:Math.sin(phase),hit=clamp(finite(enemy.hitPulse)/180,0,1);
      const sway=this.reducedMotion||immobilized?0:Math.sin(phase-.7);
      const eating=!immobilized&&!enemy.headless&&!vaulting&&(enemy.eating||enemy.attacking||enemy.state==='attacking');
      const bite=this.reducedMotion?0:eating?Math.pow((1+Math.sin(phase*1.5))*.5,2):0;
      const scale=Math.min(g.cellWidth/69,g.cellHeight/80)*clamp(finite(enemy.displayScale,1),.5,2.4);
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);
      ellipse(ctx,1,5,22-jump*.16,7-jump*.045,'#2e4b2e3b');
      if(hasPole) {
        if(vaulting) {
          const grip=-32+progress*60;
          line(ctx,grip,4,grip+10-progress*55,-70-jump,'#6e8052',3.2);
        } else line(ctx,-45,-61,30,-13,'#6e8052',3.2);
      }
      const impact=this.reducedMotion?0:Math.sin(hit*Math.PI*.85)*hit;
      ctx.save();ctx.translate(impact*5,-jump);ctx.rotate(-impact*.06);
      this._photoPose(ctx,photo,enemy,{stride:vaulting?-.65:eating?stride*.2:stride,
        bob:this.reducedMotion?0:(1-Math.cos(phase*2))*(eating?.25:.7),sway,reach:eating?.7+bite*.3:0,bite});
      if(enemy.type==='flag') {
        line(ctx,16,0,16,-82,'#697750',2.7);
        poly(ctx,[[17,-80],[42,-77],[38,-65],[43,-52],[17,-56]],'#cc6a53','#914e3c',1.5);
        sparkle(ctx,29,-66,6,'#f5dfa1');
      }
      if(cold) {
        sparkle(ctx,-20,-37,5,'#d6f8ff');sparkle(ctx,20,-18,4,'#d6f8ff');
        ellipse(ctx,0,4,23,7,'#a9e3ed33','#9adee6',1);
      }
      this._enemyStatus(ctx,enemy,time);
      if(hit>0) {
        sparkle(ctx,-19,-40,14*hit,'#fff4ae');
        line(ctx,-29,-50,-35,-58,'#fff3c7',1.8*hit);
      }
      ctx.restore();ctx.restore();return true;
    }

    _photoLoosePart(ctx,photo,name) {
      const part=photo.info.rig[name];if(!part?.pivot)return false;
      const px=(part.pivot[0]-.5)*photo.width,py=(part.pivot[1]-1)*photo.height;
      ctx.save();ctx.translate(-px,-py);const drawn=this._photoPart(ctx,photo,name);ctx.restore();
      return drawn;
    }

    _enemyStatus(ctx,enemy,time) {
      if(finite(enemy.freezeTime)>0) {
        poly(ctx,[[-25,3],[-30,-36],[-16,-69],[10,-73],[27,-44],[24,3]],'#b8eafa38','#b7f0ff',1.6);
        sparkle(ctx,-23,-46,6,'#f0feff');sparkle(ctx,21,-17,5,'#f0feff');
      }
      if(finite(enemy.stunTime)>0) {
        round(ctx,-15,-82,30,9,3,'#ffe6a1','#e5bc54',1);
        for(let i=0;i<3;i++) {
          const a=i*TAU/3+(this.reducedMotion?0:time*3);
          star(ctx,Math.cos(a)*21,-85+Math.sin(a)*4,4,'#fff2aa','#b89043',.6);
        }
      }
    }

    _enemy(ctx, enemy, time) {
      if(!enemy.aquatic) { this._enemyBody(ctx,enemy,time); return; }
      const g=this.geometry,p=this._world(enemy.x,enemy.row+.72);
      const scale=Math.min(g.cellWidth/69,g.cellHeight/80)*clamp(finite(enemy.displayScale,1),.5,2.4);
      const bob=this.reducedMotion?0:Math.sin(time*2.3+finite(enemy.x))*scale*1.7;
      ctx.save();ctx.translate(0,bob);
      ctx.save();poly(ctx,[[p.x-90*scale,p.y-150*scale],[p.x+90*scale,p.y-150*scale],
        [p.x+90*scale,p.y-15*scale],[p.x-90*scale,p.y-15*scale]]);ctx.clip();
      this._enemyBody(ctx,{...enemy,hasPole:false,vaulting:false},time);ctx.restore();
      ctx.translate(p.x,p.y);ctx.scale(scale,scale);
      ellipse(ctx,0,-7,29,8,null,'#c9f7ee8c',1.4);
      ellipse(ctx,0,-15,24,10,'#ecac62','#956e43',1.6);
      ellipse(ctx,0,-19,16,5.5,'#456e6980','#ffe4a4',1.4);
      for(const x of [-18,18])line(ctx,x,-20,x,-11,'#fff2c9',5);
      line(ctx,-24,-5,-35,-4,'#dbfffa',1.5);line(ctx,20,-2,31,-1,'#dbfffa',1.2);
      ctx.restore();
    }

    _enemyBody(ctx, enemy, time) {
      if(this._photoEnemy(ctx,enemy,time))return;
      const g=this.geometry,p=this._world(enemy.x,enemy.row+.72);
      const runner=['runner','fast'].includes(enemy.type);
      const hasPole=runner&&!enemy.headless&&(enemy.hasPole ?? (!enemy.usedPole&&!enemy.hasVaulted));
      const fast=hasPole || enemy.type==='flag';
      const armored=['helmet','armored','armor','bucket','cone','brute'].includes(enemy.type)
        && finite(enemy.armorHp,1)>0&&!enemy.headless;
      const isCold=finite(enemy.slowTime)>0,headless=!!enemy.headless;
      const immobilized=finite(enemy.freezeTime)>0||finite(enemy.stunTime)>0;
      const vaulting=!!enemy.vaulting&&!headless;
      const vaultProgress=clamp(finite(enemy.vaultProgress),0,1);
      const jump=vaulting?Math.sin(vaultProgress*Math.PI)*49:0;
      const scale=Math.min(g.cellWidth/69,g.cellHeight/80)*clamp(finite(enemy.displayScale,1),.5,2.4);
      const gaitSeed=typeof enemy.id==='number'?enemy.id:Array.from(String(enemy.id||enemy.row))
        .reduce((value,character)=>value+character.charCodeAt(0),0);
      const phase=this.reducedMotion||immobilized?0:time*(fast?12:5)*(isCold?.5:1)+gaitSeed*1.7;
      const stride=this.reducedMotion||immobilized?0:Math.sin(phase), bob=this.reducedMotion||immobilized?0:(1-Math.cos(phase*2))*(fast?1.5:.9);
      const hit=clamp(finite(enemy.hitPulse)/180,0,1);
      const flinch=this.reducedMotion?0:Math.sin(hit*Math.PI*.85)*hit;
      const armLost=!!enemy.armLost;
      const skin=isCold?'#a2d2ce':'#acc09a';
      const skinDark=isCold?'#5f9ba4':'#647a58';
      const eating=!immobilized&&!headless&&!vaulting&&(enemy.eating || enemy.attacking || enemy.state==='attacking');
      ctx.save(); ctx.translate(p.x,p.y); ctx.scale(scale,scale);
      ellipse(ctx,1,5,22-jump*.16,7-jump*.045,'#2e4b2e3b');
      if(hasPole) {
        if(vaulting) {
          const gripX=-32+vaultProgress*60;
          line(ctx,gripX,4,gripX+10-vaultProgress*55,-70-jump,'#6e8052',3.2);
          line(ctx,gripX+1,1,gripX+11-vaultProgress*55,-69-jump,'#c4cd94',1);
        } else {
          line(ctx,-45,-61,30,-13,'#6e8052',3.2);
          line(ctx,-44,-62,31,-14,'#c4cd94',1);
        }
      }
      ctx.save();ctx.translate(flinch*4,-jump);ctx.rotate(-flinch*.045);
      const walk=vaulting ? -.65 : eating ? stride*.18 : stride;
      // Oversized boots and offset knees make the leftward shuffle readable.
      line(ctx,-9,-18,-12+walk*3,-10,'#64594d',9);
      line(ctx,-12+walk*3,-10,-12+walk*5,-2,'#64594d',8);
      line(ctx,9,-18,12-walk*3,-9,'#6e6252',9);
      line(ctx,12-walk*3,-9,10-walk*5,-1,'#6e6252',8);
      round(ctx,-23+walk*4,-4,17,9,3,'#483f37','#37392b',1.5);
      round(ctx,1-walk*4,-3,18,9,3,'#55483b','#37392b',1.5);
      ctx.save(); ctx.translate(0,-bob); ctx.rotate(-.075+(this.reducedMotion?0:stride*.024));
      poly(ctx,[[-14,-38],[12,-40],[18,-17],[5,-13],[0,-19],[-12,-15],[-17,-26]],
        runner?'#a16b55':'#7d8290','#4e594b',2);
      poly(ctx,[[-2,-36],[5,-37],[7,-18],[2,-21],[-3,-17]],'#e6d4ad');
      poly(ctx,[[0,-35],[5,-35],[4,-28],[8,-21],[3,-18],[-1,-27]],fast?'#f4d775':'#b55d49');
      // Two-joint reaching arms follow the shuffle; the front sleeve remains after an arm is lost.
      const reach=eating?Math.pow((1+Math.sin(phase*1.5))*.5,2)*4:Math.sin(phase-.7)*2.6;
      line(ctx,10,-34,-3+reach*.45,-24,'#727e72',8);
      line(ctx,-3+reach*.45,-24,-19+reach,-25-reach*.25,skin,6.5);
      ellipse(ctx,-20+reach,-25-reach*.25,4.5,3.7,skin,skinDark,.8);
      if(!armLost) {
        line(ctx,-12,-34,-25+reach*.5,-29+reach*.35,'#737c75',9);
        line(ctx,-25+reach*.5,-29+reach*.35,-36+reach,-31+reach*.35,skin,7);
        for(let i=0;i<3;i++)line(ctx,-35+reach,-33+reach*.35+i*2.2,-42+reach,-33+reach*.35+i*2.5,skinDark,1.1);
      } else {
        line(ctx,-12,-34,-18,-31,'#737c75',9);
        ellipse(ctx,-19,-30.8,3.7,4,'#535f52','#8e9883',1);
      }
      if(enemy.type==='flag') {
        line(ctx,16,0,16,-82,'#697750',2.7);
        poly(ctx,[[17,-80],[42,-77],[38,-65],[43,-52],[17,-56]],'#cc6a53','#914e3c',1.5);
        sparkle(ctx,29,-66,6,'#f5dfa1');
        ellipse(ctx,16,-83,3,3,'#e9d088');
      }
      if(!headless) {
        ctx.save(); ctx.translate(-3-(eating?reach*.2:0),-49); ctx.rotate(this.reducedMotion?0:Math.sin(phase*.55)*.04-(eating?reach*.02:0));
        visitorHead(ctx,skin,skinDark,eating?reach*.25:0);
        if(armored) visitorArmor(ctx,enemy.type,armorIntegrity(enemy),this.reducedMotion?0:stride*.02*(1-armorIntegrity(enemy)));
        else if(runner) {
          poly(ctx,[[-18,-9],[-14,-20],[7,-22],[18,-10]],'#a85543','#774637',1.5);
          line(ctx,-18,-10,18,-10,'#e2a46c',4);
        } else {
          for(let i=0;i<4;i++) line(ctx,3+i*3,-17,6+i*2,-24+(i%2)*3,'#536346',2);
        }
        ctx.restore();
      } else {
        // A closed scarf/collar keeps this purely cartoon, without a wound.
        ellipse(ctx,-2,-37,8,3,'#e6d4ad','#65715d',1.3);
      }
      ctx.restore();
      if(isCold) {
        sparkle(ctx,-20,-37,5,'#d6f8ff'); sparkle(ctx,20,-18,4,'#d6f8ff');
        ellipse(ctx,0,4,23,7,'#a9e3ed33','#9adee6',1);
      }
      this._enemyStatus(ctx,enemy,time);
      if(hit>0) sparkle(ctx,-19,-40,14*hit,'#fff4ae');
      ctx.restore();ctx.restore();
    }

    _mower(ctx,mower,time) {
      if(mower.enabled===false || mower.used&&!mower.active)return;
      const g=this.geometry,p=this._world(mower.active ? mower.x : -.37,mower.row+.72);
      const s=Math.min(g.cellWidth/72,g.cellHeight/80);
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
      ellipse(ctx,0,6,16,5,'#33472d44');
      const info=this._form('mower'),image=info&&this.images.get(info.image);
      if(image?.complete && image.naturalWidth) {
        const frame=info.frame || [0,0,image.naturalWidth,image.naturalHeight];
        const ratio=frame[2]/frame[3],height=Math.min(47,44/ratio),width=height*ratio;
        const wheel=(x,y,rear=false)=>{
          ellipse(ctx,x,y,3.7,4.1,rear?'#353b33':'#454a3c','#29382d',1.1);
          ellipse(ctx,x,y,1.5,1.7,rear?'#879180':'#c2c8ad');
        };
        wheel(-width*.34,-1,true);wheel(width*.34,-1,true);
        ctx.save();ctx.shadowColor='#fff5dc';ctx.shadowBlur=2;
        ctx.drawImage(image,...frame,-width/2,-height,width,height);ctx.restore();
        wheel(-width*.22,5);wheel(width*.22,5);
      } else {
        line(ctx,-9,-3,-17,-21,'#62715c',2);line(ctx,-17,-21,-7,-22,'#394b37',3);
        ellipse(ctx,-10,4,5,5,'#454a3c','#29382d',1.5);ellipse(ctx,11,4,5,5,'#454a3c','#29382d',1.5);
        round(ctx,-16,-9,31,11,4,'#c97c52','#8f573b',1.5);
        round(ctx,-7,-17,15,9,3,'#e1a667','#9d7045',1.5);
        line(ctx,-2,-15,4,-15,'#f8d5a0',1.7);
      }
      if(mower.aquatic || this.waterRows.includes(mower.row)) {
        poly(ctx,[[-22,-1],[22,-1],[16,10],[-16,10]],'#f5cb78','#957347',1.6);
        line(ctx,-19,1,19,1,'#fff0bc',2.5);
        ellipse(ctx,0,13,24,3,null,'#d9fff5',1.4);
      }
      if(mower.active)for(let i=0;i<3;i++)line(ctx,-24-i*4,-7+i*5,-32-i*4,-7+i*5,
        mower.aquatic||this.waterRows.includes(mower.row)?'#ddfff7':'#f4e0a4',2);
      ctx.restore();
    }

    _projectile(ctx,projectile,time=0) {
      const p=this._world(projectile.x,finite(projectile.y,projectile.row+.44)),g=this.geometry;
      const r=Math.max(3.2,Math.min(g.cellWidth*.105,7))*(projectile.power?1.22:1);
      if(projectile.type==='tide') {
        line(ctx,p.x-r*4,p.y,p.x-r,p.y,'#a6ebef88',r*1.2);
        ellipse(ctx,p.x,p.y,r*1.2,r*1.1,'#a1e8ed','#4c9fb4',1.1);
        ellipse(ctx,p.x-r*.22,p.y-r*.3,r*.4,r*.2,'#f1ffff');
        ellipse(ctx,p.x-r*2.4,p.y+r*.2,r*.35,r*.35,'#cef9ed');return;
      }
      if(projectile.type==='cactus') {
        poly(ctx,[[p.x+r*2.1,p.y],[p.x-r*.9,p.y-r*.4],[p.x-r*.6,p.y+r*.4]],'#f6e8b0','#8d9252',.9);
        line(ctx,p.x-r*3.2,p.y,p.x-r*.8,p.y,'#d8dc9c88',r*.5);return;
      }
      if(projectile.type==='corn'||projectile.type==='cannon') {
        const cannon=projectile.type==='cannon';
        ctx.save();ctx.translate(p.x,p.y);
        ctx.rotate(this.reducedMotion?0:finite(projectile.age)/1000*(cannon?5:8));
        if(cannon) {
          ellipse(ctx,0,0,r*1.7,r*1.7,'#9cb86b','#5b773e',Math.max(1,r*.22));
          line(ctx,-r,-r*.7,r*.8,r*.8,'#d1df9e',r*.45);
          sparkle(ctx,-r*.45,-r*.6,r*.55,'#f4efbf');
        } else if(projectile.butter) {
          round(ctx,-r*1.2,-r*.8,r*2.4,r*1.6,r*.25,'#fff0ab','#d7af49',Math.max(.8,r*.18));
          line(ctx,-r*.8,-r*.45,r*.65,-r*.45,'#fff9df',r*.28);
        } else {
          ellipse(ctx,0,0,r*.9,r*1.2,'#ffde68','#bb913e',Math.max(.8,r*.18));
          ellipse(ctx,-r*.2,-r*.3,r*.3,r*.45,'#fff1b2');
        }
        ctx.restore();return;
      }
      if(projectile.type==='fire') {
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/2);
        flame(ctx,0,0,r*1.25,time,this.reducedMotion);ctx.restore();
        line(ctx,p.x-r*4,p.y,p.x-r*1.3,p.y,'#ffc867a6',r*.8);return;
      }
      if(projectile.type==='star') {
        const dx=finite(projectile.vx,-1)*g.cellWidth,dy=finite(projectile.vy)*g.cellHeight;
        const distance=Math.max(.01,Math.hypot(dx,dy));
        line(ctx,p.x-dx/distance*r*3.5,p.y-dy/distance*r*3.5,p.x,p.y,'#ffe18885',r*.75);
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(this.reducedMotion?0:time*7+projectile.x*1.4+finite(projectile.y));
        star(ctx,0,0,r*1.35,'#ffe883','#c29439',Math.max(.8,r*.16));
        sparkle(ctx,-r*.15,-r*.2,r*.38,'#fffbed');ctx.restore();return;
      }
      const ice=projectile.type==='ice',burst=projectile.type==='burst';
      const color=ice?'#c6f6ff':burst?'#e1d9ff':'#e5f6a7';
      line(ctx,p.x-r*3.4,p.y,p.x-r,p.y,ice?'#a9e5f46b':burst?'#c1b1e97a':'#cfeb8b7d',r*.85);
      ellipse(ctx,p.x,p.y,r,r,color,ice?'#65adbf':burst?'#8e7ab7':'#638d3c',Math.max(.8,r*.18));
      ellipse(ctx,p.x-r*.25,p.y-r*.3,r*.34,r*.3,'#ffffffc9');
    }

    _sun(ctx,sun,time) {
      const p=this._world(sun.x,sun.y),g=this.geometry;
      const r=Math.max(12,Math.min(g.cellWidth*.29,22));
      const age=Math.max(0,finite(sun.age)),landAge=age-Math.max(0,finite(sun.flightDuration));
      const landing=(!this.reducedMotion&&sun.landed&&landAge>=0&&landAge<500)
        ?Math.sin(landAge/500*Math.PI*2)*Math.exp(-landAge/190)*.18:0;
      const breathe=this.reducedMotion?0:Math.sin(time*2.3+finite(sun.x)*1.7)*.025;
      const blink=!this.reducedMotion&&finite(sun.life,10000)<2000 ? .76+.24*Math.sin(time*9) : 1;
      ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=blink;
      // Only shape/lighting animate here; the engine owns x/y, so tapping always hits the visible sun.
      ctx.scale(1+breathe+landing,1+breathe-landing);
      const glow=ctx.createRadialGradient(0,0,r*.3,0,0,r*2.15);
      glow.addColorStop(0,'#fff6a9ba');glow.addColorStop(.5,'#ffe57d48');glow.addColorStop(1,'#fff8ba00');
      ctx.fillStyle=glow;ctx.fillRect(-r*2.2,-r*2.2,r*4.4,r*4.4);
      ctx.save();ctx.rotate(this.reducedMotion?0:time*.3+finite(sun.x)*.2);
      for(let i=0;i<12;i++) {
        const a=i*TAU/12;ctx.save();ctx.rotate(a);
        poly(ctx,[[r*.88,-r*.16],[r*(i%2?1.35:1.55),0],[r*.88,r*.16]],'#f8c849','#d99e38',.7);ctx.restore();
      }
      ctx.restore();
      const core=ctx.createRadialGradient(-r*.3,-r*.35,r*.1,0,0,r);
      core.addColorStop(0,'#fffbd6');core.addColorStop(.62,'#ffe783');core.addColorStop(1,'#efb746');
      ellipse(ctx,0,0,r,r,core,'#ca9137',1.2);
      ellipse(ctx,-r*.27,-r*.4,r*.29,r*.15,'#fffce7b8');
      if((sun.value||25)!==25)label(ctx,sun.value,0,1,Math.max(10,r*.64),'#976720',800);
      else {
        ellipse(ctx,-r*.29,-r*.02,r*.06,r*.08,'#a8752a');ellipse(ctx,r*.29,-r*.02,r*.06,r*.08,'#a8752a');
        ctx.beginPath();ctx.moveTo(-r*.2,r*.24);ctx.quadraticCurveTo(0,r*.38,r*.2,r*.24);
        ctx.strokeStyle='#b47a2e';ctx.lineWidth=Math.max(.8,r*.05);ctx.stroke();
      }
      ctx.restore();
    }

    _effect(ctx,effect,time) {
      const g=this.geometry,p=this._world(effect.x,finite(effect.y,finite(effect.row)+.55));
      const life=finite(effect.life,0),max=Math.max(.01,finite(effect.maxLife,life || 1));
      const photo=this._enemyPhoto(effect.enemyType);
      const progress=clamp(1-life/max,0,1),scale=photo?Math.min(g.cellWidth/69,g.cellHeight/80):Math.min(g.cellWidth/70,g.cellHeight/76);
      const photoBaseline=.17*g.cellHeight/scale;
      const type=effect.type || '';
      if(type==='tide') {
        ctx.save();ctx.globalAlpha=(1-progress)*.8;
        const x=g.left+g.boardWidth*progress;
        const waveWidth=Math.min(g.cellWidth*1.1,g.boardWidth*.3),yy=g.top+finite(effect.row)*g.cellHeight;
        const wash=ctx.createLinearGradient(x-waveWidth,yy,x,yy);
        wash.addColorStop(0,'#b7f5eb00');wash.addColorStop(1,'#9ae8e3b0');
        ctx.fillStyle=wash;ctx.fillRect(x-waveWidth,yy+g.cellHeight*.15,waveWidth,g.cellHeight*.7);
        for(let i=0;i<4;i++) {
          const wy=yy+g.cellHeight*(.2+i*.19);
          ctx.beginPath();ctx.moveTo(x-5,wy);ctx.quadraticCurveTo(x+10,wy-8,x+5,wy+g.cellHeight*.14);
          ctx.strokeStyle='#e7fff4';ctx.lineWidth=Math.max(2,g.cellWidth*.035);ctx.stroke();
        }
        ctx.restore();return;
      }
      if(type==='flame'&&finite(effect.radius)>=9) {
        // A full-lane ultimate is confined to that lane, matching its collision area.
        ctx.save();ctx.globalAlpha=(1-progress)*.85;
        round(ctx,g.left,p.y-g.cellHeight*.26,g.boardWidth,g.cellHeight*.57,5,'#ffd57638','#ffdc91',1.5);
        for(let i=0;i<18;i++)flame(ctx,g.left+(i+.5)*g.boardWidth/18,p.y+g.cellHeight*.12,
          Math.min(g.cellWidth*.22,g.cellHeight*.24)*(i%2?.8:1),time+i,this.reducedMotion);
        ctx.restore();return;
      }
      if(type==='lightning'&&Array.isArray(effect.points)&&effect.points.length>1) {
        ctx.save();ctx.globalAlpha=clamp((1-progress)*1.7,0,1);
        for(let i=1;i<effect.points.length;i++) {
          const from=this._world(effect.points[i-1].x,effect.points[i-1].y);
          const to=this._world(effect.points[i].x,effect.points[i].y);
          const dx=to.x-from.x,dy=to.y-from.y,length=Math.max(1,Math.hypot(dx,dy));
          const points=Array.from({length:8},(_,j)=>{
            const t=j/7,jag=j===0||j===7?0:(j%2?1:-1)*Math.min(9,length*.08);
            return [from.x+dx*t-dy/length*jag,from.y+dy*t+dx/length*jag];
          });
          const trace=(color,width)=>{
            ctx.beginPath();points.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));
            ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();
          };
          trace('#bcb4ff77',Math.max(4,g.cellWidth*.09));
          trace('#f2eaff',Math.max(1.5,g.cellWidth*.025));
          sparkle(ctx,to.x,to.y,Math.max(4,g.cellWidth*.11),'#fff7ff');
        }
        ctx.restore();return;
      }
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);ctx.globalAlpha=1-progress;
      if(type==='kelp') {
        const curl=this.reducedMotion?.8:Math.sin(progress*Math.PI);
        ellipse(ctx,0,10,17+progress*30,5+progress*8,null,'#d5fff2',2);
        for(let i=0;i<6;i++) {
          const x=(i-2.5)*9,reach=35+curl*35;
          ctx.beginPath();ctx.moveTo(x,13);ctx.quadraticCurveTo(x-20,-reach*.4,x+Math.sin(i)*18,-reach);
          ctx.strokeStyle=i%2?'#80c79b':'#3d9478';ctx.lineWidth=4*(1-progress)+2;ctx.stroke();
          ellipse(ctx,x+Math.sin(i)*18,-reach,4,8,'#a2d2a2');
        }
        for(let i=0;i<7;i++)ellipse(ctx,Math.sin(i*2)*(12+progress*34),-Math.sin(progress*Math.PI)*(25+i*5),
          3*(1-progress)+1,4*(1-progress)+1,'#d7fff0');
      } else if(type==='lilyPower') {
        ellipse(ctx,0,3,33+progress*11,14+progress*5,'#def7c12b','#e7ffcc',2.5);
        for(let i=0;i<8;i++)sparkle(ctx,Math.cos(i*TAU/8)*33,-15+Math.sin(i*TAU/8)*26,5*(1-progress)+1,'#f3ffdb');
      } else if(type==='mineArm') {
        const radius=this.reducedMotion?24:12+progress*22;
        ellipse(ctx,0,10,radius,radius*.28,null,'#ffe0a1',2*(1-progress)+.5);
        for(let i=0;i<5;i++) {
          const x=(i-2)*(6+progress*4),rise=this.reducedMotion?0:Math.sin(progress*Math.PI)*(9+i%2*6);
          ellipse(ctx,x,7-rise,3*(1-progress)+1.2,2,'#c29862');
        }
        sparkle(ctx,19,-24,6*(1-progress)+2,'#fff0b5');
      } else if(type==='mineExplosion') {
        // A flat shockwave reads as a ground trap and stays inside its single damage lane.
        const reach=Math.max(32,finite(effect.radius,.8)*g.cellWidth/scale);
        const spread=this.reducedMotion?.75:1-Math.pow(1-progress,3),r=12+reach*spread;
        ellipse(ctx,0,9,r,8+progress*7,'#ddb47e49','#ffedbd',3*(1-progress)+.5);
        const flash=this.reducedMotion?.32:Math.max(0,1-progress*2.5);
        if(flash>0) {
          ctx.save();ctx.globalAlpha*=flash;
          star(ctx,0,-8,34+(effect.power?9:0),'#fff7c9','#ffbb61',2);
          ellipse(ctx,0,-7,18,13,'#ffffff');ctx.restore();
        }
        for(let i=0;i<12;i++) {
          const side=i%2?1:-1,v=(i+2)/14;
          const x=side*r*(.28+v*.63),flight=this.reducedMotion?.4:progress;
          const y=9-Math.sin(flight*Math.PI)*(14+v*23)+flight*9;
          ctx.save();ctx.translate(x,y);ctx.rotate(side*flight*(2+i*.2));
          const size=(i%3)+2;
          poly(ctx,[[-size,-size*.6],[size*.3,-size],[size,size*.4],[-size*.4,size]],
            i%2?'#a47242':'#d1a570','#745235',.7);ctx.restore();
          if(i%3===0)sparkle(ctx,x*.7,y-6,4*(1-progress)+1,'#ffe3a0');
        }
        for(let i=0;i<4;i++)ellipse(ctx,(i-1.5)*r*.4,12-progress*9,
          (6+progress*13)*(1-progress),3+progress*3,'#e0c3907d');
      } else if(type==='cartMove') {
        for(let i=0;i<5;i++)ellipse(ctx,(i-2)*(6+progress*7),15-progress*9,
          4*(1-progress)+1,2*(1-progress)+1,'#efdab2');
      } else if(type==='power'||effect.kind==='power') {
        const plantType=effect.plantType || (effect.kind==='power'?type:'shooter');
        const color=LOOKS[plantType]?.color || '#d8ee96';
        const radius=this.reducedMotion?39:19+progress*54;
        ellipse(ctx,0,8,radius,radius*.35,'#e5ffc226','#e9ffd1',2.5);
        ellipse(ctx,0,-18,radius*.7,radius*.85,null,color,2);
        for(let i=0;i<9;i++) {
          const a=i*TAU/9,rr=radius*(i%2?.85:1.1);
          sparkle(ctx,Math.cos(a)*rr,-18+Math.sin(a)*rr*.8,4+(1-progress)*5,'#fbffe4');
        }
        if(plantType==='ice')for(let i=0;i<6;i++)sparkle(ctx,(i-2.5)*17,-45-i%2*17,8,'#cefbff');
        else if(plantType==='lightning')bolt(ctx,0,-37,25,'#f6eaff');
        else if(plantType==='sun')star(ctx,0,-37,22,'#fff5b0','#e3b94f',1);
      } else if(type==='flame') {
        const radius=Math.max(20,finite(effect.radius,1)*70);
        ellipse(ctx,0,8,radius,radius*.28,'#ffad4c3b','#ffce75',1.5);
        for(let i=0;i<5;i++) {
          const x=(i-2)*radius*.35;
          flame(ctx,x,4,12+(i%2)*5+(effect.power?5:0),time+i,this.reducedMotion);
        }
      } else if(type==='armLost') {
        const fall=this.reducedMotion?1:progress;
        ctx.save();
        if(photo) {
          const pivot=photo.info.rig.nearArm.pivot;
          ctx.translate((pivot[0]-.5)*photo.width-fall*19,(pivot[1]-1)*photo.height+photoBaseline-Math.sin(fall*Math.PI)*12+fall*35);
          ctx.rotate(.55+fall*2.1);this._photoLoosePart(ctx,photo,'nearArm');
        } else {
          ctx.translate(-14-fall*19,-16-Math.sin(fall*Math.PI)*12+fall*30);
          ctx.rotate(.2+fall*2.1);visitorLooseArm(ctx,effect.enemyType);
        }
        ctx.restore();
        if(progress>.58)ellipse(ctx,-30,15,8+progress*8,2,'#e8ddbc8c');
      } else if(type==='armorBreak') {
        const anchor=photo?this._photoHeadPosition(photo):{x:12,y:-47};
        ctx.save();ctx.translate(anchor.x+progress*31,anchor.y+(photo?photoBaseline:0)-Math.sin(progress*Math.PI)*21+progress*43);
        ctx.rotate(.2+progress*2.5);if(photo)ctx.scale(anchor.armorScale,anchor.armorScale);
        visitorArmor(ctx,effect.enemyType || 'helmet',0);ctx.restore();
        for(let i=0;i<3;i++)sparkle(ctx,-7+i*10,-40-progress*20,4*(1-progress),'#f9e9ba');
      } else if(type==='headless') {
        ctx.save();
        if(photo) {
          const pivot=photo.info.rig.head.pivot;
          ctx.translate((pivot[0]-.5)*photo.width-progress*29,(pivot[1]-1)*photo.height+photoBaseline-Math.sin(progress*Math.PI)*18+progress*55);
          ctx.rotate(-progress*2.7);this._photoLoosePart(ctx,photo,'head');
        } else {
          ctx.translate(-12-progress*29,-35-Math.sin(progress*Math.PI)*18+progress*39);
          ctx.rotate(-progress*2.7);visitorHead(ctx);
        }
        ctx.restore();
        if(progress>.45)ellipse(ctx,-12-progress*29,13,7+progress*7,2,'#e8ddbc8c');
      } else if(type==='vault' || type==='land') {
        ellipse(ctx,0,14,9+progress*22,3+progress*6,null,'#eee8be',2);
        for(let i=0;i<4;i++)ellipse(ctx,(i-1.5)*(7+progress*8),12-progress*9,3*(1-progress)+1,2,'#dbd1a0');
      } else if(/bomb|explosion|explode|blast/.test(type)) {
        const r=20+progress*95;
        ellipse(ctx,0,0,r,r*.75,'#f7c35f48','#ffe9a8',4*(1-progress)+1);
        for(let i=0;i<12;i++) {
          const a=i*TAU/12,rr=r*(i%2?.8:1.1);
          sparkle(ctx,Math.cos(a)*rr,Math.sin(a)*rr*.7,12*(1-progress)+3,i%2?'#f5a455':'#fff3c3');
        }
      } else if(/death|defeat|kill/.test(type)) {
        const thrown=effect.source==='bomb'||effect.source==='mine'||effect.source==='mower';
        const drop=this.reducedMotion?1:1-Math.pow(1-clamp(progress*1.45,0,1),2);
        ctx.globalAlpha=clamp((1-progress)*2,0,1);
        ctx.save();ctx.translate(thrown?drop*18:0,(photo?photoBaseline:12)+(thrown?-Math.sin(progress*Math.PI)*20:0));
        ctx.rotate((thrown?1.85:1.48)*drop);ctx.scale(1,1-drop*.08);
        if(photo)this._photoPose(ctx,photo,{...effect,type:effect.enemyType},{stride:0,reach:0,bite:0});
        else visitorFallenBody(ctx,effect);
        ctx.restore();
        if(progress>.25||this.reducedMotion)for(let i=0;i<6;i++) {
          const a=i*TAU/6,spread=clamp((progress-.25)/.75,0,1);
          ellipse(ctx,16+Math.cos(a)*(8+spread*26),14+Math.sin(a)*(3+spread*5),
            (5+spread*5)*(1-progress)+1,3*(1-progress)+1,'#e8d59dbd');
        }
      } else if(/plant|spawn/.test(type)) {
        ellipse(ctx,0,10,12+progress*25,4+progress*8,null,'#f5edb9',2);
        for(let i=0;i<5;i++)sparkle(ctx,Math.sin(i*2)*24,-8-progress*28+i*3,4,'#e5f2af');
      } else if(/sun|collect/.test(type)) {
        sparkle(ctx,0,-progress*22,15*(1-progress)+3,'#fff2a2');
        if(effect.value)label(ctx,`+${effect.value}`,0,-25-progress*15,13,'#fff6be',800);
      } else {
        const ice=/ice|freeze/.test(type);
        for(let i=0;i<5;i++) {
          const a=i*TAU/5;line(ctx,Math.cos(a)*7,Math.sin(a)*7,Math.cos(a)*(15+progress*13),
            Math.sin(a)*(15+progress*13),ice?'#d5f6ff':'#faf0b0',2.5*(1-progress)+.5);
        }
      }
      ctx.restore();
    }

    render(state = {}, options = {}) {
      const ctx=this.ctx;if(!ctx)return;
      this.setRows(state.rows || state.level?.rows || 5);
      this.waterRows=state.waterRows || state.level?.waterRows || [];
      this.tracks=state.level?.tracks || state.tracks || [];
      this.worldTheme=state.level?.theme || state.level?.chapter || 'garden';
      const intro=Number.isFinite(options.introProgress)?clamp(options.introProgress,0,1):null;
      const frameTime=state.status==='paused'?finite(state.elapsed):finite(options.time,finite(state.elapsed));
      const time=this.reducedMotion?0:finite(intro!==null?options.introTime:undefined,frameTime)/1000;
      const g=this.geometry;
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
      ctx.save();
      if(intro!==null&&!this.reducedMotion) {
        const settle=1-Math.pow(1-intro,3),zoom=1+.08*(1-settle);
        ctx.translate(this.width*.5,this.height*.5);
        ctx.scale(zoom,zoom);
        ctx.translate(-this.width*.5-this.width*.025*(1-settle),-this.height*.5);
      }
      this._drawTerrain(ctx,this.worldTheme);
      this._gardenLife(ctx,time);
      this._waterLife(ctx,time);
      if(options.preparation) {
        for(const cart of state.carts || [])this._cart(ctx,cart,time);
        this._preparationVisitors(ctx,state,time);
        ctx.restore();return;
      }
      const activeRows = state.activeRows || state.level?.activeRows || Array.from({length:this.rows},(_,row)=>row);
      for (let row=0;row<this.rows;row++) if (!activeRows.includes(row)) {
        ctx.fillStyle='#c4b48ce8';
        ctx.fillRect(g.left,g.top+row*g.cellHeight,g.boardWidth,g.cellHeight);
        for(let col=0;col<9;col++) {
          const p=this._world(col+.5,row+.5);
          ellipse(ctx,p.x,p.y,Math.min(12,g.cellWidth*.2),2,'#a99a753e');
        }
      }
      const hover=options.hover;
      if(options.plantFoodSelected&&finite(state.plantFood,1)>0) {
        for(const plant of state.plants || []) {
          if(!activeRows.includes(plant.row)||finite(plant.hp,1)<=0)continue;
          const p=this._world(plant.col+.5,plant.row+.7);
          const selected=hover?.row===plant.row&&hover?.col===plant.col;
          ellipse(ctx,p.x,p.y,g.cellWidth*.42,g.cellHeight*.19,
            selected?'#f4ffb95c':'#e5ffc72e',selected?'#ffffff':'#edffd3',selected?2.8:1.8);
          const badge=this._world(plant.col+.78,plant.row+.13);
          sparkle(ctx,badge.x,badge.y,Math.max(4,g.cellWidth*.09),selected?'#ffffff':'#f1ffba');
        }
      }
      if(hover && hover.row>=0 && hover.row<this.rows && activeRows.includes(hover.row) && hover.col>=0 && hover.col<9 && (options.selected || options.shovel)) {
        const x=g.left+hover.col*g.cellWidth,y=g.top+hover.row*g.cellHeight;
        const occupied=(state.plants || []).some(p=>p.row===hover.row && p.col===hover.col &&
          (p.type!=='lily' || options.selected==='lily' || options.shovel));
        const invalid=occupied || options.placementValid===false;
        const color=options.shovel?'#efb489':invalid?'#e7aa86':'#fff2b5';
        ctx.fillStyle=options.shovel?'#cf714844':invalid?'#ca6d4844':'#f9edaf44';
        ctx.fillRect(x,y,g.cellWidth,g.cellHeight);
        round(ctx,x+1.5,y+1.5,g.cellWidth-3,g.cellHeight-3,Math.min(5,g.cellWidth*.1),null,color,2.3);
        if(options.selected&&!invalid) this._plant(ctx,{...hover,type:options.selected,hp:1,maxHp:1},time,true);
      }
      this._cartDestinations(ctx,state,options.selectedCart);
      for(let row=0;row<this.rows;row++) {
        if (!activeRows.includes(row)) continue;
        for(const cart of state.carts || [])if(cart.row===row)this._cart(ctx,cart,time,options.selectedCart===cart.id);
        for(const support of state.plants || [])if(support.row===row && support.type==='lily')this._plant(ctx,support,time);
        const mower=(state.mowers || []).find(m=>m.row===row);if(mower)this._mower(ctx,mower,time);
        const actors=[];
        for(const plant of state.plants || [])if(plant.row===row && plant.type!=='lily')actors.push({kind:'plant',value:plant,x:plant.col+.5});
        for(const enemy of state.enemies || [])if(enemy.row===row)actors.push({kind:'enemy',value:enemy,x:enemy.x});
        actors.sort((a,b)=>a.x-b.x);
        for(const actor of actors) {
          if(actor.kind==='plant') {
            const cart=(state.carts || []).find(c=>c.row===actor.value.row && c.col===actor.value.col);
            this._plant(ctx,cart?{...actor.value,drawRow:this._cartRow(cart)}:actor.value,time);
          } else this._enemy(ctx,actor.value,time);
        }
        for(const projectile of state.projectiles || []) {
          const drawRow=Number.isFinite(projectile.y)?clamp(Math.floor(projectile.y),0,this.rows-1):projectile.row;
          if(drawRow===row)this._projectile(ctx,projectile,time);
        }
      }
      for(const effect of state.effects || [])this._effect(ctx,effect,time);
      for(const sun of state.suns || [])this._sun(ctx,sun,time);
      if(intro!==null)this._introVisitors(ctx,state,intro,time);
      ctx.restore();
    }
  }

  GardenRenderer.LOOKS = Object.freeze(LOOKS);
  root.GardenRenderer=GardenRenderer;
  if(typeof module!=='undefined' && module.exports) module.exports=GardenRenderer;
})(typeof window!=='undefined'?window:globalThis);
