import * as THREE from 'three';
import { rockerAt } from './geometry.js';

function finProfileShape(baseLength, height) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(baseLength * 0.02, height * 0.55, baseLength * 0.1, height * 0.92, baseLength * 0.34, height);
  shape.bezierCurveTo(baseLength * 0.52, height * 0.7, baseLength * 0.72, height * 0.32, baseLength, height * 0.02);
  shape.lineTo(baseLength * 0.86, 0);
  shape.lineTo(0, 0);
  return shape;
}

function buildFinMesh(baseLength, height, thickness, material) {
  const shape = finProfileShape(baseLength, height);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.3,
    bevelSize: thickness * 0.25,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.translate(-baseLength * 0.42, 0, -thickness / 2);
  geometry.rotateX(Math.PI);
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

function finLayout(finSetup, params) {
  const halfL = params.length / 2;
  const tailW = params.tailWidth / 2;
  const layouts = {
    single: [
      { x: 0, z: halfL - params.length * 0.05, rotY: 0, base: 7.2, height: 6.6 },
    ],
    thruster: [
      { x: 0, z: halfL - params.length * 0.045, rotY: 0, base: 5.6, height: 5.0 },
      { x: -tailW * 0.5, z: halfL - params.length * 0.11, rotY: 0.34, base: 4.4, height: 4.1 },
      { x: tailW * 0.5, z: halfL - params.length * 0.11, rotY: -0.34, base: 4.4, height: 4.1 },
    ],
    quad: [
      { x: -tailW * 0.36, z: halfL - params.length * 0.06, rotY: 0.16, base: 4.2, height: 3.9 },
      { x: tailW * 0.36, z: halfL - params.length * 0.06, rotY: -0.16, base: 4.2, height: 3.9 },
      { x: -tailW * 0.64, z: halfL - params.length * 0.12, rotY: 0.38, base: 3.9, height: 3.6 },
      { x: tailW * 0.64, z: halfL - params.length * 0.12, rotY: -0.38, base: 3.9, height: 3.6 },
    ],
    twin: [
      { x: -tailW * 0.44, z: halfL - params.length * 0.07, rotY: 0.26, base: 6.2, height: 5.6 },
      { x: tailW * 0.44, z: halfL - params.length * 0.07, rotY: -0.26, base: 6.2, height: 5.6 },
    ],
  };
  return layouts[finSetup] || layouts.thruster;
}

export function buildFinGroup(params, material) {
  const group = new THREE.Group();
  const layout = finLayout(params.finSetup, params);
  const thickness = 0.28;

  layout.forEach((f) => {
    const mesh = buildFinMesh(f.base, f.height, thickness, material);
    mesh.position.set(f.x, rockerAt(f.z, params), f.z);
    mesh.rotation.y = f.rotY;
    group.add(mesh);
  });

  return group;
}
