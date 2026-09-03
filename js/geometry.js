import * as THREE from 'three';

function lerp(a, b, t) { return a + (b - a) * t; }

function noseStationFactors(shape) {
  switch (shape) {
    case 'pointed': return [0.16, 0.42, 0.7];
    case 'rounded':
    default: return [0.4, 0.66, 0.87];
  }
}

function tailStationFactors(shape) {
  switch (shape) {
    case 'pin': return [0.16, 0.42, 0.7];
    case 'swallow':
    case 'fish': return [0.76, 0.91, 0.985];
    case 'round':
    default: return [0.4, 0.66, 0.87];
  }
}

function isNotchTail(shape) {
  return shape === 'swallow' || shape === 'fish';
}

/**
 * Builds the right-hand half profile of the board outline as a smooth
 * curve through a handful of key stations, sampled densely. u runs 0
 * (nose tip, or nose "shoulder" for a blunt nose) -> 1 (tail tip, tail
 * "shoulder" for a squash tail, or tail "horn" for notch tails).
 */
function buildHalfProfile(params, samples = 30) {
  const { noseWidth, tailWidth, width, noseShape, tailShape, centerPosition } = params;
  const noseW = noseWidth / 2;
  const tailW = tailWidth / 2;
  const maxW = width / 2;
  const notch = isNotchTail(tailShape);
  const centerU = THREE.MathUtils.clamp(1 - centerPosition, 0.34, 0.8);

  const stations = [];

  if (noseShape === 'blunt') {
    stations.push({ u: 0.13, v: noseW * 0.97 });
  } else {
    const nf = noseStationFactors(noseShape);
    stations.push({ u: 0, v: 0 });
    stations.push({ u: 0.035, v: noseW * nf[0] });
    stations.push({ u: 0.09, v: noseW * nf[1] });
    stations.push({ u: 0.18, v: noseW * nf[2] });
  }

  stations.push({ u: 0.32, v: lerp(noseW, maxW, 0.55) });
  stations.push({ u: centerU, v: maxW });
  stations.push({ u: lerp(centerU, 0.83, 0.5), v: lerp(maxW, tailW, 0.5) });

  if (tailShape === 'squash') {
    stations.push({ u: 0.87, v: tailW * 0.96 });
  } else {
    const tf = tailStationFactors(tailShape);
    stations.push({ u: 0.83, v: tailW * tf[2] });
    stations.push({ u: 0.92, v: tailW * tf[1] });
    stations.push({ u: 0.968, v: tailW * tf[0] });
    stations.push({ u: 1.0, v: notch ? tailW : 0 });
  }

  stations.sort((a, b) => a.u - b.u);

  const curvePoints = stations.map((s) => new THREE.Vector3(s.u, s.v, 0));
  const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5);
  const sampled = curve.getPoints(samples);

  return sampled.map((p) => ({ u: THREE.MathUtils.clamp(p.x, 0, 1), half: Math.max(0, p.y) }));
}

/** Rounded/flat end-cap points continuing outward from a shoulder point to the centerline tip. */
function flatCap(shoulder, w, depth, dir) {
  return [
    { x: w * 0.97, y: shoulder.y + dir * depth * 0.22 },
    { x: w * 0.6, y: shoulder.y + dir * depth * 0.7 },
    { x: 0, y: shoulder.y + dir * depth },
  ];
}

function notchApproach(horn, tailWidth, tailShape) {
  const tailW = tailWidth / 2;
  if (tailShape === 'swallow') {
    const depth = tailW * 1.05;
    return [
      { x: tailW * 0.52, y: horn.y + depth * 0.5 },
      { x: 0, y: horn.y + depth },
    ];
  }
  // fish: shallower, more rounded notch
  const depth = tailW * 0.5;
  return [
    { x: tailW * 0.74, y: horn.y + depth * 0.32 },
    { x: tailW * 0.32, y: horn.y + depth * 0.72 },
    { x: 0, y: horn.y + depth },
  ];
}

/** Full closed 2D outline loop, in inches, as {x, y} (y: + is nose, - is tail). */
export function buildOutlineLoop(params) {
  const halfL = params.length / 2;
  const L = params.length;
  const rightHalf = buildHalfProfile(params);
  const toPoint = (p) => ({ x: p.half, y: halfL - p.u * L });

  let rightSide = rightHalf.map(toPoint);

  if (params.noseShape === 'blunt') {
    const shoulder = rightSide[0];
    const capPts = flatCap(shoulder, params.noseWidth / 2, L * 0.13, 1).reverse();
    rightSide = [...capPts, ...rightSide];
  }

  if (params.tailShape === 'squash') {
    const shoulder = rightSide[rightSide.length - 1];
    const capPts = flatCap(shoulder, params.tailWidth / 2, L * 0.13, -1);
    rightSide = [...rightSide, ...capPts];
  } else if (isNotchTail(params.tailShape)) {
    const horn = rightSide[rightSide.length - 1];
    const approach = notchApproach(horn, params.tailWidth, params.tailShape);
    rightSide = [...rightSide, ...approach];
  }

  const loop = [...rightSide];
  const mirrored = rightSide.slice(1, -1).reverse().map((p) => ({ x: -p.x, y: p.y }));
  loop.push(...mirrored);
  return loop;
}

/** Nose/tail rocker lift (inches) at a given world-Z (tail positive, nose negative). */
export function rockerAt(z, params) {
  const halfL = params.length / 2;
  if (halfL <= 0) return 0;
  if (z <= 0) {
    const t = THREE.MathUtils.clamp(-z / halfL, 0, 1);
    return params.noseRocker * Math.pow(t, 2.15);
  }
  const t = THREE.MathUtils.clamp(z / halfL, 0, 1);
  return params.tailRocker * Math.pow(t, 2.15);
}

function thicknessScaleAt(absX, maxHalfWidth) {
  return THREE.MathUtils.clamp(absX / (maxHalfWidth * 0.45), 0.22, 1.0);
}

function computeOutwardNormals(points) {
  const n = points.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    area += p0.x * p1.y - p1.x * p0.y;
  }
  const ccw = area > 0;
  const normals = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const dx = tx / len;
    const dy = ty / len;
    normals.push(ccw ? { x: dy, y: -dx } : { x: -dy, y: dx });
  }
  return normals;
}

function applyRocker(position, params) {
  const arr = position.array;
  for (let i = 0; i < arr.length; i += 3) {
    const z = arr[i + 2];
    arr[i + 1] += rockerAt(z, params);
  }
  position.needsUpdate = true;
}

function buildCap(loop, maxHalfWidth, thickness, faceUp) {
  const shapePoints = loop.map((p) => new THREE.Vector2(p.x, p.y));
  const triangles = THREE.ShapeUtils.triangulateShape(shapePoints, []);
  const positions = new Float32Array(loop.length * 3);
  loop.forEach((p, i) => {
    const h = faceUp ? thickness * thicknessScaleAt(Math.abs(p.x), maxHalfWidth) : 0;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = h;
    positions[i * 3 + 2] = -p.y;
  });
  const indices = [];
  triangles.forEach(([a, b, c]) => {
    if (faceUp) indices.push(a, b, c);
    else indices.push(a, c, b);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildRailWall(loop, maxHalfWidth, thickness, isSoft) {
  const normals = computeOutwardNormals(loop);
  const segments = isSoft ? 6 : 2;
  const n = loop.length;
  const positions = [];
  const columns = [];

  for (let i = 0; i < n; i++) {
    const p = loop[i];
    const nrm = normals[i];
    const scale = thicknessScaleAt(Math.abs(p.x), maxHalfWidth);
    const topY = thickness * scale;
    const bulgeAmount = thickness * scale * (isSoft ? 0.2 : 0.045);
    const column = [];
    for (let k = 0; k <= segments; k++) {
      const v = k / segments;
      const bulge = Math.sin(v * Math.PI) * bulgeAmount;
      const x = p.x + nrm.x * bulge;
      const y = v * topY;
      const z = -(p.y + nrm.y * bulge);
      column.push(x, y, z);
    }
    columns.push(column);
  }

  const indices = [];
  const vertsPerColumn = segments + 1;
  for (let i = 0; i < n; i++) {
    positions.push(...columns[i]);
  }
  for (let i = 0; i < n; i++) {
    const iNext = (i + 1) % n;
    for (let k = 0; k < segments; k++) {
      const a = i * vertsPerColumn + k;
      const b = iNext * vertsPerColumn + k;
      const c = iNext * vertsPerColumn + k + 1;
      const d = i * vertsPerColumn + k + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildRibbon(params, xOffset, insetFrac, thicknessLift) {
  const halfL = (params.length / 2) * insetFrac;
  const segs = 40;
  const rWidth = Math.max(0.09, params.thickness * 0.045);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = -halfL + t * (2 * halfL);
    const absX = Math.abs(xOffset);
    const scale = thicknessScaleAt(absX, params.width / 2);
    const y = params.thickness * scale + thicknessLift;
    positions.push(xOffset - rWidth / 2, y, z, xOffset + rWidth / 2, y, z);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2 + 1, d = (i + 1) * 2;
    indices.push(a, b, c, a, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds all board-part geometries (already rocker-deformed, in inches,
 * centered at origin, nose toward -Z, tail toward +Z).
 */
export function buildBoardGeometries(params) {
  const loop = buildOutlineLoop(params);
  const maxHalfWidth = params.width / 2;
  const isSoft = params.railProfile !== 'hard';

  const deck = buildCap(loop, maxHalfWidth, params.thickness, true);
  const bottom = buildCap(loop, maxHalfWidth, params.thickness, false);
  const rail = buildRailWall(loop, maxHalfWidth, params.thickness, isSoft);
  const stringer = buildRibbon(params, 0, 0.985, 0.012);
  const pinlineOffset = maxHalfWidth * 0.42;
  const pinlineL = buildRibbon(params, -pinlineOffset, 0.9, 0.01);
  const pinlineR = buildRibbon(params, pinlineOffset, 0.9, 0.01);

  [deck, bottom, rail, stringer, pinlineL, pinlineR].forEach((g) => applyRocker(g.attributes.position, params));

  return { deck, bottom, rail, stringer, pinlineL, pinlineR, outlineLoop: loop };
}
