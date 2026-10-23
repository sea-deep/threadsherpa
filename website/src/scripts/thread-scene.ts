/* The dimensional thread behind Campfire. Loaded only on wide, motion-friendly
   screens. The static poster underneath is the complete fallback. */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';

export type ScenePhase = 'idle' | 'saved' | 'answered';

type ThreadScene = {
  setPhase(phase: ScenePhase | string): void;
  setPointer(x: number, y: number): void;
  destroy(): void;
};

const GLYPHS = ['·', '+', ':', '=', '×', '/', '\\', '~'];

function glyphAtlas(): CanvasTexture {
  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 4;
  canvas.height = cell * 2;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '46px "JetBrains Mono", ui-monospace, monospace';
    GLYPHS.forEach((glyph, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      context.fillText(glyph, column * cell + cell / 2, row * cell + cell / 2 + 2);
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function ribbonGeometry(): BufferGeometry {
  const count = 560;
  const positions = new Float32Array(count * 3);
  const glyphs = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const ts = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const strand = index % 4;
    const spread = (strand - 1.5) * 0.14;
    const x = -5.4 + t * 10.8;
    const y =
      Math.sin(t * Math.PI * 2.1 + 0.4) * 1.35 +
      Math.sin(t * Math.PI * 5.2) * 0.32 +
      spread;
    const z =
      Math.cos(t * Math.PI * 1.6 + 0.6) * 0.9 +
      Math.sin(t * Math.PI * 3.4) * 0.2 +
      strand * 0.03;
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;
    glyphs[index] = Math.floor(Math.random() * GLYPHS.length);
    sizes[index] = 9 + Math.random() * 7 + (Math.random() > 0.92 ? 5 : 0);
    seeds[index] = Math.random();
    ts[index] = t;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aGlyph', new BufferAttribute(glyphs, 1));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  geometry.setAttribute('aT', new BufferAttribute(ts, 1));
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReveal;
  uniform vec2 uPointer;
  uniform float uPulse;
  uniform float uPulseActive;
  attribute float aGlyph;
  attribute float aSize;
  attribute float aSeed;
  attribute float aT;
  varying vec2 vUv;
  varying float vGlow;
  varying float vNear;

  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.34 + aSeed * 6.283) * 0.035;
    p.z += cos(uTime * 0.27 + aSeed * 4.1) * 0.025;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    vec2 ndc = gl_Position.xy / max(gl_Position.w, 0.0001);
    float near = smoothstep(0.42, 0.0, distance(ndc, uPointer));
    float pulse = uPulseActive * smoothstep(0.11, 0.0, abs(aT - uPulse));
    float shimmer = 0.72 + 0.28 * sin(uTime * 0.7 + aSeed * 12.0);

    vNear = near;
    vGlow = clamp(shimmer + near * 1.15 + pulse * 1.8, 0.0, 2.4) * uReveal;
    gl_PointSize = aSize * uPixelRatio * (5.4 / max(-mv.z, 0.4)) * (1.0 + near * 0.7 + pulse * 0.8);

    float column = mod(aGlyph, 4.0);
    float row = floor(aGlyph / 4.0);
    vUv = vec2((column + gl_PointCoord.x) / 4.0, (row + gl_PointCoord.y) / 2.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uWarm;
  uniform vec3 uCool;
  varying vec2 vUv;
  varying float vGlow;
  varying float vNear;

  void main() {
    vec4 glyph = texture2D(uAtlas, vUv);
    if (glyph.a < 0.06) discard;
    vec3 color = mix(uWarm, uCool, clamp(vNear * 0.65, 0.0, 0.62));
    gl_FragColor = vec4(color * vGlow, glyph.a * clamp(vGlow, 0.0, 1.0) * 0.82);
  }
`;

export function mountThreadScene(canvas: HTMLCanvasElement): ThreadScene {
  const stage = canvas.closest<HTMLElement>('.stage') ?? canvas.parentElement;
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(0, 0, 6.4);
  camera.lookAt(0, 0, 0);

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uReveal: { value: 0 },
      uPointer: { value: new Vector2(0.4, 0.2) },
      uPulse: { value: 1.2 },
      uPulseActive: { value: 0 },
      uAtlas: { value: glyphAtlas() },
      uWarm: { value: new Color('#f2a03d') },
      uCool: { value: new Color('#fbe3be') },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const geometry = ribbonGeometry();
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 1;
  scene.add(points);

  const clock = { value: 0 };
  const pointer = { x: 0.4, y: 0.2 };
  const targetPointer = { x: 0.4, y: 0.2 };
  let phase: ScenePhase = 'idle';
  let frame = 0;
  let running = false;
  let last = 0;
  let revealed = false;
  let visible = true;

  function resize() {
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    material.uniforms.uPixelRatio!.value = renderer.getPixelRatio();
  }

  const resizeObserver = new ResizeObserver(resize);
  if (stage) resizeObserver.observe(stage);
  resize();

  const visibility = new IntersectionObserver(
    (entries) => {
      visible = Boolean(entries[0]?.isIntersecting);
      if (visible && !running && !document.hidden && !paused()) start();
    },
    { rootMargin: '80px' }
  );
  if (stage) visibility.observe(stage);

  function paused(): boolean {
    return (
      document.documentElement.classList.contains('motion-paused') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function loop(now: number) {
    if (!running) return;
    frame = requestAnimationFrame(loop);
    if (!visible || document.hidden || paused()) {
      running = false;
      cancelAnimationFrame(frame);
      return;
    }
    const delta = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    clock.value += delta;
    material.uniforms.uTime!.value = clock.value;
    pointer.x += (targetPointer.x - pointer.x) * Math.min(1, delta * 6);
    pointer.y += (targetPointer.y - pointer.y) * Math.min(1, delta * 6);
    (material.uniforms.uPointer!.value as { x: number; y: number }).x = pointer.x;
    (material.uniforms.uPointer!.value as { x: number; y: number }).y = pointer.y;
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  function reveal() {
    canvas.classList.add('is-ready');
    if (revealed) return;
    revealed = true;
    import('gsap')
      .then(({ default: gsap }) => {
        gsap.to(material.uniforms.uReveal!, { value: 1, duration: 0.86, ease: 'power2.out' });
        gsap.fromTo(
          camera.position,
          { z: 7.1 },
          { z: 6.4, duration: 0.9, ease: 'power3.out' }
        );
      })
      .catch(() => {
        material.uniforms.uReveal!.value = 1;
      });
  }

  function setPhase(next: ScenePhase | string) {
    phase = next === 'saved' || next === 'answered' ? next : 'idle';
    if (phase === 'idle' || paused()) {
      material.uniforms.uPulseActive!.value = 0;
      return;
    }
    import('gsap')
      .then(({ default: gsap }) => {
        material.uniforms.uPulseActive!.value = 1;
        material.uniforms.uPulse!.value = 1.14;
        gsap.to(material.uniforms.uPulse!, {
          value: -0.16,
          duration: phase === 'saved' ? 0.62 : 0.9,
          ease: 'power2.inOut',
          onComplete: () => {
            material.uniforms.uPulseActive!.value = 0;
          },
        });
      })
      .catch(() => {
        material.uniforms.uPulseActive!.value = 0;
      });
  }

  function setPointer(x: number, y: number) {
    targetPointer.x = x;
    targetPointer.y = y;
  }

  let pointerFrame = 0;
  function onPointer(event: PointerEvent) {
    if (!stage || pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      const rect = stage.getBoundingClientRect();
      targetPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    });
  }

  function onVisibility() {
    if (document.hidden) stop();
    else if (visible && !paused()) start();
  }

  function onMotion(event: Event) {
    const pausedNow = (event as CustomEvent<{ paused?: boolean }>).detail?.paused ?? paused();
    if (pausedNow) stop();
    else if (visible && !document.hidden) start();
  }

  stage?.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('ts:motion', onMotion);

  revealed = false;
  if (!paused()) {
    start();
    reveal();
  } else {
    material.uniforms.uReveal!.value = 1;
  }

  function destroy() {
    stop();
    resizeObserver.disconnect();
    visibility.disconnect();
    stage?.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('ts:motion', onMotion);
    geometry.dispose();
    material.uniforms.uAtlas!.value?.dispose?.();
    material.dispose();
    renderer.dispose();
    canvas.classList.remove('is-ready');
  }

  return { setPhase, setPointer, destroy };
}
