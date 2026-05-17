// STATE
let currentState = 'LANDING';
let easterEggClicks = 0;
let hasDiscount = false;
let unlockedItems = [];
const TOTAL_ITEMS = 4;

// DOM Elements
const screens = {
  landing: document.getElementById('screen-landing'),
  transition: document.getElementById('screen-transition'),
  arcadeReveal: document.getElementById('screen-arcade-reveal'),
  gameStart: document.getElementById('screen-game-start'),
  gameplay: document.getElementById('screen-gameplay'),
  collection: document.getElementById('screen-collection'),
  arcadeCollection: document.getElementById('screen-arcade-collection')
};

function showScreen(screenKey) {
  Object.values(screens).forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (screens[screenKey]) {
    screens[screenKey].classList.add('active');
  }
}

// =========================================
// SCREEN 1: LANDING & EASTER EGG
// =========================================
const easterEgg = document.getElementById('pacman-easter-egg');
if (easterEgg) {
  easterEgg.addEventListener('click', () => {
    easterEggClicks++;
    if (easterEggClicks >= 3) {
      startTransition();
    } else {
      easterEgg.style.transform = `scale(${1 + easterEggClicks * 0.2})`;
    }
  });
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
  // 12 seconds * 60 fps = 720 frames
  const speed = totalDistance / 720; 

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
    mouthOpen += 0.15 * mouthDir;
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
      // Transition complete
      document.body.style.backgroundColor = '#050505';
      startCabinetReveal();
    }
  }
  
  draw();
}

// =========================================
// SCREEN 3 & 4: CABINET REVEAL & COIN
// =========================================
function startCabinetReveal() {
  showScreen('arcadeReveal');
  const cabinet = document.getElementById('cabinet-container');

  // Keep black screen for 1 second before revealing cabinet
  setTimeout(() => {
    cabinet.classList.add('approaching');
  }, 1000);

  // Approach takes 6 seconds, make clickable after 7 seconds
  setTimeout(() => {
    cabinet.addEventListener('click', onCabinetClick, { once: true });
  }, 7000);
}

function onCabinetClick() {
  const cabinet = document.getElementById('cabinet-container');

  // Step 1: Zoom to coin slot (framing match: cabinet-frame-02 / cabinet-frame-03)
  cabinet.classList.add('interacting');
  cabinet.classList.add('zoom-coin-slot');
  
  let time = 2000; // 2s zoom duration

  // Step 2: Brief hold on the coin-slot framing (no coin animation)
  time += 1000; // 1s hold

  // Step 3: Zoom toward the game screen (framing match: cabinet-frame-04)
  setTimeout(() => {
    cabinet.classList.remove('zoom-coin-slot');
    cabinet.classList.add('zoom-game-screen');
  }, time);

  time += 2500; // 2.5s zoom in

  // Step 4: Game screen takes over
  setTimeout(() => {
    showScreen('gameStart');
  }, time);
}

// =========================================
// SCREEN 5: GAME START
// =========================================
document.getElementById('btn-play-game')?.addEventListener('click', () => {
  showScreen('gameplay');
  startGame();
});

document.getElementById('btn-view-collection')?.addEventListener('click', () => {
  document.getElementById('locked-collection-popup').classList.remove('hidden');
});

document.getElementById('btn-close-popup')?.addEventListener('click', () => {
  document.getElementById('locked-collection-popup').classList.add('hidden');
});

// =========================================
// SCREEN 6: GAMEPLAY
// =========================================
let gameInterval;
const CELL_SIZE = 16;
const COLS = 28;
const ROWS = 31;

let map = [];
let gamePellets = [];

const pacman = { r: 23, c: 13, dir: { r: 0, c: 0 }, nextDir: { r: 0, c: 0 }, open: 0, openDir: 1 };
const collectibles = [
  { id: 'tshirt', r: 1, c: 1, color: '#ff6b6b', collected: false, name: 'T-Shirt' },
  { id: 'sweatshirt', r: 1, c: 26, color: '#4ecdc4', collected: false, name: 'Sweatshirt' },
  { id: 'cap', r: 29, c: 1, color: '#45b7d1', collected: false, name: 'Cap' },
  { id: 'tote', r: 29, c: 26, color: '#96ceb4', collected: false, name: 'Tote Bag' }
];

let score = 0;

// Dynamic Tile-Based Map Generation from the Image itself
function generateMapAndPellets() {
  const img = new Image();
  img.src = '/assets/maze-without-pellets.png';
  
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 448;
    canvas.height = 496;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    map = [];
    gamePellets = [];

    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        // Sample the exact center of each 16x16 tile
        const pixel = ctx.getImageData(c * CELL_SIZE + 8, r * CELL_SIZE + 8, 1, 1).data;
        
        // Pure black = walkable path
        const isBlack = pixel[0] < 20 && pixel[1] < 20 && pixel[2] < 20;
        
        // Hardcode ghost pen area to blocked (rows 12-16, cols 10-17)
        const isGhostPen = (r >= 12 && r <= 16 && c >= 10 && c <= 17);

        let val = 0; // Default to wall (blocked)
        if (isGhostPen) {
          val = 4; // Blocked Ghost Pen
        } else if (isBlack) {
          val = 1; // Walkable Path
        }

        row.push(val);

        if (val === 1) {
          // Check if this tile holds a product collectible
          const isCollectible = collectibles.some(col => col.r === r && col.c === c);
          // Check if this is the pacman start tile
          const isStart = (r === 23 && c === 13) || (r === 23 && c === 14);
          
          if (!isCollectible && !isStart) {
            gamePellets.push({ r, c, active: true });
          }
        }
      }
      map.push(row);
    }
  };
}
// Generate once at startup to cache
generateMapAndPellets();

function drawGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // We don't draw walls because the background image has them
  // We just draw collectibles and pacman

  // Pellets
  ctx.fillStyle = '#ffb8ae'; // Classic pellet color
  gamePellets.forEach(p => {
    if (p.active) {
      ctx.fillRect(p.c * CELL_SIZE + 6, p.r * CELL_SIZE + 6, 4, 4);
    }
  });

  // Collectibles
  collectibles.forEach(c => {
    if (!c.collected) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.c * CELL_SIZE + 4, c.r * CELL_SIZE + 4, 8, 8);
    }
  });

  // Pacman
  ctx.fillStyle = '#FFD43B';
  ctx.beginPath();
  const x = pacman.c * CELL_SIZE + CELL_SIZE / 2;
  const y = pacman.r * CELL_SIZE + CELL_SIZE / 2;
  
  let angleOffset = 0;
  if (pacman.dir.c === 1) angleOffset = 0;
  else if (pacman.dir.r === 1) angleOffset = Math.PI / 2;
  else if (pacman.dir.c === -1) angleOffset = Math.PI;
  else if (pacman.dir.r === -1) angleOffset = -Math.PI / 2;

  const mouthAngle = (0.2 * pacman.open) * Math.PI;
  ctx.arc(x, y, CELL_SIZE / 2, angleOffset + mouthAngle, angleOffset + 2 * Math.PI - mouthAngle);
  ctx.lineTo(x, y);
  ctx.fill();

  pacman.open += 0.2 * pacman.openDir;
  if (pacman.open >= 1 || pacman.open <= 0) pacman.openDir *= -1;
}

function updateGame() {
  // Try to change direction
  if (pacman.nextDir.r !== 0 || pacman.nextDir.c !== 0) {
    let nextR = pacman.r + pacman.nextDir.r;
    let nextC = pacman.c + pacman.nextDir.c;
    
    // Wrap-around horizontal
    if (nextC < 0) nextC = COLS - 1;
    else if (nextC >= COLS) nextC = 0;

    if (map[nextR] && map[nextR][nextC] === 1) {
      pacman.dir = { ...pacman.nextDir };
      pacman.nextDir = { r: 0, c: 0 };
    }
  }

  // Move
  let nextR = pacman.r + pacman.dir.r;
  let nextC = pacman.c + pacman.dir.c;
  
  // Wrap-around horizontal
  if (nextC < 0) nextC = COLS - 1;
  else if (nextC >= COLS) nextC = 0;

  if (map[nextR] && map[nextR][nextC] === 1) {
    pacman.r = nextR;
    pacman.c = nextC;
  }

  // Collect Pellets
  const pellet = gamePellets.find(p => p.active && p.r === pacman.r && p.c === pacman.c);
  if (pellet) {
    pellet.active = false;
    score += 10;
    document.getElementById('score-val').innerText = score;
  }

  // Collect Items
  collectibles.forEach(c => {
    if (!c.collected && c.r === pacman.r && c.c === pacman.c) {
      c.collected = true;
      unlockedItems.push(c.id);
      score += 1000;
      document.getElementById('score-val').innerText = score;
      checkWin();
    }
  });
}

function gameLoop() {
  updateGame();
  drawGame();
}

function startGame() {
  document.addEventListener('keydown', handleInput);
  gameInterval = setInterval(gameLoop, 150);
}

function handleInput(e) {
  if (e.key === 'ArrowUp') pacman.nextDir = { r: -1, c: 0 };
  if (e.key === 'ArrowDown') pacman.nextDir = { r: 1, c: 0 };
  if (e.key === 'ArrowLeft') pacman.nextDir = { r: 0, c: -1 };
  if (e.key === 'ArrowRight') pacman.nextDir = { r: 0, c: 1 };
  // Prevent scrolling
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
      e.preventDefault();
  }
}

function checkWin() {
  if (unlockedItems.length === TOTAL_ITEMS) {
    clearInterval(gameInterval);
    document.removeEventListener('keydown', handleInput);
    document.getElementById('reward-overlay').classList.remove('hidden');
    hasDiscount = true;
  }
}

// Skip game
document.getElementById('btn-skip-game')?.addEventListener('click', () => {
  clearInterval(gameInterval);
  document.removeEventListener('keydown', handleInput);
  hasDiscount = false;
  renderArcadeCollection();
  showScreen('arcadeCollection');
  initArcadeCollection();
});

// Reward actions
document.getElementById('btn-shop-unlocked')?.addEventListener('click', () => {
  document.getElementById('reward-overlay').classList.add('hidden');
  renderArcadeCollection();
  showScreen('arcadeCollection');
  initArcadeCollection();
});

document.getElementById('btn-replay')?.addEventListener('click', () => {
  document.getElementById('reward-overlay').classList.add('hidden');
  resetGame();
  startGame();
});

function resetGame() {
  pacman.r = 23; pacman.c = 13;
  pacman.dir = { r: 0, c: 0 };
  pacman.nextDir = { r: 0, c: 0 };
  score = 0;
  document.getElementById('score-val').innerText = score;
  collectibles.forEach(c => c.collected = false);
  unlockedItems = [];
  generateMapAndPellets();
}

// Play from Skip Screen
document.getElementById('btn-play-from-skip')?.addEventListener('click', () => {
  resetGame();
  showScreen('gameStart');
});

// =========================================
// SCREEN 7: COLLECTION
// =========================================
const productsData = [
  { id: 'tshirt', name: 'Pac-Man Graphic T-Shirt', price: 24.90, img: '👕', hasVariants: true, variants: { black: '/assets/item-tshirt-black.png', white: '/assets/item-tshirt-white.png' } },
  { id: 'sweatshirt', name: 'Arcade Graphic Sweatshirt', price: 49.90, img: '🧥', hasVariants: true, variants: { black: '/assets/item-sweatshirt-black.png', white: '/assets/item-sweatshirt-white.png' } },
  { id: 'cap', name: 'Pac-Man Cap', price: 19.90, img: '🧢', hasVariants: true, variants: { black: '/assets/item-cap-black.png', white: '/assets/item-cap-white.png' } },
  { id: 'tote', name: 'UNIQLO x Pac-Man Tote Bag', price: 14.90, img: '👜', hasVariants: true, variants: { black: '/assets/item-bag-black.png', white: '/assets/item-bag-white.png' } }
];



// =========================================
// SCREEN 8: ARCADE COLLECTION (REWARD)
// =========================================
let arcadeActiveIndex = 0;
let arcadeCollectionActive = false;

function renderArcadeCollection() {
  const list = document.getElementById('arcade-product-list');
  list.innerHTML = '';

  const statusEl = document.getElementById('arcade-header-status');
  const titleEl = document.getElementById('arcade-main-title');
  const subtitleEl = document.getElementById('arcade-main-subtitle');

  if (hasDiscount) {
    statusEl.innerText = '[ REWARD: 20% OFF ACTIVE ]';
    statusEl.classList.add('blink-fast');
    statusEl.style.color = 'var(--pacman-yellow)';
    titleEl.innerText = 'UNLOCKED COLLECTION';
    subtitleEl.innerText = '// SELECT YOUR ITEM';
    document.getElementById('skip-game-prompt')?.classList.add('hidden');
  } else {
    statusEl.innerText = '[ STANDARD STORE ]';
    statusEl.classList.remove('blink-fast');
    statusEl.style.color = '#888';
    titleEl.innerText = 'UNIQLO x PAC-MAN';
    subtitleEl.innerText = '// BROWSE COLLECTION';
    document.getElementById('skip-game-prompt')?.classList.remove('hidden');
  }

  productsData.forEach((p, index) => {
    let priceRowHtml = '';
    
    if (hasDiscount) {
      const discounted = (p.price * 0.8).toFixed(2);
      priceRowHtml = `
        <span class="item-original-price">$${p.price.toFixed(2)}</span>
        <span class="item-price">$${discounted}</span>
      `;
    } else {
      priceRowHtml = `<span class="item-price">$${p.price.toFixed(2)}</span>`;
    }
    
    const item = document.createElement('div');
    item.className = `arcade-product-item ${index === 0 ? 'selected' : ''}`;
    item.dataset.index = index;
    
    item.innerHTML = `
      <div class="cursor-indicator">›</div>
      <div class="item-icon">${p.img}</div>
      <div class="item-details">
        <div class="item-name">${p.name}</div>
        <div class="item-price-row">
          ${priceRowHtml}
        </div>
      </div>
      <button class="wahba-btn" onclick="openItemView('${p.id}'); event.stopPropagation();">VIEW ITEM</button>
    `;
    
    list.appendChild(item);
  });
}

function initArcadeCollection() {
  arcadeActiveIndex = 0;
  arcadeCollectionActive = true;
  updateArcadeSelection();

  // Mouse hover
  const items = document.querySelectorAll('.arcade-product-item');
  items.forEach(item => {
    item.addEventListener('mouseenter', (e) => {
      arcadeActiveIndex = parseInt(e.currentTarget.dataset.index);
      updateArcadeSelection();
    });
    
    item.addEventListener('click', () => {
      openItemView(productsData[arcadeActiveIndex].id);
    });
  });

  // Keyboard navigation
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
  }
}

// =========================================
// ITEM VIEW MODAL LOGIC
// =========================================
let currentViewItem = null;

function openItemView(productId) {
  const item = productsData.find(p => p.id === productId);
  if (!item) return;

  if (!item.hasVariants) {
    alert("3D Item View is coming soon for this product!");
    return;
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

  // Reset color selector to Black
  updateItemViewColor('black');

  // Show Modal
  document.getElementById('item-view-overlay').classList.remove('hidden');
}

function updateItemViewColor(color) {
  if (!currentViewItem || !currentViewItem.hasVariants) return;
  
  // Update floating image src
  const imgEl = document.getElementById('floating-item-image');
  imgEl.src = currentViewItem.variants[color];

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

// Bind Close Button
document.getElementById('btn-close-item-view').addEventListener('click', () => {
  document.getElementById('item-view-overlay').classList.add('hidden');
  currentViewItem = null;
});

// INIT
showScreen('landing');
