import * as THREE from 'three';
import { GLTFLoader }                        from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader }                         from 'three/examples/jsm/loaders/EXRLoader.js';
import { OrbitControls }                     from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject }        from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { MeshoptDecoder }                    from 'https://unpkg.com/three@0.185.0/examples/jsm/libs/meshopt_decoder.module.js';
import gsap                                  from 'gsap';

/* ==========================================================
   GLOBAL STATE VARIABLES
   ========================================================== */
let canvas, hint, infoCard, infoCardClose, infoCardNumber, infoCardTitle, infoCardDesc;
let navTitle, entranceBtn, debugPanel, debugName, debugCam, debugTarget;
let DEBUG = false;
let FREECAM = false;
let pixelRatioLimit = 1.3;
let fpsHistory = [];
let throttleTriggered = false;
const secondaryLights = [];
let scene, camera, renderer, labelRenderer, controls;
let model, mixer = null, pacmanPrompt = null;
let clickableMeshes = [];
let cameraTarget = new THREE.Vector3();
let currentPointIndex = -1;
let sceneInitialized = false;
let blackFade;
let arcadeAnimationId = null;
const brokenScreenMaterials = [];
const clock = new THREE.Clock();

const MODEL_URL = './models/scena-arcade.glb';

const TOUR_POINTS = [
  {
    id: 'mk2',
    number: '1',
    title: 'Mortal Kombat 2',
    description: 'The second game in the Mortal Kombat series from 1997, improving the gameplay and expanding the mythos of the original Mortal Kombat, introducing more varied moves and several icon characters.',
    // Marker Y raised above the marquee (was 1.95) so the number floats
    // clear of the cabinet art instead of covering it. Heights alternate
    // (low/high) between consecutive tour points so two markers that are
    // close together in depth never land on the same screen-space band.
    markerPosition: new THREE.Vector3( 2.1,  2.15, -0.2),
    cameraPosition: new THREE.Vector3(-0.5,  1.55, -0.2),
    cameraTarget:   new THREE.Vector3( 2.2,  1.25, -0.2),
  },
  {
    id: 'pacman',
    number: '2',
    title: 'Pac-Man',
    description: 'First introduced in Shibuya, Tokyo in an arcade in 1980. The game was originally called PuckMan.',
    markerPosition: new THREE.Vector3( 2.1,  2.40, -1.2),
    cameraPosition: new THREE.Vector3(-0.5,  1.55, -1.2),
    cameraTarget:   new THREE.Vector3( 2.1,  1.45, -1.2),
  },
  {
    id: 'doubledragon',
    number: '3',
    title: 'Double Dragon',
    description: "Double Dragon is a 1987 beat 'em up video game series. It features twins martial artists Billy and Jimmy Lee, as they fight against various adversaries and rivals.",
    markerPosition: new THREE.Vector3( 2.1,  2.15, -2.2),
    cameraPosition: new THREE.Vector3(-0.5,  1.55, -2.2),
    cameraTarget:   new THREE.Vector3( 2.2,  1.25, -2.2),
  },
  {
    id: 'mk3ultimate',
    number: '4',
    title: 'Mortal Kombat 3 Ultimate',
    description: "Released in 1995, personally I think it's one of the best Mortal Kombat games made. With some favourite character returns such as Scorpion and Kitana, who were missing from Mortal Kombat 3.",
    markerPosition: new THREE.Vector3(-2.3,  2.75,  -0.5),
    cameraPosition: new THREE.Vector3( 1.2,  1.55, -0.5),
    cameraTarget:   new THREE.Vector3(-2.4,  1.25, -0.5),
  },
  {
    id: 'backtothefuture',
    number: '5',
    title: 'Back to the Future Pinball',
    description: 'Released 1990 a month after the third movie it features some great soundtracks from the trilogy.',
    markerPosition: new THREE.Vector3(-1.3,  2.15, -1.0),
    cameraPosition: new THREE.Vector3( 1.2,  1.55, -1.0),
    cameraTarget:   new THREE.Vector3(-1.5,  1.20, -1.0),
  },
  {
    id: 'addamsfamily',
    number: '6',
    title: 'The Addams Family Pinball',
    description: "Released in 1992 it was based on the film of the same name. It has some great game modes and custom speeches from the characters.",
    markerPosition: new THREE.Vector3(-1.3,  2.40, -1.8),
    cameraPosition: new THREE.Vector3( 1.2,  1.55, -1.8),
    cameraTarget:   new THREE.Vector3(-1.5,  1.20, -1.8),
  },
];

const ENTRANCE_VIEW = {
  cameraPosition: new THREE.Vector3(0, 1.65, 4),
  cameraTarget:   new THREE.Vector3(0, 1.6, -0.5),
};

// Extra yaw (degrees, world Y axis) applied to the Pac-Man cabinet on load
// so it faces the camera more frontally. Code-only fix, GLB untouched.
// Tuned empirically via live screenshots at the 'pacman' tour point.
const PACMAN_CABINET_YAW_DEG = 6.8;

const CLICKABLE_KEYWORDS = {
  pacman: ['pac'],
  arcade: ['arcad', 'cabinet', 'machine', 'screen', 'mortal', 'kombat', 'dragon', 'pinball', 'flipper', 'back', 'addams'],
};

const SCREEN_KEYWORDS = ['screen', 'monitor', 'display', 'crt', 'lcd', 'glass', 'tv'];
const PACMAN_KEYWORDS = ['pac'];

const FOREST_BG_INTENSITY  = 0.05;
const FOREST_ENV_INTENSITY = 0.09;

/* ==========================================================
   GLOBAL EXPORTED INITIALIZATION FUNCTION
   ========================================================== */
window.initArcadeExperience = function() {
  if (sceneInitialized) {
    // Restart the render loop if it was stopped when leaving the room
    // (enterScreen cancels it so it doesn't run behind the gameplay).
    if (!arcadeAnimationId) {
      clock.getDelta(); // flush the large idle delta so the mixer doesn't jump
      animate();
    }
    // Re-attach the window listeners removed by enterScreen — without this,
    // a second visit to the room has dead canvas clicks/hover and no resize.
    window.removeEventListener('click', onCanvasClick);
    window.removeEventListener('mousemove', onCanvasMouseMove);
    window.removeEventListener('resize', onResize);
    window.addEventListener('click', onCanvasClick);
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('resize', onResize);
    goToEntrance();
    return;
  }
  sceneInitialized = true;
  initScene();
  animate();
};

/* ==========================================================
   SCENE INITIALIZATION
   ========================================================== */
function initScene() {
  // Reset performance tracking state
  fpsHistory = [];
  throttleTriggered = false;
  secondaryLights.length = 0;
  pixelRatioLimit = 1.3;

  // DOM References
  canvas         = document.querySelector('#three-canvas');
  hint           = document.querySelector('#hint');
  infoCard       = document.querySelector('#info-card');
  infoCardClose  = document.querySelector('#info-card-close');
  infoCardNumber = document.querySelector('#info-card-number');
  infoCardTitle  = document.querySelector('#info-card-title');
  infoCardDesc   = document.querySelector('#info-card-description');
  navTitle       = document.querySelector('#btn-return-entrance');
  entranceBtn    = document.querySelector('#btn-return-entrance');
  debugPanel     = document.querySelector('#debug-panel');
  debugName      = document.querySelector('#debug-name');
  debugCam       = document.querySelector('#debug-hierarchy');
  debugTarget    = document.querySelector('#debug-position');

  DEBUG = new URLSearchParams(window.location.search).has('debug');
  if (!DEBUG && debugPanel) debugPanel.style.display = 'none';

  cameraTarget.copy(ENTRANCE_VIEW.cameraTarget);

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 150);
  camera.position.copy(ENTRANCE_VIEW.cameraPosition);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioLimit));
  renderer.outputColorSpace   = THREE.SRGBColorSpace;
  renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  // CSS2D renderer for hotspot markers
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5';
  
  const screenReveal = document.getElementById('screen-arcade-reveal');
  if (screenReveal) {
    screenReveal.appendChild(labelRenderer.domElement);
  } else {
    document.body.appendChild(labelRenderer.domElement);
  }

  // Set up OrbitControls (disabled, but camera target uses it)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enableZoom    = false;
  controls.enablePan     = false;
  controls.enableRotate  = false;
  controls.enabled       = false;

  scene.background = new THREE.Color(0x02040d);
  scene.fog        = new THREE.Fog(0x02040d, 6, 28);

  scene.backgroundIntensity  = FOREST_BG_INTENSITY;
  scene.environmentIntensity = FOREST_ENV_INTENSITY;
  scene.backgroundBlurriness = 0.03;

  const pmrem = new THREE.PMREMGenerator(renderer);
  new EXRLoader().load(
    './forest_grove_4k.exr',
    (texture) => {
      texture.mapping   = THREE.EquirectangularReflectionMapping;
      scene.environment = pmrem.fromEquirectangular(texture).texture;
      scene.background  = texture;
      pmrem.dispose();
      if (DEBUG) console.log('[Forest] EXR loaded and applied.');
    },
    undefined,
    (err) => console.error('[Forest] Error loading EXR:', err)
  );

  // Lights setup
  const ambientLight = new THREE.AmbientLight(0x10182e, 1.0);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0x6688ff, 0.4);
  directionalLight.position.set(2, 5, 5);
  scene.add(directionalLight);

  // Ceiling point lights consolidated into one point light
  const ceilingLightCombined = new THREE.PointLight(0x6e00ea, 2.5, 15);
  ceilingLightCombined.position.set(0, 2.2, -0.5);
  scene.add(ceilingLightCombined);

  // Ambient/neon side lights kept for highlight effects
  const neonLightLeft = new THREE.PointLight(0xff0055, 0.7, 8);
  neonLightLeft.position.set(-1.8, 1.0, 1.0);
  scene.add(neonLightLeft);

  const neonLightRight = new THREE.PointLight(0x00f0ff, 0.9, 8);
  neonLightRight.position.set(1.8, 1.0, 1.5);
  scene.add(neonLightRight);

  // Soft fill point light (throttled if needed)
  const fillLight = new THREE.PointLight(0x445577, 0.9, 14);
  fillLight.position.set(0, 2.5, -0.5);
  scene.add(fillLight);
  secondaryLights.push(fillLight);

  // Left wall spots consolidated into one spot (throttled if needed)
  const leftWallCombined = new THREE.PointLight(0x7a44ff, 1.6, 9);
  leftWallCombined.position.set(-2.6, 2.0, -0.5);
  scene.add(leftWallCombined);
  secondaryLights.push(leftWallCombined);

  // Pac-Man cabinet lights consolidated to one soft focus light
  const pacmanGlowCombined = new THREE.PointLight(0xffee33, 1.2, 4.0);
  pacmanGlowCombined.position.set(1.85, 1.35, -1.2);
  scene.add(pacmanGlowCombined);

  createExteriorEnvironment();
  createGrassTufts();

  // Create black transition overlay inside screen-arcade-reveal
  if (!blackFade) {
    blackFade = document.createElement('div');
    blackFade.style.cssText =
      'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:90;';
    if (screenReveal) {
      screenReveal.appendChild(blackFade);
    } else {
      document.body.appendChild(blackFade);
    }
  }

  // Model Loading
  // The optimized GLB uses EXT_meshopt_compression (required extension) for
  // its geometry buffers, so the loader needs the Meshopt decoder wired up
  // or it will refuse to parse the file.
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    MODEL_URL,
    (gltf) => {
      model = gltf.scene;
      scene.add(model);

      model.traverse((child) => {
        if (child.isMesh) clickableMeshes.push(child);
      });

      const box    = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const scaleFactor = 0.0382;
      model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      model.position.x = -center.x * scaleFactor;
      model.position.y = -box.min.y * scaleFactor;
      model.position.z = -center.z * scaleFactor - 1.18;

      camera.position.copy(ENTRANCE_VIEW.cameraPosition);
      cameraTarget.copy(ENTRANCE_VIEW.cameraTarget);
      controls.target.copy(ENTRANCE_VIEW.cameraTarget);
      camera.lookAt(cameraTarget);
      controls.update();

      model.traverse((child) => {
        if (!child.isMesh) return;
        const nameChain = getNameChain(child).toLowerCase();
        const isScreen  = SCREEN_KEYWORDS.some(k => nameChain.includes(k));
        if (!isScreen) return;
        const isPacman  = PACMAN_KEYWORDS.some(k => nameChain.includes(k));
        if (isPacman) return;
        applyBrokenScreen(child);
      });

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(clip => mixer.clipAction(clip).play());
      }

      // Re-aim the Pac-Man cabinet so its screen/marquee faces the camera
      // more frontally. It's a standalone top-level node in the GLB ("pac
      // man machine_automat_0") whose baked quaternion only encodes an
      // up-axis correction (X) + base facing (Z) — no yaw. Rotating around
      // the WORLD Y axis turns it in place without disturbing that
      // up-axis correction, and without touching any other cabinet.
      // Re-aim the Pac-Man cabinet so its screen/marquee faces the camera
      // more frontally. It's a standalone top-level node in the GLB. Note:
      // GLTFLoader sanitizes node names (spaces -> underscores) when
      // building the runtime object graph, so the loaded object's name is
      // "pac_man_machine_automat_0" even though the raw GLB JSON stores it
      // as "pac man machine_automat_0". Its baked quaternion only encodes
      // an up-axis correction (X) + base facing (Z) — no yaw. Rotating
      // around the WORLD Y axis turns it in place without disturbing that
      // up-axis correction, and without touching any other cabinet.
      const pacmanCabinet = model.getObjectByName('pac_man_machine_automat_0');
      if (pacmanCabinet) {
        pacmanCabinet.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(PACMAN_CABINET_YAW_DEG));
      }

      createHotspots();

      const promptEl = document.createElement('div');
      // NOTE: intentionally NOT sharing the .arcade-btn class here — Three.js
      // (CSS2DRenderer) drives this element's inline `transform` every frame
      // to track its 3D position, and .arcade-btn's hover/transition rules
      // touch `transform`/`transition:all`, which fights that positioning.
      // .screen-prompt below duplicates the same Primary token values instead.
      promptEl.className   = 'screen-prompt';
      promptEl.textContent = '> CLICK TO ENTER';
      promptEl.addEventListener('click', (e) => { e.stopPropagation(); enterScreen(); });
      pacmanPrompt = new CSS2DObject(promptEl);
      const pacPt = TOUR_POINTS.find(p => p.id === 'pacman');
      pacmanPrompt.position.copy(pacPt.cameraTarget);
      pacmanPrompt.position.y -= 0.22;
      pacmanPrompt.visible = false;
      scene.add(pacmanPrompt);

      hint.style.display = 'none';

      // Model ready: fade the ROM loading overlay away
      const overlay = document.getElementById('arcade-loading-overlay');
      if (overlay) {
        const fill = document.getElementById('rom-progress-fill');
        const pct  = document.getElementById('rom-progress-pct');
        if (fill) fill.style.width = '100%';
        if (pct)  pct.textContent = '100%';
        overlay.classList.add('done');
      }
    },
    (progress) => {
      const fill = document.getElementById('rom-progress-fill');
      const pct  = document.getElementById('rom-progress-pct');
      if (progress.total) {
        const p = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
        if (fill) fill.style.width = p + '%';
        if (pct)  pct.textContent = p + '%';
      } else if (pct) {
        // No content-length available: show transferred MB instead of a percentage
        pct.textContent = (progress.loaded / (1024 * 1024)).toFixed(1) + ' MB';
      }
    },
    (error) => {
      console.error(error);
      hint.textContent = 'Error: GLB not found at public/models/scena-arcade.glb';
      const pct = document.getElementById('rom-progress-pct');
      if (pct) pct.textContent = 'ERROR: ROM NOT FOUND';
    }
  );

  // General Event Listeners
  window.addEventListener('click', onCanvasClick);
  window.addEventListener('mousemove', onCanvasMouseMove);
  window.addEventListener('resize', onResize);

  // Navigation Panel Listeners
  infoCardClose.addEventListener('click', () => infoCard.classList.add('hidden'));
  renderRoomDots();
  if (entranceBtn) {
    entranceBtn.addEventListener('click', goToEntrance);
  }

  const backUniqloBtn = document.querySelector('#back-uniqlo-btn');
  if (backUniqloBtn) {
    backUniqloBtn.addEventListener('click', () => {
      goToEntrance();
      if (typeof window.startReverseTransition === 'function') {
        window.startReverseTransition();
      }
    });
  }
}

/* ==========================================================
   BROKEN SCREEN SHADER
   ========================================================== */
const BROKEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BROKEN_FRAG = /* glsl */`
  uniform float time;
  varying vec2 vUv;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float bandId    = floor(uv.y * 35.0);
    float timeSlot  = floor(time * 7.0);
    float glitch    = step(0.95, rand(vec2(bandId, timeSlot)));
    uv.x += glitch * (rand(vec2(time * 0.3, uv.y)) - 0.5) * 0.12;

    float scan = sin(uv.y * 220.0) * 0.035 + 0.02;
    float noise = rand(uv + time * 0.05);

    vec3 col = vec3(0.08, 0.10, 0.09);
    col += noise * vec3(0.45, 0.52, 0.46);
    col += scan;
    col += glitch * vec3(0.25, 0.35, 0.28) * rand(vec2(time, uv.y));

    float flicker = 1.0 - step(0.93, rand(vec2(floor(time * 18.0), 0.5))) * 0.55;
    col *= flicker;

    float vig = smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x)
              * smoothstep(0.0, 0.20, uv.y) * smoothstep(1.0, 0.80, uv.y);
    col *= vig * 0.35 + 0.65;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function applyBrokenScreen(mesh) {
  const mat = new THREE.ShaderMaterial({
    vertexShader:   BROKEN_VERT,
    fragmentShader: BROKEN_FRAG,
    uniforms:       { time: { value: 0 } },
    side:           THREE.DoubleSide,
  });
  mesh.material = mat;
  brokenScreenMaterials.push(mat);
}

/* ==========================================================
   NAVIGATION
   ========================================================== */
function goToPoint(index) {
  if (index < 0 || index >= TOUR_POINTS.length) return;

  if (index === currentPointIndex && TOUR_POINTS[index].id === 'pacman') {
    enterScreen();
    return;
  }

  currentPointIndex = index;
  const point = TOUR_POINTS[index];

  moveCamera(point.cameraPosition, point.cameraTarget, 1.6);
  updateInfoCard(point);
  updateBottomBar(point);
  updateActiveMarker(index);
  updateRoomDots(index);
  if (pacmanPrompt) pacmanPrompt.visible = (point.id === 'pacman');

  if (DEBUG) {
    debugName.textContent   = `${point.number}. ${point.title}`;
    debugCam.textContent    = `X:${point.cameraPosition.x} Y:${point.cameraPosition.y} Z:${point.cameraPosition.z}`;
    debugTarget.textContent = `X:${point.cameraTarget.x} Y:${point.cameraTarget.y} Z:${point.cameraTarget.z}`;
  }
}

function updateInfoCard(point) {
  infoCardNumber.textContent = `Point ${point.number} of ${TOUR_POINTS.length}`;
  infoCardTitle.textContent  = point.title;
  infoCardDesc.textContent   = point.description;
  infoCard.classList.remove('hidden');
}

function updateBottomBar(point) {
  // navTitle.textContent = point.title;
}

function goToEntrance() {
  moveCamera(ENTRANCE_VIEW.cameraPosition, ENTRANCE_VIEW.cameraTarget, 1.6);
  infoCard.classList.add('hidden');
  updateActiveMarker(-1);
  updateRoomDots(-1);
  if (pacmanPrompt) pacmanPrompt.visible = false;
  // navTitle.textContent = 'Explore the arcade';
  currentPointIndex    = -1;
}
window.goToEntrance3D = goToEntrance;

function updateActiveMarker(activeIndex) {
  document.querySelectorAll('.hotspot-marker').forEach((el, i) => {
    el.classList.toggle('active', i === activeIndex);
  });
}

/* ==========================================================
   ROOM DOTS — position indicator + direct jump, replaces the
   prev/next arrows so this control never reads as "back"
   ========================================================== */
function renderRoomDots() {
  const wrap = document.querySelector('#room-dots');
  if (!wrap) return;
  wrap.innerHTML = '';
  TOUR_POINTS.forEach((point, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'room-dot';
    dot.setAttribute('aria-label', point.title);
    dot.addEventListener('click', () => goToPoint(i));
    wrap.appendChild(dot);
  });
}

function updateRoomDots(activeIndex) {
  document.querySelectorAll('.room-dot').forEach((d, i) => {
    d.classList.toggle('active', i === activeIndex);
  });
}

/* ==========================================================
   CREATE HOTSPOT MARKERS (CSS2DObject)
   ========================================================== */
function createHotspots() {
  TOUR_POINTS.forEach((point, index) => {
    const isPacman = point.id === 'pacman';

    const el = document.createElement('div');
    el.className   = `hotspot-marker ${isPacman ? 'available' : 'locked'}`;
    el.id          = `hotspot-${point.id}`;
    el.textContent = point.number;

    if (!isPacman) {
      const lock = document.createElement('span');
      lock.className = 'lock-badge';
      lock.innerHTML =
        '<svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor">' +
        '<path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z"/>' +
        '</svg>';
      el.appendChild(lock);
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      goToPoint(index);
    });

    const obj = new CSS2DObject(el);
    obj.position.copy(point.markerPosition);
    scene.add(obj);
  });
}

/* ==========================================================
   CANVAS CLICK & HOVER INTERACT
   ========================================================== */
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

function onCanvasClick(event) {
  if (event.target !== canvas) return;
  const hit = getHit(event);
  if (!hit) return;

  const names = getNameChain(hit.object).toLowerCase();

  if (CLICKABLE_KEYWORDS.pacman.some(k => names.includes(k))) {
    goToPoint(TOUR_POINTS.findIndex(p => p.id === 'pacman'));
    return;
  }

  if (CLICKABLE_KEYWORDS.arcade.some(k => names.includes(k))) {
    const wp = new THREE.Vector3();
    hit.object.getWorldPosition(wp);
    if (wp.x < 0) {
      const id = wp.z < -0.6 ? 'backtothefuture' : 'mk2';
      goToPoint(TOUR_POINTS.findIndex(p => p.id === id));
    } else {
      goToPoint(TOUR_POINTS.findIndex(p => p.id === 'mk3ultimate'));
    }
  }
}

function onCanvasMouseMove(event) {
  if (event.target !== canvas) return;
  const hit = getHit(event);
  if (!hit) { document.body.style.cursor = 'default'; return; }
  const names = getNameChain(hit.object).toLowerCase();
  const ok = [...CLICKABLE_KEYWORDS.pacman, ...CLICKABLE_KEYWORDS.arcade]
    .some(k => names.includes(k));
  document.body.style.cursor = ok ? 'pointer' : 'default';
}

/* ==========================================================
   ENTER SCREEN (Transition into Pac-Man gameplay screens)
   ========================================================== */
function enterScreen() {
  if (pacmanPrompt) pacmanPrompt.visible = false;
  // Camera lowered (was y=1.45) and aimed only slightly upward (target
  // y=1.25, was 1.45 then over-corrected to 1.60) so the full cabinet
  // screen is framed — the previous target was too high and showed the
  // room ceiling instead of the game screen. Tuned empirically via
  // frozen-timeline screenshots at the 'pacman' enterScreen() moment.
  const pos    = new THREE.Vector3(1.35, 1.55, -1.2);
  const target = new THREE.Vector3(2.20, 1.00, -1.2);
  const WALK   = 3.2;

  moveCamera(pos, target, WALK);

  // Runs exactly once, whichever fires first: the real gsap fade-to-black
  // completing, or the fallback timer below. Without this guard, a player
  // who tabs away (or any other rAF hiccup) mid-walk can strand the gsap
  // tween indefinitely — rAF-driven tweens don't advance on a backgrounded
  // tab — leaving the red Press Start button stuck behind a black screen
  // with no way forward. Same "readyDone" pattern used in startGame().
  let enteredDone = false;
  const finishEnterScreen = () => {
    if (enteredDone) return;
    enteredDone = true;
    clearTimeout(enterScreenFallback);

    // Show red press-start button → user clicks → code explosion → ghost intro → gameplay
    if (typeof window.showPressStartButton === 'function') {
      window.showPressStartButton();
    } else if (typeof window.transitionFromArcadeToGameStart === 'function') {
      window.transitionFromArcadeToGameStart();
    }

    // Clean up local listeners to prevent leaks
    window.removeEventListener('click', onCanvasClick);
    window.removeEventListener('mousemove', onCanvasMouseMove);
    window.removeEventListener('resize', onResize);

    // Stop the 3D room render loop: it would otherwise keep rendering the
    // heavy scene at 60fps behind the gameplay, stealing frames from the
    // Pac-Man game (visible as stutter in its first seconds).
    cancelAnimationFrame(arcadeAnimationId);
    arcadeAnimationId = null;

    // Reset fade so the room can be reloaded later if needed
    gsap.set(blackFade, { opacity: 0 });
  };

  // Fallback: guarantees the player always reaches Press Start even if the
  // fade tween never completes. Set comfortably past the real WALK + delay
  // + fade duration (~4.6s), so it should only ever fire on a genuine stall.
  const enterScreenFallback = setTimeout(finishEnterScreen, (WALK + 0.2 + 1.2) * 1000 + 2000);

  gsap.killTweensOf(blackFade);
  gsap.set(blackFade, { opacity: 0 });
  gsap.to(blackFade, {
    opacity:    1,
    duration:   1.2,
    delay:      WALK + 0.2, // was +0.7 — shorter hold once the camera stops
    ease:       'power2.inOut',
    onComplete: finishEnterScreen,
  });
}

/* ==========================================================
   CAMERA & INTERACTIVE UTILS
   ========================================================== */
const LOOK_FAR  = 15;
const _camProxy = { t: 0 };

function moveCamera(position, target, duration, onComplete) {
  gsap.killTweensOf(_camProxy);
  _camProxy.t = 0;
  controls.enabled = false;

  const fromPos    = camera.position.clone();
  const fromTarget = cameraTarget.clone();
  const toPos      = new THREE.Vector3(position.x, position.y, position.z);

  const fromDir = new THREE.Vector3().subVectors(fromTarget, fromPos).normalize();
  const toDir   = new THREE.Vector3().subVectors(target, toPos).normalize();

  const startH = Math.atan2(fromDir.x, -fromDir.z);
  const endH   = Math.atan2(toDir.x,   -toDir.z);
  let deltaH   = endH - startH;
  if (deltaH >  Math.PI) deltaH -= Math.PI * 2;
  if (deltaH < -Math.PI) deltaH += Math.PI * 2;

  const startV = Math.asin(Math.max(-1, Math.min(1, fromDir.y)));
  const endV   = Math.asin(Math.max(-1, Math.min(1, toDir.y)));
  const deltaV = endV - startV;

  gsap.to(_camProxy, {
    t: 1,
    duration,
    ease: 'power2.inOut',

    onUpdate() {
      const p = _camProxy.t;
      camera.position.lerpVectors(fromPos, toPos, p);

      const hAngle = startH + deltaH * p;
      const vAngle = startV + deltaV * p;
      const cosV   = Math.cos(vAngle);

      cameraTarget.set(
        camera.position.x + Math.sin(hAngle) * cosV * LOOK_FAR,
        camera.position.y + Math.sin(vAngle)        * LOOK_FAR,
        camera.position.z - Math.cos(hAngle) * cosV * LOOK_FAR
      );
    },

    onComplete() {
      camera.position.copy(toPos);
      cameraTarget.copy(target);
      if (onComplete) onComplete();
    },
  });
}

function getHit(event) {
  if (!clickableMeshes.length) return null;
  const rect  = renderer.domElement.getBoundingClientRect();
  mouse.x     = ((event.clientX - rect.left) / rect.width)  *  2 - 1;
  mouse.y     = ((event.clientY - rect.top)  / rect.height) * -2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return raycaster.intersectObjects(clickableMeshes, true)[0] || null;
}

function getNameChain(object) {
  const names = [];
  let cur = object;
  while (cur) { if (cur.name) names.push(cur.name); cur = cur.parent; }
  return names.join(' | ');
}

/* ==========================================================
   EXTERIOR LANDSCAPE GENERATION
   ========================================================== */
function makeGrassTexture() {
  const size = 1024;
  const c    = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#13200d';
  ctx.fillRect(0, 0, size, size);

  const blobs = [
    ['#1c3014', 200],
    ['#0d180a', 230],
    ['#26401c', 120],
    ['#2c2413',  80],
    ['#181308',  70],
  ];
  for (const [col, count] of blobs) {
    ctx.fillStyle = col;
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = 0.25 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, 8 + Math.random() * 40, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const h = 3 + Math.random() * 9;
    const a = (Math.random() - 0.5) * 0.6;
    ctx.strokeStyle = `rgb(${(18 + Math.random() * 22) | 0}, ${(60 + Math.random() * 70) | 0}, ${(20 + Math.random() * 22) | 0})`;
    ctx.lineWidth   = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(a) * h, y - Math.cos(a) * h);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBladeGeometry() {
  const w   = 0.02;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -w,        0.0, 0.0,
     w,        0.0, 0.0,
    -w * 0.55, 0.5, 0.07,
     w * 0.55, 0.5, 0.07,
     0.0,      1.0, 0.16,
  ]);
  const cb = [0.05, 0.09, 0.03];
  const cm = [0.10, 0.17, 0.06];
  const ct = [0.16, 0.26, 0.10];
  const colors = new Float32Array([...cb, ...cb, ...cm, ...cm, ...ct]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 4]);
  geo.computeVertexNormals();
  return geo;
}

function createGrassTufts() {
  const TUFTS    = 1500;
  const PER_TUFT = 12;
  const AREA     = 20;

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness:    1.0,
    metalness:    0.0,
    side:         THREE.DoubleSide,
  });

  const mesh = new THREE.InstancedMesh(makeBladeGeometry(), mat, TUFTS * PER_TUFT);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  let i = 0;

  for (let t = 0; t < TUFTS; t++) {
    let cx, cz;
    do {
      cx = (Math.random() * 2 - 1) * AREA;
      cz = (Math.random() * 2 - 1) * AREA;
    } while (Math.abs(cx) < 3.6 && cz > -4 && cz < 6);

    for (let b = 0; b < PER_TUFT; b++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * 0.25;
      dummy.position.set(cx + Math.cos(ang) * rad, 0, cz + Math.sin(ang) * rad);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.35,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.35
      );
      const hgt = 0.18 + Math.random() * 0.30;
      dummy.scale.set(0.8 + Math.random() * 0.6, hgt, 0.8 + Math.random() * 0.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}

function createExteriorEnvironment() {
  const group = new THREE.Group();

  const grassTex = makeGrassTexture();
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(40, 40);
  grassTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const grassMat = new THREE.MeshStandardMaterial({
    map:       grassTex,
    roughness: 1.0,
    metalness: 0.0,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), grassMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  group.add(floor);

  scene.add(group);
}

/* ==========================================================
   RESIZE & ANIMATION RENDER LOOP
   ========================================================== */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioLimit));
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  arcadeAnimationId = requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const t     = clock.elapsedTime;
  for (const mat of brokenScreenMaterials) mat.uniforms.time.value = t;

  if (mixer) mixer.update(delta);

  // Auto-throttling performance logic
  if (delta > 0) {
    const fps = 1.0 / delta;
    if (model && !throttleTriggered) {
      fpsHistory.push(fps);
      if (fpsHistory.length > 90) { // Check last 90 frames (1.5 seconds)
        fpsHistory.shift();
        const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
        if (avgFps < 42) {
          triggerPerformanceThrottle();
        }
      }
    }
  }

  if (FREECAM) {
    controls.update();
  } else {
    camera.lookAt(cameraTarget);
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function triggerPerformanceThrottle() {
  throttleTriggered = true;
  pixelRatioLimit = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioLimit));
  secondaryLights.forEach(light => {
    light.intensity *= 0.25;
  });
  if (DEBUG) {
    console.warn('[Performance Throttle] Frame rate below 42FPS. Dropped pixelRatio to 1.0 and dimmed fill lights.');
  }
}
