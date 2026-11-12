import { Engine } from '@babylonjs/core/Engines/engine.js';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';

const palettes = [
  {
    sky: '#202d27',
    ground: '#384a32',
    path: '#716345',
    stone: '#667064',
    leaf: '#293e33',
    pale: '#415845',
    light: '#b3c1a2',
  },
  {
    sky: '#253641',
    ground: '#839697',
    path: '#687579',
    stone: '#556775',
    leaf: '#394c52',
    pale: '#9daeb0',
    light: '#b5d7e2',
  },
  {
    sky: '#3b2926',
    ground: '#6b4a39',
    path: '#947050',
    stone: '#51403c',
    leaf: '#49352c',
    pale: '#765141',
    light: '#d4ad8d',
  },
];
type CampOptions = {
  region: number;
  members: readonly string[];
  condition: number;
  animate: boolean;
};
const hues: Record<string, string> = {
  mara: '#5d7653',
  bram: '#815f4a',
  iona: '#9b674c',
  tomas: '#ac824a',
  nessa: '#627a78',
  edrin: '#777262',
};
const rgba = (hex: string) => Color3.FromHexString(hex);
export function buildCamp(engine: AbstractEngine, options: CampOptions) {
  const scene = new Scene(engine);
  const theme = palettes[options.region];
  const sky = rgba(theme.sky);
  scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = sky;
  scene.fogDensity = 0.032;
  const camera = new ArcRotateCamera(
    'view',
    -Math.PI * 0.58,
    Math.PI * 0.34,
    13,
    new Vector3(0, 0.15, 0),
    scene,
  );
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  const hemisphere = new HemisphericLight('dusk', new Vector3(0, 1, 0), scene);
  hemisphere.diffuse = rgba(theme.light);
  hemisphere.groundColor = rgba(theme.sky);
  hemisphere.intensity = 0.95;
  const key = new DirectionalLight('moon', new Vector3(-0.5, -1, -0.65), scene);
  key.position.set(4, 9, 5);
  key.intensity = 0.65;
  key.diffuse = rgba(theme.light);
  const ember = new PointLight('firelight', new Vector3(0.1, 0.95, -0.1), scene);
  ember.diffuse = rgba('#ff9b44');
  ember.intensity = 5.5;
  ember.range = 7.5;
  const shadows = new ShadowGenerator(512, key);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 12;
  const make = (name: string, color: string, glow?: string) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = rgba(color);
    material.specularColor = Color3.Black();
    if (glow) material.emissiveColor = rgba(glow);
    return material;
  };
  const ground = make('ground', theme.ground),
    path = make('path', theme.path),
    stone = make('stone', theme.stone);
  const leaf = make('leaf', theme.leaf),
    pale = make('pale', theme.pale),
    wood = make('wood', '#513829');
  const plank = make('plank', options.condition > 35 ? '#92724a' : '#6f4e39');
  const metal = make('iron', '#302b28'),
    canvasCloth = make('cloth', '#b99b72'),
    skin = make('skin', '#bd8864');
  const flameA = make('fire', '#ff9e37', '#cc5015'),
    flameB = make('fire-core', '#ffcc65', '#f4a530');
  const set = (
    mesh: ReturnType<typeof CreateBox>,
    m: StandardMaterial,
    x: number,
    y: number,
    z: number,
    cast = true,
  ) => {
    mesh.position.set(x, y, z);
    mesh.material = m;
    if (cast) shadows.addShadowCaster(mesh);
    return mesh;
  };
  const box = (
    n: string,
    m: StandardMaterial,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    cast = true,
  ) => set(CreateBox(n, { width: w, height: h, depth: d }, scene), m, x, y, z, cast);
  const cylinder = (
    n: string,
    m: StandardMaterial,
    x: number,
    y: number,
    z: number,
    height: number,
    bottom: number,
    top: number,
    sides = 7,
    cast = true,
  ) =>
    set(
      CreateCylinder(
        n,
        { height, diameterTop: top, diameterBottom: bottom, tessellation: sides },
        scene,
      ),
      m,
      x,
      y,
      z,
      cast,
    );
  const globe = (
    n: string,
    m: StandardMaterial,
    x: number,
    y: number,
    z: number,
    d: number,
    cast = true,
  ) => set(CreateSphere(n, { diameter: d, segments: 5 }, scene), m, x, y, z, cast);
  const turf = set(
    CreateGround('turf', { width: 44, height: 37 }, scene),
    ground,
    0,
    -0.05,
    0,
    false,
  );
  turf.receiveShadows = true;
  const clearing = cylinder('clearing', path, 0, -0.027, 0, 0.03, 12, 12, 12, false);
  clearing.scaling.z = 0.66;
  clearing.receiveShadows = true;
  let seed = 229 + options.region * 71;
  const roll = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 33; i++) {
    const x = (roll() - 0.5) * 27,
      z = (roll() - 0.28) * 15;
    if (Math.abs(x) < 5.5 && Math.abs(z) < 4.1) continue;
    if (options.region === 2) {
      const rock = globe('basalt', stone, x, 0.18, z, 0.6 + roll() * 2, false);
      rock.scaling.set(1.1, 0.46 + roll() * 0.4, 1.2);
      if (i % 5 === 0) cylinder('stump', wood, x, 0.7, z, 1.65, 0.35, 0.13, 5, false);
    } else {
      const size = 0.95 + roll() * 1.85;
      cylinder('trunk', wood, x, size * 0.34, z, size * 0.68, size * 0.13, size * 0.08, 5, false);
      for (let n = 0; n < 3; n++)
        cylinder(
          'pine',
          n === 2 ? pale : leaf,
          x,
          size * (0.66 + n * 0.27),
          z,
          size * 0.69,
          size * (0.65 - n * 0.125),
          0.03,
          5,
          false,
        );
    }
  }
  for (let i = 0; i < 30; i++) {
    const x = (roll() - 0.5) * 13,
      z = (roll() - 0.5) * 8;
    if (Math.hypot(x, z) < 1.2 || (x < -1 && z > 0)) continue;
    const pebble = globe(
      'gravel',
      i % 3 === 0 ? pale : stone,
      x,
      0.03,
      z,
      0.1 + roll() * 0.23,
      false,
    );
    pebble.scaling.y = 0.42;
  }
  // A wagon is built from box planks, a semicircular canvas roof and spoked wheels.
  const wagon = new TransformNode('wagon', scene);
  wagon.position.set(-2.4, 0, 0.8);
  wagon.rotation.y = -0.21;
  box('wagon bed', plank, 0, 0.71, 0, 1.35, 0.18, 2.5).parent = wagon;
  for (const side of [-1, 1]) {
    box('sideboard', wood, side * 0.65, 0.98, 0, 0.12, 0.45, 2.45).parent = wagon;
    box('side rail', plank, side * 0.73, 1.22, 0, 0.08, 0.1, 2.58).parent = wagon;
    for (const axle of [-0.83, 0.83]) {
      const wheel = cylinder('wheel', metal, side * 0.81, 0.45, axle, 0.13, 0.87, 0.87, 12);
      wheel.rotation.z = Math.PI / 2;
      wheel.parent = wagon;
      const hub = cylinder('hub', plank, side * 0.89, 0.45, axle, 0.15, 0.25, 0.25, 8);
      hub.rotation.z = Math.PI / 2;
      hub.parent = wagon;
      for (let n = 0; n < 4; n++) {
        const spoke = box('spoke', plank, side * 0.89, 0.45, axle, 0.038, 0.71, 0.045, false);
        spoke.rotation.x = (n * Math.PI) / 4;
        spoke.parent = wagon;
      }
    }
    box('tongue', plank, side * 0.41, 0.73, -1.72, 0.09, 0.09, 1.25).parent = wagon;
  }
  for (let i = 0; i < 7; i++) {
    const angle = ((i + 0.5) * Math.PI) / 7;
    const roof = box(
      'canvas roof',
      canvasCloth,
      Math.cos(angle) * 0.71,
      1.2 + Math.sin(angle) * 0.67,
      0.14,
      0.34,
      0.08,
      2.16,
    );
    roof.rotation.z = angle - Math.PI / 2;
    roof.parent = wagon;
  }
  for (let i = 0; i < 3; i++) {
    const pack = box(
      'baggage',
      i % 2 === 0 ? wood : plank,
      -3.75 + i * 0.48,
      0.2,
      -0.95 + i * 0.3,
      0.38,
      0.4,
      0.42,
    );
    pack.rotation.y = 0.3 * i;
  }
  box('bench', wood, 1.4, 0.34, 0.78, 1.23, 0.16, 0.32);
  box('bench legs', wood, 1.04, 0.16, 0.78, 0.13, 0.29, 0.24);
  box('bench legs', wood, 1.79, 0.16, 0.78, 0.13, 0.29, 0.24);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    const rock = globe('fire ring', stone, Math.cos(a) * 0.61, 0.06, Math.sin(a) * 0.49, 0.27);
    rock.scaling.y = 0.55;
  }
  for (let i = 0; i < 3; i++)
    box('firewood', wood, 0, 0.08 + i * 0.05, 0, 0.82, 0.11, 0.16).rotation.y = (i * Math.PI) / 3;
  const tongues = Array.from({ length: 5 }, (_, i) => {
    const a = (i * Math.PI * 2) / 5;
    return cylinder(
      'flame',
      i % 2 === 0 ? flameA : flameB,
      Math.cos(a) * 0.16,
      0.37,
      Math.sin(a) * 0.12,
      0.6,
      0.3,
      0,
      5,
      false,
    );
  });
  const sparks = Array.from({ length: 10 }, (_, i) =>
    globe('ember', flameB, 0, 0.4 + i * 0.1, 0, 0.034, false),
  );
  const stations = [
    [1.65, -0.63],
    [0.75, 1.42],
    [-0.35, -1.65],
    [2.45, 1.02],
    [-0.2, 2.1],
  ];
  const figures = options.members.map((id, i) => {
    const [x, z] = stations[i];
    const person = new TransformNode('traveler', scene);
    person.position.set(x, 0, z);
    person.rotation.y = Math.atan2(-x, -z);
    const cloak = make(id, hues[id] ?? '#8f7158');
    cylinder('cloak', cloak, 0, 0.42, 0, 0.55, 0.44, 0.25, 6).parent = person;
    globe('head', skin, 0, 0.83, 0, 0.25).parent = person;
    globe('hood', cloak, 0, 0.9, -0.042, 0.26).parent = person;
    for (const side of [-1, 1])
      box('boot', metal, side * 0.105, 0.09, 0.07, 0.13, 0.17, 0.22).parent = person;
    return person;
  });
  const size = (ratio: number) => {
    const half = ratio < 1.5 ? 3.65 : 3.35;
    camera.orthoLeft = -half * ratio;
    camera.orthoRight = half * ratio;
    camera.orthoTop = half;
    camera.orthoBottom = -half;
  };
  const animate = (t: number) => {
    ember.intensity = 5.3 + Math.sin(t * 9) * 0.45 + Math.sin(t * 23) * 0.3;
    tongues.forEach((mesh, i) => {
      mesh.scaling.y = 0.74 + 0.32 * Math.sin(t * 6 + i) + 0.17 * Math.cos(t * 13 + i);
      mesh.rotation.z = 0.16 * Math.sin(t * 3 + i);
    });
    sparks.forEach((mesh, i) => {
      const life = (t * 0.55 + i * 0.111) % 1;
      mesh.position.set(
        Math.sin(t * 2 + i) * life * 0.58,
        0.25 + life * 1.8,
        Math.cos(t * 1.5 + i) * life * 0.34,
      );
      mesh.scaling.setAll(Math.max(0.07, 1 - life));
    });
    figures.forEach((mesh, i) => {
      mesh.rotation.z = 0.025 * Math.sin(t * 1.5 + i);
      mesh.position.y = 0.025 * Math.sin(t * 1.7 + i);
    });
  };
  return { scene, size, animate };
}
export function mountCamp(canvas: HTMLCanvasElement, options: CampOptions) {
  if (!Engine.isSupported()) throw Error('WebGL unavailable');
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  let observer: ResizeObserver | undefined;
  try {
    engine.renderEvenInBackground = false;
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    const camp = buildCamp(engine, options);
    const resize = () => {
      engine.resize();
      camp.size(canvas.clientWidth / Math.max(1, canvas.clientHeight));
      if (!options.animate) camp.scene.render();
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const start = performance.now();
    if (options.animate)
      engine.runRenderLoop(() => {
        camp.animate((performance.now() - start) / 1000);
        camp.scene.render();
      });
    return () => {
      observer?.disconnect();
      engine.stopRenderLoop();
      camp.scene.dispose();
      engine.dispose();
    };
  } catch (error) {
    observer?.disconnect();
    engine.dispose();
    throw error;
  }
}
