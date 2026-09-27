import * as THREE from "three";

const WALL_H = 3.3;
const WALL_T = 0.42;
const EYE = 1.64;
const WALK = 4.5;
const RUN = 7.6;
const PLAYER_R = 0.34;
const ALIEN_R = 0.46;
const FIRE_DELAY = 0.15;
const BOLT_SPEED = 48;
const BOLT_DAMAGE = 18;
const ALIEN_HP = 54;
const MELEE_RANGE = 1.18;
const MELEE_DAMAGE = 10;
const MELEE_DELAY = 0.85;
const START_AMMO = 42;
const AMMO_MAX = 90;

const ALIEN_SPAWNS = [
  { x: 0, z: 6.35 },
  { x: 0.15, z: 16.1 },
  { x: 7.3, z: 15.4 },
  { x: 12.5, z: 18.3 },
  { x: -7.4, z: 16.5 },
  { x: -11.1, z: 19.1 },
  { x: -2.4, z: 28.8 },
  { x: 6.5, z: 31.3 },
];

const PICKUP_DEFS = [
  { type: "health", x: -8.3, z: 1.1 },
  { type: "ammo", x: 7.5, z: 2.2 },
  { type: "health", x: -10.5, z: 14.3 },
  { type: "ammo", x: 13.1, z: 12.8 },
  { type: "armor", x: 4.6, z: 25.9 },
];

const ROOMS = [
  { minX: -11.9, maxX: 11.9, minZ: -3.9, maxZ: 8.45 },
  { minX: -2.35, maxX: 2.35, minZ: 7.45, maxZ: 22.55 },
  { minX: -13.9, maxX: -1.45, minZ: 11.65, maxZ: 21.95 },
  { minX: 1.45, maxX: 15.95, minZ: 9.65, maxZ: 21.95 },
  { minX: -7.95, maxX: 11.95, minZ: 21.45, maxZ: 33.95 },
];

const SKINS = [0x6e8f58, 0x7d9086, 0x5d845c, 0x8a948c, 0x4f7a55, 0x6a7d76, 0x86a066, 0x5a6e66];
const EYES = [0xd6ff57, 0xffe56a, 0xb6ff8a, 0xf0f4a8];

const keys = { w: false, a: false, s: false, d: false, shift: false };
const colliders = [];
const aliens = [];
const pickups = [];
const bolts = [];
const sparks = [];
const lamps = [];

const player = {
  x: 0,
  z: 0.45,
  yaw: Math.PI,
  pitch: 0,
  health: 100,
  armor: 25,
  ammo: START_AMMO,
  invuln: 0,
  hurt: 0,
};

let mode = "menu";
let mouseDown = false;
let fireCooldown = 0;
let dryLock = false;
let recoil = 0;
let muzzleTime = 0;
let walkPhase = 0;
let hitMarker = 0;
let winDelay = 0.55;
let pendingWin = false;
let clock = performance.now();
let audioCtx = null;

const hud = document.getElementById("hud");
const crosshair = document.getElementById("crosshair");
const hurtEl = document.getElementById("hurt");
const menu = document.getElementById("menu");
const menuTitle = document.getElementById("menu-title");
const menuBlurb = document.getElementById("menu-blurb");
const endScreen = document.getElementById("end");
const endPanel = document.getElementById("end-panel");
const endTitle = document.getElementById("end-title");
const endText = document.getElementById("end-text");
const ammoEl = document.getElementById("ammo");
const healthEl = document.getElementById("health");
const armorEl = document.getElementById("armor");
const enemiesEl = document.getElementById("enemies");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080b);
scene.fog = new THREE.Fog(0x07080b, 14, 46);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 180);
camera.rotation.order = "YXZ";
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x07080b);
document.body.prepend(renderer.domElement);

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const aim = new THREE.Vector3();
const eyePos = new THREE.Vector3();

const floorTex = makeFloorTexture();
const wallTex = makeWallTexture();
floorTex.repeat.set(14, 18);

const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
const ceilMat = new THREE.MeshLambertMaterial({ color: 0x12151a });
const trimMat = new THREE.MeshLambertMaterial({
  color: 0x12383c,
  emissive: 0x0c4c52,
  emissiveIntensity: 0.55,
});
const pipeMat = new THREE.MeshLambertMaterial({ color: 0x3d4650 });
const pathMat = new THREE.MeshLambertMaterial({
  color: 0x16343a,
  emissive: 0x0a3e46,
  emissiveIntensity: 0.45,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

const sparkGeo = new THREE.SphereGeometry(0.09, 6, 6);
const boltCoreGeo = new THREE.SphereGeometry(0.075, 8, 8);
const boltGlowGeo = new THREE.SphereGeometry(0.15, 8, 8);
const boltTrailGeo = new THREE.CylinderGeometry(0.03, 0.055, 0.5, 6);

const alienGeo = {
  eye: new THREE.SphereGeometry(0.135, 12, 10),
  pupil: new THREE.SphereGeometry(0.055, 8, 8),
  torso: new THREE.SphereGeometry(0.46, 14, 12),
  head: new THREE.SphereGeometry(0.38, 14, 12),
  joint: new THREE.SphereGeometry(0.075, 8, 8),
  limb: new THREE.CylinderGeometry(0.055, 0.042, 0.4, 6),
  claw: new THREE.ConeGeometry(0.055, 0.2, 5),
  stalk: new THREE.CylinderGeometry(0.022, 0.03, 0.32, 5),
  orb: new THREE.SphereGeometry(0.07, 8, 8),
  organ: new THREE.SphereGeometry(0.09, 10, 8),
  tail: new THREE.CylinderGeometry(0.045, 0.09, 0.62, 6),
  foot: new THREE.BoxGeometry(0.16, 0.05, 0.28),
  jaw: new THREE.BoxGeometry(0.26, 0.055, 0.1),
};

scene.add(new THREE.AmbientLight(0xb7c4d2, 0.42));
scene.add(new THREE.HemisphereLight(0xc5d5e4, 0x2a261f, 0.34));

buildLevel();
const weapon = buildWeapon();
resetMatch();
bindInput();
syncChrome();
requestAnimationFrame(frame);

function makeFloorTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#1a1f26";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#2c3540";
  g.lineWidth = 6;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      g.strokeRect(8 + i * 128, 8 + j * 128, 112, 112);
    }
  }
  g.fillStyle = "#12161b";
  g.fillRect(120, 0, 8, 256);
  g.fillRect(0, 120, 256, 8);
  g.fillStyle = "#3a4652";
  for (const [x, y] of [[24, 24], [104, 24], [24, 104], [104, 104], [152, 152], [220, 220]]) {
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeWallTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#2a313a";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#343d48";
  g.fillRect(10, 10, 236, 196);
  g.strokeStyle = "#1c232b";
  g.lineWidth = 8;
  g.strokeRect(10, 10, 236, 196);
  g.fillStyle = "#222830";
  g.fillRect(0, 214, 256, 42);
  g.strokeStyle = "#20262e";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(128, 10);
  g.lineTo(128, 206);
  g.moveTo(10, 108);
  g.lineTo(246, 108);
  g.stroke();
  g.fillStyle = "#667382";
  for (const [x, y] of [[24, 24], [232, 24], [24, 190], [232, 190], [128, 24], [128, 190]]) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeSignTexture(title, sub) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#071216";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "#1ec8c0";
  g.lineWidth = 10;
  g.strokeRect(16, 16, 480, 224);
  g.fillStyle = "#e7fff8";
  g.font = "bold 78px sans-serif";
  g.fillText(title, 40, 120);
  g.font = "30px sans-serif";
  g.fillStyle = "#7ef0e2";
  g.fillText(sub, 42, 176);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wallMaterial(width, height) {
  const map = wallTex.clone();
  map.needsUpdate = true;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(Math.max(1, width / 2.4), Math.max(1, height / 2.4));
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map });
}

function addWallX(z, x1, x2) {
  const length = Math.abs(x2 - x1);
  const x = (x1 + x2) / 2;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, WALL_H, WALL_T), wallMaterial(length, WALL_H));
  mesh.position.set(x, WALL_H / 2, z);
  scene.add(mesh);
  colliders.push({
    minX: x - length / 2,
    maxX: x + length / 2,
    minZ: z - WALL_T / 2,
    maxZ: z + WALL_T / 2,
  });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.06), trimMat);
  trim.position.set(x, 2.45, z + (z < 16 ? 0.2 : -0.2));
  scene.add(trim);
}

function addWallZ(x, z1, z2) {
  const length = Math.abs(z2 - z1);
  const z = (z1 + z2) / 2;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, length), wallMaterial(length, WALL_H));
  mesh.position.set(x, WALL_H / 2, z);
  scene.add(mesh);
  colliders.push({
    minX: x - WALL_T / 2,
    maxX: x + WALL_T / 2,
    minZ: z - length / 2,
    maxZ: z + length / 2,
  });
}

function addPillar(x, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, WALL_H, 0.7), wallMaterial(0.7, WALL_H));
  mesh.position.set(x, WALL_H / 2, z);
  scene.add(mesh);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.76), trimMat);
  band.position.set(x, 2.2, z);
  scene.add(band);
  colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35 });
}

function addLight(x, z, color, intensity) {
  const lamp = new THREE.PointLight(color, intensity, 16, 2);
  lamp.position.set(x, 2.7, z);
  scene.add(lamp);
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.08, 0.28),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.7 })
  );
  fixture.position.set(x, 3.12, z);
  scene.add(fixture);
  lamps.push({ light: lamp, base: intensity, phase: Math.random() * Math.PI * 2 });
}

function addSign(x, y, z, rotY, title, sub) {
  const mat = new THREE.MeshBasicMaterial({ map: makeSignTexture(title, sub) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
}

function addPipe(x1, z1, x2, z2, y) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 6), pipeMat);
  mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz).normalize());
  scene.add(mesh);
}

function addPath(x, z, w, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), pathMat);
  mesh.position.set(x, 0.03, z);
  scene.add(mesh);
}

function buildLevel() {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 42), floorMat);
  floor.position.set(1, -0.15, 15);
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(34, 0.18, 42), ceilMat);
  ceil.position.set(1, WALL_H + 0.09, 15);
  scene.add(ceil);

  addWallX(-4, -12, 12);
  addWallZ(-12, -4, 8);
  addWallZ(12, -4, 8);
  addWallX(8, -12, -2);
  addWallX(8, 2, 12);

  addWallZ(-2, 8, 12);
  addWallZ(-2, 18, 22);
  addWallZ(2, 8, 10);
  addWallZ(2, 18, 22);

  addWallZ(-14, 12, 22);
  addWallX(12, -14, -2);
  addWallX(22, -14, -2);

  addWallX(10, 2, 16);
  addWallZ(16, 10, 22);
  addWallX(22, 2, 16);

  addWallX(8, 12, 16);
  addWallZ(16, 8, 10);

  addWallZ(-8, 22, 34);
  addWallZ(12, 22, 34);
  addWallX(34, -8, 12);

  addPillar(2.2, 27.4);
  addPillar(-4.5, 32.1);

  addPath(0, 2.2, 0.55, 10);
  addPath(0, 15, 0.55, 12);
  addPath(2, 28.5, 0.55, 9);

  addLight(0, 2.4, 0xd7e8ff, 78);
  addLight(0, 6.2, 0xd7e8ff, 64);
  addLight(0, 14.8, 0xc9dcff, 70);
  addLight(8.6, 16.2, 0xd4e6ff, 74);
  addLight(-8.2, 17.2, 0xd4e6ff, 74);
  addLight(2.2, 27.6, 0xffe0bf, 80);
  addLight(-1.5, 31.6, 0xd7e8ff, 68);

  addSign(-11.72, 1.7, 2.2, Math.PI / 2, "BAY 03", "SERVICE TUNNEL");
  addSign(0, 1.85, 33.72, Math.PI, "END LOCK", "NO OUTSIDE ACCESS");

  addPipe(-1.2, 0, -1.2, 20, 3.05);
  addPipe(1.15, 9, 1.15, 21, 3.05);
  addPipe(-6, 22.4, 8, 22.4, 3.05);
}

function buildWeapon() {
  const group = new THREE.Group();
  camera.add(group);
  const metal = new THREE.MeshLambertMaterial({ color: 0x4a545f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c2228 });
  const glow = new THREE.MeshLambertMaterial({
    color: 0x1d6dff,
    emissive: 0x49b7ff,
    emissiveIntensity: 1.15,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.46), metal);
  body.position.set(0.26, -0.24, -0.52);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.16), dark);
  stock.position.set(0.26, -0.25, -0.26);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.5, 8), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.26, -0.2, -0.86);
  const cell = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.16), glow);
  cell.position.set(0.26, -0.15, -0.48);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.24), dark);
  rail.position.set(0.26, -0.12, -0.58);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.2), dark);
  fin.position.set(0.33, -0.22, -0.58);
  group.add(body, stock, barrel, cell, rail, fin);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.26, -0.2, -1.14);
  group.add(muzzle);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.95 })
  );
  const flash2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x67c8ff, transparent: true, opacity: 0.55 })
  );
  flash.visible = false;
  flash2.visible = false;
  muzzle.add(flash, flash2);
  const flashLight = new THREE.PointLight(0xc5e6ff, 0, 7, 2);
  muzzle.add(flashLight);
  group.userData = { flash, flash2, flashLight };
  return group;
}

function place(parent, geometry, material, x, y, z, rot) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  parent.add(mesh);
  return mesh;
}

function makeLeg(parent, skin, side) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.2, 0.8, 0);
  parent.add(hip);
  place(hip, alienGeo.limb, skin, side * 0.03, -0.16, 0, [0.15, 0, side * -0.18]);
  place(hip, alienGeo.joint, skin, side * 0.05, -0.36, 0.02);
  place(hip, alienGeo.limb, skin, side * 0.08, -0.54, 0.05, [0.55, 0, side * 0.05]);
  place(hip, alienGeo.foot, skin, side * 0.1, -0.74, 0.14);
  return hip;
}

function makeArm(parent, skin, side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.5, 1.22, 0.05);
  parent.add(shoulder);
  place(shoulder, alienGeo.joint, skin, 0, 0, 0);
  place(shoulder, alienGeo.limb, skin, side * 0.05, -0.22, 0.05, [0.7, 0, side * 0.25]);
  place(shoulder, alienGeo.claw, skin, side * 0.1, -0.48, 0.18, [Math.PI / 2, 0, 0]);
  return shoulder;
}

function createAlien(index, x, z) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({
    color: SKINS[index % SKINS.length],
    emissive: 0x142018,
    emissiveIntensity: 0.28,
  });
  skin.userData.dispose = true;
  const eyeMat = new THREE.MeshBasicMaterial({ color: EYES[index % EYES.length] });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111208 });
  const organMat = new THREE.MeshBasicMaterial({ color: index % 2 ? 0x7dffb2 : 0x86f0ff });

  const torso = place(group, alienGeo.torso, skin, 0, 1.05, 0);
  torso.scale.set(1.12, 0.82, 0.86);
  const head = place(group, alienGeo.head, skin, 0, 1.66, 0.04);
  head.scale.set(1.28, 0.86, 1.02);
  place(group, alienGeo.eye, eyeMat, -0.2, 1.7, 0.34);
  place(group, alienGeo.eye, eyeMat, 0.2, 1.7, 0.34);
  place(group, alienGeo.pupil, pupilMat, -0.2, 1.7, 0.45);
  place(group, alienGeo.pupil, pupilMat, 0.2, 1.7, 0.45);
  place(group, alienGeo.jaw, skin, 0, 1.42, 0.36);
  place(group, alienGeo.organ, organMat, 0, 1.12, 0.38);
  const stalk = place(group, alienGeo.stalk, skin, 0.08, 2.08, 0);
  stalk.rotation.z = -0.2;
  place(group, alienGeo.orb, organMat, 0.12, 2.26, 0.02);
  place(group, alienGeo.tail, skin, 0, 0.82, -0.28, [Math.PI / 2.35, 0, 0]);
  for (let s = 0; s < 3; s++) {
    const spine = place(group, alienGeo.claw, skin, 0, 1.28 - s * 0.12, -0.34, [Math.PI / 1.35, 0, 0]);
    spine.scale.setScalar(0.75 - s * 0.12);
  }

  const armL = makeArm(group, skin, -1);
  const armR = makeArm(group, skin, 1);
  const legL = makeLeg(group, skin, -1);
  const legR = makeLeg(group, skin, 1);
  group.position.set(x, 0, z);
  group.scale.setScalar(0.94 + (index % 3) * 0.05);
  scene.add(group);

  return {
    mesh: group,
    skin,
    x,
    z,
    hp: ALIEN_HP,
    alive: true,
    flash: 0,
    death: 0,
    attack: 0.4 + (index % 4) * 0.1,
    phase: Math.random() * Math.PI * 2,
    side: index % 2 === 0 ? 1 : -1,
    blockTime: 0,
    moving: false,
    armL,
    armR,
    legL,
    legR,
  };
}

function createPickup(def) {
  const group = new THREE.Group();
  let mat;
  if (def.type === "health") {
    mat = new THREE.MeshBasicMaterial({ color: 0x3dff86 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mat);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), new THREE.MeshBasicMaterial({ color: 0xf4fff8 }));
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xf4fff8 }));
    group.add(core, v, h);
  } else if (def.type === "ammo") {
    mat = new THREE.MeshBasicMaterial({ color: 0x4db7ff });
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 6), mat);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xf4fbff }));
    group.add(cell, band);
  } else {
    mat = new THREE.MeshBasicMaterial({ color: 0xb7c6d6 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.12), mat);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.14), new THREE.MeshBasicMaterial({ color: 0x7ef0e2 }));
    ridge.position.y = 0.08;
    group.add(plate, ridge);
  }
  group.position.set(def.x, 0.72, def.z);
  scene.add(group);
  return { ...def, mesh: group, phase: Math.random() * Math.PI * 2, alive: true };
}

function resetMatch() {
  clearDynamics();
  player.x = 0;
  player.z = 0.45;
  player.yaw = Math.PI;
  player.pitch = 0;
  player.health = 100;
  player.armor = 25;
  player.ammo = START_AMMO;
  player.invuln = 0;
  player.hurt = 0;
  fireCooldown = 0;
  dryLock = false;
  recoil = 0;
  muzzleTime = 0;
  hitMarker = 0;
  winDelay = 0.55;
  pendingWin = false;
  mouseDown = false;
  ALIEN_SPAWNS.forEach((s, i) => aliens.push(createAlien(i, s.x, s.z)));
  PICKUP_DEFS.forEach((def) => pickups.push(createPickup(def)));
  syncCamera();
}

function disposeRoot(root) {
  scene.remove(root);
  root.traverse((obj) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (mat.userData && mat.userData.dispose) mat.dispose();
    });
  });
}

function clearDynamics() {
  aliens.splice(0).forEach((alien) => disposeRoot(alien.mesh));
  pickups.splice(0).forEach((pickup) => {
    scene.remove(pickup.mesh);
  });
  bolts.splice(0).forEach((bolt) => removeBoltMesh(bolt));
  sparks.splice(0).forEach((spark) => {
    scene.remove(spark.mesh);
    spark.mesh.material.dispose();
  });
}

function bindInput() {
  menu.addEventListener("click", () => begin());
  document.getElementById("play").addEventListener("click", (event) => {
    event.stopPropagation();
    begin();
  });
  document.getElementById("restart").addEventListener("click", (event) => {
    event.stopPropagation();
    restart();
  });

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) {
      if (mode === "menu" || mode === "paused") mode = "playing";
    } else {
      mouseDown = false;
      if (mode === "playing") mode = "paused";
    }
    syncChrome();
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    const mx = clamp(event.movementX, -220, 220);
    const my = clamp(event.movementY, -220, 220);
    player.yaw -= mx * 0.0022;
    player.pitch -= my * 0.0022;
    player.pitch = clamp(player.pitch, -1.15, 1.15);
  });

  window.addEventListener("mousedown", (event) => {
    if (event.button === 0 && document.pointerLockElement === renderer.domElement) mouseDown = true;
  });
  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) mouseDown = false;
  });
  window.addEventListener("keydown", (event) => setKey(event, true));
  window.addEventListener("keyup", (event) => setKey(event, false));
  window.addEventListener("blur", () => {
    keys.w = keys.a = keys.s = keys.d = keys.shift = false;
    mouseDown = false;
  });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
}

function setKey(event, down) {
  const map = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d" };
  if (map[event.code]) {
    keys[map[event.code]] = down;
    event.preventDefault();
  }
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.shift = down;
}

function begin() {
  if (mode !== "menu" && mode !== "paused") return;
  ensureAudio();
  renderer.domElement.requestPointerLock();
}

function restart() {
  resetMatch();
  mode = "menu";
  syncChrome();
  ensureAudio();
  renderer.domElement.requestPointerLock();
}

function syncChrome() {
  const live = mode === "playing" || mode === "won" || mode === "lost";
  hud.classList.toggle("hidden", !live);
  crosshair.classList.toggle("hidden", mode !== "playing");
  menu.classList.toggle("hidden", mode !== "menu" && mode !== "paused");
  endScreen.classList.toggle("hidden", mode !== "won" && mode !== "lost");
  if (mode === "paused") {
    menuTitle.textContent = "Paused";
    menuBlurb.textContent = "Click to resume.";
  } else if (mode === "menu") {
    menuTitle.textContent = "Ash Corridor";
    menuBlurb.textContent = "Eight aliens are loose in the service tunnel. Drop every one of them.";
  }
  updateHud();
}

function frame(now) {
  const dt = Math.min(0.05, (now - clock) / 1000);
  clock = now;
  if (mode === "playing") simulate(dt);
  updateEffects(dt);
  syncCamera();
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function simulate(dt) {
  syncCamera();
  tryFire(dt);
  movePlayer(dt);
  for (const alien of aliens) {
    if (!alien.alive) continue;
    updateAlien(alien, dt);
  }
  separateAliens();
  for (const alien of aliens) {
    if (!alien.alive) continue;
    alien.mesh.position.x = alien.x;
    alien.mesh.position.z = alien.z;
    animateAlien(alien, dt);
  }
  updateBolts(dt);
  updatePickups(dt);
  if (pendingWin) {
    winDelay -= dt;
    if (winDelay <= 0) finish("won");
  }
}

function movePlayer(dt) {
  syncCamera();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) return;
  forward.normalize();
  right.crossVectors(up, forward);
  let mx = 0;
  let mz = 0;
  if (keys.w) {
    mx += forward.x;
    mz += forward.z;
  }
  if (keys.s) {
    mx -= forward.x;
    mz -= forward.z;
  }
  if (keys.d) {
    mx += right.x;
    mz += right.z;
  }
  if (keys.a) {
    mx -= right.x;
    mz -= right.z;
  }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    const speed = (keys.shift ? RUN : WALK) * dt;
    tryMove(player, (mx / len) * speed, (mz / len) * speed, PLAYER_R);
    walkPhase += dt * (keys.shift ? 13 : 9);
  }
}

function tryFire(dt) {
  fireCooldown = Math.max(0, fireCooldown - dt);
  if (!mouseDown) {
    dryLock = false;
    return;
  }
  if (fireCooldown > 0) return;
  if (player.ammo <= 0) {
    if (!dryLock) {
      dryLock = true;
      beep(130, 0.05, "square", 0.03);
    }
    return;
  }
  dryLock = false;
  fireCooldown = FIRE_DELAY;
  player.ammo -= 1;
  recoil = 1;
  muzzleTime = 0.08;
  spawnBolt();
  sndShoot();
}

function spawnBolt() {
  camera.getWorldPosition(eyePos);
  camera.getWorldDirection(aim);
  const mesh = new THREE.Group();
  const core = new THREE.Mesh(boltCoreGeo, new THREE.MeshBasicMaterial({ color: 0xf4fbff }));
  const glow = new THREE.Mesh(
    boltGlowGeo,
    new THREE.MeshBasicMaterial({ color: 0x3aa8ff, transparent: true, opacity: 0.55 })
  );
  const trail = new THREE.Mesh(
    boltTrailGeo,
    new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.8 })
  );
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 0.28;
  mesh.add(core, glow, trail);
  scene.add(mesh);
  const bolt = {
    x: eyePos.x + aim.x * 0.4,
    y: eyePos.y + aim.y * 0.4,
    z: eyePos.z + aim.z * 0.4,
    vx: aim.x * BOLT_SPEED,
    vy: aim.y * BOLT_SPEED,
    vz: aim.z * BOLT_SPEED,
    life: 1.15,
    mesh,
  };
  if (boltImpact(bolt.x, bolt.y, bolt.z)) {
    removeBoltMesh(bolt);
    return;
  }
  bolts.push(bolt);
}

function updateBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const bolt = bolts[i];
    bolt.life -= dt;
    let dead = bolt.life <= 0;
    const steps = 8;
    for (let s = 0; s < steps && !dead; s++) {
      bolt.x += (bolt.vx * dt) / steps;
      bolt.y += (bolt.vy * dt) / steps;
      bolt.z += (bolt.vz * dt) / steps;
      if (boltImpact(bolt.x, bolt.y, bolt.z)) dead = true;
    }
    if (dead) {
      removeBoltMesh(bolt);
      bolts.splice(i, 1);
      continue;
    }
    bolt.mesh.position.set(bolt.x, bolt.y, bolt.z);
    bolt.mesh.lookAt(bolt.x + bolt.vx, bolt.y + bolt.vy, bolt.z + bolt.vz);
  }
}

function boltImpact(x, y, z) {
  if (overlaps(x, z, 0.1) || y < 0.12 || y > WALL_H - 0.1) {
    spawnSpark(x, y, z, 0xd5ecff);
    return true;
  }
  for (const alien of aliens) {
    if (!alien.alive) continue;
    const dx = x - alien.x;
    const dz = z - alien.z;
    if (dx * dx + dz * dz < 0.62 * 0.62 && y > 0.28 && y < 2.3) {
      damageAlien(alien, x, y, z);
      return true;
    }
  }
  return false;
}

function removeBoltMesh(bolt) {
  scene.remove(bolt.mesh);
  bolt.mesh.traverse((obj) => {
    if (obj.material) obj.material.dispose();
  });
}

function damageAlien(alien, x, y, z) {
  alien.hp -= BOLT_DAMAGE;
  alien.flash = 0.14;
  alien.skin.emissive.setHex(0xffffff);
  alien.skin.emissiveIntensity = 1;
  hitMarker = 0.12;
  spawnSpark(x, y, z, 0xe7f7ff);
  sndHit();
  if (alien.hp <= 0) {
    alien.alive = false;
    alien.death = 0.7;
    alien.mesh.rotation.x = 0;
    if (!aliens.some((other) => other.alive) && !pendingWin && mode === "playing") {
      pendingWin = true;
      winDelay = 0.55;
    }
  }
}

function updateAlien(alien, dt) {
  const dx = player.x - alien.x;
  const dz = player.z - alien.z;
  const dist = Math.hypot(dx, dz) || 0.0001;
  alien.mesh.rotation.y = Math.atan2(dx, dz);
  if (alien.flash > 0) alien.flash -= dt;

  if (dist < MELEE_RANGE) {
    alien.moving = false;
    alien.attack -= dt;
    if (alien.attack <= 0) {
      alien.attack = MELEE_DELAY;
      damagePlayer(MELEE_DAMAGE);
    }
    return;
  }

  alien.moving = true;
  const dirx = dx / dist;
  const dirz = dz / dist;
  const speed = 2.55;
  const ox = alien.x;
  const oz = alien.z;
  tryMove(alien, dirx * speed * dt, dirz * speed * dt, ALIEN_R);
  const moved = Math.hypot(alien.x - ox, alien.z - oz);
  if (moved < speed * dt * 0.4) {
    tryMove(alien, -dirz * alien.side * speed * dt, dirx * alien.side * speed * dt, ALIEN_R);
    alien.blockTime += dt;
    if (alien.blockTime > 0.5) {
      alien.side *= -1;
      alien.blockTime = 0;
    }
  } else {
    alien.blockTime = 0;
  }
}

function animateAlien(alien, dt) {
  const speed = alien.moving ? 8.5 : 1.6;
  alien.phase += dt * speed;
  const swing = Math.sin(alien.phase) * (alien.moving ? 0.65 : 0.08);
  alien.armL.rotation.x = swing;
  alien.armR.rotation.x = -swing;
  alien.legL.rotation.x = -swing;
  alien.legR.rotation.x = swing;
  const bob = Math.abs(Math.sin(alien.phase)) * (alien.moving ? 0.05 : 0.015);
  alien.mesh.position.y = bob;
  const flashing = alien.flash > 0;
  alien.skin.emissive.setHex(flashing ? 0xffffff : 0x142018);
  alien.skin.emissiveIntensity = flashing ? 1 : 0.28;
}

function separateAliens() {
  for (let i = 0; i < aliens.length; i++) {
    for (let j = i + 1; j < aliens.length; j++) {
      const a = aliens[i];
      const b = aliens[j];
      if (!a.alive || !b.alive) continue;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      const min = 0.95;
      if (dist > 0 && dist < min) {
        const push = (min - dist) * 0.5;
        dx /= dist;
        dz /= dist;
        const ax = a.x;
        const az = a.z;
        const bx = b.x;
        const bz = b.z;
        a.x -= dx * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.z += dz * push;
        if (!canOccupy(a.x, a.z, ALIEN_R)) {
          a.x = ax;
          a.z = az;
        }
        if (!canOccupy(b.x, b.z, ALIEN_R)) {
          b.x = bx;
          b.z = bz;
        }
      }
    }
  }
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    pickup.phase += dt;
    pickup.mesh.rotation.y += dt * 1.4;
    pickup.mesh.position.y = 0.72 + Math.sin(pickup.phase * 2) * 0.08;
    if (Math.hypot(player.x - pickup.x, player.z - pickup.z) > 1.05) continue;
    if (!takePickup(pickup)) continue;
    scene.remove(pickup.mesh);
    pickups.splice(i, 1);
    sndPickup();
  }
}

function takePickup(pickup) {
  if (pickup.type === "health") {
    if (player.health >= 100) return false;
    player.health = Math.min(100, player.health + 40);
    return true;
  }
  if (pickup.type === "ammo") {
    if (player.ammo >= AMMO_MAX) return false;
    player.ammo = Math.min(AMMO_MAX, player.ammo + 18);
    return true;
  }
  if (player.armor >= 100) return false;
  player.armor = Math.min(100, player.armor + 40);
  return true;
}

function damagePlayer(amount) {
  if (player.invuln > 0 || mode !== "playing") return;
  const absorbed = Math.min(player.armor, Math.round(amount * 0.5));
  player.armor -= absorbed;
  player.health -= amount - absorbed;
  player.invuln = 0.45;
  player.hurt = 0.5;
  sndHurt();
  if (player.health <= 0) {
    player.health = 0;
    finish("lost");
  }
}

function updateEffects(dt) {
  player.hurt = Math.max(0, player.hurt - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  hitMarker = Math.max(0, hitMarker - dt);
  recoil = Math.max(0, recoil - dt * 7);
  muzzleTime = Math.max(0, muzzleTime - dt);
  const showFlash = muzzleTime > 0;
  weapon.userData.flash.visible = showFlash;
  weapon.userData.flash2.visible = showFlash;
  weapon.userData.flashLight.intensity = showFlash ? 28 : 0;
  const moving = mode === "playing" && (keys.w || keys.a || keys.s || keys.d);
  const amp = moving ? 0.016 : 0.0035;
  weapon.position.x = Math.sin(walkPhase * 0.5) * amp;
  weapon.position.y = -Math.abs(Math.sin(walkPhase)) * amp;
  weapon.position.z = recoil * 0.08;

  const t = performance.now() * 0.001;
  for (const lamp of lamps) {
    lamp.light.intensity = lamp.base * (0.9 + Math.sin(t * 6 + lamp.phase) * 0.08);
  }
  for (const alien of aliens) {
    if (alien.alive || alien.death <= 0) continue;
    alien.death -= dt;
    const k = 1 - Math.max(alien.death, 0) / 0.7;
    alien.mesh.rotation.x = k * 1.25;
    alien.mesh.position.y = -k * 0.45;
    if (alien.death <= 0) alien.mesh.visible = false;
  }
  for (const pickup of pickups) {
    if (mode === "playing") continue;
    pickup.phase += dt;
    pickup.mesh.rotation.y += dt;
    pickup.mesh.position.y = 0.72 + Math.sin(pickup.phase * 2) * 0.08;
  }
  updateSparks(dt);
  hurtEl.style.opacity = String(Math.min(0.7, player.hurt * 1.6));
  crosshair.classList.toggle("hit", hitMarker > 0);
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i];
    spark.life -= dt;
    const k = Math.max(spark.life, 0) / spark.max;
    spark.mesh.scale.setScalar(1 + (1 - k) * 2.4);
    spark.mesh.material.opacity = k;
    if (spark.life <= 0) {
      scene.remove(spark.mesh);
      spark.mesh.material.dispose();
      sparks.splice(i, 1);
    }
  }
}

function spawnSpark(x, y, z, color) {
  const mesh = new THREE.Mesh(
    sparkGeo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
  );
  mesh.position.set(x, THREE.MathUtils.clamp(y, 0.3, 2.2), z);
  scene.add(mesh);
  sparks.push({ mesh, life: 0.16, max: 0.16 });
}

function syncCamera() {
  const bob = mode === "playing" && (keys.w || keys.a || keys.s || keys.d) ? Math.sin(walkPhase * 2) * 0.02 : 0;
  camera.position.set(player.x, EYE + bob, player.z);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch + recoil * 0.02;
}

function updateHud() {
  ammoEl.textContent = String(player.ammo);
  healthEl.textContent = String(Math.max(0, Math.ceil(player.health)));
  armorEl.textContent = String(Math.max(0, Math.ceil(player.armor)));
  enemiesEl.textContent = String(aliens.filter((alien) => alien.alive).length);
  ammoEl.parentElement.classList.toggle("low", player.ammo <= 8);
  healthEl.parentElement.classList.toggle("low", player.health <= 30);
}

function finish(result) {
  if (mode === "won" || mode === "lost") return;
  mode = result;
  mouseDown = false;
  pendingWin = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (result === "won") {
    endTitle.textContent = "Tunnel clear";
    endText.textContent = "All eight aliens are down.";
    endPanel.classList.add("win");
    endPanel.classList.remove("lose");
  } else {
    endTitle.textContent = "You died";
    endText.textContent = "Health reached zero.";
    endPanel.classList.add("lose");
    endPanel.classList.remove("win");
  }
  syncChrome();
}

function overlaps(x, z, radius) {
  for (const box of colliders) {
    const nx = clamp(x, box.minX, box.maxX);
    const nz = clamp(z, box.minZ, box.maxZ);
    const dx = x - nx;
    const dz = z - nz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

function insideLevel(x, z) {
  return ROOMS.some((room) => x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ);
}

function canOccupy(x, z, radius) {
  return insideLevel(x, z) && !overlaps(x, z, radius);
}

function tryMove(entity, dx, dz, radius) {
  const ox = entity.x;
  const oz = entity.z;
  entity.x += dx;
  if (!canOccupy(entity.x, entity.z, radius)) entity.x = ox;
  entity.z += dz;
  if (!canOccupy(entity.x, entity.z, radius)) entity.z = oz;
}

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function beep(freq, dur, type, vol) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function sndShoot() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(920, t);
  osc.frequency.exponentialRampToValueAtTime(210, t + 0.07);
  gain.gain.setValueAtTime(0.04, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

function sndHit() {
  beep(210, 0.06, "square", 0.045);
}

function sndHurt() {
  beep(90, 0.12, "sawtooth", 0.05);
}

function sndPickup() {
  beep(540, 0.06, "sine", 0.04);
  beep(780, 0.09, "sine", 0.035);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
