// ARUNIKA — Island Hop Flight: shared tuning constants, palette and mission data.
// One job: every number the rest of the game agrees on lives here.

export const CONFIG = {
  // World
  islandRadius: 1150,
  seaLevel: 0.4,
  runwayElevation: 26,
  runway: { x0: -30, x1: 420, z: 0, halfWidth: 17 },
  townCenter: { x: 430, z: 330 },
  // Flight model (arcade, units are metres-ish, speeds in m/s)
  maxThrustAccel: 40,
  dragQuad: 0.0035,
  dragLin: 0.12,
  climbBleed: 20,
  stallSpeed: 26,
  liftSpeed: 46,
  maxSpeed: 110,
  rollRate: 1.9,
  pitchRate: 1.15,
  turnAuthority: 1.35,
  sinkWhenStalled: 9,
  gravity: 9.8,
  fuelDrainIdle: 0.15,
  fuelDrainFull: 0.55,
  fuelCapacity: 100,
  // Camera
  chaseDistance: 27,
  chaseHeight: 7.5,
  fovDegrees: 68,
  // Scoring
  ringPoints: 250,
  dropPoints: 500,
  landingSoftPoints: 1000,
  landingRoughPoints: 400,
  // Screenshot staging is in shots.js; the game itself never reads it.
};

// Mission flow for one sortie: rings, then a supply drop, then land.
export const MISSIONS = [
  { id: 'rings', name: 'Ring Run', blurb: 'Fly through all 5 sky rings in order.' },
  { id: 'drop', name: 'Supply Drop', blurb: 'Drop the crate on the yellow target circle.' },
  { id: 'land', name: 'Island Landing', blurb: 'Land gently on runway 09 and stop.' },
];

// Ring course: fixed positions above the island, heights resolved at runtime.
export const RING_COURSE = [
  { x: 120, z: -260, alt: 150 },
  { x: -320, z: -420, alt: 190 },
  { x: -620, z: 60, alt: 170 },
  { x: -260, z: 520, alt: 200 },
  { x: 260, z: 420, alt: 150 },
];

export const DROP_TARGET = { x: 430, z: 330, radius: 34 };

// Flat-shaded palette: one style for sky, sea, land and the aircraft.
export const PALETTE = {
  skyTop: '#2e6db4',
  skyMid: '#7fb2dd',
  skyHorizon: '#cfe6f2',
  haze: '#cfe0ea',
  seaDeep: '#1f6fb0',
  seaShallow: '#4aa3d8',
  sand: '#e3cf9e',
  grassLight: '#7fae56',
  grass: '#5d9440',
  grassDark: '#477636',
  fieldWheat: '#d9b96a',
  fieldGreen: '#6da34e',
  forest: '#3c6e33',
  rock: '#8d8f96',
  asphalt: '#4a4d52',
  roadLine: '#e8e4d2',
  runway: '#3c3f45',
  runwayMark: '#f2efe2',
  river: '#3f8fd0',
  townRoofA: '#c96a4a',
  townRoofB: '#7d8aa8',
  townWall: '#e8ddc8',
  hangarRoof: '#b8442e',
  planeBody: '#e8e4da',
  planeAccent: '#c8452c',
  planeCanopy: '#2b4a63',
  ring: '#19c2e6',
  ringNext: '#ffd23e',
  targetRing: '#ffd23e',
  cloud: '#ffffff',
  sun: '#fff3c4',
};
