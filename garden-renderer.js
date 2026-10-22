(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = '#34402b';
  const FONT = '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif';
  const LOOKS = {
    sun: { photo: 1, color: '#ffcf56', dark: '#aa712f', symbol: '☀' },
    shooter: { photo: 3, color: '#9fd560', dark: '#46732c', symbol: '•' },
    wall: { photo: 5, color: '#d7a87b', dark: '#825942', symbol: '盾' },
    ice: { photo: 7, color: '#9ce3f2', dark: '#3d8ca1', symbol: '❄' },
    burst: { photo: 9, color: '#b8adf0', dark: '#6b629c', symbol: '••' },
    bomb: { photo: 11, color: '#fa9674', dark: '#b84b36', symbol: '✦' },
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
  function visitorArmor(ctx, type) {
    if (['brute','bucket'].includes(type)) {
      // A battered garden pail is separate from the head so it can fall away.
      poly(ctx,[[-19,-8],[-16,-38],[15,-38],[21,-8]],'#a8b6b7','#637a7d',2);
      ellipse(ctx,-.5,-38,15.5,4,'#d4dcda','#637a7d',1.5);
      round(ctx,-22,-10,46,6,2,'#bdc9c6','#637a7d',1.5);
      line(ctx,-10,-32,-12,-14,'#e5ece3',3);
      line(ctx,9,-30,13,-15,'#859da0',2);
      ctx.beginPath();ctx.moveTo(-18,-25);ctx.quadraticCurveTo(0,-10,19,-25);
      ctx.strokeStyle='#698286';ctx.lineWidth=2;ctx.stroke();
      ellipse(ctx,-18,-25,2,2,'#536e72');ellipse(ctx,19,-25,2,2,'#536e72');
    } else {
      poly(ctx,[[-18,-10],[-5,-48],[6,-48],[20,-10]],'#ee994d','#aa603a',2);
      poly(ctx,[[-12,-25],[-9,-34],[10,-34],[14,-25]],'#fff1c9');
      round(ctx,-24,-12,48,7,2,'#cf753f','#aa603a',1.5);
      line(ctx,-1,-43,-11,-16,'#ffc374',2);
    }
  }

  class GardenRenderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.levels = options.levels || root.GameLevels?.levels || [];
      this.forms = options.forms || root.GardenForms || {};
      this.reducedMotion = !!options.reducedMotion;
      this.images = new Map();
      this.width = 1; this.height = 1; this.dpr = 1;
      this.terrainCanvas = null; this.terrainKey = '';
      this.geometry = this._geometry(1, 1);
      if (typeof root.Image === 'function') {
        for (const type of [...Object.keys(LOOKS), 'mower']) {
          const info = this._form(type);
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
      return this.forms[type] || this.levels[LOOKS[type]?.photo];
    }

    _geometry(width, height) {
      const left = width * .075, right = width * .045;
      const top = Math.min(height * .135, width * .09), bottom = height * .055;
      const boardWidth = width - left - right, boardHeight = height - top - bottom;
      return { left, top, right, bottom, boardWidth, boardHeight,
        cellWidth: boardWidth / 9, cellHeight: boardHeight / 5 };
    }

    resize(width, height, dpr = root.devicePixelRatio || 1) {
      this.width = Math.max(1, finite(width, 900)); this.height = Math.max(1, finite(height, 500));
      this.dpr = clamp(finite(dpr, 1), 1, 3);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.geometry = this._geometry(this.width, this.height);
      this.terrainKey = '';
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
      return col >= 0 && col < 9 && row >= 0 && row < 5 ? { row, col } : null;
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

    _terrain(ctx) {
      const w = this.width, h = this.height, g = this.geometry;
      ctx.fillStyle = '#e9e5cd'; ctx.fillRect(0, 0, w, h);
      // A warm garden wall and a small cottage edge give the field a clear home side.
      const hedge = ctx.createLinearGradient(0, 0, 0, g.top);
      hedge.addColorStop(0, '#588454'); hedge.addColorStop(1, '#91ab6b');
      ctx.fillStyle = hedge; ctx.fillRect(0, 0, w, g.top + 6);
      for (let i = 0; i < 20; i++) {
        const x = i * w / 18 - w * .03;
        ellipse(ctx, x, g.top * .12, w * .055, g.top * .68, i % 2 ? '#5f9155' : '#6f9e58');
        ellipse(ctx, x + w*.015, g.top*.03, w*.032, g.top*.31, '#86ad64');
      }
      const fenceY = g.top * .38;
      for (let i = 0; i < 31; i++) {
        const fw = w / 31, x = fw * i;
        poly(ctx, [[x+1,g.top+5],[x+1,fenceY+fw*.23],[x+fw*.45,fenceY],
          [x+fw*.9,fenceY+fw*.23],[x+fw*.9,g.top+5]], '#d9c18b', '#ae945e', Math.max(.6,w/1400));
      }
      line(ctx, 0, g.top * .83, w, g.top * .83, '#b99c65', Math.max(2,w*.004));
      ctx.fillStyle = '#b9a780'; ctx.fillRect(w - g.right - 4, g.top, g.right + 4, h - g.top);
      for (let i=0;i<15;i++) {
        const yy = g.top + i * (h-g.top) / 14;
        ellipse(ctx, w - g.right*.45 + Math.sin(i*4)*g.right*.15, yy, g.right*.16, g.right*.07, '#d5c8a7');
      }
      ctx.fillStyle = '#cab79d'; ctx.fillRect(0,g.top,g.left,g.boardHeight+g.bottom);
      for(let row=0;row<6;row++) {
        const y=g.top+row*g.cellHeight;
        line(ctx,0,y,g.left,y,'#b29c81',1);
      }
      const sill = g.left * .52;
      ctx.fillStyle='#e7d9bc'; ctx.fillRect(0,0,sill,h);
      line(ctx,sill,0,sill,h,'#a3977a',Math.max(1,w*.002));
      for (let i=0;i<8;i++) {
        const yy=g.top+i*h/7;
        line(ctx,0,yy,sill,yy,'#cdbda0',1);
      }
      // Alternating soil greens stay distinct without heavy grid outlines.
      ctx.fillStyle='#557d3b'; ctx.fillRect(g.left-3,g.top-2,g.boardWidth+6,g.boardHeight+7);
      for(let row=0;row<5;row++) for(let col=0;col<9;col++) {
        const x=g.left+col*g.cellWidth,y=g.top+row*g.cellHeight;
        ctx.fillStyle=(row+col)%2 ? '#8eb35f' : '#9dbc69';
        ctx.fillRect(x,y,g.cellWidth+.5,g.cellHeight+.5);
        ctx.fillStyle=(row+col)%2 ? '#a0c173' : '#acc87b';
        ctx.fillRect(x,y,g.cellWidth,Math.max(1.2,g.cellHeight*.025));
        for(let j=0;j<4;j++) {
          const seed=(row*23+col*41+j*19), xx=x+(.12+(seed%67)/87)*g.cellWidth;
          const yy=y+(.14+((seed*17)%70)/90)*g.cellHeight;
          const z=Math.max(.65,Math.min(g.cellWidth,g.cellHeight)/70);
          line(ctx,xx-2*z,yy+2*z,xx-3*z,yy-z,'#749a4c',z);
          line(ctx,xx,yy+2*z,xx+z,yy-3*z,'#779f50',z);
          if(seed%8===0) flower(ctx,xx+3*z,yy,2*z,j%2?'#f0d36f':'#e9efc2');
        }
      }
      for(let row=1;row<5;row++) line(ctx,g.left,g.top+row*g.cellHeight,g.left+g.boardWidth,
        g.top+row*g.cellHeight,'#789c4b44',Math.max(.7,w/1100));
      for(let i=0;i<30;i++) {
        const x=g.left+i*g.boardWidth/29,y=g.top+g.boardHeight+3;
        line(ctx,x,y,x+Math.sin(i*4)*3,y+g.bottom*.3,'#729744',Math.max(1,w*.0017));
      }
      // The flower bed at the front is scenery, never an extra playable row.
      for(let i=0;i<14;i++) {
        const xx=g.left+(i+.5)*g.boardWidth/14;
        if(i%3===0) flower(ctx,xx,h-g.bottom*.31,Math.max(1.6,w*.0026),i%2?'#faf0b2':'#f7bda0');
      }
      // A compact garden sign sits above the board without obscuring any cell.
      const signW=Math.min(w*.19,150),signH=Math.max(14,g.top*.52),signX=g.left+g.boardWidth*.52;
      round(ctx,signX-signW/2,g.top*.12,signW,signH,3,'#f0dfac','#8f7246',1.3);
      label(ctx,'飞 天 花 园',signX,g.top*.12+signH*.52,Math.min(13,Math.max(8,w*.018)),'#5c6340',800);
    }

    _drawTerrain(ctx) {
      const key = `${this.width}/${this.height}/${this.dpr}`;
      if (root.document?.createElement) {
        if (!this.terrainCanvas) this.terrainCanvas = root.document.createElement('canvas');
        if (key !== this.terrainKey) {
          this.terrainCanvas.width=this.canvas.width; this.terrainCanvas.height=this.canvas.height;
          const c=this.terrainCanvas.getContext('2d');
          c.setTransform(this.dpr,0,0,this.dpr,0,0); this._terrain(c); this.terrainKey=key;
        }
        ctx.drawImage(this.terrainCanvas,0,0,this.canvas.width,this.canvas.height,0,0,this.width,this.height);
      } else this._terrain(ctx);
    }

    _plant(ctx, plant, time, ghost = false) {
      const g=this.geometry, look=LOOKS[plant.type] || LOOKS.shooter;
      const p=this._world(plant.col+.5,plant.row+.66);
      const scale=Math.min(g.cellWidth/70,g.cellHeight/76);
      const pulse=clamp(finite(plant.attackPulse)/180,0,1);
      const idle=this.reducedMotion ? 0 : Math.sin(time*2.6+plant.col*.8+plant.row)*.025;
      ctx.save(); ctx.translate(p.x,p.y); ctx.scale(scale,scale);
      if(ghost) ctx.globalAlpha=.53;
      ellipse(ctx,0,8,27,9,'#345b2d36');
      leaf(ctx,-2,5,.92,1); leaf(ctx,2,5,.92,-1,'#83b64e');
      if(plant.type==='wall') {
        round(ctx,-26,-3,52,19,5,'#bb8659','#795137',2);
        line(ctx,-18,0,-18,12,'#e4b67d',2); line(ctx,18,0,18,12,'#e4b67d',2);
      } else {
        ellipse(ctx,0,4,23,7,look.dark);
        ellipse(ctx,0,0,23,7,look.color,look.dark,1.4);
      }
      ctx.save(); ctx.translate(-pulse*2,-3-Math.abs(idle)*22);
      ctx.rotate(idle); ctx.scale(1+pulse*.08,1-pulse*.04);
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
      const info=this._form(plant.type),image=info&&this.images.get(info.image);
      if(image?.complete && image.naturalWidth) {
        const frame=info.frame || [0,0,image.naturalWidth,image.naturalHeight];
        const ratio=frame[2]/frame[3],height=Math.min(56,53/ratio),width=height*ratio;
        ctx.save(); ctx.shadowColor='#fff9e8'; ctx.shadowBlur=3; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
        ctx.drawImage(image,...frame,-width/2,-height+1,width,height); ctx.restore();
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
      ctx.restore();
      if(plant.hp<plant.maxHp) {
        round(ctx,-20,16,40,5,2,'#3f5234');
        round(ctx,-19,17,38*clamp(plant.hp/plant.maxHp,0,1),3,1,
          plant.hp/plant.maxHp<.3?'#ed9c64':'#d7e792');
      }
      ctx.restore();
    }

    _enemy(ctx, enemy, time) {
      const g=this.geometry,p=this._world(enemy.x,enemy.row+.72);
      const runner=['runner','fast'].includes(enemy.type);
      const hasPole=runner&&!enemy.headless&&(enemy.hasPole ?? (!enemy.usedPole&&!enemy.hasVaulted));
      const fast=hasPole || enemy.type==='flag';
      const armored=['helmet','armored','armor','bucket','cone','brute'].includes(enemy.type)
        && finite(enemy.armorHp,1)>0&&!enemy.headless;
      const isCold=finite(enemy.slowTime)>0,headless=!!enemy.headless;
      const vaulting=!!enemy.vaulting&&!headless;
      const vaultProgress=clamp(finite(enemy.vaultProgress),0,1);
      const jump=vaulting?Math.sin(vaultProgress*Math.PI)*49:0;
      const scale=Math.min(g.cellWidth/69,g.cellHeight/80);
      const phase=this.reducedMotion?0:time*(fast?12:5)*(isCold?.5:1)+(finite(enemy.id)*1.7 || enemy.row);
      const stride=Math.sin(phase), bob=Math.abs(stride)*(fast?2.7:1.3);
      const skin=isCold?'#a2d2ce':'#acc09a';
      const skinDark=isCold?'#5f9ba4':'#647a58';
      const eating=!headless&&!vaulting&&(enemy.eating || enemy.attacking || enemy.state==='attacking');
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
      ctx.save();ctx.translate(0,-jump);
      const walk=vaulting ? -.65 : eating ? Math.sin(phase*2)*.8 : stride;
      // Oversized boots and offset knees make the leftward shuffle readable.
      line(ctx,-9,-16,-12+walk*4,-2,'#64594d',9);
      line(ctx,9,-16,10-walk*4,-1,'#6e6252',9);
      round(ctx,-23+walk*4,-4,17,9,3,'#483f37','#37392b',1.5);
      round(ctx,1-walk*4,-3,18,9,3,'#55483b','#37392b',1.5);
      ctx.save(); ctx.translate(0,-bob); ctx.rotate(-.075);
      poly(ctx,[[-14,-38],[12,-40],[18,-17],[5,-13],[0,-19],[-12,-15],[-17,-26]],
        runner?'#a16b55':'#7d8290','#4e594b',2);
      poly(ctx,[[-2,-36],[5,-37],[7,-18],[2,-21],[-3,-17]],'#e6d4ad');
      poly(ctx,[[0,-35],[5,-35],[4,-28],[8,-21],[3,-18],[-1,-27]],fast?'#f4d775':'#b55d49');
      line(ctx,-12,-34,-26,-28+walk*1.4,'#737c75',9);
      line(ctx,-26,-28+walk*1.4,-35,-30+walk*1.4,skin,7);
      line(ctx,10,-34,-6,-23,'#727e72',8);
      line(ctx,-6,-23,-21,-24,skin,7);
      for(let i=0;i<3;i++) line(ctx,-35,-32+i*2.2,-41,-32+i*2.5,skinDark,1.1);
      if(enemy.type==='flag') {
        line(ctx,16,0,16,-82,'#697750',2.7);
        poly(ctx,[[17,-80],[42,-77],[38,-65],[43,-52],[17,-56]],'#cc6a53','#914e3c',1.5);
        sparkle(ctx,29,-66,6,'#f5dfa1');
        ellipse(ctx,16,-83,3,3,'#e9d088');
      }
      if(!headless) {
        ctx.save(); ctx.translate(-3,-49); ctx.rotate(Math.sin(phase*.55)*.04);
        visitorHead(ctx,skin,skinDark,eating?Math.sin(phase*2):0);
        if(armored) visitorArmor(ctx,enemy.type);
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
      const hit=clamp(finite(enemy.hitPulse)/180,0,1);
      if(hit>0) sparkle(ctx,-19,-40,14*hit,'#fff4ae');
      if(enemy.hp<enemy.maxHp || armored) {
        const y=headless?-47:armored?-102:-74;
        round(ctx,-18,y,36,4,2,'#445342b0');
        round(ctx,-17,y+1,34*clamp(enemy.hp/enemy.maxHp,0,1),2,1,'#f1d08a');
      }
      ctx.restore();ctx.restore();
    }

    _mower(ctx,mower,time) {
      if(mower.enabled===false || mower.used&&!mower.active)return;
      const g=this.geometry,p=this._world(mower.active ? mower.x : -.37,mower.row+.72);
      const s=Math.min(g.cellWidth/72,g.cellHeight/80);
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
      ellipse(ctx,0,6,16,5,'#33472d44');
      line(ctx,-9,-3,-17,-21,'#62715c',2); line(ctx,-17,-21,-7,-22,'#394b37',3);
      ellipse(ctx,-10,4,5,5,'#454a3c','#29382d',1.5);ellipse(ctx,11,4,5,5,'#454a3c','#29382d',1.5);
      round(ctx,-16,-9,31,11,4,'#c97c52','#8f573b',1.5);
      round(ctx,-7,-17,15,9,3,'#e1a667','#9d7045',1.5);
      line(ctx,-2,-15,4,-15,'#f8d5a0',1.7);
      const info=this._form('mower'),image=info&&this.images.get(info.image);
      if(image?.complete && image.naturalWidth) {
        const frame=info.frame || [0,0,image.naturalWidth,image.naturalHeight];
        const ratio=frame[2]/frame[3],height=Math.min(47,44/ratio),width=height*ratio;
        ctx.save();ctx.shadowColor='#fff5dc';ctx.shadowBlur=2;
        ctx.drawImage(image,...frame,-width/2,-10-height,width,height);ctx.restore();
      }
      if(mower.active)for(let i=0;i<3;i++)line(ctx,-24-i*4,-7+i*5,-32-i*4,-7+i*5,'#f4e0a4',2);
      ctx.restore();
    }

    _projectile(ctx,projectile) {
      const p=this._world(projectile.x,projectile.row+.44),g=this.geometry;
      const r=Math.max(3.2,Math.min(g.cellWidth*.105,7));
      const ice=projectile.type==='ice',burst=projectile.type==='burst';
      const color=ice?'#c6f6ff':burst?'#e1d9ff':'#e5f6a7';
      line(ctx,p.x-r*3.4,p.y,p.x-r,p.y,ice?'#a9e5f46b':burst?'#c1b1e97a':'#cfeb8b7d',r*.85);
      ellipse(ctx,p.x,p.y,r,r,color,ice?'#65adbf':burst?'#8e7ab7':'#638d3c',Math.max(.8,r*.18));
      ellipse(ctx,p.x-r*.25,p.y-r*.3,r*.34,r*.3,'#ffffffc9');
    }

    _sun(ctx,sun,time) {
      const p=this._world(sun.x,sun.y),g=this.geometry;
      const r=Math.max(12,Math.min(g.cellWidth*.29,22));
      const blink=finite(sun.life,10000)<2000 ? .65+.35*Math.sin(time*9) : 1;
      ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=blink;
      const glow=ctx.createRadialGradient(0,0,r*.3,0,0,r*1.9);
      glow.addColorStop(0,'#fff8ba8c');glow.addColorStop(1,'#fff8ba00');
      ctx.fillStyle=glow;ctx.fillRect(-r*2,-r*2,r*4,r*4);
      ctx.save();ctx.rotate(this.reducedMotion?0:time*.25);
      for(let i=0;i<8;i++) {
        const a=i*TAU/8;ctx.save();ctx.rotate(a);
        poly(ctx,[[r*.92,-r*.18],[r*1.42,0],[r*.92,r*.18]],'#f6ce58','#d79b39',.8);ctx.restore();
      }
      ctx.restore();ellipse(ctx,0,0,r,r,'#ffe583','#d5a33d',1.5);
      ellipse(ctx,-r*.15,-r*.19,r*.68,r*.65,'#ffec9b');
      label(ctx,sun.value || 25,0,1,Math.max(10,r*.7),'#916424',800);ctx.restore();
    }

    _effect(ctx,effect,time) {
      const g=this.geometry,p=this._world(effect.x,finite(effect.y,finite(effect.row)+.55));
      const life=finite(effect.life,0),max=Math.max(.01,finite(effect.maxLife,life || 1));
      const progress=clamp(1-life/max,0,1),scale=Math.min(g.cellWidth/70,g.cellHeight/76);
      const type=effect.type || '';
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);ctx.globalAlpha=1-progress;
      if(type==='armorBreak') {
        ctx.save();ctx.translate(12+progress*31,-47-Math.sin(progress*Math.PI)*21+progress*43);
        ctx.rotate(.2+progress*2.5);visitorArmor(ctx,effect.enemyType || 'helmet');ctx.restore();
        for(let i=0;i<3;i++)sparkle(ctx,-7+i*10,-40-progress*20,4*(1-progress),'#f9e9ba');
      } else if(type==='headless') {
        ctx.save();ctx.translate(-12-progress*29,-35-Math.sin(progress*Math.PI)*18+progress*39);
        ctx.rotate(-progress*2.7);visitorHead(ctx);ctx.restore();
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
        for(let i=0;i<6;i++) {
          const a=i*TAU/6;
          ellipse(ctx,Math.cos(a)*(8+progress*30),Math.sin(a)*(6+progress*18),4*(1-progress)+1,3,'#e4ddb6');
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
      const time=this.reducedMotion?0:finite(options.time,finite(state.elapsed))/1000;
      const g=this.geometry;
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
      this._drawTerrain(ctx);
      const activeRows = state.activeRows || state.level?.activeRows || [0,1,2,3,4];
      for (let row=0;row<5;row++) if (!activeRows.includes(row)) {
        ctx.fillStyle='#c4b48ce8';
        ctx.fillRect(g.left,g.top+row*g.cellHeight,g.boardWidth,g.cellHeight);
        for(let col=0;col<9;col++) {
          const p=this._world(col+.5,row+.5);
          ellipse(ctx,p.x,p.y,Math.min(12,g.cellWidth*.2),2,'#a99a753e');
        }
      }
      const hover=options.hover;
      if(hover && hover.row>=0 && hover.row<5 && activeRows.includes(hover.row) && hover.col>=0 && hover.col<9 && (options.selected || options.shovel)) {
        const x=g.left+hover.col*g.cellWidth,y=g.top+hover.row*g.cellHeight;
        const occupied=(state.plants || []).some(p=>p.row===hover.row && p.col===hover.col);
        const color=options.shovel?'#efb489':occupied?'#e7aa86':'#fff2b5';
        ctx.fillStyle=options.shovel?'#cf714844':occupied?'#ca6d4844':'#f9edaf44';
        ctx.fillRect(x,y,g.cellWidth,g.cellHeight);
        round(ctx,x+1.5,y+1.5,g.cellWidth-3,g.cellHeight-3,Math.min(5,g.cellWidth*.1),null,color,2.3);
        if(options.selected&&!occupied) this._plant(ctx,{...hover,type:options.selected,hp:1,maxHp:1},time,true);
      }
      for(let row=0;row<5;row++) {
        if (!activeRows.includes(row)) continue;
        const mower=(state.mowers || []).find(m=>m.row===row);if(mower)this._mower(ctx,mower,time);
        const actors=[];
        for(const plant of state.plants || [])if(plant.row===row)actors.push({kind:'plant',value:plant,x:plant.col+.5});
        for(const enemy of state.enemies || [])if(enemy.row===row)actors.push({kind:'enemy',value:enemy,x:enemy.x});
        actors.sort((a,b)=>a.x-b.x);
        for(const actor of actors)actor.kind==='plant'?this._plant(ctx,actor.value,time):this._enemy(ctx,actor.value,time);
        for(const projectile of state.projectiles || [])if(projectile.row===row)this._projectile(ctx,projectile);
      }
      for(const effect of state.effects || [])this._effect(ctx,effect,time);
      for(const sun of state.suns || [])this._sun(ctx,sun,time);
    }
  }

  GardenRenderer.LOOKS = Object.freeze(LOOKS);
  root.GardenRenderer=GardenRenderer;
  if(typeof module!=='undefined' && module.exports) module.exports=GardenRenderer;
})(typeof window!=='undefined'?window:globalThis);
