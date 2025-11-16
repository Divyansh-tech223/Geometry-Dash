// game.js — Advanced Geometry Dash (HTML5 canvas)
// No external libraries. Drop into same folder as index.html + style.css.

(() => {
  // ---- Config ----
  const CANVAS = document.getElementById('game');
  const ctx = CANVAS.getContext('2d', { alpha: false });
  let W = 1280, H = 720;            // internal resolution (will scale)
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const groundHeight = 110;
  const PLAYER_SIZE = 48;
  const GRAVITY = 0.9;
  const JUMP_VELOCITY = -18;
  const FRAME_TARGET = 60;

  // UI elements
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const bestEl  = document.getElementById('best');
  const pauseBtn = document.getElementById('btn-pause');
  const restartBtn = document.getElementById('btn-restart');
  const overlay = document.getElementById('overlay');
  const overlayStart = document.getElementById('overlay-start');
  const overlayClose = document.getElementById('overlay-close');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const holdCheckbox = document.getElementById('hold-jump');

  // Audio: small WebAudio utility for effects
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audio = new AudioCtx();
  function beep(freq=440, time=0.06, type='sine', gain=0.12){
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audio.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + time);
    o.stop(audio.currentTime + time + 0.01);
  }

  // ---- Game State ----
  let running = false;
  let paused = false;
  let last = performance.now();
  let dtAccumulator = 0;
  let score = 0;
  let best = Number(localStorage.getItem('gd_best') || 0);
  bestEl.textContent = `Best: ${best}`;
  let level = 1;
  let speed = 8;
  let difficultyTick = 0;

  // player
  const player = {
    x: 180,
    y: 0,
    vy: 0,
    w: PLAYER_SIZE,
    h: PLAYER_SIZE,
    alive: true,
    onGround: false,
    color: '#06b6d4',
  };

  // obstacles
  let obstacles = [];
  let spawnTimer = 0;
  const patterns = [
    // arrays of relative x offsets for obstacles
    [0],
    [0, 220],
    [0, 140, 280],
    [0, 80, 160, 240],
    [0, 0, 120], // tall stacks
  ];

  // parallax backgrounds: layers with speed multiplier and simple shapes
  const bgLayers = [
    { speedMul: 0.15, color: '#071428', items: [] },
    { speedMul: 0.35, color: '#0b2536', items: [] },
    { speedMul: 0.7, color: '#123447', items: [] }
  ];

  // responsive canvas setup
  function resizeCanvas(){
    const rect = CANVAS.getBoundingClientRect();
    // choose internal resolution keeping aspect ratio
    const aspect = 16/9;
    let targetW = Math.max(800, rect.width * pixelRatio);
    W = Math.round(targetW);
    H = Math.round(W / aspect);
    CANVAS.width = W;
    CANVAS.height = H;
    CANVAS.style.width = `${rect.width}px`;
    CANVAS.style.height = `${rect.width / aspect}px`;
    ctx.imageSmoothingEnabled = false;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // init
  function resetGame(){
    player.y = H - groundHeight - player.h;
    player.vy = 0;
    player.alive = true;
    player.onGround = true;
    obstacles = [];
    spawnTimer = 30;
    score = 0;
    level = 1;
    speed = 8;
    difficultyTick = 0;
    scoreEl.textContent = `Score: ${score}`;
    levelEl.textContent = `Level: ${level}`;
    overlay.classList.add('hidden');
    running = true;
    paused = false;
  }

  // spawn utilities
  function spawnPattern(pat){
    // pat: array of offsets -> spawn obstacles with slight variation (some tall, some gaps)
    const baseX = W + 200;
    for(let off of pat){
      const typeRoll = Math.random();
      if(typeRoll < 0.2){
        // tall spike (narrow tall)
        obstacles.push({x: baseX + off + Math.random()*20, w: 36, h: 140 + Math.random()*80, type:'tall'});
      } else if(typeRoll < 0.45){
        // high gap platform (short)
        obstacles.push({x: baseX + off + Math.random()*20, w: 60, h: 60 + Math.random()*40, type:'block'});
      } else {
        // small spike
        obstacles.push({x: baseX + off + Math.random()*20, w: 44, h: 100 + Math.random()*50, type:'spike'});
      }
    }
  }

  // update
  function update(dt){
    if(!running || paused) return;

    // player physics
    player.vy += GRAVITY;
    player.y += player.vy;
    const floorY = H - groundHeight - player.h;
    if(player.y >= floorY){
      player.y = floorY;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // obstacles update
    for(let o of obstacles){
      o.x -= speed;
    }
    obstacles = obstacles.filter(o => o.x + o.w > -200);

    // spawn logic
    spawnTimer -= 1 + Math.floor(speed/4);
    if(spawnTimer <= 0){
      const p = patterns[Math.floor(Math.random() * patterns.length)];
      spawnPattern(p);
      spawnTimer = Math.floor(80 + Math.random()*120 - speed*3);
      if(spawnTimer < 30) spawnTimer = 30;
    }

    // collisions
    for(let o of obstacles){
      const px = player.x, py = player.y, pw = player.w, ph = player.h;
      const ox = o.x, oy = H - groundHeight - o.h, ow = o.w, oh = o.h;
      if(px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy){
        // simple collision
        player.alive = false;
        running = false;
        beep(140,0.12,'sawtooth',0.18);
        overlayTitle.textContent = 'Game Over';
        overlayMsg.textContent = `Final Score: ${Math.floor(score)} — Level ${level}`;
        overlay.classList.remove('hidden');
        overlayStart.textContent = 'Play Again';
        // update best
        if(Math.floor(score) > best){
          best = Math.floor(score);
          localStorage.setItem('gd_best', best);
          bestEl.textContent = `Best: ${best}`;
        }
        return;
      }
    }

    // scoring & difficulty
    score += 0.2 * (speed/6);
    difficultyTick += Math.floor(score);
    scoreEl.textContent = `Score: ${Math.floor(score)}`;
    // level up every 200 points
    const newLevel = Math.floor(score / 200) + 1;
    if(newLevel > level){
      level = newLevel;
      speed += 1.2;
      levelEl.textContent = `Level: ${level}`;
      // fun beep on level up
      beep(400 + level*20, 0.06, 'triangle', 0.08);
    }
  }

  // draw ground and parallax
  function draw(){
    // background
    ctx.fillStyle = '#07101a';
    ctx.fillRect(0,0,W,H);

    // parallax layers (simple rectangles as distant shapes)
    for(let i=0;i<bgLayers.length;i++){
      const layer = bgLayers[i];
      ctx.fillStyle = layer.color;
      // keep some repeating rectangles as distant platforms
      if(layer.items.length === 0){
        for(let j=0;j<10;j++){
          layer.items.push({x: j*(W/6) + Math.random()*200, y: 60 + Math.random()*80, w: 200 + Math.random()*200});
        }
      }
      for(let obj of layer.items){
        const px = (obj.x - (performance.now()/30) * layer.speedMul) % (W + obj.w) - obj.w;
        ctx.globalAlpha = 0.95 - i*0.1;
        ctx.fillRect(px, obj.y, obj.w, 20);
      }
      ctx.globalAlpha = 1;
    }

    // ground
    ctx.fillStyle = '#0f1720';
    ctx.fillRect(0, H - groundHeight, W, groundHeight);
    // decorative stripes
    for(let x=0; x<W; x+=80){
      ctx.fillStyle = '#111827';
      const offset = (performance.now()/6) % 80;
      ctx.fillRect((x + offset) % W, H - groundHeight + 20, 40, groundHeight - 30);
    }

    // obstacles
    for(let o of obstacles){
      const ox = o.x, oy = H - groundHeight - o.h;
      if(o.type === 'spike'){
        // draw spike as triangle
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.moveTo(ox, oy + o.h);
        ctx.lineTo(ox + o.w/2, oy);
        ctx.lineTo(ox + o.w, oy + o.h);
        ctx.closePath();
        ctx.fill();
      } else if(o.type === 'tall'){
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(ox, oy, o.w, o.h);
        // highlight
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(ox+6, oy+6, o.w-12, Math.min(40,o.h-12));
      } else {
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(ox, oy, o.w, o.h);
      }
    }

    // player
    ctx.fillStyle = player.color;
    roundRect(ctx, player.x, player.y, player.w, player.h, 8, true);
    // player eye / stripe
    ctx.fillStyle = '#072b2d';
    ctx.fillRect(player.x + 6, player.y + 8, player.w - 12, 8);

    // HUD small
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(18,18,260,56);
  }

  // small helper: rounded rect
  function roundRect(ctx,x,y,w,h,r,fill){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    if(fill) ctx.fill();
    else ctx.stroke();
  }

  // ---- Input ----
  let keys = {};
  function jump(){
    if(!running) return;
    if(player.onGround || holdCheckbox.checked){
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      beep(900,0.04,'sine',0.06);
    }
  }

  window.addEventListener('keydown', (e) => {
    if(e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW'){
      e.preventDefault();
      keys[e.code] = true;
      jump();
    }
    if(e.code === 'KeyP'){
      togglePause();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // mouse / touch
  CANVAS.addEventListener('mousedown', (e) => { jump(); });
  CANVAS.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, {passive:false});

  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', () => {
    resetGame();
  });

  overlayStart.addEventListener('click', () => resetGame());
  overlayClose.addEventListener('click', () => overlay.classList.add('hidden'));

  function togglePause(){
    if(!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if(!paused) { last = performance.now(); requestAnimationFrame(loop); }
  }

  // Main loop
  function loop(now){
    const dt = Math.min(34, now - last);
    last = now;
    if(!paused && running){
      update(dt/1000);
      draw();
      requestAnimationFrame(loop);
    } else if(running && !paused){
      requestAnimationFrame(loop);
    } else {
      // not running: still draw final frame
      draw();
    }
  }

  // start overlay
  overlay.classList.remove('hidden');
  overlayTitle.textContent = 'Geometry Dash (HTML5)';
  overlayMsg.textContent = 'Press Start or hit Space to begin';
  overlayStart.textContent = 'Start';

  // initial best
  bestEl.textContent = `Best: ${best}`;

  // allow starting with space too when overlay visible
  window.addEventListener('keydown', (e) => {
    if((e.code === 'Space' || e.code === 'ArrowUp') && overlay.classList.contains('hidden') === false){
      e.preventDefault();
      resetGame();
      last = performance.now();
      requestAnimationFrame(loop);
    }
  });

  // start loop if user presses start
  overlayStart.addEventListener('click', () => {
    resetGame();
    last = performance.now();
    requestAnimationFrame(loop);
  });

  // draw initial idle background
  draw();

  // expose a small API for debugging
  window.gd = {
    reset: resetGame
  };

})();
