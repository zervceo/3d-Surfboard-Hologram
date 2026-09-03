import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { buildBoardGeometries } from './js/geometry.js';
import { buildFinGroup } from './js/fins.js';
import { createHologramMaterial, updateHologramUniforms } from './js/hologramMaterial.js';
import { SHAPE_PRESETS, COLORWAYS, NOSE_SHAPES, TAIL_SHAPES, FIN_SETUPS, cloneDefaultState } from './js/presets.js';

// ---------------------------------------------------------------------------
// WebGL availability check
// ---------------------------------------------------------------------------

function isWebglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

if (!isWebglAvailable()) {
  document.getElementById('webgl-fallback').hidden = false;
  document.getElementById('scene').style.display = 'none';
  throw new Error('WebGL unavailable');
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = cloneDefaultState();
let activeShapePresetKey = 'shortboard';
let activeColorwayKey = 'deep-space';

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();

function makeBackgroundTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0c1130');
  grad.addColorStop(0.5, '#05060e');
  grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
scene.background = makeBackgroundTexture();
scene.fog = new THREE.FogExp2(0x05060e, 0.0022);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 3000);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.0;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI - 0.35;

let resumeTimer = null;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  if (resumeTimer) clearTimeout(resumeTimer);
  hideHint();
});
controls.addEventListener('end', () => {
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 3500);
});

// ---------------------------------------------------------------------------
// Ambient scene dressing: pedestal grid, light cone, particles
// ---------------------------------------------------------------------------

function makeGlowSpriteTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const dressing = new THREE.Group();
scene.add(dressing);

const pedestalGroup = new THREE.Group();
dressing.add(pedestalGroup);

function buildPedestal(radius) {
  pedestalGroup.clear();

  const ringMat = new THREE.LineBasicMaterial({
    color: 0x8a5cff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  [0.55, 0.78, 1.0].forEach((f, i) => {
    const pts = [];
    const segs = 96;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius * f, 0, Math.sin(a) * radius * f));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = ringMat.clone();
    mat.opacity = 0.32 - i * 0.09;
    pedestalGroup.add(new THREE.LineLoop(geo, mat));
  });

  const discGeo = new THREE.CircleGeometry(radius * 1.05, 64);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x2a1f66, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  pedestalGroup.add(disc);

  const coneGeo = new THREE.CylinderGeometry(radius * 0.06, radius * 0.85, radius * 1.6, 48, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x8a5cff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = radius * 0.8;
  pedestalGroup.add(cone);

  pedestalGroup.userData.ringMats = pedestalGroup.children.filter((c) => c.isLineLoop).map((c) => c.material);
  pedestalGroup.userData.discMat = discMat;
  pedestalGroup.userData.coneMat = coneMat;
}

const PARTICLE_COUNT = 180;
const particleGeo = new THREE.BufferGeometry();
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleSpeeds = new Float32Array(PARTICLE_COUNT);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particlePositions[i * 3] = (Math.random() - 0.5) * 140;
  particlePositions[i * 3 + 1] = Math.random() * 80 - 10;
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  particleSpeeds[i] = 1.5 + Math.random() * 2.5;
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particleMat = new THREE.PointsMaterial({
  size: 0.55,
  map: makeGlowSpriteTexture(),
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  color: 0xbcd4ff,
});
const particles = new THREE.Points(particleGeo, particleMat);
dressing.add(particles);

function updateParticles(dt) {
  const arr = particleGeo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    arr[i * 3 + 1] += particleSpeeds[i] * dt * 0.6;
    if (arr[i * 3 + 1] > 70) {
      arr[i * 3 + 1] = -10;
      arr[i * 3] = (Math.random() - 0.5) * 140;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
  }
  particleGeo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45, 0.4, 0.42,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Board materials (persist across geometry rebuilds)
// ---------------------------------------------------------------------------

const materials = {
  deck: createHologramMaterial(state.colors.deck, state.colors.holo, 0.66),
  bottom: createHologramMaterial(state.colors.bottom, state.colors.holo, 0.66),
  rail: createHologramMaterial(state.colors.rail, state.colors.holo, 0.8),
  stringer: createHologramMaterial(state.colors.stringer, state.colors.holo, 0.92),
  pinline: createHologramMaterial(state.colors.pinline, state.colors.holo, 0.9),
  fins: createHologramMaterial(state.colors.fins, state.colors.holo, 0.82),
};

const edgeMaterial = new THREE.LineBasicMaterial({
  color: state.colors.holo, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
});
const wireMaterial = new THREE.LineBasicMaterial({
  color: state.colors.holo, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
});

function applyColors() {
  materials.deck.uniforms.uColor.value.set(state.colors.deck);
  materials.bottom.uniforms.uColor.value.set(state.colors.bottom);
  materials.rail.uniforms.uColor.value.set(state.colors.rail);
  materials.stringer.uniforms.uColor.value.set(state.colors.stringer);
  materials.pinline.uniforms.uColor.value.set(state.colors.pinline);
  materials.fins.uniforms.uColor.value.set(state.colors.fins);
  Object.values(materials).forEach((m) => m.uniforms.uHoloColor.value.set(state.colors.holo));
  edgeMaterial.color.set(state.colors.holo);
  wireMaterial.color.set(state.colors.holo);
}
applyColors();

// ---------------------------------------------------------------------------
// Board mesh assembly
// ---------------------------------------------------------------------------

const boardGroup = new THREE.Group();
scene.add(boardGroup);
let currentParts = null;
let firstBuild = true;

function disposeBoard() {
  boardGroup.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
  });
  while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
}

function rebuildGeometry() {
  disposeBoard();
  const parts = buildBoardGeometries(state);
  currentParts = parts;

  boardGroup.add(new THREE.Mesh(parts.deck, materials.deck));
  boardGroup.add(new THREE.Mesh(parts.bottom, materials.bottom));
  boardGroup.add(new THREE.Mesh(parts.rail, materials.rail));
  boardGroup.add(new THREE.Mesh(parts.stringer, materials.stringer));
  boardGroup.add(new THREE.Mesh(parts.pinlineL, materials.pinline));
  boardGroup.add(new THREE.Mesh(parts.pinlineR, materials.pinline));
  boardGroup.add(buildFinGroup(state, materials.fins));

  const edgesGeo = new THREE.EdgesGeometry(parts.rail, 18);
  boardGroup.add(new THREE.LineSegments(edgesGeo, edgeMaterial));

  const wireGeo = new THREE.WireframeGeometry(parts.deck);
  const wireMesh = new THREE.LineSegments(wireGeo, wireMaterial);
  wireMesh.position.y = 0.07;
  boardGroup.add(wireMesh);

  updateCameraFraming();
}

function updateCameraFraming() {
  const halfL = state.length / 2;
  controls.minDistance = state.length * 0.62;
  controls.maxDistance = state.length * 2.7;
  controls.target.set(0, state.thickness * 0.6, 0);
  buildPedestal(state.width * 1.35);
  pedestalGroup.position.y = -state.thickness * 0.4;

  if (firstBuild) {
    camera.position.set(halfL * 1.25, halfL * 0.95, halfL * 1.7);
    controls.update();
    firstBuild = false;
  }
}

rebuildGeometry();

// ---------------------------------------------------------------------------
// UI: helpers
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatFeetInches(totalInches) {
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) { feet += 1; inches = 0; }
  return `${feet}'${inches}″`;
}

function formatInches(v, decimals = 1) {
  return `${v.toFixed(decimals)}″`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

let geometryDirty = false;
function markDirty() { geometryDirty = true; }

function clearShapePresetActive() {
  activeShapePresetKey = null;
  $$('#shape-presets .chip').forEach((c) => c.classList.remove('is-active'));
}

function clearColorwayActive() {
  activeColorwayKey = null;
  $$('#colorway-presets .chip').forEach((c) => c.classList.remove('is-active'));
}

// ---------------------------------------------------------------------------
// UI: sliders
// ---------------------------------------------------------------------------

const sliderConfigs = [
  { id: 'length', key: 'length', format: formatFeetInches },
  { id: 'width', key: 'width', format: (v) => formatInches(v, 1) },
  { id: 'nose-width', key: 'noseWidth', format: (v) => formatInches(v, 1) },
  { id: 'tail-width', key: 'tailWidth', format: (v) => formatInches(v, 1) },
  { id: 'thickness', key: 'thickness', format: (v) => formatInches(v, 2) },
  { id: 'nose-rocker', key: 'noseRocker', format: (v) => formatInches(v, 1) },
  { id: 'tail-rocker', key: 'tailRocker', format: (v) => formatInches(v, 2) },
];

function syncSliderUI(cfg) {
  const input = document.getElementById(cfg.id);
  const output = document.getElementById(`${cfg.id}-value`);
  input.value = state[cfg.key];
  output.innerHTML = cfg.format(state[cfg.key]);
}

sliderConfigs.forEach((cfg) => {
  const input = document.getElementById(cfg.id);
  const output = document.getElementById(`${cfg.id}-value`);
  input.addEventListener('input', () => {
    state[cfg.key] = parseFloat(input.value);
    output.innerHTML = cfg.format(state[cfg.key]);
    clearShapePresetActive();
    markDirty();
    updateSummary();
  });
  syncSliderUI(cfg);
});

// ---------------------------------------------------------------------------
// UI: nose / tail shape selects
// ---------------------------------------------------------------------------

const noseSelect = document.getElementById('nose-shape');
const tailSelect = document.getElementById('tail-shape');
noseSelect.value = state.noseShape;
tailSelect.value = state.tailShape;
noseSelect.addEventListener('change', () => {
  state.noseShape = noseSelect.value;
  clearShapePresetActive();
  markDirty();
  updateSummary();
});
tailSelect.addEventListener('change', () => {
  state.tailShape = tailSelect.value;
  clearShapePresetActive();
  markDirty();
  updateSummary();
});

// ---------------------------------------------------------------------------
// UI: rail profile toggle
// ---------------------------------------------------------------------------

const railToggle = document.getElementById('rail-profile');
railToggle.querySelectorAll('.toggle__opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.railProfile = btn.dataset.value;
    railToggle.querySelectorAll('.toggle__opt').forEach((b) => b.classList.toggle('is-active', b === btn));
    clearShapePresetActive();
    markDirty();
    updateSummary();
  });
});

// ---------------------------------------------------------------------------
// UI: fin setup chips
// ---------------------------------------------------------------------------

const finContainer = document.getElementById('fin-setup');
FIN_SETUPS.forEach((key) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.textContent = capitalize(key);
  btn.dataset.value = key;
  if (key === state.finSetup) btn.classList.add('is-active');
  btn.addEventListener('click', () => {
    state.finSetup = key;
    finContainer.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === btn));
    clearShapePresetActive();
    markDirty();
    updateSummary();
  });
  finContainer.appendChild(btn);
});

// ---------------------------------------------------------------------------
// UI: shape presets
// ---------------------------------------------------------------------------

const shapePresetContainer = document.getElementById('shape-presets');
Object.entries(SHAPE_PRESETS).forEach(([key, preset]) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.textContent = preset.label;
  if (key === activeShapePresetKey) btn.classList.add('is-active');
  btn.addEventListener('click', () => {
    Object.assign(state, {
      length: preset.length, width: preset.width, noseWidth: preset.noseWidth, tailWidth: preset.tailWidth,
      thickness: preset.thickness, noseShape: preset.noseShape, tailShape: preset.tailShape,
      railProfile: preset.railProfile, noseRocker: preset.noseRocker, tailRocker: preset.tailRocker,
      centerPosition: preset.centerPosition, finSetup: preset.finSetup,
    });
    activeShapePresetKey = key;
    shapePresetContainer.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === btn));
    noseSelect.value = state.noseShape;
    tailSelect.value = state.tailShape;
    railToggle.querySelectorAll('.toggle__opt').forEach((b) => b.classList.toggle('is-active', b.dataset.value === state.railProfile));
    finContainer.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.value === state.finSetup));
    sliderConfigs.forEach(syncSliderUI);
    markDirty();
    updateSummary();
  });
  shapePresetContainer.appendChild(btn);
});

// ---------------------------------------------------------------------------
// UI: colorway presets
// ---------------------------------------------------------------------------

const colorwayContainer = document.getElementById('colorway-presets');
const colorInputIds = {
  deck: 'color-deck', bottom: 'color-bottom', rail: 'color-rail',
  stringer: 'color-stringer', pinline: 'color-pinline', fins: 'color-fins', holo: 'color-holo',
};

function syncColorUI() {
  Object.entries(colorInputIds).forEach(([key, id]) => {
    document.getElementById(id).value = state.colors[key];
  });
}

Object.entries(COLORWAYS).forEach(([key, colorway]) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip chip--swatch';
  if (key === activeColorwayKey) btn.classList.add('is-active');
  const dots = document.createElement('span');
  dots.className = 'swatch-dots';
  [colorway.deck, colorway.bottom, colorway.holo].forEach((c) => {
    const dot = document.createElement('span');
    dot.style.background = c;
    dots.appendChild(dot);
  });
  const label = document.createElement('span');
  label.textContent = colorway.label;
  btn.appendChild(dots);
  btn.appendChild(label);
  btn.addEventListener('click', () => {
    state.colors = { ...colorway };
    activeColorwayKey = key;
    colorwayContainer.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === btn));
    syncColorUI();
    applyColors();
    updateSummary();
  });
  colorwayContainer.appendChild(btn);
});

Object.entries(colorInputIds).forEach(([key, id]) => {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    state.colors[key] = input.value;
    clearColorwayActive();
    applyColors();
    updateSummary();
  });
});

// ---------------------------------------------------------------------------
// UI: randomize / reset
// ---------------------------------------------------------------------------

function randRange(min, max) { return min + Math.random() * (max - min); }
function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randHex() {
  const h = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `#${h}`;
}

document.getElementById('btn-randomize').addEventListener('click', () => {
  const presetKeys = Object.keys(SHAPE_PRESETS);
  const baseKey = randChoice(presetKeys);
  const base = SHAPE_PRESETS[baseKey];

  Object.assign(state, {
    length: Math.round(randRange(base.length - 6, base.length + 6)),
    width: Math.round(randRange(base.width - 1.5, base.width + 1.5) * 10) / 10,
    noseWidth: Math.round(randRange(base.noseWidth - 1, base.noseWidth + 1) * 10) / 10,
    tailWidth: Math.round(randRange(base.tailWidth - 1, base.tailWidth + 1) * 10) / 10,
    thickness: Math.round(randRange(base.thickness - 0.25, base.thickness + 0.25) * 100) / 100,
    noseShape: randChoice(NOSE_SHAPES),
    tailShape: randChoice(TAIL_SHAPES),
    railProfile: randChoice(['soft', 'hard']),
    noseRocker: Math.round(randRange(1.2, 4.2) * 10) / 10,
    tailRocker: Math.round(randRange(0.4, 1.8) * 10) / 10,
    centerPosition: base.centerPosition,
    finSetup: randChoice(FIN_SETUPS),
  });

  if (Math.random() < 0.55) {
    const cwKey = randChoice(Object.keys(COLORWAYS));
    state.colors = { ...COLORWAYS[cwKey] };
    activeColorwayKey = cwKey;
  } else {
    state.colors = {
      deck: randHex(), bottom: randHex(), rail: randHex(),
      stringer: randHex(), pinline: randHex(), fins: randHex(), holo: randHex(),
    };
    activeColorwayKey = null;
  }

  clearShapePresetActive();
  noseSelect.value = state.noseShape;
  tailSelect.value = state.tailShape;
  railToggle.querySelectorAll('.toggle__opt').forEach((b) => b.classList.toggle('is-active', b.dataset.value === state.railProfile));
  finContainer.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.value === state.finSetup));
  colorwayContainer.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('is-active', Object.keys(COLORWAYS)[i] === activeColorwayKey));
  sliderConfigs.forEach(syncSliderUI);
  syncColorUI();
  applyColors();
  markDirty();
  updateSummary();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  const fresh = cloneDefaultState();
  Object.assign(state, fresh);
  state.colors = { ...fresh.colors };
  activeShapePresetKey = 'shortboard';
  activeColorwayKey = 'deep-space';

  noseSelect.value = state.noseShape;
  tailSelect.value = state.tailShape;
  railToggle.querySelectorAll('.toggle__opt').forEach((b) => b.classList.toggle('is-active', b.dataset.value === state.railProfile));
  finContainer.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.value === state.finSetup));
  shapePresetContainer.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.textContent === SHAPE_PRESETS.shortboard.label));
  colorwayContainer.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('is-active', Object.keys(COLORWAYS)[i] === activeColorwayKey));
  sliderConfigs.forEach(syncSliderUI);
  syncColorUI();
  applyColors();
  markDirty();
  updateSummary();
});

// ---------------------------------------------------------------------------
// UI: summary line
// ---------------------------------------------------------------------------

function currentColorwayLabel() {
  if (activeColorwayKey && COLORWAYS[activeColorwayKey]) return COLORWAYS[activeColorwayKey].label;
  return 'Custom';
}

function currentShapeLabel() {
  if (activeShapePresetKey && SHAPE_PRESETS[activeShapePresetKey]) return SHAPE_PRESETS[activeShapePresetKey].label;
  return 'Custom Shape';
}

function updateSummary() {
  const summary = document.getElementById('summary');
  summary.textContent = `${formatFeetInches(state.length)} ${currentShapeLabel()} · ${formatInches(state.width, 1)} wide · ${capitalize(state.finSetup)} · ${currentColorwayLabel()}`;
}
updateSummary();

// ---------------------------------------------------------------------------
// UI: mobile panel drawer
// ---------------------------------------------------------------------------

const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panel-toggle');
panelToggle.addEventListener('click', () => {
  const open = panel.classList.toggle('is-open');
  panelToggle.setAttribute('aria-expanded', String(open));
});

// ---------------------------------------------------------------------------
// UI: first-interaction hint
// ---------------------------------------------------------------------------

const hint = document.getElementById('hint');
let hintShown = false;
let hintHidden = false;
setTimeout(() => {
  if (!hintHidden) { hint.hidden = false; hintShown = true; }
}, 500);

function hideHint() {
  if (hintHidden || !hintShown) { hintHidden = true; return; }
  hintHidden = true;
  hint.classList.add('is-hidden');
  setTimeout(() => { hint.hidden = true; }, 650);
}
canvas.addEventListener('pointerdown', hideHint, { once: true });
canvas.addEventListener('wheel', hideHint, { once: true, passive: true });
setTimeout(hideHint, 7000);

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------------------
// Animate
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (geometryDirty) {
    rebuildGeometry();
    geometryDirty = false;
  }

  controls.update();

  const time = clock.elapsedTime;
  Object.values(materials).forEach((m) => updateHologramUniforms(m, {
    time, cameraPosition: camera.position, holoColor: state.colors.holo,
  }));

  updateParticles(dt);
  pedestalGroup.rotation.y += dt * 0.03;

  composer.render();
}
animate();
