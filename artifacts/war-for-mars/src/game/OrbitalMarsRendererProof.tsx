import { useEffect, useRef, useState } from "react";
import {
  MARS_MEAN_SOLAR_DAY_SECONDS,
  marsRotationAngle,
  marsSolarExposure,
} from "@workspace/orbital-sim";

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aOffset;
in float aScale;
in vec3 aTint;
uniform float uRotation;
uniform float uAspect;
out vec3 vNormal;
out vec3 vTint;
void main() {
  float c = cos(uRotation);
  float s = sin(uRotation);
  vec3 rotated = vec3(c * aPosition.x + s * aPosition.z, aPosition.y, -s * aPosition.x + c * aPosition.z);
  vNormal = rotated;
  vTint = aTint;
  vec3 localPosition = rotated * aScale + aOffset;
  gl_Position = vec4(localPosition.x * 0.84 / uAspect, localPosition.y * 0.84, localPosition.z * 0.25, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vTint;
uniform bool uIsAsteroid;
out vec4 outColor;
void main() {
  vec3 normal = normalize(vNormal);
  float terrain = sin(normal.x * 19.0 + sin(normal.z * 11.0)) * sin(normal.y * 23.0 + normal.z * 7.0);
  if (uIsAsteroid) {
    float rockLight = 0.62 + 0.38 * max(dot(normal, normalize(vec3(-0.45, 0.7, 1.0))), 0.0);
    vec3 rockColor = mix(vec3(0.20, 0.16, 0.14), vec3(0.68, 0.48, 0.33), 0.52 + terrain * 0.32);
    outColor = vec4(rockColor * vTint * rockLight, 1.0);
    return;
  }
  float sun = dot(normal, normalize(vec3(1.0, 0.0, 0.0)));
  float dayMix = smoothstep(-0.12, 0.1, sun);
  vec3 dayColor = mix(vec3(0.23, 0.055, 0.028), vec3(0.83, 0.27, 0.10), 0.58 + terrain * 0.18);
  vec3 nightColor = vec3(0.025, 0.022, 0.035) + vec3(0.09, 0.022, 0.012) * max(terrain, 0.0);
  vec3 color = mix(nightColor, dayColor, dayMix);
  float rim = pow(1.0 - max(normal.z, 0.0), 3.0);
  color += vec3(0.52, 0.17, 0.075) * rim * 0.22;
  outColor = vec4(color, 1.0);
}`;

function createShader(gl: WebGL2RenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
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

function createSphere(rows = 40, columns = 64) {
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

/** Stable, local-only debris layout; one instanced draw replaces per-rock calls. */
function createAsteroidInstances(count = 72) {
  const data = new Float32Array(count * 7);
  let seed = 0x4d415253;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 1.02 + random() * 0.58;
    const offset = i * 7;
    data[offset] = Math.cos(angle) * radius;
    data[offset + 1] = Math.sin(angle) * radius * 0.74;
    data[offset + 2] = (random() - 0.5) * 0.55;
    data[offset + 3] = 0.018 + random() * 0.04;
    const shade = 0.72 + random() * 0.36;
    data[offset + 4] = shade;
    data[offset + 5] = shade * (0.94 + random() * 0.08);
    data[offset + 6] = shade * (0.86 + random() * 0.12);
  }
  return data;
}

function formatSolTime(seconds: number) {
  const fraction = ((seconds % MARS_MEAN_SOLAR_DAY_SECONDS) + MARS_MEAN_SOLAR_DAY_SECONDS) % MARS_MEAN_SOLAR_DAY_SECONDS;
  const totalMinutes = Math.floor(fraction / MARS_MEAN_SOLAR_DAY_SECONDS * 24 * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

/** An isolated Orbital-owned WebGL2 renderer proof; it is not a flight mode. */
export function OrbitalMarsRendererProof() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(0);
  const runningRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [status, setStatus] = useState("Renderer is idle; no GPU resources allocated.");

  useEffect(() => { elapsedRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "low-power" });
    if (!gl) {
      setStatus("WebGL2 is unavailable in this browser; the existing flight renderer is unchanged.");
      return;
    }

    let program: WebGLProgram | null = null;
    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let vertexBuffer: WebGLBuffer | null = null;
    let indexBuffer: WebGLBuffer | null = null;
    let asteroidVertexBuffer: WebGLBuffer | null = null;
    let asteroidIndexBuffer: WebGLBuffer | null = null;
    let instanceBuffer: WebGLBuffer | null = null;
    let raf = 0;
    let disposed = false;
    let previousFrame = 0;
    let lastUiUpdate = 0;
    let resizeObserver: ResizeObserver | null = null;
    let contextLost: ((event: Event) => void) | null = null;
    const { positions, indices } = createSphere();
    const asteroidGeometry = createSphere(8, 12);
    const asteroidInstances = createAsteroidInstances();
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
      vertexBuffer = gl.createBuffer();
      indexBuffer = gl.createBuffer();
      asteroidVertexBuffer = gl.createBuffer();
      asteroidIndexBuffer = gl.createBuffer();
      instanceBuffer = gl.createBuffer();
      if (!vertexBuffer || !indexBuffer || !asteroidVertexBuffer || !asteroidIndexBuffer || !instanceBuffer) {
        throw new Error("Orbital renderer could not allocate scene buffers.");
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, asteroidVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, asteroidGeometry.positions, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, asteroidIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, asteroidGeometry.indices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, asteroidInstances, gl.STATIC_DRAW);
      const positionLocation = gl.getAttribLocation(program, "aPosition");
      const offsetLocation = gl.getAttribLocation(program, "aOffset");
      const scaleLocation = gl.getAttribLocation(program, "aScale");
      const tintLocation = gl.getAttribLocation(program, "aTint");
      const rotationLocation = gl.getUniformLocation(program, "uRotation");
      const aspectLocation = gl.getUniformLocation(program, "uAspect");
      const asteroidLocation = gl.getUniformLocation(program, "uIsAsteroid");
      if (positionLocation < 0 || offsetLocation < 0 || scaleLocation < 0 || tintLocation < 0 ||
          !rotationLocation || !aspectLocation || !asteroidLocation) {
        throw new Error("Orbital renderer shader inputs are incomplete.");
      }
      gl.enable(gl.DEPTH_TEST);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      setStatus(`Orbital-owned WebGL2 renderer active · ${asteroidInstances.length / 7} instanced bodies · local preview only`);

      const resize = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
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

      contextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(raf);
        setStatus("GPU context lost. Close and reopen this preview to recreate its resources.");
      };
      canvas.addEventListener("webglcontextlost", contextLost);

      const frame = (now: number) => {
        if (disposed) return;
        resize();
        const dt = previousFrame ? Math.min((now - previousFrame) / 1000, 0.1) : 0;
        previousFrame = now;
        if (runningRef.current) {
          elapsedRef.current += dt * 900;
          if (now - lastUiUpdate >= 250) {
            setElapsedSeconds(elapsedRef.current);
            lastUiUpdate = now;
          }
        }
        gl.clearColor(0.025, 0.04, 0.055, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform1f(rotationLocation, marsRotationAngle(elapsedRef.current));
        gl.uniform1f(aspectLocation, canvas.width / Math.max(1, canvas.height));
        gl.uniform1i(asteroidLocation, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(offsetLocation);
        gl.disableVertexAttribArray(scaleLocation);
        gl.disableVertexAttribArray(tintLocation);
        gl.vertexAttrib3f(offsetLocation, 0, 0, 0);
        gl.vertexAttrib1f(scaleLocation, 1);
        gl.vertexAttrib3f(tintLocation, 1, 1, 1);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        gl.uniform1f(rotationLocation, 0);
        gl.uniform1i(asteroidLocation, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, asteroidVertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, asteroidIndexBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
        gl.enableVertexAttribArray(offsetLocation);
        gl.vertexAttribPointer(offsetLocation, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(offsetLocation, 1);
        gl.enableVertexAttribArray(scaleLocation);
        gl.vertexAttribPointer(scaleLocation, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribDivisor(scaleLocation, 1);
        gl.enableVertexAttribArray(tintLocation);
        gl.vertexAttribPointer(tintLocation, 3, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribDivisor(tintLocation, 1);
        gl.drawElementsInstanced(
          gl.TRIANGLES,
          asteroidGeometry.indices.length,
          gl.UNSIGNED_SHORT,
          0,
          asteroidInstances.length / 7,
        );
        gl.vertexAttribDivisor(offsetLocation, 0);
        gl.vertexAttribDivisor(scaleLocation, 0);
        gl.vertexAttribDivisor(tintLocation, 0);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        resizeObserver?.disconnect();
        if (contextLost) canvas.removeEventListener("webglcontextlost", contextLost);
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (indexBuffer) gl.deleteBuffer(indexBuffer);
        if (asteroidVertexBuffer) gl.deleteBuffer(asteroidVertexBuffer);
        if (asteroidIndexBuffer) gl.deleteBuffer(asteroidIndexBuffer);
        if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
        if (program) gl.deleteProgram(program);
      };
    } catch (error) {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      if (contextLost) canvas.removeEventListener("webglcontextlost", contextLost);
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      if (indexBuffer) gl.deleteBuffer(indexBuffer);
      if (asteroidVertexBuffer) gl.deleteBuffer(asteroidVertexBuffer);
      if (asteroidIndexBuffer) gl.deleteBuffer(asteroidIndexBuffer);
      if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
      if (program) gl.deleteProgram(program);
      setStatus(`Renderer preview failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return undefined;
    }
  }, [enabled]);

  const exposure = marsSolarExposure(
    { latitudeDegrees: 18, longitudeDegrees: 90 },
    elapsedSeconds,
  );
  const angleDegrees = marsRotationAngle(elapsedSeconds) * 180 / Math.PI;

  return (
    <section className="uv-renderer-proof" aria-label="Orbital renderer prototype">
      <div className="uv-renderer-proof__heading">
        <div><b>ORBITAL RENDERER PROOF</b><small>Planet spin + day/night lighting · isolated preview</small></div>
        <button type="button" onClick={() => setEnabled((value) => !value)}>
          {enabled ? "CLOSE PREVIEW" : "OPEN PREVIEW"}
        </button>
      </div>
      {enabled ? (
        <>
          <canvas ref={canvasRef} className="uv-renderer-proof__canvas" aria-label="Rotating Mars renderer preview" />
          <p className="uv-renderer-proof__status" role="status">{status}</p>
          <div className="uv-renderer-proof__readout">
            <span>LOCAL PREVIEW TIME · {formatSolTime(elapsedSeconds)}</span>
            <span>18°N / 90°E STATION · {exposure.daylight ? "DAYLIGHT" : "NIGHT"} · {Math.round(exposure.directFraction * 100)}% DIRECT SUN</span>
            <span>PLANET ROTATION · {angleDegrees.toFixed(1)}°</span>
          </div>
          <label className="uv-renderer-proof__range">
            <span>Preview time across one Mars sol</span>
            <input
              aria-label="Mars preview time"
              type="range"
              min={0}
              max={MARS_MEAN_SOLAR_DAY_SECONDS}
              step={300}
              value={elapsedSeconds % MARS_MEAN_SOLAR_DAY_SECONDS}
              onChange={(event) => {
                setRunning(false);
                setElapsedSeconds(Number(event.currentTarget.value));
              }}
            />
          </label>
          <button className="uv-renderer-proof__clock" type="button" onClick={() => setRunning((value) => !value)}>
            {running ? "PAUSE PREVIEW CLOCK" : "RUN PREVIEW CLOCK"}
          </button>
          <p className="uv-renderer-proof__scope">
            Preview clock runs at 900× for demonstration. The debris layout is deterministic and batched in one instanced GPU draw. This proves only the isolated renderer lifecycle and planetary light model; it is not simulation-driven flight, streamed terrain, multiplayer state, or a production replacement for the current Arena.
          </p>
        </>
      ) : <p className="uv-renderer-proof__status">{status}</p>}
    </section>
  );
}
