// All dimensions in inches. `centerPosition` is the fraction of the length,
// measured from the tail, at which the board reaches its maximum width.

export const SHAPE_PRESETS = {
  shortboard: {
    label: 'Shortboard',
    length: 74, width: 19.5, noseWidth: 11.5, tailWidth: 13.5, thickness: 2.4,
    noseShape: 'pointed', tailShape: 'squash', railProfile: 'soft',
    noseRocker: 3.2, tailRocker: 1.1, centerPosition: 0.58, finSetup: 'thruster',
  },
  fish: {
    label: 'Fish',
    length: 68, width: 21, noseWidth: 13.5, tailWidth: 15.5, thickness: 2.5,
    noseShape: 'rounded', tailShape: 'swallow', railProfile: 'soft',
    noseRocker: 2.0, tailRocker: 0.75, centerPosition: 0.5, finSetup: 'twin',
  },
  funboard: {
    label: 'Funboard',
    length: 84, width: 21.5, noseWidth: 14, tailWidth: 15, thickness: 2.7,
    noseShape: 'rounded', tailShape: 'round', railProfile: 'soft',
    noseRocker: 2.5, tailRocker: 0.95, centerPosition: 0.54, finSetup: 'thruster',
  },
  longboard: {
    label: 'Longboard',
    length: 108, width: 22.5, noseWidth: 15.5, tailWidth: 15.5, thickness: 3.05,
    noseShape: 'rounded', tailShape: 'round', railProfile: 'soft',
    noseRocker: 1.7, tailRocker: 0.55, centerPosition: 0.5, finSetup: 'single',
  },
  gun: {
    label: 'Gun',
    length: 96, width: 18.5, noseWidth: 11, tailWidth: 13, thickness: 2.9,
    noseShape: 'pointed', tailShape: 'pin', railProfile: 'hard',
    noseRocker: 3.6, tailRocker: 1.4, centerPosition: 0.62, finSetup: 'thruster',
  },
  hybrid: {
    label: 'Hybrid',
    length: 71, width: 20.5, noseWidth: 13, tailWidth: 14.5, thickness: 2.5,
    noseShape: 'rounded', tailShape: 'squash', railProfile: 'soft',
    noseRocker: 2.8, tailRocker: 1.0, centerPosition: 0.55, finSetup: 'quad',
  },
};

export const COLORWAYS = {
  'miami-vice': {
    label: 'Miami Vice',
    deck: '#ff5ec7', bottom: '#00e5ff', rail: '#ffffff',
    stringer: '#ffffff', pinline: '#00e5ff', fins: '#ff5ec7', holo: '#ff2e9e',
  },
  'deep-space': {
    label: 'Deep Space',
    deck: '#7df9ff', bottom: '#8a5cff', rail: '#c9d6ff',
    stringer: '#ffffff', pinline: '#8a5cff', fins: '#7df9ff', holo: '#8a5cff',
  },
  'coral-reef': {
    label: 'Coral Reef',
    deck: '#ff9472', bottom: '#16d9c7', rail: '#ffe1c9',
    stringer: '#fff2e0', pinline: '#16d9c7', fins: '#ff9472', holo: '#ff7bb0',
  },
  chrome: {
    label: 'Chrome',
    deck: '#dbe6ff', bottom: '#9fb3d9', rail: '#ffffff',
    stringer: '#7d8bb0', pinline: '#c9d6ff', fins: '#dbe6ff', holo: '#a8c8ff',
  },
};

export const NOSE_SHAPES = ['pointed', 'rounded', 'blunt'];
export const TAIL_SHAPES = ['squash', 'round', 'pin', 'swallow', 'fish'];
export const FIN_SETUPS = ['single', 'thruster', 'quad', 'twin'];

export const DEFAULT_STATE = {
  shapePreset: 'shortboard',
  colorway: 'deep-space',
  length: 74,
  width: 19.5,
  noseWidth: 11.5,
  tailWidth: 13.5,
  thickness: 2.4,
  noseShape: 'pointed',
  tailShape: 'squash',
  railProfile: 'soft',
  noseRocker: 3.2,
  tailRocker: 1.1,
  centerPosition: 0.58,
  finSetup: 'thruster',
  colors: { ...COLORWAYS['deep-space'] },
};

export function cloneDefaultState() {
  return {
    ...DEFAULT_STATE,
    colors: { ...DEFAULT_STATE.colors },
  };
}
