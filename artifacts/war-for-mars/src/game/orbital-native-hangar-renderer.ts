import type { Faction, ShipId } from "./ships";
import { buildOrbitalNativeShipGeometry } from "./orbital-native-ship-geometry";

type HangarInspectionView = "hull" | "engines" | "weapons";
type HangarDamageState = "intact" | "field" | "critical";

type Matrix = Float32Array;
type Vec3 = readonly [number, number, number];

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aColor;
uniform mat4 uMvp;
out vec3 vColor;
void main() {
  gl_Position = uMvp * vec4(aPosition, 1.0);
  vColor = aColor;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main() {
  float light = 0.72 + 0.28 * max(0.0, normalize(vec3(-0.35, 0.8, 0.55)).y);
  outColor = vec4(vColor * light, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Orbital hangar could not allocate a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader compilation error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function perspective(aspect: number, fovDegrees: number): Matrix {
  const near = 0.1, far = 100;
  const f = 1 / Math.tan(fovDegrees * Math.PI / 360);
  return new Float32Array([
    f / Math.max(.1, aspect), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]);
}

function normalize(v: Vec3): [number, number, number] {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3, b: Vec3): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lookAt(eye: Vec3, target: Vec3): Matrix {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function rotateY(yaw: number): Matrix {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function rotateX(pitch: number): Matrix {
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function translation(x: number, y: number, z: number): Matrix {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
}

function scaling(amount: number): Matrix {
  return new Float32Array([amount,0,0,0, 0,amount,0,0, 0,0,amount,0, 0,0,0,1]);
}

function hangarDeckGeometry(accent: readonly [number, number, number]): Float32Array {
  const vertices: number[] = [];
  const triangle = (a: Vec3, b: Vec3, c: Vec3, color: readonly number[]) => {
    for (const p of [a, b, c]) vertices.push(p[0], p[1], p[2], color[0]!, color[1]!, color[2]!);
  };
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: readonly number[]) => {
    triangle(a, b, c, color);
    triangle(a, c, d, color);
  };

  const deckY = -1.88;
  for (let i = 0; i < 64; i++) {
    const a0 = i * Math.PI * 2 / 64, a1 = (i + 1) * Math.PI * 2 / 64;
    const p0: Vec3 = [Math.cos(a0) * 4.2, deckY, Math.sin(a0) * 4.2];
    const p1: Vec3 = [Math.cos(a1) * 4.2, deckY, Math.sin(a1) * 4.2];
    triangle([0, deckY, 0], p0, p1, [.08, .11, .15]);
    for (const [radius, width, color] of [
      [3.88, .025, accent],
      [3.38, .012, [.34, .4, .44]],
      [2.9, .01, [.2, .26, .31]],
    ] as const) {
      const inner = radius - width, outer = radius + width;
      const point = (r: number, a: number): Vec3 => [Math.cos(a) * r, deckY + .015, Math.sin(a) * r];
      quad(point(inner, a0), point(outer, a0), point(outer, a1), point(inner, a1), color);
    }
  }

  const addBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: readonly number[]) => {
    const p = (dx: number, dy: number, dz: number): Vec3 => [x + dx * sx / 2, y + dy * sy / 2, z + dz * sz / 2];
    const a=p(-1,-1,-1), b=p(1,-1,-1), c=p(1,1,-1), d=p(-1,1,-1);
    const e=p(-1,-1,1), f=p(1,-1,1), g=p(1,1,1), h=p(-1,1,1);
    quad(a,b,c,d,color); quad(f,e,h,g,color); quad(e,a,d,h,color);
    quad(b,f,g,c,color); quad(d,c,g,h,color); quad(e,f,b,a,color);
  };
  addBox(-4.45, -.65, -1.6, .24, 2.6, .34, [.16,.21,.27]);
  addBox(4.45, -.65, -1.6, .24, 2.6, .34, [.16,.21,.27]);
  addBox(0, .56, -2.7, 8.8, .16, .28, [.13,.18,.23]);
  addBox(-3.2, -.22, -2.52, .035, .035, .04, accent);
  addBox(3.2, -.22, -2.52, .035, .035, .04, accent);
  return new Float32Array(vertices);
}

function rgb(faction: Faction, damage: HangarDamageState): [number, number, number] {
  if (damage === "critical") return [1, .26, .16];
  if (damage === "field") return faction === "accord" ? [.65, .38, .18] : [.27, .51, .68];
  return faction === "accord" ? [1, .62, .26] : [.34, .76, 1];
}

export type NativeHangarFrame = {
  yaw: number;
  pitch: number;
  view: HangarInspectionView;
  damage: HangarDamageState;
  elapsedMs: number;
};

export type OrbitalNativeHangarRenderer = {
  render(frame: NativeHangarFrame): void;
  dispose(): void;
};

/** Orbital-owned WebGL2 presentation renderer for the hangar; no Three.js scene or dependency. */
export function createOrbitalNativeHangarRenderer(
  canvas: HTMLCanvasElement,
  shipId: ShipId,
  faction: Faction,
): OrbitalNativeHangarRenderer {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "low-power" });
  if (!gl) throw new Error("WebGL2 is unavailable for the Orbital hangar display.");
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Orbital hangar could not allocate its render program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Orbital hangar program failed to link.";
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error(message);
  }

  const position = gl.getAttribLocation(program, "aPosition");
  const color = gl.getAttribLocation(program, "aColor");
  const mvp = gl.getUniformLocation(program, "uMvp");
  if (position < 0 || color < 0 || !mvp) throw new Error("Orbital hangar shader attributes are incomplete.");
  const deckBuffer = gl.createBuffer();
  if (!deckBuffer) throw new Error("Orbital hangar could not allocate its deck buffer.");
  const deckGeometry = hangarDeckGeometry(faction === "accord" ? [1,.55,.2] : [.28,.64,.96]);
  gl.bindBuffer(gl.ARRAY_BUFFER, deckBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, deckGeometry, gl.STATIC_DRAW);
  const shipBuffers = new Map<HangarDamageState, { buffer: WebGLBuffer; geometry: Float32Array }>();
  let disposed = false;

  const getShip = (damage: HangarDamageState) => {
    let entry = shipBuffers.get(damage);
    if (!entry) {
      const geometry = buildOrbitalNativeShipGeometry(shipId, rgb(faction, damage));
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Orbital hangar could not allocate the ship buffer.");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
      entry = { buffer, geometry };
      shipBuffers.set(damage, entry);
    }
    return entry;
  };

  const draw = (buffer: WebGLBuffer, geometry: Float32Array, matrix: Matrix, primitive = gl.TRIANGLES) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 24, 12);
    gl.uniformMatrix4fv(mvp, false, matrix);
    gl.drawArrays(primitive, 0, geometry.length / 6);
  };

  return {
    render(frame) {
      if (disposed) return;
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(program);

      const viewSpec = frame.view === "engines"
        ? { eye: [-.2, .85, -6.8] as Vec3, target: [0, -.55, -.95] as Vec3, fov: 34 }
        : frame.view === "weapons"
          ? { eye: [.2, 1.2, 6.7] as Vec3, target: [0, -.35, .3] as Vec3, fov: 35 }
          : { eye: [5.5, 3.6, 8.4] as Vec3, target: [0, -.35, 0] as Vec3, fov: 41 };
      const viewProjection = multiply(
        perspective(width / height, viewSpec.fov),
        lookAt(viewSpec.eye, viewSpec.target),
      );
      draw(deckBuffer, deckGeometry, viewProjection);

      const idleFloat = frame.view === "hull" ? Math.sin(frame.elapsedMs * .0007) * .025 : 0;
      const model = multiply(
        translation(0, -1.15 + idleFloat, 0),
        multiply(rotateY(frame.yaw), multiply(rotateX(frame.pitch), scaling(1.08))),
      );
      const ship = getShip(frame.damage);
      draw(ship.buffer, ship.geometry, multiply(viewProjection, model));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteBuffer(deckBuffer);
      for (const entry of shipBuffers.values()) gl.deleteBuffer(entry.buffer);
      shipBuffers.clear();
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
