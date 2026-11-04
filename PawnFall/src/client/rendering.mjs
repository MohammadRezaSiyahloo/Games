import { createBossDamageView } from './boss-damage-view.mjs';
import { createDynamicArenaView } from './dynamic-arena-view.mjs';
import { createArenaObjectiveView } from './arena-objective-view.mjs';
import { createWeaponRig } from './weapon-rig.mjs';
import { weaponStance, heavyBodyPose, reactionPose, finisherPose } from './combat-motion.mjs';
import { buildRealmArenas, resolveArenaCamera, hazardAngle } from './realm-arenas.mjs';
import { rollPose } from './roll-animation.mjs';
import { buildKnightHead, buildColiseum } from './arena-models.mjs';
import { attackPose, heavyAttackPose, fallenPose } from './attack-animation.mjs';
import { abilityGeometry } from '../shared/piece-abilities.mjs';
import { stats, clamp, dist, angleLerp } from '../shared/combat.mjs';
// Procedural 3D presentation. Combat and networking do not depend on this module.

export function createVisuals(THREE, game, view, $) {
  const bossDamageView = createBossDamageView(THREE);
  const PI = Math.PI,
    TAU = PI * 2,
    shared = {};
  let renderer,
    scene,
    camera,
    actors = new Map(),
    shots = new Map(),
    fx = [],
    particles = [],
    sparks = [],
    contactFlashes = [],
    emberPoints,
    emberPositions,
    playerModel,
    orbTexture,
    cameraFocus,
    cameraAim,
    lastRenderScale,
    arenaObjectiveView,
    dynamicArenaView,
    coliseum,
    realms,
    activeRealm = 0,
    activeOccluders = [];
  const arenaMarkers = new Map();

  function noise(x, y) {
    return (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  }

  function marble(dark = false) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const a = c.getContext('2d'),
      img = a.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        let i = (y * 256 + x) * 4;
        let v = Math.sin(x * 0.043 + Math.sin(y * 0.032) * 2.8 + Math.sin((x + y) * 0.012) * 5);
        let vein = Math.pow(Math.abs(v), 22);
        let n = Math.abs(noise(x, y)) * 14;
        let base = dark ? 30 : 177;
        img.data[i] = clamp(base + (dark ? 25 : -55) * vein + n, 0, 255);
        img.data[i + 1] = clamp(base * 0.84 + (dark ? 17 : -42) * vein + n, 0, 255);
        img.data[i + 2] = clamp(base * 0.68 + (dark ? 12 : -38) * vein + n, 0, 255);
        img.data[i + 3] = 255;
      }
    a.putImageData(img, 0, 0);
    let tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function makeGlow() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const a = c.getContext('2d'),
      g = a.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.15, '#fff8');
    g.addColorStop(0.45, '#fff2');
    g.addColorStop(1, '#fff0');
    a.fillStyle = g;
    a.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    let m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function cyl(parent, rb, rt, h, y, mat, n = 24) {
    return mesh(new THREE.CylinderGeometry(rt, rb, h, n), mat, parent, 0, y, 0);
  }

  function ring(parent, r, t, y, mat) {
    let m = mesh(new THREE.TorusGeometry(r, t, 8, 32), mat, parent, 0, y, 0);
    m.rotation.x = PI / 2;
    return m;
  }

  function ball(parent, r, y, mat) {
    return mesh(new THREE.SphereGeometry(r, 24, 16), mat, parent, 0, y, 0);
  }

  function lathe(parent, pts, mat) {
    return mesh(
      new THREE.LatheGeometry(
        pts.map((p) => new THREE.Vector2(...p)),
        40,
      ),
      mat,
      parent,
    );
  }

  function glow(parent, color, size, x, y, z) {
    let s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: orbTexture,
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    s.position.set(x, y, z);
    s.scale.set(size, size, size);
    parent.add(s);
    return s;
  }

  function makeSword(parent, heavy = false) {
    let pivot = new THREE.Group();
    pivot.position.set(0.57, 1.08, 0);
    parent.add(pivot);
    let handle = mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.4, 10),
      shared.leather,
      pivot,
      0,
      0.08,
      0,
    );
    let guard = mesh(new THREE.BoxGeometry(0.46, 0.08, 0.13), shared.gold, pivot, 0, 0.31, 0);
    let blade = mesh(
      new THREE.BoxGeometry(heavy ? 0.22 : 0.14, heavy ? 1.5 : 1.1, 0.07),
      shared.steel,
      pivot,
      0,
      heavy ? 1.1 : 0.91,
      0,
    );
    let tip = mesh(
      new THREE.ConeGeometry(heavy ? 0.16 : 0.1, 0.24, 4),
      shared.steel,
      pivot,
      0,
      heavy ? 1.96 : 1.58,
      0,
    );
    tip.rotation.y = PI / 4;
    pivot.rotation.z = -0.45;
    return pivot;
  }

  function makeShield(parent, dark) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.4, 0.55);
    sh.lineTo(0.4, 0.55);
    sh.lineTo(0.37, -0.12);
    sh.quadraticCurveTo(0.3, -0.4, 0, -0.65);
    sh.quadraticCurveTo(-0.3, -0.4, -0.37, -0.12);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.07,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.025,
      bevelSegments: 2,
      steps: 1,
    });
    let group = new THREE.Group();
    group.position.set(-0.6, 1, 0.42);
    group.rotation.y = -0.18;
    parent.add(group);
    mesh(g, dark ? shared.darkMetal : shared.steel, group);
    let cross1 = mesh(new THREE.BoxGeometry(0.075, 1.02, 0.035), shared.gold, group, 0, 0.02, 0.13);
    let cross2 = mesh(new THREE.BoxGeometry(0.68, 0.07, 0.035), shared.gold, group, 0, 0.18, 0.13);
    for (let x of [-0.29, 0.29])
      for (let y of [-0.04, 0.39])
        mesh(new THREE.SphereGeometry(0.035, 8, 6), shared.gold, group, x, y, 0.14);
    return group;
  }

  function crown(parent, y, player = false) {
    let g = new THREE.Group();
    parent.add(g);
    g.position.y = y;
    cyl(g, 0.36, 0.39, 0.14, 0, shared.gold);
    for (let i = 0; i < 5; i++) {
      let a = (i / 5) * TAU,
        m = mesh(
          new THREE.ConeGeometry(0.1, 0.4, 5),
          shared.gold,
          g,
          Math.sin(a) * 0.35,
          0.22,
          Math.cos(a) * 0.35,
        );
      ball(m, 0.045, 0.22, shared.fire);
    }
    return g;
  }

  function createActor(type, friendly = false) {
    let root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    const stone = friendly ? shared.ivory : shared.obsidian;
    let arm, shield, head, crownMesh;
    if (type === 'pawn') {
      lathe(
        body,
        [
          [0, 0],
          [0.48, 0],
          [0.61, 0.08],
          [0.62, 0.15],
          [0.57, 0.23],
          [0.43, 0.29],
          [0.42, 0.38],
          [0.29, 0.5],
          [0.22, 0.97],
          [0.32, 1.06],
          [0.41, 1.1],
          [0.4, 1.19],
          [0.2, 1.23],
          [0, 1.23],
        ],
        stone,
      );
      ball(body, 0.34, 1.51, stone);
      let helm = mesh(
        new THREE.SphereGeometry(0.37, 24, 12, 0, TAU, 0, PI / 2),
        shared.darkMetal,
        body,
        0,
        1.53,
        0,
      );
      ring(body, 0.37, 0.025, 1.54, shared.gold);
      mesh(new THREE.BoxGeometry(0.065, 0.34, 0.055), shared.steel, body, 0, 1.65, 0.335);
      for (let x of [-0.16, 0.16])
        mesh(
          new THREE.BoxGeometry(0.18, 0.045, 0.035),
          friendly ? shared.darkMetal : shared.fire,
          body,
          x,
          1.6,
          0.34,
        );
      arm = makeSword(body);
      shield = makeShield(body, !friendly);
      crownMesh = crown(body, 2.05, true);
      crownMesh.visible = false;
    } else if (type === 'rook') {
      lathe(
        body,
        [
          [0, 0],
          [0.72, 0],
          [0.86, 0.12],
          [0.84, 0.27],
          [0.63, 0.37],
          [0.52, 0.55],
          [0.47, 1.7],
          [0.68, 1.82],
          [0.72, 2.08],
          [0.7, 2.25],
          [0, 2.25],
        ],
        stone,
      );
      ring(body, 0.67, 0.07, 0.35, shared.gold);
      ring(body, 0.7, 0.07, 1.9, shared.gold);
      for (let i = 0; i < 7; i++) {
        let a = (i / 7) * TAU;
        mesh(
          new THREE.BoxGeometry(0.28, 0.4, 0.24),
          stone,
          body,
          Math.sin(a) * 0.6,
          2.42,
          Math.cos(a) * 0.6,
        );
      }
      shield = makeShield(body, true);
      shield.scale.set(1.5, 1.6, 1.3);
      shield.position.set(0, 1.2, 0.65);
      arm = new THREE.Group();
      arm.position.set(0.8, 1.25, 0);
      body.add(arm);
      mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.2, 12), shared.leather, arm, 0, 0.3, 0);
      mesh(new THREE.BoxGeometry(1.05, 0.62, 0.65), shared.darkMetal, arm, 0, 1.45, 0);
      mesh(new THREE.BoxGeometry(1.1, 0.1, 0.7), shared.gold, arm, 0, 1.45, 0);
      arm.rotation.z = -0.7;
    } else if (type === 'knight') {
      lathe(
        body,
        [
          [0, 0],
          [0.6, 0],
          [0.7, 0.13],
          [0.63, 0.3],
          [0.43, 0.4],
          [0.35, 0.8],
          [0.5, 1.1],
          [0, 1.15],
        ],
        stone,
      );
      buildKnightHead(
        THREE,
        body,
        { stone, metal: shared.darkMetal, gold: shared.gold, eye: shared.fire },
        mesh,
      );
      arm = makeSword(body, true);
      arm.position.y = 1.2;
      shield = makeShield(body, true);
    } else if (type === 'bishop') {
      lathe(
        body,
        [
          [0, 0],
          [0.65, 0],
          [0.72, 0.13],
          [0.67, 0.3],
          [0.47, 0.42],
          [0.33, 0.75],
          [0.27, 1.7],
          [0.43, 1.82],
          [0.47, 1.95],
          [0.27, 2.05],
          [0, 2.05],
        ],
        stone,
      );
      lathe(
        body,
        [
          [0, 2.03],
          [0.22, 2.06],
          [0.39, 2.3],
          [0.32, 2.58],
          [0, 2.95],
        ],
        stone,
      );
      ring(body, 0.42, 0.055, 1.94, shared.gold);
      let cut = mesh(new THREE.BoxGeometry(0.055, 0.48, 0.6), shared.gold, body, 0.02, 2.57, 0.05);
      cut.rotation.z = -0.5;
      arm = new THREE.Group();
      arm.position.set(0.74, 1.4, 0);
      body.add(arm);
      mesh(new THREE.CylinderGeometry(0.05, 0.065, 2.9, 10), shared.gold, arm, 0, 0.1, 0);
      ball(arm, 0.23, 1.65, shared.fire);
      glow(arm, '#ff682a', 1.4, 0, 1.65, 0);
      shield = makeShield(body, true);
      shield.scale.setScalar(0.8);
    } else {
      lathe(
        body,
        [
          [0, 0],
          [0.74, 0],
          [0.84, 0.15],
          [0.78, 0.32],
          [0.56, 0.45],
          [0.4, 0.75],
          [0.29, 1.9],
          [0.45, 2.05],
          [0.52, 2.16],
          [0.48, 2.27],
          [0.24, 2.35],
          [0, 2.35],
        ],
        stone,
      );
      ball(body, 0.43, 2.7, stone);
      ring(body, 0.48, 0.065, 2.19, shared.gold);
      body.userData.royalCrown = crown(body, 3.12);
      arm = makeSword(body, true);
      arm.position.set(0.7, 1.75, 0);
      arm.scale.setScalar(1.2);
      shield = makeShield(body, true);
      shield.position.y = 1.8;
      shield.scale.setScalar(1.25);
      glow(body, '#ff4822', 1.9, 0, 2.72, 0);
    }
    if (type === 'king') {
      mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), shared.gold, body, 0, 3.65, 0);
      mesh(new THREE.BoxGeometry(0.55, 0.12, 0.12), shared.gold, body, 0, 3.78, 0);
    }
    if (friendly && type !== 'pawn') {
      body.remove(arm);
      body.remove(shield);
      arm = makeSword(body);
      arm.position.y = 1.3;
      shield = makeShield(body, false);
      shield.position.y = 1.25;
      crownMesh = crown(body, 3.9, true);
      crownMesh.visible = false;
    }
    let tell = mesh(
      new THREE.RingGeometry(0.85, 0.92, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffa34f,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      root,
      0,
      0.026,
      0,
    );
    tell.rotation.x = -PI / 2;
    tell.castShadow = false;
    root.userData = { body, arm, shield, tell, crown: crownMesh, type, friendly };
    arm.userData.original = [...arm.children];
    root.userData.rig = createWeaponRig(THREE, body, arm, shield, shared);
    scene.add(root);
    return root;
  }

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#151923');
    scene.fog = new THREE.FogExp2('#252c38', 0.027);
    camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 150);
    camera.position.set(16, 12, 19);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.38;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    $('#viewport').appendChild(renderer.domElement);
    orbTexture = makeGlow();
    let whiteTex = marble(),
      blackTex = marble(true);
    Object.assign(shared, {
      ivory: new THREE.MeshStandardMaterial({
        map: whiteTex,
        color: '#efe5d4',
        roughness: 0.28,
        metalness: 0.13,
      }),
      obsidian: new THREE.MeshStandardMaterial({
        map: blackTex,
        color: '#6e665e',
        roughness: 0.27,
        metalness: 0.52,
      }),
      gold: new THREE.MeshStandardMaterial({ color: '#a47736', metalness: 0.8, roughness: 0.3 }),
      steel: new THREE.MeshStandardMaterial({ color: '#7a8183', metalness: 0.9, roughness: 0.24 }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: '#28292b',
        metalness: 0.85,
        roughness: 0.3,
      }),
      leather: new THREE.MeshStandardMaterial({ color: '#2a160e', roughness: 0.92 }),
      fire: new THREE.MeshStandardMaterial({
        color: '#ff6c22',
        emissive: '#ff3d08',
        emissiveIntensity: 3,
      }),
      rubble: new THREE.MeshStandardMaterial({ map: blackTex, color: '#403029', roughness: 0.9 }),
    });
    scene.add(new THREE.HemisphereLight('#e4edff', '#101724', 2));
    let sun = new THREE.DirectionalLight('#fff1d9', 3.3);
    sun.position.set(-9, 18, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -17,
      right: 17,
      top: 17,
      bottom: -17,
      near: 0.5,
      far: 60,
    });
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 3;
    scene.add(sun);
    let rim = new THREE.DirectionalLight('#b2c8df', 3);
    rim.position.set(0, 6, -14);
    scene.add(rim);
    let fill = new THREE.PointLight('#ffb461', 28, 28, 2);
    fill.position.set(0, 5, 5);
    scene.add(fill);
    const tileGeo = new THREE.BoxGeometry(2.8, 0.3, 2.8),
      tileMats = [
        new THREE.MeshStandardMaterial({
          map: whiteTex,
          color: '#f1eadb',
          roughness: 0.38,
          metalness: 0.13,
        }),
        new THREE.MeshStandardMaterial({
          map: blackTex,
          color: '#121722',
          roughness: 0.32,
          metalness: 0.22,
        }),
      ];
    for (let z = 0; z < 8; z++)
      for (let x = 0; x < 8; x++) {
        let m = mesh(
          tileGeo,
          tileMats[(x + z) % 2],
          scene,
          (x - 3.5) * 2.8,
          -0.15,
          (z - 3.5) * 2.8,
        );
        m.castShadow = false;
      }
    mesh(new THREE.BoxGeometry(22.7, 0.7, 22.7), shared.rubble, scene, 0, -0.64, 0);
    for (let n = 0; n < 4; n++) {
      let side = new THREE.Group();
      side.rotation.y = (n * PI) / 2;
      scene.add(side);
      mesh(new THREE.BoxGeometry(22.7, 0.1, 0.13), shared.gold, side, 0, -0.33, 11.25);
      for (let j = 0; j < 9; j++) {
        let m = mesh(
          new THREE.BoxGeometry(0.8, 0.5, 0.32),
          shared.rubble,
          side,
          (j - 4) * 2.78,
          -0.58,
          11.36,
        );
        m.rotation.z = Math.sin(j * 51 + n) * 0.08;
      }
    }
    coliseum = buildColiseum(THREE, scene, glow);
    realms = buildRealmArenas(THREE, scene);
    for (let i = 0; i < 4; i++) {
      let a = PI / 4 + (i * PI) / 2,
        x = Math.sin(a) * 17,
        z = Math.cos(a) * 17;
      let brazier = new THREE.Group();
      brazier.position.set(x, -1, z);
      scene.add(brazier);
      cyl(brazier, 0.6, 0.3, 4, 1, shared.darkMetal, 8);
      cyl(brazier, 0.6, 1.1, 0.6, 3.1, shared.gold, 8);
      glow(brazier, '#ff450e', 5, 0, 3.65, 0);
      let light = new THREE.PointLight('#ff3d08', 55, 23, 2);
      light.position.set(x, 3, z);
      scene.add(light);
    }
    let moon = mesh(
      new THREE.SphereGeometry(5, 32, 20),
      new THREE.MeshBasicMaterial({ color: '#ad200e' }),
      scene,
      0,
      17,
      -53,
    );
    moon.castShadow = false;
    glow(scene, '#d5270a', 33, 0, 17, -52);
    emberPositions = new Float32Array(350 * 3);
    for (let i = 0; i < 350; i++) {
      emberPositions[i * 3] = (Math.random() - 0.5) * 65;
      emberPositions[i * 3 + 1] = Math.random() * 24;
      emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 65;
    }
    let emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
    emberPoints = new THREE.Points(
      emberGeo,
      new THREE.PointsMaterial({
        color: '#ff9d4b',
        map: orbTexture,
        size: 0.18,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    scene.add(emberPoints);
    shared.shotGeo = new THREE.SphereGeometry(0.16, 12, 8);
    shared.shotMat = new THREE.MeshBasicMaterial({ color: '#ffb464' });
    shared.particleGeo = new THREE.SphereGeometry(0.035, 4, 3);
    shared.particleMat = new THREE.MeshBasicMaterial({ color: '#ffc37a' });
    // Inlaid rank and file labels belong to the physical board.
    for (let i = 0; i < 8; i++) {
      for (const axis of [0, 1]) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#e8dfc9';
        ctx.font = '38px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText?.(axis ? String(8 - i) : 'ABCDEFGH'[i], 32, 45);
        const label = mesh(
          new THREE.PlaneGeometry(0.45, 0.45),
          new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(c),
            transparent: true,
            depthWrite: false,
          }),
          scene,
          axis ? -11.05 : (i - 3.5) * 2.8,
          0.03,
          axis ? (i - 3.5) * 2.8 : 11.05,
        );
        label.rotation.x = -PI / 2;
        label.castShadow = false;
      }
    }
    syncActors();
    game.events = [];
    resize();
  }

  function equipWeapon(model, id) {
    id = id || 'longsword';
    if (model.userData.weapon === id) return;
    model.userData.weapon = id;
    if (model.userData.twinBlade) model.userData.twinBlade.visible = id === 'twinblades';
    if (model.userData.friendly) {
      model.userData.rig.offhand = id === 'twinblades' ? model.userData.twinBlade : null;
      model.userData.shield.visible = id !== 'twinblades';
    }
    const arm = model.userData.arm;
    // Reuse the existing grip while changing its blade, reach and head.
    if (!arm.userData.original) arm.userData.original = [...arm.children];
    arm.userData.visuals ||= new Map([['longsword', arm.userData.original]]);
    for (const parts of arm.userData.visuals.values())
      for (const child of parts) child.visible = false;
    if (arm.userData.visuals.has(id)) {
      arm.userData.parts = arm.userData.visuals.get(id);
      for (const child of arm.userData.parts) child.visible = true;
      return;
    }
    arm.userData.parts = [];
    const add = (geo, mat, x, y, z) => {
      const part = mesh(geo, mat, arm, x, y, z);
      arm.userData.parts.push(part);
    };
    if (id === 'spear') {
      add(new THREE.CylinderGeometry(0.045, 0.05, 3.5, 8), shared.leather, 0, 0.65, 0);
      add(new THREE.ConeGeometry(0.14, 0.65, 4), shared.steel, 0, 2.65, 0);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.15, 8), shared.gold, 0, 2.3, 0);
    } else if (id === 'greatsword') {
      add(new THREE.CylinderGeometry(0.065, 0.065, 0.75, 8), shared.leather, 0, 0.23, 0);
      add(new THREE.BoxGeometry(0.7, 0.12, 0.18), shared.gold, 0, 0.65, 0);
      add(new THREE.BoxGeometry(0.24, 1.9, 0.08), shared.steel, 0, 1.6, 0);
      add(new THREE.ConeGeometry(0.17, 0.4, 4), shared.steel, 0, 2.75, 0);
    } else if (id === 'twinblades') {
      add(new THREE.CylinderGeometry(0.055, 0.055, 0.4, 8), shared.leather, 0, 0.1, 0);
      add(new THREE.BoxGeometry(0.4, 0.1, 0.14), shared.gold, 0, 0.32, 0);
      add(new THREE.ConeGeometry(0.13, 1.1, 4), shared.steel, 0, 0.9, 0);
      const left = new THREE.Group();
      left.position.set(-0.7, 1, 0.25);
      model.userData.body.add(left);
      mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.4, 8), shared.leather, left, 0, 0.1, 0);
      mesh(new THREE.BoxGeometry(0.4, 0.1, 0.14), shared.gold, left, 0, 0.32, 0);
      mesh(new THREE.ConeGeometry(0.13, 1.1, 4), shared.steel, left, 0, 0.9, 0);
      model.userData.twinBlade = left;
      model.userData.rig.offhand = left;
      model.userData.shield.visible = false;
    } else if (id === 'rapier') {
      add(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8), shared.leather, 0, 0.08, 0);
      add(new THREE.TorusGeometry(0.19, 0.025, 8, 24), shared.gold, 0, 0.3, 0);
      add(new THREE.ConeGeometry(0.042, 1.65, 4), shared.steel, 0, 1.15, 0);
    } else if (id === 'warhammer') {
      add(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 10), shared.leather, 0, 0.65, 0);
      add(new THREE.BoxGeometry(0.9, 0.45, 0.5), shared.darkMetal, 0, 1.4, 0);
      add(new THREE.BoxGeometry(0.96, 0.09, 0.55), shared.gold, 0, 1.4, 0);
    }
    arm.userData.visuals.set(id, arm.userData.parts);
  }

  function decorateConfessor(model, illusion = false) {
    if (model.userData.confessor) return;
    model.userData.confessor = true;
    const { body, arm, shield } = model.userData;
    shield.visible = false;
    const pale = new THREE.MeshStandardMaterial({
      color: '#c0d5dd',
      metalness: 0.5,
      roughness: 0.35,
    });
    body.traverse((o) => {
      if (o.isMesh && o.material === shared.obsidian) o.material = pale;
    });
    const staff = new THREE.Group();
    staff.position.set(-0.8, 1.2, 0);
    model.userData.rig.offhand = staff;
    body.add(staff);
    mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.5, 10), shared.gold, staff, 0, 0.1, 0);
    model.userData.staffCrystal = mesh(new THREE.OctahedronGeometry(0.2), pale, staff, 0, 1.5, 0);
    model.userData.staffGlow = glow(staff, '#bceaff', 1.6, 0, 1.5, 0);
    glow(arm, '#bceaff', 1.2, 0, 1.5, 0);
    ring(body, 0.6, 0.035, 3.2, pale);
    const warning = new THREE.Group();
    scene.add(warning);
    model.userData.warning = warning;
    for (let i = 0; i < 5; i++) {
      const line = mesh(
        new THREE.PlaneGeometry(0.18, 18),
        new THREE.MeshBasicMaterial({
          color: '#9de7ff',
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        warning,
      );
      line.castShadow = false;
    }
    warning.visible = false;
    if (illusion)
      model.traverse((o) => {
        o.castShadow = false;
        o.receiveShadow = false;
      });
  }

  function confessorWarning(e, model, origin) {
    const warning = model.userData.warning;
    warning.visible = !e.dead && e.state === 'windup';
    if (!warning.visible) return;
    const aim = Math.atan2(e.target.x - origin.x, e.target.z - origin.z);
    const dirs =
      e.attackKind === 'salvo'
        ? [PI / 4, (3 * PI) / 4, (5 * PI) / 4, (7 * PI) / 4, aim]
        : [aim - 0.22, aim, aim + 0.22];
    warning.children.forEach((line, i) => {
      line.visible = i < dirs.length;
      if (!line.visible) return;
      const a = dirs[i];
      line.position.set(origin.x + Math.sin(a) * 9, 0.06, origin.z + Math.cos(a) * 9);
      line.rotation.set(-PI / 2, 0, -a);
    });
  }

  function syncIllusions(e, model) {
    const points = e.dead ? [] : e.illusions || [];
    const ghosts = (model.userData.ghosts ||= []);
    while (ghosts.length < points.length) {
      const ghost = createActor('bishop');
      decorateConfessor(ghost, true);
      ghosts.push(ghost);
    }
    ghosts.forEach((ghost, i) => {
      ghost.visible = !!points[i];
      if (!points[i]) ghost.userData.warning.visible = false;
      if (!points[i]) return;
      ghost.position.set(points[i].x, 0, points[i].z);
      ghost.rotation.y = Math.atan2(
        (e.target?.x || 0) - points[i].x,
        (e.target?.z || 0) - points[i].z,
      );
      ghost.scale.setScalar(1.35);
      bossDamageView.update(e, ghost, game.time);
      confessorWarning(e, ghost, points[i]);
      ghost.userData.tell.material.opacity = e.state === 'windup' ? 0.45 : 0;
      ghost.userData.tell.material.color.set('#a9e8ff');
    });
  }

  function decorateCastellan(model) {
    if (model.userData.boss) return;
    model.userData.boss = true;
    const body = model.userData.body,
      arm = model.userData.arm;
    arm.scale.set(1.3, 1.45, 1.3);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: '#ffb64a',
      emissive: '#ff8b17',
      emissiveIntensity: 3,
      metalness: 0.4,
      roughness: 0.15,
    });
    const core = mesh(new THREE.OctahedronGeometry(0.25, 0), coreMaterial, body, 0, 1.22, 0.51);
    const aura = glow(body, '#ffb34b', 2.3, 0, 1.22, 0.55);
    core.visible = aura.visible = false;
    model.userData.core = core;
    model.userData.coreGlow = aura;
    model.userData.armorPlates = [];
    for (let side of [-1, 1]) {
      const plate = mesh(
        new THREE.BoxGeometry(0.4, 0.9, 0.45),
        shared.darkMetal,
        body,
        side * 0.58,
        1.15,
        0,
      );
      model.userData.armorPlates.push(plate);
      plate.rotation.z = side * 0.2;
      for (let h of [0.9, 1.4])
        mesh(new THREE.ConeGeometry(0.11, 0.32, 5), shared.gold, body, side * 0.7, h, 0);
    }
    const bannerMat = new THREE.MeshStandardMaterial({
      color: '#65190f',
      side: THREE.DoubleSide,
      roughness: 1,
    });
    const banner = mesh(new THREE.PlaneGeometry(0.85, 1.7, 2, 3), bannerMat, body, 0, 1.65, -0.6);
    banner.rotation.x = 0.15;
    const warning = new THREE.Group();
    scene.add(warning);
    model.userData.warning = warning;
    const mat = new THREE.MeshBasicMaterial({
      color: '#ff6530',
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lane = mesh(new THREE.PlaneGeometry(2.6, 1), mat, warning);
    lane.rotation.x = -Math.PI / 2;
    lane.castShadow = false;
    const cross = mesh(new THREE.PlaneGeometry(2.6, 22.4), mat.clone(), warning);
    cross.rotation.x = -Math.PI / 2;
    cross.castShadow = false;
    const area = mesh(new THREE.CircleGeometry(3.8, 64), mat.clone(), warning);
    area.rotation.x = -Math.PI / 2;
    area.castShadow = false;
    const edge = mesh(new THREE.RingGeometry(3.68, 3.82, 64), mat.clone(), warning);
    edge.rotation.x = -Math.PI / 2;
    edge.castShadow = false;
    warning.userData = { lane, cross, area, edge };
    warning.visible = false;
  }

  function bossPresentation(e, model, t) {
    const { body, arm, shield, core, coreGlow, warning } = model.userData;
    core.visible = coreGlow.visible = !!e.coreOpen;
    core.rotation.y = t * 2;
    if (e.coreOpen) {
      shield.rotation.y = -1.4;
      shield.position.z = 0.05;
      body.rotation.x = 0.18;
      arm.rotation.x = 0.8;
      arm.rotation.z = -1.1;
      core.material.emissiveIntensity = 3 + Math.sin(t * 8);
    }
    if (e.state === 'stagger') {
      body.rotation.x = 0.5;
      body.position.y = -0.35;
    }
    if (e.state === 'enrage') {
      body.rotation.y = Math.sin(t * 18) * 0.035;
      core.visible = coreGlow.visible = true;
      core.material.emissiveIntensity = 5;
    }
    warning.visible = ['windup', 'attack'].includes(e.state);
    if (!warning.visible) return;
    const { lane, cross, area, edge } = warning.userData;
    lane.visible = cross.visible = area.visible = edge.visible = false;
    const progress = e.state === 'attack' ? 1 : clamp((t - e.begin) / (e.until - e.begin), 0, 1),
      opacity = 0.12 + progress * 0.28 + Math.sin(t * 15) * 0.03;
    for (const m of [lane, cross, area, edge]) {
      m.material.opacity = opacity;
      m.material.color.set(e.state === 'attack' ? '#ff3516' : '#ff9c45');
    }
    if (e.attackKind === 'charge' && e.from && e.target) {
      lane.visible = true;
      const length = Math.max(0.01, Math.hypot(e.target.x - e.from.x, e.target.z - e.from.z));
      lane.scale.set(1, length, 1);
      lane.position.set((e.target.x + e.from.x) * 0.5, 0.045, (e.target.z + e.from.z) * 0.5);
      lane.rotation.set(-PI / 2, 0, e.aim.x ? PI / 2 : 0);
    } else if (['cross', 'royalCross'].includes(e.attackKind)) {
      lane.visible = cross.visible = true;
      lane.scale.set(1, 22.4, 1);
      lane.position.set(e.attackKind === 'royalCross' ? e.target.x : e.x, 0.045, 0);
      lane.rotation.set(-PI / 2, 0, 0);
      cross.position.set(0, 0.046, e.attackKind === 'royalCross' ? e.target.z : e.z);
      cross.rotation.set(-PI / 2, 0, PI / 2);
    } else if (e.target) {
      area.visible = edge.visible = true;
      area.scale.setScalar(e.boss === 'fallenking' ? 4.5 / 3.8 : 1);
      edge.scale.setScalar(e.boss === 'fallenking' ? 4.5 / 3.8 : 1);
      area.position.set(e.target.x, 0.045, e.target.z);
      edge.position.copy(area.position);
      area.material.opacity = opacity * 0.5;
      edge.material.opacity = 0.75;
    }
    if (e.state === 'windup') {
      arm.rotation.z = -1.3 - progress * 0.8;
      arm.rotation.x = -progress * 1.2;
    } else if (e.attackKind === 'charge') {
      body.rotation.x = 0.18;
      shield.position.z = 0.85;
    } else {
      const k = (t - e.begin) % 0.8;
      arm.rotation.x = 0.8 - Math.max(0, 1 - k * 5) * 2;
      arm.rotation.z = 0.7;
    }
  }

  function syncActors() {
    for (const entity of [
      game.presentationPlayer || game.player,
      ...(game.peer ? [game.peer] : []),
    ]) {
      const old = actors.get(entity.id);
      if (old && old.userData.type !== entity.type) {
        scene.remove(old);
        if (old.userData.abilityWarning) scene.remove(old.userData.abilityWarning);
        actors.delete(entity.id);
      }
    }
    let ids = new Set(['player', ...(game.peer ? ['peer'] : []), ...game.enemies.map((e) => e.id)]);
    for (let [id, m] of actors)
      if (!ids.has(id)) {
        if (m.userData.warning) scene.remove(m.userData.warning);
        if (m.userData.abilityWarning) scene.remove(m.userData.abilityWarning);
        for (const ghost of m.userData.ghosts || []) {
          scene.remove(ghost);
          scene.remove(ghost.userData.warning);
        }
        scene.remove(m);
        actors.delete(id);
      }
    if (!actors.has('player')) {
      playerModel = createActor(game.player.type || 'pawn', true);
      actors.set('player', playerModel);
    }
    for (let e of game.enemies)
      if (!actors.has(e.id)) actors.set(e.id, createActor(e.type, !!e.isAvatar));
    for (const e of game.enemies) {
      if (e.boss === 'confessor') {
        decorateConfessor(actors.get(e.id));
        syncIllusions(e, actors.get(e.id));
      } else if (e.boss === 'fallenking') {
        const m = actors.get(e.id);
        decorateCastellan(m);
        equipWeapon(m, 'greatsword');
        m.userData.arm.scale.setScalar(1);
        if (!m.userData.royalCape) {
          m.userData.royalCape = mesh(
            new THREE.PlaneGeometry(1.4, 2.6),
            new THREE.MeshStandardMaterial({
              color: '#6e1423',
              side: THREE.DoubleSide,
              roughness: 1,
            }),
            m.userData.body,
            0,
            1.5,
            -0.7,
          );
        }
      } else if (e.boss) decorateCastellan(actors.get(e.id));
      if (e.rival && e.returning && !actors.get(e.id).userData.scar) {
        const m = actors.get(e.id);
        const scar = mesh(
          new THREE.BoxGeometry(0.06, 0.8, 0.07),
          new THREE.MeshBasicMaterial({ color: '#ce494d' }),
          m.userData.body,
          0,
          1.8,
          0.55,
        );
        scar.rotation.z = 0.5;
        m.userData.scar = scar;
      }
    }
    if (game.peer && !actors.has('peer'))
      actors.set('peer', createActor(game.peer.type || 'pawn', true));
  }

  function spawnParticles(x, z, color = '#ffb66d', count = 18, y = 1) {
    count = Math.round(
      count *
        (view.preferences?.reducedEffects
          ? 0.25
          : view.preferences?.quality === 'low' ||
              (view.mobileControlsActive && view.preferences?.mobilePerformance)
            ? 0.45
            : 1),
    );
    for (let i = 0; i < count; i++) {
      let mat = shared.particleMat;
      if (color !== '#ffb66d') mat = new THREE.MeshBasicMaterial({ color });
      let m = new THREE.Mesh(shared.particleGeo, mat);
      m.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
      scene.add(m);
      particles.push({
        m,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          Math.random() * 5 + 1,
          (Math.random() - 0.5) * 5,
        ),
        life: 0.5 + Math.random() * 0.5,
        max: 1,
      });
    }
    while (particles.length > (game.networked ? 150 : 250)) {
      let p = particles.shift();
      scene.remove(p.m);
    }
  }

  function steelSparks(
    x = game.player.x,
    z = game.player.z,
    strength = 1,
    nx = 0,
    nz = 1,
    y = 1.2,
  ) {
    if (view.preferences?.reducedEffects) strength *= 0.35;
    shared.sparkGeo ||= new THREE.BoxGeometry(0.016, 0.016, 1);
    const flash = glow(scene, '#fff5d4', 0.6 + strength * 0.2, x, y, z);
    contactFlashes.push({ sprite: flash, life: 0.075 });
    for (let i = 0; i < Math.round(12 * strength); i++) {
      const m = new THREE.Mesh(
        shared.sparkGeo,
        new THREE.MeshBasicMaterial({ color: i % 3 ? '#fff3bf' : '#ffffff', transparent: true }),
      );
      m.position.set(x, y, z);
      m.scale.z = 0.1 + Math.random() * 0.17;
      scene.add(m);
      const angle = Math.atan2(nx ?? 0, nz ?? 1) + (Math.random() - 0.5) * Math.PI * 1.4;
      sparks.push({
        m,
        v: new THREE.Vector3(
          Math.sin(angle) * (2 + Math.random() * 3),
          1 + Math.random() * 3,
          Math.cos(angle) * (2 + Math.random() * 3),
        ),
        life: 0.18 + Math.random() * 0.16,
      });
    }
    while (sparks.length > 100) {
      const s = sparks.shift();
      scene.remove(s.m);
      s.m.material.dispose();
    }
  }

  function abilityWarning(entity, model) {
    const a = entity.ability;
    if (!a) {
      if (model.userData.abilityWarning) model.userData.abilityWarning.visible = false;
      return;
    }
    let group = model.userData.abilityWarning;
    if (!group) {
      group = new THREE.Group();
      scene.add(group);
      model.userData.abilityWarning = group;
      for (let i = 0; i < 8; i++) {
        const m = mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            color: '#e5ecff',
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
          group,
        );
        m.castShadow = false;
      }
      const circle = mesh(
        new THREE.RingGeometry(2.3, 2.5, 48),
        new THREE.MeshBasicMaterial({
          color: '#e5ecff',
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        group,
      );
      circle.castShadow = false;
    }
    const clock =
      game.networked && entity.id !== 'player' ? (game.remoteTime ?? game.time) : game.time;
    group.visible = !entity.dead && clock < a.end;
    const lines = abilityGeometry(a);
    for (let i = 0; i < 8; i++) {
      const m = group.children[i],
        line = lines[i];
      m.visible = !!line;
      if (!line) continue;
      m.position.set((line.x + line.tx) * 0.5, 0.07, (line.z + line.tz) * 0.5);
      m.scale.set(
        line.width * 2,
        Math.max(0.01, Math.hypot(line.tx - line.x, line.tz - line.z)),
        1,
      );
      m.rotation.set(-PI / 2, 0, -Math.atan2(line.tx - line.x, line.tz - line.z));
      m.material.color.set(a.enemy ? '#ec5261' : '#c8e6ff');
      m.material.opacity = a.fired
        ? 0.65
        : 0.16 + Math.min(1, (clock - a.begin) / (a.fireAt - a.begin)) * 0.22;
    }
    const circle = group.children[8];
    circle.visible = ['knight', 'king'].includes(a.kind);
    circle.position.set(a.target.x, 0.07, a.target.z);
    circle.rotation.x = -PI / 2;
    circle.material.color.set(a.enemy ? '#ec5261' : '#c8e6ff');
  }

  function shockwave(x, z, large = false, color = '#ed7e32') {
    let mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    let m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), mat);
    m.rotation.x = -PI / 2;
    m.position.set(x, 0.055, z);
    scene.add(m);
    fx.push({ m, life: 0.55, age: 0, size: large ? 4.2 : 2.1 });
  }

  function resize() {
    if (!renderer) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, game.networked ? 1.25 : innerWidth < 700 ? 1.2 : 1.5),
    );
  }

  function react(id, kind, data = {}) {
    const model = actors.get(id);
    if (model) model.userData.reaction = { kind, started: view.renderTime, ...data };
  }

  function finishMotion(actorId, targetId, team = false) {
    const actor = actors.get(actorId),
      target = actors.get(targetId);
    if (
      actor &&
      !(
        actor.userData.finisher?.kind === 'team' &&
        view.renderTime - actor.userData.finisher.started < 0.1
      )
    )
      actor.userData.finisher = { kind: team ? 'team' : 'solo', started: view.renderTime };
    if (target && !team) target.userData.deathFinish = { started: view.renderTime };
  }

  function animateActor(entity, model, dt) {
    const { body, arm, shield, tell, crown, rig } = model.userData;
    abilityWarning(entity, model);
    if (entity.champion && !model.userData.championMark) {
      model.userData.championMark = glow(model, '#deb65c', 1.1, 0, 2.8, 0);
      model.userData.championMark.material.opacity = 0.65;
    }
    if (model.userData.championMark)
      model.userData.championMark.visible = !!entity.champion && !entity.dead;
    if ((entity.wardUntil > game.time || entity.championWarded) && !model.userData.wardGlow)
      model.userData.wardGlow = glow(model, '#d8e8ff', 2.6, 0, 1.1, 0);
    if (model.userData.wardGlow)
      model.userData.wardGlow.visible = entity.wardUntil > game.time || !!entity.championWarded;
    let friendly = entity.id === 'player' || entity.isAvatar,
      t = game.networked && entity.id !== 'player' ? (game.remoteTime ?? game.time) : game.time,
      visualTime = view.renderTime;
    let bScale = entity.boss
      ? ['confessor', 'fallenking'].includes(entity.boss)
        ? 1.35
        : 1.75
      : entity.type === 'queen'
        ? 1.12
        : entity.type === 'rook'
          ? 1.08
          : 1;
    if (entity.elite) bScale *= 1.08;
    if (entity.isAvatar && entity.id !== 'player' && !game.networked)
      model.position.lerp(
        new THREE.Vector3(entity.x, entity.y || 0, entity.z),
        Math.min(1, dt * 12),
      );
    else model.position.set(entity.x, entity.y || 0, entity.z);
    model.rotation.y =
      entity.isAvatar && entity.id !== 'player' && !game.networked
        ? angleLerp(model.rotation.y, entity.face, 1 - Math.exp(-dt * 14))
        : entity.face;
    model.scale.setScalar(bScale);
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    arm.position.copy(rig.rest.arm);
    arm.rotation.set(0.1, 0, -0.45);
    shield.position.copy(rig.rest.shield);
    shield.rotation.set(0, -0.18, 0);
    shield.position.z = entity.type === 'rook' ? 0.65 : 0.42;
    let moving = friendly
      ? entity.state === 'walk'
      : entity.state === 'approach' && dist(entity, game.player) > stats[entity.type].range * 0.8;
    if (moving) {
      body.position.y = Math.abs(Math.sin(visualTime * 10)) * 0.045;
      body.rotation.z = Math.sin(visualTime * 9) * 0.025;
      arm.rotation.x = Math.sin(visualTime * 7) * 0.1;
    }
    if (entity.escaped) {
      model.visible = t < (entity.until || 0);
      body.position.y = Math.max(0, 1 - (entity.until - t) / 1.2) * 0.6;
      model.position.z += Math.max(0, 1 - (entity.until - t) / 1.2) * 3;
      return;
    }
    if (friendly && entity.dead) {
      model.visible = true;
      body.visible = true;
      tell.material.opacity = 0;
      if (model.userData.deathStarted === undefined) model.userData.deathStarted = visualTime;
      const pose = fallenPose(visualTime - model.userData.deathStarted, entity.type);
      body.rotation.set(0.06, 0, pose.roll);
      body.position.set(0, pose.lift, 0);
      body.scale.setScalar(1);
      arm.rotation.set(pose.armX, 0, pose.armZ);
      arm.position.z = 0;
      if (model.userData.wardGlow) model.userData.wardGlow.visible = false;
      shield.rotation.y = 0.15;
      shield.position.z = 0.42;
      if (model.userData.trail) model.userData.trail.visible = false;
      if (model.userData.healGlow) model.userData.healGlow.visible = false;
      if (model.userData.abilityWarning) model.userData.abilityWarning.visible = false;
      model.userData.isDowned = true;
      model.userData.pose = null;
      rig.update(entity.weapon || 'longsword', 0, dt);
      return;
    }
    if (model.userData.isDowned) model.userData.riseStarted = visualTime;
    model.userData.deathStarted = undefined;
    model.userData.isDowned = false;
    let support = ['castellan', 'fallenking'].includes(entity.boss) ? 1 : 0,
      compression = 1;
    if (friendly) {
      equipWeapon(model, entity.weapon || game.weapon);
      const stance = weaponStance(entity.weapon || game.weapon, visualTime, moving);
      arm.rotation.set(stance.armX, stance.armY, stance.armZ);
      body.rotation.x += stance.bodyX;
      body.rotation.y += stance.bodyY;
      body.rotation.z += stance.bodyZ;
      body.position.y += stance.lift;
      support = stance.support;
      model.visible = !entity.dead;
      tell.material.opacity = 0;
      if (entity.state === 'attack') {
        const duration = entity.attackDuration || 0.48;
        let timeline = model.userData.attackTimeline;
        if (!timeline || timeline.token !== entity.attackAt)
          timeline = model.userData.attackTimeline = {
            token: entity.attackAt,
            started: visualTime - Math.max(0, Math.min(duration, t - entity.attackAt)),
          };
        const k = Number.isFinite(entity.visualAttackPhase)
            ? entity.visualAttackPhase
            : clamp(
                (game.networked ? visualTime - timeline.started : t - entity.attackAt) / duration,
                0,
                1,
              ),
          swing = Math.sin(k * PI),
          pose =
            entity.attackKind === 'heavy'
              ? heavyAttackPose(k, entity.weapon)
              : attackPose(k, entity.weapon, entity.combo ?? game.combo);
        arm.rotation.set(pose.x, pose.y, pose.z);
        arm.position.z = pose.reach;
        body.rotation.y = pose.twist;
        body.rotation.z = -swing * 0.08;
        if (entity.attackKind === 'heavy') {
          const weight = heavyBodyPose(k, entity.weapon);
          body.rotation.x += weight.lean;
          body.rotation.y += weight.twist;
          body.rotation.z += weight.roll;
          compression = weight.compress;
          support = weight.support;
        } else support = ['warhammer', 'spear', 'greatsword'].includes(entity.weapon) ? 1 : 0;
        shield.position.z = 0.42 - swing * 0.24;
        if (k > 0.15 && k < 0.75) {
          let trail = model.userData.trail;
          if (!trail) {
            trail = mesh(
              new THREE.RingGeometry(1.2, 1.45, 40, 1, -0.9, 2.2),
              new THREE.MeshBasicMaterial({
                color: '#ffe7a8',
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
              }),
              body,
              0,
              1.0,
              0.8,
            );
            trail.rotation.x = -PI / 2;
            trail.castShadow = false;
            model.userData.trail = trail;
          }
          trail.visible = true;
          trail.rotation.z = k * 3 - 1;
          trail.material.opacity = swing * 0.5;
        } else {
          if (model.userData.trail) model.userData.trail.visible = false;
        }
      } else {
        arm.position.z = 0;
        if (model.userData.trail) model.userData.trail.visible = false;
      }
      if (entity.state === 'block') {
        support = 0;
        shield.rotation.y = 0.8;
        shield.position.z = 0.7;
        body.rotation.x = -0.08;
        arm.rotation.z = -0.9;
      }
      if (entity.state === 'dodge') {
        support = 0;
        let k = entity.visualDodgePhase ?? clamp(1 - (entity.dodgeEnd - t) / 0.43, 0, 1);
        const roll = rollPose(k);
        arm.rotation.x = roll.armX;
        arm.rotation.z = roll.armZ;
        shield.rotation.y = roll.shieldY;
        shield.position.z = roll.shieldZ;
        body.scale.setScalar(roll.scale);
      } else body.scale.set(1, compression, 1);
      if (entity.state === 'heal') {
        support = 0;
        arm.rotation.z = -2.5;
        glowPlayer(model, true);
      } else glowPlayer(model, false);
      if (!view.preferences?.reducedEffects && t < entity.invuln && entity.state !== 'dodge')
        body.visible = Math.floor(visualTime * 20) % 2 === 0;
      else body.visible = true;
    } else {
      if (entity.dead) {
        let k = clamp((entity.until - t) / 0.8, 0, 1);
        if (model.userData.deathFinish) {
          const age = visualTime - model.userData.deathFinish.started;
          k = 1 - clamp((age - 0.3) / 0.5, 0, 1);
          body.rotation.x = Math.min(1, age / 0.4) * 0.9;
        }
        model.scale.setScalar(bScale * k);
        body.rotation.z = (1 - k) * 1.6;
        model.visible = k > 0;
        tell.material.opacity = 0;
        if (model.userData.warning) model.userData.warning.visible = false;
        for (const ghost of model.userData.ghosts || []) {
          ghost.visible = false;
          ghost.userData.warning.visible = false;
        }
        rig.update(entity.weapon || 'longsword', 0, dt);
        return;
      }
      model.visible = true;
      if (entity.state === 'windup') {
        let prog = clamp(
          1 - (entity.until - t) / (entity.windupDuration || stats[entity.type].windup),
          0,
          1,
        );
        prog = prog * prog * (3 - 2 * prog);
        tell.material.opacity = 0.25 + prog * 0.6;
        tell.material.color.set(
          entity.unblockable ? '#ff405c' : entity.elite ? '#ffcf6e' : '#ff8e32',
        );
        let sz = entity.type === 'queen' ? 4 : entity.type === 'rook' ? 3 : 1.8;
        tell.scale.setScalar(sz);
        arm.rotation.x = -1.3 * prog;
        arm.rotation.z = -0.6 - prog * 1.4;
        body.rotation.x = -0.07 * prog;
      } else if (entity.state === 'attack') {
        tell.material.opacity = 0.7;
        tell.material.color.set('#ff3b16');
        const phase = clamp((t - entity.begin) / Math.max(0.1, entity.until - entity.begin), 0, 1);
        const sweep = Math.sin(phase * PI);
        arm.rotation.x = -1.3 + 2.1 * sweep;
        arm.rotation.z = -2 + 3 * sweep;
        body.rotation.y = Math.sin(phase * PI * 2) * 0.15;
        body.rotation.x = entity.type === 'knight' ? -0.25 : 0.1 * sweep;
      } else {
        tell.material.opacity = 0;
        if (entity.state === 'recover') {
          const recovery = clamp(
            (entity.until - t) /
              Math.max(
                0.1,
                entity.until - (entity.recoverAt || entity.until - stats[entity.type].recover),
              ),
            0,
            1,
          );
          arm.rotation.x = 0.1 + 0.7 * recovery;
          body.rotation.x = 0.1 * recovery;
        }
      }
      if (entity.guarding) {
        shield.rotation.y = 0.8;
        shield.position.z = 0.72;
        arm.rotation.z = -0.9;
        tell.material.opacity = 0.12;
        tell.material.color.set('#8ebfdf');
        tell.scale.setScalar(1.1);
      }
      if (entity.state === 'stagger') {
        body.rotation.x = 0.35;
        arm.rotation.z = -1.25;
      }
      if (entity.boss) {
        tell.material.opacity = 0;
        if (entity.boss === 'confessor') {
          syncIllusions(entity, model);
          confessorWarning(entity, model, entity);
          tell.material.opacity = entity.state === 'windup' ? 0.5 : 0;
          tell.material.color.set('#a9e8ff');
          body.rotation.x = entity.coreOpen ? 0.25 : 0;
          arm.rotation.z = entity.state === 'windup' ? -1.8 : -0.45;
        } else bossPresentation(entity, model, t);
      }
      if (entity.hitUntil > t) {
        body.rotation.z = 0.12;
        if (!model.userData.hitGlow)
          model.userData.hitGlow = glow(model, '#ffe4a2', 2.1, 0, 1.1, 0);
        model.userData.hitGlow.visible = true;
      } else if (model.userData.hitGlow) model.userData.hitGlow.visible = false;
    }
    if (entity.hitUntil > t && entity.state !== 'dodge' && !entity.dead) {
      const progress = clamp((t - (entity.hitAt ?? entity.hitUntil - 0.24)) / 0.28, 0, 1);
      const recoil = Math.sin(progress * PI) * (entity.hitStrength || 0.18);
      const nx = entity.hitNX || 0,
        nz = entity.hitNZ || 0;
      const localX = nx * Math.cos(entity.face) - nz * Math.sin(entity.face),
        localZ = nx * Math.sin(entity.face) + nz * Math.cos(entity.face);
      body.rotation.x += localZ * recoil;
      body.rotation.z -= localX * recoil;
    }
    const reaction = model.userData.reaction;
    if (reaction) {
      const pose = reactionPose(reaction.kind, visualTime - reaction.started);
      if (pose.done) model.userData.reaction = null;
      else {
        shield.position.z -= pose.shieldBack;
        shield.rotation.y += pose.shieldTurn;
        body.rotation.y += pose.twist;
        body.rotation.x += pose.lean;
        arm.rotation.z += pose.slump;
        shield.position.y -= pose.slump * 0.7;
      }
    }
    const finisher = model.userData.finisher;
    if (
      finisher &&
      !entity.dead &&
      !['dodge', 'hurt', 'heal', 'ability', 'block'].includes(entity.state)
    ) {
      const age = visualTime - finisher.started,
        pose = finisherPose(finisher.kind, age);
      if (pose.done || (entity.state === 'attack' && t - entity.attackAt < 0.12 && age > 0.1))
        model.userData.finisher = null;
      else {
        arm.rotation.y += pose.twist;
        arm.position.z += pose.reach;
        body.rotation.y += pose.twist * 0.5;
        body.position.y += pose.lift;
      }
    }
    // Lean into observed movement and turns without changing authoritative position.
    const last = model.userData.motionLast;
    if (last && moving && dt > 0) {
      const vx = clamp((entity.x - last.x) / dt, -7, 7),
        vz = clamp((entity.z - last.z) / dt, -7, 7);
      body.rotation.x += (vx * Math.sin(entity.face) + vz * Math.cos(entity.face)) * 0.012;
      body.rotation.z -= (vx * Math.cos(entity.face) - vz * Math.sin(entity.face)) * 0.016;
      if (Number.isFinite(last.face)) {
        const turn = Math.atan2(
          Math.sin(entity.face - last.face),
          Math.cos(entity.face - last.face),
        );
        body.rotation.z -= clamp(turn / dt, -3, 3) * 0.015;
      }
    }
    model.userData.motionLast = { x: entity.x, z: entity.z, face: entity.face };
    // Blend the complete pose across guard, recovery and locomotion transitions.
    // The swing timeline itself stays continuous and uses a faster response.
    const target = [
      arm.rotation.x,
      arm.rotation.y,
      arm.rotation.z,
      arm.position.z,
      body.rotation.x,
      body.rotation.y,
      body.rotation.z,
      body.position.y,
      shield.rotation.y,
      shield.position.z,
      body.scale.x,
      body.scale.y,
    ];
    const prior = model.userData.pose;
    if (prior && dt > 0) {
      const k =
        1 - Math.exp(-dt * (entity.state === 'attack' || entity.state === 'dodge' ? 42 : 24));
      for (let i = 0; i < target.length; i++) {
        const angular = i < 3 || (i >= 4 && i <= 6) || i === 8;
        target[i] = angular
          ? angleLerp(prior[i], target[i], k)
          : prior[i] + (target[i] - prior[i]) * k;
      }
      arm.rotation.set(target[0], target[1], target[2]);
      arm.position.z = target[3];
      body.rotation.set(target[4], target[5], target[6]);
      body.position.y = target[7];
      shield.rotation.y = target[8];
      shield.position.z = target[9];
      body.scale.set(target[10], target[11], target[10]);
    }
    model.userData.pose = target;
    if (friendly && model.userData.riseStarted !== undefined && entity.state !== 'dodge') {
      const remaining = clamp(1 - (visualTime - model.userData.riseStarted) / 0.35, 0, 1);
      const pose = fallenPose(remaining * 0.5, entity.type);
      body.rotation.z = pose.roll;
      body.position.y = pose.lift;
      if (!remaining) model.userData.riseStarted = undefined;
    }
    if (friendly && entity.state === 'dodge') {
      const phase = entity.visualDodgePhase ?? clamp(1 - (entity.dodgeEnd - t) / 0.43, 0, 1);
      const dx = entity.dx || 0,
        dz = entity.dz || 0;
      const direction = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) - entity.face : 0;
      const roll = rollPose(phase, direction);
      const axis = (model.userData.rollAxis ||= new THREE.Vector3());
      const offset = (model.userData.rollOffset ||= new THREE.Vector3());
      const center =
        { pawn: 0.95, knight: 1.2, bishop: 1.4, rook: 1.1, queen: 1.65, king: 1.9 }[entity.type] ||
        0.95;
      body.quaternion.setFromAxisAngle(axis.set(roll.axisX, 0, roll.axisZ), roll.angle);
      body.scale.setScalar(roll.scale);
      offset.set(0, center * roll.scale, 0).applyQuaternion(body.quaternion);
      body.position.set(-offset.x, center * roll.scale + roll.lift - offset.y, -offset.z);
    }
    if (model.userData.twinBlade && entity.weapon === 'twinblades') {
      const left = model.userData.twinBlade;
      left.rotation.set(arm.rotation.x, -arm.rotation.y, -arm.rotation.z);
      left.position.z = 0.25 + arm.position.z * 0.6;
      if (entity.block) left.rotation.set(0.7, 0.4, 0.8);
    }
    rig.update(
      entity.weapon ||
        (friendly
          ? game.weapon
          : entity.boss === 'fallenking'
            ? 'greatsword'
            : entity.boss === 'castellan'
              ? 'warhammer'
              : 'longsword'),
      support,
      dt,
    );
    if (entity.boss) bossDamageView.update(entity, model, t);
  }

  function glowPlayer(m, on) {
    let gl = m.userData.healGlow;
    if (!gl && on) {
      gl = glow(m, '#ddcc84', 3, 0, 1.1, 0);
      m.userData.healGlow = gl;
    }
    if (gl) gl.visible = on;
  }

  function updateArenaMarkers() {
    const active = new Set();
    const marker = (id, geometry, color) => {
      active.add(id);
      if (!arenaMarkers.has(id)) {
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const m = new THREE.Mesh(geometry, material);
        m.rotation.x = -PI / 2;
        m.renderOrder = 2;
        scene.add(m);
        arenaMarkers.set(id, m);
      }
      return arenaMarkers.get(id);
    };
    shared.laneGeo ||= new THREE.PlaneGeometry(1.7, 30);
    shared.hazardCircleGeo ||= new THREE.CircleGeometry(1, 40);
    shared.pingGeo ||= new THREE.RingGeometry(0.45, 0.6, 32);
    shared.threatGeo ||= new THREE.PlaneGeometry(0.12, 3);
    if (game.mode === 'playing') {
      for (const h of game.hazards || []) {
        const circle = h.shape === 'circle';
        const color = ['#ffad45', '#a9dfff', '#92d89b', '#d18cda'][h.realm || 0];
        const m = marker(h.id, circle ? shared.hazardCircleGeo : shared.laneGeo, color);
        if (circle) {
          m.position.set(h.x, 0.065, h.z);
          m.scale.setScalar(h.radius);
          m.rotation.z = 0;
        } else {
          m.position.set(h.axis === 'x' ? h.lane : 0, 0.065, h.axis === 'z' ? h.lane : 0);
          m.scale.set((h.width || 0.85) / 0.85, 1, 1);
          m.rotation.z = hazardAngle(h.axis);
        }
        m.material.color.set(game.time >= h.fireAt ? '#ff3524' : color);
        m.material.opacity =
          game.time >= h.fireAt
            ? 0.7
            : 0.22 + 0.25 * clamp(1 - (h.fireAt - game.time) / 1.65, 0, 1);
      }
      for (const p of game.pings || [])
        if (p.until > game.time) {
          const m = marker('ping:' + p.seat, shared.pingGeo, '#a8e4ff');
          m.position.set(p.x, 0.1, p.z);
          m.scale.setScalar(1 + 0.16 * Math.sin(view.renderTime * 4));
          m.material.opacity = 0.8;
        }
      for (const e of game.enemies)
        if (!e.dead && !e.boss && e.state === 'windup') {
          const m = marker('threat:' + e.id, shared.threatGeo, '#ffad45');
          m.position.set(e.x + Math.sin(e.face) * 1.5, 0.07, e.z + Math.cos(e.face) * 1.5);
          m.rotation.z = e.face;
          m.material.opacity = 0.5;
        }
    }
    for (const [id, m] of arenaMarkers)
      if (!active.has(id)) {
        scene.remove(m);
        m.material.dispose();
        arenaMarkers.delete(id);
      }
  }

  function updateVisuals(dt) {
    dynamicArenaView ||= createDynamicArenaView(THREE, scene);
    dynamicArenaView.update(game);
    arenaObjectiveView ||= createArenaObjectiveView(THREE, scene, createActor);
    arenaObjectiveView.update(game);
    updateArenaMarkers();
    const quality =
      view.mobileControlsActive && view.preferences?.mobilePerformance
        ? 'low'
        : view.preferences?.quality || 'medium';
    renderer.shadowMap.enabled = quality !== 'low';
    const scale = Math.min(
      devicePixelRatio,
      quality === 'low'
        ? 1
        : game.networked
          ? 1.25
          : quality === 'high'
            ? 1.75
            : innerWidth < 700
              ? 1.2
              : 1.5,
    );
    if (lastRenderScale !== scale) {
      lastRenderScale = scale;
      renderer.setPixelRatio(scale);
    }
    const visibleEntities = new Map(
      [
        game.presentationPlayer || game.player,
        ...(game.peer ? [game.peer] : []),
        ...game.enemies,
      ].map((e) => [e.id, e]),
    );
    for (let e of visibleEntities.values()) {
      let m = actors.get(e.id);
      if (m) animateActor(e, m, dt);
    }
    for (let i = contactFlashes.length - 1; i >= 0; i--) {
      const f = contactFlashes[i];
      f.life -= dt;
      f.sprite.material.opacity = Math.max(0, f.life / 0.075);
      if (f.life <= 0) {
        scene.remove(f.sprite);
        f.sprite.material.dispose();
        contactFlashes.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        scene.remove(s.m);
        s.m.material.dispose();
        sparks.splice(i, 1);
        continue;
      }
      s.v.y -= dt * 10;
      s.m.position.addScaledVector(s.v, dt);
      s.m.lookAt(s.m.position.clone().add(s.v));
      s.m.material.opacity = Math.min(1, s.life * 5);
    }
    for (let b of game.projectiles) {
      let m = shots.get(b.id);
      if (!m) {
        m = new THREE.Group();
        mesh(
          shared.shotGeo,
          b.color ? new THREE.MeshBasicMaterial({ color: b.color }) : shared.shotMat,
          m,
        );
        glow(m, b.color || '#ff6b28', 1.5, 0, 0, 0);
        scene.add(m);
        shots.set(b.id, m);
      }
      m.position.set(b.x, 1.1, b.z);
    }
    for (let [id, m] of shots)
      if (!game.projectiles.some((b) => b.id === id)) {
        scene.remove(m);
        shots.delete(id);
      }
    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.m);
        particles.splice(i, 1);
        continue;
      }
      p.v.y -= dt * 7;
      p.m.position.addScaledVector(p.v, dt);
      p.m.scale.setScalar(Math.max(0.1, p.life));
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      let f = fx[i];
      f.age += dt;
      if (f.age > f.life) {
        scene.remove(f.m);
        f.m.geometry.dispose();
        f.m.material.dispose();
        fx.splice(i, 1);
        continue;
      }
      let k = f.age / f.life;
      f.m.scale.setScalar(0.4 + f.size * k);
      f.m.material.opacity = (1 - k) * 0.8;
    }
    for (let i = 0; i < emberPositions.length; i += 3) {
      emberPositions[i] += (Math.sin(view.renderTime * 0.4 + i) * 0.08 + 0.17) * dt;
      emberPositions[i + 1] += dt * (0.3 + (i % 7) * 0.08);
      if (emberPositions[i + 1] > 25) emberPositions[i + 1] = 0;
      if (emberPositions[i] > 36) emberPositions[i] = -36;
    }
    emberPoints.geometry.attributes.position.needsUpdate = true;
    let p = game.player,
      active = [
        'playing',
        'paused',
        'reading',
        'dead',
        'won',
        'route',
        'upgrade',
        'promotion',
        'event',
      ].includes(game.mode);
    if (active) {
      let target = game.enemies.find((e) => e.id === game.lock && !e.dead);
      view.manualOrbit = Math.max(0, (view.manualOrbit || 0) - dt);
      if (target && game.mode === 'playing' && !(view.manualOrbit > 0))
        view.yaw = angleLerp(
          view.yaw,
          Math.atan2(p.x - target.x, p.z - target.z),
          Math.min(1, dt * 3),
        );
      if (!cameraFocus) cameraFocus = new THREE.Vector3(p.x, p.y || 0, p.z);
      cameraFocus.lerp(
        new THREE.Vector3(p.x, game.networked ? 0 : p.y || 0, p.z),
        1 - Math.exp(-dt * 10),
      );
      const portraitFit =
        view.mobileControlsActive && camera.aspect < 0.8 ? Math.min(1.55, 0.8 / camera.aspect) : 1;
      let desired = new THREE.Vector3(
        cameraFocus.x + Math.sin(view.yaw) * view.zoom * portraitFit,
        cameraFocus.y + view.pitch * (portraitFit > 1 ? 1.25 : 1),
        cameraFocus.z + Math.cos(view.yaw) * view.zoom * portraitFit,
      );
      const radius = Math.hypot(desired.x, desired.z);
      if (radius > 20.3) {
        desired.x *= 20.3 / radius;
        desired.z *= 20.3 / radius;
      }
      const safe = resolveArenaCamera(
        { x: cameraFocus.x, y: 1.05, z: cameraFocus.z },
        desired,
        activeOccluders,
      );
      desired.set(safe.x, safe.y, safe.z);
      if (!cameraAim) camera.position.copy(desired);
      else camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
      const visibleCamera = resolveArenaCamera(
        { x: cameraFocus.x, y: 1.05, z: cameraFocus.z },
        camera.position,
        activeOccluders,
      );
      camera.position.set(visibleCamera.x, visibleCamera.y, visibleCamera.z);
      const aim = new THREE.Vector3(
        cameraFocus.x + (target ? (target.x - cameraFocus.x) * 0.15 : 0),
        1.05,
        cameraFocus.z + (target ? (target.z - cameraFocus.z) * 0.15 : 0),
      );
      if (!cameraAim) cameraAim = aim.clone();
      cameraAim.lerp(aim, 1 - Math.exp(-dt * 12));
      camera.lookAt(cameraAim);
      if (view.shake > 0 && !game.networked && !view.preferences?.reducedEffects) {
        camera.position.x += (Math.random() - 0.5) * view.shake;
        camera.position.y += (Math.random() - 0.5) * view.shake;
        view.shake *= Math.exp(-dt * 15);
      }
    } else {
      cameraFocus = null;
      cameraAim = null;
      let a = 0.5 + Math.sin(view.renderTime * 0.08) * 0.12;
      camera.position.set(Math.sin(a) * 24, 13, Math.cos(a) * 24);
      camera.lookAt(0, 0.8, -1);
    }
    if (view.renderTime > view.announceUntil) $('#announcement').style.opacity = 0;
    if (view.renderTime > view.statusUntil) $('#status').style.opacity = 0;
  }

  function applyTheme(theme) {
    activeRealm = { ashen: 0, frost: 1, verdant: 2, eclipse: 3 }[theme.id] || 0;
    coliseum.visible = activeRealm === 0;
    realms.set(activeRealm);
    if (emberPoints?.material?.color)
      emberPoints.material.color.set(['#ffce85', '#c4edff', '#b5e3a5', '#ce9bff'][activeRealm]);
    activeOccluders = realms.obstacles.filter((b) => b.realm === activeRealm);
    scene.background.set(theme.color);
    scene.fog.color.set(theme.fog);
    scene.children
      .filter((o) => o.isDirectionalLight && !o.castShadow)
      .forEach((o) => o.color.set(theme.light));
  }

  function applySkin(skin, which = 'player') {
    let model = actors.get(which);
    if (!model || model.userData.skin === skin.id) return;
    model.userData.skin = skin.id;
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material === shared.ivory || o.material?.userData?.avatarStone) {
        let m = shared.ivory.clone();
        m.color.set(skin.color);
        m.userData.avatarStone = true;
        o.material = m;
      }
    });
  }
  init();
  return {
    render() {
      renderer.render(scene, camera);
    },
    syncActors,
    react,
    finishMotion,
    spawnParticles,
    steelSparks,
    shockwave,
    resize,
    updateVisuals,
    applyTheme,
    applySkin,
    get renderer() {
      return renderer;
    },
    get camera() {
      return camera;
    },
    get playerModel() {
      return playerModel;
    },
  };
}
