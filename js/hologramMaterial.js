import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHoloColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFresnelPower;
  uniform vec3 uCameraPos;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    if (!gl_FrontFacing) normal = -normal;
    vec3 viewDir = normalize(uCameraPos - vWorldPosition);
    float facing = clamp(dot(viewDir, normal), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, uFresnelPower);

    float iridPhase = fresnel * 6.28318 + uTime * 0.5 + vWorldPosition.y * 0.15;
    vec3 irid = vec3(
      sin(iridPhase) * 0.5 + 0.5,
      sin(iridPhase + 2.094) * 0.5 + 0.5,
      sin(iridPhase + 4.188) * 0.5 + 0.5
    );

    vec3 baseColor = mix(uColor * 0.62, uHoloColor * 0.85, fresnel * 0.55);
    vec3 color = baseColor + irid * uHoloColor * fresnel * 0.16;

    float scan = sin(vWorldPosition.y * 5.2 - uTime * 1.35);
    float scanline = smoothstep(0.86, 1.0, scan) * 0.1;
    color += uHoloColor * scanline;

    float sparkle = sin(vWorldPosition.x * 30.0 + vWorldPosition.z * 30.0 + uTime * 4.0);
    sparkle = smoothstep(0.99, 1.0, sparkle) * fresnel * 0.25;
    color += vec3(1.0) * sparkle;

    float alpha = clamp(uOpacity * (1.0 - fresnel * 0.4) + fresnel * 0.55, 0.24, 0.94);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createHologramMaterial(baseColorHex, holoColorHex, opacity = 0.72) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(baseColorHex) },
      uHoloColor: { value: new THREE.Color(holoColorHex) },
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uFresnelPower: { value: 2.1 },
      uCameraPos: { value: new THREE.Vector3() },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  material.isHologramMaterial = true;
  return material;
}

export function updateHologramUniforms(material, { time, cameraPosition, holoColor }) {
  if (!material.isHologramMaterial) return;
  material.uniforms.uTime.value = time;
  material.uniforms.uCameraPos.value.copy(cameraPosition);
  if (holoColor) material.uniforms.uHoloColor.value.set(holoColor);
}
