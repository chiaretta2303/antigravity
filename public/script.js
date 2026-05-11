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
  const video = document.getElementById('cabinet-video');
  
  // Try to play video if it exists
  if (video) {
    video.play().catch(e => console.log('Video autoplay prevented', e));
  }

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

// Simplified map for classic Pac-Man (0: wall, 1: path)
// I will create a basic open path around the edges and a cross in the middle
const map = [];
for (let r = 0; r < ROWS; r++) {
  const row = [];
  for (let c = 0; c < COLS; c++) {
    // Basic borders
    if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
      row.push(0);
    } 
    // Open path loop
    else if (r === 1 || r === ROWS - 2 || c === 1 || c === COLS - 2) {
      row.push(1);
    }
    // Cross
    else if (r === 15 || c === 14 || c === 13) {
      row.push(1);
    }
    else {
      // For the sake of prototyping and not having pacman stuck, let's make it mostly walkable but with some blocks
      if ((r % 4 === 0) && (c % 4 === 0)) row.push(0);
      else row.push(1);
    }
  }
  map.push(row);
}

const pacman = { r: 15, c: 14, dir: { r: 0, c: 0 }, nextDir: { r: 0, c: 0 }, open: 0, openDir: 1 };
const collectibles = [
  { id: 'tshirt', r: 1, c: 1, color: '#ff6b6b', collected: false, name: 'T-Shirt' },
  { id: 'sweatshirt', r: 1, c: 26, color: '#4ecdc4', collected: false, name: 'Sweatshirt' },
  { id: 'cap', r: 29, c: 1, color: '#45b7d1', collected: false, name: 'Cap' },
  { id: 'tote', r: 29, c: 26, color: '#96ceb4', collected: false, name: 'Tote Bag' }
];

let score = 0;

function drawGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // We don't draw walls because the background image has them
  // We just draw collectibles and pacman

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
    const nextR = pacman.r + pacman.nextDir.r;
    const nextC = pacman.c + pacman.nextDir.c;
    if (map[nextR] && map[nextR][nextC] === 1) {
      pacman.dir = { ...pacman.nextDir };
      pacman.nextDir = { r: 0, c: 0 };
    }
  }

  // Move
  const nextR = pacman.r + pacman.dir.r;
  const nextC = pacman.c + pacman.dir.c;
  if (map[nextR] && map[nextR][nextC] === 1) {
    pacman.r = nextR;
    pacman.c = nextC;
  }

  // Collect
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
  renderCollection();
  showScreen('collection');
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
  pacman.r = 15; pacman.c = 14;
  pacman.dir = { r: 0, c: 0 };
  pacman.nextDir = { r: 0, c: 0 };
  score = 0;
  document.getElementById('score-val').innerText = score;
  collectibles.forEach(c => c.collected = false);
  unlockedItems = [];
}

// =========================================
// SCREEN 7: COLLECTION
// =========================================
const productsData = [
  { id: 'tshirt', name: 'Pac-Man Graphic T-Shirt', price: 24.90, img: '👕' },
  { id: 'sweatshirt', name: 'Arcade Graphic Sweatshirt', price: 49.90, img: '🧥' },
  { id: 'cap', name: 'Pac-Man Cap', price: 19.90, img: '🧢' },
  { id: 'tote', name: 'UNIQLO x Pac-Man Tote Bag', price: 14.90, img: '👜' }
];

function renderCollection() {
  // Ensure store background is white again
  document.body.style.backgroundColor = 'var(--bg-store)';

  if (hasDiscount) {
    document.getElementById('collection-banner').classList.remove('hidden');
  }

  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';

  productsData.forEach(p => {
    let priceHtml = `$${p.price.toFixed(2)}`;
    if (hasDiscount) {
      const discounted = (p.price * 0.8).toFixed(2);
      priceHtml = `<span class="original-price">$${p.price.toFixed(2)}</span><span class="product-price discounted">$${discounted}</span>`;
    } else {
      priceHtml = `<span class="product-price">${priceHtml}</span>`;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image">${p.img}</div>
      <div class="product-name">${p.name}</div>
      ${priceHtml}
      <div class="product-actions">
        <button class="btn-view">View Item</button>
        <button class="btn-add">Add to Bag</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// =========================================
// SCREEN 8: ARCADE COLLECTION (REWARD)
// =========================================
let arcadeActiveIndex = 0;
let arcadeCollectionActive = false;

function renderArcadeCollection() {
  const list = document.getElementById('arcade-product-list');
  list.innerHTML = '';

  productsData.forEach((p, index) => {
    const discounted = (p.price * 0.8).toFixed(2);
    
    const item = document.createElement('div');
    item.className = `arcade-product-item ${index === 0 ? 'selected' : ''}`;
    item.dataset.index = index;
    
    item.innerHTML = `
      <div class="cursor-indicator">▶</div>
      <div class="item-icon">${p.img}</div>
      <div class="item-details">
        <div class="item-name">${p.name}</div>
        <div>
          <span class="item-original-price">$${p.price.toFixed(2)}</span>
          <span class="item-price">$${discounted}</span>
        </div>
      </div>
      <button class="arcade-btn small primary">VIEW ITEM</button>
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
      // Logic to view item (e.g., alert or redirect)
      alert('Selected: ' + productsData[arcadeActiveIndex].name);
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
    alert('Selected: ' + productsData[arcadeActiveIndex].name);
  }
}

// INIT
showScreen('landing');
