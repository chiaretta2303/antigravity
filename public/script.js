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
      // Transition complete — show red arcade button
      document.body.style.backgroundColor = '#000000';
      showPressStartButton();
    }
  }
  
  draw();
}

// =========================================
// SCREEN 3 & 4: CABINET REVEAL & COIN
// =========================================
let cabinetScene, cabinetCamera, cabinetRenderer, cabinetModel, cabinetCoin;
let cabinetAnimationId;
let cabinetState = 'hidden'; // 'hidden','dropping','scroll_idle' (new) | legacy: 'approaching','idle','aligning_front','zooming_coin','inserting_coin','zooming_screen'
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

// Drop + scroll state
let cabinetDropProgress = 0;
let cabinetDropStartY = 0;
let settlingTime = 0;
let scrollTarget = 0;
let scrollCurrent = 0;
let scrollListenerActive = false;
let enterTriggered = false;
let dustParticles = [];

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
  loader.load('/assets/pacman-cabinet.glb', (gltf) => {
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
    baseCameraZ = cameraZ * 1.6;
    
    // Drop-from-above setup: full size, right side, camera at normal distance
    cabinetDropStartY = maxDim * 4.5;
    cabinetModel.position.y = cabinetDropStartY;
    cabinetModel.position.x = maxDim * 0.35; // Position on the right side
    cabinetModel.rotation.y = -0.25; // Face angled slightly, showing the right panel
    cabinetModel.scale.set(1, 1, 1);
    cabinetCamera.position.set(0, 0, baseCameraZ);
    
    // Lights start dark, fade in during drop
    const amb = cabinetScene.getObjectByName('ambientLight');
    const dir1 = cabinetScene.getObjectByName('dirLight1');
    const dir2 = cabinetScene.getObjectByName('dirLight2');
    if (amb)  amb.intensity  = 0;
    if (dir1) dir1.intensity = 0;
    if (dir2) dir2.intensity = 0;
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
    cabinetZoomProgress += 1 / (60 * 2.5);
    if (cabinetZoomProgress > 1) cabinetZoomProgress = 1;
    const ease = 1 - Math.pow(1 - cabinetZoomProgress, 3);
    currentCameraY = THREE.MathUtils.lerp(startCameraY, cabinetMaxDim * 0.12, ease);
    currentCameraZ = THREE.MathUtils.lerp(startCameraZ, baseCameraZ * 0.45, ease);
    cabinetCamera.position.y = currentCameraY;
    cabinetCamera.position.z = currentCameraZ;
    cabinetCamera.lookAt(0, currentCameraY, 0);

  // ─── NEW STATES ───────────────────────────────────────────
  } else if (cabinetState === 'dropping') {
    if (!cabinetModel) { cabinetRenderer.render(cabinetScene, cabinetCamera); return; }
    
    // Smooth time-delta based falling animation (runs beautifully regardless of refresh rate/FPS)
    if (!window.droppingStartTime) window.droppingStartTime = performance.now();
    const elapsed = (performance.now() - window.droppingStartTime) / 1000;
    cabinetDropProgress = elapsed / 1.1; // 1.1s total drop duration
    
    if (cabinetDropProgress >= 1) {
      cabinetDropProgress = 1;
      // Transition to settling wobble phase
      cabinetState = 'settling';
      window.droppingStartTime = null; // Clear drop timer
      window.settlingStartTime = performance.now(); // Start settling timer
      createDustBurst(); // Trigger extremely subtle ground reaction
    }
    // Believable gravity fall (quadratic curve, no cartoony bounce)
    const dropEase = Math.pow(Math.min(cabinetDropProgress, 1), 2);
    cabinetModel.position.y = THREE.MathUtils.lerp(cabinetDropStartY, 0, dropEase);
    cabinetModel.position.x = cabinetMaxDim * 0.35; // Stay on the right side
    cabinetModel.rotation.y = -0.25; // Stay angled
    
    // Lights fade in during first half of drop
    const lightT = Math.min(cabinetDropProgress * 2.5, 1);
    const amb2  = cabinetScene.getObjectByName('ambientLight');
    const dir1b = cabinetScene.getObjectByName('dirLight1');
    const dir2b = cabinetScene.getObjectByName('dirLight2');
    if (amb2)  amb2.intensity  = 0.6 * lightT;
    if (dir1b) dir1b.intensity = 1.2 * lightT;
    if (dir2b) dir2b.intensity = 0.4 * lightT;
    cabinetCamera.lookAt(0, 0, 0);

  } else if (cabinetState === 'settling') {
    // Damped wobble: heavy cabinet stabilizing after impact (Shopify TV motion reference)
    if (!window.settlingStartTime) window.settlingStartTime = performance.now();
    const settlingTime = (performance.now() - window.settlingStartTime) / 1000;
    
    // Maintain X position and basic Y rotation
    cabinetModel.position.x = cabinetMaxDim * 0.35;
    cabinetModel.rotation.y = -0.25;
    
    // Z-axis rotation: slight left-right wobble, stabilizing quickly (stiff frequency, high damping)
    const sway = 0.045 * Math.exp(-4.5 * settlingTime) * Math.sin(14 * settlingTime);
    // X-axis rotation: very subtle forward-back rock
    const rock = 0.015 * Math.exp(-5.0 * settlingTime) * Math.sin(12 * settlingTime);
    
    cabinetModel.rotation.z = sway;
    cabinetModel.rotation.x = rock;
    
    // Animate and fade dust particles
    updateDustParticles();
    
    cabinetCamera.lookAt(0, 0, 0);
    // Switch to scroll mode once stabilized (≈ 1.0 second)
    if (settlingTime > 1.0) {
      cabinetModel.rotation.z = 0;
      cabinetModel.rotation.x = 0;
      cabinetState = 'scroll_idle';
      window.settlingStartTime = null; // Clear settling timer
      setupScrollListener();
    }

  } else if (cabinetState === 'scroll_idle') {
    // Smooth lerp scroll progress
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.06;
    
    // Update progress bar UI
    const bar = document.getElementById('scroll-progress-bar');
    if (bar) bar.style.width = (scrollCurrent * 100) + '%';
    
    // Curved cinematic scroll arc: camera moves from X=0 to cabinet X, cabinet Y-rotation turns to frontal, camera approaches
    const t = scrollCurrent;
    const easeX = Math.pow(t, 1.8); // curved arc
    const easeY = Math.pow(t, 1.5);
    const easeZ = t;
    
    const cameraX = THREE.MathUtils.lerp(0, cabinetMaxDim * 0.35, easeX);
    const cameraY = THREE.MathUtils.lerp(0, cabinetMaxDim * 0.12, easeY);
    const cameraZ = THREE.MathUtils.lerp(baseCameraZ, baseCameraZ * 0.28, easeZ); // Zooms close to screen for frontal close-up
    
    cabinetCamera.position.set(cameraX, cameraY, cameraZ);
    
    // Slowly rotate cabinet to face frontal
    const easeRot = Math.sin(t * Math.PI / 2);
    cabinetModel.rotation.y = THREE.MathUtils.lerp(-0.25, 0, easeRot);
    
    // Ensure rotation X and Z stay at 0
    cabinetModel.rotation.x = 0;
    cabinetModel.rotation.z = 0;
    cabinetModel.position.x = cabinetMaxDim * 0.35;
    
    // lookAt target shifts from center of scene to screen center
    const lookAtX = THREE.MathUtils.lerp(0, cabinetMaxDim * 0.35, Math.pow(t, 1.2));
    const lookAtY = THREE.MathUtils.lerp(0, cabinetMaxDim * 0.12, Math.pow(t, 1.2));
    const lookAtZ = 0;
    
    cabinetCamera.lookAt(lookAtX, lookAtY, lookAtZ);
    
    // Animate and fade any active dust particles
    updateDustParticles();
    
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
    const crt = document.getElementById('crt-overlay');
    if (crt) crt.classList.add('active');
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
  
  // Swap the image to the down state
  const btnImg = document.getElementById('arcade-btn-img');
  if (btnImg) {
    btnImg.src = '/assets/arcade-button-down.png';
  }

  // Satisfying physical press hold, then fade press start screen and drop cabinet
  setTimeout(() => {
    const ps = document.getElementById('screen-press-start');
    if (ps) { ps.style.transition = 'opacity 0.45s ease'; ps.style.opacity = '0'; }
    setTimeout(() => {
      // Inject progress bar
      if (!document.getElementById('scroll-progress-bar')) {
        const bar = document.createElement('div');
        bar.id = 'scroll-progress-bar';
        document.body.appendChild(bar);
      }
      showScreen('arcadeReveal');
      cabinetState = 'dropping';
      cabinetDropProgress = 0;
      enterTriggered = false;
      window.droppingStartTime = null; // Reset time-delta drop timer
      window.settlingStartTime = null; // Reset time-delta settling timer
      initThreeJSCabinet();
      animateCabinet();
    }, 450);
  }, 280);
}

// Subtle cinematic dust burst particle system
function createDustBurst() {
  if (!cabinetScene || !cabinetModel) return;
  
  // Clear any existing stale particles
  dustParticles.forEach(p => {
    cabinetScene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
  dustParticles = [];
  
  // Extremely subtle ground reaction (few and small particles)
  const particleCount = 6;
  const geom = new THREE.SphereGeometry(cabinetMaxDim * 0.006, 5, 5);
  
  const baseX = cabinetModel.position.x;
  const baseY = -cabinetMaxDim * 0.45; // Bottom base footprint level
  const baseZ = 0;
  
  for (let i = 0; i < particleCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.1 + Math.random() * 0.05,
      depthWrite: false
    });
    
    const mesh = new THREE.Mesh(geom, mat);
    
    // Spread in a circular base ring
    const angle = Math.random() * Math.PI * 2;
    const distance = cabinetMaxDim * (0.05 + Math.random() * 0.15);
    
    mesh.position.set(
      baseX + Math.cos(angle) * distance,
      baseY + (Math.random() * 0.02 - 0.01),
      baseZ + Math.sin(angle) * distance
    );
    
    cabinetScene.add(mesh);
    
    // Radial outwards movement + gentle upward lift
    const speed = (0.1 + Math.random() * 0.2) * 0.015;
    dustParticles.push({
      mesh: mesh,
      vx: Math.cos(angle) * speed,
      vy: (0.05 + Math.random() * 0.1) * 0.015, // rises very slightly
      vz: Math.sin(angle) * speed,
      alpha: mat.opacity,
      decay: 0.035 + Math.random() * 0.02, // fades quickly
      growth: 1.005 + Math.random() * 0.005
    });
  }
}

function updateDustParticles() {
  for (let i = dustParticles.length - 1; i >= 0; i--) {
    const p = dustParticles[i];
    
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    
    // Friction deceleration
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.vz *= 0.94;
    
    // Dissipate & expand
    p.mesh.scale.multiplyScalar(p.growth);
    
    p.alpha -= p.decay;
    if (p.alpha <= 0) {
      cabinetScene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      dustParticles.splice(i, 1);
    } else {
      p.mesh.material.opacity = p.alpha;
    }
  }
}

// Bounce-out easing (standard Penner)
function bounceOut(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1/d)       return n * t * t;
  if (t < 2/d)       return n * (t -= 1.5/d) * t + 0.75;
  if (t < 2.5/d)     return n * (t -= 2.25/d) * t + 0.9375;
  return               n * (t -= 2.625/d) * t + 0.984375;
}

function setupScrollListener() {
  scrollTarget  = 0;
  scrollCurrent = 0;
  scrollListenerActive = true;
  window.addEventListener('wheel', onScrollCabinet, { passive: true });
  // Scroll hint appears after a short beat
  setTimeout(showScrollHint, 400);
}

function onScrollCabinet(e) {
  if (!scrollListenerActive) return;
  // deltaY > 0 = scroll down = move closer. Slow, deliberate sensitivity.
  scrollTarget = Math.min(1, Math.max(0, scrollTarget + e.deltaY * 0.0007));
}

function showScrollHint() {
  const existing = document.getElementById('scroll-hint');
  if (existing) return;
  const hint = document.createElement('div');
  hint.id = 'scroll-hint';
  hint.textContent = '\u25BC  SCROLL TO ENTER  \u25BC';
  document.body.appendChild(hint);
}

function enterCabinetScreen() {
  window.removeEventListener('wheel', onScrollCabinet);
  scrollListenerActive = false;
  // Remove UI helpers
  const hint = document.getElementById('scroll-hint');
  if (hint) hint.remove();
  const bar = document.getElementById('scroll-progress-bar');
  if (bar) { bar.style.transition = 'opacity 0.3s'; bar.style.opacity = '0'; setTimeout(() => bar.remove(), 300); }
  // Fade cabinet out
  const container = document.getElementById('three-cabinet-container');
  container.style.transition = 'opacity 0.6s cubic-bezier(0.25,1,0.5,1)';
  container.style.opacity = '0';
  setTimeout(() => {
    cancelAnimationFrame(cabinetAnimationId);
    showScreen('gameStart');
    runStartSequence();
    const crt = document.getElementById('crt-overlay');
    if (crt) crt.classList.add('active');
    container.style.transition = 'none';
    container.style.opacity = '1';
  }, 2200); // Holds black for 1.5 - 3 seconds (2.2 seconds total delay)
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
// DEBUG_MAP: when true, draws the collision-grid overlay (red=W, green=P,
// yellow=C, purple=G) and shows row/col on hover/click. EDIT_COLLISION_MAP is
// kept as an internal alias so all existing debug code keeps working.
let DEBUG_MAP = true;
let EDIT_COLLISION_MAP = DEBUG_MAP;

// 15 cols × 14 rows. Re-traced for the latest 4961x3508 maze image (the
// artwork now fills nearly the whole PNG instead of being inset on the
// right). Threshold 0.20 keeps walls 1 tile thick, chamber interiors stay
// walkable. L-R symmetric. Ghost house at rows 6-7 cols 6-8 with the gate
// cell at (5, 7). Pac-Man spawn at (11, 7).
const collisionMap = [
  "WWWWWWWWWWWWWWW", // Row 0
  "WCPPPPPPPPPPPCW", // Row 1
  "WPWWPPPPPPPWWPW", // Row 2
  "WPPPPPPWPPPPPPW", // Row 3
  "WPPPPPPWPPPPPPW", // Row 4
  "WPPPPPPPPPPPPPW", // Row 5
  "WPPPPWGGGWPPPPW", // Row 6 (ghost house top)
  "WPPPPWGGGWPPPPW", // Row 7 (ghost house body)
  "WPPPPPPPPPPPPPW", // Row 8
  "WPPPPWPWPWPPPPW", // Row 9
  "WPPPPPPWPPPPPPW", // Row 10
  "WPPPPPPPPPPPPPW", // Row 11 (Pac-Man spawn at c=7)
  "WCPPPPPWPPPPPCW", // Row 12
  "WWWWWWWWWWWWWWW"  // Row 13
];

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
const collectibles = [
  { id: 'tshirt',     r: 1,  c: 1,  color: '#ff6b6b', collected: false, name: 'T-Shirt' },
  { id: 'sweatshirt', r: 1,  c: 13, color: '#4ecdc4', collected: false, name: 'Sweatshirt' },
  { id: 'cap',        r: 12, c: 1,  color: '#45b7d1', collected: false, name: 'Cap' },
  { id: 'tote',       r: 12, c: 13, color: '#96ceb4', collected: false, name: 'Bag' },
];

let score = 0;

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
const GHOST_SPAWN_DATA = [
  { id: 'blinky', r: 6, c: 6, dir: { r: 0, c: -1 }, color: '#FF0000', scatter: { r: 1,  c: 13 }, releaseAt: 0   },
  { id: 'pinky',  r: 6, c: 8, dir: { r: 0, c:  1 }, color: '#FFB8FF', scatter: { r: 1,  c: 1  }, releaseAt: 33  },
  { id: 'inky',   r: 7, c: 6, dir: { r: 0, c: -1 }, color: '#00FFFF', scatter: { r: 12, c: 13 }, releaseAt: 66  },
  { id: 'clyde',  r: 7, c: 8, dir: { r: 0, c:  1 }, color: '#FFB852', scatter: { r: 12, c: 1  }, releaseAt: 100 },
];
let ghosts        = [];
let gameTick      = 0;
let ghostModeTick  = 0;
let ghostModePhase = 0;
let globalGhostMode = 'scatter';

// Setup Map & Pellet Spawning based on collisionMap array
function generateMapAndPellets() {
  map = [];
  gamePellets = [];
  
  for (let r = 0; r < collisionMap.length; r++) {
    const row = [];
    for (let c = 0; c < collisionMap[r].length; c++) {
      const char = collisionMap[r][c];
      let val = 0; // Blocked wall by default
      
      if (char === 'P' || char === 'C') {
        val = 1; // Walkable path
      } else if (char === 'G') {
        val = 4; // Ghost house / gate
      }
      
      row.push(val);
      
      if (char === 'P') {
        // Spawn pellets on all walkable path tiles except Pac-Man start tile
        const isStart = (r === 16 && c === 6);
        if (!isStart) {
          gamePellets.push({ r, c, active: true });
        }
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

  // Draw pellets
  ctx.fillStyle = '#ffb8ae';
  gamePellets.forEach(p => {
    if (p.active) {
      const centerX = startX + p.c * stepW + stepW / 2;
      const centerY = startY + p.r * stepH + stepH / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw collectibles
  collectibles.forEach(c => {
    if (!c.collected) {
      ctx.fillStyle = c.color;
      const centerX = startX + c.c * stepW + stepW / 2;
      const centerY = startY + c.r * stepH + stepH / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // Draw Ghosts (behind Pac-Man)
  drawGhosts(ctx);

  // Draw Pac-Man
  ctx.fillStyle = '#FFD43B';
  ctx.beginPath();
  const centerX = startX + pacman.c * stepW + stepW / 2;
  const centerY = startY + pacman.r * stepH + stepH / 2;
  
  let angleOffset = 0;
  if (pacman.dir.c === 1) angleOffset = 0;
  else if (pacman.dir.r === 1) angleOffset = Math.PI / 2;
  else if (pacman.dir.c === -1) angleOffset = Math.PI;
  else if (pacman.dir.r === -1) angleOffset = -Math.PI / 2;

  const mouthAngle = (0.2 * pacman.open) * Math.PI;
  ctx.arc(centerX, centerY, tileSize * 0.45, angleOffset + mouthAngle, angleOffset + 2 * Math.PI - mouthAngle);
  ctx.lineTo(centerX, centerY);
  ctx.fill();

  pacman.open += 0.2 * pacman.openDir;
  if (pacman.open >= 1 || pacman.open <= 0) pacman.openDir *= -1;

  if (EDIT_COLLISION_MAP) {
    drawDebugGrid(ctx);
  }
}

function updateGame() {
  const COLS_COUNT = collisionMap[0].length;
  const ROWS_COUNT = collisionMap.length;

  // 1. Try to shift direction
  if (pacman.nextDir.r !== 0 || pacman.nextDir.c !== 0) {
    let nextR = pacman.r + pacman.nextDir.r;
    let nextC = pacman.c + pacman.nextDir.c;
    
    if (nextC < 0) nextC = COLS_COUNT - 1;
    else if (nextC >= COLS_COUNT) nextC = 0;
    
    if (nextR >= 0 && nextR < ROWS_COUNT) {
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
  
  if (nextC < 0) nextC = COLS_COUNT - 1;
  else if (nextC >= COLS_COUNT) nextC = 0;

  if (nextR >= 0 && nextR < ROWS_COUNT) {
    const char = collisionMap[nextR][nextC];
    if (char === 'P' || char === 'C') {
      pacman.r = nextR;
      pacman.c = nextC;
    }
  }

  // 3. Collect pellets
  const pellet = gamePellets.find(p => p.active && p.r === pacman.r && p.c === pacman.c);
  if (pellet) {
    pellet.active = false;
    score += 10;
    const scoreVal = document.getElementById('score-val');
    if (scoreVal) scoreVal.innerText = score;
  }

  // 4. Collect products
  collectibles.forEach(c => {
    if (!c.collected && c.r === pacman.r && c.c === pacman.c) {
      c.collected = true;
      unlockedItems.push(c.id);
      score += 1000;
      const scoreVal = document.getElementById('score-val');
      if (scoreVal) scoreVal.innerText = score;
      checkWin();
    }
  });
}

function gameLoop() {
  updateGame();
  updateGhosts();
  drawGame();
}

function startGame() {
  const readyOverlay = document.getElementById('game-ready-overlay');
  if (readyOverlay) readyOverlay.classList.remove('hidden');
  
  resizePlayfield();
  initDebugMouseListener();
  resetGame();
  drawGame();
  
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

// =========================================
// GHOST AI
// =========================================

function initGhosts() {
  ghosts = GHOST_SPAWN_DATA.map(g => ({ ...g, state: 'waiting' }));
  gameTick       = 0;
  ghostModeTick  = 0;
  ghostModePhase = 0;
  globalGhostMode = 'scatter';
}

function getGhostTarget(ghost) {
  if (ghost.state === 'scatter') return ghost.scatter;

  switch (ghost.id) {
    case 'blinky':
      return { r: pacman.r, c: pacman.c };

    case 'pinky':
      return { r: pacman.r + pacman.dir.r * 4, c: pacman.c + pacman.dir.c * 4 };

    case 'inky': {
      const blinky = ghosts.find(g => g.id === 'blinky');
      const pr = pacman.r + pacman.dir.r * 2;
      const pc = pacman.c + pacman.dir.c * 2;
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
    const nc = (ghost.c + d.c + COLS) % COLS;

    if (nr < 0 || nr >= ROWS) return false;

    const ch = collisionMap[nr][nc];
    return ch === 'P' || ch === 'C' || ch === 'G';
  });
}

function moveGhost(ghost) {
  const COLS  = collisionMap[0].length;
  const moves = getValidGhostMoves(ghost);

  if (moves.length === 0) {
    // Boxed in — force reversal
    const rev = { r: -ghost.dir.r, c: -ghost.dir.c };
    const nr  = ghost.r + rev.r;
    const nc  = (ghost.c + rev.c + COLS) % COLS;
    const ch  = collisionMap[nr]?.[nc];
    if (ch === 'P' || ch === 'C' || ch === 'G') { ghost.dir = rev; ghost.r = nr; ghost.c = nc; }
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
      const nc = (ghost.c + d.c + COLS) % COLS;
      const dist = (nr - target.r) ** 2 + (nc - target.c) ** 2;
      if (dist < bestDist) { bestDist = dist; bestDir = d; }
    }
    chosen = bestDir;
  }

  if (!chosen) return;
  ghost.dir = chosen;
  ghost.r  += chosen.r;
  ghost.c   = (ghost.c + chosen.c + COLS) % COLS;
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
  if (EDIT_COLLISION_MAP) return; // Pause ghosts when editing map
  gameTick++;

  ghosts.forEach(g => {
    if (g.state === 'waiting' && gameTick >= g.releaseAt) g.state = globalGhostMode;
  });

  updateGhostModePhase();
  ghosts.forEach(g => { if (g.state !== 'waiting') moveGhost(g); });
  checkGhostCollision();
}

function checkGhostCollision() {
  for (const ghost of ghosts) {
    if (ghost.state === 'waiting') continue;
    if (ghost.r === pacman.r && ghost.c === pacman.c) {
      triggerGameOver();
      return;
    }
  }
}

function triggerGameOver() {
  clearInterval(gameInterval);
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

  ghosts.forEach(ghost => {
    if (ghost.state === 'waiting') return;
    const x = startX + ghost.c * stepW + stepW / 2;
    const y = startY + ghost.r * stepH + stepH / 2;
    const bodyColor = ghost.state === 'frightened' ? '#0000DD' : ghost.color;
    drawGhostBody(ctx, x, y, r, bodyColor);
    drawGhostEyes(ctx, x, y, r);
  });
}

// Back to start menu
document.getElementById('btn-back-to-menu')?.addEventListener('click', () => {
  clearInterval(gameInterval);
  document.removeEventListener('keydown', handleInput);
  showScreen('gameStart');
  // Ensure the menu content is visible and other startup phases are hidden
  document.getElementById('startup-self-test')?.classList.add('hidden');
  document.getElementById('startup-attract')?.classList.add('hidden');
  const menuContent = document.getElementById('start-menu-content');
  if (menuContent) {
    menuContent.classList.remove('hidden');
    menuContent.style.opacity = '1';
  }
});

// Skip game
document.getElementById('btn-skip-game')?.addEventListener('click', () => {
  clearInterval(gameInterval);
  document.removeEventListener('keydown', handleInput);
  hasDiscount = hasDiscount || false;
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

document.getElementById('btn-replay-from-shop')?.addEventListener('click', () => {
  arcadeCollectionActive = false;
  document.removeEventListener('keydown', handleArcadeKeyboard);
  resetGame();
  showScreen('gameplay');
  startGame();
});

document.getElementById('btn-retry-game')?.addEventListener('click', () => {
  document.getElementById('game-over-overlay').classList.add('hidden');
  resetGame();
  startGame();
});

document.getElementById('btn-skip-from-over')?.addEventListener('click', () => {
  document.getElementById('game-over-overlay').classList.add('hidden');
  hasDiscount = hasDiscount || false;
  renderArcadeCollection();
  showScreen('arcadeCollection');
  initArcadeCollection();
});

function resetGame() {
  pacman.r = 11; pacman.c = 7;
  pacman.dir = { r: 0, c: 0 };
  pacman.nextDir = { r: 0, c: 0 };
  score = 0;
  const scoreVal = document.getElementById('score-val');
  if (scoreVal) scoreVal.innerText = score;
  collectibles.forEach(c => c.collected = false);
  unlockedItems = [];
  generateMapAndPellets();
  initGhosts();
}

// Play from Skip Screen
document.getElementById('btn-play-from-skip')?.addEventListener('click', () => {
  arcadeCollectionActive = false;
  document.removeEventListener('keydown', handleArcadeKeyboard);
  resetGame();
  showScreen('gameStart');
});

// =========================================
// SCREEN 7: COLLECTION
// =========================================
const productsData = [
  { id: 'tshirt', name: 'Pac-Man Graphic T-Shirt', price: 24.90, img: '👕', hasVariants: true, variants: { black: '/assets/item-tshirt-black.png', white: '/assets/item-tshirt-white.png' } },
  { id: 'sweatshirt', name: 'Pac-Man Arcade Sweatshirt', price: 49.90, img: '🧥', hasVariants: true, variants: { black: '/assets/item-sweatshirt-black.png', white: '/assets/item-sweatshirt-white.png' } },
  { id: 'cap', name: 'Pac-Man Logo Cap', price: 19.90, img: '🧢', hasVariants: true, variants: { black: '/assets/item-cap-black.png', white: '/assets/item-cap-white.png' } },
  { id: 'tote', name: 'UNIQLO x Pac-Man Bag', price: 14.90, img: '👜', hasVariants: true, variants: { black: '/assets/item-bag-black.png', white: '/assets/item-bag-white.png' } }
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
    document.getElementById('btn-replay-from-shop')?.classList.remove('hidden');
  } else {
    statusEl.innerText = '[ STANDARD STORE ]';
    statusEl.classList.remove('blink-fast');
    statusEl.style.color = '#888';
    titleEl.innerText = 'UNIQLO x PAC-MAN';
    subtitleEl.innerText = '// BROWSE COLLECTION';
    document.getElementById('skip-game-prompt')?.classList.remove('hidden');
    document.getElementById('btn-replay-from-shop')?.classList.add('hidden');
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

if (EDIT_COLLISION_MAP) {
  document.getElementById('btn-copy-map')?.classList.remove('hidden');
} else {
  document.getElementById('btn-copy-map')?.classList.add('hidden');
}

document.getElementById('btn-copy-map')?.addEventListener('click', () => {
  const mapStr = collisionMap.map(row => `  "${row}"`).join(",\n");
  const formatted = `const collisionMap = [\n${mapStr}\n];`;
  
  navigator.clipboard.writeText(formatted).then(() => {
    alert("Collision Map copied to clipboard!");
  }).catch(err => {
    console.error("Failed to copy map: ", err);
    // fallback
    const textarea = document.createElement("textarea");
    textarea.value = formatted;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    alert("Collision Map copied to clipboard!");
  });
});

window.addEventListener('resize', resizePlayfield);
showScreen('landing');
