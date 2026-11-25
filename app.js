(() => {
  // ---------- Setup ----------
  const W = 360, H = 540;            // logical game size
  const WIN_SCORE = 20;
  const MAX_LIVES = 3;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  // Crisp rendering on high-DPI / mobile screens
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ---------- State ----------
  let state = 'ready';               // ready | playing | won | lost
  let score, lives, items, spawnTimer, lastTime, elapsed;
  let best = 0;
  try { best = parseInt(localStorage.getItem('starCatcherBest'), 10) || 0; } catch (e) {}
  bestEl.textContent = best;

  const player = { x: W / 2, y: H - 40, w: 76, h: 14, targetX: W / 2 };
  const keys = { left: false, right: false };

  // ---------- Game flow ----------
  function resetGame() {
    score = 0;
    lives = MAX_LIVES;
    items = [];
    spawnTimer = 0;
    elapsed = 0;
    player.x = player.targetX = W / 2;
    updateHud();
  }

  function startGame() {
    resetGame();
    state = 'playing';
    overlay.classList.add('hidden');
    overlay.classList.remove('win', 'lose');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame(won) {
    state = won ? 'won' : 'lost';
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem('starCatcherBest', best); } catch (e) {}
    }
    overlay.classList.remove('hidden', 'win', 'lose');
    overlay.classList.add(won ? 'win' : 'lose');
    overlayTitle.textContent = won ? '🎉 You Win!' : '💥 Game Over';
    overlayText.innerHTML = won
      ? `You caught ${score} stars!<br>Final score: <b>${score}</b>`
      : `You hit too many bombs.<br>Final score: <b>${score}</b> / ${WIN_SCORE}`;
    startBtn.textContent = 'Play Again';
  }

  function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = '❤'.repeat(lives) + '🖤'.repeat(MAX_LIVES - lives);
  }

  // ---------- Spawning ----------
  function spawnItem() {
    const isBomb = Math.random() < Math.min(0.25 + elapsed * 0.004, 0.5);
    const r = isBomb ? 14 : 13;
    items.push({
      x: r + Math.random() * (W - r * 2),
      y: -r,
      r,
      bomb: isBomb,
      speed: 120 + Math.random() * 60 + elapsed * 3, // gets faster over time
      spin: Math.random() * Math.PI * 2
    });
  }

  // ---------- Update ----------
  function update(dt) {
    elapsed += dt;

    // Player movement
    const kbSpeed = 340;
    if (keys.left)  player.targetX -= kbSpeed * dt;
    if (keys.right) player.targetX += kbSpeed * dt;
    player.targetX = Math.max(player.w / 2, Math.min(W - player.w / 2, player.targetX));
    player.x += (player.targetX - player.x) * Math.min(1, dt * 18);

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      spawnTimer = Math.max(0.35, 0.9 - elapsed * 0.012);
    }

    // Move + collide
    const px1 = player.x - player.w / 2, px2 = player.x + player.w / 2;
    const py1 = player.y - player.h / 2, py2 = player.y + player.h / 2;

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.speed * dt;
      it.spin += dt * 3;

      // circle vs rectangle
      const cx = Math.max(px1, Math.min(it.x, px2));
      const cy = Math.max(py1, Math.min(it.y, py2));
      const dx = it.x - cx, dy = it.y - cy;
      if (dx * dx + dy * dy <= it.r * it.r) {
        items.splice(i, 1);
        if (it.bomb) {
          lives--;
        } else {
          score++;
        }
        updateHud();
        if (score >= WIN_SCORE) return endGame(true);
        if (lives <= 0) return endGame(false);
        continue;
      }

      if (it.y - it.r > H) items.splice(i, 1); // fell off screen
    }
  }

  // ---------- Drawing ----------
  function drawStar(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 0.3);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd54a';
    ctx.shadowColor = '#ffd54a';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  function drawBomb(x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2b33';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff6b6b';
    ctx.stroke();
    // fuse
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, y - r * 0.8);
    ctx.lineTo(x + r * 0.9, y - r * 1.4);
    ctx.strokeStyle = '#bbb';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.95, y - r * 1.5, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9f43';
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Paddle
    ctx.fillStyle = '#6dd5ff';
    roundRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, 7);
    ctx.fill();

    // Items
    for (const it of items) {
      if (it.bomb) drawBomb(it.x, it.y, it.r);
      else drawStar(it.x, it.y, it.r, it.spin);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Main loop ----------
  function loop(now) {
    if (state !== 'playing') { draw(); return; }
    const dt = Math.min((now - lastTime) / 1000, 0.05); // clamp to avoid jumps after tab switch
    lastTime = now;
    update(dt);
    draw();
    if (state === 'playing') requestAnimationFrame(loop);
    else draw();
  }

  // ---------- Input ----------
  function pointerToX(e) {
    const rect = canvas.getBoundingClientRect();
    return (e.clientX - rect.left) * (W / rect.width);
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    player.targetX = pointerToX(e);
  });
  canvas.addEventListener('pointermove', e => {
    if (state === 'playing') player.targetX = pointerToX(e);
  });

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { keys.left = true; e.preventDefault(); }
    if (k === 'arrowright' || k === 'd') { keys.right = true; e.preventDefault(); }
    if ((k === 'enter' || k === ' ') && state !== 'playing' && document.activeElement.tagName !== 'BUTTON') {
      e.preventDefault();
      startGame();
    }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    if (k === 'arrowright' || k === 'd') keys.right = false;
  });

  // Pause automatically if the tab/app is hidden (prevents unfair losses)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state === 'playing') lastTime = performance.now();
  });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  // Initial render
  resetGame();
  draw();
})();