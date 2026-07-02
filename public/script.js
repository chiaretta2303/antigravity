// Preload arcade button images to avoid delay/flicker on click
const preloadBtnUp = new Image();
preloadBtnUp.src = '/assets/arcade-button-up.png';
const preloadBtnDown = new Image();
preloadBtnDown.src = '/assets/arcade-button-down.png';

// STATE
let currentState = 'LANDING';
let easterEggClicks = 0;
let hasDiscount = false;
let skippedExperience = false;
let unlockedItems = [];
const TOTAL_ITEMS = 4;

let startGameTimeout = null;
let startBlinkInterval = null;

// DOM Elements
const screens = {
  landing: document.getElementById('screen-landing'),
  transition: document.getElementById('screen-transition'),
  bootup: document.getElementById('screen-bootup'),
  pressStart: document.getElementById('screen-press-start'),
  arcadeLoader: document.getElementById('screen-arcade-loader'),
  arcadeReveal: document.getElementById('screen-arcade-reveal'),
  gameStart: document.getElementById('screen-game-start'),
  gameplay: document.getElementById('screen-gameplay'),
  collection: document.getElementById('screen-collection'),
  arcadeCollection: document.getElementById('screen-arcade-collection')
};

function showScreen(screenKey) {
  Object.values(screens).forEach(s => {
    if (s) {
      s.classList.remove('active');
      // If we are showing the gameStart screen, immediately force-hide all other screens without transition
      if (screenKey === 'gameStart') {
        s.style.opacity = '0';
        s.style.visibility = 'hidden';
      } else {
        // Reset custom overrides for other screen transitions
        s.style.opacity = '';
        s.style.visibility = '';
      }
    }
  });

  if (screens[screenKey]) {
    screens[screenKey].classList.add('active');
    if (screenKey === 'gameStart') {
      screens[screenKey].style.opacity = '1';
      screens[screenKey].style.visibility = 'visible';
    }
  }
  
  // Keep landing page visible under transparent transition canvas
  if (screenKey === 'transition' && screens.landing) {
    screens.landing.classList.add('active');
  }
  
  // Robust CRT overlay activation and reduction logic
  const crt = document.getElementById('crt-overlay');
  if (crt) {
    const disabledScreens = ['landing', 'transition', 'arcadeLoader', 'arcadeReveal'];
    if (disabledScreens.includes(screenKey)) {
      crt.classList.remove('active');
      crt.classList.remove('reduced-crt');
    } else {
      crt.classList.add('active');
      if (screenKey === 'arcadeCollection') {
        crt.classList.add('reduced-crt');
      } else {
        crt.classList.remove('reduced-crt');
      }
    }
  }
}

// =========================================
// SCREEN 1: LANDING & EASTER EGG (Walking)
// =========================================
let pacmanX = 100;
let pacmanY = 200;
const pacmanSpeed = 2.4;
let pacmanVx = pacmanSpeed;
let pacmanVy = 0;
let pacmanSize = 38;
let pacmanScale = 1.0;
let pacmanIsJumping = false;
let pacmanJumpVal = 0;
let pacmanJumpVelocity = 0;
const pacmanGravity = 0.45;
let pacmanMouthAngle = 20;
let pacmanChompDir = 1;
let pacmanWalkingLoopActive = true;
let pacmanDirFrameCounter = 0;

function changePacmanRandomDirection() {
  const directions = [
    { vx: pacmanSpeed, vy: 0 },   // Right
    { vx: -pacmanSpeed, vy: 0 },  // Left
    { vx: 0, vy: pacmanSpeed },   // Down
    { vx: 0, vy: -pacmanSpeed }   // Up
  ];
  
  const margin = 25;
  const currentWidth = pacmanSize * pacmanScale;
  const topLimit = 120; // keep visible below top edge
  
  const validDirs = directions.filter(d => {
    const nextX = pacmanX + d.vx * 6;
    const nextY = pacmanY + d.vy * 6;
    return (
      nextX >= margin &&
      nextX + currentWidth <= window.innerWidth - margin &&
      nextY >= topLimit &&
      nextY + currentWidth <= window.innerHeight - margin
    );
  });
  
  if (validDirs.length > 0) {
    // Try to pick one that is different from current velocity to prevent backtracking unless necessary
    const diffDirs = validDirs.filter(d => d.vx !== pacmanVx || d.vy !== pacmanVy);
    const chosen = diffDirs.length > 0 
      ? diffDirs[Math.floor(Math.random() * diffDirs.length)]
      : validDirs[Math.floor(Math.random() * validDirs.length)];
      
    pacmanVx = chosen.vx;
    pacmanVy = chosen.vy;
  } else {
    // Fallback: reverse current direction
    pacmanVx = -pacmanVx;
    pacmanVy = -pacmanVy;
  }
}

function updatePacmanEasterEgg() {
  if (!pacmanWalkingLoopActive) return;

  const egg = document.getElementById('pacman-easter-egg');
  if (!egg) {
    requestAnimationFrame(updatePacmanEasterEgg);
    return;
  }

  // 1. Random direction changes - run longer straight paths (280 frames) to traverse wide screens
  pacmanDirFrameCounter++;
  if (pacmanDirFrameCounter > 280 && !pacmanIsJumping) {
    pacmanDirFrameCounter = 0;
    changePacmanRandomDirection();
  }

  // 2. Update coordinates
  pacmanX += pacmanVx;
  pacmanY += pacmanVy;

  // Viewport boundaries collision - keep within visible bounds
  const margin = 25;
  const currentWidth = pacmanSize * pacmanScale;
  const topLimit = 120;
  let hitBoundary = false;

  if (pacmanX < margin) {
    pacmanX = margin;
    hitBoundary = true;
  } else if (pacmanX + currentWidth > window.innerWidth - margin) {
    pacmanX = window.innerWidth - margin - currentWidth;
    hitBoundary = true;
  }

  if (pacmanY < topLimit) {
    pacmanY = topLimit;
    hitBoundary = true;
  } else if (pacmanY + currentWidth > window.innerHeight - margin) {
    pacmanY = window.innerHeight - margin - currentWidth;
    hitBoundary = true;
  }

  if (hitBoundary) {
    changePacmanRandomDirection();
  }

  // 3. Hop jump physics update
  if (pacmanIsJumping) {
    pacmanJumpVal += pacmanJumpVelocity;
    pacmanJumpVelocity += pacmanGravity;
    if (pacmanJumpVal >= 0) {
      pacmanJumpVal = 0;
      pacmanIsJumping = false;
    }
  }

  // 4. Chomping animation update
  pacmanMouthAngle += 3 * pacmanChompDir;
  if (pacmanMouthAngle >= 35) {
    pacmanMouthAngle = 35;
    pacmanChompDir = -1;
  } else if (pacmanMouthAngle <= 5) {
    pacmanMouthAngle = 5;
    pacmanChompDir = 1;
  }

  // Generate transparent SVG mouth path dynamically
  const path = egg.querySelector('path');
  if (path) {
    const angleRad = (pacmanMouthAngle * Math.PI) / 180;
    const x1 = 16 + 14 * Math.cos(angleRad);
    const y1 = 16 + 14 * Math.sin(angleRad);
    const x2 = 16 + 14 * Math.cos(-angleRad);
    const y2 = 16 + 14 * Math.sin(-angleRad);
    path.setAttribute('d', `M 16 16 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 14 14 0 1 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`);
  }

  // 5. Update element style layout
  const hitBoxSize = currentWidth + 40; // adds 20px transparent padding on all sides for very easy clicking
  egg.style.left = (pacmanX - 20) + 'px';
  egg.style.top = (pacmanY + pacmanJumpVal - 20) + 'px';
  egg.style.width = hitBoxSize + 'px';
  egg.style.height = hitBoxSize + 'px';

  // Keep the hint label always above the top of the hit-box (never overlapping the SVG)
  const hintLbl = egg.querySelector('.pacman-click-label');
  if (hintLbl) {
    hintLbl.style.bottom = 'calc(100% + 4px)';
    hintLbl.style.left = '50%';
  }

  // Apply visual size and transform to the SVG inside the container
  const svg = egg.querySelector('svg');
  if (svg) {
    svg.style.width = currentWidth + 'px';
    svg.style.height = currentWidth + 'px';

    // Face the correct direction based on movement
    let transformStr = '';
    if (pacmanVx > 0) {
      transformStr = 'rotate(0deg)';
    } else if (pacmanVx < 0) {
      transformStr = 'scaleX(-1)';
    } else if (pacmanVy > 0) {
      transformStr = 'rotate(90deg)';
    } else if (pacmanVy < 0) {
      transformStr = 'rotate(-90deg)';
    }
    svg.style.transform = transformStr;
  }

  requestAnimationFrame(updatePacmanEasterEgg);
}

const easterEgg = document.getElementById('pacman-easter-egg');
if (easterEgg) {
  // Move it to screen-landing so it can wander over the entire page layout
  const landingScreen = document.getElementById('screen-landing');
  if (landingScreen) {
    landingScreen.appendChild(easterEgg);
  }
  
  // Initialize dynamic fixed layout
  easterEgg.style.position = 'fixed';
  easterEgg.style.left = pacmanX + 'px';
  easterEgg.style.top = pacmanY + 'px';
  
  easterEgg.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent header/logo actions
    
    easterEggClicks++;
    
    // Update CLICCAMI countdown label
    const hintLabel = easterEgg.querySelector('.pacman-click-label');
    if (hintLabel) {
      hintLabel.textContent = `CLICCAMI (${3 - easterEggClicks})`;
    }
    
    if (easterEggClicks >= 3) {
      pacmanWalkingLoopActive = false;
      // Immediately hide the walking Pac-Man so it doesn't linger during the eating transition
      easterEgg.style.display = 'none';
      startTransition();
    } else {
      // Jump and scale up
      pacmanIsJumping = true;
      pacmanJumpVelocity = -7.5;
      pacmanScale = 1.0 + easterEggClicks * 0.65; // click 1 -> 1.65, click 2 -> 2.3

      // Retro hop sound
      try {
        blip({ freq: 360, dur: 0.12, type: 'triangle', slide: 180, vol: 0.08 });
      } catch (_) {}
    }
  });

  // Launch update loop
  requestAnimationFrame(updatePacmanEasterEgg);
}

// =========================================
// SCREEN 2: EATING TRANSITION
// =========================================
function startTransition() {
  showScreen('transition');
  const canvas = document.getElementById('transition-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const rowHeight = 120; // Height of each eaten row
  const radius = rowHeight / 2;
  const totalRows = Math.ceil(canvas.height / rowHeight);
  
  const totalDistance = totalRows * canvas.width;
  // 8 seconds * 60 fps = 480 frames
  const speed = totalDistance / 480; 

  let pacX = -radius; 
  let currentRow = 0;
  let direction = 1;
  let mouthOpen = 0;
  let mouthDir = 1;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all completed rows
    ctx.fillStyle = '#050505';
    if (currentRow > 0) {
      ctx.fillRect(0, 0, canvas.width, currentRow * rowHeight);
    }
    
    // Draw current row trail
    if (direction === 1) {
      ctx.fillRect(0, currentRow * rowHeight, pacX, rowHeight);
    } else {
      ctx.fillRect(pacX, currentRow * rowHeight, canvas.width - pacX, rowHeight);
    }

    // Draw Pac-Man
    const pacY = currentRow * rowHeight + radius;
    ctx.fillStyle = '#FFD43B';
    ctx.beginPath();
    
    let angleOffset = direction === 1 ? 0 : Math.PI;
    const mouthAngle = 0.2 * mouthOpen * Math.PI;
    
    ctx.arc(pacX, pacY, radius, angleOffset + mouthAngle, angleOffset + 2 * Math.PI - mouthAngle);
    ctx.lineTo(pacX, pacY);
    ctx.fill();

    // Update state
    pacX += speed * direction;
    mouthOpen += 0.03 * mouthDir;
    if (mouthOpen >= 1 || mouthOpen <= 0) mouthDir *= -1;

    // Row completion logic
    if (direction === 1 && pacX >= canvas.width + radius) {
      currentRow++;
      direction = -1;
      pacX = canvas.width + radius; // Start off screen right
    } else if (direction === -1 && pacX <= -radius) {
      currentRow++;
      direction = 1;
      pacX = -radius; // Start off screen left
    }

    if (currentRow < totalRows) {
      requestAnimationFrame(draw);
    } else {
      // Boot animation done → go straight to the arcade room (Three.js scene).
      // The code explosion + ghost intro are now triggered only when the user
      // enters the Pac-Man cabinet inside the arcade room.
      document.body.style.backgroundColor = '#000000';
      playBootSequence(() => {
        showScreen('arcadeReveal');
        if (typeof window.initArcadeExperience === 'function') {
          window.initArcadeExperience();
        }
      });
    }
  }

  draw();
}

// =========================================
// SCREEN 2.1: REVERSE EATING TRANSITION (REGENERATION)
// =========================================
function startReverseTransition() {
  showScreen('transition');

  // Set up the canvas and paint it solid black SYNCHRONOUSLY
  // before activating the landing page — this prevents the 1-frame flash
  // where the transparent canvas lets the landing show through.
  const canvas = document.getElementById('transition-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.style.backgroundColor = '#050505';
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // NOW it's safe to make the landing page active underneath
  if (screens.landing) {
    screens.landing.classList.add('active');
  }

  const rowHeight = 150;           // taller rows = fewer rows = faster sweep
  const radius = rowHeight / 2;
  const totalRows = Math.ceil(canvas.height / rowHeight);
  const pxPerSecond = canvas.width * 2.0; // speed: covers full width in ~500ms

  let currentRow = totalRows - 1;
  let direction = (currentRow % 2 === 0) ? -1 : 1;
  let pacX = (direction === -1) ? (canvas.width + radius) : -radius;

  let mouthAngle = 0;      // 0..1 normalized
  let mouthDir = 1;
  let lastTime = null;


  function draw(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // seconds, capped to avoid jumps
    lastTime = timestamp;

    const delta = pxPerSecond * dt;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw base black canvas
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Progressive clear/reveal using destination-out
    ctx.globalCompositeOperation = 'destination-out';
    
    // Clear fully completed rows (below current row)
    if (currentRow < totalRows - 1) {
      ctx.fillRect(0, (currentRow + 1) * rowHeight, canvas.width, canvas.height - (currentRow + 1) * rowHeight);
    }
    
    // Clear the trail Pac-Man has already swept in the current row
    if (direction === -1) {
      ctx.fillRect(pacX, currentRow * rowHeight, canvas.width - pacX, rowHeight);
    } else {
      ctx.fillRect(0, currentRow * rowHeight, pacX, rowHeight);
    }
    
    // Back to normal compositing for Pac-Man sprite
    ctx.globalCompositeOperation = 'source-over';

    // Draw Pac-Man
    const pacY = currentRow * rowHeight + radius;
    ctx.fillStyle = '#FFD43B';
    ctx.beginPath();
    const angleOffset = direction === 1 ? 0 : Math.PI;
    const mouth = 0.22 * mouthAngle * Math.PI;   // max opening: 0.22π
    ctx.arc(pacX, pacY, radius - 1, angleOffset + mouth, angleOffset + 2 * Math.PI - mouth);
    ctx.lineTo(pacX, pacY);
    ctx.fill();

    // Update position
    pacX += delta * direction;

    // Smooth mouth animation tied to distance, not frame count
    mouthAngle += mouthDir * dt * 6;   // full open/close in ~170ms
    if (mouthAngle >= 1) { mouthAngle = 1; mouthDir = -1; }
    if (mouthAngle <= 0) { mouthAngle = 0; mouthDir = 1; }

    // Row completion
    if (direction === -1 && pacX <= -radius) {
      currentRow--;
      direction = 1;
      pacX = -radius;
    } else if (direction === 1 && pacX >= canvas.width + radius) {
      currentRow--;
      direction = -1;
      pacX = canvas.width + radius;
    }

    if (currentRow >= 0) {
      requestAnimationFrame(draw);
    } else {
      // Transition complete — return to landing
      showScreen('landing');
      document.body.style.backgroundColor = '';
      
      // Reset Easter Egg state for replay
      easterEggClicks = 0;
      pacmanWalkingLoopActive = true;
      pacmanX = 100;
      pacmanY = 300;
      const egg = document.getElementById('pacman-easter-egg');
      if (egg) {
        egg.style.display = '';
        const hintLbl = egg.querySelector('.pacman-click-label');
        if (hintLbl) hintLbl.textContent = 'CLICCAMI (3)';
      }
      requestAnimationFrame(updatePacmanEasterEgg);
    }
  }

  requestAnimationFrame(draw);
}

window.startReverseTransition = startReverseTransition;

// =========================================
// SCREEN 2.3: CORRUPTED-MEMORY GLITCH BOOT
// A "broken ROM" power-on: the screen floods with garbage characters, hex
// codes and torn glitch bands — the corrupted-memory look of a glitching
// cabinet — then hands off to the press-start button. Original recreation.
// =========================================
const _GLITCH_CHARS = '0123456789ABCDEF0123456789ABCDEFGHJKLMNPRSTVWXYZ#@$%&*<>/\\=+?█▓▒░'.split('');
const _GLITCH_COLS = ['#00FFFF', '#FFD43B', '#FF0000', '#FFB8FF', '#33FF66', '#2121FF', '#FFFFFF', '#FFB852'];
const _rc = arr => arr[(Math.random() * arr.length) | 0];

function _bootCanvasSetup() {
  const canvas = document.getElementById('bootup-canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => { canvas.width = Math.floor(window.innerWidth * DPR); canvas.height = Math.floor(window.innerHeight * DPR); };
  resize();
  window.addEventListener('resize', resize);
  return { canvas, ctx, DPR, dispose: () => window.removeEventListener('resize', resize) };
}

function playBootSequence(onDone) {
  const s = _bootCanvasSetup();
  if (!s) { onDone(); return; }
  showScreen('bootup');
  const { canvas, ctx, DPR, dispose } = s;
  const FRAGMENTS = ['PAC-MAN', 'MEMORY ERR', 'RAM 0x7F3A', 'ROM FAULT', 'UNIQLO', '0xDEAD', 'SEGMENT', 'Z80 CPU', 'STACK OVF', 'BAD TILE'];
  const END_AT = 3.6;
  const start = performance.now();
  let rafId = 0, lastBeep = 0;

  function frame(now) {
    const e = (now - start) / 1000;
    const W = canvas.width, H = canvas.height;
    const intensity = Math.min(1, e / 1.0); // garbage density ramps in
    const cell = Math.max(16, Math.min(W, H) / 30);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // garbage character grid (re-randomised every frame = flicker)
    ctx.textBaseline = 'top';
    ctx.font = `${cell}px "Courier New", monospace`;
    for (let y = 0; y < H; y += cell * 1.15) {
      for (let x = 0; x < W; x += cell * 0.95) {
        if (Math.random() > 0.18 + intensity * 0.5) continue;
        ctx.fillStyle = _rc(_GLITCH_COLS);
        ctx.globalAlpha = 0.45 + Math.random() * 0.55;
        ctx.fillText(_rc(_GLITCH_CHARS), x, y);
      }
    }
    ctx.globalAlpha = 1;

    // torn horizontal glitch bands
    const bands = 2 + ((e * 9) % 4 | 0);
    for (let b = 0; b < bands; b++) {
      if (Math.random() > 0.5) continue;
      const by = Math.random() * H, bh = cell * (0.6 + Math.random() * 2.4);
      ctx.fillStyle = _rc(_GLITCH_COLS);
      ctx.globalAlpha = 0.12 + Math.random() * 0.28;
      ctx.fillRect(0, by, W, bh);
    }
    ctx.globalAlpha = 1;

    // coherent fragments flickering through the noise
    if (Math.random() < 0.32) {
      ctx.font = `bold ${cell * 1.6}px "Press Start 2P", "Courier New", monospace`;
      ctx.fillStyle = _rc(_GLITCH_COLS);
      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
      ctx.textAlign = 'center';
      ctx.fillText(_rc(FRAGMENTS), W * (0.3 + Math.random() * 0.4), H * (0.2 + Math.random() * 0.6));
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // erratic glitch beeps
    if (now - lastBeep > 90 + Math.random() * 130) {
      lastBeep = now;
      try { blip({ freq: 120 + Math.random() * 1400, dur: 0.03, type: 'square', vol: 0.04 }); } catch (_) {}
    }

    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < H; y += Math.max(2, Math.round(DPR * 2))) ctx.fillRect(0, y, W, 1);

    if (e > END_AT - 0.35) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (e - (END_AT - 0.35)) / 0.35)})`; ctx.fillRect(0, 0, W, H); }

    if (e < END_AT) rafId = requestAnimationFrame(frame);
    else { cancelAnimationFrame(rafId); dispose(); onDone(); }
  }
  rafId = requestAnimationFrame(frame);
}

// =========================================
// CODE EXPLOSION (press-start → cabinet)
// A burst of numbers/code explodes outward while the screen floods with
// cascading garbage, white-flashes, then fades to black → cabinet reveal.
// =========================================
function playCodeExplosion(onDone, skipSound = false) {
  const s = _bootCanvasSetup();
  if (!s) { onDone(); return; }
  showScreen('bootup');
  const { canvas, ctx, DPR, dispose } = s;
  const W0 = canvas.width, H0 = canvas.height;
  const cell = Math.max(15, Math.min(W0, H0) / 32);

  // outward burst particles from centre
  const parts = [];
  for (let i = 0; i < 170; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.4 + Math.random() * 1.7) * Math.min(W0, H0) / 60;
    parts.push({ x: W0 / 2, y: H0 / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ch: _rc(_GLITCH_CHARS), col: _rc(_GLITCH_COLS), life: 1 });
  }
  // matrix-style cascading columns
  const colCount = Math.ceil(W0 / (cell * 0.9));
  const drops = new Array(colCount).fill(0).map(() => Math.random() * -H0);

  if (!skipSound) {
    try { blip({ freq: 90, dur: 0.5, type: 'sawtooth', slide: 500, vol: 0.12 }); } catch (_) {}
  }

  const start = performance.now();
  const DUR = 2.2;
  let rafId = 0;

  function frame(now) {
    const e = (now - start) / 1000;
    const W = canvas.width, H = canvas.height, t = e / DUR;

    // motion-blur trail instead of a full clear
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(0, 0, W, H);

    const shake = (1 - t) * cell * 0.7;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.textBaseline = 'top';

    // cascading garbage columns (accelerate over time)
    ctx.font = `${cell}px "Courier New", monospace`;
    const flow = 1 + t * 6;
    for (let c = 0; c < colCount; c++) {
      drops[c] += cell * flow;
      if (drops[c] > H) drops[c] = Math.random() * -H * 0.5;
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = _rc(_GLITCH_COLS);
        ctx.globalAlpha = 0.4 + Math.random() * 0.5;
        ctx.fillText(_rc(_GLITCH_CHARS), c * cell * 0.9, drops[c] - k * cell);
      }
    }
    ctx.globalAlpha = 1;

    // exploding code particles
    ctx.font = `bold ${cell * 1.2}px "Courier New", monospace`;
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vx *= 1.012; p.vy *= 1.012; p.life -= 0.011;
      if (p.life <= 0) continue;
      if (Math.random() < 0.15) p.ch = _rc(_GLITCH_CHARS);
      ctx.fillStyle = p.col;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillText(p.ch, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // glitch bands
    for (let b = 0; b < 3; b++) {
      if (Math.random() > 0.55) continue;
      const by = Math.random() * H, bh = cell * (0.5 + Math.random() * 2.5);
      ctx.fillStyle = _rc(_GLITCH_COLS);
      ctx.globalAlpha = 0.12 + Math.random() * 0.3;
      ctx.fillRect(0, by, W, bh);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // white flash at the burst peak
    if (t > 0.32 && t < 0.5) { ctx.fillStyle = `rgba(255,255,255,${(0.5 - t) * 2 * 0.55})`; ctx.fillRect(0, 0, W, H); }

    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += Math.max(2, Math.round(DPR * 2))) ctx.fillRect(0, y, W, 1);

    // fade to black at the end → cabinet appears
    if (t > 0.7) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 0.7) / 0.3)})`; ctx.fillRect(0, 0, W, H); }

    if (e < DUR) rafId = requestAnimationFrame(frame);
    else { cancelAnimationFrame(rafId); dispose(); onDone(); }
  }
  rafId = requestAnimationFrame(frame);
}

// =========================================
// GENERAL SCREEN TRANSITION (MEGA PAC-MAN)
// =========================================
window.playCodeExplosion = playCodeExplosion;

function startMegaTransition(nextScreenKey, callback, isGoingBack) {
  const transitionScreen = screens.transition;
  const canvas = document.getElementById('transition-canvas');
  if (!transitionScreen || !canvas) {
    showScreen(nextScreenKey);
    if (callback) callback();
    return;
  }

  // Force active class, z-index and visibility on top of everything
  transitionScreen.style.transition = 'none';
  transitionScreen.style.opacity = '1';
  transitionScreen.style.visibility = 'visible';
  transitionScreen.style.zIndex = '99999';
  transitionScreen.classList.add('active');

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const radius = canvas.height * 0.7; // Mega Pacman radius
  const totalDistance = canvas.width + 2 * radius;
  const frames = 70; // Slightly slower: 70 frames (approx 1.15s)
  const speed = totalDistance / frames;

  let pacX, dir;
  if (isGoingBack) {
    pacX = canvas.width + radius; // Start off screen right
    dir = -1;
  } else {
    pacX = -radius; // Start off screen left
    dir = 1;
  }

  let mouthOpen = 0;
  let mouthDir = 1;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the black trail behind Pac-Man
    ctx.fillStyle = '#050505';
    if (dir === 1) {
      ctx.fillRect(0, 0, Math.max(0, pacX), canvas.height);
    } else {
      ctx.fillRect(Math.max(0, pacX), 0, canvas.width - Math.max(0, pacX), canvas.height);
    }

    // Draw Mega Pac-Man
    const pacY = canvas.height / 2;
    ctx.fillStyle = '#FFD43B';
    ctx.beginPath();

    const mouthAngle = 0.22 * mouthOpen * Math.PI;
    const angleOffset = dir === 1 ? 0 : Math.PI;

    ctx.arc(pacX, pacY, radius, angleOffset + mouthAngle, angleOffset + 2 * Math.PI - mouthAngle);
    ctx.lineTo(pacX, pacY);
    ctx.fill();

    // Update state
    pacX += speed * dir;
    mouthOpen += 0.06 * mouthDir; // Chomping speed matched to slightly slower timing
    if (mouthOpen >= 1 || mouthOpen <= 0) mouthDir *= -1;

    // Check completion
    const isComplete = dir === 1 ? (pacX >= canvas.width + radius) : (pacX <= -radius);

    if (!isComplete) {
      requestAnimationFrame(draw);
    } else {
      // Screen is fully covered. Switch screen now!
      showScreen(nextScreenKey);
      if (callback) callback();

      // Smoothly fade out the transition screen to reveal the new page
      transitionScreen.style.transition = 'opacity 0.4s ease-out';
      transitionScreen.style.opacity = '0';

      setTimeout(() => {
        transitionScreen.classList.remove('active');
        transitionScreen.style.transition = '';
        transitionScreen.style.opacity = '';
        transitionScreen.style.visibility = '';
        transitionScreen.style.zIndex = '';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 400);
    }
  }

  draw();
}

// =========================================
// SCREEN 3 & 4: ARCADE ROOM EXPERIENCE
// =========================================
window.transitionFromArcadeToGameStart = function() {
  showScreen('gameStart');
  runStartSequence();
  const crt = document.getElementById('crt-overlay');
  if (crt) crt.classList.add('active');
};

function startArcadeLoader() {
  showScreen('arcadeLoader');
  
  const lines = document.querySelectorAll('.console-line');
  lines.forEach((line, index) => {
    line.style.opacity = index === 0 ? '1' : '0';
  });
  
  // Sequential diagnostic text reveal
  setTimeout(() => {
    const line2 = document.querySelector('.console-line:nth-child(2)');
    if (line2) line2.style.opacity = '1';
  }, 800);
  
  setTimeout(() => {
    const line3 = document.querySelector('.console-line:nth-child(3)');
    if (line3) line3.style.opacity = '1';
  }, 1600);
  
  // Transition to cabinet reveal after the custom cubic loader bar finishes
  setTimeout(() => {
    startCabinetReveal();
  }, 3200);
}

function startCabinetReveal() {
  showScreen('arcadeReveal');
  initThreeJSCabinet();
  
  cabinetState = 'hidden';
  cabinetApproachProgress = 0;
  
  setTimeout(() => {
    cabinetState = 'approaching';
    animateCabinet();
  }, 1000);
}

function animateCabinet() {
  cabinetAnimationId = requestAnimationFrame(animateCabinet);
  
  if (!cabinetModel) return;
  
  if (cabinetState === 'approaching') {
    // 6 second approach approx at 60fps
    cabinetApproachProgress += 1 / (60 * 6);
    if (cabinetApproachProgress >= 1) {
      cabinetApproachProgress = 1;
      cabinetState = 'idle';
      const container = document.getElementById('three-cabinet-container');
      container.addEventListener('click', onCabinetClick, { once: true });
    }
    
    // Smooth cubic ease out
    const ease = 1 - Math.pow(1 - cabinetApproachProgress, 3);
    
    const s = 0.01 + ease * 0.99;
    cabinetModel.scale.set(s, s, s);
    
    // Rotate fully to reveal sides in 3D space
    cabinetModel.rotation.y = -Math.PI * 2 * (1 - ease);
    
    // Dynamic cinematic light fade-up
    const amb = cabinetScene.getObjectByName('ambientLight');
    const dir1 = cabinetScene.getObjectByName('dirLight1');
    const dir2 = cabinetScene.getObjectByName('dirLight2');
    
    if (amb) amb.intensity = 0.6 * ease;
    if (dir1) dir1.intensity = 1.2 * ease;
    if (dir2) dir2.intensity = 0.4 * ease;
    
    cabinetCamera.position.z = baseCameraZ * (8 - ease * 7);
    cabinetCamera.lookAt(0, 0, 0);
  } else if (cabinetState === 'idle') {
    // Subtle idle rotation
    cabinetModel.rotation.y += 0.002;
  } else if (cabinetState === 'aligning_front') {
    alignProgress += 1 / (60 * 0.8); // 0.8s alignment
    if (alignProgress >= 1) {
      alignProgress = 1;
      cabinetState = 'zooming_coin';
      cabinetZoomProgress = 0;
    }
    const ease = 1 - Math.pow(1 - alignProgress, 3);
    
    // Smoothly rotate model to Y = 0 (perfect frontal face)
    cabinetModel.rotation.y = THREE.MathUtils.lerp(startCabinetRotY, 0, ease);
    
    // Smoothly reposition camera to frontal center
    cabinetCamera.position.x = THREE.MathUtils.lerp(startCameraX, 0, ease);
    cabinetCamera.position.y = THREE.MathUtils.lerp(startCameraY, 0, ease);
    cabinetCamera.position.z = THREE.MathUtils.lerp(startCameraZ, baseCameraZ, ease);
    cabinetCamera.lookAt(0, 0, 0);
  } else if (cabinetState === 'zooming_coin') {
    cabinetZoomProgress += 1 / (60 * 2); // 2s zoom
    if (cabinetZoomProgress > 1) cabinetZoomProgress = 1;
    const ease = 1 - Math.pow(1 - cabinetZoomProgress, 3);
    
    // Physically move camera to view coin slot
    currentCameraY = THREE.MathUtils.lerp(0, -cabinetMaxDim * 0.15, ease);
    currentCameraZ = THREE.MathUtils.lerp(baseCameraZ, baseCameraZ * 0.45, ease);
    
    cabinetCamera.position.y = currentCameraY;
    cabinetCamera.position.z = currentCameraZ;
    cabinetCamera.lookAt(0, currentCameraY, 0);
  } else if (cabinetState === 'inserting_coin') {
    coinProgress += 1 / (60 * 1.2); // 1.2s insertion
    if (coinProgress > 1) coinProgress = 1;
    
    // Ease-in to feel like it's dropping naturally
    const ease = Math.pow(coinProgress, 2);
    
    const startY = -cabinetMaxDim * 0.05;
    const endY = -cabinetMaxDim * 0.20;
    const startZ = cabinetSizeZ * 0.5 + cabinetMaxDim * 0.02;
    const endZ = cabinetSizeZ * 0.5; // flush with cabinet face
    
    cabinetCoin.position.x = cabinetMaxDim * 0.08; // slightly offset to the right
    cabinetCoin.position.y = THREE.MathUtils.lerp(startY, endY, ease);
    cabinetCoin.position.z = THREE.MathUtils.lerp(startZ, endZ, Math.pow(coinProgress, 0.5));
    
  } else if (cabinetState === 'zooming_screen') {
    cabinetZoomProgress += 1 / (60 * 2.5);
    if (cabinetZoomProgress > 1) cabinetZoomProgress = 1;
    const ease = 1 - Math.pow(1 - cabinetZoomProgress, 3);
    currentCameraY = THREE.MathUtils.lerp(startCameraY, cabinetMaxDim * 0.12, ease);
    currentCameraZ = THREE.MathUtils.lerp(startCameraZ, baseCameraZ * 0.45, ease);
    cabinetCamera.position.y = currentCameraY;
    cabinetCamera.position.z = currentCameraZ;
    cabinetCamera.lookAt(0, currentCameraY, 0);

  // ─── NEW SCROLL-DRIVEN APPROACH ───────────────────────────────────
  } else if (cabinetState === 'dropping' || cabinetState === 'settling') {
    // These states are no longer used in the new scroll entrance
    cabinetState = 'scroll_idle';
  } else if (cabinetState === 'scroll_idle') {
    // Smooth lerp scroll progress
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.06;
    
    // Update progress bar UI
    const bar = document.getElementById('scroll-progress-bar');
    if (bar) bar.style.width = (scrollCurrent * 100) + '%';
    
    const t = scrollCurrent;
    
    // Update lighting based on scroll progress
    const amb = cabinetScene.getObjectByName('ambientLight');
    const dir1 = cabinetScene.getObjectByName('dirLight1');
    const dir2 = cabinetScene.getObjectByName('dirLight2');
    if (amb) amb.intensity = THREE.MathUtils.lerp(0.05, 0.6, Math.min(1, t / 0.5));
    if (dir1) dir1.intensity = THREE.MathUtils.lerp(0.1, 1.2, Math.min(1, t / 0.5));
    if (dir2) dir2.intensity = THREE.MathUtils.lerp(0.05, 0.4, Math.min(1, t / 0.5));

    let cameraX = 0;
    let cameraY = 0;
    let cameraZ = baseCameraZ * 4;
    let lookAtX = 0;
    let lookAtY = 0;
    let lookAtZ = 0;

    if (t <= 0.5) {
      // Phase 1: Approach and rotate on itself, resolving exactly to frontal facing at t = 0.5
      const p = t / 0.5; // ranges 0 to 1
      
      cameraZ = THREE.MathUtils.lerp(baseCameraZ * 4, baseCameraZ * 0.72, p);
      
      // Rotates on itself (3 complete rotations, ending at 0)
      cabinetModel.rotation.y = (1 - p) * Math.PI * 6;
    } else {
      // Phase 2: Zoom straight into the cabinet screen, no rotation
      const p = (t - 0.5) / 0.5; // ranges 0 to 1
      
      cameraY = THREE.MathUtils.lerp(0, cabinetMaxDim * 0.12, p);
      cameraZ = THREE.MathUtils.lerp(baseCameraZ * 0.72, baseCameraZ * 0.28, p);
      
      cabinetModel.rotation.y = 0;
      
      lookAtY = THREE.MathUtils.lerp(0, cabinetMaxDim * 0.12, p);
    }

    // Keep cabinet centered at the origin
    cabinetModel.position.set(0, 0, 0);
    cabinetModel.rotation.x = 0;
    cabinetModel.rotation.z = 0;

    cabinetCamera.position.set(cameraX, cameraY, cameraZ);
    cabinetCamera.lookAt(lookAtX, lookAtY, lookAtZ);
    
    // Hide scroll hint once user starts scrolling
    if (scrollTarget > 0.05) {
      const hint = document.getElementById('scroll-hint');
      if (hint && !hint.classList.contains('fading')) hint.classList.add('fading');
    }
    // Trigger entry at 95% scroll
    if (scrollCurrent >= 0.95 && !enterTriggered) {
      enterTriggered = true;
      enterCabinetScreen();
    }
  }
  
  cabinetRenderer.render(cabinetScene, cabinetCamera);
}

function runStartSequence() {
  // Hide all screens/phases first
  const selfTest = document.getElementById('startup-self-test');
  const attract = document.getElementById('startup-attract');
  const menuContent = document.getElementById('start-menu-content');
  
  if (selfTest) selfTest.classList.add('hidden');
  if (attract) attract.classList.add('hidden');
  if (menuContent) menuContent.classList.add('hidden');
  
  // Phase 1: Hardware Self-Test Grid
  if (selfTest) selfTest.classList.remove('hidden');
  
  // Reset all ghost rows, names and nicks to opacity 0 initially
  const rows = document.querySelectorAll('.ghost-row');
  rows.forEach(row => {
    row.style.opacity = '0';
    const name = row.querySelector('.ghost-name');
    const nick = row.querySelector('.ghost-nick');
    if (name) name.style.opacity = '0';
    if (nick) nick.style.opacity = '0';
  });

  // Phase 2: Attract & Character Screen after 0.8 seconds
  setTimeout(() => {
    if (selfTest) selfTest.classList.add('hidden');
    if (attract) attract.classList.remove('hidden');
    
    // Staggered reveal timeline:
    // Row 1 (Blinky): Red Ghost -> 0.3s -> "Shadow" -> 0.2s -> "BLINKY"
    const r1 = document.querySelector('.ghost-row.blinky');
    if (r1) {
      r1.style.opacity = '1';
      setTimeout(() => {
        const name = r1.querySelector('.ghost-name');
        if (name) name.style.opacity = '1';
      }, 300);
      setTimeout(() => {
        const nick = r1.querySelector('.ghost-nick');
        if (nick) nick.style.opacity = '1';
      }, 500);
    }
    
    // Row 2 (Pinky): Pink Ghost -> 0.3s -> "Speedy" -> 0.2s -> "PINKY"
    setTimeout(() => {
      const r2 = document.querySelector('.ghost-row.pinky');
      if (r2) {
        r2.style.opacity = '1';
        setTimeout(() => {
          const name = r2.querySelector('.ghost-name');
          if (name) name.style.opacity = '1';
        }, 300);
        setTimeout(() => {
          const nick = r2.querySelector('.ghost-nick');
          if (nick) nick.style.opacity = '1';
        }, 500);
      }
    }, 800);
    
    // Row 3 (Inky): Cyan Ghost -> 0.3s -> "Bashful" -> 0.2s -> "INKY"
    setTimeout(() => {
      const r3 = document.querySelector('.ghost-row.inky');
      if (r3) {
        r3.style.opacity = '1';
        setTimeout(() => {
          const name = r3.querySelector('.ghost-name');
          if (name) name.style.opacity = '1';
        }, 300);
        setTimeout(() => {
          const nick = r3.querySelector('.ghost-nick');
          if (nick) nick.style.opacity = '1';
        }, 500);
      }
    }, 1600);
    
    // Row 4 (Clyde): Orange Ghost -> 0.3s -> "Pokey" -> 0.2s -> "CLYDE"
    setTimeout(() => {
      const r4 = document.querySelector('.ghost-row.clyde');
      if (r4) {
        r4.style.opacity = '1';
        setTimeout(() => {
          const name = r4.querySelector('.ghost-name');
          if (name) name.style.opacity = '1';
        }, 300);
        setTimeout(() => {
          const nick = r4.querySelector('.ghost-nick');
          if (nick) nick.style.opacity = '1';
        }, 500);
      }
    }, 2400);
    
  }, 800);
  
  // Phase 3: Display Actual Start Menu after 4.2 seconds
  setTimeout(() => {
    if (attract) attract.classList.add('hidden');
    if (menuContent) {
      menuContent.classList.remove('hidden');
      menuContent.style.opacity = '0';
      menuContent.style.transition = 'opacity 0.8s ease';
      // Force repaint
      menuContent.offsetHeight;
      menuContent.style.opacity = '1';
    }
  }, 4200);
}

function onCabinetClick() {
  cabinetState = 'aligning_front';
  alignProgress = 0;
  startCabinetRotY = cabinetModel.rotation.y;
  startCameraX = cabinetCamera.position.x;
  startCameraY = cabinetCamera.position.y;
  startCameraZ = cabinetCamera.position.z;
  
  // Staggered absolute timing after click
  // 1. Zoom to coin slot starts 800ms after frontal alignment finishes
  // 2. Coin shows & drops at 2800ms (800ms alignment + 2000ms zoom)
  setTimeout(() => {
    cabinetState = 'inserting_coin';
    if (cabinetCoin) cabinetCoin.visible = true;
    coinProgress = 0;
  }, 2800);
  
  // 3. Zoom to screen starts at 4300ms (2800ms + 1500ms insertion)
  setTimeout(() => {
    if (cabinetCoin) cabinetCoin.visible = false;
    cabinetState = 'zooming_screen';
    cabinetZoomProgress = 0;
    startCameraY = cabinetCamera.position.y;
    startCameraZ = cabinetCamera.position.z;
  }, 4300);
  
  // 4. Pre-transition cross-fade at 6400ms (inspired by shader.se continuous flow)
  setTimeout(() => {
    const container = document.getElementById('three-cabinet-container');
    container.style.transition = 'opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    container.style.opacity = '0';
  }, 6400);
  
  // 5. Final transition to gameStart at 6800ms
  setTimeout(() => {
    cancelAnimationFrame(cabinetAnimationId);
    window.transitionFromArcadeToGameStart();
    const container = document.getElementById('three-cabinet-container');
    container.style.transition = 'none';
    container.style.opacity = '1';
  }, 6800);
}

// =========================================
// NEW FLOW: PRESS START + DROP + SCROLL
// =========================================
function showPressStartButton() {
  showScreen('pressStart');
  const btn = document.getElementById('arcade-start-btn');
  if (btn) btn.addEventListener('click', onPressStartClick, { once: true });
}

function onPressStartClick() {
  const btn = document.getElementById('arcade-start-btn');
  if (btn) btn.classList.add('pressed');
  
  const btnImg = document.getElementById('arcade-btn-img');
  if (btnImg) {
    btnImg.src = '/assets/arcade-button-down.png';
  }

  // Play the retro explosion sound immediately upon click
  try {
    blip({ freq: 90, dur: 0.5, type: 'sawtooth', slide: 500, vol: 0.12 });
  } catch (_) {}

  // Keep button visible in pressed state for a short moment, then fade and launch code explosion
  setTimeout(() => {
    const ps = document.getElementById('screen-press-start');
    if (ps) { ps.style.transition = 'opacity 0.45s ease'; ps.style.opacity = '0'; }
    setTimeout(() => {
      // Pass skipSound = true so it does not play the sound again
      playCodeExplosion(() => {
        if (typeof window.transitionFromArcadeToGameStart === 'function') {
          window.transitionFromArcadeToGameStart();
        }
      }, true);
    }, 450);
  }, 400);
}
// Expose for arcade.js (ES module) to call after cabinet entry
window.showPressStartButton = showPressStartButton;

// Skip Experience Confirmation Modal Handlers
document.getElementById('btn-discover-collection')?.addEventListener('click', () => {
  document.getElementById('skip-confirm-modal')?.classList.remove('hidden');
});

document.getElementById('btn-skip-cancel')?.addEventListener('click', () => {
  document.getElementById('skip-confirm-modal')?.classList.add('hidden');
});

document.getElementById('btn-skip-confirm')?.addEventListener('click', () => {
  document.getElementById('skip-confirm-modal')?.classList.add('hidden');
  hasDiscount = false;
  skippedExperience = true;
  startMegaTransition('arcadeCollection', () => {
    renderArcadeCollection();
    initArcadeCollection();
  });
});

// =========================================
// SCREEN 5: GAME START
// =========================================
document.getElementById('btn-play-game')?.addEventListener('click', () => {
  startMegaTransition('gameplay', () => {
    startGame();
  });
});

document.getElementById('btn-back-to-uniqlo')?.addEventListener('click', () => {
  document.getElementById('back-uniqlo-btn')?.click();
});

document.getElementById('btn-close-popup')?.addEventListener('click', () => {
  document.getElementById('locked-collection-popup').classList.add('hidden');
});

// =========================================
// SCREEN 6: GAMEPLAY
// =========================================
// DEBUG_MAP: when true, draws the collision-grid overlay (red=W, green=P,
// yellow=C, purple=G) and shows row/col on hover/click. EDIT_COLLISION_MAP is
// kept as an internal alias so all existing debug code keeps working.
let DEBUG_MAP = false;
let EDIT_COLLISION_MAP = DEBUG_MAP;

// 15 cols × 14 rows. Re-traced for the latest 4961x3508 maze image (the
// artwork now fills nearly the whole PNG instead of being inset on the
// right). Threshold 0.20 keeps walls 1 tile thick, chamber interiors stay
// walkable. L-R symmetric. Ghost house at rows 6-7 cols 6-8 with the gate
// cell at (5, 7). Pac-Man spawn at (11, 7).
const collisionMap = [
  "PPWWWWPWPPPWWWP", // Row 0
  "PCPPPWPPPWPPPCP", // Row 1
  "WPWWPWPPPWPWWPW", // Row 2
  "WPWWPPPWPWPPPPW", // Row 3
  "PPWWWWPWPWWWWPP", // Row 4
  "WPPPPPPPPPPPPPW", // Row 5
  "PPPPPGGGGGPPPPP", // Row 6  ← TUNNEL ONLY: R6C0 ↔ R6C14
  "WPWWPGGGGGPWWPW", // Row 7
  "PPPPPPPPPPPPPPP", // Row 8
  "PPWWWWPWPWWWWPP", // Row 9
  "WPWPPPPWPWWWWPW", // Row 10
  "PPPPWWPPPWWWWPP", // Row 11
  "PWWWWWPWPWWWWPP", // Row 12
  "CPPPPPPWPPPPPPC"  // Row 13
];

// Tunnel wrap: ONLY row 6 (R6C0 ↔ R6C14). No other row wraps.
const TUNNEL_ROWS = new Set([6]);

let gameInterval;
let map = [];
let gamePellets = [];
let hoveredCell = null;

const pacman =  {
  r: 11,
  c: 7,
  dir: { r: 0, c: 0 },
  nextDir: { r: 0, c: 0 },
  open: 0,
  openDir: 1
};
// Collectibles sit on the 'C' power-pellet tiles of the new map.
// Eating them unlocks the UNIQLO item AND triggers frightened mode.
const collectibles = [
  { id: 'tshirt',     r: 1,  c: 1,  color: '#ff6b6b', collected: false, name: 'T-Shirt' },
  { id: 'sweatshirt', r: 1,  c: 13, color: '#4ecdc4', collected: false, name: 'Sweatshirt' },
  { id: 'cap',        r: 13, c: 0,  color: '#45b7d1', collected: false, name: 'Cap' },
  { id: 'tote',       r: 13, c: 14, color: '#96ceb4', collected: false, name: 'Bag' },
];

// Power-pellet / frightened-mode state
let frightenedTimer = 0;         // ticks remaining while ghosts are frightened
const FRIGHTENED_TICKS = Math.round(7000 / 150); // ~7 seconds at 150 ms/tick
let powerPelletBlink = 0;        // tick counter for power pellet blink cycle
// In the original arcade, power pellets blink ~once per second:
// visible for ~6 ticks (~900ms), hidden for ~2 ticks (~300ms) — ratio 3:1
const PELLET_BLINK_PERIOD = 8;   // total ticks per cycle
const PELLET_BLINK_OFF    = 2;   // ticks per cycle where pellet is hidden

let score = 0;
let pelletTick = 0; // alternates between two pellet beeps for the "waka" rhythm

// ── Movement interpolation: tile-based logic runs every TICK_MS, the canvas
//    redraws at 60fps with a smooth lerp between previous and current tile.
const TICK_MS = 150;
let lastTickAt = 0;
let renderId = 0;
function tickProgress() {
  if (isPaused) return 1;          // freeze entity at its current tile
  if (!lastTickAt) return 0;
  return Math.min(1, (performance.now() - lastTickAt) / TICK_MS);
}
function lerpRow(e) {
  if (e.prevR == null) return e.r;
  const d = e.r - e.prevR;
  if (Math.abs(d) > 1) return e.r; // big jump (teleport / wrap): snap
  return e.prevR + d * tickProgress();
}
function lerpCol(e) {
  if (e.prevC == null) return e.c;
  const d = e.c - e.prevC;
  if (Math.abs(d) > 1) return e.c; // tunnel wrap: snap (don't slide across the maze)
  return e.prevC + d * tickProgress();
}
let highScore = +(localStorage.getItem('pacHi') || 10000);

function updateHud() {
  const s = document.getElementById('score-val');
  const h = document.getElementById('high-score-val');
  if (s) s.textContent = score;
  if (score > highScore) {
    highScore = score;
    try { localStorage.setItem('pacHi', String(highScore)); } catch (_) {}
  }
  if (h) h.textContent = String(highScore).padStart(5, '0');
}

// ── Web Audio: tiny 8-bit synth (no asset files, no copyrighted samples) ──
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function blip({ freq = 440, dur = 0.08, type = 'square', vol = 0.07, slide = 0, delay = 0 } = {}) {
  const ctx = ensureAudio(); if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur);
}
const SFX = {
  // Original arcade-style start jingle: ascending C-major arpeggios into a
  // high flourish. Triangle wave + short note durations = classic chiptune
  // feel. ~2.4s total. NOT a transcription of any copyrighted arcade tune.
  ready: () => {
    const seq = [
      // arpeggio 1: C major triad ascending (C4 - E4 - G4)
      { f: 262, d: 0.12, t: 0.00 }, { f: 330, d: 0.12, t: 0.13 }, { f: 392, d: 0.12, t: 0.26 },
      // arpeggio 2: same pattern an octave up (C5 - E5 - G5)
      { f: 523, d: 0.12, t: 0.42 }, { f: 659, d: 0.12, t: 0.55 }, { f: 784, d: 0.12, t: 0.68 },
      // climb: G5 - A5 - B5 - C6 (resolves up)
      { f: 784, d: 0.10, t: 0.86 }, { f: 880, d: 0.10, t: 0.99 }, { f: 988, d: 0.10, t: 1.12 },
      { f: 1047, d: 0.18, t: 1.25 },
      // little bounce: G5 - C6 (perfect-fourth flourish)
      { f: 784, d: 0.10, t: 1.55 }, { f: 1047, d: 0.10, t: 1.68 },
      // final triumphant high E6 hold
      { f: 1319, d: 0.40, t: 1.85 },
    ];
    seq.forEach(n => blip({ freq: n.f, dur: n.d, type: 'triangle', vol: 0.10, delay: n.t }));
  },
  pelletA:     () => blip({ freq: 380, dur: 0.045, vol: 0.045 }),
  pelletB:     () => blip({ freq: 280, dur: 0.045, vol: 0.045 }),
  collectible: () => { blip({ freq: 660, dur: 0.08, type: 'triangle', vol: 0.1 }); blip({ freq: 990, dur: 0.12, type: 'triangle', vol: 0.1, delay: 0.08 }); },
  power:       () => blip({ freq: 200, dur: 0.4, type: 'square', slide: -100, vol: 0.08 }),
  eatGhost:    () => { blip({ freq: 200, dur: 0.06, type: 'sawtooth', vol: 0.1 }); blip({ freq: 800, dur: 0.12, type: 'triangle', vol: 0.1, delay: 0.06 }); },
  death:       () => blip({ freq: 520, dur: 0.7, type: 'sawtooth', slide: -480, vol: 0.12 }),
  reward:      () => [523, 659, 784, 1046].forEach((f, i) => blip({ freq: f, dur: 0.18, type: 'triangle', vol: 0.1, delay: i * 0.15 })),
  pause:       () => blip({ freq: 300, dur: 0.08, type: 'square', vol: 0.07 }),
  uiHover:     () => blip({ freq: 1200, dur: 0.03, type: 'square', vol: 0.035 }),
  uiClick:     () => blip({ freq: 600, dur: 0.07, type: 'square', vol: 0.06, slide: 200 }),
};

// ── Global UI sound delegation ──
// Plays a soft hover blip when the pointer enters an interactive element
// (throttled), and a click blip on activation. Uses event delegation so it
// covers buttons added at any time without per-button wiring.
const UI_INTERACTIVE_SELECTOR = [
  'button',
  '.arcade-btn', '.arcade-img-button',
  '.uq-tab', '.uq-icon-btn', '.uq-btn-primary', '.uq-btn-ghost',
  '.wahba-btn', '.wahba-cta-btn',
  '[role="button"]',
  '#pacman-easter-egg', // landing-page hidden Pac-Man (only sound source on landing)
].join(', ');
// The UNIQLO landing page stays silent EXCEPT for the hidden Pac-Man easter
// egg — its hover/click does fire the UI blip as a subtle "you found it" cue.
function _uiSoundsAllowed(el) {
  if (!el.closest('#screen-landing')) return true; // arcade flow: sounds on
  return !!el.closest('#pacman-easter-egg');       // landing: only easter egg
}
let _lastUiHoverAt = 0;
document.addEventListener('mouseover', (e) => {
  const tgt = e.target.closest && e.target.closest(UI_INTERACTIVE_SELECTOR);
  if (!tgt || tgt.disabled || !_uiSoundsAllowed(tgt)) return;
  // Skip if we're just moving between children of the same button
  const from = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(UI_INTERACTIVE_SELECTOR);
  if (from === tgt) return;
  const now = performance.now();
  if (now - _lastUiHoverAt < 80) return; // throttle to avoid spam
  _lastUiHoverAt = now;
  SFX.uiHover();
});
document.addEventListener('click', (e) => {
  const tgt = e.target.closest && e.target.closest(UI_INTERACTIVE_SELECTOR);
  if (!tgt || tgt.disabled || !_uiSoundsAllowed(tgt)) return;
  SFX.uiClick();
}, true); // capture phase so we play even if a handler stops propagation

// ── GHOST AI — constants ──────────────────────────────────────────
const GHOST_SCATTER_TICKS = Math.round(7000 / 150);   // ~47 ticks ≈ 7 s
const GHOST_CHASE_TICKS   = Math.round(20000 / 150);  // ~133 ticks ≈ 20 s
const GHOST_PHASE_SCHEDULE = [
  { mode: 'scatter', duration: GHOST_SCATTER_TICKS },
  { mode: 'chase',   duration: GHOST_CHASE_TICKS   },
  { mode: 'scatter', duration: GHOST_SCATTER_TICKS },
  { mode: 'chase',   duration: GHOST_CHASE_TICKS   },
  { mode: 'scatter', duration: GHOST_SCATTER_TICKS },
  { mode: 'chase',   duration: Infinity            },
];
// Ghost house gate is at row 5, col 7 (the P cell just above the G zone).
// Blinky starts OUTSIDE (at gate position), the others start INSIDE the house.
// houseR/houseC = their idle bobbing center inside the house.
const GHOST_HOUSE_GATE = { r: 5, c: 7 };
const GHOST_SPAWN_DATA = [
  { id: 'blinky', r: 5, c: 7, dir: { r: 0, c: -1 }, color: '#FF0000', scatter: { r: 1,  c: 13 }, releaseAt: 0,   houseR: 6, houseC: 7 },
  { id: 'pinky',  r: 6, c: 7, dir: { r: 0, c:  1 }, color: '#FFB8FF', scatter: { r: 1,  c: 1  }, releaseAt: 33,  houseR: 6, houseC: 7 },
  { id: 'inky',   r: 7, c: 6, dir: { r: 0, c: -1 }, color: '#00FFFF', scatter: { r: 12, c: 13 }, releaseAt: 66,  houseR: 7, houseC: 6 },
  { id: 'clyde',  r: 7, c: 8, dir: { r: 0, c:  1 }, color: '#FFB852', scatter: { r: 12, c: 1  }, releaseAt: 100, houseR: 7, houseC: 8 },
];
let ghosts        = [];
let gameTick      = 0;
let ghostModeTick  = 0;
let ghostModePhase = 0;
let globalGhostMode = 'scatter';

// Setup Map & Pellet Spawning based on collisionMap array
// 'P' tiles get normal pellets; 'C' tiles get power pellets (energizers).
function generateMapAndPellets() {
  map = [];
  gamePellets = [];

  for (let r = 0; r < collisionMap.length; r++) {
    const row = [];
    for (let c = 0; c < collisionMap[r].length; c++) {
      const char = collisionMap[r][c];
      let val = 0;

      if (char === 'P' || char === 'C') {
        val = 1; // Walkable path
      } else if (char === 'G') {
        val = 4; // Ghost house / gate
      }

      row.push(val);

      if (char === 'P') {
        // Normal pellet — skip Pac-Man spawn tile
        const isSpawn = (r === pacman.r && c === pacman.c);
        if (!isSpawn) gamePellets.push({ r, c, power: false, active: true });
      } else if (char === 'C') {
        // Power pellet (energizer) — always spawned
        gamePellets.push({ r, c, power: true, active: true });
      }
    }
    map.push(row);
  }
}

// Set up grid hover and click listener
let debugMouseListenersInitialized = false;

function getGridGeometry(canvas) {
  // Bounding box of the visible neon-blue walls in the latest 4961x3508 PNG.
  // The artwork is now mostly centered with small symmetric margins; these
  // fractions align the grid to the walls rather than the black image edges.
  const ORIGIN_X = 0.0935;
  const ORIGIN_Y = 0.0291;
  const SPAN_X   = 0.8127;
  const SPAN_Y   = 0.9381;

  const cols = collisionMap[0].length;
  const rows = collisionMap.length;
  const startX = ORIGIN_X * canvas.width;
  const startY = ORIGIN_Y * canvas.height;
  const stepW  = SPAN_X * canvas.width  / cols;
  const stepH  = SPAN_Y * canvas.height / rows;
  const tileSize = Math.min(stepW, stepH) * 0.76; // shrunk so Pac-Man fits inside corridors
  return { startX, startY, stepW, stepH, tileSize };
}

function initDebugMouseListener() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  
  if (debugMouseListenersInitialized) return;
  debugMouseListenersInitialized = true;
  
  if (EDIT_COLLISION_MAP) {
    const copyBtn = document.getElementById('btn-copy-map');
    if (copyBtn) {
      copyBtn.classList.remove('hidden');
      copyBtn.addEventListener('click', () => {
        let code = `const collisionMap = [\n`;
        for (let r = 0; r < collisionMap.length; r++) {
          code += `  "${collisionMap[r]}"${r === collisionMap.length - 1 ? '' : ','}\n`;
        }
        code += `];`;
        navigator.clipboard.writeText(code).then(() => {
          alert('Collision map copied to clipboard!');
        }).catch(err => {
          console.error('Failed to copy: ', err);
        });
      });
    }
  }

  canvas.addEventListener('mousemove', (e) => {
    if (!EDIT_COLLISION_MAP) {
      hoveredCell = null;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const { startX, startY, stepW, stepH } = getGridGeometry(canvas);
    
    const c = Math.floor((mouseX - startX) / stepW);
    const r = Math.floor((mouseY - startY) / stepH);
    
    if (r >= 0 && r < collisionMap.length && c >= 0 && c < collisionMap[0].length) {
      hoveredCell = { r, c };
    } else {
      hoveredCell = null;
    }
  });
  
  canvas.addEventListener('mouseleave', () => {
    hoveredCell = null;
  });

  canvas.addEventListener('click', (e) => {
    if (!EDIT_COLLISION_MAP) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const { startX, startY, stepW, stepH } = getGridGeometry(canvas);
    
    const c = Math.floor((mouseX - startX) / stepW);
    const r = Math.floor((mouseY - startY) / stepH);
    
    if (r >= 0 && r < collisionMap.length && c >= 0 && c < collisionMap[0].length) {
      const char = collisionMap[r][c];
      let newChar = 'W';
      if (char === 'W') newChar = 'P';
      else if (char === 'P') newChar = 'C';
      else if (char === 'C') newChar = 'G';
      else if (char === 'G') newChar = 'W';
      
      const rowStr = collisionMap[r];
      collisionMap[r] = rowStr.substring(0, c) + newChar + rowStr.substring(c + 1);
      
      // Immediate visual feedback redraw
      drawGame();
    }
  });
}

function resizePlayfield() {
  const playfield = document.querySelector('.playfield');
  const canvas = document.getElementById('game-canvas');
  const mazeElement = document.querySelector('.maze-bg');
  
  if (playfield && canvas && mazeElement) {
    // Clear inline sizes to let CSS fluid units calculate the correct layout
    playfield.style.width = '';
    playfield.style.height = '';
    
    const hud = document.querySelector('.game-hud');
    if (hud) hud.style.width = '';

    // Get actual bounding box of the rendered maze image in the DOM
    const rect = mazeElement.getBoundingClientRect();
    
    // Set canvas dimensions to match the image exactly
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Adjust playfield dimensions to wrap the image
    playfield.style.width = `${rect.width}px`;
    playfield.style.height = `${rect.height}px`;
    
    if (hud) hud.style.width = `${rect.width}px`;
  }
}

function drawDebugGrid(ctx) {
  const canvas = ctx.canvas;
  const { startX, startY, stepW, stepH, tileSize } = getGridGeometry(canvas);

  for (let r = 0; r < collisionMap.length; r++) {
    for (let c = 0; c < collisionMap[r].length; c++) {
      const char = collisionMap[r][c];
      
      const centerX = startX + c * stepW + stepW / 2;
      const centerY = startY + r * stepH + stepH / 2;
      const x = centerX - tileSize / 2;
      const y = centerY - tileSize / 2;
      
      // Grid line borders
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, tileSize, tileSize);
      
      // Color overlays
      if (char === 'W') {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Red blocked wall
      } else if (char === 'P') {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)'; // Green walkable path
      } else if (char === 'C') {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)'; // Yellow collectible
      } else if (char === 'G') {
        ctx.fillStyle = 'rgba(128, 0, 128, 0.4)'; // Purple ghost house
      }
      ctx.fillRect(x, y, tileSize, tileSize);
      
      // Highlight hovered coordinate cell
      if (hoveredCell && hoveredCell.r === r && hoveredCell.c === c) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.35)';
        ctx.fillRect(x, y, tileSize, tileSize);
        
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`R${r}C${c}`, centerX, centerY);
      }
    }
  }
}

function drawGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { startX, startY, stepW, stepH, tileSize } = getGridGeometry(canvas);

  // Draw normal pellets
  ctx.fillStyle = '#ffb8ae';
  gamePellets.forEach(p => {
    if (!p.active || p.power) return;
    const centerX = startX + p.c * stepW + stepW / 2;
    const centerY = startY + p.r * stepH + stepH / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw power pellets (energizers) — blink like the original arcade
  // The pellet is VISIBLE most of the time (6 out of 8 ticks), only briefly hidden.
  // powerPelletBlink is incremented in updateGame(), keeping it synced with game logic.
  const pelletVisible = (powerPelletBlink % PELLET_BLINK_PERIOD) < (PELLET_BLINK_PERIOD - PELLET_BLINK_OFF);
  gamePellets.forEach(p => {
    if (!p.active || !p.power) return;
    const centerX = startX + p.c * stepW + stepW / 2;
    const centerY = startY + p.r * stepH + stepH / 2;
    if (!pelletVisible) return; // brief blink-off phase
    const pulseRadius = tileSize * 0.32; // fixed size, no wobble — closer to original
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Ghosts (behind Pac-Man)
  drawGhosts(ctx);

  // Draw Pac-Man (use interpolated tile coords for smooth motion)
  ctx.fillStyle = '#FFD43B';
  ctx.beginPath();
  const centerX = startX + lerpCol(pacman) * stepW + stepW / 2;
  const centerY = startY + lerpRow(pacman) * stepH + stepH / 2;
  
  let angleOffset = 0;
  if (pacman.dir.c === 1)       angleOffset = 0;
  else if (pacman.dir.r === 1)  angleOffset = Math.PI / 2;
  else if (pacman.dir.c === -1) angleOffset = Math.PI;
  else if (pacman.dir.r === -1) angleOffset = -Math.PI / 2;

  // Mouth animates only while moving (original arcade behaviour)
  const isMoving = pacman.dir.r !== 0 || pacman.dir.c !== 0;
  if (isMoving) {
    pacman.open += 0.05 * pacman.openDir;
    if (pacman.open >= 1) { pacman.open = 1; pacman.openDir = -1; }
    if (pacman.open <= 0) { pacman.open = 0; pacman.openDir =  1; }
  } else {
    pacman.open = 0.35; // slightly open when idle, like the original
  }

  const mouthAngle = pacman.open * 0.25 * Math.PI; // max 45° opening (original)
  ctx.arc(centerX, centerY, tileSize * 0.45, angleOffset + mouthAngle, angleOffset + 2 * Math.PI - mouthAngle);
  ctx.lineTo(centerX, centerY);
  ctx.fill();

  if (EDIT_COLLISION_MAP) {
    drawDebugGrid(ctx);
  }
}

function updateGame() {
  const COLS_COUNT = collisionMap[0].length;
  const ROWS_COUNT = collisionMap.length;

  // Advance pellet blink counter every game tick
  powerPelletBlink++;

  // 1. Try to shift direction
  if (pacman.nextDir.r !== 0 || pacman.nextDir.c !== 0) {
    let nextR = pacman.r + pacman.nextDir.r;
    let nextC = pacman.c + pacman.nextDir.c;

    // Wrap only on designated tunnel rows
    if (TUNNEL_ROWS.has(pacman.r)) {
      if (nextC < 0) nextC = COLS_COUNT - 1;
      else if (nextC >= COLS_COUNT) nextC = 0;
    }

    if (nextR >= 0 && nextR < ROWS_COUNT && nextC >= 0 && nextC < COLS_COUNT) {
      const char = collisionMap[nextR][nextC];
      if (char === 'P' || char === 'C') {
        pacman.dir = { ...pacman.nextDir };
        pacman.nextDir = { r: 0, c: 0 };
      }
    }
  }

  // 2. Drive Pac-Man in the current active direction
  let nextR = pacman.r + pacman.dir.r;
  let nextC = pacman.c + pacman.dir.c;

  // Wrap only on designated tunnel rows
  if (TUNNEL_ROWS.has(pacman.r)) {
    if (nextC < 0) nextC = COLS_COUNT - 1;
    else if (nextC >= COLS_COUNT) nextC = 0;
  }

  if (nextR >= 0 && nextR < ROWS_COUNT && nextC >= 0 && nextC < COLS_COUNT) {
    const char = collisionMap[nextR][nextC];
    if (char === 'P' || char === 'C') {
      pacman.r = nextR;
      pacman.c = nextC;
    }
  }

  // 3. Collect pellets (normal + power)
  const pellet = gamePellets.find(p => p.active && p.r === pacman.r && p.c === pacman.c);
  if (pellet) {
    pellet.active = false;
    if (pellet.power) {
      // Power pellet eaten → frighten all active ghosts
      score += 50;
      frightenedTimer = FRIGHTENED_TICKS;
      ghosts.forEach(g => {
        if (g.state !== 'waiting') {
          g.state = 'frightened';
          // Reverse direction on frighten (original arcade behaviour)
          g.dir = { r: -g.dir.r, c: -g.dir.c };
        }
      });
      SFX.power();
    } else {
      score += 10;
      SFX[(pelletTick++ & 1) ? 'pelletA' : 'pelletB']();
    }
    updateHud();
  }

  // 4. Collect products (UNIQLO items — also sit on power-pellet tiles)
  collectibles.forEach(c => {
    if (!c.collected && c.r === pacman.r && c.c === pacman.c) {
      c.collected = true;
      unlockedItems.push(c.id);
      score += 1000;
      SFX.collectible();
      updateHud();
      checkWin();
    }
  });
}

let isPaused = false;
function togglePause() {
  if (!gameInterval) return; // only meaningful during an active session
  isPaused = !isPaused;
  document.getElementById('paused-overlay')?.classList.toggle('hidden', !isPaused);
  const btn = document.getElementById('btn-pause');
  if (btn) btn.textContent = isPaused ? 'RESUME' : 'PAUSE';
  SFX.pause();
  if (audioCtx) isPaused ? audioCtx.suspend() : audioCtx.resume();
}
function clearPauseState() {
  isPaused = false;
  document.getElementById('paused-overlay')?.classList.add('hidden');
  const btn = document.getElementById('btn-pause');
  if (btn) btn.textContent = 'PAUSE';
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function gameLoop() {
  if (isPaused) return; // freeze movement, ghosts, mode timers, collisions
  // Snapshot tile positions BEFORE moves — the render loop will lerp from
  // these to the new r/c values across the next 150 ms.
  pacman.prevR = pacman.r; pacman.prevC = pacman.c;
  ghosts.forEach(g => { g.prevR = g.r; g.prevC = g.c; });
  updateGame();
  updateGhosts();
  lastTickAt = performance.now();
}

function renderLoop() {
  renderId = requestAnimationFrame(renderLoop);
  drawGame(); // drawing decoupled from logic tick — runs at ~60 fps
}

function startGame() {
  const readyOverlay = document.getElementById('game-ready-overlay');
  if (readyOverlay) readyOverlay.classList.remove('hidden');

  resizePlayfield();
  initDebugMouseListener();
  resetGame();
  drawGame();
  clearPauseState();

  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn && !pauseBtn.dataset.wired) {
    pauseBtn.addEventListener('click', togglePause);
    pauseBtn.dataset.wired = '1';
  }

  ensureAudio();
  SFX.ready();

  // READY blinks while the start jingle plays, then game starts.
  let blink = 0;
  clearInterval(startBlinkInterval);
  startBlinkInterval = setInterval(() => {
    if (readyOverlay) readyOverlay.style.opacity = (++blink % 2) ? '0.3' : '1';
  }, 300);

  clearTimeout(startGameTimeout);
  startGameTimeout = setTimeout(() => {
    clearInterval(startBlinkInterval);
    startBlinkInterval = null;
    if (readyOverlay) {
      readyOverlay.classList.add('hidden');
      readyOverlay.style.opacity = '';
    }
    document.addEventListener('keydown', handleInput);

    clearInterval(gameInterval);
    lastTickAt = performance.now();
    gameInterval = setInterval(gameLoop, TICK_MS);
    cancelAnimationFrame(renderId);
    renderId = requestAnimationFrame(renderLoop);
  }, 3000);
}

function stopGame() {
  clearInterval(gameInterval);
  gameInterval = null;
  cancelAnimationFrame(renderId);
  renderId = 0;

  clearTimeout(startGameTimeout);
  startGameTimeout = null;
  clearInterval(startBlinkInterval);
  startBlinkInterval = null;

  document.removeEventListener('keydown', handleInput);
  clearPauseState();

  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend();
  }
}

// Automatically pause the game if the tab loses focus or is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameInterval && !isPaused) {
    togglePause();
  }
});

function handleInput(e) {
  if (e.key === 'p' || e.key === 'P') { togglePause(); e.preventDefault(); return; }
  if (isPaused) return; // ignore movement input while paused
  if (e.key === 'ArrowUp') pacman.nextDir = { r: -1, c: 0 };
  if (e.key === 'ArrowDown') pacman.nextDir = { r: 1, c: 0 };
  if (e.key === 'ArrowLeft') pacman.nextDir = { r: 0, c: -1 };
  if (e.key === 'ArrowRight') pacman.nextDir = { r: 0, c: 1 };
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
      e.preventDefault();
  }
}

function checkWin() {
  if (unlockedItems.length === TOTAL_ITEMS) {
    clearInterval(gameInterval);
    gameInterval = null;
    cancelAnimationFrame(renderId);
    clearPauseState();
    document.removeEventListener('keydown', handleInput);
    document.getElementById('reward-overlay').classList.remove('hidden');
    hasDiscount = true;
    SFX.reward();
  }
}

// =========================================
// GHOST AI
// =========================================

function initGhosts() {
  ghosts = GHOST_SPAWN_DATA.map(g => ({
    ...g,
    // Blinky (releaseAt:0) starts in scatter immediately; others start 'waiting' inside house
    state: g.releaseAt === 0 ? globalGhostMode || 'scatter' : 'waiting',
    bobOffset: 0,    // sub-tile bobbing offset for waiting ghosts (0.0–1.0 fractional row)
    bobDir: 1,       // +1 = moving down, -1 = moving up
    exitStep: 0,     // used during 'exiting' state
  }));
  gameTick       = 0;
  ghostModeTick  = 0;
  ghostModePhase = 0;
  globalGhostMode = 'scatter';
}

// Ghost AI: each personality picks a target tile; the navigation in
// moveGhost() greedily steps toward it on the collision grid.
//   blinky → direct chase: aims straight at Pac-Man's tile.
//   pinky  → ambush: aims 4 tiles ahead of Pac-Man's facing direction.
//   inky   → flanking: aims at the tile vector from Blinky through a point
//            2 tiles ahead of Pac-Man (so it depends on Blinky's position).
//   clyde  → shy: chases when far (> 8 tiles) but retreats to his scatter
//            corner when close, producing the "wandering" feel.
// In scatter mode all four head for their own corner instead.
// Cruise Elroy: when only a handful of pellets remain, Blinky stays in
// chase even during scatter phases — gives the end-game extra pressure.
function getGhostTarget(ghost) {
  const activePellets = gamePellets.filter(p => p.active).length;
  const cruiseElroy = ghost.id === 'blinky' && activePellets <= 20;

  if (ghost.state === 'scatter' && !cruiseElroy) return ghost.scatter;

  switch (ghost.id) {
    case 'blinky':
      return { r: pacman.r, c: pacman.c };

    case 'pinky':
      return { r: pacman.r + pacman.dir.r * 4, c: pacman.c + pacman.dir.c * 4 };

    case 'inky': {
      const blinky = ghosts.find(g => g.id === 'blinky');
      const pr = pacman.r + pacman.dir.r * 2;
      const pc = pacman.c + pacman.dir.c * 2;
      // Fall back to direct chase if Blinky isn't on the board yet.
      if (!blinky) return { r: pacman.r, c: pacman.c };
      return { r: pr + (pr - blinky.r), c: pc + (pc - blinky.c) };
    }

    case 'clyde': {
      const dr = ghost.r - pacman.r;
      const dc = ghost.c - pacman.c;
      return (dr * dr + dc * dc) > 64 ? { r: pacman.r, c: pacman.c } : ghost.scatter;
    }

    default:
      return { r: pacman.r, c: pacman.c };
  }
}

function getValidGhostMoves(ghost) {
  const ROWS = collisionMap.length;
  const COLS = collisionMap[0].length;
  const DIRS = [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }];

  return DIRS.filter(d => {
    if (d.r === -ghost.dir.r && d.c === -ghost.dir.c) return false; // no U-turn

    const nr = ghost.r + d.r;
    // Ghosts can only wrap horizontally on tunnel rows
    let nc = ghost.c + d.c;
    if (TUNNEL_ROWS.has(ghost.r)) {
      nc = (nc + COLS) % COLS;
    }

    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;

    const ch = collisionMap[nr][nc];
    return ch === 'P' || ch === 'C';
  });
}

function moveGhost(ghost) {
  const COLS  = collisionMap[0].length;
  const moves = getValidGhostMoves(ghost);

  if (moves.length === 0) {
    // Dead end — allow a U-turn back the way the ghost came.
    // Only wrap horizontally when on a designated tunnel row, otherwise the
    // ghost would teleport across the map and appear to pass through walls.
    const rev = { r: -ghost.dir.r, c: -ghost.dir.c };
    const nr  = ghost.r + rev.r;
    let nc    = ghost.c + rev.c;
    if (TUNNEL_ROWS.has(ghost.r)) nc = (nc + COLS) % COLS;
    if (nr < 0 || nr >= collisionMap.length || nc < 0 || nc >= COLS) return;
    const ch  = collisionMap[nr]?.[nc];
    if (ch === 'P' || ch === 'C') { ghost.dir = rev; ghost.r = nr; ghost.c = nc; }
    return;
  }

  let chosen;

  if (ghost.state === 'frightened') {
    chosen = moves[Math.floor(Math.random() * moves.length)];
  } else {
    const target = getGhostTarget(ghost);
    let bestDist = Infinity;
    let bestDir  = null;
    for (const d of moves) {
      const nr = ghost.r + d.r;
      // Use tunnel-aware wrap for distance calculation too
      let nc = ghost.c + d.c;
      if (TUNNEL_ROWS.has(ghost.r)) nc = (nc + COLS) % COLS;
      const dist = (nr - target.r) ** 2 + (nc - target.c) ** 2;
      if (dist < bestDist) { bestDist = dist; bestDir = d; }
    }
    chosen = bestDir;
  }

  if (!chosen) return;
  ghost.dir = chosen;
  ghost.r  += chosen.r;
  // Apply horizontal wrap only on tunnel rows
  if (TUNNEL_ROWS.has(ghost.r)) {
    ghost.c = (ghost.c + chosen.c + COLS) % COLS;
  } else {
    ghost.c += chosen.c;
  }
}

function updateGhostModePhase() {
  if (ghostModePhase >= GHOST_PHASE_SCHEDULE.length - 1) return;

  ghostModeTick++;
  if (ghostModeTick >= GHOST_PHASE_SCHEDULE[ghostModePhase].duration) {
    ghostModeTick = 0;
    ghostModePhase++;
    globalGhostMode = GHOST_PHASE_SCHEDULE[ghostModePhase].mode;

    ghosts.forEach(g => {
      if (g.state !== 'frightened' && g.state !== 'waiting') {
        g.state = globalGhostMode;
        g.dir   = { r: -g.dir.r, c: -g.dir.c }; // reverse on mode switch
      }
    });
  }
}

function updateGhosts() {
  gameTick++;

  // Count down frightened timer
  if (frightenedTimer > 0) {
    frightenedTimer--;
    if (frightenedTimer === 0) {
      // Frightened time expired → restore scatter/chase state
      ghosts.forEach(g => {
        if (g.state === 'frightened') g.state = globalGhostMode;
      });
    }
  }

  // Release waiting ghosts → transition to 'exiting' state so they navigate out of the house
  ghosts.forEach(g => {
    if (g.state === 'waiting' && gameTick >= g.releaseAt) {
      g.state = 'exiting';
      g.exitStep = 0;
    }
  });

  // Animate waiting ghosts (bob up/down inside house) and exiting ghosts
  ghosts.forEach(g => {
    if (g.state === 'waiting') {
      // Sub-tile bobbing: bobOffset oscillates between 0 and 0.5 (half a cell)
      g.bobOffset = (g.bobOffset || 0) + 0.05 * (g.bobDir || 1);
      if (g.bobOffset >= 0.4) g.bobDir = -1;
      if (g.bobOffset <= 0.0) g.bobDir = 1;
    } else if (g.state === 'exiting') {
      moveGhostExiting(g);
    }
  });

  updateGhostModePhase();
  ghosts.forEach(g => {
    if (g.state === 'waiting' || g.state === 'exiting') return;
    // Frightened ghosts move at half speed (every other tick) — classic
    // arcade behaviour: gives Pac-Man a fair window to catch them.
    if (g.state === 'frightened' && (gameTick & 1)) return;
    moveGhost(g);
  });
  checkGhostCollision();
}

// Moves a ghost step-by-step out of the ghost house.
// Path: move to center col (col 7), then move up to gate row (row 5), then enter scatter/chase.
// Movement is throttled: one cell every 2 ticks to feel like the original arcade exit speed.
function moveGhostExiting(ghost) {
  const GATE_COL = GHOST_HOUSE_GATE.c; // 7
  const GATE_ROW = GHOST_HOUSE_GATE.r; // 5

  // Throttle: only move one step every 2 game ticks
  ghost._exitCooldown = (ghost._exitCooldown || 0) - 1;
  if (ghost._exitCooldown > 0) return;
  ghost._exitCooldown = 2;

  // Step 1: Navigate horizontally to the center column (col 7)
  if (ghost.c !== GATE_COL) {
    const dc = ghost.c < GATE_COL ? 1 : -1;
    ghost.c += dc;
    ghost.dir = { r: 0, c: dc };
    return;
  }

  // Step 2: Navigate upward to the gate row
  if (ghost.r > GATE_ROW) {
    ghost.r -= 1;
    ghost.dir = { r: -1, c: 0 };
    return;
  }

  // Step 3: Ghost has reached the gate — enter the maze
  ghost.r = GATE_ROW;
  ghost.c = GATE_COL;
  ghost.dir = { r: 0, c: -1 }; // exit heading left (original Pac-Man behaviour)
  ghost.state = globalGhostMode;
  ghost.bobOffset = 0;
  ghost._exitCooldown = 0;
}

function checkGhostCollision() {
  for (const ghost of ghosts) {
    if (ghost.state === 'waiting' || ghost.state === 'exiting') continue;
    
    const sameTile = (ghost.r === pacman.r && ghost.c === pacman.c);
    const swapped = (ghost.prevR === pacman.r && ghost.prevC === pacman.c && ghost.r === pacman.prevR && ghost.c === pacman.prevC);
    
    if (sameTile || swapped) {
      if (ghost.state === 'frightened') {
        // Pac-Man eats the frightened ghost → send it back to house
        score += 200;
        SFX.eatGhost();
        updateHud();
        const spawnData = GHOST_SPAWN_DATA.find(d => d.id === ghost.id);
        // Return to center of house
        ghost.r = spawnData.houseR;
        ghost.c = spawnData.houseC;
        ghost.dir = spawnData.dir;
        ghost.state = 'waiting';
        ghost.bobOffset = 0;
        ghost.bobDir = 1;
        // Re-release quickly so the game keeps moving
        ghost._reentry = gameTick + 20;
      } else {
        triggerGameOver();
        return;
      }
    }
    // Handle re-entry after being eaten
    if (ghost.state === 'waiting' && ghost._reentry && gameTick >= ghost._reentry) {
      ghost.state = 'exiting';
      ghost.exitStep = 0;
      ghost._reentry = null;
    }
  }
}

function triggerGameOver() {
  clearInterval(gameInterval);
  gameInterval = null;
  cancelAnimationFrame(renderId);
  clearPauseState();
  SFX.death();
  document.removeEventListener('keydown', handleInput);
  document.getElementById('game-over-overlay').classList.remove('hidden');
}

function drawGhostBody(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.05, r, Math.PI, 0, false);
  ctx.lineTo(x + r, y + r * 0.9);
  const bumpW = (2 * r) / 3;
  for (let i = 3; i > 0; i--) {
    ctx.quadraticCurveTo(x + r - (i - 0.5) * bumpW, y + r * 1.1, x + r - i * bumpW, y + r * 0.9);
  }
  ctx.lineTo(x - r, y + r * 0.9);
  ctx.closePath();
  ctx.fill();
}

function drawGhostEyes(ctx, x, y, r) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.1, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.32, y - r * 0.1, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0000CC';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.08, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.36, y - r * 0.08, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGhosts(ctx) {
  const canvas = ctx.canvas;
  const { startX, startY, stepW, stepH, tileSize } = getGridGeometry(canvas);
  const r = tileSize * 0.42;

  // Flash threshold: last 2 seconds (original arcade warning)
  const FLASH_TICKS = Math.round(2000 / 150);

  ghosts.forEach(ghost => {
    let x, y;

    if (ghost.state === 'waiting') {
      // Draw inside ghost house with bobbing animation
      x = startX + ghost.c * stepW + stepW / 2;
      // bobOffset moves the ghost up/down by up to half a cell
      let bob = (ghost.bobOffset || 0);
      if (ghost.r === 7) {
        // Bob upwards for the bottom row (Inky/Clyde) to avoid touching the bottom wall
        y = startY + ghost.r * stepH + stepH / 2 - bob * stepH;
      } else {
        // Standard bobbing for other rows (Pinky/Blinky at row 6)
        y = startY + ghost.r * stepH + stepH / 2 + bob * stepH - stepH * 0.2;
      }
      // Draw with slightly reduced opacity to indicate they're locked in
      ctx.globalAlpha = 0.85;
      drawGhostBody(ctx, x, y, r * 0.9, ghost.color);
      drawGhostEyes(ctx, x, y, r * 0.9);
      ctx.globalAlpha = 1.0;
      return;
    }

    x = startX + lerpCol(ghost) * stepW + stepW / 2;
    y = startY + lerpRow(ghost) * stepH + stepH / 2;

    let bodyColor = ghost.color;
    let showEyes  = true;
    let frightened = false;

    if (ghost.state === 'frightened') {
      frightened = true;
      showEyes = false;
      if (frightenedTimer <= FLASH_TICKS) {
        // Flash between blue and white — frame-rate synced via gameTick
        bodyColor = (gameTick % 4 < 2) ? '#0000DD' : '#ffffff';
      } else {
        bodyColor = '#0000DD';
      }
    }

    drawGhostBody(ctx, x, y, r, bodyColor);
    if (frightened) {
      drawFrightenedFace(ctx, x, y, r, bodyColor);
    } else if (showEyes) {
      drawGhostEyes(ctx, x, y, r);
    }
  });
}

// Draws the classic frightened ghost face: white eyes + zigzag mouth
function drawFrightenedFace(ctx, x, y, r, bodyColor) {
  // Eyes: two small white dots
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // Mouth: classic zigzag (wavy line)
  const mouthY = y + r * 0.25;
  const mouthLeft  = x - r * 0.45;
  const mouthRight = x + r * 0.45;
  const zigH = r * 0.18;
  const segs = 4;
  const segW = (mouthRight - mouthLeft) / segs;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(mouthLeft, mouthY);
  for (let i = 0; i < segs; i++) {
    const px = mouthLeft + (i + 0.5) * segW;
    const py = mouthY + (i % 2 === 0 ? zigH : -zigH);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(mouthRight, mouthY);
  ctx.stroke();
}


// Back to start menu
document.getElementById('btn-back-to-menu')?.addEventListener('click', () => {
  clearInterval(gameInterval);
  gameInterval = null;
  cancelAnimationFrame(renderId);
  clearPauseState();
  document.removeEventListener('keydown', handleInput);
  resetGame();
  startMegaTransition('gameStart', () => {
    // Ensure the menu content is visible and other startup phases are hidden
    document.getElementById('startup-self-test')?.classList.add('hidden');
    document.getElementById('startup-attract')?.classList.add('hidden');
    const menuContent = document.getElementById('start-menu-content');
    if (menuContent) {
      menuContent.classList.remove('hidden');
      menuContent.style.opacity = '1';
    }
  }, true);
});

// Skip game
document.getElementById('btn-skip-game')?.addEventListener('click', () => {
  stopGame();
  resetGame();
  hasDiscount = hasDiscount || false;
  startMegaTransition('arcadeCollection', () => {
    renderArcadeCollection();
    initArcadeCollection();
  });
});

// Reward actions
document.getElementById('btn-shop-unlocked')?.addEventListener('click', () => {
  document.getElementById('reward-overlay').classList.add('hidden');
  stopGame();
  resetGame();
  startMegaTransition('arcadeCollection', () => {
    renderArcadeCollection();
    initArcadeCollection();
  });
});

document.getElementById('btn-replay')?.addEventListener('click', () => {
  document.getElementById('reward-overlay').classList.add('hidden');
  resetGame();
  startGame();
});

document.getElementById('btn-replay-from-shop')?.addEventListener('click', () => {
  arcadeCollectionActive = false;
  document.removeEventListener('keydown', handleArcadeKeyboard);
  closeProductViewer();
  resetGame();
  startMegaTransition('gameplay', () => {
    startGame();
  });
});

document.getElementById('btn-retry-game')?.addEventListener('click', () => {
  document.getElementById('game-over-overlay').classList.add('hidden');
  resetGame();
  startGame();
});

document.getElementById('btn-skip-from-over')?.addEventListener('click', () => {
  document.getElementById('game-over-overlay').classList.add('hidden');
  stopGame();
  resetGame();
  hasDiscount = hasDiscount || false;
  startMegaTransition('arcadeCollection', () => {
    renderArcadeCollection();
    initArcadeCollection();
  });
});

function resetGame() {
  pacman.r = 11; pacman.c = 7;
  pacman.dir = { r: 0, c: 0 };
  pacman.nextDir = { r: 0, c: 0 };
  pacman.open = 0;
  pacman.openDir = 1;
  score = 0;
  frightenedTimer = 0;
  powerPelletBlink = 0;
  updateHud();
  collectibles.forEach(c => c.collected = false);
  unlockedItems = [];
  generateMapAndPellets();
  initGhosts();
}

// Play from Skip Screen
document.getElementById('btn-play-from-skip')?.addEventListener('click', () => {
  arcadeCollectionActive = false;
  document.removeEventListener('keydown', handleArcadeKeyboard);
  closeProductViewer();
  resetGame();
  startMegaTransition('gameStart', () => {
    // Ensure the menu content is visible and other startup phases are hidden
    document.getElementById('startup-self-test')?.classList.add('hidden');
    document.getElementById('startup-attract')?.classList.add('hidden');
    const menuContent = document.getElementById('start-menu-content');
    if (menuContent) {
      menuContent.classList.remove('hidden');
      menuContent.style.opacity = '1';
    }
  }, true);
});

// =========================================
// SCREEN 7: COLLECTION
// =========================================
const productsData = [
  { id: 'tshirt',     name: 'Pac-Man Graphic T-Shirt',    price: 24.90, pixelIcon: '/assets/icon-tshirt-pixel.png.png',     hasVariants: true, variants: { black: '/assets/products/tshirt-black.png',     white: '/assets/products/tshirt-white.png'     } },
  { id: 'sweatshirt', name: 'Pac-Man Arcade Hoodie',      price: 49.90, pixelIcon: '/assets/icon-sweatshirt-pixel.png.png', hasVariants: true, variants: { black: '/assets/products/hoodie-black.png', white: '/assets/products/hoodie-white.png' } },
  { id: 'cap',        name: 'Pac-Man Logo Cap',           price: 19.90, pixelIcon: '/assets/icon-cap-pixel.png.png',       hasVariants: true, variants: { black: '/assets/products/cap-black.png',       white: '/assets/products/cap-white.png'       } },
  { id: 'tote',       name: 'UNIQLO x Pac-Man Bag',       price: 14.90, pixelIcon: '/assets/icon-bag-pixel.png.png',       hasVariants: true, variants: { black: '/assets/products/bag-black.png',       white: '/assets/products/bag-white.png'       } }
];



// =========================================
// SCREEN 8: ARCADE COLLECTION (MAME-STYLE SELECTOR)
// =========================================
let arcadeActiveIndex = 0;
let arcadeCollectionActive = false;

function renderArcadeCollection() {
  const list = document.getElementById('arcade-product-list');
  if (!list) return;
  list.innerHTML = '';

  const statusEl = document.getElementById('arcade-header-status');
  if (statusEl) {
    if (hasDiscount) {
      statusEl.innerText = '[ REWARD: 20% OFF ACTIVE ]';
      statusEl.classList.add('blink-fast');
      statusEl.style.color = 'var(--pacman-yellow)';
    } else {
      statusEl.innerText = '[ STANDARD STORE ]';
      statusEl.classList.remove('blink-fast');
      statusEl.style.color = '#888';
    }
  }

  // Toggle skip game prompt & replay button depending on reward status
  if (hasDiscount) {
    document.getElementById('skip-game-prompt')?.classList.add('hidden');
    document.getElementById('btn-replay-from-shop')?.classList.remove('hidden');
  } else {
    document.getElementById('skip-game-prompt')?.classList.remove('hidden');
    document.getElementById('btn-replay-from-shop')?.classList.add('hidden');
  }

  productsData.forEach((p, index) => {
    const numStr = String(index + 1).padStart(4, '0');
    const item = document.createElement('div');
    item.className = `arcade-product-item ${index === arcadeActiveIndex ? 'selected' : ''}`;
    item.dataset.index = index;
    
    item.innerHTML = `
      <span class="cursor-indicator">›</span>
      <span class="item-number">${numStr}</span>
      <span class="item-name">${p.name.toUpperCase()}</span>
    `;
    
    list.appendChild(item);
  });
}

function initArcadeCollection() {
  arcadeActiveIndex = 0;
  arcadeCollectionActive = true;
  
  // First render the items list
  renderArcadeCollection();
  
  // Highlight the default item and run the Three.js preview
  updateArcadeSelection();

  // Mouse hover & click
  const items = document.querySelectorAll('.arcade-product-item');
  items.forEach(item => {
    item.addEventListener('mouseenter', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      if (arcadeActiveIndex !== idx) {
        arcadeActiveIndex = idx;
        updateArcadeSelection();
      }
    });
    
    item.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      if (arcadeActiveIndex === idx) {
        // Double-click or click active to view detailed item color/size modal
        openItemView(productsData[arcadeActiveIndex].id);
      } else {
        arcadeActiveIndex = idx;
        updateArcadeSelection();
      }
    });
  });

  // Bind "► VIEW ITEM" button on screen
  const viewBtn = document.getElementById('arc-view-item-btn');
  if (viewBtn) {
    viewBtn.onclick = () => {
      if (arcadeActiveIndex >= 0 && arcadeActiveIndex < productsData.length) {
        openItemView(productsData[arcadeActiveIndex].id);
      }
    };
  }

  // Keyboard navigation
  document.removeEventListener('keydown', handleArcadeKeyboard);
  document.addEventListener('keydown', handleArcadeKeyboard);
}

function updateArcadeSelection() {
  const items = document.querySelectorAll('.arcade-product-item');
  items.forEach((item, idx) => {
    if (idx === arcadeActiveIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  const selectedProduct = productsData[arcadeActiveIndex];
  if (!selectedProduct) return;

  // Update top right cabinet counter (MAME style)
  const counterEl = document.getElementById('crt-item-counter');
  if (counterEl) {
    counterEl.innerText = `ITEM ${String(arcadeActiveIndex + 1).padStart(2, '0')}/${String(productsData.length).padStart(2, '0')}`;
  }

  // Update preview text details below monitor
  const previewNumEl = document.getElementById('arc-preview-number');
  const previewNameEl = document.getElementById('arc-preview-name');
  const previewPriceEl = document.getElementById('arc-preview-price');

  if (previewNumEl) previewNumEl.innerText = String(arcadeActiveIndex + 1).padStart(4, '0');
  if (previewNameEl) previewNameEl.innerText = selectedProduct.name.toUpperCase();
  
  if (previewPriceEl) {
    if (hasDiscount) {
      const discounted = (selectedProduct.price * 0.8).toFixed(2);
      previewPriceEl.innerHTML = `<span class="orig-price-strike">$${selectedProduct.price.toFixed(2)}</span>$${discounted}`;
    } else {
      previewPriceEl.innerText = `$${selectedProduct.price.toFixed(2)}`;
    }
  }

  // Handle the WebGL product preview update (using existing sandwich layer code)
  const container = document.getElementById('arc-preview-container');
  if (container) {
    const isFirstTime = !productScene;
    if (isFirstTime) {
      initProductViewer(container, selectedProduct.variants['black']);
    } else {
      updateProductViewerTexture(selectedProduct.variants['black']);
    }
  }
}

function handleArcadeKeyboard(e) {
  if (!arcadeCollectionActive) return;

  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    arcadeActiveIndex = (arcadeActiveIndex - 1 + productsData.length) % productsData.length;
    updateArcadeSelection();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    arcadeActiveIndex = (arcadeActiveIndex + 1) % productsData.length;
    updateArcadeSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    openItemView(productsData[arcadeActiveIndex].id);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    exitArcadeCollection();
  }
}

function exitArcadeCollection() {
  arcadeCollectionActive = false;
  document.removeEventListener('keydown', handleArcadeKeyboard);
  closeProductViewer();
  startMegaTransition('gameStart');
}

// =========================================
// ITEM VIEW MODAL LOGIC
// =========================================
let currentViewItem = null;

let productScene, productCamera, productRenderer, productGroup, productAnimationId, productResizeHandler;
const productTextureCache = {};

function initProductViewer(container, imageUrl) {
  // Clear container
  container.innerHTML = '';
  
  // Create Scene
  productScene = new THREE.Scene();
  productScene.background = null; // transparent background for overlay blend
  
  // Create Camera (narrow FOV for a high-end collectible appearance)
  productCamera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 100);
  productCamera.position.set(0, 0, 8);
  
  // Create Renderer
  productRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  productRenderer.setSize(container.clientWidth, container.clientHeight);
  productRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(productRenderer.domElement);
  
  // Specular Dynamic Lighting Setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  ambientLight.name = 'productAmbientLight';
  productScene.add(ambientLight);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
  dirLight.name = 'productDirLight';
  dirLight.position.set(5, 5, 4);
  productScene.add(dirLight);
  
  const rimLight = new THREE.DirectionalLight(0x00ffff, 0.45); // Arcade Cyan rim highlight
  rimLight.name = 'productRimLight';
  rimLight.position.set(-5, -3, -2);
  productScene.add(rimLight);
  
  const yellowLight = new THREE.DirectionalLight(0xffd43b, 0.4); // Pac-Man yellow ambient highlight
  yellowLight.name = 'productYellowLight';
  yellowLight.position.set(2, -2, 3);
  productScene.add(yellowLight);

  // Group for floating and rotation animation
  productGroup = new THREE.Group();
  productScene.add(productGroup);
  
  // Render Sandwich layers
  const buildLayers = (texture) => {
    productGroup.clear(); // Clear any old layers first
    
    const layerCount = 24;
    const thickness = 0.22;
    const width = 2.4;
    const height = 2.4;
    const geom = new THREE.PlaneGeometry(width, height);
    
    const isWhite = imageUrl.includes('white');
    
    for (let i = 0; i < layerCount; i++) {
      // Calculate how close this layer is to the center (0 = outer, 1 = center)
      const centerFactor = 1.0 - Math.abs(i - (layerCount - 1) / 2) / ((layerCount - 1) / 2);
      
      let tint, roughness, metalness;
      if (isWhite) {
        // Soft off-white cap to prevent clipping/burnout, plus ambient occlusion depth
        tint = 0.93 - centerFactor * 0.38;
        roughness = 0.95; // Fabric matte look, diffuses lighting beautifully
        metalness = 0.0;  // Fully non-metallic to prevent hot shiny spots
      } else {
        // Standard original premium shading for dark/black items
        tint = 1.0 - centerFactor * 0.42; 
        roughness = 0.35;
        metalness = 0.15;
      }
      
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: roughness,
        metalness: metalness,
        side: THREE.DoubleSide,
        alphaTest: 0.05,
        color: new THREE.Color(tint, tint, tint)
      });
      
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.z = -thickness/2 + (i / (layerCount - 1)) * thickness;
      productGroup.add(mesh);
    }
  };

  // Load from cache or remote
  if (productTextureCache[imageUrl]) {
    buildLayers(productTextureCache[imageUrl]);
  } else {
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      productTextureCache[imageUrl] = texture;
      buildLayers(texture);
    });
  }
  
  // Call shading adjustment to set correct light intensities
  adjustViewerShading(imageUrl.includes('white'));
  
  // Canvas-based radial soft shadow under the item
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false
  });
  
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -1.65;
  productScene.add(shadowMesh);
  
  // Animation loop
  const clock = new THREE.Clock();
  function animate() {
    productAnimationId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    
    if (productGroup) {
      // Gentle Bobbing
      productGroup.position.y = Math.sin(elapsed * 1.8) * 0.15;
      
      // Slow rotation
      productGroup.rotation.y = elapsed * 0.65;
      
      // Secondary minor tilts for premium 3D feeling
      productGroup.rotation.x = Math.sin(elapsed * 0.9) * 0.08;
      productGroup.rotation.z = Math.cos(elapsed * 0.9) * 0.05;
      
      // Shadow responds in size and opacity
      if (shadowMesh) {
        const h = productGroup.position.y;
        const s = 1.0 - h * 0.32;
        shadowMesh.scale.set(s, s, 1);
        shadowMesh.material.opacity = 0.75 - h * 0.45;
      }
    }
    
    productRenderer.render(productScene, productCamera);
  }
  
  animate();
  
  // Resize Handler
  productResizeHandler = () => {
    if (!productCamera || !productRenderer || !container) return;
    productCamera.aspect = container.clientWidth / container.clientHeight;
    productCamera.updateProjectionMatrix();
    productRenderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', productResizeHandler);
}

function adjustViewerShading(isWhite) {
  if (!productScene) return;
  
  const ambientLight = productScene.getObjectByName('productAmbientLight');
  const dirLight = productScene.getObjectByName('productDirLight');
  const rimLight = productScene.getObjectByName('productRimLight');
  const yellowLight = productScene.getObjectByName('productYellowLight');
  
  if (isWhite) {
    if (ambientLight) ambientLight.intensity = 0.75; // Soft ambient fill
    if (dirLight) {
      dirLight.intensity = 0.35; // Soft, low specular key
      dirLight.position.set(3, 4, 5); // Softer angle to avoid front blowout
    }
    if (rimLight) rimLight.intensity = 0.15; // Softened arcade highlights
    if (yellowLight) yellowLight.intensity = 0.12;
  } else {
    // Restore premium high-contrast arcade shading for dark items
    if (ambientLight) ambientLight.intensity = 0.65;
    if (dirLight) {
      dirLight.intensity = 1.3;
      dirLight.position.set(5, 5, 4);
    }
    if (rimLight) rimLight.intensity = 0.45;
    if (yellowLight) yellowLight.intensity = 0.4;
  }

  // Update material properties of existing sandwich layers if they exist
  if (productGroup) {
    const layerCount = productGroup.children.length;
    productGroup.children.forEach((mesh, i) => {
      if (mesh.material) {
        const centerFactor = 1.0 - Math.abs(i - (layerCount - 1) / 2) / ((layerCount - 1) / 2);
        
        if (isWhite) {
          const tint = 0.93 - centerFactor * 0.38;
          mesh.material.color.setRGB(tint, tint, tint);
          mesh.material.roughness = 0.95;
          mesh.material.metalness = 0.0;
        } else {
          const tint = 1.0 - centerFactor * 0.42;
          mesh.material.color.setRGB(tint, tint, tint);
          mesh.material.roughness = 0.35;
          mesh.material.metalness = 0.15;
        }
        mesh.material.needsUpdate = true;
      }
    });
  }
}

function updateProductViewerTexture(imageUrl) {
  if (!productGroup) return;
  
  const isWhite = imageUrl.includes('white');
  
  const applyTexture = (texture) => {
    productGroup.children.forEach(mesh => {
      if (mesh.material) {
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }
    });
    // Dynamically adjust lighting and material shading parameters for the active variant
    adjustViewerShading(isWhite);
  };
  
  if (productTextureCache[imageUrl]) {
    applyTexture(productTextureCache[imageUrl]);
  } else {
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      productTextureCache[imageUrl] = texture;
      applyTexture(texture);
    });
  }
}

function closeProductViewer() {
  if (productAnimationId) {
    cancelAnimationFrame(productAnimationId);
    productAnimationId = null;
  }
  if (productResizeHandler) {
    window.removeEventListener('resize', productResizeHandler);
    productResizeHandler = null;
  }
  if (productRenderer) {
    productRenderer.dispose();
    if (productRenderer.domElement && productRenderer.domElement.parentNode) {
      productRenderer.domElement.parentNode.removeChild(productRenderer.domElement);
    }
    productRenderer = null;
  }
  if (productGroup) {
    productGroup.children.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    productGroup = null;
  }
  productScene = null;
  productCamera = null;
}

function openItemView(productId) {
  const item = productsData.find(p => p.id === productId);
  if (!item) return;

  if (!item.hasVariants) {
    alert("3D Item View is coming soon for this product!");
    return;
  }

  // Cleanup active WebGL shop selection preview before opening the modal detailed view
  closeProductViewer();

  // Make the CRT overlay stronger for the focused item detail view
  const crt = document.getElementById('crt-overlay');
  if (crt) {
    crt.classList.remove('reduced-crt');
  }

  currentViewItem = item;
  
  // Set UI Text
  document.getElementById('item-view-name').innerText = item.name;
  
  const priceDisplay = document.getElementById('item-view-price');
  if (hasDiscount) {
    priceDisplay.innerHTML = `
      <span style="font-size:1rem; color:#555; text-decoration:line-through; margin-right:10px;">$${item.price.toFixed(2)}</span>
      <span style="color:var(--uniqlo-red);">$${(item.price * 0.8).toFixed(2)}</span>
    `;
    priceDisplay.classList.add('discount-text');
  } else {
    priceDisplay.innerHTML = `$${item.price.toFixed(2)}`;
    priceDisplay.classList.remove('discount-text');
  }

  // Show Modal
  document.getElementById('item-view-overlay').classList.remove('hidden');

  // Initialize Three.js WebGL product view inside .floating-item-scene
  const container = document.querySelector('.floating-item-scene');
  if (container) {
    initProductViewer(container, item.variants['black']);
  }

  // Reset color selector active buttons to Black
  document.querySelectorAll('.color-btn').forEach(btn => {
    if (btn.dataset.color === 'black') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Reset size selector - select M by default
  document.querySelectorAll('.size-btn').forEach(btn => {
    if (btn.dataset.size === 'M') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Hide size selector for non-apparel (cap and bag)
  const sizeContainer = document.getElementById('item-view-size-container');
  if (sizeContainer) {
    if (item.id === 'tshirt' || item.id === 'sweatshirt') {
      sizeContainer.style.display = 'block';
    } else {
      sizeContainer.style.display = 'none';
    }
  }

  const imgEl = document.getElementById('floating-item-image');
  if (imgEl) {
    imgEl.src = item.variants['black'];
  }
}

function updateItemViewColor(color) {
  if (!currentViewItem || !currentViewItem.hasVariants) return;
  
  // Update floating image src (if the element still exists, though the canvas replaced it)
  const imgEl = document.getElementById('floating-item-image');
  if (imgEl) {
    imgEl.src = currentViewItem.variants[color];
  }

  // Update Three.js WebGL texture immediately
  updateProductViewerTexture(currentViewItem.variants[color]);

  // Update active button state
  document.querySelectorAll('.color-btn').forEach(btn => {
    if (btn.dataset.color === color) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Bind Color Selectors
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    updateItemViewColor(e.target.dataset.color);
  });
});

// Bind Size Selectors
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  });
});

// Bind Close Button
document.getElementById('btn-close-item-view').addEventListener('click', () => {
  document.getElementById('item-view-overlay').classList.add('hidden');
  currentViewItem = null;
  
  // Cleanup Three.js product viewer
  closeProductViewer();

  // Re-initialize shop preview if arcade collection is active
  if (arcadeCollectionActive) {
    // Restore the lighter CRT effect for the selection screen overview
    const crt = document.getElementById('crt-overlay');
    if (crt) {
      crt.classList.add('reduced-crt');
    }

    const container = document.getElementById('arc-preview-container');
    if (container) {
      const selectedProduct = productsData[arcadeActiveIndex];
      initProductViewer(container, selectedProduct.variants['black']);
    }
  }
});

// =========================================
// SHOPPING BAG / CART SYSTEM STATE & OPERATIONS
// =========================================
let cartList = [];

// Open / Close Shopping Bag
function toggleShoppingBag(show) {
  const drawer = document.getElementById('shopping-bag-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (!drawer || !backdrop) return;
  
  if (show) {
    updateCartUI();
    drawer.classList.add('active');
    backdrop.classList.add('active');
  } else {
    drawer.classList.remove('active');
    backdrop.classList.remove('active');
  }
}

// Add item to bag
function addToBag(productId, color, size) {
  const product = productsData.find(p => p.id === productId);
  if (!product) return;
  
  const imgUrl = product.variants[color];
  
  const existingItem = cartList.find(item => 
    item.id === productId && 
    item.color === color && 
    (item.size === size || (!item.size && !size))
  );
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartList.push({
      id: productId,
      name: product.name,
      price: product.price,
      img: imgUrl,
      color: color,
      size: size || null,
      quantity: 1
    });
  }
  
  updateCartUI();
  triggerFlyToCartAnimation(imgUrl);
  showAddedToast(product.name);
}

// Update item quantity
function updateCartQty(productId, color, size, delta) {
  const idx = cartList.findIndex(item => 
    item.id === productId && 
    item.color === color && 
    (item.size === size || (!item.size && !size))
  );
  if (idx === -1) return;
  
  cartList[idx].quantity += delta;
  
  if (cartList[idx].quantity <= 0) {
    const itemEl = document.querySelector(`.cart-item[data-id="${productId}"][data-color="${color}"][data-size="${size || ''}"]`);
    if (itemEl) {
      itemEl.classList.add('removing');
      setTimeout(() => {
        cartList.splice(idx, 1);
        updateCartUI();
      }, 350);
    } else {
      cartList.splice(idx, 1);
      updateCartUI();
    }
  } else {
    updateCartUI();
  }
}

// Remove item from cart
function removeFromCart(productId, color, size) {
  const idx = cartList.findIndex(item => 
    item.id === productId && 
    item.color === color && 
    (item.size === size || (!item.size && !size))
  );
  if (idx === -1) return;
  
  const itemEl = document.querySelector(`.cart-item[data-id="${productId}"][data-color="${color}"][data-size="${size || ''}"]`);
  if (itemEl) {
    itemEl.classList.add('removing');
    setTimeout(() => {
      cartList.splice(idx, 1);
      updateCartUI();
    }, 350);
  } else {
    cartList.splice(idx, 1);
    updateCartUI();
  }
}

// Render/update shopping bag UI
function updateCartUI() {
  const listEl = document.getElementById('cart-items-list');
  const emptyEl = document.getElementById('cart-empty-message');
  if (!listEl || !emptyEl) return;
  
  let subtotal = 0;
  let totalItems = 0;
  
  listEl.innerHTML = '';
  
  if (cartList.length === 0) {
    emptyEl.style.display = 'flex';
    listEl.style.display = 'none';
  } else {
    emptyEl.style.display = 'none';
    listEl.style.display = 'flex';
    
    cartList.forEach(item => {
      subtotal += item.price * item.quantity;
      totalItems += item.quantity;
      
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item adding';
      itemEl.setAttribute('data-id', item.id);
      itemEl.setAttribute('data-color', item.color);
      itemEl.setAttribute('data-size', item.size || '');
      
      const variantText = `${item.color.toUpperCase()} ${item.size ? `/ ${item.size.toUpperCase()}` : ''}`;
      const itemPriceTotal = (item.price * item.quantity).toFixed(2);
      
      itemEl.innerHTML = `
        <div class="cart-item-image-container">
          <img src="${item.img}" alt="${item.name}" class="cart-item-img">
        </div>
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-variant">${variantText}</span>
          <div class="cart-item-qty-row">
            <button class="qty-control-btn minus-btn" onclick="updateCartQty('${item.id}', '${item.color}', ${item.size ? `'${item.size}'` : 'null'}, -1)">-</button>
            <span class="cart-item-qty-val">${item.quantity}</span>
            <button class="qty-control-btn plus-btn" onclick="updateCartQty('${item.id}', '${item.color}', ${item.size ? `'${item.size}'` : 'null'}, 1)">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <span class="cart-item-price">$${itemPriceTotal}</span>
          <button class="cart-item-remove-btn" onclick="removeFromCart('${item.id}', '${item.color}', ${item.size ? `'${item.size}'` : 'null'})">REMOVE</button>
        </div>
      `;
      
      listEl.appendChild(itemEl);
    });
  }
  
  // Calculate pricing summary
  document.getElementById('cart-subtotal-val').innerText = `$${subtotal.toFixed(2)}`;
  
  const discountRow = document.getElementById('cart-discount-row');
  if (hasDiscount && cartList.length > 0) {
    const discountVal = subtotal * 0.2;
    const finalTotal = subtotal - discountVal;
    discountRow.classList.remove('hidden');
    document.getElementById('cart-discount-val').innerText = `-$${discountVal.toFixed(2)}`;
    document.getElementById('cart-total-val').innerText = `$${finalTotal.toFixed(2)}`;
  } else {
    discountRow.classList.add('hidden');
    document.getElementById('cart-total-val').innerText = `$${subtotal.toFixed(2)}`;
  }
  
  // Update badge UI
  const badge1 = document.getElementById('cart-count-badge');
  const badge2 = document.getElementById('item-view-cart-count-badge');
  if (badge1) badge1.innerText = totalItems;
  if (badge2) badge2.innerText = totalItems;
}

// Curved fly-to-cart motion animation
function triggerFlyToCartAnimation(imageUrl) {
  const startEl = document.querySelector('.floating-item-scene');
  const targetEl = document.getElementById('arcade-cart-btn');
  
  if (!startEl || !targetEl) return;
  
  const startRect = startEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  
  const flyEl = document.createElement('div');
  flyEl.className = 'flying-cart-item';
  flyEl.style.left = `${startRect.left + startRect.width / 2 - 25}px`;
  flyEl.style.top = `${startRect.top + startRect.height / 2 - 25}px`;
  
  const img = document.createElement('img');
  img.src = imageUrl;
  flyEl.appendChild(img);
  document.body.appendChild(flyEl);
  
  setTimeout(() => {
    flyEl.style.transform = `translate(${targetRect.left - startRect.left - startRect.width/2 + 25 + 10}px, ${targetRect.top - startRect.top - startRect.height/2 + 25}px) scale(0.2)`;
    flyEl.style.opacity = '0.3';
  }, 50);
  
  setTimeout(() => {
    flyEl.remove();
    
    // Pulse cart buttons
    const cartBtns = document.querySelectorAll('.arcade-cart-btn-container');
    cartBtns.forEach(btn => {
      btn.classList.add('pulse-cart');
      setTimeout(() => btn.classList.remove('pulse-cart'), 450);
    });
  }, 900);
}

// Added confirmation toast
function showAddedToast(itemName) {
  let toast = document.getElementById('cart-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast-notification';
    toast.className = 'cart-toast-notification';
    document.body.appendChild(toast);
  }
  
  toast.textContent = `ADDED: ${itemName.toUpperCase()}`;
  toast.classList.add('active');
  
  if (toast.timeoutId) clearTimeout(toast.timeoutId);
  
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove('active');
  }, 2200);
}

// Bind Cart System Events
function initCartSystemBinds() {
  // Open cart buttons
  document.querySelectorAll('.arcade-cart-btn-container').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleShoppingBag(true);
    });
  });
  
  // Close cart drawer buttons
  document.getElementById('btn-close-bag')?.addEventListener('click', () => toggleShoppingBag(false));
  document.getElementById('btn-continue-shopping')?.addEventListener('click', () => toggleShoppingBag(false));
  document.getElementById('drawer-backdrop')?.addEventListener('click', () => toggleShoppingBag(false));
  
  // Add to Bag action button
  document.getElementById('btn-add-to-bag')?.addEventListener('click', () => {
    if (!currentViewItem) return;
    
    // Read currently active color
    const activeColorBtn = document.querySelector('.color-btn.active');
    const color = activeColorBtn ? activeColorBtn.dataset.color : 'black';
    
    // Read currently active size (if apparel)
    let size = null;
    if (currentViewItem.id === 'tshirt' || currentViewItem.id === 'sweatshirt') {
      const activeSizeBtn = document.querySelector('.size-btn.active');
      size = activeSizeBtn ? activeSizeBtn.dataset.size : 'M';
    }
    
    addToBag(currentViewItem.id, color, size);
  });
  
  // Checkout sequence click
  document.getElementById('btn-checkout')?.addEventListener('click', () => {
    if (cartList.length === 0) return;
    
    const checkoutBtn = document.getElementById('btn-checkout');
    checkoutBtn.innerText = 'INITIALIZING CHECKOUT...';
    checkoutBtn.style.pointerEvents = 'none';
    
    setTimeout(() => {
      checkoutBtn.innerText = 'PROCEED TO CHECKOUT';
      checkoutBtn.style.pointerEvents = 'auto';
      toggleShoppingBag(false);
      
      // Beautiful terminal alert success modal
      alert(`THANK YOU FOR YOUR PURCHASE!\nUNIQLO x PAC-MAN cabinet order sent successfully!\nTotal paid: ${document.getElementById('cart-total-val').innerText}`);
      
      // Empty the cart list
      cartList = [];
      updateCartUI();
    }, 1800);
  });
}

// Expose functions globally for inline onclick binds
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;

// INIT
initCartSystemBinds();

// Window resize playfield listener

window.addEventListener('resize', resizePlayfield);
showScreen('landing');
