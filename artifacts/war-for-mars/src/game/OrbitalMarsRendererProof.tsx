import { useEffect, useRef, useState } from "react";
import {
  MARS_MEAN_SOLAR_DAY_SECONDS,
  marsRotationAngle,
  marsSolarExposure,
} from "@workspace/orbital-sim";

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
uniform float uRotation;
uniform float uAspect;
out vec3 vNormal;
void main() {
  float c = cos(uRotation);
  float s = sin(uRotation);
  vec3 rotated = vec3(c * aPosition.x + s * aPosition.z, aPosition.y, -s * aPosition.x + c * aPosition.z);
  vNormal = rotated;
  gl_Position = vec4(rotated.x * 0.84 / uAspect, rotated.y * 0.84, rotated.z * 0.25, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
out vec4 outColor;
void main() {
  vec3 normal = normalize(vNormal);
  float sun = dot(normal, normalize(vec3(1.0, 0.0, 0.0)));
  float dayMix = smoothstep(-0.12, 0.1, sun);
  float terrain = sin(normal.x * 19.0 + sin(normal.z * 11.0)) * sin(normal.y * 23.0 + normal.z * 7.0);
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
    let raf = 0;
    let disposed = false;
    let previousFrame = 0;
    let lastUiUpdate = 0;
    let resizeObserver: ResizeObserver | null = null;
    let contextLost: ((event: Event) => void) | null = null;
    const { positions, indices } = createSphere();
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
      if (!vertexBuffer || !indexBuffer) throw new Error("Orbital renderer could not allocate scene buffers.");
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      const positionLocation = gl.getAttribLocation(program, "aPosition");
      const rotationLocation = gl.getUniformLocation(program, "uRotation");
      const aspectLocation = gl.getUniformLocation(program, "uAspect");
      if (positionLocation < 0 || !rotationLocation || !aspectLocation) throw new Error("Orbital renderer shader inputs are incomplete.");
      gl.enable(gl.DEPTH_TEST);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      setStatus("Orbital-owned WebGL2 renderer active · local preview only");

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
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
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
            Preview clock runs at 900× for demonstration. This proves only the isolated renderer lifecycle and planetary light model; it is not traversable flight, streamed terrain, multiplayer state, or a production replacement for the current Arena.
          </p>
        </>
      ) : <p className="uv-renderer-proof__status">{status}</p>}
    </section>
  );
}
