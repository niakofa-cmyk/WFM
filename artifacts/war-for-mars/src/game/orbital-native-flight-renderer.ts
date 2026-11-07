import type { FlightSector, FlightState } from "./flight-sector";
import { rotate } from "@workspace/orbital-sim";

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aOffset;
in float aScale;
in vec3 aTint;
uniform mat4 uViewProjection;
uniform mat4 uModel;
uniform bool uIsInstance;
out vec3 vNormal;
out vec3 vTint;
void main() {
  vec3 worldPosition;
  if (uIsInstance) {
    worldPosition = aOffset + aPosition * aScale;
    vNormal = normalize(aPosition);
  } else {
    vec4 world = uModel * vec4(aPosition, 1.0);
    worldPosition = world.xyz;
    vNormal = normalize(mat3(uModel) * aPosition);
  }
  vTint = aTint;
  gl_Position = uViewProjection * vec4(worldPosition, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vTint;
uniform int uMaterial;
out vec4 outColor;
void main() {
  vec3 normal = normalize(vNormal);
  float light = 0.36 + 0.64 * max(dot(normal, normalize(vec3(-0.45, 0.7, 1.0))), 0.0);
  float facets = sin(normal.x * 13.0 + sin(normal.z * 9.0)) * sin(normal.y * 17.0 + normal.z * 5.0);
  if (uMaterial == 0) {
    vec3 rock = mix(vec3(0.10, 0.12, 0.15), vec3(0.55, 0.40, 0.28), 0.52 + facets * 0.31);
    outColor = vec4(rock * vTint * light, 1.0);
  } else if (uMaterial == 1) {
    outColor = vec4(vTint * (0.72 + 0.28 * max(normal.z, 0.0)), 1.0);
  } else if (uMaterial == 2) {
    float band = smoothstep(0.42, 0.88, abs(normal.y) + abs(facets) * 0.18);
    outColor = vec4(vTint * (0.48 + band * 0.52) * light, 1.0);
  } else {
    outColor = vec4(vTint, 1.0);
  }
}`;

const FIGHTER_VERTICES = new Float32Array([
   0, 0.06, -3.6,  -0.52, 0, -0.15,   0.52, 0, -0.15,
   0, 0.06, -3.6,   0.52, 0, -0.15,   0, -0.2, 0.9,
  -0.52, 0, -0.15, -3.2, 0, 0.8,      -0.55, 0, 0.55,
  -0.55, 0, 0.55,  -3.2, 0, 0.8,       0, 0, 1.5,
   0.52, 0, -0.15,   0.55, 0, 0.55,     3.2, 0, 0.8,
   0.55, 0, 0.55,   0, 0, 1.5,          3.2, 0, 0.8,
  -0.55, 0, 0.55,   0, 0, 1.5,          0, -0.2, 0.9,
   0.55, 0, 0.55,   0, -0.2, 0.9,       0, 0, 1.5,
   0, 0.06, -3.6,   0, 0.1, 0.35,       0.52, 0, -0.15,
   0, 0.06, -3.6,  -0.52, 0, -0.15,     0, 0.1, 0.35,
]);

type Vec3 = { x: number; y: number; z: number };
type Quaternion = [number, number, number, number];
type RendererOptions = { canvas: HTMLCanvasElement; sector: FlightSector; factionColor: [number, number, number] };
export type OrbitalNativeFlightRenderer = {
  render(state: FlightState): void;
  dispose(): void;
};

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Orbital renderer could not allocate a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader compilation error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createSphere(rows = 12, columns = 18) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const latitude = Math.PI * (row / rows - 0.5);
    const ring = Math.cos(latitude);
    const y = Math.sin(latitude);
    for (let column = 0; column <= columns; column++) {
      const longitude = column / columns * Math.PI * 2;
      positions.push(ring * Math.sin(longitude), y, ring * Math.cos(longitude));
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

function normalizedQuaternion(q: Quaternion): Quaternion {
  const length = Math.hypot(...q) || 1;
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

function transformMatrix(position: Vec3, orientation: Quaternion, scale: number): Float32Array {
  const [x, y, z, w] = normalizedQuaternion(orientation);
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return new Float32Array([
    (1 - 2 * (yy + zz)) * scale, (2 * (xy + wz)) * scale, (2 * (xz - wy)) * scale, 0,
    (2 * (xy - wz)) * scale, (1 - 2 * (xx + zz)) * scale, (2 * (yz + wx)) * scale, 0,
    (2 * (xz + wy)) * scale, (2 * (yz - wx)) * scale, (1 - 2 * (xx + yy)) * scale, 0,
    position.x, position.y, position.z, 1,
  ]);
}

function viewMatrix(position: Vec3, orientation: Quaternion): Float32Array {
  const [x, y, z, w] = normalizedQuaternion([-orientation[0], -orientation[1], -orientation[2], orientation[3]]);
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  const matrix = new Float32Array([
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
    0, 0, 0, 1,
  ]);
  matrix[12] = -(matrix[0]! * position.x + matrix[4]! * position.y + matrix[8]! * position.z);
  matrix[13] = -(matrix[1]! * position.x + matrix[5]! * position.y + matrix[9]! * position.z);
  matrix[14] = -(matrix[2]! * position.x + matrix[6]! * position.y + matrix[10]! * position.z);
  return matrix;
}

function perspectiveMatrix(aspect: number, fovDegrees = 68): Float32Array {
  const near = 0.1, far = 5000;
  const f = 1 / Math.tan(fovDegrees * Math.PI / 360);
  return new Float32Array([
    f / Math.max(0.1, aspect), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]);
}

function multiplyMatrix(a: Float32Array, b: Float32Array): Float32Array {
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

function asteroidInstances(sector: FlightSector): Float32Array {
  const data = new Float32Array(sector.rocks.length * 7);
  sector.rocks.forEach((rock, index) => {
    const offset = index * 7;
    const shade = 0.82 + ((index * 37) % 17) / 100;
    data[offset] = rock.position.x;
    data[offset + 1] = rock.position.y;
    data[offset + 2] = rock.position.z;
    data[offset + 3] = rock.radius;
    data[offset + 4] = shade;
    data[offset + 5] = shade * 0.95;
    data[offset + 6] = shade * 0.83;
  });
  return data;
}

export function createOrbitalNativeFlightRenderer({
  canvas,
  sector,
  factionColor,
}: RendererOptions): OrbitalNativeFlightRenderer {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "low-power" });
  if (!gl) throw new Error("WebGL2 is unavailable in this browser.");

  let program: WebGLProgram | null = null;
  let vertexShader: WebGLShader | null = null;
  let fragmentShader: WebGLShader | null = null;
  const buffers: WebGLBuffer[] = [];
  let disposed = false;
  let resizeObserver: ResizeObserver | null = null;
  const sphere = createSphere();
  const instances = asteroidInstances(sector);
  const projectileInstances = new Float32Array(2048 * 7);

  try {
    vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram();
    if (!program) throw new Error("Orbital renderer could not allocate a program.");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    vertexShader = null;
    fragmentShader = null;
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Unknown shader link error.");
    }

    const positionBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const instanceBuffer = gl.createBuffer();
    const shipBuffer = gl.createBuffer();
    const projectileBuffer = gl.createBuffer();
    if (!positionBuffer || !indexBuffer || !instanceBuffer || !shipBuffer || !projectileBuffer) {
      throw new Error("Orbital renderer could not allocate scene buffers.");
    }
    buffers.push(positionBuffer, indexBuffer, instanceBuffer, shipBuffer, projectileBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, shipBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FIGHTER_VERTICES, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, projectileBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 2048 * 7 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

    const attributes = {
      positionLocation: gl.getAttribLocation(program, "aPosition"),
      offset: gl.getAttribLocation(program, "aOffset"),
      scale: gl.getAttribLocation(program, "aScale"),
      tint: gl.getAttribLocation(program, "aTint"),
    };
    const uniforms = {
      viewProjection: gl.getUniformLocation(program, "uViewProjection"),
      model: gl.getUniformLocation(program, "uModel"),
      isInstance: gl.getUniformLocation(program, "uIsInstance"),
      material: gl.getUniformLocation(program, "uMaterial"),
    };
    if (Object.values(attributes).some((value) => value < 0) ||
        Object.values(uniforms).some((value) => value === null)) {
      throw new Error("Orbital renderer shader inputs are incomplete.");
    }
    const { positionLocation, offset, scale, tint } = attributes;
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);

    const resize = () => {
      if (disposed) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const setInstanceAttributes = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
      gl.enableVertexAttribArray(offset);
      gl.vertexAttribPointer(offset, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(offset, 1);
      gl.enableVertexAttribArray(scale);
      gl.vertexAttribPointer(scale, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribDivisor(scale, 1);
      gl.enableVertexAttribArray(tint);
      gl.vertexAttribPointer(tint, 3, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribDivisor(tint, 1);
    };
    const clearInstanceAttributes = () => {
      for (const location of [offset, scale, tint]) {
        gl.vertexAttribDivisor(location, 0);
        gl.disableVertexAttribArray(location);
      }
    };
    const bindSphere = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    };
    const setModel = (matrix: Float32Array, material: number, viewProjection: Float32Array) => {
      gl.uniform1i(uniforms.isInstance, 0);
      gl.uniform1i(uniforms.material, material);
      gl.uniformMatrix4fv(uniforms.model, false, matrix);
      gl.uniformMatrix4fv(uniforms.viewProjection, false, viewProjection);
      clearInstanceAttributes();
      gl.vertexAttrib3f(offset, 0, 0, 0);
      gl.vertexAttrib1f(scale, 1);
      gl.vertexAttrib3f(tint, 1, 1, 1);
    };
    const drawShip = (modelPosition: Vec3, orientation: Quaternion, color: [number, number, number], viewProjection: Float32Array, size: number) => {
      const model = transformMatrix(modelPosition, orientation, size);
      setModel(model, 1, viewProjection);
      gl.vertexAttrib3f(tint, color[0], color[1], color[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, shipBuffer);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, FIGHTER_VERTICES.length / 3);
    };

    return {
      render(state) {
        if (disposed) return;
        resize();
        const q = state.orientation;
        const orientation: Quaternion = [q.x, q.y, q.z, q.w];
        const cameraOffset = rotate(orientation, 0, 2.7, 15);
        const cameraPosition = {
          x: state.position.x + cameraOffset.x,
          y: state.position.y + cameraOffset.y,
          z: state.position.z + cameraOffset.z,
        };
        const viewProjection = multiplyMatrix(
          perspectiveMatrix(canvas.width / Math.max(1, canvas.height)),
          viewMatrix(cameraPosition, orientation),
        );

        gl.clearColor(0.018, 0.035, 0.052, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);

        // Exact sector rocks from the same world contract used by flight collision.
        gl.uniform1i(uniforms.isInstance, 1);
        gl.uniform1i(uniforms.material, 0);
        gl.uniformMatrix4fv(uniforms.viewProjection, false, viewProjection);
        bindSphere();
        setInstanceAttributes();
        gl.drawElementsInstanced(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0, instances.length / 7);
        clearInstanceAttributes();

        // The target is the live simulation drone, not a HUD-only marker.
        if (state.drone.hull > 0) {
          drawShip(state.drone.position, [0, 0, 0, 1], [1, 0.30, 0.20], viewProjection, 2.4);
        }
        drawShip(state.position, orientation, factionColor, viewProjection, 0.62);

        if (state.projectiles.length) {
          const count = Math.min(state.projectiles.length, projectileInstances.length / 7);
          for (let index = 0; index < count; index++) {
            const projectile = state.projectiles[state.projectiles.length - count + index]!;
            const start = index * 7;
            projectileInstances[start] = projectile.position.x;
            projectileInstances[start + 1] = projectile.position.y;
            projectileInstances[start + 2] = projectile.position.z;
            projectileInstances[start + 3] = projectile.guided ? 1.1 : 0.42;
            projectileInstances[start + 4] = projectile.hostile ? 1 : 0.32;
            projectileInstances[start + 5] = projectile.hostile ? 0.28 : 0.82;
            projectileInstances[start + 6] = projectile.hostile ? 0.15 : 1;
          }
          gl.bindBuffer(gl.ARRAY_BUFFER, projectileBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, projectileInstances, 0, count * 7);
          gl.uniform1i(uniforms.isInstance, 1);
          gl.uniform1i(uniforms.material, 2);
          gl.uniformMatrix4fv(uniforms.viewProjection, false, viewProjection);
          bindSphere();
          setInstanceAttributes();
          gl.drawElementsInstanced(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0, count);
          clearInstanceAttributes();
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        resizeObserver?.disconnect();
        for (const buffer of buffers) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
      },
    };
  } catch (error) {
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    throw error;
  }
}
