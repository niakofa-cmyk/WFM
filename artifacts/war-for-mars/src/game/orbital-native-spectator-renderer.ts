import type { ShipId } from "./ships";
import { buildOrbitalNativeShipGeometry } from "./orbital-native-ship-geometry";

export type NativeSpectatorContact = {
  x: number;
  z: number;
  yaw: number;
  shipId: ShipId;
  team: 0 | 1;
  alive: boolean;
  health: number;
  velocity?: { x: number; y: number; z: number };
};

export type NativeSpectatorState = {
  contacts: NativeSpectatorContact[];
  receivedAt?: number;
};

export type NativeSpectatorRenderer = {
  render(state: NativeSpectatorState): void;
  dispose(): void;
};

export const ORBITAL_ENGINE_TRAIL_MAX_CONTACTS = 64;
const TRAIL_FLOATS_PER_VERTEX = 6;
const TRAIL_VERTICES_PER_CONTACT = 2;
const SPECTATOR_TEAM_COLORS: Record<0 | 1, readonly [number, number, number]> = {
  0: [0.88, 0.56, 0.24],
  1: [0.28, 0.64, 0.94],
};

/** Writes one deterministic, presentation-only exhaust line into a reused buffer. */
export function writeOrbitalEngineTrail(
  contact: NativeSpectatorContact,
  target: Float32Array,
  vertexOffset: number,
): number {
  const offset = vertexOffset * TRAIL_FLOATS_PER_VERTEX;
  if (!contact.alive || offset < 0 || offset + TRAIL_FLOATS_PER_VERTEX * TRAIL_VERTICES_PER_CONTACT > target.length ||
      !Number.isFinite(contact.x) || !Number.isFinite(contact.z) || !Number.isFinite(contact.yaw)) return 0;

  const vx = Number.isFinite(contact.velocity?.x) ? contact.velocity!.x : 0;
  const vz = Number.isFinite(contact.velocity?.z) ? contact.velocity!.z : 0;
  const speed = Math.hypot(vx, vz);
  const directionX = speed > 0.05 ? vx / speed : Math.sin(contact.yaw);
  const directionZ = speed > 0.05 ? vz / speed : Math.cos(contact.yaw);
  const nozzleX = contact.x - directionX * 3.5;
  const nozzleZ = contact.z - directionZ * 3.5;
  const trailLength = Math.max(3, Math.min(24, 3 + speed * 0.75));
  const tailX = nozzleX - directionX * trailLength;
  const tailZ = nozzleZ - directionZ * trailLength;
  const color = SPECTATOR_TEAM_COLORS[contact.team];
  target[offset] = nozzleX;
  target[offset + 1] = 0.18;
  target[offset + 2] = nozzleZ;
  target[offset + 3] = color[0] * 0.9;
  target[offset + 4] = color[1] * 0.9;
  target[offset + 5] = color[2] * 0.9;
  target[offset + 6] = tailX;
  target[offset + 7] = 0.18;
  target[offset + 8] = tailZ;
  target[offset + 9] = color[0] * 0.16;
  target[offset + 10] = color[1] * 0.16;
  target[offset + 11] = color[2] * 0.16;
  return TRAIL_VERTICES_PER_CONTACT;
}

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
  float lighting = 0.68 + 0.32 * max(0.0, normalize(vec3(0.25, 0.9, 0.4)).y);
  outColor = vec4(vColor * lighting, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate Orbital spectator shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) ?? "Orbital spectator shader failed.";
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      out[column * 4 + row] =
        a[row]! * b[column * 4]! +
        a[4 + row]! * b[column * 4 + 1]! +
        a[8 + row]! * b[column * 4 + 2]! +
        a[12 + row]! * b[column * 4 + 3]!;
    }
  }
  return out;
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, near * far * 2 * range, 0,
  ]);
}

function normalize(vector: readonly number[]): [number, number, number] {
  const length = Math.hypot(vector[0]!, vector[1]!, vector[2]!) || 1;
  return [vector[0]! / length, vector[1]! / length, vector[2]! / length];
}

function cross(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
}

function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

function lookAt(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
): Float32Array {
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

function shipTransform(contact: NativeSpectatorContact): Float32Array {
  const c = Math.cos(contact.yaw);
  const s = Math.sin(contact.yaw);
  const translation = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
    contact.x, 0, contact.z, 1,
  ]);
  const rotation = new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
  const scale = new Float32Array([
    3.1, 0, 0, 0, 0, 3.1, 0, 0, 0, 0, 3.1, 0, 0, 0, 0, 1,
  ]);
  return multiply(multiply(translation, rotation), scale);
}

/** Read-only WebGL2 3D projection of the server's anonymous 5v5 snapshot. */
export function createOrbitalNativeSpectatorRenderer(
  canvas: HTMLCanvasElement,
): NativeSpectatorRenderer {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "low-power" });
  if (!gl) throw new Error("WebGL2 is unavailable for the native spectator view.");
  const context: WebGL2RenderingContext = gl;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to allocate Orbital spectator program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program) ?? "Orbital spectator program failed.";
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error(error);
  }
  const position = gl.getAttribLocation(program, "aPosition");
  const color = gl.getAttribLocation(program, "aColor");
  const mvp = gl.getUniformLocation(program, "uMvp");
  const buffers = new Map<string, WebGLBuffer>();
  const geometries = new Map<string, Float32Array>();
  const trailBuffer = context.createBuffer();
  if (!trailBuffer) {
    context.deleteProgram(program);
    context.deleteShader(vertex);
    context.deleteShader(fragment);
    throw new Error("Unable to allocate Orbital engine-trail buffer.");
  }
  const trailVertices = new Float32Array(
    ORBITAL_ENGINE_TRAIL_MAX_CONTACTS * TRAIL_VERTICES_PER_CONTACT * TRAIL_FLOATS_PER_VERTEX,
  );
  context.bindBuffer(context.ARRAY_BUFFER, trailBuffer);
  context.bufferData(context.ARRAY_BUFFER, trailVertices.byteLength, context.DYNAMIC_DRAW);

  function getBuffer(shipId: ShipId, team: 0 | 1): { buffer: WebGLBuffer; geometry: Float32Array } {
    const key = `${shipId}:${team}`;
    let buffer = buffers.get(key);
    let geometry = geometries.get(key);
    if (!buffer || !geometry) {
      buffer = context.createBuffer() ?? undefined;
      if (!buffer) throw new Error("Unable to allocate native spectator hull buffer.");
      geometry = buildOrbitalNativeShipGeometry(shipId, SPECTATOR_TEAM_COLORS[team]);
      buffers.set(key, buffer);
      geometries.set(key, geometry);
      context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.bufferData(context.ARRAY_BUFFER, geometry, context.STATIC_DRAW);
    }
    return { buffer, geometry };
  }

  return {
    render(state) {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0.018, 0.026, 0.046, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(program);
      const projection = perspective(Math.PI / 3, width / height, 0.1, 600);
      const view = lookAt([0, 150, 178], [0, 0, 0]);
      const viewProjection = multiply(projection, view);
      const elapsed = state.receivedAt === undefined
        ? 0
        : Math.min(5, Math.max(0, (Date.now() - state.receivedAt) / 1000));
      let trailVertexCount = 0;
      for (const contact of state.contacts) {
        if (!contact.alive || !Number.isFinite(contact.x) || !Number.isFinite(contact.z) ||
            !Number.isFinite(contact.yaw) || !Number.isFinite(contact.health)) continue;
        const { buffer, geometry } = getBuffer(contact.shipId, contact.team);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(position);
        gl.enableVertexAttribArray(color);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 24, 12);
        const interpolated = {
          ...contact,
          x: contact.x + (contact.velocity?.x ?? 0) * elapsed,
          z: contact.z + (contact.velocity?.z ?? 0) * elapsed,
        };
        if (trailVertexCount < ORBITAL_ENGINE_TRAIL_MAX_CONTACTS * TRAIL_VERTICES_PER_CONTACT) {
          trailVertexCount += writeOrbitalEngineTrail(interpolated, trailVertices, trailVertexCount);
        }
        gl.uniformMatrix4fv(mvp, false, multiply(viewProjection, shipTransform(interpolated)));
        gl.drawArrays(gl.TRIANGLES, 0, geometry.length / 6);
      }
      if (trailVertexCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, trailVertices);
        gl.enableVertexAttribArray(position);
        gl.enableVertexAttribArray(color);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 24, 12);
        gl.uniformMatrix4fv(mvp, false, viewProjection);
        gl.drawArrays(gl.LINES, 0, trailVertexCount);
      }
    },
    dispose() {
      for (const buffer of buffers.values()) gl.deleteBuffer(buffer);
      buffers.clear();
      geometries.clear();
      gl.deleteBuffer(trailBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
