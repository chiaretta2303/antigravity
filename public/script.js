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
  
  // Robust CRT overlay activation logic
  const crt = document.getElementById('crt-overlay');
  if (crt) {
    if (screenKey === 'landing' || screenKey === 'transition' || screenKey === 'arcadeLoader' || screenKey === 'arcadeReveal') {
      crt.classList.remove('active');
    }
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
  // 6 seconds * 60 fps = 360 frames
  const speed = totalDistance / 360; 

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
      startArcadeLoader();
    }
  }
  
  draw();
}

// =========================================
// SCREEN 3 & 4: CABINET REVEAL & COIN
// =========================================
let cabinetScene, cabinetCamera, cabinetRenderer, cabinetModel, cabinetCoin;
let cabinetAnimationId;
let cabinetState = 'hidden'; // 'hidden', 'approaching', 'idle', 'aligning_front', 'zooming_coin', 'inserting_coin', 'zooming_screen'
let cabinetApproachProgress = 0;
let cabinetZoomProgress = 0;
let coinProgress = 0;
let baseCameraZ = 5;
let currentCameraY = 0;
let currentCameraZ = 5;
let startCameraY = 0;
let startCameraZ = 5;
let cabinetMaxDim = 1;
let cabinetSizeZ = 1;

// Frontal alignment state variables
let alignProgress = 0;
let startCabinetRotY = 0;
let startCameraX = 0;

function initThreeJSCabinet() {
  const container = document.getElementById('three-cabinet-container');
  if (!container || cabinetScene) return;
  
  cabinetScene = new THREE.Scene();
  cabinetScene.background = new THREE.Color(0x000000);
  
  cabinetCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  cabinetRenderer = new THREE.WebGLRenderer({ antialias: true });
  cabinetRenderer.setSize(window.innerWidth, window.innerHeight);
  cabinetRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(cabinetRenderer.domElement);
  
  // Lighting setup with 0 initial intensity for cinematic fade-in
  const ambientLight = new THREE.AmbientLight(0xffffff, 0);
  ambientLight.name = 'ambientLight';
  cabinetScene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0);
  directionalLight.name = 'dirLight1';
  directionalLight.position.set(5, 10, 7);
  cabinetScene.add(directionalLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0);
  fillLight.name = 'dirLight2';
  fillLight.position.set(-5, 0, -5);
  cabinetScene.add(fillLight);
  
  const loader = new THREE.GLTFLoader();
  loader.load('/assets/cabinet.glb', (gltf) => {
    const rawModel = gltf.scene;
    
    // Auto-center the model natively
    const box = new THREE.Box3().setFromObject(rawModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    rawModel.position.x = -center.x;
    rawModel.position.y = -center.y;
    rawModel.position.z = -center.z;
    
    const wrapper = new THREE.Group();
    wrapper.add(rawModel);
    cabinetScene.add(wrapper);
    cabinetModel = wrapper;
    
    const maxDim = Math.max(size.x, size.y, size.z);
    cabinetMaxDim = maxDim;
    cabinetSizeZ = size.z;
    
    // Create the 3D coin
    const coinRadius = maxDim * 0.02;
    const coinThickness = maxDim * 0.005;
    const coinGeometry = new THREE.CylinderGeometry(coinRadius, coinRadius, coinThickness, 32);
    const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
    cabinetCoin = new THREE.Mesh(coinGeometry, coinMaterial);
    cabinetCoin.rotation.x = Math.PI / 2;
    cabinetCoin.visible = false;
    cabinetModel.add(cabinetCoin); // Add to wrapper so it aligns with cabinet
    
    const fov = cabinetCamera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    baseCameraZ = cameraZ * 1.6; // Scale down slightly to fit nicely
    
    cabinetCamera.position.z = baseCameraZ * 8; // Start very far
    cabinetModel.rotation.y = -Math.PI * 2;
    cabinetModel.scale.set(0.01, 0.01, 0.01);
  });
  
  window.addEventListener('resize', () => {
    if (!cabinetCamera || !cabinetRenderer) return;
    cabinetCamera.aspect = window.innerWidth / window.innerHeight;
    cabinetCamera.updateProjectionMatrix();
    cabinetRenderer.setSize(window.innerWidth, window.innerHeight);
  });
}

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
    cabinetZoomProgress += 1 / (60 * 2.5); // 2.5s zoom
    if (cabinetZoomProgress > 1) cabinetZoomProgress = 1;
    const ease = 1 - Math.pow(1 - cabinetZoomProgress, 3);
    
    // Controlled framing: zoom toward screen center without entering inside it
    currentCameraY = THREE.MathUtils.lerp(startCameraY, cabinetMaxDim * 0.12, ease);
    currentCameraZ = THREE.MathUtils.lerp(startCameraZ, baseCameraZ * 0.45, ease);
    
    cabinetCamera.position.y = currentCameraY;
    cabinetCamera.position.z = currentCameraZ;
    cabinetCamera.lookAt(0, currentCameraY, 0);
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

  // Phase 2: Attract & Character Screen after 1.2 seconds
  setTimeout(() => {
    if (selfTest) selfTest.classList.add('hidden');
    if (attract) attract.classList.remove('hidden');
    
    // Staggered reveal timeline:
    // Row 1 (Blinky): Red Ghost -> 1.0s -> "Shadow" -> 0.5s -> "BLINKY"
    const r1 = document.querySelector('.ghost-row.blinky');
    if (r1) {
      r1.style.opacity = '1';
      setTimeout(() => {
        const name = r1.querySelector('.ghost-name');
        if (name) name.style.opacity = '1';
      }, 1000);
      setTimeout(() => {
        const nick = r1.querySelector('.ghost-nick');
        if (nick) nick.style.opacity = '1';
      }, 1500);
    }
    
    // Row 2 (Pinky): Pink Ghost -> 1.0s -> "Speedy" -> 0.5s -> "PINKY"
    setTimeout(() => {
      const r2 = document.querySelector('.ghost-row.pinky');
      if (r2) {
        r2.style.opacity = '1';
        setTimeout(() => {
          const name = r2.querySelector('.ghost-name');
          if (name) name.style.opacity = '1';
        }, 1000);
        setTimeout(() => {
          const nick = r2.querySelector('.ghost-nick');
          if (nick) nick.style.opacity = '1';
        }, 1500);
      }
    }, 2000);
    
    // Row 3 (Inky): Cyan Ghost -> 1.0s -> "Bashful" -> 0.5s -> "INKY"
    setTimeout(() => {
      const r3 = document.querySelector('.ghost-row.inky');
      if (r3) {
        r3.style.opacity = '1';
        setTimeout(() => {
          const name = r3.querySelector('.ghost-name');
          if (name) name.style.opacity = '1';
        }, 1000);
        setTimeout(() => {
          const nick = r3.querySelector('.ghost-nick');
          if (nick) nick.style.opacity = '1';
        }, 1500);
      }
    }, 4000);
    
    // Row 4 (Clyde): Orange Ghost -> 1.0s -> "Pokey" -> 0.5s -> "CLYDE"
    setTimeout(() => {
      const r4 = document.querySelector('.ghost-row.clyde');
      if (r4) {
        r4.style.opacity = '1';
        setTimeout(() => {
          const name = r4.querySelector('.ghost-name');
          if (name) name.style.opacity = '1';
        }, 1000);
        setTimeout(() => {
          const nick = r4.querySelector('.ghost-nick');
          if (nick) nick.style.opacity = '1';
        }, 1500);
      }
    }, 6000);
    
  }, 1200);
  
  // Phase 3: Display Actual Start Menu after 10.5 seconds
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
  }, 10500);
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
    showScreen('gameStart');
    runStartSequence();
    
    // Turn on the CRT Television effect
    const crt = document.getElementById('crt-overlay');
    if (crt) crt.classList.add('active');
    
    // Reset container visibility for future views
    const container = document.getElementById('three-cabinet-container');
    container.style.transition = 'none';
    container.style.opacity = '1';
  }, 6800);
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
  // Show READY overlay containing blink READY! and PLAYER 1
  const readyOverlay = document.getElementById('game-ready-overlay');
  if (readyOverlay) readyOverlay.classList.remove('hidden');
  
  // Setup board and spawn players
  resetGame();
  drawGame();
  
  // Wait 2.2 seconds (arcade startup freeze) before allowing input and gameplay
  setTimeout(() => {
    if (readyOverlay) readyOverlay.classList.add('hidden');
    document.addEventListener('keydown', handleInput);
    
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, 150);
  }, 2200);
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
